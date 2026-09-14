begin;

create schema if not exists private;

-- Arnold V2 uses explicit grants. No application role receives implicit access.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

create table public.fc_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'patient' check (role in ('patient', 'trainer', 'admin')),
  phone text,
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  experience_level text not null default 'beginner' check (experience_level in ('beginner', 'intermediate', 'advanced')),
  preferred_units text not null default 'kg' check (preferred_units in ('kg', 'lb')),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fc_clients (
  id bigint generated always as identity primary key,
  user_id uuid unique references auth.users(id) on delete restrict,
  primary_trainer_id uuid not null references auth.users(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  email text,
  phone text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  goal text,
  height_cm numeric(5,2) check (height_cm is null or height_cm between 50 and 280),
  birth_date date check (birth_date is null or birth_date <= current_date),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is null or user_id <> primary_trainer_id),
  check ((status = 'archived' and archived_at is not null) or (status <> 'archived' and archived_at is null))
);

create table public.fc_client_staff (
  client_id bigint not null references public.fc_clients(id) on delete restrict,
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  access_level text not null default 'coach' check (access_level in ('coach', 'viewer')),
  assigned_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (client_id, staff_user_id)
);

create table public.fc_memberships (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.fc_clients(id) on delete restrict,
  plan_name text not null default 'Plan personalizado' check (length(trim(plan_name)) between 2 and 120),
  starts_on date not null default current_date,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'expired', 'cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.fc_injuries (
  id bigint generated always as identity primary key,
  name text not null unique check (length(trim(name)) between 2 and 120),
  body_area text not null check (length(trim(body_area)) between 2 and 80),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fc_client_injuries (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.fc_clients(id) on delete restrict,
  injury_id bigint references public.fc_injuries(id) on delete restrict,
  custom_name text,
  notes text,
  severity text not null default 'mild' check (severity in ('mild', 'moderate', 'severe')),
  status text not null default 'active' check (status in ('active', 'resolved')),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (injury_id is not null or length(trim(coalesce(custom_name, ''))) > 0)
);

create table public.fc_equipment (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique check (length(trim(name)) between 2 and 100),
  category text not null check (category in ('bodyweight', 'free_weight', 'machine', 'band', 'cardio', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fc_exercises (
  id bigint generated always as identity primary key,
  name text not null unique check (length(trim(name)) between 2 and 140),
  muscle_group text not null,
  secondary_muscles text[] not null default '{}',
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  exercise_type text not null default 'compound' check (exercise_type in ('compound', 'isolation', 'cardio', 'mobility')),
  instructions text[] not null default '{}',
  coaching_tip text,
  video_url text check (video_url is null or video_url ~ '^https://'),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fc_exercise_equipment (
  exercise_id bigint not null references public.fc_exercises(id) on delete cascade,
  equipment_id bigint not null references public.fc_equipment(id) on delete restrict,
  primary key (exercise_id, equipment_id)
);

create table public.fc_exercise_alternatives (
  exercise_id bigint not null references public.fc_exercises(id) on delete cascade,
  alternative_exercise_id bigint not null references public.fc_exercises(id) on delete cascade,
  reason text,
  primary key (exercise_id, alternative_exercise_id),
  check (exercise_id <> alternative_exercise_id)
);

create table public.fc_favorite_exercises (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id bigint not null references public.fc_exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create table public.fc_exercise_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id bigint not null references public.fc_exercises(id) on delete cascade,
  note text not null check (length(trim(note)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create table public.fc_routines (
  id bigint generated always as identity primary key,
  owner_user_id uuid references auth.users(id) on delete restrict,
  client_id bigint references public.fc_clients(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 140),
  source text not null default 'manual' check (source in ('manual', 'fito_ai', 'trainer')),
  goal text,
  experience_level text not null default 'beginner' check (experience_level in ('beginner', 'intermediate', 'advanced')),
  training_location text not null default 'gym' check (training_location in ('home', 'gym', 'mixed')),
  focus_mode text not null default 'balanced' check (focus_mode in ('balanced', 'focused')),
  priority_muscles text[] not null default '{}',
  session_minutes smallint not null default 60 check (session_minutes in (30, 45, 60, 90)),
  preferred_time text check (preferred_time is null or preferred_time in ('morning', 'midday', 'afternoon', 'evening')),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  archived_at timestamptz,
  is_active boolean generated always as (archived_at is null) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(owner_user_id, client_id) = 1)
);

create table public.fc_routine_days (
  routine_id bigint not null references public.fc_routines(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  label text,
  primary key (routine_id, day_of_week)
);

create table public.fc_routine_exercises (
  id bigint generated always as identity primary key,
  routine_id bigint not null references public.fc_routines(id) on delete cascade,
  exercise_id bigint not null references public.fc_exercises(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  order_index smallint not null check (order_index > 0),
  sets smallint not null check (sets between 1 and 20),
  reps_min smallint check (reps_min is null or reps_min between 1 and 200),
  reps_max smallint check (reps_max is null or reps_max between 1 and 200),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  rest_seconds integer not null default 90 check (rest_seconds between 0 and 1800),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, day_of_week, order_index),
  check (reps_min is null or reps_max is null or reps_max >= reps_min)
);

create table public.fc_ai_routine_requests (
  id bigint generated always as identity primary key,
  subject_user_id uuid references auth.users(id) on delete restrict,
  client_id bigint references public.fc_clients(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  training_location text not null check (training_location in ('home', 'gym', 'mixed')),
  focus_mode text not null check (focus_mode in ('balanced', 'focused')),
  priority_muscles text[] not null default '{}',
  session_minutes smallint not null check (session_minutes in (30, 45, 60, 90)),
  preferred_time text check (preferred_time is null or preferred_time in ('morning', 'midday', 'afternoon', 'evening')),
  experience_level text not null check (experience_level in ('beginner', 'intermediate', 'advanced')),
  injury_notes text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  error_message text,
  generated_routine_id bigint references public.fc_routines(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (num_nonnulls(subject_user_id, client_id) = 1),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create table public.fc_ai_request_days (
  request_id bigint not null references public.fc_ai_routine_requests(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  primary key (request_id, day_of_week)
);

create table public.fc_ai_request_equipment (
  request_id bigint not null references public.fc_ai_routine_requests(id) on delete cascade,
  equipment_id bigint not null references public.fc_equipment(id) on delete restrict,
  primary key (request_id, equipment_id)
);

create table public.fc_workout_sessions (
  id bigint generated always as identity primary key,
  routine_id bigint not null references public.fc_routines(id) on delete restrict,
  subject_user_id uuid references auth.users(id) on delete restrict,
  client_id bigint references public.fc_clients(id) on delete restrict,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'in_progress' check (status in ('planned', 'in_progress', 'completed', 'skipped', 'cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(subject_user_id, client_id) = 1),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table public.fc_set_logs (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.fc_workout_sessions(id) on delete cascade,
  routine_exercise_id bigint not null references public.fc_routine_exercises(id) on delete restrict,
  set_number smallint not null check (set_number between 1 and 30),
  reps_completed smallint check (reps_completed is null or reps_completed between 0 and 500),
  weight numeric(7,2) check (weight is null or weight >= 0),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  rpe numeric(3,1) check (rpe is null or rpe between 1 and 10),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, routine_exercise_id, set_number)
);

create table public.fc_body_measurements (
  id bigint generated always as identity primary key,
  subject_user_id uuid references auth.users(id) on delete restrict,
  client_id bigint references public.fc_clients(id) on delete restrict,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  measured_on date not null default current_date,
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg between 10 and 700),
  body_fat_percent numeric(5,2) check (body_fat_percent is null or body_fat_percent between 0 and 100),
  muscle_mass_kg numeric(6,2) check (muscle_mass_kg is null or muscle_mass_kg between 0 and 500),
  waist_cm numeric(6,2) check (waist_cm is null or waist_cm between 20 and 400),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(subject_user_id, client_id) = 1),
  check (num_nonnulls(weight_kg, body_fat_percent, muscle_mass_kg, waist_cm) > 0)
);

create table private.fc_role_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  old_role text,
  new_role text not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

-- Foreign keys are indexed explicitly; PostgreSQL does not create these indexes automatically.
create index fc_clients_primary_trainer_idx on public.fc_clients (primary_trainer_id);
create index fc_clients_active_idx on public.fc_clients (primary_trainer_id, created_at desc) where archived_at is null;
create index fc_client_staff_user_idx on public.fc_client_staff (staff_user_id, client_id);
create index fc_client_staff_assigned_by_idx on public.fc_client_staff (assigned_by);
create index fc_memberships_client_idx on public.fc_memberships (client_id, ends_on desc);
create index fc_memberships_created_by_idx on public.fc_memberships (created_by);
create index fc_client_injuries_client_idx on public.fc_client_injuries (client_id, status);
create index fc_client_injuries_injury_idx on public.fc_client_injuries (injury_id) where injury_id is not null;
create index fc_client_injuries_recorded_by_idx on public.fc_client_injuries (recorded_by);
create index fc_exercises_created_by_idx on public.fc_exercises (created_by) where created_by is not null;
create index fc_exercise_equipment_equipment_idx on public.fc_exercise_equipment (equipment_id, exercise_id);
create index fc_exercise_alternatives_alternative_idx on public.fc_exercise_alternatives (alternative_exercise_id);
create index fc_favorite_exercises_exercise_idx on public.fc_favorite_exercises (exercise_id);
create index fc_exercise_notes_exercise_idx on public.fc_exercise_notes (exercise_id);
create index fc_routines_owner_active_idx on public.fc_routines (owner_user_id, updated_at desc) where archived_at is null and owner_user_id is not null;
create index fc_routines_client_active_idx on public.fc_routines (client_id, updated_at desc) where archived_at is null and client_id is not null;
create index fc_routines_created_by_idx on public.fc_routines (created_by, created_at desc);
create index fc_routine_exercises_routine_day_idx on public.fc_routine_exercises (routine_id, day_of_week, order_index);
create index fc_routine_exercises_exercise_idx on public.fc_routine_exercises (exercise_id);
create index fc_ai_requests_subject_idx on public.fc_ai_routine_requests (subject_user_id, status, created_at desc) where subject_user_id is not null;
create index fc_ai_requests_client_idx on public.fc_ai_routine_requests (client_id, status, created_at desc) where client_id is not null;
create index fc_ai_requests_requested_by_idx on public.fc_ai_routine_requests (requested_by, created_at desc);
create index fc_ai_requests_generated_routine_idx on public.fc_ai_routine_requests (generated_routine_id) where generated_routine_id is not null;
create index fc_ai_request_equipment_equipment_idx on public.fc_ai_request_equipment (equipment_id);
create index fc_workout_sessions_routine_idx on public.fc_workout_sessions (routine_id);
create index fc_workout_sessions_subject_idx on public.fc_workout_sessions (subject_user_id, started_at desc) where subject_user_id is not null;
create index fc_workout_sessions_client_idx on public.fc_workout_sessions (client_id, started_at desc) where client_id is not null;
create index fc_workout_sessions_recorded_by_idx on public.fc_workout_sessions (recorded_by, created_at desc);
create index fc_set_logs_session_idx on public.fc_set_logs (session_id, routine_exercise_id, set_number);
create index fc_set_logs_routine_exercise_idx on public.fc_set_logs (routine_exercise_id);
create index fc_body_measurements_subject_idx on public.fc_body_measurements (subject_user_id, measured_on desc) where subject_user_id is not null;
create index fc_body_measurements_client_idx on public.fc_body_measurements (client_id, measured_on desc) where client_id is not null;
create index fc_body_measurements_recorded_by_idx on public.fc_body_measurements (recorded_by);

create function private.fc_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.fc_current_app_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('patient', 'trainer', 'admin')
      then (select auth.jwt() -> 'app_metadata' ->> 'role')
    else 'patient'
  end;
$$;

create function private.fc_is_staff()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select private.fc_current_app_role()) in ('trainer', 'admin');
$$;

create function private.fc_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select private.fc_current_app_role()) = 'admin';
$$;

create function private.fc_can_access_client(p_client_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.fc_clients c
    where c.id = p_client_id
      and (
        c.user_id = (select auth.uid())
        or (select private.fc_is_admin())
        or (
          (select private.fc_is_staff())
          and (
            c.primary_trainer_id = (select auth.uid())
            or exists (
              select 1
              from public.fc_client_staff cs
              where cs.client_id = c.id
                and cs.staff_user_id = (select auth.uid())
            )
          )
        )
      )
  );
$$;

create function private.fc_can_write_client(p_client_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.fc_clients c
    where c.id = p_client_id
      and (
        c.user_id = (select auth.uid())
        or (select private.fc_is_admin())
        or (
          (select private.fc_is_staff())
          and (
            c.primary_trainer_id = (select auth.uid())
            or exists (
              select 1
              from public.fc_client_staff cs
              where cs.client_id = c.id
                and cs.staff_user_id = (select auth.uid())
                and cs.access_level = 'coach'
            )
          )
        )
      )
  );
$$;

create function private.fc_can_read_routine(p_routine_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.fc_routines r
    where r.id = p_routine_id
      and (
        r.owner_user_id = (select auth.uid())
        or r.created_by = (select auth.uid())
        or (r.client_id is not null and (select private.fc_can_access_client(r.client_id)))
        or (select private.fc_is_admin())
      )
  );
$$;

create function private.fc_can_edit_routine(p_routine_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.fc_routines r
    where r.id = p_routine_id
      and (
        r.owner_user_id = (select auth.uid())
        or (select private.fc_is_admin())
        or (
          r.client_id is not null
          and (select private.fc_is_staff())
          and (select private.fc_can_write_client(r.client_id))
        )
      )
  );
$$;

create function private.fc_can_read_session(p_session_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.fc_workout_sessions s
    where s.id = p_session_id
      and (
        s.subject_user_id = (select auth.uid())
        or s.recorded_by = (select auth.uid())
        or (s.client_id is not null and (select private.fc_can_access_client(s.client_id)))
        or (select private.fc_is_admin())
      )
  );
$$;

create function private.fc_can_edit_session(p_session_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.fc_workout_sessions s
    where s.id = p_session_id
      and (
        s.subject_user_id = (select auth.uid())
        or s.recorded_by = (select auth.uid())
        or (select private.fc_is_admin())
        or (
          s.client_id is not null
          and (select private.fc_is_staff())
          and (select private.fc_can_write_client(s.client_id))
        )
      )
  );
$$;

create function private.fc_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  v_role := case
    when coalesce(new.raw_app_meta_data ->> 'role', '') in ('patient', 'trainer', 'admin')
      then new.raw_app_meta_data ->> 'role'
    else 'patient'
  end;

  insert into public.fc_profiles (user_id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    v_role
  );

  insert into private.fc_role_audit (user_id, old_role, new_role, changed_by)
  values (new.id, null, v_role, (select auth.uid()));

  return new;
end;
$$;

create function private.fc_sync_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_role text;
  v_new_role text;
begin
  v_old_role := case
    when coalesce(old.raw_app_meta_data ->> 'role', '') in ('patient', 'trainer', 'admin')
      then old.raw_app_meta_data ->> 'role'
    else 'patient'
  end;
  v_new_role := case
    when coalesce(new.raw_app_meta_data ->> 'role', '') in ('patient', 'trainer', 'admin')
      then new.raw_app_meta_data ->> 'role'
    else 'patient'
  end;

  if v_old_role is distinct from v_new_role then
    update public.fc_profiles
    set role = v_new_role, updated_at = now()
    where user_id = new.id;

    insert into private.fc_role_audit (user_id, old_role, new_role, changed_by)
    values (new.id, v_old_role, v_new_role, (select auth.uid()));
  end if;

  return new;
end;
$$;

create function private.fc_validate_staff_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
begin
  v_user_id := case when tg_table_name = 'fc_clients' then new.primary_trainer_id else new.staff_user_id end;
  select coalesce(u.raw_app_meta_data ->> 'role', 'patient')
  into v_role
  from auth.users u
  where u.id = v_user_id;

  if v_role not in ('trainer', 'admin') then
    raise exception 'The assigned user must have a trainer or admin app_metadata role.';
  end if;
  return new;
end;
$$;

create function private.fc_validate_workout_session()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.fc_routines r
    where r.id = new.routine_id
      and (
        (new.subject_user_id is not null and r.owner_user_id = new.subject_user_id)
        or (new.client_id is not null and r.client_id = new.client_id)
      )
  ) then
    raise exception 'The workout session subject must match the routine subject.';
  end if;
  return new;
end;
$$;

create trigger fc_profiles_set_updated_at before update on public.fc_profiles for each row execute function private.fc_set_updated_at();
create trigger fc_clients_set_updated_at before update on public.fc_clients for each row execute function private.fc_set_updated_at();
create trigger fc_memberships_set_updated_at before update on public.fc_memberships for each row execute function private.fc_set_updated_at();
create trigger fc_injuries_set_updated_at before update on public.fc_injuries for each row execute function private.fc_set_updated_at();
create trigger fc_client_injuries_set_updated_at before update on public.fc_client_injuries for each row execute function private.fc_set_updated_at();
create trigger fc_equipment_set_updated_at before update on public.fc_equipment for each row execute function private.fc_set_updated_at();
create trigger fc_exercises_set_updated_at before update on public.fc_exercises for each row execute function private.fc_set_updated_at();
create trigger fc_exercise_notes_set_updated_at before update on public.fc_exercise_notes for each row execute function private.fc_set_updated_at();
create trigger fc_routines_set_updated_at before update on public.fc_routines for each row execute function private.fc_set_updated_at();
create trigger fc_routine_exercises_set_updated_at before update on public.fc_routine_exercises for each row execute function private.fc_set_updated_at();
create trigger fc_workout_sessions_set_updated_at before update on public.fc_workout_sessions for each row execute function private.fc_set_updated_at();
create trigger fc_set_logs_set_updated_at before update on public.fc_set_logs for each row execute function private.fc_set_updated_at();
create trigger fc_body_measurements_set_updated_at before update on public.fc_body_measurements for each row execute function private.fc_set_updated_at();

create trigger fc_clients_validate_trainer before insert or update of primary_trainer_id on public.fc_clients for each row execute function private.fc_validate_staff_assignment();
create trigger fc_client_staff_validate_staff before insert or update of staff_user_id on public.fc_client_staff for each row execute function private.fc_validate_staff_assignment();
create trigger fc_workout_sessions_validate_subject before insert or update of routine_id, subject_user_id, client_id on public.fc_workout_sessions for each row execute function private.fc_validate_workout_session();

create trigger fc_on_auth_user_created after insert on auth.users for each row execute function private.fc_handle_new_user();
create trigger fc_on_auth_role_changed after update of raw_app_meta_data on auth.users for each row execute function private.fc_sync_user_role();

do $$
declare
  v_table regclass;
begin
  for v_table in
    select c.oid::regclass
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'fc\_%' escape '\'
  loop
    execute format('alter table %s enable row level security', v_table);
    execute format('revoke all privileges on table %s from anon, authenticated', v_table);
  end loop;
end $$;

create policy fc_profiles_select on public.fc_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.fc_is_admin())
  or (
    (select private.fc_is_staff())
    and exists (
      select 1 from public.fc_clients c
      where c.user_id = fc_profiles.user_id
        and (select private.fc_can_access_client(c.id))
    )
  )
);
create policy fc_profiles_update_self on public.fc_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy fc_clients_select on public.fc_clients for select to authenticated
using ((select private.fc_can_access_client(id)));
create policy fc_clients_insert on public.fc_clients for insert to authenticated
with check (
  (select private.fc_is_staff())
  and (primary_trainer_id = (select auth.uid()) or (select private.fc_is_admin()))
  and (user_id is null or (select private.fc_is_admin()))
);
create policy fc_clients_update on public.fc_clients for update to authenticated
using ((select private.fc_is_staff()) and (select private.fc_can_write_client(id)))
with check ((select private.fc_is_staff()) and (select private.fc_can_write_client(id)));

create policy fc_client_staff_select on public.fc_client_staff for select to authenticated
using ((select private.fc_can_access_client(client_id)));
create policy fc_client_staff_insert_admin on public.fc_client_staff for insert to authenticated
with check ((select private.fc_is_admin()) and assigned_by = (select auth.uid()));
create policy fc_client_staff_delete_admin on public.fc_client_staff for delete to authenticated
using ((select private.fc_is_admin()));

create policy fc_memberships_select on public.fc_memberships for select to authenticated
using ((select private.fc_can_access_client(client_id)));
create policy fc_memberships_insert on public.fc_memberships for insert to authenticated
with check (
  (select private.fc_is_staff())
  and (select private.fc_can_write_client(client_id))
  and created_by = (select auth.uid())
);
create policy fc_memberships_update on public.fc_memberships for update to authenticated
using ((select private.fc_is_staff()) and (select private.fc_can_write_client(client_id)))
with check ((select private.fc_is_staff()) and (select private.fc_can_write_client(client_id)));

create policy fc_injuries_read on public.fc_injuries for select to authenticated using (true);
create policy fc_injuries_admin_write on public.fc_injuries for all to authenticated
using ((select private.fc_is_admin()))
with check ((select private.fc_is_admin()));

create policy fc_client_injuries_select on public.fc_client_injuries for select to authenticated
using ((select private.fc_can_access_client(client_id)));
create policy fc_client_injuries_insert on public.fc_client_injuries for insert to authenticated
with check ((select private.fc_can_write_client(client_id)) and recorded_by = (select auth.uid()));
create policy fc_client_injuries_update on public.fc_client_injuries for update to authenticated
using ((select private.fc_can_write_client(client_id)))
with check ((select private.fc_can_write_client(client_id)));

create policy fc_equipment_read on public.fc_equipment for select to authenticated using (true);
create policy fc_equipment_admin_write on public.fc_equipment for all to authenticated
using ((select private.fc_is_admin()))
with check ((select private.fc_is_admin()));

create policy fc_exercises_read on public.fc_exercises for select to authenticated
using (is_active or (select private.fc_is_admin()));
create policy fc_exercises_admin_write on public.fc_exercises for all to authenticated
using ((select private.fc_is_admin()))
with check ((select private.fc_is_admin()));

create policy fc_exercise_equipment_read on public.fc_exercise_equipment for select to authenticated using (true);
create policy fc_exercise_equipment_admin_write on public.fc_exercise_equipment for all to authenticated
using ((select private.fc_is_admin()))
with check ((select private.fc_is_admin()));

create policy fc_exercise_alternatives_read on public.fc_exercise_alternatives for select to authenticated using (true);
create policy fc_exercise_alternatives_admin_write on public.fc_exercise_alternatives for all to authenticated
using ((select private.fc_is_admin()))
with check ((select private.fc_is_admin()));

create policy fc_favorites_self on public.fc_favorite_exercises for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy fc_exercise_notes_self on public.fc_exercise_notes for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy fc_routines_select on public.fc_routines for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or created_by = (select auth.uid())
  or (client_id is not null and (select private.fc_can_access_client(client_id)))
  or (select private.fc_is_admin())
);
create policy fc_routines_insert on public.fc_routines for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (owner_user_id = (select auth.uid()) and client_id is null)
    or (
      owner_user_id is null
      and client_id is not null
      and (select private.fc_is_staff())
      and (select private.fc_can_write_client(client_id))
    )
  )
);
create policy fc_routines_update on public.fc_routines for update to authenticated
using (
  owner_user_id = (select auth.uid())
  or (select private.fc_is_admin())
  or (client_id is not null and (select private.fc_is_staff()) and (select private.fc_can_write_client(client_id)))
)
with check (
  owner_user_id = (select auth.uid())
  or (select private.fc_is_admin())
  or (client_id is not null and (select private.fc_is_staff()) and (select private.fc_can_write_client(client_id)))
);

create policy fc_routine_days_select on public.fc_routine_days for select to authenticated
using ((select private.fc_can_read_routine(routine_id)));
create policy fc_routine_days_write on public.fc_routine_days for all to authenticated
using ((select private.fc_can_edit_routine(routine_id)))
with check ((select private.fc_can_edit_routine(routine_id)));

create policy fc_routine_exercises_select on public.fc_routine_exercises for select to authenticated
using ((select private.fc_can_read_routine(routine_id)));
create policy fc_routine_exercises_write on public.fc_routine_exercises for all to authenticated
using ((select private.fc_can_edit_routine(routine_id)))
with check ((select private.fc_can_edit_routine(routine_id)));

create policy fc_ai_requests_select on public.fc_ai_routine_requests for select to authenticated
using (
  subject_user_id = (select auth.uid())
  or requested_by = (select auth.uid())
  or (client_id is not null and (select private.fc_can_access_client(client_id)))
  or (select private.fc_is_admin())
);
create policy fc_ai_requests_insert on public.fc_ai_routine_requests for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and status = 'pending'
  and generated_routine_id is null
  and completed_at is null
  and (
    (subject_user_id = (select auth.uid()) and client_id is null)
    or (subject_user_id is null and client_id is not null and (select private.fc_can_write_client(client_id)))
  )
);

create policy fc_ai_request_days_select on public.fc_ai_request_days for select to authenticated
using (exists (
  select 1 from public.fc_ai_routine_requests q
  where q.id = request_id
));
create policy fc_ai_request_days_insert on public.fc_ai_request_days for insert to authenticated
with check (exists (
  select 1 from public.fc_ai_routine_requests q
  where q.id = request_id and q.requested_by = (select auth.uid()) and q.status = 'pending'
));
create policy fc_ai_request_days_delete on public.fc_ai_request_days for delete to authenticated
using (exists (
  select 1 from public.fc_ai_routine_requests q
  where q.id = request_id and q.requested_by = (select auth.uid()) and q.status = 'pending'
));

create policy fc_ai_request_equipment_select on public.fc_ai_request_equipment for select to authenticated
using (exists (
  select 1 from public.fc_ai_routine_requests q
  where q.id = request_id
));
create policy fc_ai_request_equipment_insert on public.fc_ai_request_equipment for insert to authenticated
with check (exists (
  select 1 from public.fc_ai_routine_requests q
  where q.id = request_id and q.requested_by = (select auth.uid()) and q.status = 'pending'
));
create policy fc_ai_request_equipment_delete on public.fc_ai_request_equipment for delete to authenticated
using (exists (
  select 1 from public.fc_ai_routine_requests q
  where q.id = request_id and q.requested_by = (select auth.uid()) and q.status = 'pending'
));

create policy fc_workout_sessions_select on public.fc_workout_sessions for select to authenticated
using (
  subject_user_id = (select auth.uid())
  or recorded_by = (select auth.uid())
  or (client_id is not null and (select private.fc_can_access_client(client_id)))
  or (select private.fc_is_admin())
);
create policy fc_workout_sessions_insert on public.fc_workout_sessions for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and status in ('planned', 'in_progress')
  and (
    (subject_user_id = (select auth.uid()) and client_id is null)
    or (subject_user_id is null and client_id is not null and (select private.fc_can_write_client(client_id)))
  )
);
create policy fc_workout_sessions_update on public.fc_workout_sessions for update to authenticated
using (
  subject_user_id = (select auth.uid())
  or recorded_by = (select auth.uid())
  or (select private.fc_is_admin())
  or (client_id is not null and (select private.fc_is_staff()) and (select private.fc_can_write_client(client_id)))
)
with check (
  subject_user_id = (select auth.uid())
  or recorded_by = (select auth.uid())
  or (select private.fc_is_admin())
  or (client_id is not null and (select private.fc_is_staff()) and (select private.fc_can_write_client(client_id)))
);

create policy fc_set_logs_select on public.fc_set_logs for select to authenticated
using ((select private.fc_can_read_session(session_id)));
create policy fc_set_logs_write on public.fc_set_logs for all to authenticated
using ((select private.fc_can_edit_session(session_id)))
with check ((select private.fc_can_edit_session(session_id)));

create policy fc_body_measurements_select on public.fc_body_measurements for select to authenticated
using (
  subject_user_id = (select auth.uid())
  or recorded_by = (select auth.uid())
  or (client_id is not null and (select private.fc_can_access_client(client_id)))
  or (select private.fc_is_admin())
);
create policy fc_body_measurements_insert on public.fc_body_measurements for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and (
    (subject_user_id = (select auth.uid()) and client_id is null)
    or (subject_user_id is null and client_id is not null and (select private.fc_can_write_client(client_id)))
  )
);
create policy fc_body_measurements_update on public.fc_body_measurements for update to authenticated
using (
  subject_user_id = (select auth.uid())
  or recorded_by = (select auth.uid())
  or (select private.fc_is_admin())
  or (client_id is not null and (select private.fc_is_staff()) and (select private.fc_can_write_client(client_id)))
)
with check (
  subject_user_id = (select auth.uid())
  or recorded_by = (select auth.uid())
  or (select private.fc_is_admin())
  or (client_id is not null and (select private.fc_is_staff()) and (select private.fc_can_write_client(client_id)))
);

