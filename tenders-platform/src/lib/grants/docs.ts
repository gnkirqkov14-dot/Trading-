import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { docxToText, fetchBinary, fetchIsunInfo, type IsunInfo } from "./isun";
import type { GrantCall } from "./types";

/**
 * Официалните документи на процедура в ИСУН — за помощника за
 * кандидатстване. Всяка процедура публикува „Условия за кандидатстване“
 * (обикновено ZIP с Word/PDF файлове): самите условия (раздели 1–27 по
 * единния образец), указания за попълване на е-формуляра, критерии за
 * оценка и образци на декларации. Теглим ги без вход, вадим текста на
 * трите важни файла и имената на всички останали.
 *
 * Проверено на 04.10.2026 с BG16RFPR001-2.003 и BG05SFPR002-1.034.
 */

export type GrantDoc = { label: "УК" | "ЕФ" | "КР"; name: string; text: string };

export type GrantDocs = {
  info: IsunInfo;
  /** Условия за кандидатстване (УК), указания за е-формуляра (ЕФ), критерии (КР). */
  docs: GrantDoc[];
  /** Имената на всички файлове в архивите — за списъка с документи. */
  files: string[];
  /** Публикувани изменения — най-новото е ползвано, ако е на условията. */
  amendments: string[];
  /** Хеш на ключовете на документите — при нов документ разборът е остарял. */
  hash: string;
};

const MAX_ARCHIVE = 60_000_000;
const MAX_TEXT_FILE = 8_000_000;

/** Хеш от ключовете на файловете на страницата — без да ги теглим. */
export function docsHash(info: IsunInfo) {
  return createHash("sha256")
    .update(info.documents.map((d) => d.key ?? d.url).sort().join("|"))
    .digest("hex")
    .slice(0, 32);
}

export async function grantInfo(grant: Pick<GrantCall, "url" | "code" | "title">) {
  if (!grant.url) throw new Error("процедурата няма страница в ИСУН");
  const guid = grant.url.match(/([0-9a-f-]{36})/i)?.[1] ?? "";
  return fetchIsunInfo({
    id: "",
    kind: "open",
    source: grant.url.includes("ProcedureNims") ? "isun_nims" : "isun",
    guid,
    code: grant.code,
    title: grant.title,
    programme: null,
    url: grant.url,
  });
}

/** Имената в ZIP без UTF-8 флаг са в кодировка на DOS (CP866) — fflate ги чете като latin1. */
function zipName(name: string) {
  if (!/[\u0080-ÿ]/.test(name)) return name;
  try {
    return new TextDecoder("ibm866").decode(Uint8Array.from(name, (c) => c.charCodeAt(0) & 0xff));
  } catch {
    return name;
  }
}

type RawFile = { name: string; bytes: Uint8Array };

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b;
const is7z = (b: Uint8Array) => b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf;
const isRar = (b: Uint8Array) => b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21;
const isPdf = (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

/** 7-zip и RAR — през 7-Zip, компилиран до WebAssembly. */
async function un7z(bytes: Uint8Array): Promise<RawFile[]> {
  const { default: SevenZipFactory } = await import("7z-wasm");
  const sz = await SevenZipFactory({ print: () => {}, printErr: () => {} });
  sz.FS.writeFile("/in.bin", bytes);
  sz.FS.mkdir("/out");
  sz.callMain(["x", "/in.bin", "-o/out", "-y"]);
  const walk = (dir: string): string[] =>
    sz.FS.readdir(dir)
      .filter((n) => n !== "." && n !== "..")
      .flatMap((n) => {
        const p = `${dir}/${n}`;
        return sz.FS.isDir(sz.FS.stat(p).mode) ? walk(p) : [p];
      });
  return walk("/out").map((p) => ({ name: p.slice(5), bytes: sz.FS.readFile(p) }));
}

/**
 * Разопакова архивите (ZIP, 7z, RAR, вложени) и слага разширение на
 * файловете, дошли без него: ИСУН понякога дава Word или PDF направо, с
 * име „Условия за кандидатстване“ без „.docx“. DOCX също е ZIP — познава
 * се по word/document.xml вътре.
 */
async function expand(name: string, bytes: Uint8Array, depth = 0): Promise<RawFile[]> {
  if (depth > 2) return [{ name, bytes }];
  if (isPdf(bytes)) return [{ name: /\.pdf$/i.test(name) ? name : `${name}.pdf`, bytes }];
  let inner: RawFile[] | null = null;
  if (isZip(bytes) && !/\.(xlsx|pptx)$/i.test(name)) {
    const entries = Object.entries(unzipSync(bytes));
    if (entries.some(([n]) => n === "word/document.xml")) {
      return [{ name: /\.docx$/i.test(name) ? name : `${name}.docx`, bytes }];
    }
    inner = entries.filter(([, d]) => d.length).map(([n, d]) => ({ name: zipName(n), bytes: d }));
  } else if (is7z(bytes) || isRar(bytes)) {
    inner = await un7z(bytes);
  }
  if (!inner) return [{ name, bytes }];
  const out: RawFile[] = [];
  for (const f of inner) out.push(...(await expand(f.name, f.bytes, depth + 1)));
  return out;
}

async function pdfText(bytes: Uint8Array) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes.slice());
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function fileText(f: RawFile): Promise<string | null> {
  if (f.bytes.length > MAX_TEXT_FILE) return null;
  if (/\.docx$/i.test(f.name)) return docxToText(Buffer.from(f.bytes));
  if (/\.pdf$/i.test(f.name)) return pdfText(f.bytes).catch(() => null);
  return null;
}

