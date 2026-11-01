-- Откъде е дошла фирмената обява и кога е проверявана за последно.
--
-- Строителят поддържа обявата си актуална ТАМ, не при нас — цената се
-- мести, апартаментът се продава, обявата изчезва. Затова пазим адреса на
-- източника: без него после няма как да се провери дали това, което
-- показваме, още е вярно, а остаряла цена е по-лоша от липсваща обява.
--
-- source_checked_at се вдига при всяка проверка, независимо дали нещо се е
-- променило — така се вижда кои обяви отдавна не са поглеждани.
alter table public.listings
  add column if not exists source_url text,
  add column if not exists source_checked_at timestamptz,
  add column if not exists source_gone_at timestamptz;

-- Една и съща обява да не влезе два пъти, ако се внесе повторно.
create unique index if not exists listings_source_url_key
  on public.listings (source_url) where source_url is not null;

comment on column public.listings.source_url is
  'Адресът на обявата при източника (напр. imot.bg). Само за фирмени обяви.';
comment on column public.listings.source_gone_at is
  'Кога източникът е спрял да я показва — обявата вероятно е продадена.';
