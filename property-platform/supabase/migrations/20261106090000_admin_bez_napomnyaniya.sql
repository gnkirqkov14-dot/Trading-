-- Обявите на админ профила не остаряват: без напомняния по имейл, без
-- „Неактуална“ и без архивиране. Собственикът на сайта ги трие сам.
create or replace function public.process_listing_reminders(p_secret text)
returns table(listing_id uuid, owner_email text, owner_name text, listing_title text, stage smallint)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    where l.user_id = u.id and l.user_id = p.id
      and not p.is_admin
      and l.developer_id is null
      and l.status = 'active' and l.reminder_count = 0
      and l.last_confirmed_at <= now() - interval '7 days'
    returning l.id, u.email::text, p.name, l.title, 1::smallint;

  return query
    update public.listings l
    set reminder_count = 2, status = 'expired'
    from auth.users u, public.profiles p
    where l.user_id = u.id and l.user_id = p.id
      and not p.is_admin
      and l.developer_id is null
      and l.status in ('active', 'expired') and l.reminder_count = 1
      and l.last_confirmed_at <= now() - interval '14 days'
    returning l.id, u.email::text, p.name, l.title, 2::smallint;

  return query
    update public.listings l
    set reminder_count = 3, status = 'archived'
    from auth.users u, public.profiles p
    where l.user_id = u.id and l.user_id = p.id
      and not p.is_admin
      and l.developer_id is null
      and l.status in ('active', 'expired') and l.reminder_count = 2
      and l.last_confirmed_at <= now() - interval '21 days'
    returning l.id, u.email::text, p.name, l.title, 3::smallint;
end;
$function$;

-- Връща вече засегнатите обяви на админа: неактуалните и архивираните от
-- напомнянията стават пак активни, броячът се нулира. Скритите на ръка
-- (`inactive`) не се пипат.
update public.listings l
set status = 'active', reminder_count = 0, last_confirmed_at = now()
from public.profiles p
where l.user_id = p.id and p.is_admin
  and (l.reminder_count > 0 or l.status in ('expired', 'archived'))
  and l.status <> 'inactive';
