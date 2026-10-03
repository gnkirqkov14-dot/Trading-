import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Снимките на обявите. Минават през `next/image`, за да стигат до
        // посетителя нарязани по големината на екрана и във WebP: иначе
        // картичка 300px тегли цял кадър от телефон.
        protocol: "https",
        hostname: "uyjxsjcyzmafvmyffoxx.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Кадрите на началната сцена (`components/home/story-scroll.tsx`)
        // засега се четат направо от CDN-а на Higgsfield, защото сесията,
        // която ги генерира, няма достъп до него, за да ги свали и сложи
        // в repo-то (изходът натам връща 403 от мрежовата политика).
        //
        // ⚠️ Временно и по изрично решение на собственика. Чужд CDN
        // държи най-важната снимка на сайта: изтече ли акаунтът или се
        // сменят адресите, началната страница остава без фон. Vercel
        // кешира оптимизираните копия на ръба, така че посетителите не
        // удрят Higgsfield на всяко отваряне, но първоизточникът е чужд.
        //
        // Да се замени с файлове в `public/hero/`, щом бъдат качени —
        // виж docs/РЪЧНИ-СТЪПКИ.md, раздел A2. Тогава този блок отпада.
        protocol: "https",
        hostname: "d8j0ntlcm91z4.cloudfront.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
