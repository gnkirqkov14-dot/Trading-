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

## ⚠️ Бизнес модел: публикуването е безплатно, търсенето е платено

Пивот спрямо първоначалната спецификация в `docs/PLAN.md` (собственикът
на продукта промени решението си след старта на Фаза 4): **обявяването
на имот е безплатно и неограничено за всеки** — няма лимит на активни
обяви, `subscription_plan` вече не гейтва `createListing`. Вместо това
**месечен абонамент (`profiles.subscription_plan` = `pro`/`unlimited`)
се изисква от ТЪРСЕЩИТЕ**, за да виждат пълните детайли на чужди обяви
и да пишат на собствениците. Собственик на обява винаги вижда своята
собствена обява в цялост, независимо от плана си.

Без абонамент (`basic`, по подразбиране за всеки нов профил), при
разглеждане на чужда обява (`app/listings/[id]/page.tsx`) потребителят
вижда само: 1-ва снимка (не цялата галерия), цена, град (без точен
квартал), основни факти (тип имот, сделка, кв.м, стаи). Скрити са:
останалите снимки, видео, описание, точен квартал, етаж/година/
отопление/удобства, и бутонът за писане на собственика — заменен с CTA
към `/pricing`.

**Важно — това е RLS enforcement, не само UI скриване**, защото
приложението ползва публичен Supabase anon/publishable ключ (виж
"Environment variables" по-долу) — всеки може да прочете същите заявки
директно през Supabase API, заобикаляйки React компонентите. Затова:

- Пълните полета на `listings`/`listing_photos`/`listing_videos`
  остават publicly SELECT-able през RLS (нужно е за публичния feed,
  филтрите и SEO metadata на логнати ли, нелогнати посетители) —
  "малката част" ограничение е приложено само на ниво Next.js страница
  (`app/listings/[id]/page.tsx` решава кои полета да рендира спрямо
  `hasFullSearchAccess()` от `lib/listing-labels.ts`).
- **Съобщенията (`messages` INSERT) обаче са наложени в самата база** —
  `supabase/migrations/0008_search_subscription_paywall.sql` подменя
  Фаза-1 policy-то `"Users can send messages as themselves"` с ново,
  което изисква `auth.uid() = from_user_id` **И** (профилът на
  подателя има платен план `<> 'basic'` **ИЛИ** подателят е собственик
  на обявата, за която пише — покрива случая собственик да отговори на
  запитване). `lib/actions/messages.ts` -> `sendMessage()` прави
  същата проверка предварително, само за да покаже приятелско съобщение
  на грешка вместо суров Postgres RLS error; истинската защита е
  policy-то в базата.
- `profiles.phone` вече се редактира от `/dashboard/profile` (виж по-долу)
  и служи само като начална стойност за телефонното поле при публикуване
  на нова обява — истинският телефон, който се показва на купувачите, е
  `listings.phone` (отделен, per-listing).

## ⚠️ Security fix: column-level grants на `profiles`

При изграждане на `/dashboard/profile` открихме пропуск от Фаза 1: RLS
policy-то `"Users can update their own profile"` има само
`using (auth.uid() = id)`, без `with check`, а Supabase's default table
grants дават на `authenticated` UPDATE право върху **всички** колони.
Тъй като приложението ползва публичен anon/publishable ключ, всеки логнат
потребител технически е можел да прати директна заявка към Supabase REST
API-то (заобикаляйки цялото UI) и:
- да си зададе `subscription_plan = 'pro'/'unlimited'` — заобикаляйки
  целия paywall от Фаза 4, безплатно, или
- да си зададе `is_admin = true` — пълна admin ескалация (Фаза 6).

