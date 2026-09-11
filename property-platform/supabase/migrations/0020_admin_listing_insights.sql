-- Админ панелът трябва да показва повече контекст за всяка обява: кога е
-- качена (created_at вече съществува), от кого (name/phone вече се
-- показват в admin-listings-table.tsx), имейл на собственика, брой
-- гледания, и история на редакциите (кога/какво точно е сменено).
--
--   1. profiles.email — синхронизиран от auth.users; НЕ е публична колона
--      (за разлика от name/phone) — скрита от anon/authenticated чрез
--      column-level grant, четима само през admin_get_profile_emails().
--   2. listings.view_count + listings.updated_at.
--   3. listing_edit_log — одит таблица, пълнена автоматично от тригер.
--   4. increment_listing_view() и admin_get_profile_emails() RPC-та.

-- ---------------------------------------------------------------------------
-- 1. profiles.email
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists email text;

update public.profiles p
  set email = u.email
  from auth.users u
  where p.id = u.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, new.raw_user_meta_data ->> 'name', new.email);
  return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- RLS работи на ниво РЕД, не колона — политиката "viewable by everyone"
-- пуска цели редове, включително нови колони. Имейлът не бива да е
-- публично четим (нито дори за собствения ред през обикновения клиент),
-- затова тук стесняваме на ниво колона кои полета изобщо могат да се
-- SELECT-нат от anon/authenticated. Единственият път до email е
-- admin_get_profile_emails() по-долу, която сама проверява is_admin.
revoke select on public.profiles from anon, authenticated;
grant select (
  id, name, phone, subscription_plan, subscription_expires_at, is_admin, created_at
) on public.profiles to anon, authenticated;

create or replace function public.admin_get_profile_emails(profile_ids uuid[])
returns table(id uuid, email text)
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ) then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, p.email from public.profiles p where p.id = any(profile_ids);
end;
$$;

grant execute on function public.admin_get_profile_emails(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. listings.view_count + updated_at
-- ---------------------------------------------------------------------------

alter table public.listings add column if not exists view_count integer not null default 0;
alter table public.listings add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 3. listing_edit_log — одит на редакции (от собственика или от admin)
-- ---------------------------------------------------------------------------

create table if not exists public.listing_edit_log (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_fields jsonb not null,
  changed_at timestamptz not null default now()
);

create index if not exists listing_edit_log_listing_idx
  on public.listing_edit_log (listing_id, changed_at desc);

alter table public.listing_edit_log enable row level security;

drop policy if exists "Admins can view the edit log" on public.listing_edit_log;
create policy "Admins can view the edit log"
  on public.listing_edit_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- view_count се сменя от всеки посетител и не е "редакция" в смисъла,
-- който собственикът/админът разбират като такава — изрично изключена
-- от tracked масива по-долу, иначе логът щеше да се пълни само с
-- "view_count: X -> X+1" при всяко отваряне на обявата.
create or replace function public.log_listing_edit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  diff jsonb := '{}'::jsonb;
  tracked text[] := array[
    'type', 'property_type', 'city_id', 'neighborhood_id', 'lat', 'lng',
    'price', 'area_sqm', 'rooms', 'floor', 'year_built', 'heating',
    'has_parking', 'has_elevator', 'has_terrace', 'is_furnished',
    'title', 'description', 'address', 'phone', 'status'
  ];
  field text;
  old_val jsonb;
  new_val jsonb;
begin
  foreach field in array tracked loop
    old_val := to_jsonb(OLD) -> field;
    new_val := to_jsonb(NEW) -> field;
    if old_val is distinct from new_val then
      diff := diff || jsonb_build_object(field, jsonb_build_object('old', old_val, 'new', new_val));
    end if;
  end loop;

  if diff <> '{}'::jsonb then
    insert into public.listing_edit_log (listing_id, changed_by, changed_fields)
    values (NEW.id, auth.uid(), diff);
    NEW.updated_at := now();
  end if;

  return NEW;
end;
$$;

drop trigger if exists on_listing_updated on public.listings;
create trigger on_listing_updated
  before update on public.listings
  for each row execute function public.log_listing_edit();

-- ---------------------------------------------------------------------------
-- 4. increment_listing_view() — публично RPC (посетителите не са
--    собственици, затова заобикаля owner-only update политиката чрез
--    SECURITY DEFINER). Тригерът по-горе не логва промяната, защото
--    view_count умишлено не е в tracked масива.
-- ---------------------------------------------------------------------------

create or replace function public.increment_listing_view(p_listing_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.listings set view_count = view_count + 1 where id = p_listing_id;
$$;

grant execute on function public.increment_listing_view(uuid) to anon, authenticated;
