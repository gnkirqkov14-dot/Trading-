import Link from "next/link";
import { formatPrice } from "@/lib/listing-labels";
import type { ListingCardData } from "@/components/listing-card";

// Трите карти стоят в обща 3D сцена: родителят дава `perspective`, а всяка
// карта се изнася напред с различен `translateZ`. Затова се вижда истинска
// дълбочина, а не просто наклонени правоъгълници. На телефон перспективата
// се смекчава и третата карта отпада — иначе се застъпват и крият цените.
const DECK_TRANSFORM =
  "[transform:rotateY(-8deg)_rotateX(5deg)] lg:[transform:rotateY(-17deg)_rotateX(9deg)_rotateZ(-2deg)]";

const CARD_BASE =
  "absolute w-[15.5rem] rounded-3xl border border-white/90 bg-white/90 p-3.5 shadow-[0_50px_90px_-42px_rgba(15,36,56,0.75)] backdrop-blur-xl lg:w-[18.75rem]";

const PLACEHOLDER_GRADIENTS = [
  "bg-gradient-to-br from-[#8fb6d4] to-[#3f719c]",
  "bg-gradient-to-br from-[#7fd9bb] to-[#20a279]",
  "bg-gradient-to-br from-[#b3c4d2] to-[#5f7d95]",
];

const CARD_POSITIONS = [
  "left-0 top-0 [transform:translateZ(0)] lg:-left-1",
  "right-0 top-[16.6rem] [transform:translateZ(60px)] lg:top-[9.375rem] lg:-right-5 lg:[transform:translateZ(85px)]",
  "hidden lg:block lg:left-6 lg:top-[19.5rem] lg:[transform:translateZ(38px)]",
];

function DeckCard({
  listing,
  index,
}: {
  listing: ListingCardData;
  index: number;
}) {
  const cover = [...listing.listing_photos].sort(
    (a, b) => a.position - b.position,
  )[0];
  const location = [listing.neighborhoods?.name, listing.cities?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={`${CARD_BASE} ${CARD_POSITIONS[index]} transition hover:brightness-[1.02]`}
    >
      <div
        className={`relative h-[8.25rem] overflow-hidden rounded-2xl lg:h-[10.25rem] ${
          cover ? "bg-slate-200" : PLACEHOLDER_GRADIENTS[index]
        }`}
      >
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        <span className="absolute left-3 top-3 z-10 rounded-full bg-white/92 px-3 py-1 text-[0.66rem] font-extrabold tracking-wider text-brand-600">
          СОБСТВЕНИК
        </span>
      </div>
      <h3 className="mt-3.5 line-clamp-1 px-1 font-bold text-slate-900">
        {listing.title}
      </h3>
      <p className="mt-1 px-1 text-[0.8rem] font-semibold text-slate-400">
        {location || "България"}
      </p>
      <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 px-1 pt-3">
        <span className="font-display text-[1.35rem] font-semibold text-brand-600">
          {formatPrice(listing.price)}
        </span>
        <span className="text-xs font-bold text-slate-400">
          {listing.type === "rent" ? "/ месец" : `${listing.area_sqm} м²`}
        </span>
      </div>
    </Link>
  );
}

/**
 * Показва три истински обяви в 3D. Когато още няма достатъчно обяви,
 * НЕ рисуваме измислени примери — вместо това стои покана да се публикува
 * първата. Празната покана е по-честна и по-полезна от фалшив каталог.
 */
export function HeroDeck({ listings }: { listings: ListingCardData[] }) {
  const hasDeck = listings.length >= 3;

  return (
    <div className="[perspective:1000px] [perspective-origin:50%_35%] lg:[perspective:1500px] lg:[perspective-origin:60%_40%]">
      <div
        className={`relative h-[33.75rem] [transform-style:preserve-3d] lg:h-[35rem] ${DECK_TRANSFORM}`}
      >
        <div className="absolute -right-0.5 -top-3.5 z-20 rounded-[1.2rem] bg-gradient-to-br from-[#17344d] to-[#0f2438] px-5 py-3.5 text-white shadow-[0_40px_70px_-28px_rgba(15,36,56,0.9)] [transform:translateZ(110px)_rotate(7deg)] lg:-right-6 lg:top-4 lg:[transform:translateZ(150px)_rotate(7deg)]">
          <span className="block font-display text-2xl font-semibold leading-none">
            0 €
          </span>
          <span className="mt-1.5 block text-[0.62rem] font-extrabold tracking-[0.11em] text-slate-400">
            КОМИСИОННА
          </span>
        </div>

        {hasDeck ? (
          listings
            .slice(0, 3)
            .map((listing, index) => (
              <DeckCard key={listing.id} listing={listing} index={index} />
            ))
        ) : (
          <div className={`${CARD_BASE} ${CARD_POSITIONS[0]} !w-[17rem] lg:!w-[20rem]`}>
            <div className="flex h-[8.25rem] items-center justify-center rounded-2xl bg-gradient-to-br from-[#7fd9bb] to-[#20a279] lg:h-[10.25rem]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-14 w-14"
                aria-hidden
              >
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5.5 9.5V20h13V9.5" />
                <path d="M12 12.5v5M9.5 15h5" />
              </svg>
            </div>
            <h3 className="mt-4 px-1 font-display text-xl font-semibold text-slate-900">
              Тук ще е твоята обява
            </h3>
            <p className="mt-2 px-1 text-sm leading-relaxed text-slate-500">
              Сайтът е нов. Публикуването е безплатно и остава безплатно —
              включително ако някога въведем такси.
            </p>
            <Link
              href="/register"
              className="mt-4 block rounded-2xl bg-slate-900 px-4 py-3 text-center font-bold text-white transition hover:bg-slate-700"
            >
              Публикувай първата обява
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
