import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { BackHeader, Button, Input, Label, Screen } from "@/components/ui";
import { useDraft } from "@/lib/draftStore";
import { colors, radius } from "@/theme";

const GOALS = ["Fuerza", "Hipertrofia", "Movilidad"];

export default function CreateRoutine() {
  const d = useDraft();
  const ok = d.name.trim().length >= 2;
  return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <BackHeader title="Crea tu rutina" subtitle="Diseña cada detalle de tu entrenamiento y ajústalo a tu ritmo." />
      <View style={s.body}>
        <View><Label>Nombre de la rutina</Label><Input value={d.name} maxLength={80} onChangeText={(name) => d.set({ name })} placeholder="Ej. Fuerza y glúteo" /></View>
        <View><Label>Objetivo principal</Label>
          <View style={s.seg}>{GOALS.map((g) => <Pressable key={g} onPress={() => d.set({ goal: g })} style={[s.segItem, d.goal === g && s.segOn]}><Text style={[s.segText, d.goal === g && { color: colors.ink, fontWeight: "700" }]}>{g}</Text></Pressable>)}</View></View>
        <View><Label>Días por semana</Label>
          <View style={s.seg}>{[1, 2, 3, 4, 5, 6].map((n) => <Pressable key={n} onPress={() => d.set({ days: n })} style={[s.segItem, d.days === n && s.segOn]}><Text style={[s.segText, d.days === n && { color: colors.ink, fontWeight: "700" }]}>{n}</Text></Pressable>)}</View></View>
        <View><Label>Duración por sesión</Label>
          <View style={s.seg}>{([30, 45, 60, 90] as const).map((n) => <Pressable key={n} onPress={() => d.set({ minutes: n })} style={[s.segItem, d.minutes === n && s.segOn]}><Text style={[s.segText, d.minutes === n && { color: colors.ink, fontWeight: "700" }]}>{n} min</Text></Pressable>)}</View></View>
        <Button label="Agregar ejercicios" disabled={!ok} onPress={() => router.push({ pathname: "/exercise-picker", params: { mode: "add" } } as never)} />
      </View>
    </ScrollView>
  </KeyboardAvoidingView></Screen>;
}
const s = StyleSheet.create({
  body: { padding: 22, gap: 24 },
  seg: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  segItem: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: radius.sm }, segOn: { backgroundColor: "#fff" }, segText: { fontSize: 14, color: colors.muted },
});
