import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

export type Unit = "kg" | "lb";
export type SetLog = { reps: string; weight: string; unit: Unit; done: boolean };
type Store = {
  logs: Record<string, SetLog>;
  extraSets: Record<number, number>;
  startedAt: Date | null;
  getSet: (exId: number, n: number, defaults?: Partial<SetLog>) => SetLog;
  patch: (exId: number, n: number, p: Partial<SetLog>) => void;
  addSet: (exId: number) => void;
  setCount: (exId: number, base: number) => number;
  doneCount: (exId: number, base: number) => number;
  reset: () => void;
};

const Ctx = createContext<Store | null>(null);
const key = (e: number, n: number) => `${e}-${n}`;

/** Estado en memoria del entrenamiento en curso (se comparte entre la lista y el detalle de cada ejercicio). */
export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<Record<string, SetLog>>({});
  const [extraSets, setExtra] = useState<Record<number, number>>({});
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const started = useRef(false);

  const getSet = useCallback((e: number, n: number, d: Partial<SetLog> = {}): SetLog =>
    logs[key(e, n)] ?? { reps: "", weight: "", unit: "kg", done: false, ...d }, [logs]);
  const patch = useCallback((e: number, n: number, p: Partial<SetLog>) => {
    if (!started.current) { started.current = true; setStartedAt(new Date()); }
    setLogs((c) => {
      const base: SetLog = c[key(e, n)] ?? { reps: "", weight: "", unit: "kg", done: false };
      return { ...c, [key(e, n)]: { ...base, ...p } };
    });
  }, []);
  const addSet = useCallback((e: number) => setExtra((c) => ({ ...c, [e]: Math.min((c[e] ?? 0) + 1, 10) })), []);
  const setCount = useCallback((e: number, base: number) => Math.min(30, base + (extraSets[e] ?? 0)), [extraSets]);
  const doneCount = useCallback((e: number, base: number) => Array.from({ length: setCount(e, base) }, (_, i) => logs[key(e, i + 1)]?.done).filter(Boolean).length, [logs, setCount]);
  const reset = useCallback(() => { setLogs({}); setExtra({}); setStartedAt(null); started.current = false; }, []);

  const value = useMemo(() => ({ logs, extraSets, startedAt, getSet, patch, addSet, setCount, doneCount, reset }), [logs, extraSets, startedAt, getSet, patch, addSet, setCount, doneCount, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkout() {
  const v = useContext(Ctx);
  if (!v) throw new Error("WorkoutProvider ausente");
  return v;
}
