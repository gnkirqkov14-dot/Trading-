-- Контактите на обява се отварят само през тази функция: брои уникалните
-- обяви на човек, за да не може профил да изтегли всичко с робот.
create table public.kontakt_pregledi (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  koga timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index kontakt_pregledi_koga_idx
  on public.kontakt_pregledi (user_id, koga desc);
alter table public.kontakt_pregledi enable row level security;

create or replace function public.obyava_kontakti(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l public.listings%rowtype;
  svoya boolean;
  v_chas integer;
  v_den integer;
begin
  if uid is null then return null; end if;

  select * into l from public.listings where id = p_id;
  if not found then return null; end if;

  svoya := l.user_id = uid or public.is_admin();

  if not svoya then
    if l.status not in ('active', 'expired') then return null; end if;
    if not exists (
      select 1 from public.profiles p where p.id = uid and p.phone is not null
    ) then
      return null;
    end if;

    delete from public.kontakt_pregledi
     where user_id = uid and koga < now() - interval '1 day';

    -- Повторно отваряне на същата обява в рамките на денонощието е безплатно.
    if not exists (
      select 1 from public.kontakt_pregledi
       where user_id = uid and listing_id = p_id
    ) then
      select count(*) filter (where koga > now() - interval '1 hour'), count(*)
        into v_chas, v_den
        from public.kontakt_pregledi where user_id = uid;

      if v_chas >= 40 or v_den >= 120 then
        return jsonb_build_object('limit', true);
      end if;

      insert into public.kontakt_pregledi (user_id, listing_id)
      values (uid, p_id);
    end if;
  end if;

  return jsonb_build_object(
    'description', l.description,
    'address', l.address,
    'phone', l.phone,
    'lat', l.lat,
    'lng', l.lng
  );
end;
$$;

create or replace function public.admin_telefoni_obyavi(p_ids uuid[])
returns table (id uuid, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.phone from public.listings l
   where public.is_admin() and l.id = any (p_ids);
$$;

-- Само името на друг потребител, без реда от профила му.
create or replace function public.ime_na_profil(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select name from public.profiles where id = p_id;
$$;

revoke execute on function public.obyava_kontakti(uuid) from public, anon;
revoke execute on function public.admin_telefoni_obyavi(uuid[]) from public, anon;
grant execute on function public.obyava_kontakti(uuid) to authenticated;
grant execute on function public.admin_telefoni_obyavi(uuid[]) to authenticated;
grant execute on function public.ime_na_profil(uuid) to anon, authenticated;
