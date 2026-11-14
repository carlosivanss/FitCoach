-- Acciones del paciente desde la app móvil: crear su propia rutina, reemplazar un ejercicio
-- y marcar ejercicios que no quiere que se le sugieran.

create table if not exists public.fc_excluded_exercises (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id bigint not null references public.fc_exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
alter table public.fc_excluded_exercises enable row level security;
create policy fc_excluded_exercises_self on public.fc_excluded_exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on public.fc_excluded_exercises to authenticated;

create or replace function public.fc_create_my_routine(
  p_name text,
  p_goal text,
  p_session_minutes smallint,
  p_days jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id bigint;
  v_routine_id bigint;
  v_day jsonb;
  v_ex jsonb;
  v_dow smallint;
  v_idx smallint;
begin
  select c.id into v_client_id from public.fc_clients c
  where c.user_id = v_user_id and c.status = 'active' limit 1;
  if v_client_id is null then
    raise exception 'No active patient record is linked to this account.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(p_name)) > 140 then
    raise exception 'Routine name must have 2 to 140 characters.' using errcode = '22023';
  end if;
  if p_session_minutes not in (30, 45, 60, 90) then
    raise exception 'Invalid session length.' using errcode = '22023';
  end if;
  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) not between 1 and 7 then
    raise exception 'p_days must be an array of 1 to 7 days.' using errcode = '22023';
  end if;

  update public.fc_routines set archived_at = now()
  where client_id = v_client_id and archived_at is null;

  insert into public.fc_routines (client_id, created_by, name, source, goal, days_per_week, session_minutes)
  values (v_client_id, v_user_id, trim(p_name), 'manual', nullif(trim(coalesce(p_goal, '')), ''),
          jsonb_array_length(p_days), p_session_minutes)
  returning id into v_routine_id;

  for v_day in select * from jsonb_array_elements(p_days) loop
    v_dow := (v_day ->> 'day')::smallint;
    if v_dow not between 1 and 7 then raise exception 'Invalid day.' using errcode = '22023'; end if;
    if jsonb_typeof(v_day -> 'exercises') <> 'array' or jsonb_array_length(v_day -> 'exercises') = 0 then
      raise exception 'Day % needs at least one exercise.', v_dow using errcode = '22023';
    end if;
    insert into public.fc_routine_days (routine_id, day_of_week, label) values (v_routine_id, v_dow, null);
    v_idx := 0;
    for v_ex in select * from jsonb_array_elements(v_day -> 'exercises') loop
      v_idx := v_idx + 1;
      insert into public.fc_routine_exercises (routine_id, exercise_id, day_of_week, order_index, sets, reps_min, reps_max, rest_seconds)
      values (v_routine_id, (v_ex ->> 'exercise_id')::bigint, v_dow, v_idx,
              least(greatest(coalesce((v_ex ->> 'sets')::smallint, 3), 1), 20),
              coalesce((v_ex ->> 'reps')::smallint, 12), coalesce((v_ex ->> 'reps')::smallint, 12),
              least(greatest(coalesce((v_ex ->> 'rest_seconds')::integer, 90), 0), 1800));
    end loop;
  end loop;
  return v_routine_id;
end;
$$;

create or replace function public.fc_replace_my_exercise(
  p_routine_exercise_id bigint,
  p_new_exercise_id bigint,
  p_exclude_old boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_old bigint;
begin
  select re.exercise_id into v_old
  from public.fc_routine_exercises re
  join public.fc_routines r on r.id = re.routine_id
  join public.fc_clients c on c.id = r.client_id
  where re.id = p_routine_exercise_id and c.user_id = v_user_id and c.status = 'active' and r.archived_at is null;
  if v_old is null then
    raise exception 'Exercise is not part of this patient''s active routine.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.fc_exercises where id = p_new_exercise_id and is_active) then
    raise exception 'Unknown exercise.' using errcode = '22023';
  end if;
  update public.fc_routine_exercises set exercise_id = p_new_exercise_id where id = p_routine_exercise_id;
  if p_exclude_old then
    insert into public.fc_excluded_exercises (user_id, exercise_id) values (v_user_id, v_old) on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.fc_create_my_routine(text, text, smallint, jsonb) from public, anon;
grant execute on function public.fc_create_my_routine(text, text, smallint, jsonb) to authenticated;
revoke all on function public.fc_replace_my_exercise(bigint, bigint, boolean) from public, anon;
grant execute on function public.fc_replace_my_exercise(bigint, bigint, boolean) to authenticated;
