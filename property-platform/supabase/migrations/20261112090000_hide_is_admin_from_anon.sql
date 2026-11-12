-- Одит №29: посетител без вход можеше да прочете кои профили са
-- администратори (profiles.is_admin беше видима за anon).
--
-- 1) Пет правила четяха колоната направо. Ако само махнем достъпа,
--    заявка на посетител към тези таблици ще гърми с "permission denied",
--    вместо да върне празно. Затова минават през public.is_admin(), която
--    проверява същото, но със собствени права. Поведението е същото.
alter policy "Admins can update any listing" on public.listings
  using (public.is_admin());
alter policy "Admins can delete any listing" on public.listings
  using (public.is_admin());
alter policy "Admins can view the edit log" on public.listing_edit_log
  using (public.is_admin());
alter policy "Admins can view all reports" on public.listing_reports
  using (public.is_admin());
alter policy "Admins can view the ban list" on public.agency_bans
  using (public.is_admin());

-- 2) Посетителите вече не виждат колоната. Влезлите я четат само за
--    своя профил (правилото "Users read their own profile"), а
--    администраторите за всички.
revoke select (is_admin) on public.profiles from anon;
