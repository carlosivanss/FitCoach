begin;

create or replace function private.fc_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select private.fc_current_app_role()) = 'admin'
    and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

revoke all on function private.fc_is_admin() from public, anon, authenticated;
grant execute on function private.fc_is_admin() to authenticated;
grant execute on function private.fc_is_admin() to service_role;

commit;
