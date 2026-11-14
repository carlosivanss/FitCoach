import { Tabs } from "expo-router";
import { colors, radius } from "@/theme";

/** Barra inferior tipo píldora con Inicio / Progreso, como en el PDF. */
export default function TabsLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.ink,
    tabBarInactiveTintColor: colors.faint,
    tabBarShowLabel: true,
    tabBarIconStyle: { display: "none" },
    tabBarLabelStyle: { fontSize: 13, fontWeight: "700", marginBottom: 0 },
    tabBarItemStyle: { borderRadius: radius.pill, marginVertical: 6 },
    tabBarActiveBackgroundColor: "#fff",
    tabBarStyle: { position: "absolute", left: 20, right: 20, bottom: 18, height: 56, borderRadius: radius.pill, backgroundColor: colors.surface, borderTopWidth: 0, paddingHorizontal: 6, elevation: 0 },
  }}>
    <Tabs.Screen name="index" options={{ title: "Inicio" }} />
    <Tabs.Screen name="progress" options={{ title: "Progreso" }} />
  </Tabs>;
}
