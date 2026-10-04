-- Европейски и национални програми за безвъзмездна помощ (грантове).
--
-- Три вида записи в една таблица:
--   open        — отворена процедура в ИСУН (eumis2020.government.bg), с точен срок;
--   discussion  — проект на процедура на обществено обсъждане (предстои);
--   planned     — ред от индикативна годишна работна програма (ИГРП) на
--                 програмата: планиран месец на обявяване, бюджет, кой може да
--                 кандидатства, размер на помощта.
-- Полетата от „обява“ и ИГРП (бюджет, допустими кандидати, размер) ги вади
-- AI от PDF-а (lib/grants/enrich.ts); останалото е от самите страници.
--
-- Пуска се като 0001/0002: на части през execute_sql, не като миграция на
-- imotpoint. Идемпотентна.

create table if not exists tenders.grant_calls (
  id text primary key,
  kind text not null check (kind in ('open', 'discussion', 'planned')),
  source text not null,
  code text,
  title text not null,
  programme text,
  url text,
  doc_url text,
  opens_at date,
  deadline_at timestamptz,
  summary text,
  applicants text,
  applicant_types text[] not null default '{}',
  for_business boolean,
  budget_eur numeric,
  grant_min_eur numeric,
  grant_max_eur numeric,
  max_aid_pct numeric,
  activities text,
  costs text,
  prepare text,
  source_hash text,
  enriched_at timestamptz,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists grant_calls_active_idx on tenders.grant_calls (is_active, kind);
revoke all on table tenders.grant_calls from public, anon, authenticated;

-- Кои PDF-и на ИГРП вече са прочетени — за да не плащаме AI за същия файл.
create table if not exists tenders.grant_sources (
  id text primary key,
  programme text,
  page_url text,
  pdf_url text,
  processed_at timestamptz,
  rows_count integer,
  message text
);
revoke all on table tenders.grant_sources from public, anon, authenticated;

-- Какво вече знаем: id, хеш на източника и дали е обогатен.
create or replace function public.tenders_grants_known(p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'source_hash', g.source_hash, 'enriched', g.enriched_at is not null))
      from tenders.grant_calls g
     where g.kind in ('open', 'discussion')
  ), '[]'::jsonb);
end;
$$;

