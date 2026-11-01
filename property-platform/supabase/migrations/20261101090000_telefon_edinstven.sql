-- Телефонът е задължителен и всеки номер е само на един профил.
--
-- Правилото е в базата, не само във формите: приложението ползва
-- публичен ключ и всеки логнат може да пише в profiles.phone директно.
-- Сравнява се нормализираният номер, за да са едно и също 0888 123 456,
-- +359888123456 и 00359 888 123 456.
--
-- NULL е позволен: Google вход създава профил без телефон. Такъв
-- потребител се спира другаде (proxy, auth/callback, страницата на
-- обявата), докато не въведе номер, а писането на съобщения е спряно
-- тук, в политиката.

-- Всички български мобилни: 087/088/089 + 7 цифри. Иначе NULL.
create or replace function public.mobilen_telefon(raw text)
returns text
language sql immutable
as $$
  select case when n ~ '^\+3598[7-9][0-9]{7}$' then n end
  from public.normalize_phone(
    regexp_replace(regexp_replace(raw, '[^0-9+]', '', 'g'), '^00', '')
  ) as n;
$$;

create unique index if not exists profiles_telefon_edinstven
  on public.profiles (public.normalize_phone(phone));

create or replace function public.profiles_proveri_telefon()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  nov text;
begin
  if new.phone is null or btrim(new.phone) = '' then
    if tg_op = 'UPDATE' and old.phone is not null and btrim(old.phone) <> '' then
      raise exception 'Телефонът е задължителен.';
    end if;
    new.phone := null;
    return new;
  end if;

  nov := public.mobilen_telefon(new.phone);
  if tg_op = 'UPDATE' and nov is not distinct from public.normalize_phone(old.phone) then
    new.phone := old.phone;
    return new;
  end if;
  if nov is null then
    raise exception 'Въведи български мобилен номер, например 0888 123 456.';
  end if;
  if exists (
    select 1 from public.agency_bans
    where kind = 'phone' and public.normalize_phone(value) = nov
  ) then
    raise exception 'Този телефон е блокиран за регистрация.';
  end if;

  -- Пази се в обичайния вид: така се показва на обявите.
  new.phone := '0' || substr(nov, 5);
  return new;
end;
$$;

drop trigger if exists on_profile_phone_check on public.profiles;
create trigger on_profile_phone_check
  before insert or update of phone on public.profiles
  for each row execute function public.profiles_proveri_telefon();

-- Предварителна проверка за формите, за да има ясно съобщение.
-- Връща ok / nevaliden / zaet / blokiran и нищо за чуждия профил.
create or replace function public.proveri_telefon(p_phone text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  nov text := public.mobilen_telefon(p_phone);
begin
  if nov is null then return 'nevaliden'; end if;
  if exists (
    select 1 from public.agency_bans
    where kind = 'phone' and public.normalize_phone(value) = nov
  ) then
    return 'blokiran';
  end if;
  if exists (
    select 1 from public.profiles
    where public.normalize_phone(phone) = nov
      and id is distinct from auth.uid()
  ) then
    return 'zaet';
  end if;
  return 'ok';
end;
$$;

grant execute on function public.proveri_telefon(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.agency_bans where kind = 'email' and value = new.email
  ) then
    raise exception 'Този имейл е блокиран за регистрация.';
  end if;

  insert into public.profiles (id, name, email, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    new.email,
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

drop policy if exists "Authenticated users can send messages as themselves" on public.messages;
create policy "Authenticated users can send messages as themselves"
  on public.messages for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and phone is not null
    )
  );
