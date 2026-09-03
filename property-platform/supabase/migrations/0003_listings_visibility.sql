-- Property Platform — Phase 2 fix
-- Per the spec, a listing that misses its weekly confirmation becomes
-- "неактуална" (expired) and sinks in search results but stays visible —
-- it is not deleted or hidden. Only a manually deactivated ("inactive")
-- listing should be hidden from public view. The Phase 1 policy hid
-- "expired" instead of "inactive" — correct it here.

drop policy if exists "Active listings are viewable by everyone" on public.listings;

create policy "Public can view active and expired listings"
  on public.listings for select
  using (status in ('active', 'expired') or auth.uid() = user_id);
