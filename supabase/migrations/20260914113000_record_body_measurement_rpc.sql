begin;

create or replace function public.fc_record_body_measurement(
  p_client_id bigint,
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
  v_role text;
  v_measurement public.fc_body_measurements;
begin
  select coalesce(u.raw_app_meta_data ->> 'role', 'patient')
    into v_role
  from auth.users u
  where u.id = v_user_id;

  if v_user_id is null or v_role not in ('trainer', 'admin') then
    raise exception 'Only authenticated staff can record measurements.' using errcode = '42501';
  end if;

  if num_nonnulls(p_weight_kg, p_body_fat_percent, p_muscle_mass_kg, p_waist_cm) = 0 then
    raise exception 'At least one body measurement is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.fc_clients c
    where c.id = p_client_id
      and (v_role = 'admin' or c.primary_trainer_id = v_user_id or exists (
        select 1 from public.fc_client_staff cs where cs.client_id = c.id and cs.staff_user_id = v_user_id
      ))
  ) then
    raise exception 'Client not found or not assigned to this account.' using errcode = '42501';
  end if;

  insert into public.fc_body_measurements (
    client_id, recorded_by, measured_on, weight_kg, body_fat_percent,
    muscle_mass_kg, waist_cm, notes
  ) values (
    p_client_id, v_user_id, coalesce(p_measured_on, current_date), p_weight_kg,
    p_body_fat_percent, p_muscle_mass_kg, p_waist_cm, nullif(trim(p_notes), '')
  ) returning * into v_measurement;

  return v_measurement;
end;
$$;

revoke all on function public.fc_record_body_measurement(bigint, date, numeric, numeric, numeric, numeric, text)
  from public, anon;
grant execute on function public.fc_record_body_measurement(bigint, date, numeric, numeric, numeric, numeric, text)
  to authenticated;

commit;
