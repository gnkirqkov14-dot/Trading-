create or replace function public.admin_get_profile_emails(profile_ids uuid[])
returns table(id uuid, email text)
language plpgsql security definer set search_path to 'public'
as $function$
begin
  -- `id` е и изходна колона на функцията, затова таблицата се пише
  -- с псевдоним: иначе Postgres гърми с „column reference id is
  -- ambiguous“ и админът виждаше „—“ вместо имейли.
  if not exists (
    select 1 from public.profiles me where me.id = auth.uid() and me.is_admin = true
  ) then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, p.email from public.profiles p where p.id = any(profile_ids);
end;
$function$;
