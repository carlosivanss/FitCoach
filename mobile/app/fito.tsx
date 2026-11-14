import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Button, Chip, Screen } from "@/components/ui";
import { loadMe } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { DAY_SHORT, colors, radius } from "@/theme";

type A = { place: "gym" | "home" | null; equipment: string[]; days: number[]; focus: "focused" | "balanced"; muscles: string[]; minutes: 30 | 45 | 60 | 90; when: "morning" | "midday" | "evening" | null; notes: string };
const EQUIP = [["Mancuernas", "Peso libre para entrenar todo tu cuerpo."], ["Máquinas", "Equipo guiado para trabajar con control."], ["Bandas elásticas", "Una opción ligera y versátil."]] as const;
// Etiqueta en pantalla → valores del catálogo (priority_muscles de la función generate-routine).
const MUSCLES: Record<string, string[]> = { Glúteos: ["glutes"], Piernas: ["quads", "hamstrings", "calves"], Espalda: ["lats", "upper back"], Core: ["abs"], Pecho: ["pectorals"], Hombros: ["delts"], Brazos: ["biceps", "triceps"] };
const WHEN = [["morning", "Mañana", "6:00 – 10:00"], ["midday", "Mediodía", "11:00 – 15:00"], ["evening", "Tarde", "16:00 – 20:00"]] as const;
const TOTAL = 5;

