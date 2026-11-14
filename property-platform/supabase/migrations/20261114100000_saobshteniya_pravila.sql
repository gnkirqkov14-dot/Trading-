-- Одит №11: правила за съобщенията, наложени в самата база.
--
-- Досега базата проверяваше само, че подателят е влезлият потребител.
-- С директна заявка един акаунт можеше да пише на когото си иска,
-- колкото си иска и с произволна дължина. Тригерът по-долу важи и за
-- сайта, и за директните заявки.
--
-- Правила:
--   * съобщението е за конкретна обява и е между 1 и 2000 знака;
--   * единият от двамата е собственикът на обявата;
--   * собственикът може само да отговаря на човек, който вече му е писал;
--   * най-много 60 съобщения на час и 200 на денонощие от един акаунт,
--     и до 30 различни получатели на денонощие.
-- Лимитите са далеч над нормалната употреба; целта им е да спрат скрипт.
-- Админът и сървърните задачи (без влязъл потребител) не се ограничават.

create index if not exists messages_podatel_idx
  on public.messages (from_user_id, created_at desc);

create or replace function public.saobshtenie_pravila()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sobstvenik uuid;
  v_chas int;
  v_den int;
  v_poluchateli int;
begin
  if uid is null or public.is_admin() then
    return new;
  end if;

  new.content := btrim(new.content);
  if new.content = '' then
    raise exception 'Съобщението не може да е празно.';
  end if;
  if char_length(new.content) > 2000 then
    raise exception 'Съобщението е твърде дълго. Най-много 2000 знака.';
  end if;
  if new.from_user_id = new.to_user_id then
    raise exception 'Не можеш да пишеш сам на себе си.';
  end if;

  select l.user_id into sobstvenik
    from public.listings l where l.id = new.listing_id;
  if sobstvenik is null then
    raise exception 'Обявата не е намерена.';
  end if;

  if sobstvenik = new.from_user_id then
    -- Собственикът отговаря: другият трябва вече да му е писал за тази обява.
    if not exists (
      select 1 from public.messages m
       where m.listing_id = new.listing_id
         and m.from_user_id = new.to_user_id
         and m.to_user_id = new.from_user_id
    ) then
      raise exception 'Можеш да отговаряш само на хора, които са ти писали.';
    end if;
  elsif sobstvenik <> new.to_user_id then
    raise exception 'Съобщението трябва да е до собственика на обявата.';
  end if;

  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*),
         count(distinct to_user_id)
    into v_chas, v_den, v_poluchateli
    from public.messages
   where from_user_id = new.from_user_id
     and created_at > now() - interval '1 day';

  if v_chas >= 60 or v_den >= 200 then
    raise exception 'Изпрати твърде много съобщения. Опитай пак по-късно.';
  end if;
  if v_poluchateli >= 30 and not exists (
    select 1 from public.messages m
     where m.from_user_id = new.from_user_id
       and m.to_user_id = new.to_user_id
       and m.created_at > now() - interval '1 day'
  ) then
    raise exception 'Писа на твърде много хора днес. Опитай пак утре.';
  end if;

  return new;
end;
$$;

revoke all on function public.saobshtenie_pravila() from public, anon, authenticated;

drop trigger if exists saobshtenie_pravila on public.messages;
create trigger saobshtenie_pravila
  before insert on public.messages
  for each row execute function public.saobshtenie_pravila();
