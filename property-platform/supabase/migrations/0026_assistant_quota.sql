-- Дневен лимит на въпросите към AI помощника.
--
-- Помощникът (src/app/api/assistant/route.ts) струва пари на всяко
-- съобщение — извиква Anthropic API с ключа на собственика. Без лимит
-- един-единствен посетител със скрипт може да изпразни сметката за
-- минути. Затова всеки въпрос първо минава оттук.
--
-- Броим по хеш на IP адреса, НЕ по самия адрес: IP-то е лично данни по
-- GDPR, а за преброяване хешът върши същата работа. Солта е сървърна
-- (ASSISTANT_IP_SALT), така че таблицата сама по себе си не издава кой
-- е питал.

create table if not exists public.assistant_usage (
  visitor_hash text not null,
  day date not null,
  question_count integer not null default 0,
  primary key (visitor_hash, day)
);

create index if not exists assistant_usage_day_idx on public.assistant_usage (day);

-- Таблицата не се чете и не се пише от никого директно — единственият
-- път е функцията отдолу, която е SECURITY DEFINER и връща само число.
-- RLS без нито едно policy = всичко забранено за anon/authenticated.
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from anon, authenticated;

-- Връща колко въпроса остават за днес; -1 означава "лимитът е изчерпан".
-- Броенето и проверката са в една заявка нарочно — иначе два паралелни
-- request-а могат и двата да минат през проверката, преди някой да е
-- увеличил брояча.
create or replace function public.assistant_consume_quota(
  visitor text,
  daily_limit integer
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  used integer;
begin
  -- Аргументите идват от route handler-а, но проверяваме и тук — функцията
  -- е достъпна за всеки логнат/анонимен клиент през RPC-то.
  if visitor is null or visitor !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid visitor';
  end if;
  if daily_limit is null or daily_limit < 1 or daily_limit > 500 then
    raise exception 'invalid limit';
  end if;

  insert into public.assistant_usage as u (visitor_hash, day, question_count)
  values (visitor, today, 1)
  on conflict (visitor_hash, day)
  do update set question_count = u.question_count + 1
  returning u.question_count into used;

  -- Старите редове не служат за нищо. Чистим рядко, за да не плащаме
  -- изтриване на всяка заявка.
  if random() < 0.02 then
    delete from public.assistant_usage where day < today - 7;
  end if;

  if used > daily_limit then
    return -1;
  end if;
  return daily_limit - used;
end;
$$;

grant execute on function public.assistant_consume_quota(text, integer) to anon, authenticated;
