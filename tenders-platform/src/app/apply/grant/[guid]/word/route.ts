import { cookies } from "next/headers";
import { guideToDocx } from "@/lib/apply/docx";
import { grantFitKey, grantGuideKey } from "@/lib/apply/grant";
import { buildGrantBlocks } from "@/lib/apply/grant-blocks";
import type { GrantFit, GrantGuide } from "@/lib/apply/types";
import { formatDateTime } from "@/lib/format";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[0-9a-f]{48}$/;

/** Готовата помощ по програма като Word файл — без AI, от запазения разбор. */
export async function GET(_req: Request, { params }: { params: Promise<{ guid: string }> }) {
  const guid = (await params).guid;
  if (!/^[0-9a-f-]{36}$/i.test(guid)) return new Response("Няма такава процедура", { status: 404 });
  const id = `isun:${guid}`;
  const store = getStore();
  const guide = (await store.getGuide<GrantGuide>(grantGuideKey(id)))?.guide;
  if (!guide) {
    return new Response("Първо направете помощта на страницата на процедурата.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const raw = (await cookies()).get("advisor_profile")?.value ?? null;
  const token = raw && TOKEN_RE.test(raw) ? raw : null;
  const saved = token ? await store.getProfile(token).catch(() => null) : null;
  const fitRow = saved && token ? await store.getGuide<GrantFit>(grantFitKey(id, token)).catch(() => null) : null;
  const fit = fitRow && fitRow.guide.guideCreatedAt === guide.createdAt ? fitRow.guide : null;

  const blocks = buildGrantBlocks(guide, fit, saved?.company ?? {}, Boolean(saved));
  const bytes = await guideToDocx(
    `Кандидатстване: ${guide.code ?? ""} ${guide.title}`.trim(),
    `Направено на ${formatDateTime(guide.createdAt)} от официалните документи на процедурата в ИСУН. Това е помощ, не правен съвет.`,
    blocks,
  );
  const name = `kandidatstvane-${(guide.code ?? guid).replace(/[^A-Za-z0-9.-]/g, "_")}.docx`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
