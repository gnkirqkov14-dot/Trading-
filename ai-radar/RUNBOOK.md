# AI Радар — ежедневен брой (за Claude)

Изпълнява се всяка сутрин от Routine (~06:26 българско време, в
основната сесия). Бутонът „Обнови сега“ в таблото отваря НОВА облачна сесия
с това repo (`meta/config.refresh` в базата) — там няма `work/prev`, така че
анализът е пълен, без имейл и без commit/push. Работната папка е `ai-radar/work/` (не се
commit-ва).

Табло: https://claude.ai/artifact/3rTEekKmP9BUMRpTJxvF2X
Имейл до: собственика (адресът от контекста на сесията)

## Стъпки

1. `cd ai-radar && git pull --ff-only origin claude/adoring-ritchie-q8pg6l`
   (ако сесията е в нов контейнер). `mkdir -p work`.
2. Статус в таблото: ArtifactData `set` на `meta/status`
   `{state: "running", at: <сега>, message: "Събирам източниците"}`
   (прочети документа първо за `if_version`).
3. Прочети от базата (ArtifactData, `out_dir: ai-radar/work/dbread`):
   `list sources`, `list history` (limit 10), `get prefs/main`.
   После `python3 db_io.py import work/dbread work/` → прави
   `work/user_sources.json`, `work/history.json`, `work/prefs.json`,
   `work/prev_topics.json`.
4. `python3 collect.py --out work --user-sources work/user_sources.json`
5. Анализ: първо `meta/status` → message „Анализирам новините“ (иначе таблото
   до края показва „Събирам източниците“). После пусни subagent (general-purpose) с инструкциите от
   `ANALYSIS.md`, вход `work/compact.json` (+ `work/prev_topics.json`,
   `work/prefs.json`), изход `work/analysis.json`, и проверка с
   `python3 build_digest.py --check work/analysis.json --work work`.
   Главната сесия НЕ чете compact.json — пести контекст.
   **Ако има предишен анализ** (`work/prev/analysis-<вчера>.json` — пази се,
   докато контейнерът е жив): ползвай го като `prev_analysis.json` със
   стъпките отдолу; subagent-ът пише свеж `brief`, `people`, нови и обновени
   теми само за новите елементи. След записа копирай `work/analysis.json`
   в `work/prev/analysis-<днес>.json`. Ако RSS на YouTube падне, събирачът
   сам чете страниците на каналите.
   **Същия ден („Обнови сега“ след вече готов брой):** не анализирай
   всичко наново — `cp work/analysis.json work/prev_analysis.json`,
   `python3 incremental.py split work/prev_analysis.json work` и subagent
   анотира само `work/compact_new.json` → `work/analysis_new.json`, после
   `python3 incremental.py merge work/prev_analysis.json work/analysis_new.json work`.
6. `python3 build_digest.py --work work --history work/history.json --prefs work/prefs.json --user-sources work/user_sources.json --dashboard-url https://claude.ai/artifact/3rTEekKmP9BUMRpTJxvF2X`
7. Запис в базата: `work/db/writes.json` изрежда документите. ArtifactData
   `batch` с `op: set` и `file_path` за всеки (до 50 на batch, до 1 MiB —
   раздели на няколко batch-а по размер `kb`). За документи, които вече
   съществуват (`meta/latest`, `meta/radar`), е нужен `if_version` — вземи го
   от четенето в стъпка 3 или с `get`. `meta/latest` се пише последен.
8. Статуси на потребителските източници: `python3 db_io.py statuses work/`
   дава update-и за `sources/<id>` (status ok/error, channel_id, resolved_name) —
   запиши ги с batch `update` + `if_version`.
8б. Пълни статии за „▶ цялата статия“: `python3 voice.py --work work` → запиши
   `work/db/fulltext__<дата>.json` като `fulltext/<дата>` в базата (ArtifactData set с
   file_path). ElevenLabs вече НЕ се ползва (потребителят го спря заради цената) —
   не качвай нищо в агента.
8в. Безплатно аудио (Microsoft Kalina): `python3 audio_daily.py --work work` → качи
   `work/audio_day.mp4` с Artifact (`url` на таблото, `asset: true`) и запиши
   `audio/day-<дата>` = съдържанието на `work/audio_day.json` + `"asset": "<id>"`.
   Изтрий `audio/day-*` по-стари от 7 дни и техните файлове (Artifact delete с id).
9. Имейл: Gmail `send_message` до собственика, тема
   `work/email_subject.txt`, тяло `work/email.html` (HTML) / `email.txt`.
   Само при сутрешния брой — при ръчно обновяване от таблото не се праща.
10. `meta/status` → `{state: "done", at, message: "Готово: N теми"}`.
    При грешка → `{state: "error", message: <кратко>}` и продължи с
    каквото може (напр. стари данни остават видими).

## Ако нещо се счупи

- Анализиращият subagent виси (над ~20 мин без нов `work/analysis_new.json`;
  внимавай — файл с вчерашна дата е от вчера, виж `stat`) → `TaskStop` и го
  пусни пак със забрана да тегли страници, най-много 3 WebSearch и изискване да
  запише `analysis_new.json` в първите ~12 минути. Нормалното време е ~12 мин.
  Докато чака, таблото показва вчерашния брой — `meta/latest` се пише последен.

- YouTube връща 429 → събирачът продължава с останалите източници; в
  `raw.json` `health` пише кое е паднало.
- Документ над 250 KiB → `build_digest.py` спира; намали `CHUNK_BYTES`.
- Анализът е невалиден → поправи с `--check`; последната възможност е
  брой без резюмета (всички елементи с `t: "misc"`), но таблото пак
  показва видеата и новините.
