import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Button, Empty, Screen, TitleBar } from "@/components/ui";
import { ExerciseMenu } from "@/components/ExerciseMenu";
import { ActiveRoutine, Me, RoutineEx, loadActiveRoutine, loadMe, setCurrentRoutine, setsLabel } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useWorkout } from "@/lib/workoutStore";
import { colors, isoDay, muscleLabel, radius } from "@/theme";

export default function Workout() {
  const { day } = useLocalSearchParams<{ day?: string }>();
  const w = useWorkout();
  const [me, setMe] = useState<Me | null>(null);
  const [routine, setRoutine] = useState<ActiveRoutine | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuFor, setMenuFor] = useState<RoutineEx | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const m = await loadMe();
      if (!m) return router.replace("/login");
      const r = m.clientId ? await loadActiveRoutine(m.clientId) : null;
      if (!alive) return;
      setMe(m); setRoutine(r); setCurrentRoutine(r); setLoading(false);
    })();
    return () => { alive = false; };
  }, []));

  if (loading) return <Screen style={s.center}><ActivityIndicator size="large" color={colors.ink} /></Screen>;
  const dow = Number(day) || isoDay(new Date());
  const items = routine?.days[dow] ?? [];
  if (!routine || !items.length) return <Screen><TitleBar title="Entrenamiento" /><Empty title="Sin ejercicios para este día" text="Tu rutina no tiene ejercicios en este día." /></Screen>;

  const doneEx = (e: RoutineEx) => w.doneCount(e.id, e.sets) >= w.setCount(e.id, e.sets);
  const allDone = items.every(doneEx);

  async function finish() {
    const rows: { routine_exercise_id: number; set_number: number; reps_completed: number; weight: number | null; weight_unit: string }[] = [];
    for (const e of items) for (let n = 1; n <= w.setCount(e.id, e.sets); n++) {
      const l = w.getSet(e.id, n, { reps: String(e.reps_max ?? e.reps_min ?? "") });
      if (!l.done) continue;
      const reps = Number(l.reps), kg = l.weight.trim() === "" ? null : Number(l.weight.replace(",", "."));
      if (!Number.isInteger(reps) || reps < 0 || reps > 500 || (kg !== null && (!Number.isFinite(kg) || kg < 0))) return Alert.alert("Revisa las series", `Hay valores inválidos en ${e.name}.`);
      rows.push({ routine_exercise_id: e.id, set_number: n, reps_completed: reps, weight: kg, weight_unit: l.unit });
    }
    if (!rows.length) return Alert.alert("Falta completar series", "Marca al menos una serie con ✓ antes de finalizar.");
    setSaving(true);
    const now = new Date();
    const { error } = await supabase.rpc("fc_complete_my_workout", { p_routine_id: routine!.id, p_day_of_week: dow, p_started_at: (w.startedAt ?? now).toISOString(), p_completed_at: now.toISOString(), p_sets: rows });
    setSaving(false);
    if (error) return Alert.alert("No se guardó el entrenamiento", error.message);
    w.reset();
    Alert.alert("¡Entrenamiento completado!", "Tus pesos y repeticiones ya cuentan para tu progreso.", [{ text: "Ver inicio", onPress: () => router.replace("/") }]);
  }

  return <Screen>
    <TitleBar title={routine.name} subtitle={`${routine.session_minutes} mins - ${items.length} ejercicios`} />
    <ScrollView contentContainerStyle={s.list}>
      <Text style={s.kicker}>Ejercicios de hoy</Text>
      {items.map((e) => {
        const complete = doneEx(e);
        return <Pressable key={e.id} style={s.card} onPress={() => router.push({ pathname: "/exercise/[id]", params: { id: String(e.id) } })}>
          <View style={s.thumb}><Text style={s.thumbText}>{e.name.slice(0, 1)}</Text></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.status, complete && { color: colors.success }]}>{complete ? "Completado" : "Pendiente"}</Text>
            <Text style={[s.name, complete && { color: colors.faint }]} numberOfLines={2}>{e.name}</Text>
            <Text style={s.meta}>{setsLabel(e)}</Text>
            <Text style={s.meta}>{muscleLabel(e.muscle_group)}</Text>
          </View>
          <Pressable hitSlop={12} accessibilityLabel="Opciones del ejercicio" onPress={() => setMenuFor(e)}><Text style={s.dots}>⋮</Text></Pressable>
        </Pressable>;
      })}
      <View style={{ marginTop: 10 }}><Button label="Finalizar rutina" tone={allDone ? "dark" : "soft"} busy={saving} onPress={finish} /></View>
    </ScrollView>
    {me ? <ExerciseMenu ex={menuFor} userId={me.userId} onClose={() => setMenuFor(null)}
      onReplace={(ex, remember) => router.push({ pathname: "/exercise-picker", params: { mode: "replace", reId: String(ex.id), remember: remember ? "1" : "0" } } as never)} /> : null}
  </Screen>;
}

const s = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 14, paddingBottom: 40 },
  kicker: { fontSize: 13, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, flexDirection: "row", gap: 14, alignItems: "center" },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceStrong, alignItems: "center", justifyContent: "center" },
  thumbText: { fontSize: 26, fontWeight: "800", color: colors.faint },
  status: { fontSize: 11, color: colors.muted }, name: { fontSize: 17, fontWeight: "700", color: colors.ink }, meta: { fontSize: 12, color: colors.muted },
  dots: { fontSize: 22, color: colors.ink, paddingHorizontal: 6 },
});
