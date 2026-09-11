// Google Fonts CSS2 API връща TrueType (не WOFF2, който satori/ImageResponse
// не поддържа) за клиенти без съвременен браузърски User-Agent — Node.js
// fetch() по подразбиране минава за такъв. `text` параметърът ограничава
// шрифта само до нужните символи (по-малък файл), задължително за
// кирилица, тъй като ImageResponse не носи вграден шрифт с кирилски глифи.
export async function loadGoogleFont(text: string, weight: 400 | 700 = 400) {
  const familyUrl = `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(familyUrl)).text();
  const match = css.match(/src: url\(([^)]+)\) format\('truetype'\)/);
  if (!match) {
    throw new Error("Google Fonts: не намерих truetype src в CSS отговора.");
  }
  const res = await fetch(match[1]);
  if (!res.ok) {
    throw new Error(`Google Fonts: свалянето на шрифта се провали (${res.status}).`);
  }
  return res.arrayBuffer();
}
