-- Още филтри за търсенето на началната страница (без AI): вид поръчка,
-- възложител, вид възложител, европейски средства, време до срока,
-- скоро публикувани, събиране на оферти. Нова функция с един jsonb
-- параметър, за да не се чупи старата tenders_search (PostgREST не
-- различава претоварени функции с много параметри по подразбиране).
-- Пуска се с execute_sql на части, без „if exists“ (виж CLAUDE.md).

create or replace function public.tenders_search_ext(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_words text[];
  v_buyer text := nullif(lower(btrim(coalesce(p->>'buyer', ''))), '');
  v_kind text := nullif(p->>'kind', '');
  v_btype text := nullif(p->>'buyer_type', '');
  v_min_days integer := nullif(p->>'min_days', '')::integer;
  v_new_days integer := nullif(p->>'new_days', '')::integer;
  v_sort text := coalesce(nullif(p->>'sort', ''), 'deadline');
  v_result jsonb;
begin
  v_words := array_remove(
    regexp_split_to_array(lower(btrim(coalesce(p->>'q', ''))), '\s+'), ''
  );

  with filtered as (
    select t.*
    from tenders.tenders t
    where (not coalesce((p->>'open_only')::boolean, true)
           or (t.deadline_at >= now() and not t.is_cancelled))
      and (nullif(p->>'region', '') is null or t.region_code = p->>'region')
      and (nullif(p->>'category', '') is null or t.cpv_division = p->>'category')
      and (nullif(p->>'min', '') is null or t.value_eur >= (p->>'min')::numeric)
      and (nullif(p->>'max', '') is null or t.value_eur <= (p->>'max')::numeric)
      and (nullif(p->>'updated_since', '') is null or t.updated_at > (p->>'updated_since')::timestamptz)
      and (v_kind is null or t.contract_type = v_kind)
      and (v_buyer is null or position(v_buyer in lower(t.buyer_name)) > 0)
      and (
        v_btype is null
        or (v_btype = 'municipal' and t.buyer_type like 'Местен орган%')
        or (v_btype = 'state' and (t.buyer_type like 'Орган на централната власт%'
                                   or t.buyer_type like 'Регионален орган%'))
        or (v_btype = 'company' and t.buyer_type like 'Публично предприятие%')
        or (v_btype = 'public' and t.buyer_type like 'Публичноправна организация%')
      )
      and (not coalesce((p->>'eu_only')::boolean, false) or t.eu_funded)
      and (not coalesce((p->>'small_only')::boolean, false)
           or t.procedure_type = 'Събиране на оферти с обява'
           or t.notice_type like 'Обява за събиране на оферти%')
      and (v_min_days is null or t.deadline_at >= now() + make_interval(days => v_min_days))
      and (v_new_days is null or t.published_at >= now() - make_interval(days => v_new_days))
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
      case when v_sort = 'value' then f.value_eur end desc nulls last,
      case when v_sort = 'newest' then f.published_at end desc nulls last,
      case when v_sort not in ('value', 'newest') then f.deadline_at end asc nulls last,
      f.id desc
    limit least(greatest(coalesce((p->>'limit')::integer, 20), 1), 100)
    offset greatest(coalesce((p->>'offset')::integer, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce(
      (select jsonb_agg(to_jsonb(pg) - 'search_text' - 'created_at') from page pg),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.tenders_search_ext(jsonb) from public;
grant execute on function public.tenders_search_ext(jsonb) to anon, authenticated;
