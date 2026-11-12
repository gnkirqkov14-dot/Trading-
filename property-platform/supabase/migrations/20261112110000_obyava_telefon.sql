-- Телефонът на обява се дава отделно от другите контакти и само на сървъра
-- на сайта (таен низ). Така робот с профил не може да го изтегли направо от
-- базата и да прескочи проверката „не съм робот“ на страницата.
create or replace function public.obyava_telefon(p_id uuid, p_secret text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_taen text;
  v_tel text;
  v_sobstvenik uuid;
begin
  if uid is null then return null; end if;

  select value into v_taen from private.settings where key = 'reminders_secret';
  if v_taen is null or p_secret is null or p_secret <> v_taen then
    raise exception 'forbidden';
  end if;

  select l.phone, l.user_id into v_tel, v_sobstvenik
    from public.listings l where l.id = p_id;
  if not found then return null; end if;

  if v_sobstvenik = uid or public.is_admin() then return v_tel; end if;

  -- Чужда обява: само ако контактите ѝ вече са отворени през
  -- obyava_kontakti, която пази лимита на профил.
  if exists (
    select 1 from public.kontakt_pregledi k
     where k.user_id = uid and k.listing_id = p_id
       and k.koga > now() - interval '1 day'
  ) then
    return v_tel;
  end if;

  return null;
end;
$$;

revoke execute on function public.obyava_telefon(uuid, text) from public, anon;
grant execute on function public.obyava_telefon(uuid, text) to authenticated;
