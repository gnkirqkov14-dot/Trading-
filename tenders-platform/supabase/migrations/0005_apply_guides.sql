-- Помощник за кандидатстване (/apply/tender/[id]).
--
-- 1. Данни на фирмата за документите (име, ЕИК, адрес, представляващ…),
--    за да ги покаже готови за преписване в ЕЕДОП. Пазят се в профила,
--    до който се стига само с ключа му. ЕГН и дата на раждане НЕ се пазят.
-- 2. Разборът на обявлението от AI се пази, за да не се плаща втори път:
--    ключ „tender:{id}:{профил}“, а source_hash е хешът на текста на
--    обявлението — при изменение (нов текст) разборът се прави наново.
--
-- Пуска се като 0001–0004: на части през execute_sql, не като миграция на
-- imotpoint. Без `if exists` и без `delete` (MCP увисва на тях).

alter table tenders.company_profiles add column company jsonb not null default '{}';

create table tenders.apply_guides (
  key text primary key,
  source_hash text not null,
  guide jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table tenders.apply_guides from public, anon, authenticated;

create or replace function public.tenders_guide_get(p_secret text, p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  return (
    select jsonb_build_object('source_hash', g.source_hash, 'guide', g.guide, 'updated_at', g.updated_at)
    from tenders.apply_guides g
    where g.key = p_key
  );
end;
$$;

create or replace function public.tenders_guide_save(p_secret text, p_key text, p_hash text, p_guide jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  insert into tenders.apply_guides as g (key, source_hash, guide)
  values (p_key, p_hash, p_guide)
  on conflict (key) do update set
    source_hash = excluded.source_hash,
    guide = excluded.guide,
    updated_at = now();
end;
$$;

create or replace function public.tenders_profile_company_save(p_secret text, p_token text, p_company jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  update tenders.company_profiles
  set company = coalesce(p_company, '{}'), updated_at = now()
  where token = p_token;
end;
$$;

-- Обособените позиции имат свой tenderId, но обявлението в ЦАИС ЕОП е
-- само на една от тях (родителската). Връща всички id-та на обявлението.
create or replace function public.tenders_notice_ids(p_notice_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(t.id order by t.id), '[]'::jsonb)
  from tenders.tenders t
  where t.notice_id = p_notice_id;
$$;

revoke all on function public.tenders_guide_get(text, text) from public;
revoke all on function public.tenders_guide_save(text, text, text, jsonb) from public;
revoke all on function public.tenders_profile_company_save(text, text, jsonb) from public;
revoke all on function public.tenders_notice_ids(bigint) from public;
grant execute on function public.tenders_guide_get(text, text) to anon, authenticated;
grant execute on function public.tenders_guide_save(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.tenders_profile_company_save(text, text, jsonb) to anon, authenticated;
grant execute on function public.tenders_notice_ids(bigint) to anon, authenticated;
