-- Броячите за админ панела. Сметката по часовник стои тук, а не в
-- страницата: компонентът се рендира при всяка заявка и четенето на
-- времето вътре в него е нечисто (react-hooks/purity). Пък и денят е
-- софийски ден, а сървърът на Vercel е другаде.
create or replace function public.admin_signup_stats()
returns table (
  total bigint,
  today bigint,
  this_week bigint
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    count(*)::bigint as total,
    count(*) filter (
      where created_at >= date_trunc('day', now() at time zone 'Europe/Sofia')
                          at time zone 'Europe/Sofia'
    )::bigint as today,
    count(*) filter (where created_at >= now() - interval '7 days')::bigint
      as this_week
  from public.profiles
  where exists (
    -- Само админ може да пита: иначе всеки с публичния ключ би могъл да
    -- преброи потребителите на сайта.
    select 1 from public.profiles me
     where me.id = auth.uid() and me.is_admin
  );
$function$;

revoke all on function public.admin_signup_stats() from public;
grant execute on function public.admin_signup_stats() to authenticated;
