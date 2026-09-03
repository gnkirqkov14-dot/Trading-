-- Property Platform — Phase 6
-- Minimal admin/moderation support: an is_admin flag on profiles, plus
-- RLS policies letting admins manage any listing (owners already can via
-- the Phase 1 policies — these add on top, RLS policies for the same
-- command are OR'd together).

alter table public.profiles add column is_admin boolean not null default false;

create policy "Admins can update any listing"
  on public.listings for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can delete any listing"
  on public.listings for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- To make yourself an admin, run (after signing up):
--   update public.profiles set is_admin = true where id = '<your-user-id>';
