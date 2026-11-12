/**
 * JSON-LD за вграждане в <script>. `JSON.stringify` не пипа „<“, затова
 * заглавие като `</script><script>…` би затворило нашия таг и би пуснало
 * чужд скрипт при всеки посетител. Тук „<“, „>“ и „&“ стават \u-кодове:
 * за търсачките данните са същите, за браузъра вече не са HTML.
 */
export function jsonLdZaScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
