/**
 * Разчита списък с телефони, залепен или качен като файл.
 *
 * Списъците идват както дойдат: ту "име, телефон", ту "телефон; име", ту
 * само номера един под друг, със заглавен ред или без. Затова не се пита
 * коя колона каква е — търси се полето, което ПРИЛИЧА на телефон, а
 * останалото се приема за име.
 *
 * Самото нормализиране на номера е в базата (normalize_phone), за да е
 * едно и също, независимо дали редът е дошъл оттук или отнякъде другаде.
 * Тук само се отсява явният боклук, за да не пътува напразно.
 */

export type ParsedContact = { phone: string; name: string | null };

export type ParseResult = {
  contacts: ParsedContact[];
  /** Редове, в които не се намери нищо, приличащо на телефон. */
  skipped: number;
};

/** Поне 9 цифри — под това не е български номер. */
function looksLikePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function parseContacts(raw: string): ParseResult {
  const contacts: ParsedContact[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fields = trimmed
      .split(/[,;\t|]/)
      .map((f) => f.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    if (fields.length === 0) continue;

    const phoneIndex = fields.findIndex(looksLikePhone);
    if (phoneIndex === -1) {
      // Заглавният ред ("име,телефон") също попада тук и се брои за
      // пропуснат — това е честно и не пречи.
      skipped += 1;
      continue;
    }

    const phone = fields[phoneIndex];
    const key = phone.replace(/\D/g, "").slice(-9);
    if (seen.has(key)) continue;
    seen.add(key);

    const name =
      fields.find((f, i) => i !== phoneIndex && !looksLikePhone(f)) ?? null;

    contacts.push({ phone, name: name || null });
  }

  return { contacts, skipped };
}
