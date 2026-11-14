import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Empty, Screen, TitleBar } from "@/components/ui";
import { findRoutineEx, loadMe } from "@/lib/data";
import { Unit, useWorkout } from "@/lib/workoutStore";
import { colors, radius } from "@/theme";

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

export default function ExerciseSets() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const w = useWorkout();
  const ex = findRoutineEx(Number(id));
  const [rest, setRest] = useState(ex?.rest_seconds ?? 90);
  const [left, setLeft] = useState<number | null>(null);
  const [defaultUnit, setDefaultUnit] = useState<Unit>("kg");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { void loadMe().then((m) => m && setDefaultUnit(m.units)); return () => { if (timer.current) clearInterval(timer.current); }; }, []);

  if (!ex) return <Screen><TitleBar title="Ejercicio" /><Empty title="Ejercicio no disponible" text="Vuelve a la rutina y ábrelo de nuevo." /></Screen>;

  const total = w.setCount(ex.id, ex.sets);
  const defReps = String(ex.reps_max ?? ex.reps_min ?? "");

  function startRest(sec = rest) {
    if (timer.current) clearInterval(timer.current);
    setLeft(sec);
    timer.current = setInterval(() => setLeft((v) => { if (v === null || v <= 1) { if (timer.current) clearInterval(timer.current); return null; } return v - 1; }), 1000);
  }

  return <Screen>
    <TitleBar title={ex.name} subtitle={`${total} series`} />
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Pressable style={s.media} onPress={() => router.push({ pathname: "/exercise-info", params: { id: String(ex.id) } })}>
        {ex.image_url ? <Image source={{ uri: ex.image_url }} style={s.img} resizeMode="contain" /> : <View style={s.img} />}
        <Text style={s.mediaCap}>Toca para reproducir demostración</Text>
      </Pressable>

      <View style={s.timer}>
        <View style={s.timerRow}>
          <Pressable hitSlop={12} onPress={() => setRest((r) => Math.max(0, r - 15))}><Text style={s.pm}>−</Text></Pressable>
          <Text style={s.time}>{fmt(left ?? rest)}</Text>
          <Pressable hitSlop={12} onPress={() => setRest((r) => Math.min(1800, r + 15))}><Text style={s.pm}>+</Text></Pressable>
        </View>
        <Pressable hitSlop={12} onPress={() => (left === null ? startRest() : (timer.current && clearInterval(timer.current), setLeft(null)))}><Text style={s.play}>{left === null ? "▷" : "■"}</Text></Pressable>
      </View>

      <View style={s.head}>{["SERIE", "TIEMPO", "REPS", "PESO", "", ""].map((h, i) => <Text key={i} style={[s.th, i === 3 && { flex: 1.1 }]}>{h}</Text>)}</View>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
        const l = w.getSet(ex.id, n, { reps: defReps, unit: defaultUnit });
        return <View key={n} style={s.row}>
          <View style={s.num}><Text style={s.numText}>{n}</Text></View>
          <Text style={s.cell}>–</Text>
          <TextInput style={s.field} keyboardType="number-pad" value={l.reps} onChangeText={(v) => w.patch(ex.id, n, { reps: v.replace(/\D/g, "").slice(0, 3), unit: l.unit })} placeholder="0" placeholderTextColor={colors.faint} />
          <TextInput style={[s.field, { flex: 1.1 }]} keyboardType="decimal-pad" value={l.weight} onChangeText={(v) => w.patch(ex.id, n, { weight: v.replace(/[^0-9.,]/g, "").slice(0, 6), unit: l.unit })} placeholder="0" placeholderTextColor={colors.faint} />
          <View style={s.unit}>{(["kg", "lb"] as Unit[]).map((u) => <Pressable key={u} onPress={() => w.patch(ex.id, n, { unit: u, reps: l.reps || defReps })} style={[s.unitBtn, l.unit === u && s.unitOn]}><Text style={[s.unitText, l.unit === u && { color: "#fff" }]}>{u.toUpperCase()}</Text></Pressable>)}</View>
          <Pressable hitSlop={8} accessibilityLabel={`Serie ${n} completada`} onPress={() => { const done = !l.done; w.patch(ex.id, n, { done, reps: l.reps || defReps, unit: l.unit }); if (done) startRest(); }} style={[s.check, l.done && { backgroundColor: colors.success }]}><Text style={{ color: l.done ? "#fff" : colors.faint, fontWeight: "800" }}>✓</Text></Pressable>
        </View>;
      })}
      <Pressable style={s.add} onPress={() => w.addSet(ex.id)}><Text style={s.addText}>＋ Agregar Serie</Text></Pressable>
    </ScrollView>
  </Screen>;
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 14, paddingBottom: 50 },
  media: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 10, alignItems: "center", gap: 8 },
  img: { width: "100%", height: 150, borderRadius: radius.md, backgroundColor: colors.surfaceStrong }, mediaCap: { fontSize: 12, color: colors.ink },
  timer: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", gap: 4 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 28 }, pm: { fontSize: 34, color: colors.ink }, time: { fontSize: 52, fontWeight: "300", color: colors.ink, minWidth: 130, textAlign: "center" }, play: { fontSize: 26, color: colors.ink },
  head: { flexDirection: "row", gap: 6, paddingHorizontal: 4, marginTop: 6 }, th: { flex: 1, fontSize: 9, color: colors.muted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  num: { flex: 1, alignItems: "center" }, numText: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceStrong, textAlign: "center", lineHeight: 28, fontSize: 13, fontWeight: "700", overflow: "hidden" },
  cell: { flex: 1, textAlign: "center", color: colors.muted },
  field: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, textAlign: "center", paddingVertical: 8, fontSize: 14, color: colors.ink },
  unit: { flex: 1.4, flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.sm, padding: 2 },
  unitBtn: { flex: 1, paddingVertical: 6, alignItems: "center", borderRadius: 8 }, unitOn: { backgroundColor: colors.ink }, unitText: { fontSize: 10, fontWeight: "700", color: colors.muted },
  check: { flex: 0.8, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  add: { alignSelf: "center", backgroundColor: colors.surfaceStrong, borderRadius: radius.sm, paddingHorizontal: 22, paddingVertical: 12, marginTop: 8 }, addText: { fontSize: 14, fontWeight: "600", color: colors.ink },
});