-- Записва редове. Полета, които не са подадени (null), не трият вече
-- извлечените от AI стойности — така ежедневното опресняване на срока не
-- губи бюджета и кандидатите от по-ранно обогатяване.
create or replace function public.tenders_grants_upsert(p_secret text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform tenders.check_secret(p_secret);
  insert into tenders.grant_calls as g (
    id, kind, source, code, title, programme, url, doc_url, opens_at, deadline_at,
    summary, applicants, applicant_types, for_business, budget_eur, grant_min_eur,
    grant_max_eur, max_aid_pct, activities, costs, prepare, source_hash, enriched_at,
    is_active, last_seen_at, updated_at
  )
  select r.id, r.kind, r.source, r.code, r.title, r.programme, r.url, r.doc_url,
         r.opens_at, r.deadline_at, r.summary, r.applicants,
         coalesce(r.applicant_types, '{}'), r.for_business, r.budget_eur,
         r.grant_min_eur, r.grant_max_eur, r.max_aid_pct, r.activities, r.costs,
         r.prepare, r.source_hash, r.enriched_at, true, now(), now()
    from jsonb_to_recordset(p_rows) as r(
      id text, kind text, source text, code text, title text, programme text,
      url text, doc_url text, opens_at date, deadline_at timestamptz, summary text,
      applicants text, applicant_types text[], for_business boolean,
      budget_eur numeric, grant_min_eur numeric, grant_max_eur numeric,
      max_aid_pct numeric, activities text, costs text, prepare text,
      source_hash text, enriched_at timestamptz)
  on conflict (id) do update set
    kind = excluded.kind,
    source = excluded.source,
    code = coalesce(excluded.code, g.code),
    title = excluded.title,
    programme = coalesce(excluded.programme, g.programme),
    url = coalesce(excluded.url, g.url),
    doc_url = coalesce(excluded.doc_url, g.doc_url),
    opens_at = coalesce(excluded.opens_at, g.opens_at),
    deadline_at = coalesce(excluded.deadline_at, g.deadline_at),
    summary = coalesce(excluded.summary, g.summary),
    applicants = coalesce(excluded.applicants, g.applicants),
    applicant_types = case when cardinality(excluded.applicant_types) > 0
                           then excluded.applicant_types else g.applicant_types end,
    for_business = coalesce(excluded.for_business, g.for_business),
    budget_eur = coalesce(excluded.budget_eur, g.budget_eur),
    grant_min_eur = coalesce(excluded.grant_min_eur, g.grant_min_eur),
    grant_max_eur = coalesce(excluded.grant_max_eur, g.grant_max_eur),
    max_aid_pct = coalesce(excluded.max_aid_pct, g.max_aid_pct),
    activities = coalesce(excluded.activities, g.activities),
    costs = coalesce(excluded.costs, g.costs),
    prepare = coalesce(excluded.prepare, g.prepare),
    source_hash = coalesce(excluded.source_hash, g.source_hash),
    enriched_at = coalesce(excluded.enriched_at, g.enriched_at),
    is_active = true,
    last_seen_at = now(),
    updated_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Процедури от ИСУН, които не се появиха при този обход, вече не са
-- отворени (приключили или оттеглени).
create or replace function public.tenders_grants_deactivate(p_secret text, p_seen_before timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform tenders.check_secret(p_secret);
  update tenders.grant_calls
     set is_active = false, updated_at = now()
   where kind in ('open', 'discussion') and is_active and last_seen_at < p_seen_before;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Заменя плана на една програма с новопрочетения от ИГРП.
create or replace function public.tenders_grants_replace_planned(
  p_secret text, p_source text, p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  -- Старият план на програмата се скрива; редовете от новия го заместват
  -- (същите id се връщат активни при upsert).
  update tenders.grant_calls
     set is_active = false, updated_at = now()
   where kind = 'planned' and source = p_source;
  return public.tenders_grants_upsert(p_secret, p_rows);
end;
$$;

create or replace function public.tenders_grant_source_get(p_secret text, p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  return (select to_jsonb(s) from tenders.grant_sources s where s.id = p_id);
end;
$$;

create or replace function public.tenders_grant_source_set(
  p_secret text, p_id text, p_programme text, p_page_url text, p_pdf_url text,
  p_rows integer, p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  insert into tenders.grant_sources as s (id, programme, page_url, pdf_url, processed_at, rows_count, message)
  values (p_id, p_programme, p_page_url, p_pdf_url, now(), p_rows, p_message)
  on conflict (id) do update set
    programme = excluded.programme, page_url = excluded.page_url,
    pdf_url = excluded.pdf_url, processed_at = now(),
    rows_count = excluded.rows_count, message = excluded.message;
end;
$$;

-- Публично четене (данните са от държавни сайтове): активните процедури,
-- които още имат смисъл — отворени със срок напред, на обсъждане, или
-- планирани за текущия месец и по-нататък.
create or replace function public.tenders_grants_list(p_business_only boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(g) - 'source_hash' - 'created_at' - 'last_seen_at'
                            order by g.kind, coalesce(g.deadline_at, g.opens_at::timestamptz)), '[]'::jsonb)
    from tenders.grant_calls g
   where g.is_active
     and (not coalesce(p_business_only, false) or coalesce(g.for_business, false))
     and (
       (g.kind = 'open' and (g.deadline_at is null or g.deadline_at >= now()))
       or g.kind = 'discussion'
       or (g.kind = 'planned' and g.opens_at >= date_trunc('month', now())::date)
     );
$$;

revoke all on function public.tenders_grants_known(text) from public;
revoke all on function public.tenders_grants_upsert(text, jsonb) from public;
revoke all on function public.tenders_grants_deactivate(text, timestamptz) from public;
revoke all on function public.tenders_grants_replace_planned(text, text, jsonb) from public;
revoke all on function public.tenders_grant_source_get(text, text) from public;
revoke all on function public.tenders_grant_source_set(text, text, text, text, text, integer, text) from public;
revoke all on function public.tenders_grants_list(boolean) from public;
grant execute on function public.tenders_grants_known(text) to anon, authenticated;
grant execute on function public.tenders_grants_upsert(text, jsonb) to anon, authenticated;
grant execute on function public.tenders_grants_deactivate(text, timestamptz) to anon, authenticated;
grant execute on function public.tenders_grants_replace_planned(text, text, jsonb) to anon, authenticated;
grant execute on function public.tenders_grant_source_get(text, text) to anon, authenticated;
grant execute on function public.tenders_grant_source_set(text, text, text, text, text, integer, text) to anon, authenticated;
grant execute on function public.tenders_grants_list(boolean) to anon, authenticated;
