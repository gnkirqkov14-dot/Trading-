-- 0005_neighborhood_coordinates.sql беше пропусната при ръчното пускане на
-- миграциите (преди автоматизацията) — кварталите на София/Пловдив/Варна/
-- Бургас съществуваха в базата, но с lat/lng = NULL, затова сайтът никога
-- не показваше карта с квартали за тях (виждаше 0 "истински" квартала и
-- прескачаше direct към списъка с обяви). Идентично съдържание на 0005,
-- пуснато под нов номер, за да мине през автоматизацията вместо ръчно
-- копиране в SQL Editor. Идемпотентно — безопасно е дори вече част от
-- редовете да имат стойност.

-- София
update public.neighborhoods set lat = 42.6690, lng = 23.3200 where name = 'Лозенец' and city_id = (select id from public.cities where name = 'София');
update public.neighborhoods set lat = 42.6450, lng = 23.2750 where name = 'Витоша' and city_id = (select id from public.cities where name = 'София');
update public.neighborhoods set lat = 42.6380, lng = 23.3800 where name = 'Младост' and city_id = (select id from public.cities where name = 'София');
update public.neighborhoods set lat = 42.7050, lng = 23.2400 where name = 'Люлин' and city_id = (select id from public.cities where name = 'София');
update public.neighborhoods set lat = 42.6450, lng = 23.4150 where name = 'Дружба' and city_id = (select id from public.cities where name = 'София');
update public.neighborhoods set lat = 42.6480, lng = 23.3350 where name = 'Студентски град' and city_id = (select id from public.cities where name = 'София');
update public.neighborhoods set lat = 42.6977, lng = 23.3219 where name = 'Център' and city_id = (select id from public.cities where name = 'София');
update public.neighborhoods set lat = 42.6750, lng = 23.3550 where name = 'Изгрев' and city_id = (select id from public.cities where name = 'София');
update public.neighborhoods set lat = 42.6280, lng = 23.2950 where name = 'Драгалевци' and city_id = (select id from public.cities where name = 'София');
update public.neighborhoods set lat = 42.6350, lng = 23.2650 where name = 'Бояна' and city_id = (select id from public.cities where name = 'София');

-- Пловдив
update public.neighborhoods set lat = 42.1550, lng = 24.7350 where name = 'Кършияка' and city_id = (select id from public.cities where name = 'Пловдив');
update public.neighborhoods set lat = 42.1300, lng = 24.7800 where name = 'Тракия' and city_id = (select id from public.cities where name = 'Пловдив');
update public.neighborhoods set lat = 42.1150, lng = 24.7500 where name = 'Смирненски' and city_id = (select id from public.cities where name = 'Пловдив');
update public.neighborhoods set lat = 42.1354, lng = 24.7453 where name = 'Център' and city_id = (select id from public.cities where name = 'Пловдив');
update public.neighborhoods set lat = 42.1200, lng = 24.7650 where name = 'Гагарин' and city_id = (select id from public.cities where name = 'Пловдив');

-- Варна
update public.neighborhoods set lat = 43.2250, lng = 27.9000 where name = 'Чайка' and city_id = (select id from public.cities where name = 'Варна');
update public.neighborhoods set lat = 43.1900, lng = 27.9100 where name = 'Младост' and city_id = (select id from public.cities where name = 'Варна');
update public.neighborhoods set lat = 43.2100, lng = 27.8850 where name = 'Левски' and city_id = (select id from public.cities where name = 'Варна');
update public.neighborhoods set lat = 43.2141, lng = 27.9147 where name = 'Център' and city_id = (select id from public.cities where name = 'Варна');
update public.neighborhoods set lat = 43.2050, lng = 27.9600 where name = 'Виница' and city_id = (select id from public.cities where name = 'Варна');

-- Бургас
update public.neighborhoods set lat = 42.5150, lng = 27.4700 where name = 'Славейков' and city_id = (select id from public.cities where name = 'Бургас');
update public.neighborhoods set lat = 42.5300, lng = 27.4650 where name = 'Лазур' and city_id = (select id from public.cities where name = 'Бургас');
update public.neighborhoods set lat = 42.5048, lng = 27.4626 where name = 'Център' and city_id = (select id from public.cities where name = 'Бургас');
