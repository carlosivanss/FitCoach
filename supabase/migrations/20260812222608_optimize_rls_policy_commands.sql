begin;

drop policy fc_injuries_admin_write on public.fc_injuries;
create policy fc_injuries_admin_insert on public.fc_injuries for insert to authenticated
with check ((select private.fc_is_admin()));
create policy fc_injuries_admin_update on public.fc_injuries for update to authenticated
using ((select private.fc_is_admin()))
with check ((select private.fc_is_admin()));
create policy fc_injuries_admin_delete on public.fc_injuries for delete to authenticated
using ((select private.fc_is_admin()));

drop policy fc_equipment_admin_write on public.fc_equipment;
create policy fc_equipment_admin_insert on public.fc_equipment for insert to authenticated
with check ((select private.fc_is_admin()));
create policy fc_equipment_admin_update on public.fc_equipment for update to authenticated
using ((select private.fc_is_admin()))
with check ((select private.fc_is_admin()));
create policy fc_equipment_admin_delete on public.fc_equipment for delete to authenticated
using ((select private.fc_is_admin()));

drop policy fc_exercises_admin_write on public.fc_exercises;
create policy fc_exercises_admin_insert on public.fc_exercises for insert to authenticated
with check ((select private.fc_is_admin()));
create policy fc_exercises_admin_update on public.fc_exercises for update to authenticated
using ((select private.fc_is_admin()))
with check ((select private.fc_is_admin()));
create policy fc_exercises_admin_delete on public.fc_exercises for delete to authenticated
using ((select private.fc_is_admin()));

drop policy fc_exercise_equipment_admin_write on public.fc_exercise_equipment;
create policy fc_exercise_equipment_admin_insert on public.fc_exercise_equipment for insert to authenticated
with check ((select private.fc_is_admin()));
create policy fc_exercise_equipment_admin_update on public.fc_exercise_equipment for update to authenticated
using ((select private.fc_is_admin()))
with check ((select private.fc_is_admin()));
create policy fc_exercise_equipment_admin_delete on public.fc_exercise_equipment for delete to authenticated
using ((select private.fc_is_admin()));

drop policy fc_exercise_alternatives_admin_write on public.fc_exercise_alternatives;
create policy fc_exercise_alternatives_admin_insert on public.fc_exercise_alternatives for insert to authenticated
with check ((select private.fc_is_admin()));
create policy fc_exercise_alternatives_admin_update on public.fc_exercise_alternatives for update to authenticated
using ((select private.fc_is_admin()))
with check ((select private.fc_is_admin()));
create policy fc_exercise_alternatives_admin_delete on public.fc_exercise_alternatives for delete to authenticated
using ((select private.fc_is_admin()));

drop policy fc_routine_days_write on public.fc_routine_days;
create policy fc_routine_days_insert on public.fc_routine_days for insert to authenticated
with check ((select private.fc_can_edit_routine(routine_id)));
create policy fc_routine_days_update on public.fc_routine_days for update to authenticated
using ((select private.fc_can_edit_routine(routine_id)))
with check ((select private.fc_can_edit_routine(routine_id)));
create policy fc_routine_days_delete on public.fc_routine_days for delete to authenticated
using ((select private.fc_can_edit_routine(routine_id)));

drop policy fc_routine_exercises_write on public.fc_routine_exercises;
create policy fc_routine_exercises_insert on public.fc_routine_exercises for insert to authenticated
with check ((select private.fc_can_edit_routine(routine_id)));
create policy fc_routine_exercises_update on public.fc_routine_exercises for update to authenticated
using ((select private.fc_can_edit_routine(routine_id)))
with check ((select private.fc_can_edit_routine(routine_id)));
create policy fc_routine_exercises_delete on public.fc_routine_exercises for delete to authenticated
using ((select private.fc_can_edit_routine(routine_id)));

drop policy fc_set_logs_write on public.fc_set_logs;
create policy fc_set_logs_insert on public.fc_set_logs for insert to authenticated
with check ((select private.fc_can_edit_session(session_id)));
create policy fc_set_logs_update on public.fc_set_logs for update to authenticated
using ((select private.fc_can_edit_session(session_id)))
with check ((select private.fc_can_edit_session(session_id)));
create policy fc_set_logs_delete on public.fc_set_logs for delete to authenticated
using ((select private.fc_can_edit_session(session_id)));

commit;
