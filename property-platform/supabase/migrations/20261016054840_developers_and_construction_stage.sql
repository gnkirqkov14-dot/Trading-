-- Обяви от строителни фирми ("ново строителство").
--
-- Не е отделна таблица с обяви: фирмената обява е същото нещо като личната
-- — град, квартал, цена, квадратура, снимки — само че я качва екипът, а не
-- собственикът. Отделна таблица би удвоила картите, филтрите, страницата на
-- обявата и търсенето. Затова тук се добавят само разликите.
--
-- Разрешението на фирмата се пази на самия ред (кога и как е дадено), по
-- същата причина както при контактите: при спор тежестта да го докажеш е
-- твоя.

create table if not exists public.developers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- Телефонът и имейлът са НА ФИРМАТА и се показват в обявата вместо
  -- тези на профила, който я е качил.
  phone text not null,
  email text,
  website text,
  logo_url text,
  permission_at timestamptz,
  permission_note text,
  created_at timestamptz not null default now()
);

alter table public.listings
  add column if not exists developer_id uuid references public.developers(id) on delete set null,
  add column if not exists project_name text,
  -- Етапът е смисълът на цялата секция: човек купува различно на
  -- "в строеж" и на "Акт 16".
  add column if not exists construction_stage text
    check (construction_stage in ('planned','building','act14','act15','act16'));

create index if not exists listings_developer_idx
  on public.listings (developer_id) where developer_id is not null;

-- 1. Телефонът на фирмената обява не се пипа от профила на този, който я
--    е качил. Иначе една смяна на личния телефон пренасочва обажданията
--    за всички обекти към екипа вместо към строителя.
create or replace function public.sync_listings_phone()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.phone is distinct from old.phone and new.phone is not null and new.phone <> '' then
    update public.listings
       set phone = new.phone
     where user_id = new.id
       and developer_id is null;
  end if;
  return new;
end;
$function$;

-- 2. Напомнянията подминават фирмените обяви. Строителят не е длъжен да
--    потвърждава през седмица, а обект в строеж не бива да се архивира
--    сам след 21 дни.
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
      and l.developer_id is null
      and l.status = 'active' and l.reminder_count = 0
      and l.last_confirmed_at <= now() - interval '7 days'
    returning l.id, u.email::text, p.name, l.title, 1::smallint;

  return query
    update public.listings l
    set reminder_count = 2, status = 'expired'
    from auth.users u, public.profiles p
    where l.user_id = u.id and l.user_id = p.id
      and l.developer_id is null
      and l.status in ('active', 'expired') and l.reminder_count = 1
      and l.last_confirmed_at <= now() - interval '14 days'
    returning l.id, u.email::text, p.name, l.title, 2::smallint;

  return query
    update public.listings l
    set reminder_count = 3, status = 'archived'
    from auth.users u, public.profiles p
    where l.user_id = u.id and l.user_id = p.id
      and l.developer_id is null
      and l.status in ('active', 'expired') and l.reminder_count = 2
      and l.last_confirmed_at <= now() - interval '21 days'
    returning l.id, u.email::text, p.name, l.title, 3::smallint;
end;
$function$;

-- 3. Фирмените обяви не се броят срещу личния лимит от 3.
create or replace function public.own_listing_count(target uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::integer from public.listings
   where user_id = target and developer_id is null;
$function$;

alter table public.developers enable row level security;

-- Фирмите са публични: показват се в обявата и в секцията.
drop policy if exists "developers_public_read" on public.developers;
create policy "developers_public_read" on public.developers for select using (true);

drop policy if exists "developers_admin_write" on public.developers;
create policy "developers_admin_write" on public.developers
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on function public.own_listing_count(uuid) from public;
grant execute on function public.own_listing_count(uuid) to authenticated;
