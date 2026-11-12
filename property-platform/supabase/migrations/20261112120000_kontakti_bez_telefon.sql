-- obyava_kontakti вече не връща телефона на чужда обява. Той идва само от
-- obyava_telefon, която иска тайния низ на сървъра — така робот с профил не
-- може да го изтегли направо от базата и да прескочи „не съм робот“.
-- Всичко друго във функцията е без промяна.
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
    'phone', case when svoya then l.phone end,
    'lat', l.lat,
    'lng', l.lng
  );
end;
$$;
