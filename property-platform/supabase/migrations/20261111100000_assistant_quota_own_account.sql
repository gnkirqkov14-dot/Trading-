-- Квотата на AI помощника: само за собствения акаунт.
--
-- Двете функции приемаха номер на акаунт и таван от самата заявка и не
-- проверяваха чий е. Влязъл потребител можеше да изхарчи чужда квота, да
-- си подаде по-висок таван или да си „връща“ опити безкрай.
--
-- Сега: акаунтът трябва да е на влезлия потребител, таванът не може да
-- надхвърли 5 (същото число като DRAFTS_PER_ACCOUNT в
-- src/app/api/listing-assistant/route.ts — сменят се заедно), а връщанията
-- на опит са най-много 5 за акаунт.

alter table public.assistant_account_usage
  add column if not exists refund_count integer not null default 0;

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
  tavan integer;
begin
  if account is null or account is distinct from auth.uid() then
    raise exception 'invalid account';
  end if;
  if max_drafts is null or max_drafts < 1 then
    raise exception 'invalid limit';
  end if;
  tavan := least(max_drafts, 5);

  insert into public.assistant_account_usage as a (user_id, draft_count, updated_at)
  values (account, 1, now())
  on conflict (user_id)
  do update set draft_count = a.draft_count + 1, updated_at = now()
  returning a.draft_count into used;

  if used > tavan then
    return -1;
  end if;
  return tavan - used;
end;
$function$;

create or replace function public.assistant_refund_account_quota(account uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if account is null or account is distinct from auth.uid() then
    return;
  end if;
  update public.assistant_account_usage
     set draft_count = greatest(draft_count - 1, 0),
         refund_count = refund_count + 1,
         updated_at = now()
   where user_id = account
     and draft_count > 0
     and refund_count < 5;
end;
$function$;
