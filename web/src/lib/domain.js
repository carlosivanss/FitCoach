export const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const statusText = (value) => ({
  invited: 'Invitado', active: 'Activo', paused: 'Pausado', archived: 'Baja',
}[value] || value);

export const statusClass = (value) => value === 'active'
  ? 'active'
  : value === 'invited'
    ? 'expiring'
    : value === 'archived' ? 'expired' : 'neutral';

export const initials = (name = '') => name
  .split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'FC';

export function workoutVolume(session) {
  return (session.fc_set_logs || []).reduce(
    (total, set) => total + Number(set.weight || 0) * Number(set.reps_completed || 0),
    0,
  );
}

export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const clampInt = (value, min, max, fallback) => {
  if (value === '' || value == null) return fallback;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function isNetworkError(cause) {
  const text = `${cause?.name || ''} ${cause?.message || ''}`.toLowerCase();
  return cause instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed|fetch/.test(text);
}

/** Convierte la rutina del constructor en los argumentos de la RPC fc_create_routine. */
export function buildRoutinePayload(routine) {
  return {
    p_client_id: Number(routine.client_id),
    p_name: String(routine.name || '').trim(),
    p_session_minutes: clampInt(routine.session_minutes, 30, 90, 60),
    p_days: routine.days.map((day) => ({
      day: day.day,
      label: DAY_NAMES[day.day],
      exercises: day.exercises.map((x) => {
        const repsMin = clampInt(x.reps_min, 1, 200, 10);
        return {
          name: x.name,
          muscle_group: x.target || x.muscle_group || x.category || 'general',
          secondary_muscles: x.secondary_muscles || [],
          exercise_type: x.category === 'cardio' ? 'cardio' : 'compound',
          instructions: x.instruction_steps?.es || [],
          coaching_tip: x.equipment ? `Equipo: ${x.equipment}` : null,
          sets: clampInt(x.sets, 1, 20, 3),
          reps_min: repsMin,
          reps_max: Math.max(repsMin, clampInt(x.reps_max, 1, 200, repsMin)),
          rest_seconds: clampInt(x.rest_seconds, 0, 1800, 90),
        };
      }),
    })),
  };
}