-- The mobile/web client receives only the operations and columns it needs.
grant usage on schema public to authenticated;
grant select on public.fc_profiles to authenticated;
grant update (full_name, phone, avatar_url, experience_level, preferred_units, onboarding_complete) on public.fc_profiles to authenticated;

grant select, insert on public.fc_clients to authenticated;
grant update (full_name, email, phone, status, goal, height_cm, birth_date, notes, archived_at) on public.fc_clients to authenticated;
grant select, insert, delete on public.fc_client_staff to authenticated;
grant select, insert on public.fc_memberships to authenticated;
grant update (plan_name, starts_on, ends_on, status) on public.fc_memberships to authenticated;
grant select, insert, update, delete on public.fc_injuries to authenticated;
grant select, insert on public.fc_client_injuries to authenticated;
grant update (injury_id, custom_name, notes, severity, status) on public.fc_client_injuries to authenticated;
grant select, insert, update, delete on public.fc_equipment to authenticated;
grant select, insert, update, delete on public.fc_exercises to authenticated;
grant select, insert, update, delete on public.fc_exercise_equipment to authenticated;
grant select, insert, update, delete on public.fc_exercise_alternatives to authenticated;
grant select, insert, delete on public.fc_favorite_exercises to authenticated;
grant select, insert, delete on public.fc_exercise_notes to authenticated;
grant update (note) on public.fc_exercise_notes to authenticated;
grant select, insert on public.fc_routines to authenticated;
grant update (name, source, goal, experience_level, training_location, focus_mode, priority_muscles, session_minutes, preferred_time, days_per_week, archived_at) on public.fc_routines to authenticated;
grant select, insert, update, delete on public.fc_routine_days to authenticated;
grant select, insert, delete on public.fc_routine_exercises to authenticated;
grant update (exercise_id, day_of_week, order_index, sets, reps_min, reps_max, duration_seconds, rest_seconds, notes) on public.fc_routine_exercises to authenticated;
grant select, insert on public.fc_ai_routine_requests to authenticated;
grant select, insert, delete on public.fc_ai_request_days to authenticated;
grant select, insert, delete on public.fc_ai_request_equipment to authenticated;
grant select, insert on public.fc_workout_sessions to authenticated;
grant update (status, started_at, completed_at, duration_seconds, notes) on public.fc_workout_sessions to authenticated;
grant select, insert, delete on public.fc_set_logs to authenticated;
grant update (set_number, reps_completed, weight, weight_unit, rpe, completed_at, notes) on public.fc_set_logs to authenticated;
grant select, insert on public.fc_body_measurements to authenticated;
grant update (measured_on, weight_kg, body_fat_percent, muscle_mass_kg, waist_cm, notes) on public.fc_body_measurements to authenticated;

