-- Property Platform — заключва process_listing_reminders() зад таен низ.
--
-- До тук функцията (0013) беше security definer с grant към anon, без
-- никаква проверка: всеки с публичния ключ можеше да я извика през
-- /rest/v1/rpc/process_listing_reminders, да получи имейлите на
-- собствениците и да придвижи напомнянията им напред.
--
-- Cron-ът (app/api/cron/expire-listings/route.ts) ползва същия публичен
-- ключ (няма service_role в Vercel), затова защитата е таен низ:
-- REMINDERS_DB_SECRET във Vercel и същата стойност в
-- private.settings (key = 'reminders_secret'). Схемата private не е
-- отворена към API-то и anon/authenticated нямат права в нея.
-- Стойността НЕ е в този файл — въвежда се ръчно (виж docs/РЪЧНИ-СТЪПКИ.md).
-- Без ред в private.settings функцията отказва на всички (fail closed).
--
-- Идемпотентна: пусната е ръчно преди merge, после пак от CI (db push).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.settings (
  key text primary key,
  value text not null
);
revoke all on table private.settings from public, anon, authenticated;

drop function if exists public.process_listing_reminders();

create or replace function public.process_listing_reminders(p_secret text)
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
  if p_secret is null or not exists (
    select 1 from private.settings s
    where s.key = 'reminders_secret' and length(s.value) >= 32 and s.value = p_secret
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    update public.listings l
    set reminder_count = 1
    from auth.users u, public.profiles p
    where l.user_id = u.id
      and l.user_id = p.id
      and l.status = 'active'
      and l.reminder_count = 0
      and l.last_confirmed_at <= now() - interval '7 days'
    returning l.id, u.email::text, p.name, l.title, 1::smallint;

  return query
    update public.listings l
    set reminder_count = 2, status = 'expired'
    from auth.users u, public.profiles p
    where l.user_id = u.id
      and l.user_id = p.id
      and l.status in ('active', 'expired')
      and l.reminder_count = 1
      and l.last_confirmed_at <= now() - interval '14 days'
    returning l.id, u.email::text, p.name, l.title, 2::smallint;

  return query
    update public.listings l
    set reminder_count = 3, status = 'archived'
    from auth.users u, public.profiles p
    where l.user_id = u.id
      and l.user_id = p.id
      and l.status in ('active', 'expired')
      and l.reminder_count = 2
      and l.last_confirmed_at <= now() - interval '21 days'
    returning l.id, u.email::text, p.name, l.title, 3::smallint;
end;
$$;

revoke all on function public.process_listing_reminders(text) from public;
grant execute on function public.process_listing_reminders(text) to anon, authenticated;
