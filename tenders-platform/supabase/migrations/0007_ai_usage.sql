-- Колко струва всяка заявка към Claude — за да се изчисли цената на
-- абонамента от истински числа, не от догадки. Без лични данни: само вид
-- на заявката, модел, токени, цена и време. Пуска се с execute_sql на
-- части, без „if exists“ и без „delete“ (виж CLAUDE.md).

create table tenders.ai_usage (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  label text not null,            -- advisor.profile, apply.tender, …
  model text,                     -- моделът, който е отговорил (при fallback — друг)
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,   -- с мисленето
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  ms integer,
  ok boolean not null default true            -- false: отказ или недовършен отговор (пак се плаща)
);

create index ai_usage_at_idx on tenders.ai_usage (at);
alter table tenders.ai_usage enable row level security;

create or replace function public.tenders_ai_usage_log(p_secret text, p_row jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  insert into tenders.ai_usage (label, model, input_tokens, output_tokens, cache_read_tokens,
                                cache_write_tokens, cost_usd, ms, ok)
  values (
    left(coalesce(p_row->>'label', '?'), 60),
    left(p_row->>'model', 60),
    coalesce((p_row->>'input_tokens')::integer, 0),
    coalesce((p_row->>'output_tokens')::integer, 0),
    coalesce((p_row->>'cache_read_tokens')::integer, 0),
    coalesce((p_row->>'cache_write_tokens')::integer, 0),
    coalesce((p_row->>'cost_usd')::numeric, 0),
    (p_row->>'ms')::integer,
    coalesce((p_row->>'ok')::boolean, true)
  );
end;
$$;

revoke all on function public.tenders_ai_usage_log(text, jsonb) from public;
grant execute on function public.tenders_ai_usage_log(text, jsonb) to anon, authenticated;
