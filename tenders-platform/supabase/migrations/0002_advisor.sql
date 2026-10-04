-- Съветникът: фирмата описва дейността си, AI я превежда в профил (CPV
-- кодове, ключови думи, области), а тази функция връща отворените
-- поръчки, които най-много приличат на профила. Подреждането тук е
-- грубо (точки); AI-ят после избира и обяснява най-добрите.
--
-- Пуска се като 0001: на части през SQL Editor или execute_sql, НЕ като
-- миграция на imotpoint (виж tenders-platform/CLAUDE.md). Идемпотентна.

-- Брояч на въпросите към съветника. Всеки въпрос струва пари (Anthropic
-- API), затова има таван на посетител и общ таван за деня. Посетителят е
-- хеш на IP адреса, не самият адрес.
create table if not exists tenders.advisor_usage (
  day date not null,
  visitor text not null,
  questions integer not null default 0,
  primary key (day, visitor)
);
revoke all on table tenders.advisor_usage from public, anon, authenticated;

create or replace function public.tenders_match(
  p_cpv_prefixes text[] default null,
  p_keywords text[] default null,
  p_regions text[] default null,
  p_min numeric default null,
  p_max numeric default null,
  p_limit integer default 60
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prefixes text[];
  v_words text[];
  v_result jsonb;
begin
  -- Само цифри, от 2 до 8; иначе един празен префикс би хванал всичко.
  select coalesce(array_agg(distinct p), '{}')
    into v_prefixes
    from unnest(coalesce(p_cpv_prefixes, '{}')) p
   where p ~ '^[0-9]{2,8}$';

  select coalesce(array_agg(distinct lower(btrim(w))), '{}')
    into v_words
    from unnest(coalesce(p_keywords, '{}')) w
   where length(btrim(w)) >= 3;

  if cardinality(v_prefixes) = 0 and cardinality(v_words) = 0 then
    return '[]'::jsonb;
  end if;

  with open_tenders as (
    select t.*
      from tenders.tenders t
     where t.deadline_at >= now()
       and not t.is_cancelled
       and (p_min is null or t.value_eur is null or t.value_eur >= p_min)
       and (p_max is null or t.value_eur is null or t.value_eur <= p_max)
  ),
  scored as (
    select o.*,
           -- Най-дългият съвпаднал префикс тежи най-много: 45 (строителство)
           -- е широко, 45233 (пътища) е точно попадение.
           coalesce((select max(length(p)) from unnest(v_prefixes) p
                      where o.cpv_code like p || '%'), 0) as cpv_hit,
           (select count(*) from unnest(v_words) w
             where position(w in o.search_text) > 0) as word_hits
      from open_tenders o
  ),
  ranked as (
    select s.*,
           (case when s.cpv_hit >= 5 then 6 when s.cpv_hit >= 3 then 4
                 when s.cpv_hit = 2 then 2 else 0 end)
           + least(s.word_hits, 4) * 2
           + case when p_regions is not null and cardinality(p_regions) > 0
                       and s.region_code = any(p_regions) then 2 else 0 end
             as score
      from scored s
     where s.cpv_hit > 0 or s.word_hits > 0
  )
  select coalesce(jsonb_agg(row_data order by score desc, deadline_at asc), '[]'::jsonb)
    into v_result
    from (
      select r.score, r.deadline_at,
             jsonb_build_object(
               'id', r.id,
               'title', r.title,
               'lot_number', r.lot_number,
               'lot_title', r.lot_title,
               'description', left(r.description, 500),
               'cpv_code', r.cpv_code,
               'cpv_label', r.cpv_label,
               'cpv_division', r.cpv_division,
               'buyer_name', r.buyer_name,
               'buyer_locality', r.buyer_locality,
               'region_code', r.region_code,
               'value_eur', r.value_eur,
               'deadline_at', r.deadline_at,
               'published_at', r.published_at,
               'procedure_type', r.procedure_type,
               'notice_type', r.notice_type,
               'contract_type', r.contract_type,
               'eu_funded', r.eu_funded,
               'score', r.score
             ) as row_data
        from ranked r
       order by r.score desc, r.deadline_at asc
       limit least(greatest(coalesce(p_limit, 60), 1), 100)
    ) top;

  return v_result;
end;
$$;

-- Вдига брояча и казва колко въпроса остават на посетителя днес.
-- -1 = посетителят е изчерпал дневния си лимит; -2 = сайтът е изчерпал
-- общия дневен таван. Броячът се вдига преди заявката към модела, за да
-- не минат няколко едновременни заявки покрай тавана.
create or replace function public.tenders_advisor_consume(
  p_secret text,
  p_visitor text,
  p_max_per_visitor integer,
  p_max_per_day integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Europe/Sofia')::date;
  v_total integer;
  v_used integer;
begin
  perform tenders.check_secret(p_secret);
  if p_visitor is null or length(p_visitor) < 8 then
    raise exception 'invalid visitor';
  end if;

  select coalesce(sum(questions), 0) into v_total
    from tenders.advisor_usage where day = v_day;
  if v_total >= p_max_per_day then
    return -2;
  end if;

  insert into tenders.advisor_usage as u (day, visitor, questions)
  values (v_day, p_visitor, 1)
  on conflict (day, visitor) do update set questions = u.questions + 1
  returning u.questions into v_used;

  if v_used > p_max_per_visitor then
    return -1;
  end if;
  return p_max_per_visitor - v_used;
end;
$$;

-- Връща въпроса, ако моделът гръмне — човекът не е получил нищо.
create or replace function public.tenders_advisor_refund(p_secret text, p_visitor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  update tenders.advisor_usage
     set questions = greatest(questions - 1, 0)
   where day = (now() at time zone 'Europe/Sofia')::date
     and visitor = p_visitor;
end;
$$;

revoke all on function public.tenders_match(text[], text[], text[], numeric, numeric, integer) from public;
revoke all on function public.tenders_advisor_consume(text, text, integer, integer) from public;
revoke all on function public.tenders_advisor_refund(text, text) from public;
grant execute on function public.tenders_match(text[], text[], text[], numeric, numeric, integer) to anon, authenticated;
grant execute on function public.tenders_advisor_consume(text, text, integer, integer) to anon, authenticated;
grant execute on function public.tenders_advisor_refund(text, text) to anon, authenticated;
