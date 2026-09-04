-- Прави се във връзка с добавянето на вход с Google/Facebook.
--
-- handle_new_user() (0001_init.sql) четеше само raw_user_meta_data->>'name'
-- при създаване на profiles ред за нов потребител. При регистрация с
-- имейл/парола ние изрично подаваме {data: {name}}, но OAuth
-- доставчиците понякога попълват потребителското име под различен ключ
-- (Google обичайно има и 'name', и 'full_name'; други доставчици може да
-- имат само 'full_name'). Ако нито едно от двете липсва, вместо празно
-- име (NULL) взимаме частта преди @ от имейла, за да не оставаме
-- потребителя без никакво име в профила.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;
