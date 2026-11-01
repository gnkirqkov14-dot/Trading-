-- Брояч на посещенията за админ панела (/admin/statistika).
--
-- Анонимно: пази се случаен идентификатор от браузъра, адресът на
-- страницата, откъде е дошъл човекът и колко секунди е стоял. Без IP,
-- без имейл, без нищо, което сочи към конкретен човек.
--
-- Таблицата е затворена (RLS без политики). Браузърът пише само през
-- двете функции отдолу, а чете единствено админът през admin_statistika.

create table if not exists public.poseshteniya (
  id uuid primary key default gen_random_uuid(),
  posetitel text not null,
  sesiya text not null,
  pat text not null,
  listing_id uuid,
  iztochnik text,
  ustroistvo text,
  zapochna timestamptz not null default now(),
  posleden timestamptz not null default now(),
  sekundi integer not null default 0
);

create index if not exists poseshteniya_zapochna_idx on public.poseshteniya (zapochna desc);
create index if not exists poseshteniya_posleden_idx on public.poseshteniya (posleden desc);
create index if not exists poseshteniya_listing_idx on public.poseshteniya (listing_id) where listing_id is not null;

alter table public.poseshteniya enable row level security;

-- Начало на гледане на страница. Връща id, по което браузърът после
-- съобщава колко време е стоял.
create or replace function public.poseshtenie_nachalo(
  p_posetitel text, p_sesiya text, p_pat text, p_listing uuid,
  p_iztochnik text, p_ustroistvo text
) returns uuid
language sql security definer set search_path = public
as $$
  insert into public.poseshteniya (posetitel, sesiya, pat, listing_id, iztochnik, ustroistvo)
  values (left(p_posetitel, 40), left(p_sesiya, 40), left(p_pat, 300), p_listing,
          left(p_iztochnik, 60), left(p_ustroistvo, 10))
  returning id;
$$;

-- Пулс от отворената страница: колко секунди е видима досега.
-- Таванът от час пази от забравен раздел, който брои цяла нощ.
create or replace function public.poseshtenie_pulse(p_id uuid, p_sekundi integer)
returns void
language sql security definer set search_path = public
as $$
  update public.poseshteniya
     set sekundi = greatest(sekundi, least(coalesce(p_sekundi, 0), 3600)),
         posleden = now()
   where id = p_id and zapochna > now() - interval '6 hours';
$$;

grant execute on function public.poseshtenie_nachalo(text, text, text, uuid, text, text) to anon, authenticated;
grant execute on function public.poseshtenie_pulse(uuid, integer) to anon, authenticated;

-- Всичко за админ страницата наведнъж. Денят е софийски.
create or replace function public.admin_statistika()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  dnes timestamptz := date_trunc('day', now() at time zone 'Europe/Sofia') at time zone 'Europe/Sofia';
  rez jsonb;
begin
  if not exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin) then
    raise exception 'not authorized';
  end if;

  with sesii as (
    select sesiya, min(zapochna) zapochna, sum(sekundi) sekundi, count(*) stranici
      from public.poseshteniya where zapochna > now() - interval '30 days'
     group by sesiya
  )
  select jsonb_build_object(
    'sega', (select count(distinct posetitel) from public.poseshteniya where posleden > now() - interval '2 minutes'),
    'periodi', (select jsonb_agg(p) from (
        select ime,
               (select count(distinct posetitel) from public.poseshteniya v where v.zapochna >= ot and v.zapochna < do_) posetiteli,
               (select count(*) from public.poseshteniya v where v.zapochna >= ot and v.zapochna < do_) stranici,
               (select coalesce(round(avg(s.sekundi)), 0) from sesii s where s.zapochna >= ot and s.zapochna < do_) sredno_sek
          from (values ('Днес', dnes, now() + interval '1 minute', 1),
                       ('Вчера', dnes - interval '1 day', dnes, 2),
                       ('7 дни', now() - interval '7 days', now() + interval '1 minute', 3),
                       ('30 дни', now() - interval '30 days', now() + interval '1 minute', 4)) t(ime, ot, do_, red)
         order by red) p),
    'iztochnitsi', (select coalesce(jsonb_agg(i order by i.posetiteli desc), '[]') from (
        select coalesce(nullif(iztochnik, ''), 'директно') iztochnik, count(distinct posetitel) posetiteli
          from public.poseshteniya where zapochna > now() - interval '7 days'
         group by 1 order by 2 desc limit 10) i),
    'ustroistva', (select coalesce(jsonb_agg(u), '[]') from (
        select coalesce(ustroistvo, '?') ustroistvo, count(distinct posetitel) posetiteli
          from public.poseshteniya where zapochna > now() - interval '7 days' group by 1 order by 2 desc) u),
    'stranici', (select coalesce(jsonb_agg(s), '[]') from (
        select pat, count(*) pregledi, count(distinct posetitel) posetiteli, round(avg(sekundi)) sredno_sek
          from public.poseshteniya where zapochna > now() - interval '7 days' and listing_id is null
         group by pat order by 2 desc limit 15) s),
    'obqvi', (select coalesce(jsonb_agg(o), '[]') from (
        select v.listing_id, l.title, count(*) pregledi, count(distinct v.posetitel) posetiteli, round(avg(v.sekundi)) sredno_sek
          from public.poseshteniya v join public.listings l on l.id = v.listing_id
         where v.zapochna > now() - interval '7 days'
         group by v.listing_id, l.title order by 3 desc limit 15) o),
    'posledni', (select coalesce(jsonb_agg(x), '[]') from (
        select v.zapochna, v.pat, v.sekundi, v.iztochnik, v.ustroistvo, l.title,
               (v.posleden > now() - interval '2 minutes') aktiven
          from public.poseshteniya v left join public.listings l on l.id = v.listing_id
         order by v.zapochna desc limit 40) x)
  ) into rez;
  return rez;
end;
$$;

grant execute on function public.admin_statistika() to authenticated;
