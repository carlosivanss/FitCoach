import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { BackHeader, Button, Label, Screen } from "@/components/ui";
import { CatalogEx, loadCatalog } from "@/lib/catalog";
import { useDraft } from "@/lib/draftStore";
import { colors, radius } from "@/theme";

function Stepper({ label, value, set, min, max, step = 1, unit = "" }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step?: number; unit?: string }) {
  return <View><Label>{label}</Label>
    <View style={s.stepper}>
      <Pressable hitSlop={12} onPress={() => set(Math.max(min, value - step))}><Text style={s.pm}>−</Text></Pressable>
      <Text style={s.val}>{value}{unit}</Text>
      <Pressable hitSlop={12} onPress={() => set(Math.min(max, value + step))}><Text style={s.pm}>＋</Text></Pressable>
    </View></View>;
}

/** Configura series, repeticiones y descanso antes de guardar el ejercicio en el borrador (PDF: Sentadilla con barra). */
export default function ExerciseConfig() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useDraft();
  const [ex, setEx] = useState<CatalogEx | undefined>();
  const prev = d.items.find((i) => i.exercise_id === Number(id));
  const [sets, setSets] = useState(prev?.sets ?? 4); const [reps, setReps] = useState(prev?.reps ?? 12); const [rest, setRest] = useState(prev?.rest_seconds ?? 90);
  useEffect(() => { void loadCatalog().then((c) => setEx(c.find((e) => e.id === Number(id)))); }, [id]);
  return <Screen>
    <BackHeader title={ex?.name ?? "Ejercicio"} subtitle={ex ? `${ex.group.toUpperCase()}${ex.type === "isolation" ? " · AISLADO" : " · COMPUESTO"}` : undefined} />
    <ScrollView contentContainerStyle={{ padding: 22, gap: 22 }}>
      <Stepper label="Series" value={sets} set={setSets} min={1} max={10} />
      <Stepper label="Repeticiones" value={reps} set={setReps} min={1} max={50} />
      <Stepper label="Descanso entre series" value={rest} set={setRest} min={15} max={300} step={15} unit=" segundos" />
    </ScrollView>
    <View style={{ padding: 22 }}><Button label={prev ? "Actualizar ejercicio" : "Guardar ejercicio"} disabled={!ex} onPress={() => { if (!ex) return; d.addItem({ exercise_id: ex.id, name: ex.name, muscle: ex.group, sets, reps, rest_seconds: rest }); router.back(); }} /></View>
  </Screen>;
}
const s = StyleSheet.create({ stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 22, paddingVertical: 16 }, pm: { fontSize: 26, color: colors.ink }, val: { fontSize: 20, fontWeight: "600", color: colors.ink } });
