import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { EMPTY_FILTERS, Filters } from "@/lib/catalog";

export type DraftEx = { exercise_id: number; name: string; muscle: string; sets: number; reps: number; rest_seconds: number };
type Draft = {
  name: string; goal: string; days: number; minutes: 30 | 45 | 60 | 90; items: DraftEx[];
  set: (p: Partial<Pick<Draft, "name" | "goal" | "days" | "minutes">>) => void;
  addItem: (e: DraftEx) => void; removeItem: (id: number) => void; clear: () => void;
  filters: Filters; setFilters: (f: Filters) => void;
};
const Ctx = createContext<Draft | null>(null);

/** Borrador de "Crea tu rutina" + filtros del selector de ejercicios (solo en memoria). */
export function DraftProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState(""); const [goal, setGoal] = useState("Fuerza"); const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState<30 | 45 | 60 | 90>(60);
  const [items, setItems] = useState<DraftEx[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const value = useMemo<Draft>(() => ({
    name, goal, days, minutes, items, filters, setFilters,
    set: (p) => { if (p.name !== undefined) setName(p.name); if (p.goal !== undefined) setGoal(p.goal); if (p.days !== undefined) setDays(p.days); if (p.minutes !== undefined) setMinutes(p.minutes); },
    addItem: (e) => setItems((c) => [...c.filter((x) => x.exercise_id !== e.exercise_id), e]),
    removeItem: (id) => setItems((c) => c.filter((x) => x.exercise_id !== id)),
    clear: () => { setName(""); setGoal("Fuerza"); setDays(3); setMinutes(60); setItems([]); setFilters(EMPTY_FILTERS); },
  }), [name, goal, days, minutes, items, filters]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useDraft() { const v = useContext(Ctx); if (!v) throw new Error("DraftProvider ausente"); return v; }
