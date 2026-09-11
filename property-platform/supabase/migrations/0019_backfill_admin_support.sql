-- 0007_admin.sql никога не е била пусната ръчно в живата база (същия
-- проблем като 0005 — виж 0015_backfill_neighborhood_coordinates.sql) —
-- profiles.is_admin липсваше изцяло, затова "update ... set is_admin"
-- гърмеше с "column does not exist". Реплика на 0007 под нов номер,
-- с idempotent guards (if not exists / drop policy if exists), в случай
-- че част от нея все пак се е приложила по-рано.

alter table public.profiles add column if not exists is_admin boolean not null default false;

drop policy if exists "Admins can update any listing" on public.listings;
create policy "Admins can update any listing"
  on public.listings for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can delete any listing" on public.listings;
create policy "Admins can delete any listing"
  on public.listings for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