`supabase/migrations/0010_lock_profile_columns.sql` затваря дупката с
column-level grant: `revoke update ... from authenticated, anon; grant
update (name, phone) on public.profiles to authenticated;` — оттук
нататък update е физически възможен само върху `name`/`phone`, каквото
UI-то изобщо позволява. `subscription_plan`/`is_admin` остават
променяеми само през `service_role` ключа (бъдещ payment webhook или
директен достъп до базата). **Тази миграция е важна за сигурността —
пусни я възможно най-скоро.**

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
    (auth)/login, (auth)/register    — auth страници (+ Google/Facebook OAuth)
    auth/callback/                   — route handler: разменя OAuth code за сесия
    map/[cityId]/                    — голяма карта на 1 град, избор на квартал
    admin/                           — минимален admin панел (изисква is_admin)
    api/cron/expire-listings/        — Vercel Cron endpoint (виж по-долу)
    dashboard/                       — защитен route: моите обяви, профил
    dashboard/listings/new/          — форма за нова обява (безплатна, без лимит)
    dashboard/listings/[id]/edit/    — редакция на съществуваща обява (само собственик)
    dashboard/profile/               — настройки на профила (име, телефон)
    dashboard/messages/              — inbox + thread view
    listings/                        — публичен списък + филтри
    listings/[id]/                   — детайлна страница + paywall за нeабонирани
    pricing/                         — планове за ТЪРСЕНЕ (Basic/Pro/Unlimited, без плащане)
    page.tsx                         — начална страница (карта на България)
    sitemap.ts, robots.ts            — SEO
  components/
    bulgaria-map.tsx                 — homepage карта, ниво държава/област/град (виж по-долу)
    city-map.tsx                     — отделна голяма карта за 1 град (Voronoi квартали)
    new-listing-form.tsx             — форма + upload на снимки към Storage
    edit-listing-form.tsx            — редакция: пази/маха стари снимки, добавя нови
    logo.tsx                         — икона на къща + wordmark (хедър/футър)
    site-footer.tsx                  — футър (мини лого, навигация, copyright)
    profile-form.tsx                 — редакция на име/телефон в профила
    oauth-buttons.tsx                 — Google/Facebook бутони (login/register)
    listing-filters.tsx              — пълния филтър панел
    message-thread-form.tsx, admin-listings-table.tsx
    my-listings.tsx, listing-card.tsx, site-header.tsx
  lib/
    actions/auth.ts, listings.ts, messages.ts, admin.ts, profile.ts  — Server Actions
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
  0006_expire_stale_listings.sql     — стара auto-expire функция (заменена от 0013)
  0007_admin.sql                     — profiles.is_admin + admin RLS policies
  0008_search_subscription_paywall.sql — RLS: само абонати/собственик пращат съобщения
  0009_listing_contact_fields.sql    — listings.address + listings.phone (задължителни)
  0010_lock_profile_columns.sql      — security fix: column-level grants на profiles
  0011_oauth_profile_name_fallback.sql — handle_new_user() fallback за OAuth име
  0012_archived_listing_status.sql   — нова enum стойност 'archived' (самостоятелна)
  0013_listing_reminder_schedule.sql — 3-степенна схема + process_listing_reminders()
