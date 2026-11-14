-- Одит №14, стъпка 1: проверките за телефон и за блокиран контакт
-- минават само през сървъра на сайта.
--
-- proveri_telefon и is_contact_banned можеха да се викат направо с
-- публичния ключ. Така всеки можеше да пита подред „този номер има ли
-- профил“ и „този имейл блокиран ли е“. Новите две функции искат тайния
-- низ на сървъра (същия като при obyava_telefon). Старите се затварят
-- със следващата миграция, след като новият код е пуснат, за да няма
-- минути, в които регистрацията не работи.

create or replace function public.proveri_telefon_srv(p_secret text, p_phone text)
returns text
language plpgsql
stable
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
  -- auth.uid() остава на влезлия потребител, затова собственият му
  -- номер не се брои за зает.
  return public.proveri_telefon(p_phone);
end;
$$;

create or replace function public.blokiran_kontakt_srv(
  p_secret text, p_phone text, p_email text
)
returns boolean
language plpgsql
stable
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
  return public.is_contact_banned(p_phone, p_email);
end;
$$;

revoke all on function public.proveri_telefon_srv(text, text) from public;
revoke all on function public.blokiran_kontakt_srv(text, text, text) from public;
grant execute on function public.proveri_telefon_srv(text, text) to anon, authenticated;
grant execute on function public.blokiran_kontakt_srv(text, text, text) to anon, authenticated;
