-- Property Platform — business model pivot (Phase 4 rework)
--
-- Publishing a listing is now free and unlimited for everyone (enforced
-- purely in application code — src/lib/actions/listings.ts no longer
-- checks any quota). Instead, a paid monthly subscription (profiles.
-- subscription_plan = 'pro' or 'unlimited') is required for SEARCHERS to
-- unlock full listing details and to message listing owners.
--
-- The app uses a public Supabase anon/publishable key, so RLS is the real
-- security boundary — hiding fields in the UI is not enough. This
-- migration replaces the Phase 1 messages INSERT policy so that only a
-- paid subscriber, or the owner of the listing being discussed (e.g.
-- replying to an inquiry on their own listing), can insert a message.
--
-- The "small preview only" part of the paywall (limited photos, hidden
-- description/phone/exact neighborhood) is enforced in application code
-- (src/app/listings/[id]/page.tsx) rather than RLS, because that data
-- must stay publicly SELECT-able for the public listing feed, search,
-- and SEO metadata to keep working for logged-out visitors.

drop policy if exists "Users can send messages as themselves" on public.messages;

create policy "Paid subscribers or listing owners can send messages"
  on public.messages for insert
  with check (
    auth.uid() = from_user_id
    and (
      exists (
        select 1 from public.profiles
        where id = auth.uid() and subscription_plan <> 'basic'
      )
      or exists (
        select 1 from public.listings
        where id = messages.listing_id and user_id = auth.uid()
      )
    )
  );
