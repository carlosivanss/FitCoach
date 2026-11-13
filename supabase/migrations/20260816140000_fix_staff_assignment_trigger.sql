begin;

create or replace function private.fc_validate_staff_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
begin
  if tg_table_name = 'fc_clients' then
    v_user_id := new.primary_trainer_id;
  elsif tg_table_name = 'fc_client_staff' then
    v_user_id := new.staff_user_id;
  else
    raise exception 'Unsupported table for staff assignment validation: %', tg_table_name;
  end if;

  select coalesce(u.raw_app_meta_data ->> 'role', 'patient')
  into v_role
  from auth.users u
  where u.id = v_user_id;

  if v_role is null or v_role not in ('trainer', 'admin') then
    raise exception 'The assigned user must have a trainer or admin app_metadata role.';
  end if;

  return new;
end;
$$;

revoke all on function private.fc_validate_staff_assignment() from public, anon, authenticated;
grant execute on function private.fc_validate_staff_assignment() to service_role;

commit;
