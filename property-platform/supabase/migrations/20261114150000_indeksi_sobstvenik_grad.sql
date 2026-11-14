-- Одит №23: два липсващи индекса върху обявите.
--
-- 1) По собственик: „Моите обяви“, лимитът за брой обяви и проверките
--    „чия е обявата“ търсят по user_id и досега четяха цялата таблица.
-- 2) По град + статус + дата: страницата на град и търсенето по град
--    подреждат по най-нови; с индекса базата взима първите N направо,
--    без да сортира всички обяви в града.
--
-- Таблицата е малка (няколко хиляди реда), затова индексите се правят
-- за части от секундата и не е нужно CONCURRENTLY.

create index if not exists listings_user_idx
  on public.listings (user_id, created_at desc);

create index if not exists listings_city_status_created_idx
  on public.listings (city_id, status, created_at desc);
