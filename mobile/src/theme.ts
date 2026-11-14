// Tokens visuales tomados del PDF de diseño (grises suaves, botón negro, tarjetas redondeadas).
export const colors = {
  bg: "#ffffff",
  surface: "#f1f1f3",
  surfaceStrong: "#e4e4e8",
  header: "#c4c4c8",
  ink: "#111113",
  muted: "#6f7178",
  faint: "#a3a5ab",
  line: "#e2e3e7",
  accent: "#111113",
  success: "#1f9d55",
  danger: "#c9364f",
};
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
export const font = { mono: "Menlo" as const };

const MUSCLES: Record<string, string> = {
  abs: "Abdomen", pectorals: "Pecho", biceps: "Bíceps", glutes: "Glúteos", delts: "Hombros",
  triceps: "Tríceps", "upper back": "Espalda", lats: "Dorsales", calves: "Pantorrillas", quads: "Cuádriceps",
  forearms: "Antebrazos", "cardiovascular system": "Cardio", hamstrings: "Isquiotibiales", spine: "Espalda baja",
  traps: "Trapecio", adductors: "Aductores", abductors: "Abductores", "serratus anterior": "Serrato",
  "levator scapulae": "Cuello",
};
export const muscleLabel = (m?: string | null) => (m ? MUSCLES[m.toLowerCase()] ?? m : "");
export const DAY_SHORT = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export const DAY_LONG = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
/** 1=lunes … 7=domingo */
export const isoDay = (d: Date) => ((d.getDay() + 6) % 7) + 1;
export const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
