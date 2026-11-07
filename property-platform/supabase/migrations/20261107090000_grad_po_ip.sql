-- Приблизителният град по IP при регистрация (идва от Vercel, самият IP не
-- се пази). Само админът го вижда — през admin_gradove_potrebiteli(); на
-- колоната няма select grant, защото профилите се четат публично.
alter table public.profiles add column if not exists grad_ip text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.agency_bans where kind = 'email' and value = new.email
  ) then
    raise exception 'Този имейл е блокиран за регистрация.';
  end if;

  insert into public.profiles (id, name, email, phone, grad_ip)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    new.email,
    new.raw_user_meta_data ->> 'phone',
    left(nullif(new.raw_user_meta_data ->> 'grad_ip', ''), 80)
  );
  return new;
end;
$$;

-- Регистрацията през Google минава без метаданни: градът се записва след
-- влизането, само ако още няма.
create or replace function public.zapishi_grad_ip(p_grad text)
returns void
language sql security definer set search_path = public
as $$
  update public.profiles
     set grad_ip = left(nullif(p_grad, ''), 80)
   where id = auth.uid() and grad_ip is null;
$$;
revoke execute on function public.zapishi_grad_ip(text) from public, anon;
grant execute on function public.zapishi_grad_ip(text) to authenticated;

create or replace function public.admin_gradove_potrebiteli()
returns table (id uuid, grad_ip text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.grad_ip from public.profiles p
  where public.is_admin() and p.grad_ip is not null;
$$;
revoke execute on function public.admin_gradove_potrebiteli() from public, anon;
grant execute on function public.admin_gradove_potrebiteli() to authenticated;
