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

## ⚠️ Бизнес модел: публикуването е безплатно, пълните детайли изискват регистрация

История на пивотите (за контекст, не отразява текущото поведение):
Фаза 4 въведе месечен абонамент (`profiles.subscription_plan` =
`pro`/`unlimited`) за ТЪРСЕЩИТЕ, за да виждат пълните детайли на чужди
обяви и да пишат на собствениците — обявяването си остана безплатно и
неограничено през цялото време. По-късно собственикът реши първо да
скрие плащанията за старта (виж историята на `hasFullSearchAccess()` в
git log), и накрая — **да махне плановете напълно за момента** и вместо
плащане да иска само **регистрация** (безплатна) като условие за пълен
достъп; идеята е да се събира база от регистрирани потребители
(имейл/телефон), не приходи, на този етап.

**Текущо поведение** (`app/listings/[id]/page.tsx`): `hasFullAccess =
isOwner || Boolean(user)` — собственикът винаги вижда всичко; **всеки
логнат потребител** (без значение план/абонамент) вижда всичко; само
анонимен (нелогнат) посетител вижда орязана версия — 1-ва снимка,
цена, град (без точен квартал), основни факти. CTA-то за анонимни сочи
към `/register` ("Регистрирай се безплатно..."), не към план/цена.
`/pricing` страницата, `PLAN_LABELS`/`PLAN_PRICES_EUR`/
`hasFullSearchAccess()` от `lib/listing-labels.ts` са **изтрити** —
нямат повече консуматори в кода. `profiles.subscription_plan`,
`subscriptions` таблицата и `SubscriptionPlan` enum-ът остават
непокътнати в базата (не бяха махани, само UI/gating слоят) — база за
занапред, ако плащанията се върнат.

**Важно — това е RLS enforcement, не само UI скриване**, защото
приложението ползва публичен Supabase anon/publishable ключ (виж
"Environment variables" по-долу) — всеки може да прочете същите заявки
директно през Supabase API, заобикаляйки React компонентите. Затова:

- Пълните полета на `listings`/`listing_photos`/`listing_videos`
  остават publicly SELECT-able през RLS (нужно е за публичния feed,
  филтрите и SEO metadata на логнати и нелогнати посетители) —
  "малката част" ограничение е приложено само на ниво Next.js страница
  (`app/listings/[id]/page.tsx` решава кои полета да рендира).
