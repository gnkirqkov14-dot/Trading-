-- Пазачи на таблицата с обяви.
--
-- Досега лимитът от обяви, блокираните телефони и скриването от админ се
-- проверяваха само в кода на сайта. Влязъл потребител може да говори с
-- базата и направо (ключът за това е публичен) и така да ги заобиколи:
-- да качи стотици обяви, да върне скрита от админ обява, да си надуе
-- броя гледания. Тук същите правила се налагат в самата база.
--
-- Правилата важат само за директни заявки на обикновен потребител.
-- Админът и вътрешните функции (броячът на гледания, напомнянията,
-- блокирането на агенция) минават без ограничение.

alter table public.listings
  add column if not exists skrita_ot_admin boolean not null default false;

comment on column public.listings.skrita_ot_admin is
  'Обявата е скрита от админ; собственикът не може сам да я върне.';

-- Проверките при нова обява: блокиран контакт и лимит. Работи само за
-- влезлия потребител (auth.uid()), затова е безопасна за извикване.
create or replace function public.listing_guard_nova(p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_limit integer;
  v_broy integer;
begin
  if v_uid is null then
    raise exception 'Трябва да си влязъл, за да качиш обява.';
  end if;

  -- Две едновременни заявки от един акаунт се редят една след друга,
  -- иначе и двете биха минали под лимита.
  perform pg_advisory_xact_lock(hashtext('listing_limit:' || v_uid::text));

  select email, coalesce(listing_limit, 3) into v_email, v_limit
  from public.profiles where id = v_uid;

  if public.is_contact_banned(p_phone, v_email) then
    raise exception 'Този телефон или имейл е блокиран за публикуване на обяви.';
  end if;

  select count(*) into v_broy from public.listings where user_id = v_uid;
  if v_broy >= coalesce(v_limit, 3) then
    raise exception 'Достигна лимита от % обяви за един акаунт.', coalesce(v_limit, 3);
  end if;
end;
$$;

-- Блокиран ли е влезлият потребител (по този телефон или по имейла му).
create or replace function public.listing_guard_blokiran(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_contact_banned(
    p_phone,
    (select email from public.profiles where id = auth.uid())
  );
$$;

revoke all on function public.listing_guard_nova(text) from public, anon;
revoke all on function public.listing_guard_blokiran(text) from public, anon;
grant execute on function public.listing_guard_nova(text) to authenticated;
grant execute on function public.listing_guard_blokiran(text) to authenticated;

-- Самият пазач. НЕ е security definer нарочно: така current_user показва
-- кой наистина пише — „authenticated“ при директна заявка и собственика
-- на функцията, когато редът се пипа от вътрешна функция.
create or replace function public.listing_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_direktno boolean := current_user in ('authenticated', 'anon');
  v_admin boolean := public.is_admin();
begin
  -- Админ скрива или връща чужда обява: помним го.
  if tg_op = 'UPDATE' and v_admin
     and new.status is distinct from old.status
     and auth.uid() is distinct from old.user_id then
    new.skrita_ot_admin := new.status in ('inactive', 'archived');
  end if;

  if not v_direktno or v_admin then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.listing_guard_nova(new.phone);

    if new.status not in ('active', 'inactive') then
      new.status := 'active';
    end if;
    new.view_count := 0;
    new.reminder_count := 0;
    new.created_at := now();
    new.last_confirmed_at := now();
    new.developer_id := null;
    new.source_url := null;
    new.source_checked_at := null;
    new.source_gone_at := null;
    new.lat := null;
    new.lng := null;
    new.skrita_ot_admin := false;
    return new;
  end if;

  -- UPDATE от собственика: служебните колони остават както са.
  new.user_id := old.user_id;
  new.view_count := old.view_count;
  new.created_at := old.created_at;
  new.developer_id := old.developer_id;
  new.source_url := old.source_url;
  new.source_checked_at := old.source_checked_at;
  new.source_gone_at := old.source_gone_at;
  new.lat := old.lat;
  new.lng := old.lng;
  new.skrita_ot_admin := old.skrita_ot_admin;
  if new.reminder_count is distinct from old.reminder_count then
    new.reminder_count := 0;
  end if;
  if new.last_confirmed_at is distinct from old.last_confirmed_at then
    new.last_confirmed_at := now();
  end if;

  if new.status is distinct from old.status then
    if new.status not in ('active', 'inactive') then
      raise exception 'Този статус не може да се задава от собственика.';
    end if;
    if old.status = 'archived' then
      raise exception 'Обявата е архивирана и не може да се върне.';
    end if;
    if new.status = 'active' then
      if old.skrita_ot_admin then
        raise exception 'Обявата е скрита от администратор. Пиши ни, ако смяташ, че е грешка.';
      end if;
      if public.listing_guard_blokiran(new.phone) then
        raise exception 'Този телефон или имейл е блокиран за публикуване на обяви.';
      end if;
    end if;
  end if;

  if new.phone is distinct from old.phone
     and public.listing_guard_blokiran(new.phone) then
    raise exception 'Този телефон е блокиран за публикуване на обяви.';
  end if;

  return new;
end;
$$;

drop trigger if exists a_listing_guard on public.listings;
create trigger a_listing_guard
  before insert or update on public.listings
  for each row execute function public.listing_guard();
