-- Кой е стигнал докъде при регистрацията.
--
-- profiles се създава в мига, в който се появи ред в auth.users — тоест
-- още преди човекът да е потвърдил имейла си. Затова само по profiles не
-- се различава „регистрира се" от „започна и се отказа". Двете полета,
-- които го казват, живеят в auth.users, където приложението няма достъп.
--
-- Внимание какво НЕ показва: провален опит (зает имейл, грешка, отказ на
-- екрана на Google) не оставя ред никъде. Той се вижда само в логовете на
-- Supabase и то временно.
create or replace function public.admin_user_states()
returns table (
  user_id uuid,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $function$
  select u.id, u.email_confirmed_at, u.last_sign_in_at
    from auth.users u
   where exists (
     select 1 from public.profiles me
      where me.id = auth.uid() and me.is_admin
   );
$function$;

revoke all on function public.admin_user_states() from public;
grant execute on function public.admin_user_states() to authenticated;
