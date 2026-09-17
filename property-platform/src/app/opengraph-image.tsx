import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/og-font";

export const alt =
  "Имоти без посредници — обяви за имоти директно от собственик";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE_BG = "Имоти";
const TITLE_LIGHT = "без посредници";
const TAGLINE = "Директно от собственик — без агентски комисионни";
const DOMAIN = "imotpoint.com";
const NAVY = "#1A5180";
const MINT = "#2BB98C";
const MINT_TEXT = "#1D9A73";

// Същият знак като в components/logo.tsx и icon.svg — тук е преписан,
// защото satori рисува собствено SVG дърво и не може да импортира
// клиентски компонент с Tailwind класове.
function BrandMark() {
  return (
    <svg width="125" height="140" viewBox="0 0 82 92" fill="none">
      <path
        d="M6 41 41 6l35 35"
        stroke={NAVY}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M54.5 12.5C54.5 11.67 55.17 11 56 11h9c.83 0 1.5.67 1.5 1.5V35L54.5 23Z"
        fill={NAVY}
      />
      <path
        d="M41 29c13.25 0 24 10.75 24 24 0 13.5-13.5 22-24 35-10.5-13-24-21.5-24-35 0-13.25 10.75-24 24-24Z"
        fill={NAVY}
      />
      <circle cx="41" cy="53" r="13.5" fill="#fff" />
      <circle cx="41" cy="53" r="8.5" fill={MINT} />
    </svg>
  );
}

function Card({ fonts }: { fonts: { name: string; data: ArrayBuffer; weight: 400 | 700 }[] | undefined }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          fontFamily: fonts ? "Inter" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <BrandMark />
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700 }}>
            <span style={{ color: NAVY }}>{TITLE_BG}</span>
            <span>&nbsp;</span>
            <span style={{ color: "#64748b", fontWeight: 400 }}>
              {TITLE_LIGHT}
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 32,
            color: "#334155",
          }}
        >
          {TAGLINE}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 28,
            fontWeight: 700,
            color: MINT_TEXT,
          }}
        >
          {DOMAIN}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

export default async function Image() {
  try {
    const text = `${TITLE_BG}${TITLE_LIGHT}${TAGLINE}${DOMAIN}`;
    const [regular, bold] = await Promise.all([
      loadGoogleFont(text, 400),
      loadGoogleFont(text, 700),
    ]);
    return Card({
      fonts: [
        { name: "Inter", data: regular, weight: 400 },
        { name: "Inter", data: bold, weight: 700 },
      ],
    });
  } catch {
    // Ако Google Fonts не отговори, показваме същата карта без вграден
    // шрифт (кирилицата може да излезе накъсано в default fallback-а на
    // satori) — по-добре грозна снимка, отколкото счупен route/500.
    return Card({ fonts: undefined });
  }
}
