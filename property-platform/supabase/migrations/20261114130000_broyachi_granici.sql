-- Одит №15, стъпка 1: граници за броячите.
--
-- Броячът на посещенията пише направо от браузъра (нарочно, за да не
-- товари Vercel), затова всеки можеше да вика функциите му колкото си
-- иска: да пълни таблицата и да изкривява статистиката. Тук функциите
-- сами отказват излишното. Истинските посетители са далеч под границите
-- (до днес: най-много 81 страници на посетител за ден и 120 за минута
-- общо).
--
-- Броячът на прегледите на обява се вика само от сървъра, затова получава
-- версия с тайния низ. Старата се затваря със следващата миграция.

create index if not exists poseshteniya_posetitel_idx
  on public.poseshteniya (posetitel, zapochna desc);

create or replace function public.poseshtenie_nachalo(
  p_posetitel text, p_sesiya text, p_pat text,
  p_listing uuid, p_iztochnik text, p_ustroistvo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posetitel text := left(coalesce(p_posetitel, ''), 40);
  v_sesiya text := left(coalesce(p_sesiya, ''), 40);
  v_pat text := left(coalesce(p_pat, ''), 300);
  v_id uuid;
begin
  -- Без посетител, сесия или вътрешен адрес няма какво да се брои.
  if length(v_posetitel) < 8 or length(v_sesiya) < 8 or left(v_pat, 1) <> '/' then
    return null;
  end if;

  -- Един посетител: до 300 страници на ден.
  if (select count(*) from public.poseshteniya
       where posetitel = v_posetitel
         and zapochna > now() - interval '1 day') >= 300 then
    return null;
  end if;

  -- Общо за сайта: до 600 на минута и 8000 на час. Над това е наводнение,
  -- не посетители, и записите се прескачат, докато отмине.
  if (select count(*) from public.poseshteniya
       where zapochna > now() - interval '1 minute') >= 600
     or (select count(*) from public.poseshteniya
          where zapochna > now() - interval '1 hour') >= 8000 then
    return null;
  end if;

  -- Обява, която не съществува, не се записва като обява.
  if p_listing is not null
     and not exists (select 1 from public.listings where id = p_listing) then
    p_listing := null;
  end if;

  insert into public.poseshteniya (posetitel, sesiya, pat, listing_id, iztochnik, ustroistvo)
  values (v_posetitel, v_sesiya, v_pat, p_listing,
          left(p_iztochnik, 60), left(p_ustroistvo, 10))
  returning id into v_id;
  return v_id;
end;
$$;

-- Времето на страницата не може да е повече от изминалото от отварянето ѝ
-- (плюс малък запас), за да не се записват измислени минути.
create or replace function public.poseshtenie_pulse(p_id uuid, p_sekundi integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.poseshteniya
     set sekundi = greatest(
           sekundi,
           least(
             greatest(coalesce(p_sekundi, 0), 0),
             3600,
             extract(epoch from now() - zapochna)::int + 30
           )
         ),
         posleden = now()
   where id = p_id and zapochna > now() - interval '6 hours';
$$;

create or replace function public.pregled_na_obyava_srv(p_secret text, p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_taen text;
begin
  select value into v_taen from private.settings where key = 'reminders_secret';
  if v_taen is null or p_secret is null or p_secret <> v_taen then
    raise exception 'forbidden';
  end if;
  update public.listings set view_count = view_count + 1 where id = p_listing_id;
end;
$$;

revoke all on function public.pregled_na_obyava_srv(text, uuid) from public;
grant execute on function public.pregled_na_obyava_srv(text, uuid) to anon, authenticated;
