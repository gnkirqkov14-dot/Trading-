-- Втора връзка listings–profiles през тази таблица прави profiles(...) в
-- заявките двусмислен (PGRST201) и /admin излиза празен.
alter table public.kontakt_pregledi
  drop constraint kontakt_pregledi_user_id_fkey,
  add constraint kontakt_pregledi_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;
