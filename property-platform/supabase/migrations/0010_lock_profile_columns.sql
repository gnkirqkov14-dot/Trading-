-- Security fix, found while building the profile-settings feature.
--
-- The "Users can update their own profile" policy (0001_init.sql) only
-- restricts which ROW a user may update (auth.uid() = id) — it has no
-- `with check` and Supabase's default table grants give `authenticated`
-- (and `anon`) blanket UPDATE on every column. The app ships a public
-- anon/publishable key, so any signed-in user could currently call the
-- Supabase REST API directly and:
--   - set their own subscription_plan to 'pro'/'unlimited', bypassing the
--     entire search paywall (0008_search_subscription_paywall.sql) for
--     free, or
--   - set is_admin = true, granting themselves full admin access
--     (0007_admin.sql).
-- Neither was ever possible through the app's own UI, but the database
-- itself allowed it. Column-level grants close this regardless of what
-- the UI does.
--
-- Going forward, signed-in users may only update their own name/phone —
-- exactly what the new /dashboard/profile page needs and nothing more.
-- subscription_plan/is_admin stay writable only via the service_role key
-- (e.g. a future payment webhook, or direct DB access by the project
-- owner).

revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;
grant update (name, phone) on public.profiles to authenticated;
