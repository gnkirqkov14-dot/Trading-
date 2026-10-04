-- Известие до собственика при нова регистрация.
--
-- Бележката стои на самия профил, а не в отделна опашка: така е невъзможно
-- един и същи човек да се съобщи два пъти, каквото и да се случи с
-- изпращането. Заявката минава през auth.uid(), тоест всеки може да
-- "вземе" само своя ред — няма нужда от таен ключ и няма как отвън да се
-- изпразни опашката.

alter table public.profiles
  add column if not exists admin_notified_at timestamptz;

-- Заварените профили минават за съобщени: собственикът ги знае и няма
-- защо да получава писма за стари регистрации.
update public.profiles
   set admin_notified_at = now()
 where admin_notified_at is null;

create or replace function public.claim_signup_notice()
returns table (
  profile_id uuid,
  profile_name text,
  profile_email text,
  profile_phone text,
  registered_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  update public.profiles p
     set admin_notified_at = now()
   where p.id = auth.uid()
     and p.admin_notified_at is null
  returning p.id, p.name, p.email, p.phone, p.created_at;
end;
$function$;

revoke all on function public.claim_signup_notice() from public;
grant execute on function public.claim_signup_notice() to authenticated;
