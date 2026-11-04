"use client";

/**
 * Съгласието обявата да се пуска безплатно в социалните мрежи на imotpoint.
 *
 * Стои точно над „Публикувай“ и е голям бутон-превключвател, не малка
 * отметка: на телефон малката отметка се подминава. Целият блок се
 * натиска. Състоянието се вижда от цвета, от превключвателя вдясно и от
 * текста „Включено“.
 */

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.6 3c.4 2.2 1.7 3.6 3.9 3.8v3.1c-1.4 0-2.7-.4-3.9-1.2v5.9c0 3.2-2.4 5.9-5.8 5.9-3.1 0-5.6-2.4-5.6-5.6 0-3.5 3-6 6.5-5.5v3.2c-1.6-.4-3.3.6-3.3 2.3 0 1.3 1 2.4 2.4 2.4 1.5 0 2.6-1.1 2.6-2.9V3h3.2Z"
      />
    </svg>
  );
}

const MREZHI = [
  { ime: "Facebook", Icon: FacebookIcon, cvyat: "bg-[#1877f2]" },
  {
    ime: "Instagram",
    Icon: InstagramIcon,
    cvyat: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]",
  },
  { ime: "TikTok", Icon: TikTokIcon, cvyat: "bg-slate-900" },
];

export function SocialniMrezhiIzbor({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`group w-full rounded-2xl border-2 p-4 text-left transition sm:p-5 ${
        value
          ? "border-accent-500 bg-accent-50 shadow-[0_10px_30px_-12px_rgba(43,185,140,0.55)]"
          : "border-dashed border-accent-400 bg-white hover:border-accent-500 hover:bg-accent-50/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex -space-x-1.5">
          {MREZHI.map(({ ime, Icon, cvyat }) => (
            <span
              key={ime}
              title={ime}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-white ring-2 ring-white ${cvyat}`}
            >
              <Icon />
            </span>
          ))}
        </div>

        <p className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-accent-700">
          Безплатно
        </p>

        {/* Превключвателят: видим знак, че това се включва и изключва. */}
        <span
          aria-hidden="true"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
            value ? "bg-accent-500" : "bg-slate-300"
          }`}
        >
          <span
            className={`h-6 w-6 rounded-full bg-white shadow transition ${
              value ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </span>
      </div>

      <p className="mt-3 text-lg font-semibold leading-snug text-slate-900">
        Покажи обявата ми във Facebook, Instagram и TikTok
      </p>

      <p className="mt-1.5 text-sm text-slate-600">
        Пускаме я в нашите страници, за да стигне до повече купувачи и
        наематели. Телефонът ти не се показва там, той остава само в сайта.
        Можеш да го изключиш по всяко време от редакцията на обявата.
      </p>

      <p
        className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
          value ? "bg-accent-500 text-white" : "bg-accent-100 text-accent-800"
        }`}
      >
        {value ? "✓ Включено — ще я покажем" : "Натисни, за да включиш"}
      </p>
    </button>
  );
}