docs/PLAN.md                         — пълната бизнес спецификация + фази
vercel.json                          — Cron конфигурация
```

**Миграциите не са автоматично приложени** — няма link-нат Supabase CLI.
Всяка нова `.sql` миграция трябва да се пусне ръчно в Supabase Dashboard
→ SQL Editor → New query → paste → Run, по ред на номерата.

## Карта на България — детайли на имплементацията

Две отделни карти, **нарочно "плосък" диаграмен стил** (без OpenStreetMap
tile слой, само оцветени форми) по искане на собственика, вдъхновено от
imot.bg визуално — не реалистична улична карта:

1. **`components/bulgaria-map.tsx`** (на началната страница) — 2 нива:
   - **България** — 28 полигона на области от
     `public/data/bulgaria-provinces.geojson`. Данните са от
     [Natural Earth](https://www.naturalearthdata.com/)
     (`ne_10m_admin_1_states_provinces`, **public domain**), филтрирани
     само за България и с добавени кирилски имена от `name_local`
     полето. **Не** използвай `yurukov/Bulgaria-geocoding` repo-то като
     алтернативен източник — няма посочен license. Стил: плътен
     slate-200 фон, emerald-200 при hover.
   - **Област → Град** — клик на полигон прави `fitBounds` към него;
     зелени точки (`cities` таблицата) с постоянен label (името на
     града, винаги видимо, не само при hover). Клик на град с квартали
     в базата → `router.push("/map/{cityId}")` (**навигира към нова
     страница**, не зумира на място — собственикът изрично поиска
     отделна страница за квартал-picker-а, а не inline zoom в малкия
     widget). Клик на град без квартали → директно
     `/listings?city={cityId}`.
2. **`app/map/[cityId]/page.tsx`** + **`components/city-map.tsx`** —
   отделна страница само за един град, голяма карта (по-висока от
   homepage widget-а), показва кварталите му като **Voronoi полигони**
   (виж по-долу), клик навигира към
   `/listings?city={cityId}&neighborhood={neighborhoodId}`. Ако някой
   отвори `/map/{cityId}` за град без квартали в базата, страницата
   прави `redirect()` към `/listings?city={cityId}`. Само София,
   Пловдив, Варна и Бургас имат seed-нати квартали в момента.

### Voronoi "райони" за квартали (решава дупката от старата версия)

По-рано "Neighborhood-level map полигони" беше в списъка "извън обхват"
— нямаше открит свободно лицензиран източник на реални полигонни
граници за кварталите на българските градове (за разлика от областите,
където Natural Earth върши работа). Собственикът поиска кварталите да
изглеждат като именувани "райони" (както в imot.bg picker-а), не само
черни/сини точки.

Решение: `computeNeighborhoodCells()` в `city-map.tsx` изгражда
**Voronoi диаграма** (пакет `d3-delaunay`) от координатите, които вече
имаме за всеки квартал (`neighborhoods.lat/lng`, виж 0005-та миграция)
— всяка точка получава клетка от равнината, най-близка до нея. Резултатът
изглежда като разделени именувани райони, без да претендираме за
геодезическа точност (границите НЕ следват реални улици/административни
линии — просто най-близката точка). Клетките се изчисляват "on the fly"
в браузъра (не се пазят в базата), оцветени са от `NEIGHBORHOOD_PALETTE`
(8 пастелни цвята, ротират по индекс), с постоянен label (името) в
центъра на клетката — CSS override в `globals.css`
(`.leaflet-tooltip.map-label`) маха стандартната бяла Leaflet tooltip
кутийка, за да изглежда като директен надпис върху областта.

За градове с само 1 квартал (Voronoi няма смисъл с 1 точка) остава
старият точков маркер.

**Ако добавяш нови квартали**: колкото повече точки, толкова по-малки/
по-адекватни стават клетките — с 2-3 квартала клетките ще изглеждат
неестествено големи (нормално, очаквано поведение на Voronoi с малко
точки, не бъг).

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

## Вход с Google/Facebook (OAuth)

✅ **Google работи в production** (тествано на живо от собственика на
27.09.2026 — влизане с реален Google акаунт стигна успешно до
`/dashboard`). Кодът: `lib/actions/auth.ts` → `signInWithOAuth()`,
`app/auth/callback/route.ts`, `components/oauth-buttons.tsx` (вграден в
`login-form.tsx`/`register-form.tsx`).

🔲 **Facebook е нарочно спрян/скрит** — собственикът избра да продължи
само с Google засега. Бутонът "Продължи с Facebook" е премахнат от
`oauth-buttons.tsx` (не само скрит с CSS — кодът му е изтрит), за да не
показва счупен вход. За да се върне: пресъздай `FacebookIcon` и втория
`<form>` (виж git история на `oauth-buttons.tsx` преди премахването,
commit "Скрий бутона за Facebook..."), плюс стъпките по-долу за Meta.

### Как се направи Google (за референция / за бъдещи доставчици)

1. Google Cloud Console → создаде се отделен проект ("Imotibezpowrednik",
   различен от други лични Google Cloud проекти на собственика) →
   **Google Auth Platform** (по-новото име на "OAuth consent screen") →
   Get started → App name / support email / **External** audience /
   contact info.
2. APIs & Services → Credentials → Create OAuth client ID → **Web
   application** → Authorized redirect URI = **Supabase-ският** callback
   `https://<project-ref>.supabase.co/auth/v1/callback` (**не** адрес от
   property-platform-five.vercel.app!) → Create → свали JSON-а с
   `client_id`/`client_secret` (показва се само веднъж).
