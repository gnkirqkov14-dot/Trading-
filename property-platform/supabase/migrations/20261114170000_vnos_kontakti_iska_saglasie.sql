-- Вносът на телефони записва съгласие за всеки контакт. Досега само
-- формата в админа проверяваше дали е описано откъде е съгласието;
-- самата функция приемаше и празно. Сега отказва: без описание няма
-- внос, откъдето и да е извикана.

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

  if consent_note_in is null or btrim(consent_note_in) = '' then
    raise exception 'Опиши откъде е съгласието, преди да внесеш контакти.';
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
    values (p, nullif(btrim(coalesce(r->>'name','')), ''), source_in, now(), btrim(consent_note_in))
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