const base = (name: string) => name.split("/").pop() ?? name;
const readable = (f: RawFile) => /\.(docx|pdf)$/i.test(f.name);

/** Кой файл какъв е — по името (кирилица или латиница). */
function pick(files: RawFile[]) {
  const by = (re: RegExp) =>
    files
      .filter((f) => readable(f) && re.test(base(f.name)))
      .sort((a, b) => b.bytes.length - a.bytes.length)[0] ?? null;
  const form = by(/e-?formul|е-?формуляр|e-?form|eform/i);
  const criteria = by(/kriteri|критери|ocenk|оценк/i) ?? by(/metodika|методика/i);
  const main =
    by(/(^|[_\s-])(UK|УК)([_\s.-]|$)|uslovi[a-z]*[_\s]za[_\s]kandid|условия за кандидатстване/i) ??
    // Най-големият документ, който не е друго приложение.
    files
      .filter((f) => readable(f) && f !== form && f !== criteria && !/pril|прил|annex/i.test(base(f.name)))
      .sort((a, b) => b.bytes.length - a.bytes.length)[0] ??
    null;
  return { main, form, criteria };
}

export async function fetchGrantDocs(grant: Pick<GrantCall, "url" | "code" | "title">): Promise<GrantDocs> {
  const info = await grantInfo(grant);
  const amendments = info.documents.filter((d) => /изменени|актуализ|промян/i.test(d.name)).map((d) => d.name);
  // Условията (най-новото изменение, ако има), плюс приложенията „за информация“,
  // защото при някои процедури указанията и критериите са в отделен архив.
  const conditions =
    [...info.documents].reverse().find((d) => /изменени.*услови.*кандидат/i.test(d.name)) ??
    info.documents.find((d) => /услови.*кандидат/i.test(d.name));
  const extra = info.documents.filter(
    (d) => d !== conditions && /документи за информация|приложения за информация|документи за попълване|приложения за попълване/i.test(d.name),
  );
  if (!conditions) throw new Error("в ИСУН няма „Условия за кандидатстване“ за тази процедура");

  const files: RawFile[] = [];
  let total = 0;
  for (const d of [conditions, ...extra].slice(0, 5)) {
    const { bytes } = await fetchBinary(d.url, MAX_ARCHIVE);
    total += bytes.length;
    if (total > MAX_ARCHIVE * 2) break;
    files.push(...(await expand(d.name, new Uint8Array(bytes))));
  }

  const chosen = pick(files);
  const docs: GrantDoc[] = [];
  for (const [label, f] of [
    ["УК", chosen.main],
    ["ЕФ", chosen.form],
    ["КР", chosen.criteria],
  ] as const) {
    if (!f) continue;
    const text = await fileText(f);
    if (text && text.length > 500) docs.push({ label, name: base(f.name), text });
  }
  if (!docs.some((d) => d.label === "УК")) throw new Error("не успяхме да прочетем условията за кандидатстване");

  return {
    info,
    docs,
    files: [...new Set(files.map((f) => base(f.name)))].slice(0, 120),
    amendments,
    hash: docsHash(info),
  };
}
