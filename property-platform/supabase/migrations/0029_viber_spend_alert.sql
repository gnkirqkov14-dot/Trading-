-- Сигнал по имейл, когато разходът за Viber робота стигне праг.
--
-- 0028 сложи твърд таван (3 разчитания на час, 40 на ден), но таванът е
-- защита от катастрофа, не видимост. Собственикът иска да УЗНАЕ, че е
-- похарчил, преди сметката да го изненада в края на месеца — тоест нужен е
-- и брояч на парите, не само на извикванията.
--
-- Цената се ОЦЕНЯВА, не се отчита: Anthropic връща изразходваните токени, но
-- нито базата, нито роботът ги виждат. Затова се брои по приблизителна цена
-- на разчитане, подадена от route handler-а, който знае кой модел вика.
-- Числото е ориентир за "време е да погледнеш сметката", не счетоводство.

alter table public.viber_agents
  add column if not exists spend_month date,
  add column if not exists spend_micro_eur bigint not null default 0,
  add column if not exists spend_alert_sent_at timestamptz;

comment on column public.viber_agents.spend_micro_eur is
  'Оценен разход за текущия календарен месец, в милионни от евро. Оценка, не отчет.';
comment on column public.viber_agents.spend_alert_sent_at is
  'Кога е пратен сигналът за прага този месец. NULL = още не е пратен.';

-- Вика се ПРЕДИ модела. Връща:
--    2 = може, И прагът за сигнал току-що беше прекрачен (прати имейл)
--    1 = може
--   -1 = твърде скоро след предишното
--   -2 = часовият таван е изчерпан
--   -3 = дневният таван е изчерпан
create or replace function public.viber_claim_slot(
  agent_token_hash text,
  min_interval_seconds integer default 45,
  max_calls_per_hour integer default 3,
  max_calls_per_day integer default 40,
  -- Haiku при около 1350 входни и 800 изходни токена на снимка.
  cost_micro_eur integer default 4950,
  -- 5 евро. Прагът е за сигнал, не за спиране — спира таванът по-горе.
  alert_at_micro_eur bigint default 5000000
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  owner uuid;
  last_seen timestamptz;
  window_start timestamptz;
  hour_calls integer;
  day_start date;
  day_calls integer;
  spend_from date;
  spend bigint;
  alerted timestamptz;
  today date := (now() at time zone 'utc')::date;
  month_start date := date_trunc('month', (now() at time zone 'utc'))::date;
  crossed boolean := false;
begin
  if agent_token_hash is null or agent_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid token';
  end if;
  if max_calls_per_hour is null or max_calls_per_hour < 1 or max_calls_per_hour > 60 then
    raise exception 'invalid hourly cap';
  end if;
  if max_calls_per_day is null or max_calls_per_day < 1 or max_calls_per_day > 600 then
    raise exception 'invalid daily cap';
  end if;
  if cost_micro_eur is null or cost_micro_eur < 0 or cost_micro_eur > 1000000 then
    raise exception 'invalid cost estimate';
  end if;

  -- Заключваме реда: два робота със същия токен иначе минават през проверката
  -- едновременно и двата харчат.
  select a.owner_id, a.last_seen_at, a.window_started_at, a.calls_this_hour,
         a.day_started_on, a.calls_today, a.spend_month, a.spend_micro_eur,
         a.spend_alert_sent_at
    into owner, last_seen, window_start, hour_calls, day_start, day_calls,
         spend_from, spend, alerted
    from public.viber_agents a
    where a.token_hash = agent_token_hash
    for update;

  if owner is null then
    raise exception 'unknown agent';
  end if;

  if last_seen is not null
     and last_seen > now() - make_interval(secs => greatest(min_interval_seconds, 1)) then
    return -1;
  end if;

  -- Прозорците се плъзгат: изтекъл ли е часът или денят, броячът пада на нула.
  if window_start is null or window_start < now() - interval '1 hour' then
    window_start := now();
    hour_calls := 0;
  end if;
  if day_start is null or day_start <> today then
    day_start := today;
    day_calls := 0;
  end if;
  -- Разходът се брои по календарен месец: така сигналът идва наново всеки
  -- месец, вместо да замлъкне завинаги след първото прекрачване.
  if spend_from is null or spend_from <> month_start then
    spend_from := month_start;
    spend := 0;
    alerted := null;
  end if;

  if hour_calls >= max_calls_per_hour then
    return -2;
  end if;
  if day_calls >= max_calls_per_day then
    return -3;
  end if;

  spend := spend + cost_micro_eur;
  -- Сигналът е еднократен за месеца: инак всяко следващо разчитане над прага
  -- праща нов имейл и собственикът спира да ги чете точно когато не трябва.
  if alerted is null and spend >= alert_at_micro_eur then
    alerted := now();
    crossed := true;
  end if;

  update public.viber_agents set
    last_seen_at        = now(),
    window_started_at   = window_start,
    calls_this_hour     = hour_calls + 1,
    day_started_on      = day_start,
    calls_today         = day_calls + 1,
    spend_month         = spend_from,
    spend_micro_eur     = spend,
    spend_alert_sent_at = alerted
    where token_hash = agent_token_hash;

  if crossed then
    return 2;
  end if;
  return 1;
end;
$$;

grant execute on function
  public.viber_claim_slot(text, integer, integer, integer, integer, bigint)
  to anon, authenticated;

-- Старият подпис няма брояч на пари и би заобиколил сигнала.
drop function if exists public.viber_claim_slot(text, integer, integer, integer);

-- ---------------------------------------------------------------------------
-- Данни за сигнала

-- Имейлът на собственика не е четим от никого (виж 0019 за profiles.email) и
-- auth.users е още по-затворена. Затова адресът излиза само оттук, само срещу
-- валиден хеш на токен, и само колкото трябва за едно писмо.
create or replace function public.viber_spend_alert(agent_token_hash text)
returns table (owner_email text, spend_eur numeric, calls_today integer)
language plpgsql
security definer set search_path = public
as $$
begin
  if agent_token_hash is null or agent_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid token';
  end if;

  return query
    select u.email::text,
           round(a.spend_micro_eur / 1000000.0, 2),
           a.calls_today
      from public.viber_agents a
      join auth.users u on u.id = a.owner_id
      where a.token_hash = agent_token_hash;
end;
$$;

grant execute on function public.viber_spend_alert(text) to anon, authenticated;
