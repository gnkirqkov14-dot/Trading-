-- „Изтрий профила ми“ (GDPR, право на изтриване).
--
-- Сайтът няма service_role ключ, затова изтриването минава през тази
-- функция. Тя трие само реда на извикващия в auth.users; профилът,
-- обявите, снимките в базата, съобщенията и останалото падат по
-- веригата „on delete cascade“. Файловете на снимките се махат от
-- сървърното действие deleteAccount.
--
-- Администратор не може да се изтрие оттук: на негово име са внесените
-- обяви и те биха изчезнали заедно с него.
create or replace function public.iztriy_profila_mi()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  moyat_id uuid := auth.uid();
begin
  if moyat_id is null then
    raise exception 'Не си влязъл в профила си.';
  end if;

  if exists (
    select 1 from public.profiles where id = moyat_id and is_admin
  ) then
    raise exception 'Администраторски профил не се трие оттук.';
  end if;

  delete from auth.users where id = moyat_id;
end;
$$;

revoke execute on function public.iztriy_profila_mi() from public, anon;
grant execute on function public.iztriy_profila_mi() to authenticated;
