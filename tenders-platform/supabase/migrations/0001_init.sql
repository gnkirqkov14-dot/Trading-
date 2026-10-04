-- Обществени поръчки: схема на базата.
--
-- ⚠️ Безплатният план на Supabase позволява два проекта, а собственикът
-- вече има два (imotpoint и PHOMI склад). Затова поръчките живеят в
-- базата на imotpoint, но в ОТДЕЛНА схема `tenders`, която не е отворена
-- към API-то. Сайтът за поръчки ползва само публичния (publishable) ключ
-- и стига до данните единствено през функциите `public.tenders_*` по-долу.
-- Записът, абонатите и дневникът искат таен низ (`TENDERS_DB_SECRET`),
-- който е само в Vercel. Така сайтът за поръчки няма достъп до таблиците
-- на imotpoint, а imotpoint няма достъп до абонатите.
--
-- Пуска се с SQL Editor или `execute_sql`, НЕ като миграция на
-- property-platform: тамошният GitHub workflow прави `supabase db push`
-- и би се спънал в чужда версия в историята на миграциите.
-- Скриптът е идемпотентен — може да се пусне повторно.

create extension if not exists pg_trgm with schema extensions;

create schema if not exists tenders;
revoke all on schema tenders from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Таблици
-- ---------------------------------------------------------------------------

create table if not exists tenders.tenders (
  id bigint primary key,                 -- tenderId от ЦАИС ЕОП
  notice_id bigint,
  procurement_number text,               -- уникален номер на поръчката (УНП)
  title text not null,
  lot_number text,
  lot_title text,
  description text,
  notice_type text,
  procedure_type text,
  contract_type text,
  cpv_code text,
  cpv_label text,
  cpv_division text,                     -- първите 2 цифри на CPV = „бранш“
  buyer_name text not null,
  buyer_eik text,
  buyer_type text,
  buyer_activity text,
  buyer_locality text,
  region_code text,                      -- NUTS 3, напр. BG421 = Пловдив
  value_eur numeric(16, 2),
  deadline_at timestamptz,
  published_at timestamptz,
  eu_funded boolean not null default false,
  eu_program text,
  is_cancelled boolean not null default false,
  source_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    lower(
      coalesce(title, '') || ' ' ||
      coalesce(lot_title, '') || ' ' ||
      coalesce(buyer_name, '') || ' ' ||
      coalesce(cpv_label, '') || ' ' ||
      coalesce(buyer_locality, '')
    )
  ) stored
);

create index if not exists tenders_deadline_idx on tenders.tenders (deadline_at);
create index if not exists tenders_published_idx on tenders.tenders (published_at desc);
create index if not exists tenders_updated_idx on tenders.tenders (updated_at);
create index if not exists tenders_region_idx on tenders.tenders (region_code);
create index if not exists tenders_division_idx on tenders.tenders (cpv_division);
create index if not exists tenders_value_idx on tenders.tenders (value_eur);
create index if not exists tenders_search_trgm_idx
  on tenders.tenders using gin (search_text extensions.gin_trgm_ops);

create table if not exists tenders.import_runs (
  id bigint generated always as identity primary key,
  source_date date not null,
  status text not null,                  -- ok / missing / error
  rows_count integer not null default 0,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists tenders.alert_subscriptions (
  id bigint generated always as identity primary key,
  email text not null,
  q text,
  region_code text,
  cpv_division text,
  min_value numeric(16, 2),
  token text not null unique,
  status text not null default 'pending', -- pending / active / unsubscribed
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  last_sent_at timestamptz
);

create index if not exists alert_subscriptions_status_idx
  on tenders.alert_subscriptions (status);

-- Тайният низ на сайта. Попълва се веднъж отделно (виж docs/РЪЧНИ-СТЪПКИ.md).
create table if not exists tenders.config (
  key text primary key,
  value text not null
);

alter table tenders.tenders enable row level security;
alter table tenders.import_runs enable row level security;
alter table tenders.alert_subscriptions enable row level security;
alter table tenders.config enable row level security;

-- updated_at се мести само при реална промяна, за да не праща известията
-- по втори път. search_text е генерирана колона и в BEFORE тригер още е
-- празна, затова сравняваме без нея и без двете служебни дати.
create or replace function tenders.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'created_at' - 'search_text')
     is distinct from
     (to_jsonb(old) - 'updated_at' - 'created_at' - 'search_text') then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists tenders_touch_updated_at on tenders.tenders;
