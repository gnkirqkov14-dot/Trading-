-- Поправка на разчитането: "не знам" вече не се превръща в "клиентът чака".
--
-- Първото живо наблюдение показа два дефекта, които не се виждаха на сухо:
--
-- 1. Указанието към модела беше да познава по представка "Вие:" пред откъса.
--    В снимка от истински Viber на български такава представка НЯМА нито
--    веднъж. Своите съобщения Viber бележи с отметки (✓✓) до реда, а при
--    реакция пише "Ти реагира с …" — тоест "Ти", не "Вие". Проверката, която
--    бях направил, не можеше да хване нищо: търсеше низ, който не съществува.
--
-- 2. Полето беше boolean. Щом моделът не различи подателя, единственото, което
--    можеше да върне, е false — а false значеше "клиентът писа последен",
--    тоест "чака те". Така несигурността тихо ставаше твърдение и часовникът
--    тръгваше. 16 от 17 разговора излязоха "чакат отговор" — число, което
--    по-скоро описва стойността по подразбиране, отколкото пощенската кутия.
--
-- Затова подателят вече има три стойности, а не две, и "не е ясно" не пипа
-- часовника: нито го пуска, нито го спира.
--
-- Второ: списъкът съдържа и канали, групи и официални акаунти (стотици
-- непрочетени, които никой не чете). Те не са разговор, в който някой чака
-- отговор, и не бива да стоят наравно с клиентите.

alter table public.viber_chats
  alter column last_from_me drop not null;

comment on column public.viber_chats.last_from_me is
  'true = собственикът писа последен; false = отсрещният; NULL = не е разпознато.';

alter table public.viber_chats
  add column if not exists kind text not null default 'person';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'viber_chats_kind_check'
  ) then
    alter table public.viber_chats
      add constraint viber_chats_kind_check check (kind in ('person', 'group'));
  end if;
end $$;

comment on column public.viber_chats.kind is
  'person = разговор с човек; group = група, канал, бот или официален акаунт.';

-- Досегашните стойности идват от разчитане, което нямаше как да е вярно.
-- По-честно е таблото да е празно, отколкото да показва измислени чакащи —
-- следващото наблюдение (до 20 минути) го попълва наново.
update public.viber_chats set last_from_me = null, waiting_since = null;

-- ---------------------------------------------------------------------------

-- ⚠️ Подписът е С ДВА аргумента. 0028 премести спирачката за честота в
-- `viber_claim_slot` (трябва да спира ПРЕДИ разхода, не след него) и махна
-- третия аргумент. Ако тук се възстанови старият подпис, в базата остават
-- ДВЕ едноименни функции и PostgREST не може да избере коя да извика —
-- проверено на живо срещу Postgres 16: "function viber_ingest(text, jsonb)
-- is not unique". Тоест поправката би счупила точно приемането на снимки.
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

  for item in select * from jsonb_array_elements(chats) loop
    key := lower(btrim(coalesce(item ->> 'name', '')));
    continue when key = '';

    -- Новият формат е 'me' / 'them' / 'unclear'. Старият boolean се приема
    -- още, защото роботът на чужда машина може да не е обновен — и тогава
    -- липсващата стойност значи "не е ясно", не "клиентът чака".
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
      -- Нов разговор: часовникът тръгва само при сигурно "отсрещният писа".
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
      -- Часовникът тръгва, когато ходът стане наш, и НЕ се пренавива, докато
      -- си остава наш — инак всяко ново съобщение би нулирало изчакването и
      -- "чака от 3 часа" никога не би се случило.
      --
      -- Третият случай е новият и е същината на поправката: "не е ясно" не
      -- пипа нищо. Несигурното разчитане не бива нито да обявява човек за
      -- чакащ, нито да зачерква истинско чакане отпреди.
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

-- Предпазно: ако някъде е останал тригодишният подпис, махаме го, за да не
-- станат две едноименни функции (виж бележката по-горе).
drop function if exists public.viber_ingest(text, jsonb, integer);
