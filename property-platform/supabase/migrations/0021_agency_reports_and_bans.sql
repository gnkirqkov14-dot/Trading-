-- Точки 4 и 5 от плана срещу агенции (виж CLAUDE.md):
--   4. "Докладвай като агенция" бутон на всяка обява (listing_reports).
--   5. Ban list по телефон И имейл — веднъж блокиран телефон/имейл не
--      може да се ползва повторно нито за регистрация, нито за нова обява.

-- ---------------------------------------------------------------------------
-- 4. listing_reports — потребителите сигнализират съмнителни обяви
-- ---------------------------------------------------------------------------

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reported_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, reported_by)
);

alter table public.listing_reports enable row level security;

drop policy if exists "Users can report a listing" on public.listing_reports;
create policy "Users can report a listing"
  on public.listing_reports for insert
  with check (auth.uid() = reported_by);

drop policy if exists "Users can see their own reports" on public.listing_reports;
create policy "Users can see their own reports"
  on public.listing_reports for select
  using (auth.uid() = reported_by);

drop policy if exists "Admins can view all reports" on public.listing_reports;
create policy "Admins can view all reports"
  on public.listing_reports for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- ---------------------------------------------------------------------------
-- 5. agency_bans — блокирани телефони/имейли (kind разделя двата типа,
--    защото match логиката е различна: имейл спира РЕГИСТРАЦИЯ, телефон
--    спира ПУБЛИКУВАНЕ на обява).
-- ---------------------------------------------------------------------------

create table if not exists public.agency_bans (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('phone', 'email')),
  value text not null,
  banned_by uuid references public.profiles (id) on delete set null,
  banned_at timestamptz not null default now(),
  unique (kind, value)
);

alter table public.agency_bans enable row level security;

drop policy if exists "Admins can view the ban list" on public.agency_bans;
create policy "Admins can view the ban list"
  on public.agency_bans for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Публично RPC — връща само true/false дали дадена стойност е в списъка,
-- НЕ разкрива самия списък (само admin вижда таблицата директно).
create or replace function public.is_contact_banned(p_phone text, p_email text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.agency_bans
    where (p_phone is not null and kind = 'phone' and value = p_phone)
       or (p_email is not null and kind = 'email' and value = p_email)
  );
$$;

grant execute on function public.is_contact_banned(text, text) to anon, authenticated;

-- Регистрацията също минава оттук (OAuth signup няма app-level проверка,
-- само през /register минава — тук е гаранцията и за двата пътя).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.agency_bans where kind = 'email' and value = new.email
  ) then
    raise exception 'Този имейл е блокиран за регистрация.';
  end if;

  insert into public.profiles (id, name, email)
  values (new.id, new.raw_user_meta_data ->> 'name', new.email);
  return new;
end;
$$;

-- admin_ban_agency() — еднократно действие от admin панела: блокира
-- телефона И имейла на собственика на обявата завинаги (unique constraint
-- прави повторно блокиране no-op), и деактивира всички обяви със същия
-- телефон или същия собственик, за да не се налага ръчно да ги трият една
-- по една. "Няма посочен телефон" (placeholder от 0009) изрично се
-- изключва, за да не блокираме случайно бъдещи обяви без телефон.
create or replace function public.admin_ban_agency(p_listing_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_phone text;
  v_user_id uuid;
  v_email text;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ) then
    raise exception 'not authorized';
  end if;

  select phone, user_id into v_phone, v_user_id
  from public.listings where id = p_listing_id;

  if v_user_id is null then
    raise exception 'listing not found';
  end if;

  select email into v_email from public.profiles where id = v_user_id;

  insert into public.agency_bans (kind, value, banned_by)
  select k.kind, k.value, auth.uid()
  from (values
    ('phone', nullif(v_phone, 'Няма посочен телефон')),
    ('email', v_email)
  ) as k(kind, value)
  where k.value is not null and k.value <> ''
  on conflict (kind, value) do nothing;

  update public.listings
  set status = 'inactive'
  where (phone = v_phone or user_id = v_user_id) and status <> 'inactive';
end;
$$;

grant execute on function public.admin_ban_agency(uuid) to authenticated;
