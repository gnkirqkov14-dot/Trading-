-- Property Platform — 3-степенна схема за напомняния при обява.
--
-- Замества еднократния "expire след 7 дни" механизъм (0006) с:
--   ден 7  -> 1-во напомняне (имейл + банер в сайта), обявата остава active
--   ден 14 -> 2-ро напомняне, обявата минава в 'expired' (сдйнка в резултатите)
--   ден 21 -> обявата минава в 'archived' (скрита от публичния сайт, RLS-ът
--             от 0003 вече крие всичко освен 'active'/'expired')
--
-- reminder_count пази на кой етап сме, за да не пращаме едно и също
-- напомняне повторно всеки ден, докато cron-ът тръгва. Нулира се на 0
-- всеки път, когато собственикът потвърди/активира обявата отново
-- (виж setListingStatus/confirmListingActive в lib/actions/listings.ts).

alter table public.listings add column reminder_count smallint not null default 0;

drop function if exists public.expire_stale_listings();

create function public.process_listing_reminders()
returns table (
  listing_id uuid,
  owner_email text,
  owner_name text,
  listing_title text,
  stage smallint
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
    update public.listings l
    set reminder_count = 1
    from auth.users u, public.profiles p
    where l.user_id = u.id
      and l.user_id = p.id
      and l.status = 'active'
      and l.reminder_count = 0
      and l.last_confirmed_at <= now() - interval '7 days'
    returning l.id, u.email, p.name, l.title, 1::smallint;

  return query
    update public.listings l
    set reminder_count = 2, status = 'expired'
    from auth.users u, public.profiles p
    where l.user_id = u.id
      and l.user_id = p.id
      and l.status in ('active', 'expired')
      and l.reminder_count = 1
      and l.last_confirmed_at <= now() - interval '14 days'
    returning l.id, u.email, p.name, l.title, 2::smallint;

  return query
    update public.listings l
    set reminder_count = 3, status = 'archived'
    from auth.users u, public.profiles p
    where l.user_id = u.id
      and l.user_id = p.id
      and l.status in ('active', 'expired')
      and l.reminder_count = 2
      and l.last_confirmed_at <= now() - interval '21 days'
    returning l.id, u.email, p.name, l.title, 3::smallint;
end;
$$;

grant execute on function public.process_listing_reminders() to anon, authenticated;
