-- Таван на помощника за цял профил, не за ден.
-- Дневният таван по IP остава като спирачка срещу много профили от едно
-- място, но той се заобикаля със смяна на мрежата; истинската защита на
-- сметката е този брояч, вързан за акаунта.
create table if not exists public.assistant_account_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  draft_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.assistant_account_usage enable row level security;

-- Човекът вижда своя брояч; писането минава само през функциите отдолу.
drop policy if exists "Own assistant usage is viewable" on public.assistant_account_usage;
create policy "Own assistant usage is viewable"
  on public.assistant_account_usage
  for select using (auth.uid() = user_id);

create or replace function public.assistant_consume_account_quota(
  account uuid,
  max_drafts integer
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  used integer;
begin
  if account is null then
    raise exception 'invalid account';
  end if;
  if max_drafts is null or max_drafts < 1 or max_drafts > 100 then
    raise exception 'invalid limit';
  end if;

  insert into public.assistant_account_usage as a (user_id, draft_count, updated_at)
  values (account, 1, now())
  on conflict (user_id)
  do update set draft_count = a.draft_count + 1, updated_at = now()
  returning a.draft_count into used;

  if used > max_drafts then
    return -1;
  end if;
  return max_drafts - used;
end;
$function$;

-- Броячът се вдига ПРЕДИ заявката към модела, за да не могат няколко
-- едновременни заявки да минат покрай тавана. Ако моделът гръмне, човекът
-- не е получил нищо и опитът му се връща обратно.
create or replace function public.assistant_refund_account_quota(account uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if account is null then
    return;
  end if;
  update public.assistant_account_usage
     set draft_count = greatest(draft_count - 1, 0), updated_at = now()
   where user_id = account;
end;
$function$;

revoke all on function public.assistant_consume_account_quota(uuid, integer) from public;
revoke all on function public.assistant_refund_account_quota(uuid) from public;
grant execute on function public.assistant_consume_account_quota(uuid, integer) to authenticated;
grant execute on function public.assistant_refund_account_quota(uuid) to authenticated;
