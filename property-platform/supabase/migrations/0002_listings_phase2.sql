-- Property Platform — Phase 2
-- Seed cities/neighborhoods so the listing form has real options, and set
-- up a public Storage bucket for listing photos with per-user RLS.

-- ---------------------------------------------------------------------------
-- Seed cities + neighborhoods
-- ---------------------------------------------------------------------------

with new_cities as (
  insert into public.cities (name, region) values
    ('София', 'София-град'),
    ('Пловдив', 'Пловдив'),
    ('Варна', 'Варна'),
    ('Бургас', 'Бургас'),
    ('Русе', 'Русе'),
    ('Стара Загора', 'Стара Загора'),
    ('Плевен', 'Плевен'),
    ('Сливен', 'Сливен'),
    ('Добрич', 'Добрич'),
    ('Шумен', 'Шумен'),
    ('Перник', 'Перник'),
    ('Хасково', 'Хасково'),
    ('Ямбол', 'Ямбол'),
    ('Пазарджик', 'Пазарджик'),
    ('Благоевград', 'Благоевград'),
    ('Велико Търново', 'Велико Търново'),
    ('Враца', 'Враца'),
    ('Габрово', 'Габрово'),
    ('Асеновград', 'Пловдив'),
    ('Казанлък', 'Стара Загора')
  returning id, name
)
insert into public.neighborhoods (city_id, name)
select nc.id, n.name
from new_cities nc
join (values
  ('София', 'Лозенец'),
  ('София', 'Витоша'),
  ('София', 'Младост'),
  ('София', 'Люлин'),
  ('София', 'Дружба'),
  ('София', 'Студентски град'),
  ('София', 'Център'),
  ('София', 'Изгрев'),
  ('София', 'Драгалевци'),
  ('София', 'Бояна'),
  ('Пловдив', 'Кършияка'),
  ('Пловдив', 'Тракия'),
  ('Пловдив', 'Смирненски'),
  ('Пловдив', 'Център'),
  ('Пловдив', 'Гагарин'),
  ('Варна', 'Чайка'),
  ('Варна', 'Младост'),
  ('Варна', 'Левски'),
  ('Варна', 'Център'),
  ('Варна', 'Виница'),
  ('Бургас', 'Славейков'),
  ('Бургас', 'Лазур'),
  ('Бургас', 'Център')
) as n(city_name, name) on n.city_name = nc.name;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for listing photos, per-user write access
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

create policy "Public read listing photos"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "Users upload to their own listing photos folder"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete their own listing photos"
  on storage.objects for delete
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
