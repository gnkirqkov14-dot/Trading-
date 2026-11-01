-- Списък за съобщения по Viber: контакти, групи, кампании.
--
-- Съгласието се пази на самия контакт (кога и откъде), защото при оплакване
-- тежестта да го докажеш е твоя — GDPR го изисква, а и партньорът на Viber
-- го проверява. Контакт без consent_at не влиза в кампания: правилото е в
-- заявката, не в интерфейса, за да не се заобикаля.
--
-- Отписването е еднопосочно: unsubscribed_at се вдига веднъж и оттам
-- нататък човекът е невидим за кампаниите, без значение в коя група е.

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  -- Нормализиран на +359… при внасяне, за да няма един и същи човек
  -- два пъти като 0888… и +359888…
  phone text not null unique,
  name text,
  source text,
  consent_at timestamptz,
  consent_note text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_group_members (
  group_id uuid not null references public.contact_groups(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  primary key (group_id, contact_id)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  group_id uuid references public.contact_groups(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','sending','sent','failed')),
  recipient_count integer not null default 0,
  estimated_cost_eur numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.campaign_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','read','failed')),
  provider_message_id text,
  error text,
  updated_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

create index if not exists contacts_unsubscribed_idx
  on public.contacts (unsubscribed_at) where unsubscribed_at is null;
create index if not exists campaign_messages_campaign_idx
  on public.campaign_messages (campaign_id, status);

-- Всичко е само за админ. Няма публичен достъп: това са чужди телефони.
alter table public.contacts enable row level security;
alter table public.contact_groups enable row level security;
alter table public.contact_group_members enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_messages enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin);
$function$;

do $$
declare t text;
begin
  foreach t in array array['contacts','contact_groups','contact_group_members','campaigns','campaign_messages']
  loop
    execute format('drop policy if exists "admin_all" on public.%I', t);
    execute format(
      'create policy "admin_all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
