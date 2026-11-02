-- Съгласието на собственика, когато администраторът качва обявата вместо него.
create table public.obyava_saglasie (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  ime text not null,
  telefon text not null,
  data date not null,
  dobaveno_ot uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.obyava_saglasie enable row level security;

create policy "Admins manage owner consent"
  on public.obyava_saglasie for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
