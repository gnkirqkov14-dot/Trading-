-- Собственикът поиска кварталите на Пловдив да съвпадат с реалните имена
-- и приблизителни форми от снимка на официалната карта на града (не
-- изчислена Voronoi диаграма). Формите живеят в
-- public/data/plovdiv-districts.geojson (ръчно пресъздадени, виж
-- CLAUDE.md за контекст и ограничения) и се зареждат от city-map.tsx по
-- име на квартал. Тук подравняваме lat/lng на вече съществуващите 5
-- квартала към новия, съгласуван layout и добавяме липсващите.

update public.neighborhoods set lat = 42.154458, lng = 24.73025
  where name = 'Кършияка' and city_id = (select id from public.cities where name = 'Пловдив');
update public.neighborhoods set lat = 42.136871, lng = 24.746986
  where name = 'Център' and city_id = (select id from public.cities where name = 'Пловдив');
update public.neighborhoods set lat = 42.13335, lng = 24.777733
  where name = 'Тракия' and city_id = (select id from public.cities where name = 'Пловдив');
update public.neighborhoods set lat = 42.128817, lng = 24.717233
  where name = 'Смирненски' and city_id = (select id from public.cities where name = 'Пловдив');
update public.neighborhoods set lat = 42.10938, lng = 24.75984
  where name = 'Гагарин' and city_id = (select id from public.cities where name = 'Пловдив');

insert into public.neighborhoods (city_id, name, lat, lng)
select cities.id, v.name, v.lat, v.lng
from public.cities, (values
  ('Северна индустриална зона', 42.167208, 24.73135),
  ('Изгрев', 42.15647, 24.77656),
  ('Източна индустриална зона', 42.14304, 24.78932),
  ('Широк център', 42.121571, 24.750914),
  ('Прослав', 42.13488, 24.7066),
  ('Въстанически', 42.110967, 24.742533),
  ('Индустриална зона Юг', 42.110967, 24.77865),
  ('Коматево', 42.10292, 24.71034)
) as v(name, lat, lng)
where cities.name = 'Пловдив';