- **Съобщенията (`messages` INSERT) обаче са наложени в самата база** —
  `supabase/migrations/0018_free_launch_messages.sql` замества
  Фаза-1/Фаза-4 policy-тата с едно просто условие: `auth.uid() =
  from_user_id` — всеки логнат потребител, без план/абонамент проверка.
  `lib/actions/messages.ts` -> `sendMessage()` вече не дублира тази
  проверка (само `getAuthedUser()` за автентикация + "не пиши сам на
  себе си") — истинската защита е policy-то в базата.
- `profiles.phone` е **задължителен и единственият източник** на
  телефона за връзка (виж "Един телефон на потребител" по-долу) —
  `listings.phone` продължава да съществува като денормализирано копие
  (за admin agency-detection и `is_contact_banned`), но клиентът вече не
  може да го зададе директно; формите за нова/редакция на обява само го
  показват read-only с линк "Промени в профила".

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
| Хостинг | Vercel | Production URL: `https://imotpoint.com` (закупен през Vercel Domains; `property-platform-five.vercel.app` също продължава да работи) |

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
    listings/[id]/                   — детайлна страница + CTA за регистрация (не абонамент)
    about/                           — "За нас": дълго описание на платформата
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
  0014_missing_region_cities.sql     — 10 области без нито един seed-нат град
  0015_backfill_neighborhood_coordinates.sql — 0005 беше пропусната ръчно (виж по-долу)
docs/PLAN.md                         — пълната бизнес спецификация + фази
vercel.json                          — Cron конфигурация
.github/workflows/supabase-migrations.yml — авто-пускане на миграциите (виж по-долу)
```

### Миграциите вече се пускат автоматично

**До 0014 включително миграциите се пускаха РЪЧНО** (Supabase Dashboard →
SQL Editor → paste → Run) — лесно се пропускаше стъпката, защото кодът
излизаше в production веднага (през Vercel), но SQL-ът не, и сайтът
изглеждаше "нищо не се е променило", докато всъщност само данните липсваха.
Точно това се случи с `0014_missing_region_cities.sql`.

Вече има `.github/workflows/supabase-migrations.yml` в **корена на целия
repo** (не в `property-platform/`, защото GitHub Actions гледа само
`<repo-root>/.github/workflows/`): при всеки push към deploy branch-а
(`claude/ai-autonomous-trader-crypto-etf-anstj4`), който пипа файл в
`property-platform/supabase/migrations/`, автоматично се изпълнява
`supabase db push` към живата база — код и схема излизат заедно, без
ръчна стъпка занапред.

Изисква 3 GitHub Secrets (Settings → Secrets and variables → Actions),
еднократно зададени от собственика:
- `SUPABASE_ACCESS_TOKEN` — Supabase Dashboard → акаунт → Access Tokens
- `SUPABASE_PROJECT_REF` — Project Settings → General → Reference ID
- `SUPABASE_DB_PASSWORD` — паролата на базата (Project Settings →
  Database; може да се ресетне оттам ако не е известна — това НЕ е
  същото като anon/service key и не чупи вече работещия сайт)

Ако workflow-ът fail-не (грешни secrets, забравен secret и т.н.), проверка
е в GitHub → repo → Actions таб → последния run на "Supabase migrations".

**Важен урок оттук**: при първото пускане излезе, че `0005_neighborhood_
coordinates.sql` никога не е била пусната ръчно преди автоматизацията —
кварталите на София/Пловдив/Варна/Бургас съществуваха в базата, но с
`lat`/`lng` = NULL, и затова кликването на тези градове винаги е скачало
направо към списъка с обяви вместо да отваря картата с квартали (0
"истински" квартала → early-redirect). Оправено с `0015_backfill_
neighborhood_coordinates.sql` (същото съдържание като 0005, нов номер).
**Ако занапред нещо "изглежда празно" необяснимо** — първо провери в
Supabase дали конкретните редове реално имат стойност в lat/lng, преди да
търсиш бъг във фронтенд кода.

## Карта на България — детайли на имплементацията

**Опростено по искане на собственика** — след няколко рунда с интерактивна
карта на кварталите (Voronoi диаграми, после ръчно пресъздадени форми по
снимка на официалната карта на Пловдив), собственикът прецени, че опит за
визуално точна карта на кварталите е ненадежден път, и поиска картата да
показва само областите/градовете на България, а клик на град да води
директно към стандартния ръчен филтър в `/listings` — без отделна
квартал-карта. Цялата тази по-стара инфраструктура е **изтрита**:
`app/map/[cityId]/page.tsx`, `components/city-map.tsx`,
`public/data/plovdiv-districts.geojson`. Seed-натите редове в
`neighborhoods` (lat/lng включително) останаха в базата непроменени —
безобидни, дори полезни като опции в `/listings`-филтъра — само
графичният picker беше премахнат.

Само **`components/bulgaria-map.tsx`** остава, **нарочно "плосък"
диаграмен стил** (без OpenStreetMap tile слой, само оцветени форми) по
искане на собственика, вдъхновено от imot.bg визуално — не реалистична
улична карта. Едно ниво:
- **България** — 28 полигона на области от
  `public/data/bulgaria-provinces.geojson`. Данните са от
  [Natural Earth](https://www.naturalearthdata.com/)
  (`ne_10m_admin_1_states_provinces`, **public domain**), филтрирани
  само за България и с добавени кирилски имена от `name_local` полето.
  **Не** използвай `yurukov/Bulgaria-geocoding` repo-то като алтернативен
  източник — няма посочен license. Постоянен label (името на областта)
  в центъра на полигона (CSS override `.leaflet-tooltip.map-label` в
  `globals.css` маха стандартната бяла Leaflet tooltip кутийка).
- **Област → Град**: клик на полигон прави `fitBounds` към него и показва
  зелени "chip" точки (`cities` таблицата) само за градовете в тази
  област. Клик на град (на картата или в списъка отдолу) →
  `router.push("/listings?city={cityId}")` директно — без междинна карта.

### Списък с имена под картата (като imot.bg) + fix за малки tap targets

Под картата има и обикновен списък с имена на градове в избраната
област като бутони, синхронизиран с картата — не само карта. Това реши и
реален бъг: градските маркери бяха тиха dot + отделен permanent label
(`bindTooltip`) с `pointer-events: none` — на тъч екран потребителите
тапваха върху видимото ИМЕ, което не беше кликаемо, тапът пропадаше
до полигона на областта отдолу и изглеждаше все едно "нищо не работи".
Градските маркери вече са `L.divIcon` "чипове" (цяла точка+име зона е
кликаема, CSS класове `.city-chip`/`.city-chip-dot` в `globals.css`),
а списъкът отдолу е допълнителна, по-голяма tap target алтернатива.

**Важен фикс, който вече направихме**: градските/кварталните маркери и
областните полигони и двата рисуват в Leaflet's default overlay pane —
ако полигоните се добавят след маркерите (какъвто е случаят, защото
geojson-ът се фетчва async), те лягат ОТГОРЕ и крадат кликовете.
Маркерите вече ползват отделен custom pane (`markersPane`, zIndex 450)
специално за да стоят винаги над полигоните. Ако пипаш картата и
кликовете спрат да работят — първо провери това.

Координатите на градовете са **приблизителни, илюстративни** (не
survey-precision) — достатъчни за визуален MVP, не за навигация.

### Всички 5267 населени места + търсачка (`0025_all_settlements.sql`)

0024 добави ~150 ръчно подбрани селища, но собственик на имот в произволно
село пак нямаше как да избере своето населено място. `0025` вкарва целия
официален **ЕКАТТЕ регистър на НСИ** — 261 града и 5006 села — с име,
община, област и вид. Нови колони на `cities`: `municipality`,
`is_village`, `ekatte` (официалният код е уникален ключ, затова миграцията
е идемпотентна и може да се пусне пак безопасно).

⚠️ **Важно за данните**: използвани са само административните факти от
официалния регистър (име → община → област → град/село), **без**
геокодиращата част. Новите редове нарочно нямат `lat`/`lng` — само
30-те стари seed-натите имат координати и само те се рисуват като точки
на картата. Причината е двойна: собственикът изрично поиска селата да не
претрупват картата, а и геокоординатите идват от източник без ясен лиценз
(същата причина, поради която за границите на областите ползваме Natural
Earth — виж по-горе).

Миграцията пази съществуващите редове (с координатите им) и само им
попълва новите колони по съвпадение име+област; втора стъпка връзва трите
общински центъра, в чиято област има и едноименно село (Костенец,
Каспичан, Елин Пелин). Поправя и три имена от 0024, които не съществуват
в регистъра (писани по памет): `Боженци` → `Боженците`, `Долни Пасарел` е
в Столична община, `Русалка` е курорт, не населено място.

**Търсачка с автодовършване** (`components/settlement-search.tsx`): 5267
опции не могат да стоят в `<select>` (стотици килобайта на всяко
зареждане), затова всички падащи списъци с градове са заменени с търсене
по първите букви ("ва" → гр. Варна, с. Вазово, с. Вакарел...). Ползва
browser Supabase клиента директно, debounce 200ms, prefix `ilike` заявка
(индексът `cities_name_prefix_idx` е точно за това), максимум 12
резултата. Показва "гр."/"с." + община и област, защото **527 имена се
срещат повече от веднъж** в страната (две различни села Варвара, Банкя в
Столична община и Банкя в община Трън и т.н.) — само името не стига.

Вградена е на 4 места: началната страница (над картата, води директно към
`/listings?city=...`), филтрите на `/listings`, и формите за нова/редакция
на обява. Съответните страници вече **не** теглят всички градове наготово
— само текущо избрания (виж `selectedSettlement` в `listings/page.tsx`).

⚠️ **Gotcha (вече оправен)**: падащият списък се скриваше зад картата на
началната страница — Leaflet ползва z-index до 1000 за своите слоеве и
контроли, затова `DROPDOWN_CLASS` е на `z-[1100]`.

`bulgaria-map.tsx` също вече тегли селищата на областта чак при клик
върху нея (не предварително), показва всички градове + първите 40 села, а
за останалите насочва към търсачката.

### Разширен списък градове/села под картата (`0024_more_settlements.sql`)

Първоначално всяка област имаше само 1 (най-много 2) записа в `cities`
(само областният град) — списъкът под картата почти винаги беше празен
или с 1 бутон. Собственикът поиска към всяка област да се добавят повече
градове и по-известни села за избор, **без да се трупат допълнителни
точки на самата карта** — идеята е списъкът отдолу да е пълен, картата да
си остане само с областите (и евентуално 1 точка за областния град).

Решено е с два отделни механизма:
- **SQL данни** (`0024_more_settlements.sql`): вкарва ~150 допълнителни
  града и по-известни/по-големи села във всяка от 28-те области,
  **нарочно без `lat`/`lng`** (`NULL` по подразбиране) — списъкът не е
  изчерпателен (България има над 5000 села), само разширена, разумна
  селекция; ако липсва конкретно населено място, добавя се лесно със
  същия `insert` формат в нова миграция.
- **Код** (`bulgaria-map.tsx` + `page.tsx`): `page.tsx` вече фетчва
  **всички** редове от `cities` (махнат е `.not("lat", "is", null)`
  филтъра, който съществуваше само за домашната страница — формите/
  филтрите вече и без друго си фетчваха всички градове). В
  `BulgariaMap`, `showCityMarkers()` (точките НА картата) продължава да
  филтрира само записи с `lat`/`lng` различни от `null` — само тях
  рисува като маркери. Списъкът от бутони ПОД картата (`citiesInRegion`)
  показва **всички** селища в избраната област, независимо дали имат
  координати, сортирани по азбучен ред (`localeCompare(..., "bg")`) —
  затова и по-голямите области (напр. Пловдив с 17 селища) не претрупват
  картата, само удължават списъка отдолу.

### Фикс: списъкът с градове "не се появяваше видимо"

След горния списък собственикът пак съобщи "пак е същото, не правиш нищо
видимо" — при повторна проверка (без ново screenshot) излязоха **два**
реални бъга, не един:

1. **Градските точки се показваха на цялата карта на България отвсякъде**,
   не само след избор на област. Хората естествено тапват директно
   видимата точка на позната точка (напр. "София") ещё от първия екран —
   това веднага навигира към града, без изобщо да мине през стъпката
   "избери област → виж списък с градове". Списъкът отдолу технически
   работеше, но никой не стигаше до него, защото прекият тап на точка го
   заобикаля изцяло. **Фикс**: `showCityMarkers(region)` вече не показва
   никакви градски маркери, докато `region` не е избран (клик на област) —
   така картата на ниво "цяла България" показва само кликаемите области
   (без точки), точно като imot.bg, и хората минават през реалния поток.
2. **10 от 28-те области нямаха нито един seed-нат град** (Видин,
   Кърджали, Кюстендил, Ловеч, Монтана, Разград, Силистра, Смолян,
   Търговище, "София (област)") — избирането им зумираше, но показваше
   абсолютно нищо (нито точки, нито списък), защото буквално няма градове
   с този `region` в базата. "София (област)" обгражда столицата и е
   много вероятно да бъде тапната по погрешка вместо малката "София-град"
   зона — най-вероятният кандидат за "нищо не се случва". Фиксирано с
   миграция `0014_missing_region_cities.sql`, която добавя по един (най-
   големият) град на всяка от тези области.

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
   `https://imotpoint.com` (по подразбиране е `http://localhost:3000`!) и
   **Redirect URLs** трябва да съдържа `https://imotpoint.com/**` (плюс
   `https://property-platform-five.vercel.app/**`, за да работят и
   preview deploy-ите). `imotspot.com` е махнат — домейнът вече не е
   закачен за проекта. Без тази стъпка Supabase успешно автентикира
   потребителя, но го връща на localhost/грешен адрес вместо на живия
   сайт — точно това се случи първия път, преди да го оправим, и ще се
   повтори за новия домейн ако тази стъпка не се направи ръчно след
   смяната на домейна (виж "Собствен домейн" по-долу).

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

По избор (за плаващия AI помощник, виж "Плаващ AI помощник" по-долу):

```
ANTHROPIC_API_KEY=   # Secret! Никога в NEXT_PUBLIC_* променлива
ASSISTANT_IP_SALT=   # произволен таен низ; без него се ползва CRON_SECRET
```

Виж `.env.local.example`. Логото/favicon-ът (`components/logo.tsx`, `app/icon.svg`) показва само
иконата на екрани под `sm` breakpoint (`wordmarkClassName="hidden
sm:inline"` в `site-header.tsx`) — с пълния текст навигацията в хедъра
преливаше на телефон (390px viewport), проверено визуално преди фикса.

### Лого и брандови цветове

Собственикът достави лого (покрив с комин над карфица със зелена точка +
надпис `imotpoint.com`). Знакът е **пресъздаден като SVG**, а не вмъкнат
като PNG — иначе щеше да е размазан на retina и нямаше да може да се
преоцветява. Едни и същи path-ове живеят на три места, които трябва да
се пипат заедно:

| Файл | За какво |
|---|---|
| `components/logo.tsx` | `BrandMark` + `Logo` (хедър, футър) |
| `app/icon.svg` | favicon — знакът в бяло върху тъмносиньо квадратче |
| `app/opengraph-image.tsx` | OG/Twitter снимка (satori не може да ползва компонента) |

Цветовете от логото са дефинирани като Tailwind скали в `@theme` в
`globals.css`: `brand-600 = #1a5180` (тъмносиньо) и
`accent-500 = #2bb98c` (тюркоазено). Старият emerald акцент е сменен
навсякъде с `accent-*`. В SVG-тата стойностите са изписани буквално,
защото satori и `icon.svg` не разбират CSS променливи — при смяна на
цвят се пипат и двете места.

⚠️ Геометрични капани, платени с два цикъла:
- **Коминът** трябва да е с **полегат долен ръб** (успореден на наклона
  на покрива), за да се слее с него; с прав долен ръб стърчи езиче под
  покрива. Виж `V35L54.5 23Z` в края на path-а.
- Първата версия на комина беше с ширина колкото линията на покрива и
  не се четеше като комин на малък размер — сега е ~1.4× по-широка.

Знакът е нарисуван в `viewBox="0 0 82 92"` (по-висок, отколкото широк) —
затова се оразмерява с `h-9 w-auto`, а не с `h-9 w-9`.

Ключът е Supabase's нов "publishable key" формат
(`sb_publishable_...`) — безопасен за публично споделяне, drop-in заместител
на старите JWT-based anon keys.

## Собствен домейн (imotpoint.com)

**Текущият домейн е `imotpoint.com`.** Историята: `imotspot.com` →
`imotami.com` (16.09.2026) → `imotpoint.com` (17.09.2026).

⚠️ **Скъпо научен урок**: `imotami.com` беше купен и настроен докрай, но
Chrome го показа с червен екран **"Опасен сайт"** — домейнът носеше
наказание от Google Safe Browsing, наследено от предишен собственик,
който го е ползвал за нещо зловредно. Купеният домейн беше загубен.
**Преди всяка бъдеща покупка на домейн провери историята му** с тези две
проверки (те не са достъпни от сесията — прави ги собственикът в
браузъра си):
1. `https://transparencyreport.google.com/safe-browsing/search?url=ДОМЕЙН`
   — трябва да върне "Няма налични данни"
2. `https://web.archive.org/web/2020*/ДОМЕЙН` — трябва да върне "has not
   archived that URL" (т.е. на домейна никога не е имало сайт)
`imotpoint.com` мина и двете чисто.
Закупен директно през Vercel Domains, което автоматично оправя DNS-а —
не се налага ръчна конфигурация на nameserver записи.

⚠️ **Гоча при покупка през Vercel**: домейнът се купува на **ниво акаунт**
и НЕ се закача сам за проекта. След покупката: акаунт → Domains → отвори
домейна → секция "Connected Projects" → бутон **Connect** → празно поле
(за голия домейн) → избираш проекта. Иначе сайтът продължава да работи
само на стария адрес и изглежда, че покупката "не е свършила работа".

`NEXT_PUBLIC_SITE_URL` env var сочи към `https://imotpoint.com` (Config тип,
не Secret — стойността не е чувствителна). Използва се в JSON-LD/OG
метаданните, `sitemap.ts`, `robots.ts` и в имейлите (`lib/email.ts`).
Всички fallback стойности в кода вече са `https://imotpoint.com` (преди
сочеха към стария vercel.app адрес, което беше подвеждащо).

⚠️ **`NEXT_PUBLIC_*` се запича при build.** Смяната на стойността във
Vercel НЕ променя живия сайт — старият адрес остава в `sitemap.xml`,
OG таговете и имейлите, докато не се направи нов build. След всяка
промяна на env var: Deployments → ⋯ → **Redeploy** с **махната** отметка
"Use existing Build Cache". Точно това забави тази смяна: env var-ът беше
верен, но deploy-ът беше отпреди него и Search Console даде 3 грешки,
защото sitemap-ът сочеше към чужд домейн.

`imotspot.com` и `www.imotspot.com` са **премахнати** от проекта по
изрично желание на собственика — той не иска стар домейн да отваря новия
сайт. Не ги закачай обратно като пренасочване.

### Списък за смяна на домейн (научен от тази смяна)

Смяната пипа 8 места. Кодът е най-малката част:

1. Vercel: купуване + **Connect** към проекта (виж гочата по-горе)
2. Vercel: `NEXT_PUBLIC_SITE_URL` env var
3. Код: `opengraph-image.tsx` (`DOMAIN` константата), текстът в
   `about/page.tsx`, fallback-ите в `layout.tsx`/`sitemap.ts`/`robots.ts`/
   `listings/[id]/page.tsx`/`lib/email.ts`
4. Supabase → Authentication → URL Configuration (Site URL + Redirect
   URLs) — **иначе входът с Google се чупи**
5. Resend: нова верификация на домейна + `RESEND_FROM_EMAIL`
6. Google Search Console: ново property + верификация + sitemap
7. Vercel: **Redeploy без build cache** — иначе точки 2 и 3 не стигат до
   живия сайт (виж гочата по-горе)
8. Рекламни материали: FB корица/профилна снимка, био текстове, TikTok

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
  свързано** — "Upgrade" бутоните на `/pricing` бяха нарочно disabled
  ("Очаквайте скоро"), защото изисква платежен акаунт, който само
  собственикът на проекта може да създаде.

  **Обновление**: `/pricing` и цялата план-инфраструктура на UI ниво
  оттогава са премахнати — виж "⚠️ Бизнес модел" по-горе за текущото
  (регистрация вместо плащане) поведение.
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
  показва верния статус независимо дали имейл е настроен.

  ✅ **Активирано в production.** DNS записите (MX + 2x TXT за SPF/DKIM)
  се добавят автоматично във Vercel през бутона **"Auto configure"** в
  Resend → Domains → домейна — Resend сам разпознава, че DNS-ът е във
  Vercel, и не се налага ръчно копиране на записи.
  `RESEND_API_KEY` (Secret) и `RESEND_FROM_EMAIL=Имоти без посредници
  <notifications@imotpoint.com>` (Config) са зададени в Vercel → Project →
  Settings → Environments → Production.
  При смяната към `imotpoint.com` домейнът беше добавен наново в Resend
  и верифициран по същия път (Auto configure → изчакване). Верификацията
  отне около час; докато STATUS не е **Verified**, Resend отказва
  изпращането, така че при следваща смяна на домейн това е стъпката,
  която трябва да е зелена, преди напомнянията да се смятат за живи. Реалните имейли за
  седмичните напомняния (виж по-горе) вече стигат до собствениците на
  обявите, не само тестово до акаунта на Resend.
- 🟡 **Фаза 6 (частично)** — SEO metadata (title template, OG за
  обявите с корица снимка), `sitemap.ts` + `robots.ts`, минимален admin
  панел (`/admin`, изисква `profiles.is_admin = true` — виж коментара в
  `0007_admin.sql` как да си дадеш админ права), responsive-ът е
  проверен визуално на мобилен viewport. Performance profiling/по-нататъшно
  polish не е правено.

  **SEO batch #2** — допълнителни подобрения:
  - `app/opengraph-image.tsx` + `twitter-image.tsx` — генерирана по код
    default OG/Twitter снимка (лого + слоган + домейна) за всички
    страници без собствена снимка (напр. листинги без корица снимка,
    home, /listings). `lib/og-font.ts` тегли Inter шрифт с кирилски
    глифи от Google Fonts CSS2 API по време на build/request — **важно**:
    ImageResponse/satori няма вграден шрифт с кирилица, без това текстът
    излиза като празни квадратчета; `text=` параметърът на Google Fonts
    заявката subset-ва шрифта само до нужните символи. При грешка на
    fetch-а има try/catch fallback към същата картинка без fonts array
    (никога не чупи route-а). И двата route-а излизат статични (○) при
    `npm run build` — шрифтът се тегли веднъж по време на build, не на
    всеки request.
  - `listings/[id]/page.tsx`: `generateMetadata` вече conditionally
    добавя `openGraph.images` само когато има корица снимка (spread
    `...(coverPhoto ? {...} : {})`), НЕ `images: undefined` — иначе
    Next.js third-party merge логиката третира ключа като изрично зададен
    (дори празен) и не пада обратно към root `opengraph-image.tsx`.
    Заглавието вече включва цена+локация (`"... — 85 000 €, Младост,
    Пловдив"`) за по-добър CTR в Google резултатите, отделно от on-page
    `<h1>`, който си остава чистото заглавие на собственика.
  - `alternates.canonical` добавен на root layout (`/`), `/listings`
    (консолидира всички `?city=`/`?type=`... филтрирани варианти в една
    канонична страница) и всяка обява (`/listings/[id]`).
  - Homepage вече носи `Organization` + `WebSite` JSON-LD (`@graph`) за
    разпознаване на марката в Google — **нарочно без** `SearchAction`
    (sitelinks searchbox), защото `/listings` няма истинско `?q=`
    свободно търсене, само структурирани филтри; добавянето му би било
    подвеждащо structured data.
  - ✅ **Готово за `imotpoint.com`**: домейнът е регистриран и верифициран в Google
    Search Console (Property type "Domain", верификация през DNS TXT
    запис `google-site-verification=...`, добавен ръчно във Vercel →
    Domains → домейна → DNS Records — **не** през project-ниво
    "Domains", а през account-ниво domain settings страницата, единственото
    място с пълен DNS records editor). `https://imotpoint.com/sitemap.xml`
    е подаден успешно.
    ⚠️ При **Domain** property Search Console не приема съкратен път
    (`sitemap.xml`) — връща "Невалиден адрес на Sitemap". Подава се
    пълният адрес `https://imotpoint.com/sitemap.xml`. Bing Webmaster Tools не е направено — по избор,
    аналогичен процес, по-нисък приоритет от Google.

## Начална страница — редизайн (септември 2026)

Собственикът поиска началната страница да изглежда „направена от
програмист на високо ниво" и даде за референция няколко тъмни луксозни
имотни сайта (Dubai real estate, Haven Realty). След първи тъмен вариант
избра **светла гама със същия характер**.

Какво е взето от референциите и къде живее:

| Елемент | Файл |
|---|---|
| Вълнообразни граници между секциите | `components/home/sections.tsx` → `<Wave>` |
| 3D тесте от обяви в hero-а | `components/home/hero-deck.tsx` |
| Търсачка с превключвател Продажби/Наеми | `components/home/hero-search.tsx` |
| Тъмна лента с 4 показателя + златисти кръгове | `sections.tsx` → `<StatBand>` |
| Стъпаловидни 3D карти „Как работи" | `sections.tsx` → `<HowItWorks>` |
| Сравнение с агенция (3D панели) | `sections.tsx` → `<CostComparison>` |

**3D-то е истинско, не са просто наклонени правоъгълници**: родителят
дава `perspective`, а децата се изнасят напред с различен `translateZ`.
На телефон перспективата се маха изцяло (`lg:` префикси) — в тесен екран
наклонените карти се застъпват и крият цените.

⚠️ **Шрифтове — платен урок.** Първо сложихме **Manrope** за тялото на
текста. Неговата кирилица е с **българските ръкописни форми** (`д` като
`g`, `и` като `u`, `т` като `m`). Те са исторически коректни, но в дълъг
екранен текст са необичайни за повечето читатели. В HTML макета това не
се видя, защото там шрифтът не се зареди и падна на системния — т.е.
одобреният макет НЕ показваше истинската кирилица на Manrope. Сега
тялото е **Inter** (обичайни изправени форми), заглавията са
**Playfair Display**. И двата са с `subsets: ["latin", "cyrillic"]` —
старият Geist нямаше кирилица изобщо и текстът падаше на системния
шрифт, различен на Windows и Mac.

`--font-sans-brand` и `--font-display-brand` се закачат за Tailwind през
`@theme inline` в `globals.css` (`font-sans` и `font-display`).

### 3D знак в hero-а (`components/home/hero-mark-3d.tsx`)

Собственикът поиска интерактивен 3D елемент по модел на един Framer
шаблон (Orbai) и предложи да се генерира през Higgsfield. Направено е
**в код с three.js вместо това**, по две причини:

1. Акаунтът в Higgsfield е на безплатен план с **0 кредита** — нищо не
   може да се генерира без плащане.
2. Дори с кредити, `generate_3d` връща GLB файл от няколко мегабайта,
   който всеки посетител тегли. Тази геометрия е няколко килобайта код,
   остра е на всеки екран и ползва точните цветове на бранда.

Знакът е **същият като в логото**: контурите от `components/logo.tsx` са
пренесени един към един, само че Y се обръща (`y → 47 - y`), защото в SVG
Y расте надолу, а в three.js нагоре. При промяна на логото се пипат и
двете места.

Движение: навежда се към курсора, върти се при скрол, плава бавно, когато
никой не го пипа. Всичко минава през интерполация към целта, не скача.

**Две нива на качество.** Първо знакът беше само за компютър, но
собственикът поиска да се вижда и на телефон. Сега `lite` (под 1024px)
сваля цената: без bevel, по-груба геометрия (`curveSegments` 10 вместо
24, топката 20×14 вместо 48×32), `MeshStandardMaterial` вместо
`MeshPhysicalMaterial` (clearcoat е най-скъпото), една светлина по-малко
и половин резолюция. Слушателят за курсора също отпада — на тъч екран
няма какво да следи, остават скролът и плаването.

На телефон знакът стои **в потока** под картата, а от `lg` нагоре излиза
от потока и плава долу вдясно. Затова в DOM-а е **след** решетката — при
`absolute` редът не значи нищо, но за мобилния поток значи.

⚠️ **Три капана, платени с по един цикъл:**
- **`hidden lg:block` НЕ спира React effect-а.** Първата версия теглеше
  целия three.js и на телефон, за елемент, който никога не се вижда.
  Докато знакът беше само за компютър, breakpoint-ът се проверяваше и в
  кода, не само в CSS. Ако някой ден пак се скрие някъде с CSS —
  проверката трябва да се върне, иначе се тегли за нищо.
- **`THREE` идва от динамичен `import()`** и е стойност, не namespace за
  типове — `THREE.Material` като тип не компилира. Типовете се внасят
  отделно с `import type { Material } from "three"` (изтрива се при
  компилация, не влиза в бъндъла).
- **`function resize()` се вдига** в началото на блока, затова
  TypeScript не пренася вътре стесняването на типа на елемента. Трябва
  стрелкова функция, дефинирана след проверката за `null`.

Рисуването спира, когато знакът излезе от екрана (`IntersectionObserver`),
и изобщо не тръгва при `prefers-reduced-motion`.

### Плаващ AI помощник (3D знакът те следва)

Собственикът поиска 3D знакът да върви с посетителя надолу по
страницата, да се натиска и да отваря асистент, който отговаря на
въпроси за сайта и за имоти. Направено на три части:

| Част | Файл |
|---|---|
| Копче + чат панел | `components/assistant/ai-assistant.tsx` |
| Сървърът, който говори с Claude | `app/api/assistant/route.ts` |
| Дневен лимит в базата | `supabase/migrations/0026_assistant_quota.sql` |

Копчето е монтирано в `app/layout.tsx`, тоест стои на **всяка** страница.
На началната страница се появява чак когато големият знак в hero-а
излезе от екрана — иначе двата се дублират. Свързката между двата е
атрибутът `data-hero-mark`, който `HeroMark3D` слага сам, когато не е в
`compact` режим; помощникът го намира с `querySelector` и следи
позицията му при скрол. Затова **не махай атрибута**, ако пипаш знака.

`HeroMark3D` вече приема `compact` — в копчето знакът е 56px, там скъпият
`MeshPhysicalMaterial` не се вижда, но се плаща, затова compact винаги
минава по олекотения път (същия като на телефон).

⚠️ **Това е единственото място в проекта, което харчи пари на клик.**
Затова има четири спирачки, всичките в `app/api/assistant/route.ts`:
- въпрос до 700 знака,
- най-много 12 реплики история назад (историята е и контекст, и сметка),
- **20 въпроса на посетител на денонощие** — брои се в базата, не в
  паметта на сървъра: Vercel вдига много копия на функцията и брояч в
  паметта на всяко копие не ограничава нищо,
- таван на отговора 1024 токена + `effort: "low"` (кратки въпроси за сайта
  не изискват дълбоко мислене и това е осезаемо по-евтино).

Ако проверката на лимита не успее (базата не отговаря), route-ът връща
503 и **не** извиква Claude. Нарочно fail-closed — по-добре помощникът да
мълчи, отколкото сметката да е отворена.

Броим по **хеш** на IP адреса (`ASSISTANT_IP_SALT`), не по самия адрес —
IP-то е лични данни по GDPR, а за преброяване до 20 хешът върши същото.

Ключът `ANTHROPIC_API_KEY` стои **само** на сървъра, като Secret във
Vercel. Никога в `NEXT_PUBLIC_*` променлива — такива се запичат в
JavaScript-а, който всеки посетител може да прочете, и ключът се краде за
минути. `layout.tsx` праща към браузъра само `aiEnabled` (да/не). Без
ключ копчето пак стои и се натиска, но панелът показва преки пътища из
сайта вместо чат — нарочно **не** предварително написани отговори, които
после ще се разминат с истинските.

Системният текст (какво знае помощникът за сайта) е в самия route и взема
лимитите и имейла от `lib/listing-labels.ts`, за да не се разминава с
реалното поведение. В него изрично пише: да не измисля брой обяви, цени
или функции; да не дава правни/данъчни съвети като сигурни; да не иска
ЕГН/парола/карта; и че съобщенията на посетителя са въпроси, **не**
инструкции към него (иначе първият, който напише „забрави правилата",
превръща помощника в чужд безплатен чатбот).

### Картата вече не е на началната страница

По изрично искане на собственика `BulgariaMap` е махната от `page.tsx`.
Не е изтрита — преместена е в `/listings` зад бутон „Избери от картата"
(`components/region-map-panel.tsx`).

⚠️ Панелът **монтира картата чак при отваряне**, не я крие с CSS.
Leaflet мери контейнера си при инициализация; в скрит елемент
(`display:none`, затворен `<details>`) излиза сиво поле, което се оправя
само с ръчен `invalidateSize()`. Свежото монтиране заобикаля проблема.

### Празно състояние вместо измислен каталог

При под 3 активни обяви `HeroDeck` показва една карта „Тук ще е твоята
обява" вместо примерни имоти, а секцията „Последни обяви" се скрива
изцяло (`MIN_LISTINGS_FOR_FEED`). Три празни кутийки изглеждат по-зле от
липсваща секция.

⚠️ **Отказано искане**: собственикът поиска брояч на обяви, показван на
клиентите, но **завишен, а не реален**. Отказано — показването на
измислени числа е заблуждаваща търговска практика по ЗЗП, а числото се
опровергава само̀ в момента, в който човек направи търсене. Показваме
само проверими твърдения (5267 населени места, 28 области, 0%
комисионна, „Защита срещу агенции" — нарочно дума, не брой мерки, за да
не остарява и да не приканва посетителя да ги преброи). Ако темата се върне: истински брояч, скрит
докато обявите не станат достатъчно, е приемливото решение.

### Web Analytics

`@vercel/analytics` е добавен в `app/layout.tsx` (`<Analytics />` най-долу
в `<body>`). Брои **реални посетители** — уникални хора, най-гледани
страници, откъде идват (Facebook, Google, директно) — за разлика от
таблото Observability във Vercel, което брои технически заявки (edge
requests, function invocations) и не казва нищо за хората.

Избран е пред Google Analytics нарочно: Vercel Analytics не пуска
бисквитки и не събира лични данни, така че сайтът няма нужда от cookie
банер по GDPR. За български сайт това спестява и правен риск, и един
досаден popup на всяко отваряне.

Кодът сам по себе си не е достатъчно — трябва и **Vercel → Project →
Analytics → Enable**. Без това скриптът се зарежда, но данни не се
записват.

### Cron job — важно за deploy

`vercel.json` дефинира daily cron към `/api/cron/expire-listings`.
За да работи в production, добави `CRON_SECRET` environment variable в
Vercel project settings (произволен таен низ) — Vercel автоматично го
праща като `Authorization: Bearer <CRON_SECRET>` header на всеки cron
request, а route handler-ът го проверява. Без зададен `CRON_SECRET`
route-ът работи и без auth проверка (за локално тестване), но за
production **задай го**.

## Админ панел + борба с обяви от агенции

`/admin` (`app/admin/page.tsx`) вече съществуваше (Фаза 6) — списък с
всички обяви, статус/цена/собственик, бутони Активирай/Деактивирай/
Изтрий (`lib/actions/admin.ts`). Достъпът е през `profiles.is_admin`
(по подразбиране `false` за всички) — **еднократна ръчна стъпка** за
собственика да си отключи достъп:
```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = '<твоят имейл>');
```

**Сигнал за заподозряна агенция (първа стъпка от план за намаляване на
агенционните обяви)**: `admin/page.tsx` брои колко активни обяви споделят
един и същ `listings.phone` — 3+ обяви на един телефон вероятно е
агенция, не личен продавач (агенциите рядко сменят номера между обяви).
Такива редове се показват най-отгоре в списъка и с жълт фон + badge
"⚠ Телефон в N обяви" (`admin-listings-table.tsx`). Само сигнал за
собственика да прегледа ръчно — не блокира/изтрива автоматично нищо.

**Разширена информация за обявите в admin панела** (`0020_admin_listing_insights.sql`):
за всяка обява `/admin` вече показва кога е качена (`created_at`), дата на
последна реална редакция (`updated_at`, само ако се различава от датата на
качване), брой гледания (`listings.view_count`, инкрементиран от публичното
RPC `increment_listing_view()` при всяко отваряне на детайлната страница от
НЕ-собственик), имейла на собственика, и разгъваема "История на редакциите"
(бутон под всеки ред) — кой ред е сменен, от старата към новата стойност, и
дали го е направил собственикът или admin (`listing_edit_log`, пълнена
автоматично от тригер `on_listing_updated` при UPDATE на `listings`; полето
`view_count` е изрично изключено от диференцирането, за да не се трупа запис
при всеки преглед).

⚠️ **`profiles.email` е нарочно НЕ публична колона** — за разлика от
`name`/`phone`, RLS работи на ниво ред, не колона, а имейлът не бива да е
четим от никой обикновен клиент. Затова `revoke select on public.profiles
from anon, authenticated` + `grant select (id, name, phone, ...)` без
`email` — вижте `getProfile()` в `dal.ts`, който вече изрично изброява
колони вместо `select("*")`. Единственият път до имейлите е
`admin_get_profile_emails(uuid[])`, SECURITY DEFINER функция, която сама
проверява `is_admin` и хвърля грешка иначе — извиква се само от
`app/admin/page.tsx` през `supabase.rpc(...)`. Ако добавяш ново място,
което чете `profiles`, помни: `select("*")` вече ще гърми с "permission
denied for column email" за не-admin роля — изброявай колони изрично.

**"Докладвай като агенция" бутон + ban list** (`0021_agency_reports_and_bans.sql`):

- `listing_reports` — всеки логнат не-собственик може да докладва обява
  веднъж (`unique (listing_id, reported_by)`); бутонът е на детайлната
  страница (`components/report-agency-button.tsx`, action
  `reportListingAsAgency` в `lib/actions/listings.ts`). Броят доклади се
  показва като червен badge "🚩 N доклада" в admin панела и участва във
  сортирането (след телефонния сигнал).
- `agency_bans` — ръчно решение на admin-а: бутонът "Блокирай агенция"
  (`adminBanAgencyListing` → RPC `admin_ban_agency(listing_id)`) блокира
  ЕДНОВРЕМЕННО телефона И имейла на собственика на обявата (записва ги в
  `agency_bans` с `unique (kind, value)`, "Няма посочен телефон"
  плейсхолдър изрично изключен), и деактивира (не трие) всички техни
  текущи обяви със същия телефон или собственик. Действието е трудно
  обратимо — UI-то пита с `confirm()` преди да го изпълни.
- Блокирането важи занапред на две места: `is_contact_banned(phone, email)`
  (публично RPC, връща само true/false, никога самия списък) се проверява
  в `createListing`/`updateListing` (телефон + имейл на текущия потребител)
  и в `signUp()` (само имейл, преди да се извика `supabase.auth.signUp`) —
  плюс `handle_new_user()` тригерът на `auth.users` проверява имейла
  директно в базата, като fail-safe и за OAuth регистрация (която не минава
  през `signUp()`).
- **Известно ограничение**: съвпадението е по точен низ — интервал или
  различен формат на телефона (напр. "+359" срещу "0") заобикаля бана.
  Достатъчно за сегашния мащаб; ако стане проблем, добави нормализация на
  телефонния формат преди сравнение.

**Един телефон на потребител** (`0022_single_profile_phone.sql`):
собственикът поиска телефонът да не се различава от обява на обява на
един и същ потребител — правеше засичането по споделен телефон
по-неточно и объркваше купувачите. `profiles.phone` вече е задължителен
(`profile-form.tsx` + валидация в `updateProfile()`); формите за
нова/редакция на обява вече НЕ приемат телефон от клиента изобщо — само
показват текущия read-only с линк "Промени в профила"
(`new-listing-form.tsx`/`edit-listing-form.tsx`). `createListing`/
`updateListing` вземат телефона директно от профила
(`getRequiredProfilePhone()` в `lib/actions/listings.ts`) и хвърлят
грешка, ако е празен. Тригер `on_profile_phone_updated` синхронизира
`listings.phone` на всички съществуващи обяви веднага щом потребителят
си смени телефона в профила — не се налага да отваря всяка обява
поотделно.

**Лимит на брой обяви на профил** (`0023_listing_limit.sql`): по
подразбиране всеки потребител може да качи най-много
`DEFAULT_LISTING_LIMIT = 3` обяви общо (не само активни — броят се всички
редове в `listings`, изтрий стара, за да освободиш място).
`profiles.listing_limit` пази лимита per-user (публично четим, но само
admin може да го променя — колоната умишлено не е в UPDATE grant-а от
0010, единственият път е `admin_set_listing_limit()` RPC). `createListing`
брои текущите обяви на потребителя и хвърля грешка при достигнат лимит,
сочейки към `SUPPORT_EMAIL` (`listing-labels.ts` —
`imotpoint@gmail.com`, отделен Gmail акаунт, не личния имейл на
собственика). `/dashboard/listings/new` проверява лимита предварително и
показва банер вместо формата, ако е достигнат — потребителят не пълни
цялата форма само за да гръмне накрая.
Admin панелът показва "X/Y обяви на собственика" на всеки ред и бутон
"(промени лимита)" (prompt за ново число) → `adminSetListingLimit()`.

**Следващи стъпки от плана (обсъдени, не implement-нати още)**:
ключово-думен филтър в описанието ("агенция", "брокер" и т.н.), SMS
верификация на телефона при регистрация. Виж чата за пълния списък с
приоритизация.

## Страница "За нас" + навигация по тип сделка

`app/about/page.tsx` е статична информационна страница с по-дълго
описание на платформата (защо без посредници, как работи за продавачи и
за търсещи, колко струва, мерките срещу агенции, за кого е подходяща,
контакт). Стойностите в текста идват от `lib/listing-labels.ts`
(`DEFAULT_LISTING_LIMIT`, `MAX_LISTING_PHOTOS`, `SUPPORT_EMAIL`), за да
не се разминава с реалното поведение при промяна. Линкната е от футъра
и е добавена в `sitemap.ts`.

Горната лента (`site-header.tsx`) вече има три линка към обявите:
**Продажби** (`/listings?type=sale`), **Наеми** (`/listings?type=rent`) и
**Всички обяви** (`/listings`) — `?type=` параметърът вече се
поддържаше от филтъра на `/listings`, не се наложи нов код там.

## Съзнателно извън обхват (не са бъгове)

- Реално плащане/billing (Stripe или myPOS/Borica) — изисква акаунт,
  който само собственикът на проекта може да създаде; UI-то за планове
  вече съществува и чака интеграцията.

## Команди

```bash
npm run dev      # локална разработка
npm run build    # production build (Turbopack)
npm run lint     # ESLint
```

Локален dev/build изисква `.env.local` дори с placeholder стойности,
иначе `proxy.ts` гърми при опит да създаде Supabase client.
