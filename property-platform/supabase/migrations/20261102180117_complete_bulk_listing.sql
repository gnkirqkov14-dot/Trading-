-- Publish each imported property and all photo references in one transaction.
-- A row lock serializes retries and concurrent tabs. RLS stays in force.
create or replace function public.complete_bulk_listing(p_id uuid, p_urls text[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.listing_status;
  v_pattern text;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Само администратор може да внася обяви.' using errcode = '42501';
  end if;

  select status into v_status from public.listings
    where id = p_id and user_id = v_uid for update;
  if not found then
    raise exception 'Обявата не е намерена.';
  end if;
  if v_status = 'active' then return; end if;
  if v_status <> 'inactive' then
    raise exception 'Обявата не е подготвена за внасяне.';
  end if;

  if coalesce(cardinality(p_urls), 0) not between 1 and 30
     or exists (select 1 from unnest(p_urls) u where u is null)
     or cardinality(p_urls) <> (select count(distinct u) from unnest(p_urls) u) then
    raise exception 'Нужни са между 1 и 30 различни снимки.';
  end if;
  v_pattern := '^https://[a-z0-9.-]+/storage/v1/object/public/listing-photos/'
    || v_uid::text || '/' || p_id::text || '/bulk-[0-9]+-[0-9a-f]{32}[.]jpg$';
  if exists (select 1 from unnest(p_urls) u where u !~ v_pattern) then
    raise exception 'Невалиден адрес на снимка.';
  end if;
  if exists (
    select 1 from unnest(p_urls) u where not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'listing-photos'
        and o.name = split_part(u, '/listing-photos/', 2)
        and coalesce((o.metadata->>'size')::bigint, 0) > 0
    )
  ) then
    raise exception 'Не всички снимки са качени. Опитай отново.';
  end if;
  if exists (select 1 from public.listing_photos where listing_id = p_id and not (url = any(p_urls))) then
    raise exception 'Обявата има други снимки. Прегледай я отделно.';
  end if;

  insert into public.listing_photos (listing_id, url, position)
    select p_id, u.url, (u.position - 1)::smallint
    from unnest(p_urls) with ordinality u(url, position)
    where not exists (select 1 from public.listing_photos p where p.listing_id = p_id and p.url = u.url);
  update public.listings set status = 'active', last_confirmed_at = now(), reminder_count = 0
    where id = p_id and user_id = v_uid;
end;
$$;

revoke all on function public.complete_bulk_listing(uuid, text[]) from public, anon;
grant execute on function public.complete_bulk_listing(uuid, text[]) to authenticated;
