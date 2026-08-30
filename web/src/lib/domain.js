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
