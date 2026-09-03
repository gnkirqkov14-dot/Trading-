-- Property Platform — Phase 5
-- Weekly re-confirmation: a listing not confirmed by its owner within 7
-- days auto-expires (sinks in search results, per the RLS policy in
-- 0003, but is never deleted).
--
-- security definer so it can flip ANY user's stale listings without
-- needing the service_role key in application code — called via RPC
-- from a Vercel Cron-triggered API route using the public anon key.

create function public.expire_stale_listings()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.listings
  set status = 'expired'
  where status = 'active'
    and last_confirmed_at < now() - interval '7 days';
end;
$$;

grant execute on function public.expire_stale_listings() to anon, authenticated;
