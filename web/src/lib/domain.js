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
          name: exerciseName(x),
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

/** Paciente con correo, sin cuenta vinculada y no dado de baja: la invitación sigue pendiente. */
export const isInvitePending = (client) => Boolean(client?.email && !client.user_id && client.status !== 'archived');

/** Valida el formulario de paciente. Devuelve un mensaje en español o '' si es válido. */
export function validateClient(form, today = localDate()) {
  const name = String(form.full_name || '').trim();
  if (name.length < 2 || name.length > 120) return 'El nombre debe tener entre 2 y 120 caracteres.';
  const email = String(form.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'El correo no tiene un formato válido.';
  const phone = String(form.phone || '').trim();
  if (phone && phone.replace(/\D/g, '').length < 7) return 'El teléfono debe tener al menos 7 dígitos.';
  if (form.height_cm !== '' && form.height_cm != null) {
    const h = Number(form.height_cm);
    if (!Number.isFinite(h) || h < 50 || h > 280) return 'La estatura debe estar entre 50 y 280 cm.';
  }
  if (form.birth_date && form.birth_date > today) return 'La fecha de nacimiento no puede ser futura.';
  if (!form.id && form.initial_weight_kg !== '' && form.initial_weight_kg != null) {
    const w = Number(form.initial_weight_kg);
    if (!Number.isFinite(w) || w < 10 || w > 700) return 'El peso inicial debe estar entre 10 y 700 kg.';
  }
  return '';
}

/** Traduce errores de Postgres/PostgREST a mensajes comprensibles. */
export function friendlyDbError(cause) {
  const code = cause?.code;
  if (code === '23505') return 'Ya existe un paciente con ese correo.';
  if (code === '23514') return 'Algún dato está fuera del rango permitido. Revisa estatura, fecha de nacimiento y estado.';
  if (code === '42501') return 'No tienes permiso para esta operación. Si eres administrador, verifica tu sesión con MFA.';
  return '';
}

export const CLIENT_FILTERS = [['all', 'Todos'], ['active', 'Activos'], ['paused', 'Pausados'], ['invited', 'Invitación pendiente'], ['archived', 'Baja']];

export function matchesClientFilter(client, filter) {
  if (!filter || filter === 'all') return client.status !== 'archived';
  if (filter === 'invited') return isInvitePending(client);
  return client.status === filter;
}

/** Primer nombre para saludos; cae al correo si no hay nombre. */
export const firstName = (fullName, email = '') => {
  const name = String(fullName || '').trim();
  if (name && !name.includes('@')) return name.split(/\s+/)[0];
  return String(email || '').split('@')[0] || 'bienvenido';
};

/** Valida el cambio de contraseña. Devuelve un mensaje en español o ''. */
export function validatePasswordChange(password, confirm) {
  if (String(password || '').length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (password !== confirm) return 'Las contraseñas no coinciden.';
  return '';
}

/** Valida un archivo de imagen de perfil (tipo y tamaño de origen). */
export function validateAvatarFile(file) {
  if (!file) return 'Selecciona una imagen.';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Usa una imagen JPG, PNG o WebP.';
  if (file.size > 10 * 1024 * 1024) return 'La imagen no debe pesar más de 10 MB.';
  return '';
}

/** Nombre para el saludo: nombre completo del perfil; si no existe, la parte local del correo. */
export const greetingName = (fullName, email = '') => {
  const name = String(fullName || '').trim();
  return name && !name.includes('@') ? name : String(email || '').split('@')[0] || 'bienvenido';
};

/** Nombre visible del ejercicio: traducción al español si existe. */
export const exerciseName = (x) => x?.name_es || x?.name || '';

/** Texto en minúsculas para buscar por nombre (ES/EN), músculo y equipo. */
export const exerciseSearchText = (x) =>
  [x.name_es, x.name, muscleInfo(x.target).es, x.target, x.category, equipmentLabel(x.equipment), x.equipment].join(' ').toLowerCase();

const SECONDARY_ES = {
  shoulders: 'Hombros', hamstrings: 'Isquiotibiales', forearms: 'Antebrazos', triceps: 'Tríceps', biceps: 'Bíceps',
  quadriceps: 'Cuádriceps', calves: 'Pantorrillas', glutes: 'Glúteos', core: 'Core', chest: 'Pecho',
  'hip flexors': 'Flexores de cadera', obliques: 'Oblicuos', 'lower back': 'Espalda baja', rhomboids: 'Romboides',
  trapezius: 'Trapecio', 'upper back': 'Espalda alta', traps: 'Trapecio', deltoids: 'Deltoides', 'rear deltoids': 'Deltoides posterior',
  brachialis: 'Braquial', back: 'Espalda', ankles: 'Tobillos', feet: 'Pies', 'rotator cuff': 'Manguito rotador',
  'latissimus dorsi': 'Dorsal ancho', 'ankle stabilizers': 'Estabilizadores de tobillo', soleus: 'Sóleo', wrists: 'Muñecas',
  'upper chest': 'Pecho superior', 'wrist flexors': 'Flexores de muñeca', 'wrist extensors': 'Extensores de muñeca', hands: 'Manos',
  abdominals: 'Abdominales', sternocleidomastoid: 'Esternocleidomastoideo', 'inner thighs': 'Muslo interno', 'grip muscles': 'Músculos de agarre',
  shins: 'Espinillas', lats: 'Dorsales', 'lower abs': 'Abdomen inferior', groin: 'Ingle',
};
/** Etiqueta en español para músculos secundarios del dataset. */
export const secondaryLabel = (value) => SECONDARY_ES[value] || (value ? value[0].toUpperCase() + value.slice(1) : '');
