import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { BackHeader, Button, Empty, Input, Screen } from "@/components/ui";
import { CatalogEx, GROUPS, applyFilters, loadCatalog, loadExcluded } from "@/lib/catalog";
import { loadMe } from "@/lib/data";
import { useDraft } from "@/lib/draftStore";
import { supabase } from "@/lib/supabase";
import { colors, radius } from "@/theme";

/** "Agrega ejercicios" (PDF): búsqueda, filtros y lista. Modo `replace` sustituye un ejercicio de la rutina activa. */
export default function ExercisePicker() {
  const { mode, reId, remember } = useLocalSearchParams<{ mode?: string; reId?: string; remember?: string }>();
  const d = useDraft();
  const [all, setAll] = useState<CatalogEx[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    try {
      const [c, me] = await Promise.all([loadCatalog(), loadMe()]);
      setAll(c); if (me) setExcluded(await loadExcluded(me.userId));
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo cargar el catálogo."); }
    setLoading(false);
  })(); }, []);
  useFocusEffect(useCallback(() => undefined, []));

  const list = useMemo(() => applyFilters(all, d.filters, excluded).slice(0, 80), [all, d.filters, excluded]);
  const active = [d.filters.group, d.filters.type, d.filters.muscle].filter(Boolean).length;
  const inDraft = new Set(d.items.map((i) => i.exercise_id));

  function pick(e: CatalogEx) {
    if (mode === "replace") {
      Alert.alert("Reemplazar ejercicio", `¿Usar «${e.name}» en lugar del ejercicio actual?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Reemplazar", onPress: async () => {
          setBusy(true);
          const { error } = await supabase.rpc("fc_replace_my_exercise", { p_routine_exercise_id: Number(reId), p_new_exercise_id: e.id, p_exclude_old: remember === "1" });
          setBusy(false);
          if (error) return Alert.alert("No se pudo reemplazar", error.message);
          router.back();
        } },
      ]);
    } else router.push({ pathname: "/exercise-config", params: { id: String(e.id) } } as never);
  }

  return <Screen>
    <BackHeader title={mode === "replace" ? "Reemplazar ejercicio" : "Agrega ejercicios"} />
    <View style={{ paddingHorizontal: 22, paddingTop: 10, gap: 12 }}>
      <Input value={d.filters.q} onChangeText={(q) => d.setFilters({ ...d.filters, q })} placeholder="Buscar por nombre o músculo" />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable style={s.filterBtn} onPress={() => router.push("/exercise-filter" as never)}><Text style={s.filterText}>⚙ Filtros{active ? ` (${active})` : ""}</Text></Pressable>
        {GROUPS.slice(0, 4).map((g) => <Pressable key={g} onPress={() => d.setFilters({ ...d.filters, group: d.filters.group === g ? null : g, muscle: null })} style={[s.quick, d.filters.group === g && { backgroundColor: colors.ink }]}><Text style={[s.quickText, d.filters.group === g && { color: "#fff" }]}>{g}</Text></Pressable>)}
      </View>
    </View>
    {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.ink} /> : err ? <Empty title="No se pudo cargar" text={err} /> : <FlatList
      data={list} keyExtractor={(e) => String(e.id)} contentContainerStyle={{ padding: 22, gap: 12, paddingBottom: 120 }} keyboardShouldPersistTaps="handled"
      ListEmptyComponent={<Empty title="Sin resultados" text="Prueba con otra búsqueda o quita filtros." />}
      ListFooterComponent={list.length === 80 ? <Text style={s.more}>Mostrando 80. Afina la búsqueda para ver más.</Text> : null}
      renderItem={({ item }) => <Pressable style={s.row} onPress={() => pick(item)}>
        {item.image_url ? <Image source={{ uri: item.image_url }} style={s.thumb} resizeMode="contain" /> : <View style={s.thumb} />}
        <View style={{ flex: 1 }}><Text style={s.name} numberOfLines={2}>{item.name}</Text><Text style={s.meta}>{item.group}{item.type === "isolation" ? " · Aislado" : item.type === "compound" ? " · Compuesto" : ""}</Text></View>
        <Text style={[s.plus, inDraft.has(item.id) && { color: colors.success }]}>{mode === "replace" ? "⇄" : inDraft.has(item.id) ? "✓" : "＋"}</Text>
      </Pressable>} />}
    {mode !== "replace" ? <View style={s.bar}><Button label={`Ver rutina · ${d.items.length} ejercicios`} tone="soft" busy={busy} disabled={!d.items.length} onPress={() => router.push("/organize-week" as never)} /></View> : null}
  </Screen>;
}
const s = StyleSheet.create({
  filterBtn: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 }, filterText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  quick: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 }, quickText: { fontSize: 13, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 10 },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceStrong }, name: { fontSize: 15, fontWeight: "600", color: colors.ink }, meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  plus: { fontSize: 24, color: colors.ink, paddingHorizontal: 8 }, more: { textAlign: "center", color: colors.muted, fontSize: 12, padding: 8 },
  bar: { position: "absolute", left: 22, right: 22, bottom: 22 },
});
