begin;

alter table public.fc_clients drop constraint fc_clients_status_check;
alter table public.fc_clients
  add constraint fc_clients_status_check
  check (status in ('invited', 'active', 'paused', 'archived'));

create or replace function private.fc_activate_invited_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.fc_clients
    set status = 'active', updated_at = now()
    where user_id = new.id and status = 'invited';
  end if;
  return new;
end;
$$;

create trigger fc_on_invited_user_confirmed
after update of email_confirmed_at on auth.users
for each row execute function private.fc_activate_invited_client();

revoke all on function private.fc_activate_invited_client() from public, anon, authenticated;
grant execute on function private.fc_activate_invited_client() to service_role;

commit;
