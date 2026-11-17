/**
 * Съобщения от IMOT POINT до един потребител.
 *
 * Админът пише от профила на човека в админ панела („Хубаво е да качиш
 * снимки“). Човекът го вижда в „Моят профил“ и получава имейл от името на
 * сайта. Обикновените съобщения (таблица `messages`) са между двама души
 * за конкретна обява и не стават за това.
 */
create table if not exists public.admin_saobshteniya (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  ot uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  procheteno_na timestamptz
);

create index if not exists admin_saobshteniya_user_idx
  on public.admin_saobshteniya (user_id, created_at desc);

alter table public.admin_saobshteniya enable row level security;

drop policy if exists "chete svoite ili admin" on public.admin_saobshteniya;
create policy "chete svoite ili admin"
  on public.admin_saobshteniya for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "samo admin pishe" on public.admin_saobshteniya;
create policy "samo admin pishe"
  on public.admin_saobshteniya for insert
  to authenticated
  with check (public.is_admin() and ot = (select auth.uid()));

revoke all on public.admin_saobshteniya from anon;
revoke update, delete, truncate on public.admin_saobshteniya from authenticated;

/** Човекът е видял съобщенията си: отбелязват се като прочетени. */
create or replace function public.admin_saobshteniya_procheteni()
returns void
language sql
security definer
set search_path = public
as $$
  update public.admin_saobshteniya
     set procheteno_na = now()
   where user_id = auth.uid() and procheteno_na is null;
$$;

revoke all on function public.admin_saobshteniya_procheteni() from public, anon;
grant execute on function public.admin_saobshteniya_procheteni() to authenticated;
