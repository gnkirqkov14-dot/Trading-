/**
 * Маха телефони, имейли и сайтове, изписани върху снимките на обява.
 *
 * Описанието се чисти с `cleanListingDescription`, но собствениците пишат
 * номера си и върху самите снимки — и така купувачът звъни, без да мине
 * през сайта. Тук всяка нова снимка минава през Google Cloud Vision
 * (разпознаване на текст); намереният контакт се запълва от околните
 * пиксели и снимката в обявата се сменя с чистата.
 *
 * Без `GOOGLE_VISION_API_KEY` не прави нищо. Пуска се с `after()`, след
 * като обявата е записана, за да не бави публикуването; ако нещо се
 * счупи, обявата си остава с оригиналните снимки.
 *
 * Знакът „imotpoint.com“ долу вдясно е наш и не се пипа.
 */
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import type { createClient } from "@/lib/supabase/server";
import { kontaktiVTekst } from "@/lib/listing-description";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Kutiya = { x0: number; y0: number; x1: number; y1: number };
type Duma = Kutiya & { text: string };

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

async function dumiNaSnimkata(snimka: Buffer, kluch: string): Promise<Duma[]> {
  const res = await fetch(`${VISION_URL}?key=${kluch}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: snimka.toString("base64") },
          features: [{ type: "TEXT_DETECTION" }],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision ${res.status}`);
  const data = await res.json();
  // Първият запис е целият текст; след него идват отделните думи.
  const dumi = (data.responses?.[0]?.textAnnotations ?? []).slice(1);
  return dumi.map(
    (d: {
      description: string;
      boundingPoly: { vertices: { x?: number; y?: number }[] };
    }) => {
      const xs = d.boundingPoly.vertices.map((v) => v.x ?? 0);
      const ys = d.boundingPoly.vertices.map((v) => v.y ?? 0);
      return {
        text: d.description,
        x0: Math.min(...xs),
        y0: Math.min(...ys),
        x1: Math.max(...xs),
        y1: Math.max(...ys),
      };
    },
  );
}

/** Нарежда думите на редове и връща кутиите на контактите в тях. */
function kutiiNaKontakti(dumi: Duma[]): Kutiya[] {
  const redove: Duma[][] = [];
  for (const d of [...dumi].sort((a, b) => a.y0 + a.y1 - b.y0 - b.y1)) {
    const sredata = (d.y0 + d.y1) / 2;
    const red = redove.find((r) => {
      const p = r[0];
      return Math.abs((p.y0 + p.y1) / 2 - sredata) < (p.y1 - p.y0) * 0.6;
    });
    if (red) red.push(d);
    else redove.push([d]);
  }

  const kutii: Kutiya[] = [];
  for (const red of redove) {
    red.sort((a, b) => a.x0 - b.x0);
    // Пазим къде в общия текст на реда започва всяка дума.
    let tekst = "";
    const nachala = red.map((d) => {
      const n = tekst.length;
      tekst += d.text + " ";
      return n;
    });
    for (const [ot, do_] of kontaktiVTekst(tekst)) {
      const zasegnati = red.filter(
        (d, i) => nachala[i] < do_ && nachala[i] + d.text.length > ot,
      );
      if (!zasegnati.length) continue;
      kutii.push({
        x0: Math.min(...zasegnati.map((d) => d.x0)),
        y0: Math.min(...zasegnati.map((d) => d.y0)),
        x1: Math.max(...zasegnati.map((d) => d.x1)),
        y1: Math.max(...zasegnati.map((d) => d.y1)),
      });
    }
  }
  return kutii;
}

/**
 * Запълва кутиите от ръбовете им: всеки пиксел е средното от плавния
 * преход отгоре-надолу и отляво-надясно. Върху стена или небе не личи;
 * върху шарка остава леко размазано петно, което е по-добре от номер.
 */
async function zapalni(snimka: Buffer, kutii: Kutiya[]): Promise<Buffer> {
  const { data, info } = await sharp(snimka)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x: number, y: number, c: number) => data[(y * w + x) * 3 + c];

  for (const k of kutii) {
    const zapas = Math.max(4, Math.round((k.y1 - k.y0) * 0.25));
    const x0 = Math.max(1, k.x0 - zapas);
    const y0 = Math.max(1, k.y0 - zapas);
    const x1 = Math.min(w - 2, k.x1 + zapas);
    const y1 = Math.min(h - 2, k.y1 + zapas);
    const gore = y0 - 1;
    const dolu = y1 + 1;
    const lyavo = x0 - 1;
    const dyasno = x1 + 1;
    // Ръбовете се четат преди да започне писането в кутията.
    const ryb = (x: number, y: number) => [0, 1, 2].map((c) => px(x, y, c));
    const goreR = Array.from({ length: x1 - x0 + 1 }, (_, i) => ryb(x0 + i, gore));
    const doluR = Array.from({ length: x1 - x0 + 1 }, (_, i) => ryb(x0 + i, dolu));
    const lyavoR = Array.from({ length: y1 - y0 + 1 }, (_, i) => ryb(lyavo, y0 + i));
    const dyasnoR = Array.from({ length: y1 - y0 + 1 }, (_, i) => ryb(dyasno, y0 + i));

    for (let y = y0; y <= y1; y++) {
      const ty = (y - gore) / (dolu - gore);
      for (let x = x0; x <= x1; x++) {
        const tx = (x - lyavo) / (dyasno - lyavo);
        for (let c = 0; c < 3; c++) {
          const vert = goreR[x - x0][c] * (1 - ty) + doluR[x - x0][c] * ty;
          const hor = lyavoR[y - y0][c] * (1 - tx) + dyasnoR[y - y0][c] * tx;
          data[(y * w + x) * 3 + c] = Math.round((vert + hor) / 2);
        }
      }
    }
  }

  return sharp(data, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function mahniKontaktiOtSnimki(
  supabase: Supabase,
  listingId: string,
  urls: string[],
) {
  const kluch = process.env.GOOGLE_VISION_API_KEY;
  if (!kluch || !urls.length) return;

  let promeneni = 0;
  for (const url of urls) {
    try {
      const pat = url.split("/listing-photos/")[1];
      if (!pat) continue;
      const res = await fetch(url);
      if (!res.ok) continue;
      const snimka = Buffer.from(await res.arrayBuffer());

      const kutii = kutiiNaKontakti(await dumiNaSnimkata(snimka, kluch));
      if (!kutii.length) continue;

      const chista = await zapalni(snimka, kutii);
      const novPat = pat.replace(/\.[^./]+$/, "") + "-bez-tel.jpg";
      const { error } = await supabase.storage
        .from("listing-photos")
        .upload(decodeURIComponent(novPat), chista, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (error) throw error;
      const novUrl = url.replace(pat, novPat);
      await supabase
        .from("listing_photos")
        .update({ url: novUrl })
        .eq("listing_id", listingId)
        .eq("url", url);
      promeneni++;
    } catch (err) {
      console.error("mahniKontaktiOtSnimki", listingId, err);
    }
  }

  if (promeneni) {
    revalidatePath(`/listings/${listingId}`);
    revalidatePath("/listings");
  }
}
