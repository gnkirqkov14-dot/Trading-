-- Одит №20: напомнянията вървят най-много по една стъпка на пускане.
--
-- Досега трите стъпки гледаха само преди колко дни е потвърдена обявата.
-- Ако задачата не е вървяла няколко дни (или обява е стара, а броячът ѝ е
-- 0), едно пускане я прекарваше през 1 -> 2 -> 3: три писма наведнъж и
-- обявата отива в архив без нито едно предупреждение.
--
-- Сега помним кога е пратено последното напомняне и следващата стъпка
-- идва най-рано 6 дни и половина след него. Пропуснатите дни отлагат
-- архивирането, вместо да го ускоряват.
alter table public.listings
  add column if not exists last_reminder_at timestamptz;

create or replace function public.process_listing_reminders(p_secret text)
returns table(listing_id uuid, owner_email text, owner_name text, listing_title text, stage smallint)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sega timestamptz := now();
  v_pauza interval := interval '6 days 12 hours';
begin
  if p_secret is null or not exists (
    select 1 from private.settings s
    where s.key = 'reminders_secret' and length(s.value) >= 32 and s.value = p_secret
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Отзад напред: обява, преместена в това пускане, не се хваща от
  -- следващата стъпка.
  return query
    update public.listings l
    set reminder_count = 3, status = 'archived', last_reminder_at = v_sega
    from auth.users u, public.profiles p
    where l.user_id = u.id and l.user_id = p.id
      and not p.is_admin
      and l.developer_id is null
      and l.status in ('active', 'expired') and l.reminder_count = 2
      and l.last_confirmed_at <= v_sega - interval '21 days'
      and (l.last_reminder_at is null or l.last_reminder_at <= v_sega - v_pauza)
    returning l.id, u.email::text, p.name, l.title, 3::smallint;

  return query
    update public.listings l
    set reminder_count = 2, status = 'expired', last_reminder_at = v_sega
    from auth.users u, public.profiles p
    where l.user_id = u.id and l.user_id = p.id
      and not p.is_admin
      and l.developer_id is null
      and l.status in ('active', 'expired') and l.reminder_count = 1
      and l.last_confirmed_at <= v_sega - interval '14 days'
      and (l.last_reminder_at is null or l.last_reminder_at <= v_sega - v_pauza)
    returning l.id, u.email::text, p.name, l.title, 2::smallint;

  return query
    update public.listings l
    set reminder_count = 1, last_reminder_at = v_sega
    from auth.users u, public.profiles p
    where l.user_id = u.id and l.user_id = p.id
      and not p.is_admin
      and l.developer_id is null
      and l.status = 'active' and l.reminder_count = 0
      and l.last_confirmed_at <= v_sega - interval '7 days'
    returning l.id, u.email::text, p.name, l.title, 1::smallint;
end;
$function$;
