import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Keep uploads on the site's own origin. Authentication, ownership and Storage
// policies are checked on the server; no privileged key is needed.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 4_200_000) return NextResponse.json({ error: "Снимката е прекалено голяма." }, { status: 413 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Влез отново в профила си." }, { status: 401 });
  const { data: admin, error: authError } = await db.rpc("is_admin");
  if (authError || !admin) return NextResponse.json({ error: "Нужен е администраторски достъп." }, { status: 403 });
  try {
    const form = await request.formData();
    const id = form.get("listingId");
    const name = form.get("name");
    const file = form.get("photo");
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id) || typeof name !== "string" || !/^bulk-\d{1,2}-[a-f0-9]{32}\.jpg$/.test(name) || !(file instanceof File) || file.size < 1 || file.size > 4_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json({ error: "Невалидна снимка. Използвай JPG, PNG или WebP до 4 MB." }, { status: 400 });
    }
    const { data: row, error } = await db.from("listings").select("id,status").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error || !row || row.status !== "inactive") return NextResponse.json({ error: "Обявата вече е публикувана или не е подготвена за този импорт." }, { status: 409 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!jpeg && !png && !webp) return NextResponse.json({ error: "Файлът не е поддържана снимка." }, { status: 400 });
    const { error: uploadError } = await db.storage.from("listing-photos").upload(`${user.id}/${id}/${name}`, bytes, { upsert: false, contentType: jpeg ? "image/jpeg" : png ? "image/png" : "image/webp", cacheControl: "3600" });
    if (uploadError && uploadError.message !== "The resource already exists" && !("statusCode" in uploadError && String(uploadError.statusCode) === "409")) return NextResponse.json({ error: `Качването не успя: ${uploadError.message}` }, { status: 502 });
    return NextResponse.json({ name });
  } catch {
    return NextResponse.json({ error: "Качването не успя. Опитай отново." }, { status: 500 });
  }
}
