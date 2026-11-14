import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { BackHeader, Button, Screen } from "@/components/ui";
import { useDraft } from "@/lib/draftStore";
import { supabase } from "@/lib/supabase";
import { DAY_LONG, DAY_SHORT, colors, isoDay, radius } from "@/theme";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** "Organiza tu semana" (PDF): se eligen fechas en el calendario; de ellas se toman los días de la semana de la rutina. */
export default function OrganizeWeek() {
  const d = useDraft();
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const first = isoDay(cursor) - 1;
  const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const key = (day: number) => `${cursor.getFullYear()}-${cursor.getMonth()}-${day}`;
  const weekdays = [...new Set([...picked].map((k) => { const [y, m, dd] = k.split("-").map(Number); return isoDay(new Date(y, m, dd)); }))].sort((a, b) => a - b);

  async function save() {
    if (!weekdays.length) return;
    const per = Math.ceil(d.items.length / weekdays.length);
    const days = weekdays.map((day, i) => ({ day, exercises: d.items.slice(i * per, (i + 1) * per).map((e) => ({ exercise_id: e.exercise_id, sets: e.sets, reps: e.reps, rest_seconds: e.rest_seconds })) })).filter((x) => x.exercises.length);
    setBusy(true);
    const { error } = await supabase.rpc("fc_create_my_routine", { p_name: d.name.trim(), p_goal: d.goal, p_session_minutes: d.minutes, p_days: days });
    setBusy(false);
    if (error) return Alert.alert("No se pudo guardar la rutina", error.message);
    d.clear();
    Alert.alert("¡Rutina creada!", "Ya aparece en tu inicio. Tu rutina anterior quedó archivada.", [{ text: "Ver inicio", onPress: () => router.dismissAll() }]);
  }

  return <Screen>
    <BackHeader title="Organiza tu semana" subtitle="Selecciona los días en los que quieres entrenar." />
    <ScrollView contentContainerStyle={{ padding: 22, gap: 20 }}>
      <View style={s.cal}>
        <View style={s.calHead}>
          <Text style={s.month}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</Text>
          <View style={{ flexDirection: "row", gap: 18 }}>
            <Pressable hitSlop={10} onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><Text style={s.nav}>‹</Text></Pressable>
            <Pressable hitSlop={10} onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><Text style={s.nav}>›</Text></Pressable>
          </View>
        </View>
        <View style={s.grid}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <Text key={n} style={s.dow}>{DAY_SHORT[n].toUpperCase()}</Text>)}
          {cells.map((c, i) => c === null ? <View key={i} style={s.cell} /> : <Pressable key={i} style={s.cell} onPress={() => setPicked((p) => { const n = new Set(p); n.has(key(c)) ? n.delete(key(c)) : n.add(key(c)); return n; })}>
            <View style={[s.dot, picked.has(key(c)) && { backgroundColor: colors.ink }]}><Text style={[s.dotText, picked.has(key(c)) && { color: "#fff" }]}>{c}</Text></View></Pressable>)}
        </View>
        <Text style={s.count}>{weekdays.length} {weekdays.length === 1 ? "día seleccionado" : "días seleccionados"}{weekdays.length ? ` · ${weekdays.map((w) => DAY_LONG[w].slice(0, 3)).join(", ")}` : ""}</Text>
      </View>
      <Text style={s.note}>Repartiremos tus {d.items.length} ejercicios entre esos días de la semana, de forma pareja.</Text>
    </ScrollView>
    <View style={{ padding: 22 }}><Button label="Guardar rutina" disabled={!weekdays.length} busy={busy} onPress={save} /></View>
  </Screen>;
}
const s = StyleSheet.create({
  cal: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12 },
  calHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, month: { fontSize: 16, fontWeight: "700", color: colors.ink }, nav: { fontSize: 26, color: colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap" }, dow: { width: "14.28%", textAlign: "center", fontSize: 9, color: colors.muted, marginBottom: 6 },
  cell: { width: "14.28%", height: 42, alignItems: "center", justifyContent: "center" }, dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, dotText: { fontSize: 13, color: colors.ink },
  count: { fontSize: 12, color: colors.muted }, note: { fontSize: 12, color: colors.muted, lineHeight: 18 },
});
