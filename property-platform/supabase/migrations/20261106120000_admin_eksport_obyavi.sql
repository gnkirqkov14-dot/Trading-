-- Активните обяви с полетата, нужни за търсене на дубликати.
-- Само за админ: описание, адрес и телефон иначе не се четат с `select`.
create or replace function public.admin_eksport_obyavi()
returns table (
  id uuid,
  status text,
  type text,
  property_type text,
  title text,
  description text,
  grad text,
  kvartal text,
  price numeric,
  area_sqm numeric,
  rooms smallint,
  floor smallint,
  phone text,
  telefon text,
  address text,
  sobstvenik text,
  created_at timestamptz,
  updated_at timestamptz,
  broy_snimki integer,
  korica text,
  source_url text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.id, l.status::text, l.type::text, l.property_type::text, l.title,
         l.description, c.name, n.name, l.price, l.area_sqm, l.rooms, l.floor,
         l.phone, public.telefon_kanon(l.phone), l.address, p.name,
         l.created_at, l.updated_at,
         (select count(*)::int from public.listing_photos f where f.listing_id = l.id),
         (select f.url from public.listing_photos f where f.listing_id = l.id
           order by f.position limit 1),
         l.source_url
    from public.listings l
    left join public.cities c on c.id = l.city_id
    left join public.neighborhoods n on n.id = l.neighborhood_id
    left join public.profiles p on p.id = l.user_id
   where public.is_admin() and l.status = 'active'
   order by l.created_at, l.id;
$$;

revoke execute on function public.admin_eksport_obyavi() from public, anon;
grant execute on function public.admin_eksport_obyavi() to authenticated;
