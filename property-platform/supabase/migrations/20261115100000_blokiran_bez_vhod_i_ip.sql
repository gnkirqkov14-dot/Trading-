/**
 * Блокираната агенция вече не може и да влиза в профила си, а адресът
 * (IP), от който е ползвала сайта, се спира за 90 дни.
 *
 * Досега „Блокирай агенция“ спираше само публикуването: човекът влизаше
 * в стария си профил и продължаваше да разглежда телефоните на
 * собствениците.
 *
 * Адресите се пазят в схема `private`, която не се вижда през API-то.
 * Адрес, ползван и от админ или от поне трима други души (мобилна мрежа,
 * офис), не се спира, за да не пострадат невинни.
 */

create table if not exists private.potrebitel_ip (
  user_id uuid not null references auth.users (id) on delete cascade,
  ip text not null,
  posledno timestamptz not null default now(),
  primary key (user_id, ip)
);
create index if not exists potrebitel_ip_ip_idx on private.potrebitel_ip (ip);
alter table private.potrebitel_ip enable row level security;

create table if not exists private.blokirani_ip (
  ip text primary key,
  koga timestamptz not null default now(),
  do_koga timestamptz not null
);
alter table private.blokirani_ip enable row level security;

/** Общ ли е адресът: на админ или на поне трима други неблокирани. */
create or replace function private.ip_e_obsht(p_ip text, p_bez uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from private.potrebitel_ip i
    join public.profiles p on p.id = i.user_id
    where i.ip = p_ip and p.is_admin = true
  ) or (
    select count(distinct i.user_id)
    from private.potrebitel_ip i
    join auth.users u on u.id = i.user_id
    where i.ip = p_ip
      and u.banned_until is null
      and (p_bez is null or i.user_id <> p_bez)
  ) >= 3;
$$;

/** Сървърът записва от кой адрес е влязъл или публикувал потребителят. */
create or replace function public.zapishi_ip_srv(
  p_secret text, p_user uuid, p_ip text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (
    select value from private.settings where key = 'reminders_secret'
  ) then
    raise exception 'forbidden';
  end if;
  if p_user is null or p_ip is null or btrim(p_ip) = '' or length(p_ip) > 45 then
    return;
  end if;

  insert into private.potrebitel_ip (user_id, ip)
  values (p_user, btrim(p_ip))
  on conflict (user_id, ip) do update set posledno = now();

  delete from private.potrebitel_ip where posledno < now() - interval '90 days';
  delete from private.blokirani_ip where do_koga < now();
end;
$$;

/** Блокиран човек е опитал да влезе или да се регистрира от този адрес. */
create or replace function public.blokiray_ip_srv(p_secret text, p_ip text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (
    select value from private.settings where key = 'reminders_secret'
  ) then
    raise exception 'forbidden';
  end if;
  if p_ip is null or btrim(p_ip) = '' or length(p_ip) > 45
     or private.ip_e_obsht(btrim(p_ip), null) then
    return;
  end if;

  insert into private.blokirani_ip (ip, do_koga)
  values (btrim(p_ip), now() + interval '90 days')
  on conflict (ip) do update set do_koga = excluded.do_koga;
end;
$$;

/** Списъкът със спрени адреси, който пазачът на сайта (proxy.ts) чете. */
create or replace function public.blokirani_ip_srv(p_secret text)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (
    select value from private.settings where key = 'reminders_secret'
  ) then
    raise exception 'forbidden';
  end if;
  return coalesce(
    (select array_agg(ip) from private.blokirani_ip where do_koga > now()),
    '{}'
  );
end;
$$;

revoke all on function private.ip_e_obsht(text, uuid) from public;
revoke all on function public.zapishi_ip_srv(text, uuid, text) from public;
revoke all on function public.blokiray_ip_srv(text, text) from public;
revoke all on function public.blokirani_ip_srv(text) from public;
grant execute on function public.zapishi_ip_srv(text, uuid, text) to anon, authenticated;
grant execute on function public.blokiray_ip_srv(text, text) to anon, authenticated;
grant execute on function public.blokirani_ip_srv(text) to anon, authenticated;

/**
 * Както досега: блокира телефона и имейла и сваля обявите. Ново: спира
 * входа в профила, изхвърля го от сайта и спира адресите му.
 *
 * Внесените обяви се водят на админ. Там се блокира само телефонът —
 * иначе бутонът би заключил самия админ.
 */
create or replace function public.admin_ban_agency(p_listing_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_phone text;
  v_user_id uuid;
  v_email text;
  v_e_admin boolean;
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

  select email, coalesce(is_admin, false) into v_email, v_e_admin
  from public.profiles where id = v_user_id;
  v_e_admin := coalesce(v_e_admin, false);

  insert into public.agency_bans (kind, value, banned_by)
  select k.kind, k.value, auth.uid()
  from (values
    ('phone', nullif(v_phone, 'Няма посочен телефон')),
    ('email', case when v_e_admin then null else v_email end)
  ) as k(kind, value)
  where k.value is not null and k.value <> ''
  on conflict (kind, value) do nothing;

  update public.listings
  set status = 'inactive'
  where (phone = v_phone or (user_id = v_user_id and not v_e_admin))
    and status <> 'inactive';

  if not v_e_admin then
    update auth.users
    set banned_until = now() + interval '100 years'
    where id = v_user_id;

    delete from auth.sessions where user_id = v_user_id;

    insert into private.blokirani_ip (ip, do_koga)
    select i.ip, now() + interval '90 days'
    from private.potrebitel_ip i
    where i.user_id = v_user_id
      and not private.ip_e_obsht(i.ip, v_user_id)
    on conflict (ip) do update set do_koga = excluded.do_koga;
  end if;
end;
$$;

grant execute on function public.admin_ban_agency(uuid) to authenticated;

-- Вече блокираните преди тази промяна: спира им се входът.
update auth.users u
set banned_until = now() + interval '100 years'
from public.profiles p
join public.agency_bans b on b.kind = 'email' and b.value = p.email
where u.id = p.id and coalesce(p.is_admin, false) = false;

delete from auth.sessions s
using public.profiles p, public.agency_bans b
where s.user_id = p.id
  and b.kind = 'email' and b.value = p.email
  and coalesce(p.is_admin, false) = false;
