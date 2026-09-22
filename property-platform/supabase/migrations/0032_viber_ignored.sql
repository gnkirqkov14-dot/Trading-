-- "Този разговор да не се чете никога."
--
-- Собственикът поиска канал на автокъща да отпадне съвсем. Скриването му от
-- екрана не е достатъчен отговор: искането е да НЕ СЕ ЧЕТЕ, тоест съдържанието
-- му да не се пази. Затова спирането прави три неща наведнъж:
--
--   1. изтрива вече запазените откъси на този разговор и целия му дневник;
--   2. спира бъдещите наблюдения — `viber_ingest` го прескача изцяло, без да
--      пише нито ред;
--   3. маха го от таблото и от данните, които отиват при модела при въпрос.
--
-- Това, което НЕ прави и не може: роботът снима целия прозорец на Viber, а
-- спреният разговор продължава да стои в списъка на екрана. Тоест редът му
-- влиза в снимката, която се разчита. Спирането пази базата, не снимката.
-- Истинското решение за снимката е изрязването на лявата лента и по-нататък
-- избор кои редове изобщо се записват — отделна стъпка.

alter table public.viber_chats
  add column if not exists ignored boolean not null default false;

comment on column public.viber_chats.ignored is
  'true = собственикът е спрял този разговор: не се чете, не се пази, не се показва.';

create index if not exists viber_chats_active_idx
  on public.viber_chats (owner_id, updated_at desc)
  where not ignored;

-- ---------------------------------------------------------------------------
-- Едно име = един разговор

-- Първото живо разчитане направи 19 реда от около 10 истински разговора.
-- Причината: ключът беше самото име, а Viber реже дългите имена с многоточие и
-- моделът ги връща ту с него, ту без — "7Cars Автомобили" и
-- "7Cars Автомобили ..." ставаха два различни разговора.
--
-- Тук се маха точно това, което е шум: многоточието и точките в края,
-- двойните интервали, главните букви. НЕ се прави приблизително сравнение:
-- "Иван Петров" и "Иван Петков" си приличат много, а са различни хора, и
-- сливането им е по-лошо от дублирането.
create or replace function public.viber_chat_key(raw text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(
      regexp_replace(lower(btrim(coalesce(raw, ''))), '[\s\u00a0]+', ' ', 'g'),
      '[\.\u2026]+\s*$', '', 'g'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Спиране и връщане

-- Функция, а не право за писане върху колоната: спирането трябва и да ИЗТРИЕ
-- запазеното съдържание, а право за триене на наблюдения не бива да се дава на
-- клиента — приложението ползва публичен ключ и всеки логнат потребител праща
-- заявки директно към REST API-то.
create or replace function public.viber_set_ignored(
  p_chat_key text,
  p_ignored boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  key text := public.viber_chat_key(p_chat_key);
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if key = '' then
    raise exception 'missing chat';
  end if;

  update public.viber_chats set
    ignored = coalesce(p_ignored, false),
    -- При спиране съдържанието се забравя веднага. Запазеният откъс е точно
    -- това, което собственикът каза да не се чете.
    last_preview    = case when p_ignored then null else last_preview end,
    last_time_label = case when p_ignored then null else last_time_label end,
    last_from_me    = case when p_ignored then null else last_from_me end,
    waiting_since   = case when p_ignored then null else waiting_since end,
    updated_at      = now()
    where owner_id = me and chat_key = key;

  if not found then
    raise exception 'unknown chat';
  end if;

  if p_ignored then
    delete from public.viber_observations
      where owner_id = me and chat_key = key;
  end if;
end;
$$;

grant execute on function public.viber_set_ignored(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Приемането прескача спрените

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
  sender text;
  from_me boolean;
  chat_kind text;
  ignored_keys text[];
  strict_key text;
begin
  if agent_token_hash is null or agent_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid token';
  end if;
  if jsonb_typeof(chats) is distinct from 'array' then
    raise exception 'chats must be an array';
  end if;
  if jsonb_array_length(chats) > 60 then
    raise exception 'too many chats';
  end if;

  select a.owner_id into owner
    from public.viber_agents a where a.token_hash = agent_token_hash;

  if owner is null then
    raise exception 'unknown agent';
  end if;

  -- Спрените се вземат веднъж, не на всеки ред: списъкът е десетина имена, а
  -- заявка в цикъла би станала двайсет заявки на кръг за нищо.
  select coalesce(array_agg(c.chat_key), '{}')
    into ignored_keys
    from public.viber_chats c
    where c.owner_id = owner and c.ignored;

  for item in select * from jsonb_array_elements(chats) loop
    key := public.viber_chat_key(item ->> 'name');
    continue when key = '';
    -- Отрязано име: ако вече има разговор, чието име започва с това, е същият.
    -- Осем знака е прагът — по-къс префикс би слял различни хора.
    if length(key) >= 8 then
      select c.chat_key into strict_key
        from public.viber_chats c
        where c.owner_id = owner
          and c.chat_key <> key
          and (c.chat_key like key || '%' or key like c.chat_key || '%')
        order by length(c.chat_key) desc
        limit 1;
      if strict_key is not null then
        key := strict_key;
      end if;
    end if;
    -- Спреният разговор не се пише НИКЪДЕ: нито състояние, нито дневник.
    -- Проверката е СЛЕД сливането на отрязаните имена, инак "7Cars ..." би
    -- се разминал със спрения "7Cars" и би се записал пак.
    continue when key = any(ignored_keys);

    sender := lower(btrim(coalesce(item ->> 'last_sender', '')));
    if sender not in ('me', 'them', 'unclear') then
      sender := case
        when (item ->> 'last_from_me') = 'true'  then 'me'
        when (item ->> 'last_from_me') = 'false' then 'them'
        else 'unclear'
      end;
    end if;

    from_me := case sender when 'me' then true when 'them' then false else null end;

    chat_kind := lower(btrim(coalesce(item ->> 'kind', 'person')));
    if chat_kind not in ('person', 'group') then
      chat_kind := 'person';
    end if;

    insert into public.viber_chats as c (
      owner_id, chat_key, display_name, last_preview, last_time_label,
      last_from_me, unread_count, waiting_since, kind
    )
    values (
      owner, key,
      btrim(item ->> 'name'),
      item ->> 'preview',
      item ->> 'time_label',
      from_me,
      greatest(coalesce((item ->> 'unread_count')::integer, 0), 0),
      case when sender = 'them' then now() else null end,
      chat_kind
    )
    on conflict (owner_id, chat_key) do update set
      display_name    = excluded.display_name,
      last_preview    = excluded.last_preview,
      last_time_label = excluded.last_time_label,
      last_from_me    = excluded.last_from_me,
      unread_count    = excluded.unread_count,
      kind            = excluded.kind,
      updated_at      = now(),
      waiting_since = case
        when excluded.last_from_me is true  then null
        when excluded.last_from_me is false then coalesce(c.waiting_since, now())
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
drop function if exists public.viber_ingest(text, jsonb, integer);
