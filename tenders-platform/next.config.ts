import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Помощникът за кандидатстване чете PDF (unpdf) и 7-zip/RAR архиви
  // (7z-wasm) — оставят се като обикновени пакети в node_modules, за да
  // стигнат до функцията на Vercel непокътнати.
  serverExternalPackages: ["unpdf", "7z-wasm"],
  // 7z-wasm зарежда 7zz.wasm от диска по време на работа — проследяването
  // на файловете не го вижда само.
  outputFileTracingIncludes: {
    "/apply/grant/[guid]": ["./node_modules/7z-wasm/7zz.wasm"],
  },
};

export default nextConfig;
