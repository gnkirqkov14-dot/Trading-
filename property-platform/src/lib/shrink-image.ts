/**
 * Смалява снимка в браузъра, преди да тръгне към Supabase.
 *
 * Телефоните дават кадри по 3–4 MB. Такава снимка се качва бавно по мобилен
 * интернет, заема място и после всеки посетител я тегли цялата, за да я види
 * в квадратче от няколкостотин пиксела. 1920px по дългата страна стига за
 * всеки екран, а файлът пада до няколкостотин килобайта.
 *
 * Правило: никога не връщаме нещо по-лошо от оригинала. Ако браузърът не
 * може да разчете файла или резултатът излезе по-голям, връщаме оригинала —
 * по-добре тежка снимка, отколкото никаква.
 */

const MAX_EDGE = 1920;
const QUALITY = 0.82;
/** Под този размер смаляването не си струва — файлът вече е лек. */
const SKIP_BELOW_BYTES = 600_000;

export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_EDGE / Math.max(bitmap.width, bitmap.height),
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
