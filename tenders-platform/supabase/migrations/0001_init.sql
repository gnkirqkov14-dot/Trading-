-- Обществени поръчки: схема на базата.
-- Пуска се веднъж в нов Supabase проект (SQL Editor → paste → Run).
-- Виж docs/РЪЧНИ-СТЪПКИ.md, раздел 2.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- tenders: една поръчка или обособена позиция от ЦАИС ЕОП
-- ---------------------------------------------------------------------------

create table public.tenders (
  id bigint primary key,                 -- tenderId от ЦАИС ЕОП
  notice_id bigint,
  procurement_number text,               -- уникален номер на поръчката (УНП)
  title text not null,
  lot_number text,
  lot_title text,
  description text,
  notice_type text,
  procedure_type text,
  contract_type text,
  cpv_code text,
  cpv_label text,
  cpv_division text,                     -- първите 2 цифри на CPV = „бранш“
  buyer_name text not null,
  buyer_eik text,
  buyer_type text,
  buyer_activity text,
  buyer_locality text,
  region_code text,                      -- NUTS 3, напр. BG421 = Пловдив
  value_eur numeric(16, 2),
  deadline_at timestamptz,
  published_at timestamptz,
  eu_funded boolean not null default false,
  eu_program text,
  is_cancelled boolean not null default false,
  source_date date not null,             -- от кой дневен файл е дошла
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Едно поле за търсене по думи: заглавие, позиция, възложител, бранш.
  search_text text generated always as (
    lower(
      coalesce(title, '') || ' ' ||
      coalesce(lot_title, '') || ' ' ||
      coalesce(buyer_name, '') || ' ' ||
      coalesce(cpv_label, '') || ' ' ||
      coalesce(buyer_locality, '')
    )
  ) stored
);

create index tenders_deadline_idx on public.tenders (deadline_at);
create index tenders_published_idx on public.tenders (published_at desc);
create index tenders_updated_idx on public.tenders (updated_at);
create index tenders_region_idx on public.tenders (region_code);
create index tenders_division_idx on public.tenders (cpv_division);
create index tenders_value_idx on public.tenders (value_eur);
create index tenders_search_trgm_idx on public.tenders using gin (search_text gin_trgm_ops);

-- updated_at се мести само при реална промяна, за да не праща известията
-- по втори път за поръчка, която просто е внесена отново.
create function public.tenders_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- search_text е генерирана колона и в BEFORE тригер още е празна, затова
  -- сравняваме без нея и без двете служебни дати.
  if (to_jsonb(new) - 'updated_at' - 'created_at' - 'search_text')
     is distinct from
     (to_jsonb(old) - 'updated_at' - 'created_at' - 'search_text') then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger tenders_touch_updated_at
  before update on public.tenders
  for each row execute function public.tenders_touch_updated_at();

alter table public.tenders enable row level security;

-- Данните са публични (лиценз CC0 от източника) — всеки може да чете.
create policy "Tenders are public"
  on public.tenders for select using (true);

-- ---------------------------------------------------------------------------
-- import_runs: дневник на вноса (за проверка, че cron-ът работи)
-- ---------------------------------------------------------------------------

create table public.import_runs (
  id bigint generated always as identity primary key,
  source_date date not null,
  status text not null,                  -- ok / missing / error
  rows_count integer not null default 0,
  message text,
  created_at timestamptz not null default now()
);

alter table public.import_runs enable row level security;
-- Без политики: само сървърът (service role) чете и пише.

-- ---------------------------------------------------------------------------
-- alert_subscriptions: известия по имейл
-- ---------------------------------------------------------------------------

create table public.alert_subscriptions (
  id bigint generated always as identity primary key,
  email text not null,
  q text,
  region_code text,
  cpv_division text,
  min_value numeric(16, 2),
  token text not null unique,            -- за потвърждение и отписване
  status text not null default 'pending', -- pending / active / unsubscribed
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  last_sent_at timestamptz
);

create index alert_subscriptions_status_idx on public.alert_subscriptions (status);

alter table public.alert_subscriptions enable row level security;
-- Без политики: имейлите са лични данни и се четат само от сървъра.
