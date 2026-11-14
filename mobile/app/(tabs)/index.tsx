import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { ActiveRoutine, Me, loadActiveRoutine, loadMe } from "@/lib/data";
import { DAY_LONG, DAY_SHORT, colors, isoDay, localISO, radius } from "@/theme";

type Mark = "done" | "missed" | "none";

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [routine, setRoutine] = useState<ActiveRoutine | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const m = await loadMe();
      if (!m) { await supabase.auth.signOut(); router.replace("/login"); return; }
      if (!alive) return;
      setMe(m);
      if (m.clientId) {
        const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - (isoDay(monday) - 1));
        const [r, s] = await Promise.all([
          loadActiveRoutine(m.clientId),
          supabase.from("fc_workout_sessions").select("completed_at").eq("client_id", m.clientId).eq("status", "completed").gte("completed_at", monday.toISOString()),
        ]);
        if (!alive) return;
        setRoutine(r);
        setDone(new Set((s.data ?? []).map((x) => localISO(new Date(x.completed_at as string)))));
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []));

  if (loading) return <Screen style={s.center}><ActivityIndicator size="large" color={colors.ink} /></Screen>;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = isoDay(today);
  const routineDays = routine ? Object.keys(routine.days).map(Number).sort((a, b) => a - b) : [];
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (todayIso - 1) + i);
    const dow = i + 1;
    const mark: Mark = done.has(localISO(d)) ? "done" : routineDays.includes(dow) && d < today ? "missed" : "none";
    return { dow, mark, isToday: dow === todayIso };
  });
  const nextDay = routineDays.find((d) => d >= todayIso) ?? routineDays[0];
  const todays = nextDay ? routine!.days[nextDay] : [];

  function menu() {
    Alert.alert("Cuenta", undefined, [
      { text: "Editar perfil", onPress: () => router.push("/profile" as never) },
      { text: "Cerrar sesión", style: "destructive", onPress: async () => { await supabase.auth.signOut(); router.replace("/login"); } },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  return <Screen>
    <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={s.header}>
        <View style={s.avatar}><Text style={s.avatarText}>{me?.name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.hi}>¡Hola!</Text>
          <Text style={s.hiSub}>Listo para entrenar, {me?.name.split(" ")[0]}?</Text>
        </View>
        <Pressable accessibilityLabel="Menú" hitSlop={12} onPress={menu}><Text style={s.dots}>⋮</Text></Pressable>
      </View>

      <View style={s.week}>
        {week.map((w) => <View key={w.dow} style={[s.dayCol, w.isToday && s.dayToday]}>
          <Text style={[s.dayLabel, w.isToday && { fontWeight: "800" }]}>{DAY_SHORT[w.dow]}</Text>
          <Text style={[s.mark, { color: w.mark === "done" ? colors.success : colors.danger }]}>{w.mark === "done" ? "✓" : w.mark === "missed" ? "✕" : " "}</Text>
        </View>)}
      </View>

      {routine && nextDay ? <Pressable style={s.todayCard} onPress={() => router.push({ pathname: "/workout", params: { day: String(nextDay) } })}>
        <View style={s.todayTop}>
          <Text style={s.todayKicker}>{nextDay === todayIso ? "Entrenamiento de hoy" : "Próximo entrenamiento"}</Text>
          <View style={s.dayBadge}><Text style={s.dayBadgeText}>Día {routineDays.indexOf(nextDay) + 1}</Text><Text style={s.dayBadgeSub}>{DAY_SHORT[nextDay]}</Text></View>
        </View>
        <Text style={s.todayTitle}>{routine.name}</Text>
        <Text style={s.todayMeta}>{DAY_LONG[nextDay]} · {routine.session_minutes} mins - {todays.length} ejercicios</Text>
        <Text style={s.chev}>⌃</Text>
      </Pressable> : <View style={s.todayCard}>
        <Text style={s.todayTitle}>Aún no tienes rutina</Text>
        <Text style={s.todayMeta}>Crea una o deja que Fito la arme por ti.</Text>
      </View>}

      <View style={s.grid}>
        <Tile icon="✎" label="Crea tu rutina" onPress={() => router.push("/create-routine" as never)} />
        <Tile icon="✦" label={"Deja que\nFito cree\ntu rutina"} onPress={() => router.push("/fito" as never)} />
        <Tile icon="☰" label="Mis rutinas" onPress={() => router.push("/routines" as never)} />
        <Tile icon="✚" label="Agregar lesiones" onPress={() => router.push("/injuries" as never)} />
      </View>
    </ScrollView>
  </Screen>;
}

function Tile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [s.tile, pressed && { opacity: 0.6 }]}>
    <Text style={s.tileIcon}>{icon}</Text><Text style={s.tileLabel}>{label}</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: colors.header, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, padding: 18, paddingTop: 14, flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 3, borderColor: "#d9d9dd", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "800", color: colors.ink },
  hi: { fontSize: 20, color: colors.ink }, hiSub: { fontSize: 13, color: colors.ink, marginTop: 8 },
  dots: { fontSize: 24, color: colors.ink },
  week: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.lg, marginHorizontal: 16, marginTop: 16, paddingVertical: 14, paddingHorizontal: 10 },
  dayCol: { alignItems: "center", gap: 6, minWidth: 38, paddingVertical: 4, borderRadius: radius.md }, dayToday: { backgroundColor: "#fff" },
  dayLabel: { fontSize: 15, color: colors.ink }, mark: { fontSize: 16, fontWeight: "800", height: 20 },
  todayCard: { backgroundColor: colors.surface, borderRadius: radius.lg, marginHorizontal: 16, marginTop: 16, padding: 18, gap: 8 },
  todayTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  todayKicker: { fontSize: 16, color: colors.ink },
  dayBadge: { backgroundColor: colors.surfaceStrong, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  dayBadgeText: { fontSize: 15, fontWeight: "700", color: colors.ink }, dayBadgeSub: { fontSize: 12, color: colors.muted },
  todayTitle: { fontSize: 22, fontWeight: "700", color: colors.ink, textAlign: "center", marginTop: 4 },
  todayMeta: { fontSize: 12, color: colors.muted, textAlign: "center" }, chev: { textAlign: "center", color: colors.muted, fontSize: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingHorizontal: 16, marginTop: 18 },
  tile: { width: "47.5%", minHeight: 96, backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, justifyContent: "center", alignItems: "center", gap: 8 },
  tileIcon: { fontSize: 20, color: colors.ink }, tileLabel: { fontSize: 13, color: colors.ink, textAlign: "center" },
});
