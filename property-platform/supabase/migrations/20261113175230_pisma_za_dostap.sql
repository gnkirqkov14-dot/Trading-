-- Писмо „профилът ти е активен“ за хората, чийто имейл потвърдихме на ръка.
--
-- На 13.11 писмата за потвърждение не стигаха (лимит 2 на час при
-- вградената поща на Supabase). Тези хора получиха достъп на ръка, но не
-- го знаят. Тук се пази кой чака писмо и на кого вече е пратено, за да не
-- получи никой две. Списъкът се попълва на ръка, не от приложението.
create table public.pisma_za_dostap (
  user_id uuid primary key references auth.users (id) on delete cascade,
  prateno_na timestamptz
);

-- Без политики: чете се и се пише само през функциите долу.
alter table public.pisma_za_dostap enable row level security;

-- Кой още чака писмо. Който вече е влязъл сам, не му трябва.
create or replace function public.admin_pisma_za_dostap_chakashti(p_limit int default 1000)
returns table (user_id uuid, email text, name text)
language sql
security definer
set search_path to 'public'
as $function$
  select u.id, u.email::text, p.name
    from public.pisma_za_dostap c
    join auth.users u on u.id = c.user_id
    left join public.profiles p on p.id = u.id
   where c.prateno_na is null
     and u.last_sign_in_at is null
     and u.email is not null
     and public.is_admin()
   order by u.created_at
   limit p_limit;
$function$;

create or replace function public.admin_pisma_za_dostap_otbelezhi(p_ids uuid[])
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.pisma_za_dostap
     set prateno_na = now()
   where user_id = any (p_ids)
     and public.is_admin();
$function$;

revoke all on function public.admin_pisma_za_dostap_chakashti(int) from public, anon;
revoke all on function public.admin_pisma_za_dostap_otbelezhi(uuid[]) from public, anon;
grant execute on function public.admin_pisma_za_dostap_chakashti(int) to authenticated;
grant execute on function public.admin_pisma_za_dostap_otbelezhi(uuid[]) to authenticated;
