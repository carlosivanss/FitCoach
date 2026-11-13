import { describe, expect, it } from 'vitest';
import { buildRoutinePayload, clampInt, initials, isNetworkError, localDate, statusClass, statusText, workoutVolume } from './domain.js';

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
});
