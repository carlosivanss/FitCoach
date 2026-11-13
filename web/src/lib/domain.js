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
          exercise_type: exerciseKind(x),
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

/** Etiqueta, siglas y color por grupo muscular del catálogo (campo `target`). */
export const MUSCLES = {
  abs: { es: 'Abdominales', abbr: 'ABS', tone: 'amber' },
  pectorals: { es: 'Pectorales', abbr: 'PEC', tone: 'rose' },
  'serratus anterior': { es: 'Serrato', abbr: 'SER', tone: 'rose' },
  biceps: { es: 'Bíceps', abbr: 'BIC', tone: 'violet' },
  triceps: { es: 'Tríceps', abbr: 'TRI', tone: 'violet' },
  forearms: { es: 'Antebrazos', abbr: 'ANT', tone: 'violet' },
  glutes: { es: 'Glúteos', abbr: 'GLU', tone: 'green' },
  quads: { es: 'Cuádriceps', abbr: 'CUA', tone: 'green' },
  hamstrings: { es: 'Isquios', abbr: 'ISQ', tone: 'green' },
  calves: { es: 'Pantorrillas', abbr: 'PAN', tone: 'green' },
  adductors: { es: 'Aductores', abbr: 'ADU', tone: 'green' },
  abductors: { es: 'Abductores', abbr: 'ABD', tone: 'green' },
  delts: { es: 'Hombros', abbr: 'HOM', tone: 'blue' },
  traps: { es: 'Trapecios', abbr: 'TRA', tone: 'blue' },
  'levator scapulae': { es: 'Elevador escápula', abbr: 'ELE', tone: 'blue' },
  lats: { es: 'Dorsales', abbr: 'DOR', tone: 'teal' },
  'upper back': { es: 'Espalda alta', abbr: 'ESP', tone: 'teal' },
  spine: { es: 'Lumbar', abbr: 'LUM', tone: 'teal' },
  'cardiovascular system': { es: 'Cardio', abbr: 'CAR', tone: 'slate' },
};

export const EQUIPMENT_ES = {
  'body weight': 'Peso corporal', dumbbell: 'Mancuerna', cable: 'Polea', barbell: 'Barra',
  'leverage machine': 'Máquina', band: 'Banda elástica', kettlebell: 'Pesa rusa', 'smith machine': 'Smith',
  'ez barbell': 'Barra Z', 'sled machine': 'Trineo', 'medicine ball': 'Balón medicinal', 'stability ball': 'Pelota suiza',
  assisted: 'Asistido', weighted: 'Con lastre', roller: 'Rodillo', rope: 'Cuerda',
};

export const muscleInfo = (target) => MUSCLES[target] || { es: target ? target[0].toUpperCase() + target.slice(1) : 'General', abbr: String(target || 'GEN').slice(0, 3).toUpperCase(), tone: 'slate' };
export const equipmentLabel = (value) => EQUIPMENT_ES[value] || (value ? value[0].toUpperCase() + value.slice(1) : 'Sin equipo');

/** Aproximación: cardio, compuesto (2+ músculos secundarios) o aislado. */
export function exerciseKind(x) {
  if (x?.target === 'cardiovascular system' || x?.category === 'cardio') return 'cardio';
  return (x?.secondary_muscles?.length || 0) >= 2 ? 'compound' : 'isolation';
}
export const KIND_LABEL = { compound: 'Compuesto', isolation: 'Aislado', cardio: 'Cardio' };
