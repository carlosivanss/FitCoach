import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useEffect } from "react";
import { BackHeader, Button, Chip, Input, Screen } from "@/components/ui";
import { CatalogEx, EMPTY_FILTERS, Filters, GROUPS, SPECIFIC, applyFilters, loadCatalog } from "@/lib/catalog";
import { useDraft } from "@/lib/draftStore";
import { colors, radius } from "@/theme";

/** "Filtrar ejercicios" (PDF): grupo muscular, tipo y músculo específico con conteo en vivo. */
export default function ExerciseFilter() {
  const d = useDraft();
  const [f, setF] = useState<Filters>(d.filters);
  const [all, setAll] = useState<CatalogEx[]>([]);
  useEffect(() => { void loadCatalog().then(setAll).catch(() => undefined); }, []);
  const count = useMemo(() => applyFilters(all, f, new Set()).length, [all, f]);
  const sel = [f.group, f.type === "compound" ? "Compuesto" : f.type === "isolation" ? "Aislado" : null, f.muscle].filter(Boolean).join(" · ");

  return <Screen>
    <BackHeader title="Filtrar ejercicios" />
    <ScrollView contentContainerStyle={{ padding: 22, gap: 22, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <Input value={f.q} onChangeText={(q) => setF({ ...f, q })} placeholder="Buscar ejercicio" />
      <View style={s.sec}><Text style={s.h}>Grupo muscular</Text><Text style={s.sub}>Elige una zona para empezar</Text>
        <View style={s.wrap}>{GROUPS.map((g) => <Chip key={g} label={g} active={f.group === g} onPress={() => setF({ ...f, group: f.group === g ? null : g, muscle: null })} />)}</View></View>
      <View style={s.sec}><Text style={s.h}>Tipo de ejercicio</Text><Text style={s.sub}>Selecciona cómo quieres entrenar</Text>
        <View style={s.seg}>{([["compound", "Compuesto"], ["isolation", "Aislado"]] as const).map(([v, l]) => <Pressable key={v} onPress={() => setF({ ...f, type: f.type === v ? null : v })} style={[s.segItem, f.type === v && s.segOn]}><Text style={[s.segText, f.type === v && { fontWeight: "700", color: colors.ink }]}>{l}</Text></Pressable>)}</View></View>
      {f.group ? <View style={s.sec}><Text style={s.h}>Músculo específico</Text><Text style={s.sub}>Filtra aún más tus resultados</Text>
        <View style={s.wrap}>{SPECIFIC[f.group].map((m) => <Chip key={m.label} label={m.label} active={f.muscle === m.label} onPress={() => setF({ ...f, muscle: f.muscle === m.label ? null : m.label })} />)}</View></View> : null}
      <View style={s.sel}><Text style={s.selH}>Tu selección</Text><Text style={s.selT}>{sel || "Todos los ejercicios"}</Text></View>
      <Pressable onPress={() => setF(EMPTY_FILTERS)}><Text style={s.clear}>Limpiar filtros</Text></Pressable>
    </ScrollView>
    <View style={s.bar}><Button label={`Ver ${count} ejercicios`} onPress={() => { d.setFilters(f); router.back(); }} /><Text style={s.note}>Puedes cambiar los filtros cuando quieras</Text></View>
  </Screen>;
}
const s = StyleSheet.create({
  sec: { gap: 6 }, h: { fontSize: 15, fontWeight: "700", color: colors.ink }, sub: { fontSize: 12, color: colors.muted, marginBottom: 6 }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  seg: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 }, segItem: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: radius.sm }, segOn: { backgroundColor: colors.surfaceStrong }, segText: { color: colors.muted },
  sel: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 4 }, selH: { fontSize: 12, fontWeight: "700", color: colors.ink }, selT: { fontSize: 12, color: colors.muted },
  clear: { textAlign: "center", color: colors.muted, fontSize: 13, textDecorationLine: "underline" },
  bar: { position: "absolute", left: 22, right: 22, bottom: 22, gap: 8 }, note: { textAlign: "center", fontSize: 11, color: colors.faint },
});
