import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { etiket, linkKamObyava, vsichkiObyavi } from "@/lib/admin-eksport";

/**
 * CSV с всички активни обяви за сравнение в Excel. Само за админ. Пътят е
 * под `/admin`, затова лимитът на защитната стена за `/listings` не го
 * засяга — това е една заявка, не хиляди отваряния.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Влез в профила си.", { status: 401 });
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) return new NextResponse("Само за админ.", { status: 403 });

  const obyavi = await vsichkiObyavi(supabase);

  const koloni: [string, (o: (typeof obyavi)[number]) => unknown][] = [
    ["ID", (o) => o.id],
    ["Статус", (o) => etiket.status(o.status)],
    ["Сделка", (o) => etiket.type(o.type)],
    ["Вид имот", (o) => etiket.property(o.property_type)],
    ["Заглавие", (o) => o.title],
    ["Град", (o) => o.grad],
    ["Квартал", (o) => o.kvartal],
    ["Цена €", (o) => o.price],
    ["Кв.м", (o) => o.area_sqm],
    ["Стаи", (o) => o.rooms],
    ["Етаж", (o) => o.floor],
    ["Телефон", (o) => o.phone],
    ["Телефон (единен запис)", (o) => o.telefon],
    ["Адрес", (o) => o.address],
    ["Профил", (o) => o.sobstvenik],
    ["Качена", (o) => o.created_at.slice(0, 16).replace("T", " ")],
    ["Последна промяна", (o) => o.updated_at.slice(0, 16).replace("T", " ")],
    ["Брой снимки", (o) => o.broy_snimki],
    ["Основна снимка", (o) => o.korica],
    ["Линк", (o) => linkKamObyava(o.id)],
    ["Източник", (o) => o.source_url],
    ["Описание", (o) => o.description],
  ];

  // Точка и запетая: българският Excel чете запетаята като десетична.
  const kletka = (v: unknown) =>
    v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`;
  const redove = [
    koloni.map(([ime]) => kletka(ime)).join(";"),
    ...obyavi.map((o) => koloni.map(([, f]) => kletka(f(o))).join(";")),
  ];
  // BOM, за да отвори Excel кирилицата правилно.
  const csv = "﻿" + redove.join("\r\n");
  const data = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="imotpoint-obyavi-${data}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