/** Asistente "Fito IA" de 5 pasos (PDF). Llama a la Edge Function generate-routine, que guarda la rutina del paciente. */
export default function Fito() {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState<A>({ place: null, equipment: [], days: [], focus: "balanced", muscles: [], minutes: 60, when: null, notes: "" });
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const valid = step === 1 ? a.place !== null : step === 2 ? a.place === "gym" || a.equipment.length > 0 : step === 3 ? a.days.length > 0 : step === 4 ? a.focus === "balanced" || a.muscles.length > 0 : a.when !== null;

  async function create() {
    setBusy(true);
    try {
      const me = await loadMe();
      if (!me?.clientId) throw new Error("Tu cuenta aún no está vinculada a un expediente.");
      const [{ data: prof }, { data: inj }] = await Promise.all([
        supabase.from("fc_profiles").select("experience_level").eq("user_id", me.userId).single(),
        supabase.from("fc_client_injuries").select("custom_name, severity, notes, fc_injuries(name)").eq("client_id", me.clientId).eq("status", "active"),
      ]);
      const lim = [
        a.place === "home" && a.equipment.length ? `Equipo disponible: ${a.equipment.join(", ")}.` : "",
        `Prefiere entrenar: ${a.days.map((d) => DAY_SHORT[d]).join(", ")}.`,
        ...(inj ?? []).map((i) => { const n = i.custom_name ?? (Array.isArray(i.fc_injuries) ? i.fc_injuries[0]?.name : (i.fc_injuries as { name: string } | null)?.name) ?? "lesión"; return `Lesión (${i.severity}): ${n}${i.notes ? ` – ${i.notes}` : ""}.`; }),
        a.notes.trim(),
      ].filter(Boolean).join(" ").slice(0, 500);
      const { data, error } = await supabase.functions.invoke("generate-routine", { body: { answers: {
        goal: "general", experience_level: prof?.experience_level ?? "beginner", training_location: a.place,
        days_per_week: Math.min(6, a.days.length), session_minutes: a.minutes,
        priority_muscles: a.focus === "focused" ? a.muscles.flatMap((m) => MUSCLES[m] ?? []) : [], limitations: lim,
      } } });
      if (error) {
        let msg = error.message;
        try { const body = await (error as { context?: Response }).context?.json(); if (body?.error) msg = body.error; } catch { /* mensaje genérico */ }
        throw new Error(msg);
      }
      if (!data?.routine_id) throw new Error("Fito no devolvió una rutina. Intenta de nuevo.");
      Alert.alert("¡Tu rutina está lista!", `${data.plan?.name ?? "Rutina"} · ${data.plan?.days?.length ?? ""} días. Tu rutina anterior quedó archivada.`, [{ text: "Ver inicio", onPress: () => router.dismissAll() }]);
    } catch (e) {
      Alert.alert("No se pudo crear la rutina", e instanceof Error ? e.message : "Intenta de nuevo en unos minutos.");
    } finally { setBusy(false); }
  }

  if (busy) return <Screen style={s.center}><ActivityIndicator size="large" color={colors.ink} /><Text style={s.busyT}>Fito está creando tu rutina…</Text><Text style={s.busyS}>Esto puede tardar hasta un minuto.</Text></Screen>;

  const Card = ({ title, sub, on, onPress, icon }: { title: string; sub: string; on: boolean; onPress: () => void; icon?: string }) =>
    <Pressable onPress={onPress} style={[s.opt, on && s.optOn]}><Text style={s.optIcon}>{on ? "✓" : icon ?? "○"}</Text><View style={{ flex: 1 }}><Text style={[s.optT, !on && { color: colors.ink }]}>{title}</Text><Text style={s.optS}>{sub}</Text></View></Pressable>;

  return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={s.top}><Pressable hitSlop={12} onPress={() => (step === 1 ? router.back() : setStep(step - 1))}><Text style={s.back}>‹</Text></Pressable><Text style={s.kicker}>PASO {step} DE {TOTAL}{step >= 3 ? "   ·   FITO IA" : ""}</Text></View>
    <ScrollView contentContainerStyle={{ padding: 22, gap: 14, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      {step === 1 ? <>
        <Text style={s.h}>¿Dónde entrenas?</Text><Text style={s.p}>Elige el espacio que tienes disponible para adaptar tu rutina.</Text>
        <Card title="Casa" sub="Rutinas sin necesidad de ir al gimnasio." icon="⌂" on={a.place === "home"} onPress={() => setA({ ...a, place: "home" })} />
        <Card title="Gimnasio" sub="Aprovecha máquinas y peso libre." icon="＋" on={a.place === "gym"} onPress={() => setA({ ...a, place: "gym" })} />
      </> : null}
      {step === 2 ? <>
        <Text style={s.h}>¿Qué equipo tienes?</Text><Text style={s.p}>Puedes elegir más de una opción. Lo usaremos para crear ejercicios realistas.</Text>
        {a.place === "gym" ? <Text style={s.p}>En el gimnasio usaremos todo el equipo disponible; aun así cuéntanos qué prefieres.</Text> : null}
        {EQUIP.map(([t, sub]) => <Card key={t} title={t} sub={sub} on={a.equipment.includes(t)} onPress={() => setA({ ...a, equipment: toggle(a.equipment, t) })} />)}
      </> : null}
      {step === 3 ? <>
        <Text style={s.h}>¿Qué días entrenas?</Text><Text style={s.p}>Elige los días que mejor se adapten a tu semana. Puedes seleccionar varios.</Text>
        <View style={s.box}><Text style={s.cap}>DÍAS POR SEMANA</Text>
          <View style={s.days}>{[1, 2, 3, 4, 5, 6, 7].map((d) => { const on = a.days.includes(d); return <Pressable key={d} onPress={() => setA({ ...a, days: toggle(a.days, d).sort() })} style={{ alignItems: "center", gap: 8 }}><Text style={s.dl}>{DAY_SHORT[d][0].toUpperCase() + DAY_SHORT[d].slice(1)}</Text><View style={[s.dot, on && { backgroundColor: colors.ink }]}><Text style={{ color: on ? "#fff" : colors.faint }}>{on ? "✓" : "+"}</Text></View></Pressable>; })}</View>
          <Text style={s.sum}>{a.days.length} {a.days.length === 1 ? "día seleccionado" : "días seleccionados"}{a.days.length ? ` · ${a.days.map((d) => DAY_SHORT[d][0].toUpperCase() + DAY_SHORT[d].slice(1)).join(", ")}` : ""}</Text></View>
        <Text style={s.p}>Fito distribuirá el volumen para que tengas recuperación entre sesiones.</Text>
      </> : null}
      {step === 4 ? <>
        <Text style={s.h}>¿Qué quieres priorizar?</Text><Text style={s.p}>Elige un enfoque para repartir el trabajo de tu rutina.</Text>
        <Card title="Más enfoque" sub="Prioriza los músculos que elijas." on={a.focus === "focused"} onPress={() => setA({ ...a, focus: "focused" })} />
        <Card title="Balanceado" sub="Trabaja todo el cuerpo de forma equilibrada." on={a.focus === "balanced"} onPress={() => setA({ ...a, focus: "balanced", muscles: [] })} />
        {a.focus === "focused" ? <><Text style={s.cap}>MÚSCULOS A PRIORIZAR</Text><View style={s.wrap}>{Object.keys(MUSCLES).map((m) => <Chip key={m} label={m} active={a.muscles.includes(m)} onPress={() => setA({ ...a, muscles: toggle(a.muscles, m) })} />)}</View></> : null}
      </> : null}
      {step === 5 ? <>
        <Text style={s.h}>Ajusta tu tiempo</Text><Text style={s.p}>Así Fito podrá crear sesiones que encajen de verdad en tu día.</Text>
        <View style={s.box}><Text style={s.cap}>DURACIÓN POR SESIÓN</Text><View style={s.wrap}>{([30, 45, 60, 90] as const).map((m) => <Pressable key={m} onPress={() => setA({ ...a, minutes: m })} style={[s.min, a.minutes === m && { backgroundColor: "#fff" }]}><Text style={[s.minT, a.minutes === m && { fontWeight: "800", color: colors.ink }]}>{m} min</Text></Pressable>)}</View></View>
        <View style={s.box}><Text style={s.cap}>MOMENTO PREFERIDO</Text>{WHEN.map(([v, l, r]) => <Pressable key={v} onPress={() => setA({ ...a, when: v })} style={s.when}><Text style={s.radio}>{a.when === v ? "●" : "○"}</Text><Text style={s.whenT}>{l}</Text><Text style={s.whenR}>{r}</Text></Pressable>)}</View>
        <TextInput value={a.notes} onChangeText={(notes) => setA({ ...a, notes })} maxLength={150} multiline placeholder="¿Algo más que Fito deba saber? (opcional)" placeholderTextColor={colors.faint} style={s.notes} />
        <Text style={s.sum}>{a.minutes} minutos{a.when ? ` · ${WHEN.find((w) => w[0] === a.when)![1]}` : ""}</Text>
      </> : null}
    </ScrollView>
    <View style={s.bar}><Button label={step === TOTAL ? "✦ Crear mi rutina" : "Continuar"} tone={valid ? "dark" : "soft"} disabled={!valid} onPress={() => (step === TOTAL ? create() : setStep(step + 1))} /></View>
  </KeyboardAvoidingView></Screen>;
}
const s = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: 12 }, busyT: { fontSize: 18, fontWeight: "700", color: colors.ink }, busyS: { color: colors.muted },
  top: { paddingHorizontal: 22, paddingTop: 6, gap: 14 }, back: { fontSize: 32, lineHeight: 34, color: colors.ink }, kicker: { fontSize: 10, letterSpacing: 1.5, color: colors.muted },
  h: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 6 }, p: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  opt: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20 }, optOn: { backgroundColor: colors.surfaceStrong }, optIcon: { width: 26, fontSize: 20, textAlign: "center", color: colors.ink }, optT: { fontSize: 17, fontWeight: "700", color: colors.ink }, optS: { fontSize: 12, color: colors.muted, marginTop: 3 },
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14 }, cap: { fontSize: 10, letterSpacing: 1.3, color: colors.muted },
  days: { flexDirection: "row", justifyContent: "space-between" }, dl: { fontSize: 12, color: colors.ink }, dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, sum: { fontSize: 12, color: colors.ink },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, min: { backgroundColor: colors.surfaceStrong, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12 }, minT: { fontSize: 13, color: colors.muted },
  when: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }, radio: { fontSize: 16, color: colors.ink }, whenT: { flex: 1, fontSize: 15, color: colors.ink }, whenR: { fontSize: 12, color: colors.muted },
  notes: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, minHeight: 64, fontSize: 14, color: colors.ink, textAlignVertical: "top" },
  bar: { position: "absolute", left: 22, right: 22, bottom: 22 },
});
