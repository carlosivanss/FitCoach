begin;

create or replace function public.fc_create_client(
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_goal text default null,
  p_height_cm numeric default null,
  p_birth_date date default null,
  p_notes text default null
)
returns public.fc_clients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_client public.fc_clients;
begin
  select coalesce(u.raw_app_meta_data ->> 'role', 'patient')
    into v_role
  from auth.users u
  where u.id = v_user_id;

  if v_user_id is null or v_role not in ('trainer', 'admin') then
    raise exception 'Only authenticated trainers can create clients.'
      using errcode = '42501';
  end if;

  insert into public.fc_clients (
    primary_trainer_id,
    full_name,
    email,
    phone,
    status,
    goal,
    height_cm,
    birth_date,
    notes
  ) values (
    v_user_id,
    trim(p_full_name),
    nullif(trim(p_email), ''),
    nullif(trim(p_phone), ''),
    case when nullif(trim(p_email), '') is null then 'active' else 'invited' end,
    nullif(trim(p_goal), ''),
    p_height_cm,
    p_birth_date,
    nullif(trim(p_notes), '')
  )
  returning * into v_client;

  return v_client;
end;
$$;

revoke all on function public.fc_create_client(text, text, text, text, numeric, date, text)
  from public, anon;
grant execute on function public.fc_create_client(text, text, text, text, numeric, date, text)
  to authenticated;

commit;
