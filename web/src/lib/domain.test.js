import { describe, expect, it } from 'vitest';
import { formatDate, parseDecimal, exerciseName, exerciseSearchText, secondaryLabel, greetingName, firstName, validatePasswordChange, validateAvatarFile, validateClient, friendlyDbError, isInvitePending, matchesClientFilter, buildRoutinePayload, equipmentLabel, exerciseKind, muscleInfo, clampInt, initials, isNetworkError, localDate, statusClass, statusText, workoutVolume } from './domain.js';

describe('reglas del panel', () => {
  it('traduce y clasifica estados de pacientes', () => {
    expect(statusText('invited')).toBe('Invitado');
    expect(statusClass('archived')).toBe('expired');
  });

  it('crea iniciales estables', () => {
    expect(initials('Carlos Iván Serna Salazar')).toBe('CI');
    expect(initials('')).toBe('FC');
  });

  it('calcula volumen como peso por repeticiones', () => {
    expect(workoutVolume({ fc_set_logs: [{ weight: 40, reps_completed: 10 }, { weight: 45, reps_completed: 8 }] })).toBe(760);
  });

  it('usa la fecha local y no UTC', () => {
    expect(localDate(new Date(2026, 10, 12, 23, 30))).toBe('2026-11-12');
  });

  it('acota números y detecta errores de red', () => {
    expect(clampInt('', 1, 20, 3)).toBe(3);
    expect(clampInt(99, 1, 20, 3)).toBe(20);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError({ message: 'new row violates check constraint', code: '23514' })).toBe(false);
  });

  it('arma el payload de la RPC con valores válidos', () => {
    const payload = buildRoutinePayload({
      client_id: '7', name: ' Fuerza ', session_minutes: 60,
      days: [{ day: 1, exercises: [{ name: 'Sentadilla', target: 'cuádriceps', sets: 0, reps_min: 12, reps_max: 5, instruction_steps: { es: ['a'] } }] }],
    });
    expect(payload.p_client_id).toBe(7);
    expect(payload.p_name).toBe('Fuerza');
    const ex = payload.p_days[0].exercises[0];
    expect([ex.sets, ex.reps_min, ex.reps_max, ex.rest_seconds]).toEqual([1, 12, 12, 90]);
    expect(ex.instructions).toEqual(['a']);
  });

  it('clasifica ejercicios y traduce etiquetas', () => {
    expect(exerciseKind({ target: 'quads', secondary_muscles: ['glutes', 'calves'] })).toBe('compound');
    expect(exerciseKind({ target: 'biceps', secondary_muscles: ['forearms'] })).toBe('isolation');
    expect(exerciseKind({ target: 'cardiovascular system', secondary_muscles: [] })).toBe('cardio');
    expect(muscleInfo('lats').es).toBe('Dorsales');
    expect(muscleInfo('algo nuevo').abbr).toBe('ALG');
    expect(equipmentLabel('body weight')).toBe('Peso corporal');
  });
});

describe('módulo pacientes', () => {
  it('valida el formulario', () => {
    expect(validateClient({ full_name: 'A' })).toMatch(/nombre/);
    expect(validateClient({ full_name: 'Ana Pérez', email: 'x' })).toMatch(/correo/);
    expect(validateClient({ full_name: 'Ana Pérez', height_cm: '20' })).toMatch(/estatura/);
    expect(validateClient({ full_name: 'Ana Pérez', birth_date: '2999-01-01' }, '2026-11-13')).toMatch(/futura/);
    expect(validateClient({ full_name: 'Ana Pérez', email: 'a@b.co', phone: '5512345678', height_cm: '170', birth_date: '1990-05-01' })).toBe('');
  });
  it('traduce errores de base de datos', () => {
    expect(friendlyDbError({ code: '23505' })).toMatch(/correo/);
    expect(friendlyDbError({ code: '42501' })).toMatch(/permiso/);
    expect(friendlyDbError({ code: 'XX' })).toBe('');
  });
  it('filtra por estado e invitación pendiente', () => {
    const pending = { status: 'active', email: 'a@b.co', user_id: null };
    const linked = { status: 'active', email: 'a@b.co', user_id: 'u' };
    const gone = { status: 'archived', email: 'a@b.co', user_id: null };
    expect(isInvitePending(pending)).toBe(true);
    expect(isInvitePending(linked)).toBe(false);
    expect(isInvitePending(gone)).toBe(false);
    expect(matchesClientFilter(gone, 'all')).toBe(false);
    expect(matchesClientFilter(gone, 'archived')).toBe(true);
    expect(matchesClientFilter(pending, 'invited')).toBe(true);
  });
});

describe('perfil de usuario', () => {
  it('obtiene el primer nombre', () => {
    expect(firstName('Ana María López')).toBe('Ana');
    expect(firstName('', 'carlos@astreo.mx')).toBe('carlos');
    expect(firstName('x@y.com', 'x@y.com')).toBe('x');
  });
  it('valida contraseña', () => {
    expect(validatePasswordChange('corta', 'corta')).toMatch(/8/);
    expect(validatePasswordChange('Larga-2026!', 'otra-cosa')).toMatch(/coinciden/);
    expect(validatePasswordChange('Larga-2026!', 'Larga-2026!')).toBe('');
  });
  it('valida la foto', () => {
    expect(validateAvatarFile(null)).toMatch(/Selecciona/);
    expect(validateAvatarFile({ type: 'image/gif', size: 10 })).toMatch(/JPG/);
    expect(validateAvatarFile({ type: 'image/png', size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(validateAvatarFile({ type: 'image/png', size: 1000 })).toBe('');
  });
});

it('saluda con el nombre completo', () => {
  expect(greetingName('Dra. Marisol Vega', 'm@x.mx')).toBe('Dra. Marisol Vega');
  expect(greetingName('', 'carlos@astreo.mx')).toBe('carlos');
});

describe('biblioteca de ejercicios', () => {
  it('usa el nombre en español y busca en ambos idiomas', () => {
    const x = { name: 'barbell bench press', name_es: 'Press de banca con barra', target: 'pectorals', equipment: 'barbell' };
    expect(exerciseName(x)).toBe('Press de banca con barra');
    expect(exerciseName({ name: 'plank' })).toBe('plank');
    expect(exerciseSearchText(x)).toContain('bench');
    expect(exerciseSearchText(x)).toContain('banca');
    expect(exerciseSearchText(x)).toContain('pectorales');
    expect(secondaryLabel('hip flexors')).toBe('Flexores de cadera');
  });
});

describe('fechas y decimales', () => {
  it('muestra la fecha de nacimiento sin corrimiento de día', () => {
    expect(formatDate('2006-09-14')).toBe(new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(2006, 8, 14)));
    expect(formatDate('')).toBe('—');
    expect(formatDate('no-fecha')).toBe('—');
  });
  it('convierte decimales con coma o punto', () => {
    expect(parseDecimal('1,75')).toBe(1.75);
    expect(parseDecimal('186')).toBe(186);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
  it('valida estatura con coma', () => {
    expect(validateClient({ full_name: 'Ana Pérez', height_cm: '175,5' })).toBe('');
    expect(validateClient({ full_name: 'Ana Pérez', height_cm: '20' })).toMatch(/estatura/);
  });
});