grant usage, select on all sequences in schema public to authenticated;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

revoke all on function private.fc_set_updated_at() from public, anon, authenticated;
revoke all on function private.fc_handle_new_user() from public, anon, authenticated;
revoke all on function private.fc_sync_user_role() from public, anon, authenticated;
revoke all on function private.fc_validate_staff_assignment() from public, anon, authenticated;
revoke all on function private.fc_validate_workout_session() from public, anon, authenticated;

revoke all on function private.fc_current_app_role() from public, anon, authenticated;
revoke all on function private.fc_is_staff() from public, anon, authenticated;
revoke all on function private.fc_is_admin() from public, anon, authenticated;
revoke all on function private.fc_can_access_client(bigint) from public, anon, authenticated;
revoke all on function private.fc_can_write_client(bigint) from public, anon, authenticated;
revoke all on function private.fc_can_read_routine(bigint) from public, anon, authenticated;
revoke all on function private.fc_can_edit_routine(bigint) from public, anon, authenticated;
revoke all on function private.fc_can_read_session(bigint) from public, anon, authenticated;
revoke all on function private.fc_can_edit_session(bigint) from public, anon, authenticated;

grant execute on function private.fc_current_app_role() to authenticated;
grant execute on function private.fc_is_staff() to authenticated;
grant execute on function private.fc_is_admin() to authenticated;
grant execute on function private.fc_can_access_client(bigint) to authenticated;
grant execute on function private.fc_can_write_client(bigint) to authenticated;
grant execute on function private.fc_can_read_routine(bigint) to authenticated;
grant execute on function private.fc_can_edit_routine(bigint) to authenticated;
grant execute on function private.fc_can_read_session(bigint) to authenticated;
grant execute on function private.fc_can_edit_session(bigint) to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema private to service_role;

