import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, Input, Label, Screen } from "@/components/ui";
import { ActiveRoutine, Me, loadActiveRoutine, loadMe } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { DAY_SHORT, colors, isoDay, radius } from "@/theme";

type M = { id: number; measured_on: string; weight_kg: number | null; body_fat_percent: number | null; muscle_mass_kg: number | null; waist_cm: number | null };
type Key = "weight_kg" | "body_fat_percent" | "muscle_mass_kg" | "waist_cm";

const num = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

export default function Progress() {
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<M[]>([]);
  const [routine, setRoutine] = useState<ActiveRoutine | null>(null);
  const [daySets, setDaySets] = useState<Record<number, number>>({});
  const [sessions, setSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ w: "", fat: "", mus: "", waist: "" });

  const load = useCallback(async () => {
    const m = await loadMe();
    if (!m) return router.replace("/login");
    setMe(m);
    if (m.clientId) {
      const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - (isoDay(monday) - 1));
      const [{ data: ms }, r, { data: ss }, { data: logs }] = await Promise.all([
        supabase.from("fc_body_measurements").select("id, measured_on, weight_kg, body_fat_percent, muscle_mass_kg, waist_cm").eq("client_id", m.clientId).order("measured_on", { ascending: false }).order("id", { ascending: false }).limit(12),
        loadActiveRoutine(m.clientId),
        supabase.from("fc_workout_sessions").select("id, completed_at").eq("client_id", m.clientId).eq("status", "completed").gte("completed_at", monday.toISOString()),
        supabase.from("fc_set_logs").select("completed_at").gte("completed_at", monday.toISOString()),
      ]);
      setItems((ms ?? []) as M[]); setRoutine(r); setSessions(ss?.length ?? 0);
      const per: Record<number, number> = {};
      (logs ?? []).forEach((l) => { const d = isoDay(new Date(l.completed_at as string)); per[d] = (per[d] ?? 0) + 1; });
      setDaySets(per);
    }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    const p = { w: num(f.w), fat: num(f.fat), mus: num(f.mus), waist: num(f.waist) };
    const vals = Object.values(p);
    if (vals.every((v) => v === null)) return Alert.alert("Agrega una medida", "Captura al menos un dato para guardar.");
    if (vals.some((v) => v !== null && !Number.isFinite(v))) return Alert.alert("Revisa los datos", "Utiliza solamente números.");
    if (p.w !== null && (p.w < 10 || p.w > 700)) return Alert.alert("Revisa el peso", "Debe estar entre 10 y 700 kg.");
    if (p.fat !== null && (p.fat < 0 || p.fat > 100)) return Alert.alert("Revisa la grasa corporal", "Debe estar entre 0 y 100%.");
    if (p.mus !== null && (p.mus < 0 || p.mus > 500)) return Alert.alert("Revisa la masa muscular", "Debe estar entre 0 y 500 kg.");
    if (p.waist !== null && (p.waist < 20 || p.waist > 400)) return Alert.alert("Revisa la cintura", "Debe estar entre 20 y 400 cm.");
    setSaving(true);
    const d = new Date(); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const { error } = await supabase.rpc("fc_record_my_body_measurement", { p_measured_on: day, p_weight_kg: p.w, p_body_fat_percent: p.fat, p_muscle_mass_kg: p.mus, p_waist_cm: p.waist, p_notes: null });
    setSaving(false);
    if (error) return Alert.alert("No se guardaron las medidas", error.message);
    setF({ w: "", fat: "", mus: "", waist: "" }); await load();
    Alert.alert("Medición guardada", "Tu progreso ya está actualizado.");
  }

  if (loading) return <Screen style={s.center}><ActivityIndicator size="large" color={colors.ink} /></Screen>;

  const latest = (k: Key) => items.find((i) => i[k] !== null);
  const delta = (k: Key) => { const rows = items.filter((i) => i[k] !== null); return rows.length > 1 ? Number(rows[0][k]) - Number(rows[1][k]) : null; };
  const planned = routine?.days_per_week || Object.keys(routine?.days ?? {}).length || 0;
  const pct = planned ? Math.min(100, Math.round((sessions / planned) * 100)) : 0;
  const weights = items.filter((i) => i.weight_kg !== null).slice(0, 5).reverse();
  const wmin = Math.min(...weights.map((i) => Number(i.weight_kg))), wmax = Math.max(...weights.map((i) => Number(i.weight_kg)));
  const monday = new Date(); monday.setDate(monday.getDate() - (isoDay(monday) - 1));
  const weekNo = Math.ceil((monday.getDate() + 6 - ((monday.getDay() + 6) % 7)) / 7);

  const Metric = ({ label, k, unit, goodDown }: { label: string; k: Key; unit: string; goodDown?: boolean }) => {
    const v = latest(k)?.[k]; const d = delta(k);
    return <View style={s.metric}>
      <Text style={s.mLabel}>{label}</Text>
      <Text style={s.mValue}>{v ?? "—"} {v !== null && v !== undefined ? unit : ""}</Text>
      {d !== null && d !== 0 ? <Text style={[s.mDelta, { color: (d < 0) === !!goodDown ? colors.success : colors.danger }]}>{d < 0 ? "▼" : "▲"} {Math.abs(Math.round(d * 10) / 10)} {unit}</Text> : <Text style={s.mDelta}> </Text>}
    </View>;
  };

  return <Screen>
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <View style={s.avatar}><Text style={{ fontSize: 20, fontWeight: "800" }}>{me?.name.slice(0, 1).toUpperCase()}</Text></View>
        <View><Text style={s.hTitle}>Mi progreso</Text><Text style={s.hSub}>Semana {weekNo}</Text></View>
      </View>

      <View style={s.card}>
        <Text style={s.cap}>Sesiones esta semana</Text>
        <Text style={s.big}>{sessions}/{planned || "—"}</Text>
        <Text style={[s.cap, { color: colors.success }]}>{pct}%</Text>
      </View>

      <View style={s.grid}>
        <Metric label="Peso" k="weight_kg" unit="kg" goodDown />
        <Metric label="Grasa corp." k="body_fat_percent" unit="%" goodDown />
        <Metric label="Masa muscular" k="muscle_mass_kg" unit="kg" />
        <Metric label="Cintura" k="waist_cm" unit="cm" goodDown />
      </View>

      <View style={[s.card, { marginTop: 14 }]}>
        <Text style={s.cap}>Evolución peso (kg)</Text>
        {weights.length ? <View style={s.bars}>{weights.map((w) => {
          const h = wmax === wmin ? 80 : 30 + ((Number(w.weight_kg) - wmin) / (wmax - wmin)) * 70;
          return <View key={w.id} style={{ alignItems: "center", flex: 1, justifyContent: "flex-end" }}><Text style={s.barVal}>{w.weight_kg}</Text><View style={[s.bar, { height: h }]} /><Text style={s.barDate}>{w.measured_on.slice(5)}</Text></View>;
        })}</View> : <Text style={s.empty}>Registra tu peso para ver la gráfica.</Text>}
      </View>

      <View style={[s.card, { marginTop: 14 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={s.cap}>Cumplimiento — Semana {weekNo}</Text><Text style={[s.cap, { color: colors.success }]}>{pct}%</Text></View>
        <View style={s.compRow}>{[1, 2, 3, 4, 5, 6].map((d) => {
          const plan = (routine?.days[d] ?? []).reduce((a, e) => a + e.sets, 0);
          const p = plan ? Math.min(100, Math.round(((daySets[d] ?? 0) / plan) * 100)) : 0;
          return <View key={d} style={{ alignItems: "center", gap: 4 }}><Text style={s.dl}>{DAY_SHORT[d].toUpperCase()}</Text><Text style={s.dp}>{p}%</Text></View>;
        })}</View>
      </View>

      <View style={[s.card, { marginTop: 14, gap: 12 }]}>
        <Text style={[s.cap, { color: colors.ink, fontWeight: "700" }]}>Registrar medidas de hoy</Text>
        {([["Peso (kg)", "w"], ["Grasa corporal (%)", "fat"], ["Masa muscular (kg)", "mus"], ["Cintura (cm)", "waist"]] as const).map(([l, k]) => <View key={k}><Label>{l}</Label><Input keyboardType="decimal-pad" value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v.replace(/[^0-9.,]/g, "").slice(0, 6) })} placeholder="—" /></View>)}
        <Button label="Guardar medidas" busy={saving} onPress={save} />
      </View>
    </ScrollView>
  </Screen>;
}

const s = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: colors.header, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, padding: 18, flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surface, borderWidth: 3, borderColor: "#d9d9dd", alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: 22, fontWeight: "500", color: colors.ink }, hSub: { fontSize: 14, color: colors.ink, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginHorizontal: 16, gap: 6 },
  cap: { fontSize: 12, color: colors.muted }, big: { fontSize: 22, fontWeight: "700", color: colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16, marginTop: 14 },
  metric: { width: "47.8%", backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 4 },
  mLabel: { fontSize: 11, color: colors.muted }, mValue: { fontSize: 20, fontWeight: "700", color: colors.ink }, mDelta: { fontSize: 11, color: colors.muted },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 10, height: 130, marginTop: 8 }, bar: { width: "70%", backgroundColor: colors.faint, borderRadius: 6 },
  barVal: { fontSize: 10, color: colors.muted, marginBottom: 3 }, barDate: { fontSize: 9, color: colors.muted, marginTop: 4 },
  empty: { color: colors.muted, fontSize: 13, paddingVertical: 10 },
  compRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 }, dl: { fontSize: 10, color: colors.muted }, dp: { fontSize: 11, fontWeight: "700", color: colors.ink },
});
