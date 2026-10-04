import { cookies } from "next/headers";
import { guideToDocx } from "@/lib/apply/docx";
import { buildEspdBlocks } from "@/lib/apply/espd";
import { guideKey } from "@/lib/apply/tender";
import { formatDateTime } from "@/lib/format";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[0-9a-f]{48}$/;

/** Готовата помощ като Word файл — без AI, от запазения разбор. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("Няма такава поръчка", { status: 404 });
  const store = getStore();
  const tender = await store.getTender(id);
  if (!tender) return new Response("Няма такава поръчка", { status: 404 });

  const raw = (await cookies()).get("advisor_profile")?.value ?? null;
  const token = raw && TOKEN_RE.test(raw) ? raw : null;
  const saved = token ? await store.getProfile(token).catch(() => null) : null;
  const cached = await store.getGuide(guideKey(id, saved ? token : null));
  if (!cached) {
    return new Response("Първо направете помощта на страницата на поръчката.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const lot = tender.lot_number ? `обособена позиция ${tender.lot_number}${tender.lot_title ? ` — ${tender.lot_title}` : ""}` : null;
  const blocks = buildEspdBlocks(cached.guide, saved?.company ?? {}, lot);
  const bytes = await guideToDocx(
    `ЕЕДОП и оферта — поръчка № ${id}`,
    `${cached.guide.title}. Направено на ${formatDateTime(cached.guide.createdAt)} от официалното обявление в ЦАИС ЕОП. Това е помощ, не правен съвет.`,
    blocks,
  );
  const name = `EEDOP-pomosht-${id}.docx`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
