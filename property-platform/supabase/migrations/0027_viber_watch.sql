-- Наблюдение на Viber кореспонденцията.
--
-- Базата на Viber Desktop е криптирана, а Qt не излага съдържанието си за
-- достъпност — проверено е и двете. Затова роботът на Mac-а чете това, което
-- Viber РИСУВА: снима прозореца и снимката се разчита от модел. Оттук идват
-- редовете в тези таблици.
--
-- Следствие, което оформя целия модел: от списъка с чатове се вижда само
-- ПОСЛЕДНОТО съобщение на всеки разговор, не цялата история. Затова тук няма
-- таблица със съобщения — има състояние на разговор ("кой писа последен и
-- кога") и дневник на наблюденията.

-- ---------------------------------------------------------------------------
-- Роботите

-- Роботът няма потребителска сесия — работи сам на нечий Mac. Разпознава се
-- по таен низ, от който пазим само хеша: изтече ли базата, самите токени не
-- се възстановяват от нея. Хеширането става в route handler-а (node:crypto),
-- както при assistant_usage — така функцията не зависи от pgcrypto, който при
-- `search_path = public` може и да не се намери.
create table if not exists public.viber_agents (
  token_hash text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists viber_agents_owner_idx on public.viber_agents (owner_id);

-- ---------------------------------------------------------------------------
-- Състояние на разговорите

-- Един ред на разговор. Идентичността е името, както Viber го изписва —
-- друго нямаме, защото четем от картинка. Затова `chat_key` е нормализираното
-- име, а не телефон или вътрешен идентификатор.
create table if not exists public.viber_chats (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  chat_key text not null,
  display_name text not null,
  last_preview text,
  -- Часът както Viber го е написал ("14:32", "вчера", "Пон"). Пазим го както
  -- е видян: превръщането му в точна дата е гадаене, а сгрешената дата е
  -- по-лоша от липсващата.
  last_time_label text,
  last_from_me boolean not null default false,
  unread_count integer not null default 0,
  -- Откога чака отговор. NULL значи "не чака" — или сме отговорили, или
  -- разговорът никога не е бил наш ход.
  waiting_since timestamptz,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, chat_key)
);

create index if not exists viber_chats_waiting_idx
  on public.viber_chats (owner_id, waiting_since)
  where waiting_since is not null;

-- Дневник: по един ред на всяко наблюдение. Състоянието горе се презаписва,
-- а тук остава историята — без нея не може да се отговори на "кога всъщност
-- писа този клиент" и "колко често го изпускам".
create table if not exists public.viber_observations (
  id bigserial primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  chat_key text not null,
  observed_at timestamptz not null default now(),
  preview text,
  time_label text,
  last_from_me boolean,
  unread_count integer
);

create index if not exists viber_observations_lookup_idx
  on public.viber_observations (owner_id, chat_key, observed_at desc);

-- ---------------------------------------------------------------------------
-- Достъп

-- Съдържанието е чужда кореспонденция — вижда го само собственикът, и то
-- само за четене. Писането минава единствено през функцията отдолу.
alter table public.viber_agents enable row level security;
alter table public.viber_chats enable row level security;
alter table public.viber_observations enable row level security;

create policy "Собственикът чете разговорите"
  on public.viber_chats for select
  using (auth.uid() = owner_id);

create policy "Собственикът чете наблюденията"
  on public.viber_observations for select
  using (auth.uid() = owner_id);

-- Токените не се четат от никого: те са за сравнение, не за показване.
revoke all on public.viber_agents from anon, authenticated;
revoke insert, update, delete on public.viber_chats from anon, authenticated;
revoke insert, update, delete on public.viber_observations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Приемане на наблюдение

-- Роботът подава токен и списък с разговори. Всичко привилегировано става
-- тук, за да няма service-role ключ в приложението.
--
-- Връща брой приети разговори, или -1 ако е твърде рано за ново наблюдение.
create or replace function public.viber_ingest(
  agent_token_hash text,
  chats jsonb,
  min_interval_seconds integer default 45
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  owner uuid;
  last_seen timestamptz;
  item jsonb;
  accepted integer := 0;
  key text;
  from_me boolean;
begin
  -- Хешът идва от сървъра; всичко друго значи или бъг, или чужда заявка.
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

  select a.owner_id, a.last_seen_at into owner, last_seen
    from public.viber_agents a where a.token_hash = agent_token_hash;

  if owner is null then
    raise exception 'unknown agent';
  end if;

  -- Всяко наблюдение е платено извикване на модел. Роботът вече пропуска
  -- непроменените снимки, но ако се счупи, спирачката е тук.
  if last_seen is not null
     and last_seen > now() - make_interval(secs => greatest(min_interval_seconds, 1)) then
    return -1;
  end if;

  update public.viber_agents set last_seen_at = now()
    where token_hash = agent_token_hash;

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

-- Функцията се вика само от сървъра (route handler-ът пази токена),
-- затова не се дава на браузъра.
revoke execute on function public.viber_ingest(text, jsonb, integer) from anon, authenticated;