create trigger tenders_touch_updated_at
  before update on tenders.tenders
  for each row execute function tenders.touch_updated_at();

create or replace function tenders.check_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or not exists (
    select 1 from tenders.config where key = 'app_secret' and value = p_secret
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke all on function tenders.check_secret(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Публични функции за четене (данните са CC0, тайна не се иска)
-- ---------------------------------------------------------------------------

create or replace function public.tenders_search(
  p_q text default null,
  p_region text default null,
  p_category text default null,
  p_min numeric default null,
  p_max numeric default null,
  p_open_only boolean default true,
  p_updated_since timestamptz default null,
  p_sort text default 'deadline',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_words text[];
  v_result jsonb;
begin
  v_words := array_remove(
    regexp_split_to_array(lower(btrim(coalesce(p_q, ''))), '\s+'), ''
  );

  with filtered as (
    select t.*
    from tenders.tenders t
    where (not coalesce(p_open_only, true)
           or (t.deadline_at >= now() and not t.is_cancelled))
      and (p_region is null or t.region_code = p_region)
      and (p_category is null or t.cpv_division = p_category)
      and (p_min is null or t.value_eur >= p_min)
      and (p_max is null or t.value_eur <= p_max)
      and (p_updated_since is null or t.updated_at > p_updated_since)
      and (
        coalesce(array_length(v_words, 1), 0) = 0
        or not exists (
          select 1 from unnest(v_words) w
          where position(w in t.search_text) = 0
        )
      )
  ),
  page as (
    select f.*
    from filtered f
    order by
      case when p_sort = 'value' then f.value_eur end desc nulls last,
      case when p_sort = 'newest' then f.published_at end desc nulls last,
      case when coalesce(p_sort, 'deadline') not in ('value', 'newest') then f.deadline_at end asc nulls last,
      f.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce(
      (select jsonb_agg(to_jsonb(p) - 'search_text' - 'created_at') from page p),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.tenders_get(p_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(t) - 'search_text' - 'created_at'
  from tenders.tenders t
  where t.id = p_id;
$$;

create or replace function public.tenders_recent_ids(p_limit integer default 5000)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'updated_at', x.updated_at)), '[]'::jsonb)
  from (
    select id, updated_at
    from tenders.tenders
    order by published_at desc nulls last
    limit least(greatest(coalesce(p_limit, 5000), 1), 50000)
  ) x;
$$;

create or replace function public.tenders_last_import()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select max(source_date) from tenders.import_runs where status = 'ok';
$$;

-- ---------------------------------------------------------------------------
-- Функции за запис и за абонатите (искат тайния низ)
-- ---------------------------------------------------------------------------

create or replace function public.tenders_upsert(p_secret text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform tenders.check_secret(p_secret);

  insert into tenders.tenders as t (
    id, notice_id, procurement_number, title, lot_number, lot_title, description,
    notice_type, procedure_type, contract_type, cpv_code, cpv_label, cpv_division,
    buyer_name, buyer_eik, buyer_type, buyer_activity, buyer_locality, region_code,
    value_eur, deadline_at, published_at, eu_funded, eu_program, is_cancelled, source_date
  )
  select
    x.id, x.notice_id, x.procurement_number, x.title, x.lot_number, x.lot_title, x.description,
    x.notice_type, x.procedure_type, x.contract_type, x.cpv_code, x.cpv_label, x.cpv_division,
    x.buyer_name, x.buyer_eik, x.buyer_type, x.buyer_activity, x.buyer_locality, x.region_code,
    x.value_eur, x.deadline_at, x.published_at, coalesce(x.eu_funded, false), x.eu_program,
    coalesce(x.is_cancelled, false), x.source_date
  from jsonb_to_recordset(p_rows) as x(
    id bigint, notice_id bigint, procurement_number text, title text, lot_number text,
    lot_title text, description text, notice_type text, procedure_type text,
    contract_type text, cpv_code text, cpv_label text, cpv_division text,
    buyer_name text, buyer_eik text, buyer_type text, buyer_activity text,
    buyer_locality text, region_code text, value_eur numeric, deadline_at timestamptz,
    published_at timestamptz, eu_funded boolean, eu_program text, is_cancelled boolean,
    source_date date
  )
  on conflict (id) do update set
    notice_id = excluded.notice_id,
    procurement_number = excluded.procurement_number,
    title = excluded.title,
    lot_number = excluded.lot_number,
    lot_title = excluded.lot_title,
    description = excluded.description,
    notice_type = excluded.notice_type,
    procedure_type = excluded.procedure_type,
    contract_type = excluded.contract_type,
    cpv_code = excluded.cpv_code,
    cpv_label = excluded.cpv_label,
    cpv_division = excluded.cpv_division,
    buyer_name = excluded.buyer_name,
    buyer_eik = excluded.buyer_eik,
    buyer_type = excluded.buyer_type,
    buyer_activity = excluded.buyer_activity,
    buyer_locality = excluded.buyer_locality,
    region_code = excluded.region_code,
    value_eur = excluded.value_eur,
    deadline_at = excluded.deadline_at,
    published_at = excluded.published_at,
    eu_funded = excluded.eu_funded,
    eu_program = excluded.eu_program,
    is_cancelled = excluded.is_cancelled,
    source_date = excluded.source_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.tenders_record_import(
  p_secret text, p_date date, p_status text, p_rows integer, p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  insert into tenders.import_runs (source_date, status, rows_count, message)
  values (p_date, p_status, coalesce(p_rows, 0), p_message);
end;
$$;

create or replace function public.tenders_alert_create(
  p_secret text, p_email text, p_q text, p_region text, p_category text,
  p_min numeric, p_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  insert into tenders.alert_subscriptions (email, q, region_code, cpv_division, min_value, token)
  values (p_email, p_q, p_region, p_category, p_min, p_token);
end;
$$;

create or replace function public.tenders_alert_by_token(p_secret text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform tenders.check_secret(p_secret);
  select to_jsonb(s) into v from tenders.alert_subscriptions s where s.token = p_token;
  return v;
end;
$$;

create or replace function public.tenders_alert_set_status(
  p_secret text, p_token text, p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  if p_status not in ('pending', 'active', 'unsubscribed') then
    raise exception 'bad status';
  end if;
  update tenders.alert_subscriptions
  set status = p_status,
      confirmed_at = case when p_status = 'active' then now() else confirmed_at end
  where token = p_token;
end;
$$;

create or replace function public.tenders_alert_active(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform tenders.check_secret(p_secret);
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v
  from tenders.alert_subscriptions s
  where s.status = 'active';
  return v;
end;
$$;

create or replace function public.tenders_alert_mark_sent(
  p_secret text, p_id bigint, p_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  update tenders.alert_subscriptions set last_sent_at = p_at where id = p_id;
end;
$$;

-- Само анонимната и логнатата роля на API-то могат да викат функциите.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.tenders_search(text,text,text,numeric,numeric,boolean,timestamptz,text,integer,integer)',
    'public.tenders_get(bigint)',
    'public.tenders_recent_ids(integer)',
    'public.tenders_last_import()',
    'public.tenders_upsert(text,jsonb)',
    'public.tenders_record_import(text,date,text,integer,text)',
    'public.tenders_alert_create(text,text,text,text,text,numeric,text)',
    'public.tenders_alert_by_token(text,text)',
    'public.tenders_alert_set_status(text,text,text)',
    'public.tenders_alert_active(text)',
    'public.tenders_alert_mark_sent(text,bigint,timestamptz)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end;
$$;
