-- Property Platform — Phase 1 schema
-- Profiles, geo structure (cities/neighborhoods), listings + media,
-- messages, subscriptions. Row Level Security everywhere.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.subscription_plan as enum ('basic', 'pro', 'unlimited');
create type public.listing_deal_type as enum ('rent', 'sale');
create type public.property_type as enum ('apartment', 'house', 'plot', 'office', 'shop');
create type public.listing_status as enum ('active', 'inactive', 'expired');

-- ---------------------------------------------------------------------------
-- profiles — one row per auth.users, public-safe fields only
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  phone text,
  subscription_plan public.subscription_plan not null default 'basic',
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data ->> 'name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- cities / neighborhoods — map drill-down (area -> city -> neighborhood)
-- ---------------------------------------------------------------------------

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null, -- област
  lat double precision,
  lng double precision
);

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  name text not null,
  lat double precision,
  lng double precision
);

alter table public.cities enable row level security;
alter table public.neighborhoods enable row level security;

create policy "Cities are viewable by everyone"
  on public.cities for select using (true);

create policy "Neighborhoods are viewable by everyone"
  on public.neighborhoods for select using (true);

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.listing_deal_type not null,
  property_type public.property_type not null,
  city_id uuid references public.cities (id),
  neighborhood_id uuid references public.neighborhoods (id),
  lat double precision,
  lng double precision,
  price numeric(12, 2) not null,
  area_sqm numeric(8, 2) not null,
  rooms smallint,
  floor smallint,
  year_built smallint,
  heating text,
  has_parking boolean not null default false,
  has_elevator boolean not null default false,
  has_terrace boolean not null default false,
  is_furnished boolean not null default false,
  title text not null,
  description text,
  status public.listing_status not null default 'active',
  last_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index listings_search_idx
  on public.listings (type, property_type, city_id, status);
create index listings_price_idx on public.listings (price);
create index listings_area_idx on public.listings (area_sqm);

alter table public.listings enable row level security;

create policy "Active listings are viewable by everyone"
  on public.listings for select
  using (status <> 'expired' or auth.uid() = user_id);

create policy "Users can insert their own listings"
  on public.listings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own listings"
  on public.listings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own listings"
  on public.listings for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- listing photos / videos
-- ---------------------------------------------------------------------------

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  url text not null,
  position smallint not null default 0
);

create table public.listing_videos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  url text not null
);

alter table public.listing_photos enable row level security;
alter table public.listing_videos enable row level security;

create policy "Listing photos are viewable by everyone"
  on public.listing_photos for select using (true);

create policy "Owners manage their listing photos"
  on public.listing_photos for all
  using (
    auth.uid() = (select user_id from public.listings where id = listing_id)
  )
  with check (
    auth.uid() = (select user_id from public.listings where id = listing_id)
  );

create policy "Listing videos are viewable by everyone"
  on public.listing_videos for select using (true);

create policy "Owners manage their listing videos"
  on public.listing_videos for all
  using (
    auth.uid() = (select user_id from public.listings where id = listing_id)
  )
  with check (
    auth.uid() = (select user_id from public.listings where id = listing_id)
  );

-- ---------------------------------------------------------------------------
-- messages — simple inbox between two users about a listing
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create index messages_participants_idx
  on public.messages (to_user_id, from_user_id, created_at desc);

alter table public.messages enable row level security;

create policy "Participants can view their messages"
  on public.messages for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Users can send messages as themselves"
  on public.messages for insert
  with check (auth.uid() = from_user_id);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan public.subscription_plan not null,
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Inserts/updates are performed by the payment webhook via the service role
-- key, which bypasses RLS — no write policy is exposed to end users here.
