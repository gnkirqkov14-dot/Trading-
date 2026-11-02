-- Контактите се четат само през obyava_kontakti, която брои обявите на профил.
-- Без това регистриран потребител тегли всички телефони с една заявка.
revoke select on public.listings from authenticated;
grant select (
  id, user_id, created_at, updated_at, type, property_type, price, area_sqm,
  rooms, floor, year_built, heating, has_parking, has_elevator, has_terrace,
  is_furnished, title, status, project_name, construction_stage,
  completion_year, city_id, neighborhood_id, developer_id, view_count,
  last_confirmed_at, reminder_count, source_url, source_checked_at,
  source_gone_at
) on public.listings to authenticated;

-- Логнат чете само своя профил; чуждо име идва от ime_na_profil.
drop policy "Profiles are viewable by everyone" on public.profiles;
create policy "Anon reads public profile columns"
  on public.profiles for select to anon using (true);
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_admin());
