-- Собственикът на продукта поиска адрес и телефон да са задължителни
-- полета при публикуване на обява (снимките вече НЕ са задължителни —
-- вижте премахнатата MIN_LISTING_PHOTOS проверка в lib/actions/listings.ts).
--
-- Адресът и телефонът се показват на детайлната страница само зад
-- paywall-а от предишния пивот (виж 0008_search_subscription_paywall.sql
-- и app/listings/[id]/page.tsx) — само собственикът на обявата или
-- абонат с платен план ги вижда.

alter table public.listings add column address text;
alter table public.listings add column phone text;

-- Backfill за вече съществуващи обяви, за да можем да сложим NOT NULL:
-- телефонът се взима от профила на собственика, ако е бил попълнен
-- някъде другаде; иначе плейсхолдър, който собственикът на обявата
-- може да редактира от /dashboard/listings/[id]/edit.
update public.listings
  set phone = coalesce(
    nullif(phone, ''),
    (select nullif(p.phone, '') from public.profiles p where p.id = listings.user_id),
    'Няма посочен телефон'
  )
where phone is null;

update public.listings
  set address = 'Няма посочен адрес'
where address is null;

alter table public.listings alter column address set not null;
alter table public.listings alter column phone set not null;