insert into public.fc_equipment (slug, name, category) values
  ('bodyweight', 'Peso corporal', 'bodyweight'),
  ('dumbbells', 'Mancuernas', 'free_weight'),
  ('barbell', 'Barra olímpica', 'free_weight'),
  ('squat-rack', 'Rack de sentadilla', 'machine'),
  ('leg-press', 'Prensa de pierna', 'machine'),
  ('leg-extension', 'Extensión de pierna', 'machine'),
  ('resistance-bands', 'Bandas elásticas', 'band')
on conflict (slug) do nothing;

insert into public.fc_injuries (name, body_area, description) values
  ('Dolor de rodilla', 'Rodilla', 'Molestia o limitación al flexionar la rodilla.'),
  ('Dolor lumbar', 'Espalda baja', 'Molestia en la región lumbar.'),
  ('Lesión de hombro', 'Hombro', 'Limitación de carga o rango en el hombro.'),
  ('Lesión de tobillo', 'Tobillo', 'Limitación de estabilidad o movilidad del tobillo.')
on conflict (name) do nothing;

insert into public.fc_exercises (name, muscle_group, secondary_muscles, difficulty, exercise_type, instructions, coaching_tip) values
  ('Sentadilla con barra', 'Cuádriceps', array['Glúteos', 'Core'], 'intermediate', 'compound', array['Apoya la barra sobre los trapecios.', 'Activa el abdomen y lleva la cadera hacia atrás.', 'Desciende con control y empuja el suelo al subir.'], 'Mantén las rodillas alineadas con los pies.'),
  ('Peso muerto rumano', 'Isquiotibiales', array['Glúteos', 'Espalda'], 'intermediate', 'compound', array['Mantén la espalda neutra.', 'Lleva la cadera hacia atrás.', 'Extiende la cadera para regresar.'], 'Mantén el peso cerca de las piernas.'),
  ('Prensa de pierna', 'Cuádriceps', array['Glúteos'], 'beginner', 'compound', array['Apoya toda la espalda.', 'Desciende la plataforma con control.', 'Extiende sin bloquear las rodillas.'], 'No despegues la cadera del respaldo.'),
  ('Extensión de pierna', 'Cuádriceps', '{}', 'beginner', 'isolation', array['Ajusta el rodillo sobre los tobillos.', 'Extiende las rodillas con control.', 'Regresa lentamente.'], 'Evita impulsar el peso.'),
  ('Lagartija', 'Pecho', array['Tríceps', 'Hombros', 'Core'], 'beginner', 'compound', array['Coloca las manos debajo de los hombros.', 'Mantén el cuerpo alineado.', 'Baja con control y empuja el suelo.'], 'Mantén la respiración constante.'),
  ('Sentadilla goblet', 'Cuádriceps', array['Glúteos', 'Core'], 'beginner', 'compound', array['Sostén una mancuerna frente al pecho.', 'Baja con el torso erguido.', 'Empuja el suelo para subir.'], 'Mantén los talones apoyados.'),
  ('Curl femoral con banda', 'Isquiotibiales', array['Glúteos'], 'beginner', 'isolation', array['Ancla la banda de forma segura.', 'Flexiona la rodilla con control.', 'Regresa lentamente.'], 'Evita elevar la cadera.')
