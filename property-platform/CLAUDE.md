@AGENTS.md

# Имоти без посредници — Property Platform

Платформа за обяви на имоти директно от собственик, без агенции. Пълната
бизнес спецификация е в [`docs/PLAN.md`](docs/PLAN.md) — прочети я първо
за контекст (бизнес модел, MVP функционалности, фази).

## ⚠️ Важно за repo-то — прочети преди да пипаш git/deploy

Този проект живее в подпапка (`property-platform/`) на **споделено repo**
(`Trading-`), което иначе съдържа **напълно несвързан** crypto/ETF trading
demo (`backend/`, `frontend/`, `docs/`, `netlify.toml`, `render.yaml` в
корена на repo-то). Не пипай тези файлове/папки — не са част от този
проект.

**Branch workflow (нестандартен, важно):**
- Разработката се пуши на branch **`claude/property-platform-mvp-9lv5x3`**.
- Vercel-ският production deploy обаче следи **default branch-а на repo-то**,
  който по историческа причина е **`claude/ai-autonomous-trader-crypto-etf-anstj4`**
  (branch-ът на трейдинг демото, не `main`).
- За да достигне нов код до живия сайт, трябва да се merge-не PR от
  `claude/property-platform-mvp-9lv5x3` → `claude/ai-autonomous-trader-crypto-etf-anstj4`
  (виж вече merge-натите PR #1–#4 в repo-то за примери). Push само на
  dev branch-а **не** тригва deploy.
- Vercel project настройки: Root Directory = `property-platform`,
  Framework Preset = Next.js (**не** "Services" — има известен bug дето
  auto-detect понякога го пренасочва натам, вижда `frontend`/`backend` от
  трейдинг демото и блокира Deploy).

## ⚠️ Next.js 16 — не е Next.js-ът, който познаваш

Проектът е на **Next.js 16.3.4** — скорошна мажорна версия с breaking
changes спрямо по-старите ти познания. Ключови разлики, на които вече
се натъкнахме:

- **`middleware.ts` вече се казва `proxy.ts`** (виж `src/proxy.ts`) — same
  runtime/API, различна конвенция за име на файл и export.
- `params` и `searchParams` в `page.tsx`/`generateMetadata` са **Promise**,
  трябва `await`.
- `cookies()` е async, трябва `await cookies()`.
- Виж `node_modules/next/dist/docs/` за пълната документация на текущата
  версия при съмнение — **не разчитай на training data за Next.js API**.

## Технологичен стек

| Слой | Избор | Бележка |
|---|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 | |
| Backend/DB/Auth/Storage | Supabase | Postgres + Auth + Storage; RLS навсякъде |
| Карта | Leaflet + OpenStreetMap tiles | Безплатно, без API ключ (виж по-долу) |
| Хостинг | Vercel | Production URL: `https://property-platform-five.vercel.app` |

### Supabase типове (`src/lib/types/database.ts`)

Ръчно писани (не сме link-нали Supabase CLI към проекта), **оформени
нарочно като истинския изход на `supabase gen types`** — всяка таблица
носи `Relationships: []`. Ако добавиш `.select("*, related_table(...)")`
embed някъде, TypeScript ще инферира `never` за резултата, освен ако:
(а) добавиш реален `Relationships` запис за съответния FK, или
(б) direct-cast-неш резултата към ръчно дефиниран тип (моделът, който сме
following навсякъде другаде в кода — виж `getListing()` в
`app/listings/[id]/page.tsx` за пример). Вариант (б) е по-простият и
по-безопасен избор, освен ако не added много embed-и на едно и също
място.

**Два FK-та към една и съща таблица** (напр. `messages.from_user_id` и
`messages.to_user_id` — и двата сочат към `profiles`): Postgrest не може
сам да познае кой имаш предвид при `profiles(name)` — трябва изрична
hint синтаксис с името на FK constraint-а:
`from_profile:profiles!messages_from_user_id_fkey(name)`. Constraint
имената следват Postgres конвенцията `<table>_<column>_fkey` (не сме ги
именували изрично в SQL-а). Виж `app/dashboard/messages/page.tsx`.

## Структура

```
src/
  app/
    (auth)/login, (auth)/register    — auth страници
    admin/                           — минимален admin панел (изисква is_admin)
    api/cron/expire-listings/        — Vercel Cron endpoint (виж по-долу)
    dashboard/                       — защитен route: моите обяви, профил, лимит
    dashboard/listings/new/          — форма за нова обява (блокира при лимит)
    dashboard/messages/              — inbox + thread view
    listings/                        — публичен списък + филтри
    listings/[id]/                   — детайлна страница на обява + "Пиши на..."
    pricing/                         — планове (Basic/Pro/Unlimited, без плащане)
    page.tsx                         — начална страница (карта на България)
    sitemap.ts, robots.ts            — SEO
  components/
    bulgaria-map.tsx                 — интерактивната Leaflet карта (виж по-долу)
    new-listing-form.tsx             — форма + upload на снимки към Storage
    listing-filters.tsx              — пълния филтър панел
    message-thread-form.tsx, admin-listings-table.tsx
    my-listings.tsx, listing-card.tsx, site-header.tsx
  lib/
    actions/auth.ts, listings.ts, messages.ts, admin.ts  — Server Actions
    supabase/client.ts, server.ts, middleware.ts, dal.ts
    types/database.ts, listing-labels.ts
  proxy.ts                           — session refresh (виж Next.js 16 бележката)
public/data/
  bulgaria-provinces.geojson         — граници на 28-те области (виж по-долу)
supabase/migrations/
  0001_init.sql                      — цялата схема + RLS (Фаза 1)
  0002_listings_phase2.sql           — seed градове/квартали + storage bucket
  0003_listings_visibility.sql       — RLS fix: expired обяви остават публични
  0004_city_coordinates.sql          — lat/lng на градовете (за картата)
  0005_neighborhood_coordinates.sql  — lat/lng на кварталите (за drill-down)
  0006_expire_stale_listings.sql     — auto-expire SQL функция (за Cron)
  0007_admin.sql                     — profiles.is_admin + admin RLS policies
docs/PLAN.md                         — пълната бизнес спецификация + фази
vercel.json                          — Cron конфигурация
```

**Миграциите не са автоматично приложени** — няма link-нат Supabase CLI.
Всяка нова `.sql` миграция трябва да се пусне ръчно в Supabase Dashboard
→ SQL Editor → New query → paste → Run, по ред на номерата.

## Карта на България — детайли на имплементацията

`components/bulgaria-map.tsx`, три нива на drill-down:

1. **България** — 28 полигона на области от `public/data/bulgaria-provinces.geojson`.
   Данните са от [Natural Earth](https://www.naturalearthdata.com/)
   (`ne_10m_admin_1_states_provinces`, **public domain**), филтрирани само
   за България и с добавени кирилски имена от `name_local` полето. **Не**
   използвай `yurukov/Bulgaria-geocoding` repo-то като алтернативен
   източник — няма посочен license.
2. **Област → Град** — клик на полигон прави `fitBounds` към него; черни
   точки (`cities` таблицата) навигират към `/listings?city=X`, освен ако
   градът има квартали в базата — тогава zoom-ва навътре (ниво 3).
3. **Град → Квартал** — сини точки (`neighborhoods` за съответния
   `city_id`) навигират към `/listings?city=X&neighborhood=Y`. Само
   София, Пловдив, Варна и Бургас имат seed-нати квартали в момента.

**Важен фикс, който вече направихме**: градските/кварталните маркери и
областните полигони и двата рисуват в Leaflet's default overlay pane —
ако полигоните се добавят след маркерите (какъвто е случаят, защото
geojson-ът се фетчва async), те лягат ОТГОРЕ и крадат кликовете.
Маркерите вече ползват отделен custom pane (`markersPane`, zIndex 450)
специално за да стоят винаги над полигоните. Ако пипаш картата и
кликовете спрат да работят — първо провери това.

Друг фикс: zoom при клик на град използва `map.fitBounds()` върху
реалните координати на кварталите, **не** фиксиран zoom level — при
фиксиран zoom (пробвахме 13) някои квартали падат извън видимата зона.

Координатите на градовете/кварталите са **приблизителни, илюстративни**
(не survey-precision) — достатъчни за визуален MVP, не за навигация.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Виж `.env.local.example`. Ключът е Supabase's нов "publishable key" формат
(`sb_publishable_...`) — безопасен за публично споделяне, drop-in заместител
на старите JWT-based anon keys.

## Статус по фази (виж docs/PLAN.md за пълния план)

- ✅ **Фаза 1** — Скелет, auth (регистрация/логин/изход), базов data model.
- ✅ **Фаза 2** — Публикуване на обява (снимки в Supabase Storage, 5–30 бр.,
  видео линк), публичен списък, детайлна страница, dashboard с
  деактивиране/изтриване.
- ✅ **Фаза 3** — Интерактивна карта (виж по-горе), пълен филтър панел
  (тип сделка, тип имот, град, квартал, цена диапазон, кв.м диапазон,
  стаи, етаж, паркинг/асансьор/тераса/обзавеждане, сортиране).
- 🟡 **Фаза 4 (частично)** — `/pricing` страница (Basic/Pro/Unlimited),
  лимит на активни обяви приложен и на сървъра (`createListing`), и на
  ниво страница (`/dashboard/listings/new` блокира с ясно съобщение при
  достигнат лимит). **Реално плащане (Stripe/myPOS/Borica) не е
  свързано** — "Upgrade" бутоните на `/pricing` са нарочно disabled
  ("Очаквайте скоро"), защото изисква платежен акаунт, който само
  собственикът на проекта може да създаде. Цените на Pro/Unlimited в
  `lib/listing-labels.ts` (`PLAN_PRICES_BGN`) са **примерни, не
  потвърдени**.
- ✅ **Фаза 5** — Вътрешни съобщения (`/dashboard/messages`, inbox +
  thread view, `lib/actions/messages.ts`), седмична актуализация
  (бутон "Обявата е още активна" в dashboard-а, `confirmListingActive`),
  auto-expire логика (SQL функция `expire_stale_listings()` + Vercel
  Cron всеки ден в 03:00 UTC, виж `vercel.json` +
  `app/api/cron/expire-listings/route.ts`). **Email/push reminder не е
  включен** — изисква Resend/SendGrid акаунт (същата категория блокер
  като Stripe в Фаза 4).
- 🟡 **Фаза 6 (частично)** — SEO metadata (title template, OG за
  обявите с корица снимка), `sitemap.ts` + `robots.ts`, минимален admin
  панел (`/admin`, изисква `profiles.is_admin = true` — виж коментара в
  `0007_admin.sql` как да си дадеш админ права), responsive-ът е
  проверен визуално на мобилен viewport. Performance profiling/по-нататъшно
  polish не е правено.

### Cron job — важно за deploy

`vercel.json` дефинира daily cron към `/api/cron/expire-listings`.
За да работи в production, добави `CRON_SECRET` environment variable в
Vercel project settings (произволен таен низ) — Vercel автоматично го
праща като `Authorization: Bearer <CRON_SECRET>` header на всеки cron
request, а route handler-ът го проверява. Без зададен `CRON_SECRET`
route-ът работи и без auth проверка (за локално тестване), но за
production **задай го**.

## Съзнателно извън обхват (не са бъгове)

- Пълна редакция на обява (само create/deactivate/delete за момента).
- Реално плащане/billing (Stripe или myPOS/Borica) — изисква акаунт,
  който само собственикът на проекта може да създаде; UI-то за планове
  вече съществува и чака интеграцията.
- Email/push известия за седмичната актуализация — изисква Resend/
  SendGrid акаунт; auto-expire логиката работи без тях.
- Neighborhood-level map полигони (само точки/маркери — нямаше открити
  свободно лицензирани полигонни граници на квартален level).

## Команди

```bash
npm run dev      # локална разработка
npm run build    # production build (Turbopack)
npm run lint     # ESLint
```

Локален dev/build изисква `.env.local` дори с placeholder стойности,
иначе `proxy.ts` гърми при опит да създаде Supabase client.
