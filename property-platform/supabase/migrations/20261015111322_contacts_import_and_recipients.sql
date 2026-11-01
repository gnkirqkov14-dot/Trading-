-- Един и същи човек идва като 0888 123 456, +359888123456 и 359888123456.
-- Ако не се сведат до един вид, плащаш по три съобщения за него и го
-- дразниш три пъти. Затова номерът се нормализира ПРИ ВНАСЯНЕ, а не при
-- показване — ключът е самият телефон.
create or replace function public.normalize_phone(raw text)
returns text
language plpgsql
immutable
as $function$
declare
  digits text;
begin
  if raw is null then return null; end if;
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  if digits = '' then return null; end if;

  if left(digits, 3) = '359' then
    digits := substr(digits, 4);
  elsif left(digits, 1) = '0' then
    digits := substr(digits, 2);
  end if;

  -- Българските мобилни са 9 цифри след кода (8xx xxx xxx).
  if length(digits) <> 9 then
    return null;
  end if;
  return '+359' || digits;
end;
$function$;

/**
 * Внася списък контакти наведнъж и ги слага в група.
 *
 * Връща какво е станало, за да се види честно: колко са влезли, колко са
 * били вече там и колко реда са отпаднали като негодни телефони.
 */
create or replace function public.import_contacts(
  rows_in jsonb,
  group_name text,
  source_in text,
  consent_note_in text
)
returns table (imported integer, already_there integer, rejected integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  gid uuid;
  r jsonb;
  p text;
  cid uuid;
  n_new integer := 0;
  n_old integer := 0;
  n_bad integer := 0;
  existed boolean;
begin
  if not public.is_admin() then
    raise exception 'only admin';
  end if;

  if group_name is not null and btrim(group_name) <> '' then
    insert into public.contact_groups (name) values (btrim(group_name))
    on conflict (name) do update set name = excluded.name
    returning id into gid;
  end if;

  for r in select * from jsonb_array_elements(rows_in)
  loop
    p := public.normalize_phone(r->>'phone');
    if p is null then
      n_bad := n_bad + 1;
      continue;
    end if;

    select true into existed from public.contacts where phone = p;

    insert into public.contacts (phone, name, source, consent_at, consent_note)
    values (p, nullif(btrim(coalesce(r->>'name','')), ''), source_in, now(), consent_note_in)
    on conflict (phone) do update
      -- Името се допълва само ако липсва: внасянето не бива да трие
      -- по-добри данни, събрани по-рано.
      set name = coalesce(public.contacts.name, excluded.name)
    returning id into cid;

    if existed then n_old := n_old + 1; else n_new := n_new + 1; end if;

    if gid is not null then
      insert into public.contact_group_members (group_id, contact_id)
      values (gid, cid) on conflict do nothing;
    end if;
    existed := null;
  end loop;

  return query select n_new, n_old, n_bad;
end;
$function$;

/**
 * Кой наистина ще получи съобщение от тази група.
 *
 * Отписаните и тези без записано съгласие отпадат ТУК, в заявката, за да
 * не зависи от това дали интерфейсът е филтрирал правилно.
 */
create or replace function public.campaign_recipients(group_id_in uuid)
returns table (id uuid, phone text, name text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.id, c.phone, c.name
    from public.contacts c
    join public.contact_group_members m on m.contact_id = c.id
   where m.group_id = group_id_in
     and c.unsubscribed_at is null
     and c.consent_at is not null
     and public.is_admin();
$function$;

revoke all on function public.import_contacts(jsonb, text, text, text) from public;
revoke all on function public.campaign_recipients(uuid) from public;
grant execute on function public.import_contacts(jsonb, text, text, text) to authenticated;
grant execute on function public.campaign_recipients(uuid) to authenticated;
