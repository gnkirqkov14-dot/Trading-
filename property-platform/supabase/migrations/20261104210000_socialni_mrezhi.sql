-- Собственикът отбелязва, че обявата му може да се пуска безплатно в
-- социалните мрежи на imotpoint (Facebook, Instagram, TikTok).
-- Кога е дадено съгласието се пази отделно, за да има следа.
alter table public.listings
  add column if not exists socialni_mrezhi boolean not null default false,
  add column if not exists socialni_mrezhi_na timestamptz;

create or replace function public.socialni_mrezhi_data()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.socialni_mrezhi and (tg_op = 'INSERT' or not old.socialni_mrezhi) then
    new.socialni_mrezhi_na := now();
  elsif not new.socialni_mrezhi then
    new.socialni_mrezhi_na := null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_listing_socialni_mrezhi on public.listings;
create trigger on_listing_socialni_mrezhi
  before insert or update of socialni_mrezhi on public.listings
  for each row execute function public.socialni_mrezhi_data();

-- Четенето на `listings` е по колони. Гостите не виждат съгласието.
grant select (socialni_mrezhi, socialni_mrezhi_na) on public.listings to authenticated;
