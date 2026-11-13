begin;

create or replace function public.fc_update_my_profile(
  p_full_name text,
  p_phone text default null,
  p_experience_level text default 'beginner',
  p_preferred_units text default 'kg'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or length(trim(p_full_name)) < 2 then
    raise exception 'A valid authenticated profile is required.' using errcode = '22023';
  end if;
  if p_experience_level not in ('beginner', 'intermediate', 'advanced') or p_preferred_units not in ('kg', 'lb') then
    raise exception 'Invalid profile preferences.' using errcode = '22023';
  end if;

  update public.fc_profiles
  set full_name = trim(p_full_name), phone = nullif(trim(p_phone), ''),
      experience_level = p_experience_level, preferred_units = p_preferred_units,
      onboarding_complete = true
  where user_id = v_user_id and role = 'patient';
  if not found then
    raise exception 'Patient profile not found.' using errcode = '42501';
  end if;

  update public.fc_clients
  set full_name = trim(p_full_name), phone = nullif(trim(p_phone), '')
  where user_id = v_user_id and status <> 'archived';
end;
$$;

create or replace function public.fc_record_my_body_measurement(
  p_measured_on date default current_date,
  p_weight_kg numeric default null,
  p_body_fat_percent numeric default null,
  p_muscle_mass_kg numeric default null,
  p_waist_cm numeric default null,
  p_notes text default null
)
returns public.fc_body_measurements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id bigint;
  v_measurement public.fc_body_measurements;
begin
  select c.id into v_client_id
  from public.fc_clients c
  where c.user_id = v_user_id and c.status <> 'archived'
  limit 1;

  if v_client_id is null then
    raise exception 'No active patient record is linked to this account.' using errcode = '42501';
  end if;
  if num_nonnulls(p_weight_kg, p_body_fat_percent, p_muscle_mass_kg, p_waist_cm) = 0 then
    raise exception 'At least one body measurement is required.' using errcode = '22023';
  end if;

  insert into public.fc_body_measurements (
    client_id, recorded_by, measured_on, weight_kg, body_fat_percent,
    muscle_mass_kg, waist_cm, notes
  ) values (
    v_client_id, v_user_id, coalesce(p_measured_on, current_date), p_weight_kg,
    p_body_fat_percent, p_muscle_mass_kg, p_waist_cm, nullif(trim(p_notes), '')
  ) returning * into v_measurement;
  return v_measurement;
end;
$$;

create or replace function public.fc_complete_my_workout(
  p_routine_id bigint,
  p_day_of_week smallint,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_sets jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id bigint;
  v_session_id bigint;
begin
  if p_day_of_week not between 1 and 7 or p_completed_at < p_started_at then
    raise exception 'Invalid workout dates or day.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) = 0 then
    raise exception 'At least one completed set is required.' using errcode = '22023';
  end if;

  select c.id into v_client_id
  from public.fc_clients c
  join public.fc_routines r on r.client_id = c.id
  where c.user_id = v_user_id and c.status = 'active'
    and r.id = p_routine_id and r.archived_at is null
  limit 1;
  if v_client_id is null then
    raise exception 'Routine is not assigned to this patient.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_sets) as x(routine_exercise_id bigint, set_number smallint)
    left join public.fc_routine_exercises re
      on re.id = x.routine_exercise_id and re.routine_id = p_routine_id and re.day_of_week = p_day_of_week
    where re.id is null or x.set_number not between 1 and 30
  ) then
    raise exception 'One or more sets do not belong to this routine day.' using errcode = '22023';
  end if;

  insert into public.fc_workout_sessions (
    routine_id, client_id, recorded_by, status, started_at, completed_at,
    duration_seconds, notes
  ) values (
    p_routine_id, v_client_id, v_user_id, 'completed', p_started_at, p_completed_at,
    greatest(0, extract(epoch from (p_completed_at - p_started_at))::integer),
    'Día ' || p_day_of_week
  ) returning id into v_session_id;

  insert into public.fc_set_logs (
    session_id, routine_exercise_id, set_number, reps_completed, weight,
    weight_unit, completed_at
  )
  select v_session_id, x.routine_exercise_id, x.set_number, x.reps_completed,
    x.weight, 'kg', p_completed_at
  from jsonb_to_recordset(p_sets) as x(
    routine_exercise_id bigint, set_number smallint, reps_completed smallint, weight numeric
  );

  return v_session_id;
end;
$$;

revoke all on function public.fc_update_my_profile(text, text, text, text) from public, anon;
grant execute on function public.fc_update_my_profile(text, text, text, text) to authenticated;
revoke all on function public.fc_record_my_body_measurement(date, numeric, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.fc_record_my_body_measurement(date, numeric, numeric, numeric, numeric, text) to authenticated;
revoke all on function public.fc_complete_my_workout(bigint, smallint, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.fc_complete_my_workout(bigint, smallint, timestamptz, timestamptz, jsonb) to authenticated;

commit;
