/**
 * Подготвя снимка в браузъра, преди да тръгне към Supabase: смалява я и
 * слага воден знак.
 *
 * Смаляване: телефоните дават кадри по 3–4 MB. Такава снимка се качва
 * бавно по мобилен интернет, заема място и после всеки посетител я тегли
 * цялата, за да я види в квадратче от няколкостотин пиксела. 1920px по
 * дългата страна стига за всеки екран.
 *
 * Воден знак: снимката, веднъж показана, вече е у посетителя — да се
 * пази от копиране е невъзможно. Затова не я крием, а я подписваме:
 * открадне ли я конкурент, тя рекламира imotpoint. Това е единственото,
 * което наистина работи срещу кражба на снимки.
 *
 * Правило: никога не връщаме нещо по-лошо от оригинала. Ако браузърът не
 * може да разчете файла, връщаме го както си е — по-добре снимка без
 * знак, отколкото обява без снимка.
 */

const MAX_EDGE = 1920;
const QUALITY = 0.82;
const WATERMARK_TEXT = "imotpoint.com";

function drawWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  // Размерът върви с широчината на кадъра, за да изглежда еднакво и на
  // малка, и на голяма снимка.
  const fontSize = Math.max(13, Math.round(width * 0.034));
  const padding = Math.round(fontSize * 0.75);

  context.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
  context.textAlign = "right";
  context.textBaseline = "bottom";

  // Сянката държи надписа четим и върху светло небе, и върху тъмен под.
  context.shadowColor = "rgba(0, 0, 0, 0.55)";
  context.shadowBlur = Math.round(fontSize * 0.45);
  context.shadowOffsetY = Math.round(fontSize * 0.06);
  context.fillStyle = "rgba(255, 255, 255, 0.82)";

  context.fillText(WATERMARK_TEXT, width - padding, height - padding);
}

export async function preparePhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    drawWatermark(context, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) return file;

    const name = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
