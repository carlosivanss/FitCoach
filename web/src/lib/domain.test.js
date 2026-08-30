import { describe, expect, it } from 'vitest';
import { initials, statusClass, statusText, workoutVolume } from './domain.js';

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
});