3. Supabase Dashboard → Authentication → Sign In / Providers → Google →
   Enable → постави `client_id` в "Client IDs" и `client_secret` в
   "Client Secret (for OAuth)" → Save.
4. **Критична стъпка, лесно се пропуска**: Supabase Dashboard →
   Authentication → **URL Configuration** → **Site URL** трябва да е
   `https://property-platform-five.vercel.app` (по подразбиране е
   `http://localhost:3000`!) и **Redirect URLs** трябва да съдържа
   `https://property-platform-five.vercel.app/**`. Без това стъпка
   Supabase успешно автентикира потребителя, но го връща на localhost
   вместо на живия сайт — точно това се случи първия път, преди да го
   оправим.

Flow-ът след това: `OAuthButtons` форма → `signInWithOAuth(provider,
redirectTo)` → Supabase връща consent-screen URL → `/auth/callback`
(route handler) разменя `?code=` за сесия (`exchangeCodeForSession`) и
редиректва към `next` (запазен `redirectTo` от `/login?redirectTo=...`)
или `/dashboard`. `handle_new_user()` тригерът (виж 0011-та миграция)
чете името от `raw_user_meta_data` с fallback верига
(`name` → `full_name` → префикс на имейла), защото различните
доставчици попълват различен ключ.

Ако/когато Facebook се добави по-късно: аналогичен процес в
[Meta for Developers](https://developers.facebook.com/) с продукт
"Facebook Login", същия redirect URI формат. Facebook App-и в
"Development mode" пускат само test users — за реални потребители
трябва App Review (Meta одобрява "public_profile"/"email" permissions
обичайно бързо, но е допълнителна стъпка, която само собственикът на
Facebook App-а може да подаде).

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

По избор (за реални email напомняния при обяви, виж Фаза 5):

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=   # напр. "Имоти без посредници <notifications@твоя-домейн.bg>"
```

Виж `.env.local.example`. Логото/favicon-ът (`components/logo.tsx`, `app/icon.svg`) показва само
иконата на екрани под `sm` breakpoint (`wordmarkClassName="hidden
sm:inline"` в `site-header.tsx`) — с пълния текст навигацията в хедъра
преливаше на телефон (390px viewport), проверено визуално преди фикса.

Ключът е Supabase's нов "publishable key" формат
(`sb_publishable_...`) — безопасен за публично споделяне, drop-in заместител
на старите JWT-based anon keys.

## Статус по фази (виж docs/PLAN.md за пълния план)

- ✅ **Фаза 1** — Скелет, auth (регистрация/логин/изход, + Google/Facebook
  OAuth — виж "Вход с Google/Facebook" по-долу за задължителните ръчни
  стъпки от собственика), базов data model.
- ✅ **Фаза 2** — Публикуване на обява (снимки в Supabase Storage, до 30
  бр., **незадължителни** — само мек hint за препоръчителен минимум,
  виж `MIN_LISTING_PHOTOS_HINT`; видео линк), публичен списък, детайлна
  страница, dashboard с редакция/деактивиране/изтриване (`updateListing`
  в `lib/actions/listings.ts`, `/dashboard/listings/[id]/edit` — пази/
  маха стари снимки и добавя нови, RLS вече позволяваше owner update,
  без нова миграция). **Адрес и телефон за връзка са задължителни**
  полета при публикуване (`listings.address`, `listings.phone` —
  `0009_listing_contact_fields.sql`) и се показват на детайлната
  страница само зад paywall-а от Фаза 4 (виж по-долу) — без абонамент
  не се виждат.
- ✅ **Фаза 3** — Интерактивна карта (виж по-горе), пълен филтър панел
  (тип сделка, тип имот, град, квартал, цена диапазон, кв.м диапазон,
  стаи, етаж, паркинг/асансьор/тераса/обзавеждане, сортиране).
- 🟡 **Фаза 4 (частично, бизнес моделът е обърнат)** — Виж
  "⚠️ Бизнес модел: публикуването е безплатно, търсенето е платено"
  по-долу за пълните детайли. Накратко: публикуването на обяви е
  безплатно и неограничено за всички (`createListing` вече няма
  лимит-проверка). `/pricing` вече продава достъп за ТЪРСЕЩИТЕ (Pro/
  Unlimited отключват пълни детайли на чужди обяви + съобщения),
  **не** брой обяви. **Реално плащане (Stripe/myPOS/Borica) не е
  свързано** — "Upgrade" бутоните на `/pricing` са нарочно disabled
  ("Очаквайте скоро"), защото изисква платежен акаунт, който само
  собственикът на проекта може да създаде. Цените на Pro/Unlimited в
  `lib/listing-labels.ts` (`PLAN_PRICES_EUR`) са **примерни, не
  потвърдени**.
- ✅ **Фаза 5** — Вътрешни съобщения (`/dashboard/messages`, inbox +
  thread view, `lib/actions/messages.ts`), **3-степенна схема за
  напомняния** (заменя старата еднократна "expire след 7 дни" логика):
  - ден 7 от последно потвърждение → 1-во напомняне (имейл + банер),
    обявата остава "Активна";
  - ден 14 → 2-ро напомняне, обявата минава в "Неактуална" (сдйнка в
    резултатите, но остава публична);
  - ден 21 → автоматично **архивиране** (`status = 'archived'`) — вече
    не се вижда публично никъде (RLS-ът от 0003 крие всичко освен
    active/expired), но собственикът може да я активира отново по всяко
    време от `/dashboard` (бутон "Активирай" вече работи и за архивирани).

  SQL: `process_listing_reminders()` (0013, заменя старата
  `expire_stale_listings()`) — `security definer` функция, чете
  `auth.users.email` вътрешно (профилите нямат email колона), връща
  редове за имейлите и обновява `reminder_count`/`status` наведнъж.
  Извиква се от същия daily Vercel Cron (03:00 UTC, виж `vercel.json` +
  `app/api/cron/expire-listings/route.ts`). Всеки път, когато
  собственикът потвърди/активира обява (`setListingStatus`,
  `confirmListingActive`), `reminder_count` се нулира и цикълът
  започва отначало.

  Имейлите се пращат през `lib/email.ts` (директни HTTP заявки към
  Resend API, без техния SDK) — **тихо не прави нищо без
  `RESEND_API_KEY`**, банерът в `/dashboard` (`my-listings.tsx`) винаги
  показва верния статус независимо дали имейл е настроен. **Важно
  ограничение**: Resend изисква верифициран **собствен домейн** (DNS
  записи), за да праща до произволни получатели — с адрес на
  `property-platform-five.vercel.app` (Vercel поддомейн, DNS-ът не е
  под наш контрол) Resend може да праща само тестови имейли до имейла
  на собственика на Resend акаунта, не до реални собственици на обяви.
  За реални имейли трябва собствен домейн (напр. закупен `.bg` домейн).
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

- Реално плащане/billing (Stripe или myPOS/Borica) — изисква акаунт,
  който само собственикът на проекта може да създаде; UI-то за планове
  вече съществува и чака интеграцията.
- Реални email напомняния за обявите — кодът е готов (`lib/email.ts`),
  но изисква `RESEND_API_KEY` + верифициран собствен домейн в Resend
  (виж Фаза 5 по-горе); банерът в `/dashboard` работи без тях.

## Команди

```bash
npm run dev      # локална разработка
npm run build    # production build (Turbopack)
npm run lint     # ESLint
```

Локален dev/build изисква `.env.local` дори с placeholder стойности,
иначе `proxy.ts` гърми при опит да създаде Supabase client.
