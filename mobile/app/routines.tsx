import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { BackHeader, Empty, Screen } from "@/components/ui";
import { loadMe } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { colors, radius } from "@/theme";

type R = { id: number; name: string; days_per_week: number; session_minutes: number; source: string; archived_at: string | null; created_at: string };
const SRC: Record<string, string> = { manual: "Creada por ti", fito_ai: "Creada por Fito", trainer: "De tu nutriólogo" };

/** "Mis rutinas": la activa y el historial de anteriores. */
export default function Routines() {
  const [items, setItems] = useState<R[] | null>(null);
  useFocusEffect(useCallback(() => { (async () => {
    const me = await loadMe(); if (!me?.clientId) return setItems([]);
    const { data } = await supabase.from("fc_routines").select("id, name, days_per_week, session_minutes, source, archived_at, created_at").eq("client_id", me.clientId).order("created_at", { ascending: false });
    setItems((data ?? []) as R[]);
  })(); }, []));
  return <Screen>
    <BackHeader title="Mis rutinas" subtitle="Tu rutina activa y las anteriores." />
    {items === null ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.ink} /> : !items.length ? <Empty title="Aún no tienes rutinas" text="Crea una o pídele a Fito que la arme por ti." /> :
      <ScrollView contentContainerStyle={{ padding: 22, gap: 12 }}>
        {items.map((r) => <Pressable key={r.id} style={s.card} onPress={() => !r.archived_at && router.replace("/")}>
          <View style={{ flex: 1 }}><Text style={s.name}>{r.name}</Text><Text style={s.meta}>{r.days_per_week} días · {r.session_minutes} min · {SRC[r.source] ?? r.source}</Text></View>
          <View style={[s.pill, !r.archived_at && { backgroundColor: colors.ink }]}><Text style={[s.pillText, !r.archived_at && { color: "#fff" }]}>{r.archived_at ? "Archivada" : "Activa"}</Text></View>
        </Pressable>)}
      </ScrollView>}
  </Screen>;
}
const s = StyleSheet.create({ card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 16 }, name: { fontSize: 16, fontWeight: "700", color: colors.ink }, meta: { fontSize: 12, color: colors.muted, marginTop: 3 }, pill: { backgroundColor: colors.surfaceStrong, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }, pillText: { fontSize: 12, fontWeight: "600", color: colors.muted } });
