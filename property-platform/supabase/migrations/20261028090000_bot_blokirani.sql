-- Дневник на спрените копирачи (src/proxy.ts) и сутрешен отчет до
-- собственика (app/api/cron/bot-report).
--
-- Таблицата е затворена (RLS без политики). Пише се само през
-- bot_zapishi с тайния низ от private.settings (същият като за
-- напомнянията) — иначе всеки с публичния ключ би могъл да я пълни.
-- IP адресът не се пази, само хеш, за да се види дали е един и същ
-- източник.

create table if not exists public.bot_blokirani (
  id bigint generated always as identity primary key,
  koga timestamptz not null default now(),
  agent text not null,
  pat text not null,
  ip_hash text
);

create index if not exists bot_blokirani_koga_idx on public.bot_blokirani (koga desc);

alter table public.bot_blokirani enable row level security;

create or replace function public.bot_zapishi(
  p_secret text, p_agent text, p_pat text, p_ip_hash text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (
    select value from private.settings where key = 'reminders_secret'
  ) then
    raise exception 'forbidden';
  end if;
  insert into public.bot_blokirani (agent, pat, ip_hash)
  values (left(coalesce(p_agent, ''), 300), left(coalesce(p_pat, ''), 300), left(p_ip_hash, 64));
end;
$$;

-- Обобщение за последните p_chasa часа: колко заявки, от колко
-- източника и кои програми. Само с тайния низ (cron) или за админ.
create or replace function public.bot_otchet(p_secret text, p_chasa integer default 24)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  rez jsonb;
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false)
     and (p_secret is null or p_secret <> (
       select value from private.settings where key = 'reminders_secret'
     )) then
    raise exception 'forbidden';
  end if;

  -- Стари записи не трябват: пазим 30 дни.
  delete from public.bot_blokirani where koga < now() - interval '30 days';

  select jsonb_build_object(
    'zayavki', count(*),
    'iztochnici', count(distinct ip_hash),
    'programi', coalesce((
      select jsonb_agg(jsonb_build_object('agent', agent, 'broi', broi) order by broi desc)
      from (
        select agent, count(*) broi from public.bot_blokirani
        where koga > now() - make_interval(hours => p_chasa)
        group by agent order by broi desc limit 10
      ) a
    ), '[]'::jsonb),
    'stranici', coalesce((
      select jsonb_agg(jsonb_build_object('pat', pat, 'broi', broi) order by broi desc)
      from (
        select pat, count(*) broi from public.bot_blokirani
        where koga > now() - make_interval(hours => p_chasa)
        group by pat order by broi desc limit 5
      ) s
    ), '[]'::jsonb)
  ) into rez
  from public.bot_blokirani
  where koga > now() - make_interval(hours => p_chasa);

  return rez;
end;
$$;

revoke execute on function public.bot_zapishi(text, text, text, text) from public;
revoke execute on function public.bot_otchet(text, integer) from public;
grant execute on function public.bot_zapishi(text, text, text, text) to anon, authenticated;
grant execute on function public.bot_otchet(text, integer) to anon, authenticated;
