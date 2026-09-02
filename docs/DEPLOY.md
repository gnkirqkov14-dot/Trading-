# Deploy: Render (бекенд) + Netlify (фронтенд)

Тези стъпки пускат приложението директно от branch-а
`claude/ai-autonomous-trader-crypto-etf-anstj4` — не се чака merge в main.
И двете платформи имат безплатен план, достатъчен за демото.

Repo-то вече съдържа `render.yaml` (в корена) и `netlify.toml` (в корена),
така че двете платформи автоматично разпознават как да build-нат и стартират
приложението — не се налага ръчно въвеждане на build команди.

## Част 1 — Бекенд в Render.com (безплатен план)

### 1.1 Създаване на акаунт / влизане
1. Отвори https://dashboard.render.com/register
2. Избери **"Sign up with GitHub"** — това ще отвори GitHub, за да
   разрешиш на Render достъп до избрани (или всички) твои repo-та. Ако
   вече имаш Render акаунт, просто влез с "Log in with GitHub".
3. При първо влизане Render ще поиска да инсталираш "Render" GitHub App —
   избери репото `gnkirqkov14-dot/Trading-` (или "All repositories", ако
   предпочиташ) и потвърди.

### 1.2 Deploy през Blueprint (автоматично разпознава `render.yaml`)
1. В Render dashboard: **New +** → **Blueprint**
2. Избери repo-то `Trading-`. Render автоматично намира `render.yaml` в
   корена и показва един сервиз: `ai-trader-demo-backend` (free plan,
   branch `claude/ai-autonomous-trader-crypto-etf-anstj4`).
3. Render ще поиска стойности за няколкото опционални ключа
   (`ANTHROPIC_API_KEY`, `COINGECKO_API_KEY`, `NEWS_API_KEY`,
   `STATEMENTS_API_KEY`) — **може да ги оставиш празни**, демото работи
   изцяло без тях (mock новини + rule-based обосновка вместо Claude).
   Ако имаш Claude API ключ и искаш по-богата обосновка на решенията,
   постави го в `ANTHROPIC_API_KEY` тук.
4. Натисни **Apply**. Build-ът отнема 2-4 минути (виждаш логовете на
   живо).
5. Когато статусът стане **Live**, копирай публичния URL — изглежда
   приблизително така: `https://ai-trader-demo-backend.onrender.com`
6. Провери, че работи: отвори `<URL>/health` в браузъра — трябва да
   върне `{"status":"ok"}`. Пробвай и `<URL>/docs` за пълния API.

### 1.3 Важни особености на безплатния план (прочети преди да разчиташ на него ежедневно)
- **"Заспиване" при неактивност**: след ~15 минути без заявки, сервизът
  спира и следващата заявка го "събужда" — първото зареждане на таблото
  след пауза ще отнеме ~30-50 секунди, докато бекендът стартира отново.
  Това е нормално за free plan, не е повреда.
- **Данните не са трайни**: безплатният план няма постоянен диск — при
  всеки redeploy (и обичайно при всяко събуждане от сън) SQLite файлът с
  портфейла се пресъздава от нулата (отново с начален капитал $100,000).
  За демо ползване това е приемливо, но означава, че историята на
  сделките няма гарантирано да оцелее ден за ден.
  - Ако искаш портфейлът да пази история трайно, без да плащаш на Render:
    създай безплатна PostgreSQL база в https://neon.tech (безсрочен free
    tier), копирай връзката (`postgresql://...`) и я постави като
    `DATABASE_URL` в Render → сервиза → Environment. Кодът вече поддържа
    Postgres без промяна (SQLAlchemy). Кажи ми, ако искаш да ти го
    настроя.

## Част 2 — Фронтенд в Netlify (безплатен план)

### 2.1 Създаване на акаунт / влизане
1. Отвори https://app.netlify.com/signup
2. Избери **"Sign up with GitHub"** (или влез, ако вече имаш акаунт) и
   разреши достъп до repo-то, аналогично на Render по-горе.

### 2.2 Import на проекта
1. В Netlify dashboard: **Add new site** → **Import an existing project**
2. Избери **GitHub**, после repo-то `Trading-`
3. Netlify чете `netlify.toml` и попълва build настройките автоматично:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
4. **Branch to deploy**: смени от `main` на
   `claude/ai-autonomous-trader-crypto-etf-anstj4`
5. **Преди да натиснеш Deploy** (или веднага след, после ще редеплойнеш):
   отвори **Add environment variables** и добави:
   - Key: `VITE_API_BASE`
   - Value: URL-ът от Render, който копира в стъпка 1.2.5 (напр.
     `https://ai-trader-demo-backend.onrender.com`) — **без** `/` накрая
6. Натисни **Deploy site**. Build-ът отнема ~1 минута.
7. Ако си добавил `VITE_API_BASE` след първия deploy: **Deploys** →
   **Trigger deploy** → **Deploy site**, за да се вгради новата стойност
   (Vite чете env променливите по време на build, не runtime).

### 2.3 Публичният линк
Netlify дава URL от типа `https://random-name-123abc.netlify.app`. Може
да го преименуваш: **Site configuration** → **Change site name** → избери
нещо като `ai-trader-demo` → линкът става
`https://ai-trader-demo.netlify.app`.

Отвори го от телефона и провери, че таблото зарежда данни (ако бекендът е
бил заспал, изчакай ~30-50 сек при първо зареждане, вижте 1.3).

### 2.4 За ежедневна употреба от телефона
- **iPhone (Safari)**: отвори линка → бутон "Share" → **Add to Home
  Screen**. Ще се появи икона, която отваря директно приложението.
- **Android (Chrome)**: отвори линка → трите точки горе вдясно →
  **Add to Home screen** / **Install app**.

## Забележка за сигурност

В демото няма login/автентикация — всеки, който има линка към бекенда,
може да пусне `POST /analyze/run` или да смени настройките за риск. Тъй
като портфейлът е изцяло виртуален, това е приемлив риск за личен демо
инструмент, но не давай бекенд линка публично, ако не искаш случайни хора
да си играят с демо портфейла ти.

## Алтернатива: deploy директно от терминала (без клик в дашбордите)

Ако предпочиташ аз да задвижа целия deploy оттук (без да влизаш в
Render/Netlify UI освен за да генерираш ключ), генерирай:
- Render API key: Render dashboard → Account Settings → API Keys
- Netlify Personal Access Token: Netlify → User settings → Applications →
  New access token

Дай ми ги (само за тази сесия, не се записват в repo-то) и мога да
изпълня deploy-а през техните CLI/API директно от bash — без да ти се
налага да минаваш през стъпките по-горе.
