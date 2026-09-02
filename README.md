# Autonomous Crypto + ETF Trading Agent — Demo

Демо приложение за автономен AI трейдър-анализатор, който търгува с
**виртуален (paper trading) капитал** крипто активи и ETF-и. Агентът чете
новини и изказвания на ключови фигури, прави технически анализ, и
комбинира трите в решение (`buy`/`sell`/`hold`) с естествено-езикова
обосновка — вижте `docs/DECISION_SCHEMA.md` за точния формат.

**Няма връзка към реални средства.** Не е финансов съвет.

## Публично демо (живо)

- Табло: https://ai-trading-test.netlify.app
- API: https://ai-trader-demo-backend.onrender.com (`/docs` за пълния API)

И двете са deploy-нати директно от branch-а `claude/ai-autonomous-trader-crypto-etf-anstj4`
чрез безплатните планове на Netlify и Render — вижте `docs/DEPLOY.md`
за настройката и известните ограничения на free tier (cold start, непостоянни данни).

## Структура на проекта

```
backend/    FastAPI + SQLAlchemy + APScheduler — pipeline, paper trading engine, REST API
frontend/   React + Vite + Tailwind + Recharts — dashboard, дневник на решенията, настройки
docs/       Архитектура, MVP план, decision schema, регулаторни бележки
```

Прочетете `docs/ARCHITECTURE.md` за пълната картина (диаграма на
компонентите, поток на едно решение, дизайн на бъдещия "approval mode").

## Бърз старт

### Бекенд

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # по избор — работи и без нито един ключ
uvicorn app.main:app --reload --port 8000
```

API документация: http://127.0.0.1:8000/docs

Демото работи изцяло **без** никакви API ключове — новините/изказванията
се симулират с реалистични mock данни, техническият анализ тегли реални
безплатни ценови данни (CoinGecko за крипто, Stooq за ETF-и, с автоматичен
synthetic fallback при недостъпна мрежа), а обосновката на решенията
използва детерминиран rule-based модел вместо Claude, ако
`ANTHROPIC_API_KEY` не е зададен.

Планировчикът стартира автоматичен анализ на всеки
`ANALYSIS_INTERVAL_MINUTES` (по подразбиране 240) минути. За демонстрация
на живо ползвайте бутона "Пусни анализ сега" в таблото, или директно:

```bash
curl -X POST http://127.0.0.1:8000/analyze/run
```

### Фронтенд

```bash
cd frontend
npm install
cp .env.example .env.local      # VITE_API_BASE сочи към бекенда
npm run dev
```

Отворете http://127.0.0.1:5173 — Табло / Дневник на решенията / Настройки.

## Конфигурация (по избор)

Всички ключове в `backend/.env.example` са опционални — вижте коментарите
там за какво служи всеки и какъв е fallback-ът без него:

| Ключ | Активира |
|---|---|
| `ANTHROPIC_API_KEY` | Claude-генерирана обосновка на решенията вместо rule-based шаблон |
| `COINGECKO_API_KEY` | По-висок rate limit за крипто цените (демо tier работи и без ключ) |
| `NEWS_API_KEY` / `STATEMENTS_API_KEY` | Реални новини/изказвания вместо mock данни (изисква и имплементация на `_fetch_real_*` в съответния модул — вижте `docs/MVP_PLAN.md`, Фаза 1) |

## Публичен deploy (Render + Netlify, безплатни планове)

Repo-то съдържа готови `render.yaml` и `netlify.toml` за deploy директно
от текущия branch, без да се чака merge. Пълните стъпка-по-стъпка
инструкции (вкл. свързване на нов Render/Netlify акаунт с GitHub) са в
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Документация

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — компоненти, поток на данните, approval-mode дизайн
- [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md) — какво е built сега и следващите фази
- [`docs/DECISION_SCHEMA.md`](docs/DECISION_SCHEMA.md) — пълен JSON формат на едно решение
- [`docs/REGULATORY_NOTES.md`](docs/REGULATORY_NOTES.md) — бележки за България/ЕС при преход към реална търговия
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — deploy в Render (бекенд) + Netlify (фронтенд)
