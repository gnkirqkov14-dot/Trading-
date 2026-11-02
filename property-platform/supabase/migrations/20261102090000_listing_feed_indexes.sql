-- Без тях заявката за обяви със снимки надхвърля 3-те секунди на anon
-- и началната страница и /listings излизат празни.
create index if not exists listing_photos_listing_id_idx
  on public.listing_photos (listing_id, position);

create index if not exists listings_status_created_idx
  on public.listings (status, created_at desc);
