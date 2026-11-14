import { Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, radius } from "@/theme";

/** Barra inferior tipo píldora con Inicio / Progreso, como en el PDF. */
function PillBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="box-none" style={[s.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
    <View style={s.pill}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const label = String(descriptors[route.key].options.title ?? route.name);
        return <Pressable key={route.key} accessibilityRole="button" accessibilityState={{ selected: focused }}
          onPress={() => { const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true }); if (!focused && !e.defaultPrevented) navigation.navigate(route.name); }}
          style={[s.item, focused && s.itemOn]}>
          <Text style={[s.label, focused && { color: colors.ink }]}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <PillBar {...p} />}>
    <Tabs.Screen name="index" options={{ title: "Inicio" }} />
    <Tabs.Screen name="progress" options={{ title: "Progreso" }} />
  </Tabs>;
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 20, right: 20 },
  pill: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 5 },
  item: { flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  itemOn: { backgroundColor: "#fff" },
  label: { fontSize: 13, fontWeight: "700", color: colors.faint },
});
