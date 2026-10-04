# Аудио за таблото — какво прави Claude при поръчка

Бутонът „▶ Слушай“ в таблото записва избраните новини с гласа Milena през
конектора на ElevenLabs, записва задачата в базата като `audio_jobs/<job>`
(`{"state": "new", "at", "clips": [{"id", "key", "title", "url", "flow_id",
"session_ids"}]}`) и пуска кратка сесия с това ръководство. Таблото не може
да пуска звук от външни адреси, затова клиповете се качват в собственото му
хранилище.

1. ArtifactData `get` на `audio_jobs/<job>` (или `query` на `audio_jobs` със
   `state == "new"` при сутрешния брой — всички чакащи). Ако задачата е по-стара
   от ~100 минути, подписаните `url` са изтекли: вземи нови с ElevenLabs
   `creative_get_flow_run_status` (`flow_id`, `session_ids`) → `media[].url`.
2. Запиши `{"job", "clips"}` в `work/audio_job.json` и пусни
   `python3 audio_put.py work/audio_job.json` (сваля mp3, прави audio-only mp4 —
   хранилището не приема mp3).
3. Artifact: publish с `url` на таблото, `asset: true`, `file_paths` = файловете от
   `done` (до 25 наведнъж). Ако откаже, защото артефактът не е четен в сесията —
   `action: "read"` на същия url и пак.
4. ArtifactData batch: `set audio/<id>` → `{"key", "title", "asset": "<id на
   качения файл>", "at": "<ISO>"}` за всеки качен клип (пропусни вече
   съществуващ `audio/<id>`), и `update audio_jobs/<job>` с `if_version` от
   стъпка 1 → `{"state": "done" | "error", "message"?, "at": "<ISO>", "clips":
   {"__delete__": true}}` (линковете не трябват повече).
5. Без бележки и въпроси към потребителя. Изтрий `work/audio/*`.
