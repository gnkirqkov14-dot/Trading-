-- Въпроси върху наблюдаваната Viber кореспонденция.
--
-- Собственикът поиска да пита с думи — "какво си говорих вчера с Х", "има ли
-- клиенти от последните 4 дни, които чакат нещо" — и да получава анализ, а не
-- таблица. Това е трето място в проекта, което харчи пари, и е най-скъпото:
-- разчитането на снимка върви на Haiku, но отговорът на въпрос иска по-силен
-- модел, тоест около 6 стотинки на въпрос вместо една.
--
-- Затова таван по БРОЙ на ден и брояч на парите с еднократен сигнал, по същия
-- образец като робота (0029). Броячите са отделни нарочно: роботът и въпросите
-- са различни разходи и смесването им би скрило кой от двата се е разприказвал.

create table if not exists public.viber_ask_quota (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  day date not null,
  used integer not null default 0,
  spend_month date,
  spend_micro_eur bigint not null default 0,
  spend_alert_sent_at timestamptz
);

comment on table public.viber_ask_quota is
  'Дневен брой и месечен разход за въпросите върху Viber наблюденията.';

alter table public.viber_ask_quota enable row level security;

-- Никой не чете и не пише директно: единственият път е функцията отдолу.
-- Инак всеки логнат потребител би могъл да си нулира брояча през REST API-то,
-- защото приложението ползва публичен ключ.
revoke all on public.viber_ask_quota from anon, authenticated;

-- Вика се ПРЕДИ модела. Връща:
--    2 = може, И прагът за сигнал току-що беше прекрачен
--    1 = може
--   -1 = дневният брой е изчерпан
create or replace function public.viber_claim_question(
  max_per_day integer default 15,
  -- Opus при около 6000 входни и 900 изходни токена на въпрос.
  cost_micro_eur integer default 60000,
  -- 5 евро, както при робота.
  alert_at_micro_eur bigint default 5000000
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  month_start date := date_trunc('month', (now() at time zone 'utc'))::date;
  row_day date;
  row_used integer;
  row_month date;
  row_spend bigint;
  row_alerted timestamptz;
  crossed boolean := false;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if max_per_day is null or max_per_day < 1 or max_per_day > 200 then
    raise exception 'invalid daily cap';
  end if;
  if cost_micro_eur is null or cost_micro_eur < 0 or cost_micro_eur > 2000000 then
    raise exception 'invalid cost estimate';
  end if;

  insert into public.viber_ask_quota (owner_id, day, spend_month)
    values (me, today, month_start)
    on conflict (owner_id) do nothing;

  -- Заключваме реда: два отворени прозореца иначе минават проверката
  -- едновременно и двата харчат.
  select q.day, q.used, q.spend_month, q.spend_micro_eur, q.spend_alert_sent_at
    into row_day, row_used, row_month, row_spend, row_alerted
    from public.viber_ask_quota q
    where q.owner_id = me
    for update;

  if row_day is distinct from today then
    row_day := today;
    row_used := 0;
  end if;
  if row_month is distinct from month_start then
    row_month := month_start;
    row_spend := 0;
    row_alerted := null;
  end if;

  if row_used >= max_per_day then
    return -1;
  end if;

  row_spend := row_spend + cost_micro_eur;
  -- Сигналът е еднократен за месеца: инак всеки следващ въпрос над прага праща
  -- ново писмо и собственикът спира да ги чете точно когато не трябва.
  if row_alerted is null and row_spend >= alert_at_micro_eur then
    row_alerted := now();
    crossed := true;
  end if;

  update public.viber_ask_quota set
    day                 = row_day,
    used                = row_used + 1,
    spend_month         = row_month,
    spend_micro_eur     = row_spend,
    spend_alert_sent_at = row_alerted
    where owner_id = me;

  if crossed then
    return 2;
  end if;
  return 1;
end;
$$;

grant execute on function
  public.viber_claim_question(integer, integer, bigint)
  to authenticated;
