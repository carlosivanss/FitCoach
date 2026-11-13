-- Crea una rutina semanal completa en UNA transacción.
-- Motivo: fc_exercises solo admite escritura de admin (AAL2) y el guardado desde el
-- cliente hacía 4+ llamadas sueltas que podían dejar rutinas a medias.
begin;

create or replace function public.fc_create_routine(
  p_client_id bigint,
  p_name text,
  p_session_minutes smallint,
  p_days jsonb
)
returns public.fc_routines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_aal text := coalesce((select auth.jwt() ->> 'aal'), 'aal1');
  v_routine public.fc_routines;
  v_day jsonb;
  v_ex jsonb;
  v_day_num smallint;
  v_idx smallint;
  v_exercise_id bigint;
  v_name text;
begin
  select coalesce(u.raw_app_meta_data ->> 'role', 'patient')
    into v_role
  from auth.users u
  where u.id = v_user_id;

  if v_user_id is null or v_role not in ('trainer', 'admin') then
    raise exception 'Only authenticated staff can create routines.' using errcode = '42501';
  end if;

  if v_role = 'admin' and v_aal <> 'aal2' then
    raise exception 'Admin access requires MFA (aal2).' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.fc_clients c
    where c.id = p_client_id
      and c.archived_at is null
      and (
        v_role = 'admin'
        or c.primary_trainer_id = v_user_id
        or exists (
          select 1 from public.fc_client_staff cs
          where cs.client_id = c.id and cs.staff_user_id = v_user_id and cs.access_level = 'coach'
        )
      )
  ) then
    raise exception 'Client not found or not assigned to you.' using errcode = '42501';
  end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) not between 1 and 7 then
    raise exception 'p_days must be an array of 1 to 7 days.' using errcode = '22023';
  end if;

  insert into public.fc_routines (
    client_id, created_by, name, source, goal, experience_level,
    training_location, focus_mode, priority_muscles, session_minutes, days_per_week
  ) values (
    p_client_id, v_user_id, trim(p_name), 'trainer', 'general', 'beginner',
    'gym', 'balanced', '{}', p_session_minutes, jsonb_array_length(p_days)
  )
  returning * into v_routine;

  for v_day in select * from jsonb_array_elements(p_days) loop
    v_day_num := (v_day ->> 'day')::smallint;

    insert into public.fc_routine_days (routine_id, day_of_week, label)
    values (v_routine.id, v_day_num, nullif(trim(coalesce(v_day ->> 'label', '')), ''));

    if jsonb_typeof(v_day -> 'exercises') <> 'array' or jsonb_array_length(v_day -> 'exercises') = 0 then
      raise exception 'Day % needs at least one exercise.', v_day_num using errcode = '22023';
    end if;

    v_idx := 0;
    for v_ex in select * from jsonb_array_elements(v_day -> 'exercises') loop
      v_idx := v_idx + 1;
      v_name := trim(coalesce(v_ex ->> 'name', ''));

      -- El catálogo no se modifica: si el ejercicio ya existe se reutiliza tal cual.
      insert into public.fc_exercises (
        name, muscle_group, secondary_muscles, exercise_type, instructions, coaching_tip, created_by
      ) values (
        v_name,
        coalesce(nullif(trim(coalesce(v_ex ->> 'muscle_group', '')), ''), 'general'),
        array(select jsonb_array_elements_text(coalesce(v_ex -> 'secondary_muscles', '[]'::jsonb))),
        case when v_ex ->> 'exercise_type' in ('compound', 'isolation', 'cardio', 'mobility')
             then v_ex ->> 'exercise_type' else 'compound' end,
        array(select jsonb_array_elements_text(coalesce(v_ex -> 'instructions', '[]'::jsonb))),
        nullif(trim(coalesce(v_ex ->> 'coaching_tip', '')), ''),
        v_user_id
      )
      on conflict (name) do nothing;

      select e.id into v_exercise_id from public.fc_exercises e where e.name = v_name;

      insert into public.fc_routine_exercises (
        routine_id, exercise_id, day_of_week, order_index, sets, reps_min, reps_max, rest_seconds
      ) values (
        v_routine.id, v_exercise_id, v_day_num, v_idx,
        coalesce((v_ex ->> 'sets')::smallint, 3),
        coalesce((v_ex ->> 'reps_min')::smallint, 10),
        coalesce((v_ex ->> 'reps_max')::smallint, 12),
        coalesce((v_ex ->> 'rest_seconds')::integer, 90)
      );
    end loop;
  end loop;

  return v_routine;
end;
$$;

revoke all on function public.fc_create_routine(bigint, text, smallint, jsonb) from public, anon;
grant execute on function public.fc_create_routine(bigint, text, smallint, jsonb) to authenticated;

commit;
