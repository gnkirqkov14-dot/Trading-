# Имоти без посредници — Платформа за обяви (MVP)

Обяви за имоти директно от собственик, без агенции. Виж пълната
спецификация и фазите на разработка в [`docs/PLAN.md`](docs/PLAN.md).

> Този проект живее в собствена подпапка (`property-platform/`) в общото
> `Trading-` repo, отделно от несвързания crypto/ETF trading demo в
> `backend/` и `frontend/` в корена на repo-то.

## Статус: Фаза 1 — Скелет + Auth ✅

Направено в тази фаза:

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Supabase клиенти за browser / server / proxy (Next.js 16 преименува
  Middleware на **Proxy** — виж `src/proxy.ts`)
- SQL миграция с целия модел на данните от спецификацията: `profiles`,
  `cities`, `neighborhoods`, `listings`, `listing_photos`,
  `listing_videos`, `messages`, `subscriptions` — с Row Level Security
  политики за всяка таблица (`supabase/migrations/0001_init.sql`)
- Работещ auth flow: регистрация, вход, изход (Server Actions +
  `useActionState`), защитен `/dashboard` route (redirect към `/login`
  ако не си логнат)
- Начална страница-скелет с placeholder за интерактивната карта (Фаза 3)

## Технологичен стек

| Слой | Избор |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| Backend/DB/Auth | Supabase (Postgres + Auth + Storage + Realtime) |
| Session management | `@supabase/ssr` (cookie-based, refresh-ва се в `proxy.ts`) |

> **Важно за Next.js 16**: тази версия има breaking changes спрямо по-стари
> Next.js знания — напр. `middleware.ts` вече се казва `proxy.ts` (същата
> функционалност, нов файл/export). Виж
> `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` при
> съмнение.

## Бърз старт

```bash
cd property-platform
npm install
cp .env.local.example .env.local   # виж по-долу как да вземеш ключовете
npm run dev
```

Отвори http://localhost:3000.

### Свързване със Supabase проект

1. Създай безплатен проект в [supabase.com](https://supabase.com).
2. **Project Settings → API** → копирай `Project URL` и `anon public` ключа
   в `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Приложи схемата: **SQL Editor** → постави съдържанието на
   `supabase/migrations/0001_init.sql` → Run. (Или чрез Supabase CLI:
   `npx supabase db push`, ако имаш линкнат проект.)
4. `npm run dev` и тествай регистрация на http://localhost:3000/register —
   ще получиш имейл за потвърждение от Supabase (email confirmations са
   включени по подразбиране; можеш да ги изключиш в **Authentication →
   Providers → Email** за по-бързо локално тестване).

Без валидни ключове приложението компилира и рендва нормално, но
регистрация/вход ще fail-ват мълчаливо (проверено — `/dashboard` коректно
редиректва към `/login`, вместо да гърми).

## Структура

```
src/
  app/
    (auth)/login, (auth)/register   — auth страници + споделен layout
    dashboard/                      — защитен route (Фаза 2 съдържание)
    page.tsx                        — начална страница
  components/                       — SiteHeader, login/register форми
  lib/
    actions/auth.ts                 — Server Actions: signUp/signIn/signOut
    supabase/client.ts              — browser client
    supabase/server.ts              — server client (Server Components/Actions)
    supabase/middleware.ts          — session refresh логика (ползва се в proxy.ts)
    supabase/dal.ts                 — Data Access Layer (verifySession и т.н.)
    types/database.ts               — TS типове по модела на данните
  proxy.ts                          — session refresh + защита на /dashboard
supabase/
  migrations/0001_init.sql          — цялата схема + RLS policies
```

## Следващи фази

Виж [`docs/PLAN.md`](docs/PLAN.md) за пълния план (Фаза 2: обяви +
снимки/видео, Фаза 3: карта на България + филтри, Фаза 4: абонаменти,
Фаза 5: съобщения + седмична актуализация, Фаза 6: полиране).

### Архитектурни решения, оставени отворени

- **Карта**: спецификацията предлага Leaflet + OpenStreetMap (безплатно)
  или Mapbox (по-хубав дизайн, платено). Решаваме във Фаза 3.
- **Плащания**: Stripe vs. myPOS/Borica за България. Решаваме във Фаза 4.
- **Image/video hosting**: Supabase Storage vs. Cloudinary. Решаваме във
  Фаза 2.
