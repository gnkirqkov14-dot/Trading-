-- Запазеният профил на фирмата в съветника. Собственикът поиска, като
-- влезе след седмица, да не пише всичко отначало: описанието, отговорите
-- на уточняващите въпроси, филтрите и последният съвет стоят тук.
--
-- Без регистрация: ключът е случаен низ (token) в бисквитка на браузъра и
-- във връзка, която фирмата може да си запази. Който няма ключа, не вижда
-- профила. Пази се само това, което фирмата сама е написала за дейността
-- си — без имейли и телефони.
--
-- Пуска се като 0001–0003: през execute_sql, не като миграция на imotpoint.

create table if not exists tenders.company_profiles (
  token text primary key,
  description text not null,
  answers jsonb not null default '[]',
  profile jsonb not null default '{}',
  filters jsonb not null default '{}',
  results jsonb not null default '{}',
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table tenders.company_profiles from public, anon, authenticated;

create or replace function public.tenders_profile_get(p_secret text, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  return (select to_jsonb(p) from tenders.company_profiles p where p.token = p_token);
end;
$$;

-- null в някое поле = остави старото. p_ran = true, когато е минал AI
-- (тогава се мести last_run_at — от него се смята кое е „ново“).
create or replace function public.tenders_profile_save(
  p_secret text,
  p_token text,
  p_description text,
  p_answers jsonb,
  p_profile jsonb,
  p_filters jsonb,
  p_results jsonb,
  p_ran boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tenders.check_secret(p_secret);
  if p_token is null or length(p_token) < 32 then
    raise exception 'invalid token';
  end if;
  insert into tenders.company_profiles as c
    (token, description, answers, profile, filters, results, last_run_at)
  values (
    p_token, coalesce(p_description, ''), coalesce(p_answers, '[]'),
    coalesce(p_profile, '{}'), coalesce(p_filters, '{}'), coalesce(p_results, '{}'),
    case when p_ran then now() end
  )
  on conflict (token) do update set
    description = coalesce(p_description, c.description),
    answers = coalesce(p_answers, c.answers),
    profile = coalesce(p_profile, c.profile),
    filters = coalesce(p_filters, c.filters),
    results = coalesce(p_results, c.results),
    last_run_at = case when p_ran then now() else c.last_run_at end,
    updated_at = now();
end;
$$;

revoke all on function public.tenders_profile_get(text, text) from public;
revoke all on function public.tenders_profile_save(text, text, text, jsonb, jsonb, jsonb, jsonb, boolean) from public;
grant execute on function public.tenders_profile_get(text, text) to anon, authenticated;
grant execute on function public.tenders_profile_save(text, text, text, jsonb, jsonb, jsonb, jsonb, boolean) to anon, authenticated;
