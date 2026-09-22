-- Твърд таван на разхода за Viber робота.
--
-- 0027 разчиташе само на две неща: че роботът не праща непроменена снимка
-- (сравнява хеш) и че базата отказва по-често от веднъж на 45 секунди.
-- И двете се оказаха недостатъчни.
--
-- Хешът се променя от ЕДИН пиксел. Зелена точка "онлайн", "пише…", сменен
-- час — снимката е нова и се плаща, без нищо съществено да се е случило.
-- А 45 секунди значи до 1920 разчитания на ден, тоест сметка, по-голяма от
-- цената на официалния Viber бот, който отхвърлихме точно защото е скъп.
--
-- ⚠️ Втората грешка беше в РЕДА: таванът се проверяваше в базата, а моделът
-- се викаше преди нея. При достигнат таван парите вече бяха похарчени и
-- заявката се отхвърляше след това — спирачка, която не спира нищо. Затова
-- разрешението вече се иска ОТДЕЛНО и ПРЕДИ разхода: viber_claim_slot()
-- казва може ли, и чак тогава route handler-ът вика модела.

alter table public.viber_agents
  add column if not exists window_started_at timestamptz,
  add column if not exists calls_this_hour integer not null default 0,
  add column if not exists day_started_on date,
  add column if not exists calls_today integer not null default 0;

comment on column public.viber_agents.calls_this_hour is
  'Разчетени снимки в текущия час. Всяка струва пари.';
comment on column public.viber_agents.calls_today is
  'Разчетени снимки днес. Дневният таван е втората спирачка след часовата.';

-- ---------------------------------------------------------------------------
-- Разрешение за разход

-- Вика се ПРЕДИ модела. Ако върне 1, мястото е запазено и броячите вече са
-- увеличени — плащането предстои. Отрицателните стойности значат "не харчи":
--   -1 твърде скоро след предишното
--   -2 часовият таван е изчерпан
--   -3 дневният таван е изчерпан
-- Различни числа, за да се вижда в дневника на робота коя спирачка е
-- сработила, вместо всичко да изглежда като една и съща грешка.
create or replace function public.viber_claim_slot(
  agent_token_hash text,
  min_interval_seconds integer default 45,
  max_calls_per_hour integer default 3,
  max_calls_per_day integer default 40
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
  today date := (now() at time zone 'utc')::date;
begin
  if agent_token_hash is null or agent_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid token';
  end if;
  -- Таваните идват от сървъра, но се проверяват и тук: функцията е достъпна
  -- за всеки, който знае валиден хеш, а огромен таван обезсмисля спирачката.
  if max_calls_per_hour is null or max_calls_per_hour < 1 or max_calls_per_hour > 60 then
    raise exception 'invalid hourly cap';
  end if;
  if max_calls_per_day is null or max_calls_per_day < 1 or max_calls_per_day > 600 then
    raise exception 'invalid daily cap';
  end if;

  -- Заключваме реда: два робота със същия токен иначе минават през проверката
  -- едновременно и двата харчат.
  select a.owner_id, a.last_seen_at, a.window_started_at, a.calls_this_hour,
         a.day_started_on, a.calls_today
    into owner, last_seen, window_start, hour_calls, day_start, day_calls
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

  if hour_calls >= max_calls_per_hour then
    return -2;
  end if;
  if day_calls >= max_calls_per_day then
    return -3;
  end if;

  update public.viber_agents set
    last_seen_at      = now(),
    window_started_at = window_start,
    calls_this_hour   = hour_calls + 1,
    day_started_on    = day_start,
    calls_today       = day_calls + 1
    where token_hash = agent_token_hash;

  return 1;
end;
$$;

grant execute on function
  public.viber_claim_slot(text, integer, integer, integer)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Записване на прочетеното

-- Вече само пише. Броенето и спирачките се преместиха в claim_slot, защото
-- те трябва да се случат, докато още има какво да се спре.
create or replace function public.viber_ingest(
  agent_token_hash text,
  chats jsonb
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  owner uuid;
  item jsonb;
  accepted integer := 0;
  key text;
  from_me boolean;
begin
  if agent_token_hash is null or agent_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid token';
  end if;
  if jsonb_typeof(chats) is distinct from 'array' then
    raise exception 'chats must be an array';
  end if;
  -- Един прозорец на Viber показва десетина разговора. Много повече значи
  -- или сгрешено разчитане, или някой пълни базата нарочно.
  if jsonb_array_length(chats) > 60 then
    raise exception 'too many chats';
  end if;

  select a.owner_id into owner
    from public.viber_agents a where a.token_hash = agent_token_hash;

  if owner is null then
    raise exception 'unknown agent';
  end if;

  for item in select * from jsonb_array_elements(chats) loop
    key := lower(btrim(coalesce(item ->> 'name', '')));
    continue when key = '';

    from_me := coalesce((item ->> 'last_from_me')::boolean, false);

    insert into public.viber_chats as c (
      owner_id, chat_key, display_name, last_preview, last_time_label,
      last_from_me, unread_count, waiting_since
    )
    values (
      owner, key,
      btrim(item ->> 'name'),
      item ->> 'preview',
      item ->> 'time_label',
      from_me,
      greatest(coalesce((item ->> 'unread_count')::integer, 0), 0),
      case when from_me then null else now() end
    )
    on conflict (owner_id, chat_key) do update set
      display_name    = excluded.display_name,
      last_preview    = excluded.last_preview,
      last_time_label = excluded.last_time_label,
      last_from_me    = excluded.last_from_me,
      unread_count    = excluded.unread_count,
      updated_at      = now(),
      -- Часовникът за чакане тръгва, когато ходът стане наш, и НЕ се
      -- пренавива, докато си остава наш. Инак всяко ново съобщение от клиента
      -- би нулирало изчакването и "чака от 3 часа" никога не би се случило.
      waiting_since = case
        when excluded.last_from_me then null
        when c.waiting_since is null then now()
        else c.waiting_since
      end;

    insert into public.viber_observations (
      owner_id, chat_key, preview, time_label, last_from_me, unread_count
    )
    values (
      owner, key,
      item ->> 'preview',
      item ->> 'time_label',
      from_me,
      greatest(coalesce((item ->> 'unread_count')::integer, 0), 0)
    );

    accepted := accepted + 1;
  end loop;

  return accepted;
end;
$$;

grant execute on function public.viber_ingest(text, jsonb) to anon, authenticated;

-- Старият подпис броеше сам и позволяваше извикване без запазено място.
drop function if exists public.viber_ingest(text, jsonb, integer);