on conflict (name) do nothing;

insert into public.fc_exercise_equipment (exercise_id, equipment_id)
select e.id, q.id
from public.fc_exercises e
join public.fc_equipment q on
  (e.name = 'Lagartija' and q.slug = 'bodyweight')
  or (e.name = 'Sentadilla con barra' and q.slug in ('barbell', 'squat-rack'))
  or (e.name = 'Peso muerto rumano' and q.slug in ('barbell', 'dumbbells'))
  or (e.name = 'Prensa de pierna' and q.slug = 'leg-press')
  or (e.name = 'Extensión de pierna' and q.slug = 'leg-extension')
  or (e.name = 'Sentadilla goblet' and q.slug = 'dumbbells')
  or (e.name = 'Curl femoral con banda' and q.slug = 'resistance-bands')
on conflict do nothing;

insert into public.fc_exercise_alternatives (exercise_id, alternative_exercise_id, reason)
select source.id, alternative.id, 'Mismo grupo muscular con equipo diferente'
from public.fc_exercises source
join public.fc_exercises alternative on
  (source.name = 'Sentadilla con barra' and alternative.name in ('Sentadilla goblet', 'Prensa de pierna'))
  or (source.name = 'Peso muerto rumano' and alternative.name = 'Curl femoral con banda')
  or (source.name = 'Prensa de pierna' and alternative.name = 'Sentadilla goblet')
on conflict do nothing;

commit;
