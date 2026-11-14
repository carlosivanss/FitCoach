import { supabase } from "@/lib/supabase";
import { EXERCISE_NAMES_ES } from "@/data/exerciseNamesEs";

export type CatalogEx = { id: number; name: string; muscle_group: string; group: string; type: string; image_url: string | null; equipment: string | null };

export const GROUPS = ["Pecho", "Espalda", "Piernas", "Hombros", "Brazos", "Core"] as const;
export type Group = (typeof GROUPS)[number];

const TO_GROUP: Record<string, Group> = {
  pectorals: "Pecho", pecho: "Pecho",
  lats: "Espalda", "upper back": "Espalda", traps: "Espalda", spine: "Espalda", "levator scapulae": "Espalda", "serratus anterior": "Espalda",
  quads: "Piernas", hamstrings: "Piernas", glutes: "Piernas", calves: "Piernas", adductors: "Piernas", abductors: "Piernas", cuádriceps: "Piernas", isquiotibiales: "Piernas",
  delts: "Hombros", biceps: "Brazos", triceps: "Brazos", forearms: "Brazos", abs: "Core",
};
export const groupOf = (m: string): Group | null => TO_GROUP[m.toLowerCase()] ?? null;

/** Músculos específicos por grupo (valor del catálogo → etiqueta). */
export const SPECIFIC: Record<Group, { v: string[]; label: string }[]> = {
  Pecho: [{ v: ["pectorals", "Pecho"], label: "Pectorales" }, { v: ["serratus anterior"], label: "Serrato" }],
  Espalda: [{ v: ["lats"], label: "Dorsales" }, { v: ["upper back"], label: "Espalda alta" }, { v: ["traps"], label: "Trapecio" }, { v: ["spine"], label: "Espalda baja" }],
  Piernas: [{ v: ["quads", "Cuádriceps"], label: "Cuádriceps" }, { v: ["glutes"], label: "Glúteos" }, { v: ["hamstrings", "Isquiotibiales"], label: "Isquios" }, { v: ["calves"], label: "Gemelos" }, { v: ["adductors", "abductors"], label: "Aductores" }],
  Hombros: [{ v: ["delts"], label: "Deltoides" }],
  Brazos: [{ v: ["biceps"], label: "Bíceps" }, { v: ["triceps"], label: "Tríceps" }, { v: ["forearms"], label: "Antebrazos" }],
  Core: [{ v: ["abs"], label: "Abdomen" }],
};

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const exName = (name: string, catalogId: string | null) => (catalogId && EXERCISE_NAMES_ES[catalogId]) || name;

let cache: CatalogEx[] | null = null;
/** Catálogo completo (≈1.3k filas, se baja una sola vez y se filtra en el dispositivo con nombres en español). */
export async function loadCatalog(): Promise<CatalogEx[]> {
  if (cache) return cache;
  const { data, error } = await supabase.from("fc_exercises").select("id, name, catalog_id, muscle_group, exercise_type, image_url, equipment").eq("is_active", true).order("id").limit(2000);
  if (error) throw error;
  cache = (data ?? []).map((e) => ({ id: e.id, name: exName(e.name, e.catalog_id), muscle_group: e.muscle_group, group: groupOf(e.muscle_group) ?? "Core", type: e.exercise_type, image_url: e.image_url, equipment: e.equipment }));
  return cache;
}

export type Filters = { q: string; group: Group | null; type: "compound" | "isolation" | null; muscle: string | null };
export const EMPTY_FILTERS: Filters = { q: "", group: null, type: null, muscle: null };

export function applyFilters(all: CatalogEx[], f: Filters, excluded: Set<number>): CatalogEx[] {
  const q = norm(f.q.trim());
  const spec = f.group && f.muscle ? SPECIFIC[f.group].find((s) => s.label === f.muscle)?.v.map((x) => x.toLowerCase()) : null;
  return all.filter((e) => !excluded.has(e.id)
    && (!f.group || e.group === f.group)
    && (!f.type || e.type === f.type)
    && (!spec || spec.includes(e.muscle_group.toLowerCase()))
    && (!q || norm(e.name).includes(q) || norm(e.group).includes(q)));
}

export async function loadExcluded(userId: string): Promise<Set<number>> {
  const { data } = await supabase.from("fc_excluded_exercises").select("exercise_id").eq("user_id", userId);
  return new Set((data ?? []).map((x) => x.exercise_id as number));
}
