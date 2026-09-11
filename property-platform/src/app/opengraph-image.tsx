import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/og-font";

export const alt =
  "Имоти без посредници — обяви за имоти директно от собственик";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE_BG = "Имоти";
const TITLE_LIGHT = "без посредници";
const TAGLINE = "Директно от собственик — без агентски комисионни";
const DOMAIN = "imotspot.com";

function HouseIcon() {
  return (
    <svg width="88" height="88" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 11.5L12 4l9 7.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10v9a1 1 0 0 0 1 1h3v-5h6v5h3a1 1 0 0 0 1-1v-9"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 140,
              height: 140,
              borderRadius: 32,
              backgroundColor: "#059669",
            }}
          >
            <HouseIcon />
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700 }}>
            <span style={{ color: "#0f172a" }}>{TITLE_BG}</span>
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
            color: "#059669",
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
