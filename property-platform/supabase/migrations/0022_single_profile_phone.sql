-- Собственикът поиска: един телефон на потребител, не различен телефон
-- за всяка обява. Занапред `listings.phone` вече не се приема от
-- клиента (виж createListing/updateListing) — винаги се взима от
-- `profiles.phone`. Този тригер държи вече публикуваните обяви
-- синхронизирани веднага щом потребителят си смени телефона в профила,
-- без да се налага да отваря и запазва всяка обява поотделно.

create or replace function public.sync_listings_phone()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.phone is distinct from old.phone and new.phone is not null and new.phone <> '' then
    update public.listings set phone = new.phone where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_phone_updated on public.profiles;
create trigger on_profile_phone_updated
  after update of phone on public.profiles
  for each row execute function public.sync_listings_phone();
