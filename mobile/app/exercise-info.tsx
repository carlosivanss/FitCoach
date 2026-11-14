import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Empty, Screen, TitleBar } from "@/components/ui";
import { findRoutineEx } from "@/lib/data";
import { colors, muscleLabel, radius } from "@/theme";

/** Técnica del ejercicio: demostración, "Cómo hacerlo" y consejo (PDF, pantalla de Lagartija). */
export default function ExerciseInfo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = findRoutineEx(Number(id));
  if (!ex) return <Screen><TitleBar title="Ejercicio" /><Empty title="Ejercicio no disponible" /></Screen>;
  const media = ex.gif_url ?? ex.image_url;
  return <Screen>
    <TitleBar title={ex.name} subtitle={muscleLabel(ex.muscle_group).toUpperCase()} />
    <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 40 }}>
      <View style={s.media}>{media ? <Image source={{ uri: media }} style={s.img} resizeMode="contain" /> : <Text style={{ color: "#fff" }}>Sin demostración disponible</Text>}</View>
      <Text style={s.h}>Cómo hacerlo</Text>
      {ex.instructions.length ? ex.instructions.map((t, i) => <Text key={i} style={s.p}>{i + 1}. {t}</Text>) : <Text style={s.p}>Aún no hay instrucciones para este ejercicio.</Text>}
      {ex.coaching_tip ? <Text style={s.tip}>CONSEJO · {ex.coaching_tip}</Text> : null}
    </ScrollView>
  </Screen>;
}
const s = StyleSheet.create({
  media: { backgroundColor: "#4a4a4f", borderRadius: radius.lg, height: 220, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  img: { width: "100%", height: "100%", backgroundColor: "#fff" },
  h: { fontSize: 20, fontWeight: "700", color: colors.ink }, p: { fontSize: 14, lineHeight: 22, color: colors.ink }, tip: { fontSize: 12, color: colors.ink, lineHeight: 18 },
});
