-- Телефонът е задължителен и всеки номер е само на един профил.
--
-- Правилото е в базата, не само във формите: приложението ползва
-- публичен ключ и всеки логнат може да пише в profiles.phone директно.
-- Сравнява се единният вид на номера, за да са едно и също 0888 123 456,
-- +359888123456 и 00359 888 123 456. Приемат се номера от всяка държава.
--
-- NULL е позволен: Google вход създава профил без телефон. Такъв
-- потребител се спира другаде (proxy, auth/callback, страницата на
-- обявата), докато не въведе номер, а писането на съобщения е спряно
-- тук, в политиката.

-- Единен вид на номера: +<код на държавата><номер>, иначе NULL.
-- Чуждите номера идват с + или 00. Номер, започващ с една нула, е
-- български (мобилен или стационарен). normalize_phone не става за
-- това: тя познава само българските и за чуждите връща NULL, а уникален
-- индекс върху NULL не спира нищо.
create or replace function public.telefon_kanon(raw text)
returns text
language plpgsql immutable
as $$
declare
  s text := regexp_replace(coalesce(raw, ''), '[^0-9+]', '', 'g');
  d text;
begin
  if s ~ '^00' then
    s := '+' || substr(s, 3);
  end if;

  if s ~ '^\+' then
    d := regexp_replace(s, '[^0-9]', '', 'g');
    if d ~ '^3590' then
      d := '359' || substr(d, 5);
    end if;
  elsif s ~ '^0[1-9]' then
    d := '359' || substr(s, 2);
  elsif s ~ '^359' then
    d := s;
  elsif s ~ '^8[7-9][0-9]{7}$' then
    d := '359' || s;
  else
    return null;
  end if;

  -- Международният стандарт е до 15 цифри.
  if d !~ '^[1-9][0-9]{7,14}$' then
    return null;
  end if;
  if d ~ '^359' and length(d) not in (11, 12) then
    return null;
  end if;
  return '+' || d;
end;
$$;

create unique index if not exists profiles_telefon_edinstven
  on public.profiles (public.telefon_kanon(phone));

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

  nov := public.telefon_kanon(new.phone);
  if tg_op = 'UPDATE' and nov is not distinct from public.telefon_kanon(old.phone) then
    new.phone := old.phone;
    return new;
  end if;
  if nov is null then
    raise exception 'Въведи валиден телефон. Чуждите номера са с код на държавата, например +49 170 1234567.';
  end if;
  if exists (
    select 1 from public.agency_bans
    where kind = 'phone' and public.telefon_kanon(value) = nov
  ) then
    raise exception 'Този телефон е блокиран за регистрация.';
  end if;

  -- Пази се в обичайния вид: така се показва на обявите.
  new.phone := case when nov like '+359%' then '0' || substr(nov, 5) else nov end;
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
  nov text := public.telefon_kanon(p_phone);
begin
  if nov is null then return 'nevaliden'; end if;
  if exists (
    select 1 from public.agency_bans
    where kind = 'phone' and public.telefon_kanon(value) = nov
  ) then
    return 'blokiran';
  end if;
  if exists (
    select 1 from public.profiles
    where public.telefon_kanon(phone) = nov
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
