-- Ограничение на броя обяви на един профил — собственикът поиска да
-- спрем акаунти да качват безброй обяви (типично поведение на агенция
-- или строителна фирма, представяща се за личен продавач). По
-- подразбиране всеки нов потребител може да има до 3 обяви общо; ако му
-- трябват повече (напр. наистина е строителна фирма с няколко имота),
-- пише на admin-а, който вдига лимита ръчно от admin панела.

alter table public.profiles add column if not exists listing_limit integer not null default 3;

-- listing_limit не е чувствителна информация (просто число) — вижте
-- 0020_admin_listing_insights.sql за защото на profiles.email по същия
-- начин чрез column-level grants; тук просто добавяме новата колона към
-- вече публично четимия набор.
grant select (listing_limit) on public.profiles to anon, authenticated;

-- Само admin може да го променя — колоната умишлено НЕ е в UPDATE gran-а
-- от 0010_lock_profile_columns.sql (само name/phone са), затова единственият
-- път е тази SECURITY DEFINER функция, която сама проверява is_admin.
create or replace function public.admin_set_listing_limit(target_user_id uuid, new_limit integer)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ) then
    raise exception 'not authorized';
  end if;

  if new_limit < 0 then
    raise exception 'invalid limit';
  end if;

  update public.profiles set listing_limit = new_limit where id = target_user_id;
end;
$$;

grant execute on function public.admin_set_listing_limit(uuid, integer) to authenticated;
