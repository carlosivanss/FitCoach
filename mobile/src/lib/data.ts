import { supabase } from "@/lib/supabase";
import { exName } from "@/lib/catalog";

export type Me = { userId: string; clientId: number | null; name: string; units: "kg" | "lb" };

/** Perfil del paciente actual o null si no hay sesión / no es paciente. */
export async function loadMe(): Promise<Me | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: client }] = await Promise.all([
    supabase.from("fc_profiles").select("full_name, role, preferred_units").eq("user_id", user.id).single(),
    supabase.from("fc_clients").select("id, full_name").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profile?.role !== "patient") return null;
  return { userId: user.id, clientId: client?.id ?? null, name: profile?.full_name || client?.full_name || "Paciente", units: profile?.preferred_units === "lb" ? "lb" : "kg" };
}

export type RoutineEx = {
  id: number; exercise_id: number; day_of_week: number; order_index: number; sets: number;
  reps_min: number | null; reps_max: number | null; rest_seconds: number;
  name: string; muscle_group: string; image_url: string | null; gif_url: string | null; instructions: string[]; coaching_tip: string | null;
};
export type ActiveRoutine = { id: number; name: string; days_per_week: number; session_minutes: number; days: Record<number, RoutineEx[]> };

type Raw = Omit<RoutineEx, "name" | "muscle_group" | "image_url" | "gif_url" | "instructions" | "coaching_tip"> & { fc_exercises: { name: string; catalog_id: string | null; muscle_group: string; image_url: string | null; gif_url: string | null; instructions: string[] | null; coaching_tip: string | null } | { name: string; catalog_id: string | null; muscle_group: string; image_url: string | null; gif_url: string | null; instructions: string[] | null; coaching_tip: string | null }[] };

/** Rutina activa más reciente con sus ejercicios agrupados por día (1=lunes). */
export async function loadActiveRoutine(clientId: number): Promise<ActiveRoutine | null> {
  const { data: r } = await supabase.from("fc_routines").select("id, name, days_per_week, session_minutes").eq("client_id", clientId).is("archived_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!r) return null;
  const { data: rows } = await supabase.from("fc_routine_exercises")
    .select("id, exercise_id, day_of_week, order_index, sets, reps_min, reps_max, rest_seconds, fc_exercises(name, catalog_id, muscle_group, image_url, gif_url, instructions, coaching_tip)")
    .eq("routine_id", r.id).order("day_of_week").order("order_index");
  const days: Record<number, RoutineEx[]> = {};
  ((rows ?? []) as unknown as Raw[]).forEach((x) => {
    const e = Array.isArray(x.fc_exercises) ? x.fc_exercises[0] : x.fc_exercises;
    (days[x.day_of_week] ??= []).push({ ...x, name: e ? exName(e.name, e.catalog_id) : "Ejercicio", muscle_group: e?.muscle_group ?? "", image_url: e?.image_url ?? null, gif_url: e?.gif_url ?? null, instructions: e?.instructions ?? [], coaching_tip: e?.coaching_tip ?? null });
  });
  return { id: r.id, name: r.name, days_per_week: r.days_per_week, session_minutes: r.session_minutes, days };
}

/** Rutina mostrada actualmente; evita reconsultar al abrir el detalle de un ejercicio. */
let current: ActiveRoutine | null = null;
export const setCurrentRoutine = (r: ActiveRoutine | null) => { current = r; };
export const getCurrentRoutine = () => current;
export const findRoutineEx = (id: number): RoutineEx | undefined =>
  current ? Object.values(current.days).flat().find((x) => x.id === id) : undefined;

export const setsLabel = (e: RoutineEx) => {
  const reps = e.reps_max ?? e.reps_min;
  return `${e.sets} series${reps ? ` ${reps} reps` : ""}`;
};

/** Igual que findRoutineEx pero recarga la rutina si la app perdió el caché (p. ej. al restaurar el proceso). */
export async function ensureRoutineEx(id: number): Promise<RoutineEx | undefined> {
  const hit = findRoutineEx(id);
  if (hit) return hit;
  const me = await loadMe();
  if (!me?.clientId) return undefined;
  current = await loadActiveRoutine(me.clientId);
  return findRoutineEx(id);
}
