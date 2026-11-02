-- Публичният ключ е в браузъра на всеки посетител и минава покрай proxy.ts,
-- затова контактите на обявите и профилите се затварят в самата база.
-- Нова колона на listings остава затворена за anon, докато не се разреши.
revoke select on public.listings from anon;
grant select (
  id, user_id, created_at, updated_at, type, property_type, price, area_sqm,
  rooms, floor, year_built, heating, has_parking, has_elevator, has_terrace,
  is_furnished, title, status, project_name, construction_stage,
  completion_year, city_id, neighborhood_id, developer_id, view_count,
  last_confirmed_at
) on public.listings to anon;

revoke select (phone, listing_limit, subscription_plan, subscription_expires_at)
  on public.profiles from anon;

-- Адресите на снимките остават публични; махат се само изброяването на
-- папките в хранилището и извикването на квотите на чужд профил без вход.
drop policy "Public read listing photos" on storage.objects;
create policy "Signed-in read listing photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos');

revoke execute on function public.assistant_consume_account_quota(uuid, integer)
  from public, anon;
revoke execute on function public.assistant_refund_account_quota(uuid)
  from public, anon;
