import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, radius } from "@/theme";

export function Screen({ children, edges = ["top"] as ("top" | "bottom")[], style }: { children: ReactNode; edges?: ("top" | "bottom")[]; style?: ViewStyle }) {
  return <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</SafeAreaView>;
}

/** Cabecera gris con título centrado (pantallas de rutina / ejercicio). */
export function TitleBar({ title, subtitle, back = true }: { title: string; subtitle?: string; back?: boolean }) {
  return <View style={s.titleBar}>
    {back ? <Pressable accessibilityLabel="Volver" hitSlop={12} onPress={() => router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable> : null}
    <Text style={s.titleBarText} numberOfLines={1}>{title}</Text>
    {subtitle ? <Text style={s.titleBarSub}>{subtitle}</Text> : null}
  </View>;
}

export function BackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={s.bh}>
    <Pressable accessibilityLabel="Volver" hitSlop={12} onPress={() => router.back()}><Text style={s.backText}>‹</Text></Pressable>
    <Text style={s.bhTitle}>{title}</Text>
    {subtitle ? <Text style={s.bhSub}>{subtitle}</Text> : null}
  </View>;
}

export function Button({ label, onPress, disabled, busy, tone = "dark" }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; tone?: "dark" | "soft" }) {
  const dark = tone === "dark";
  return <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [s.btn, { backgroundColor: dark ? colors.ink : colors.surfaceStrong }, (disabled || pressed) && { opacity: dark ? 0.55 : 0.6 }]}>
    {busy ? <ActivityIndicator color={dark ? "#fff" : colors.ink} /> : <Text style={[s.btnText, { color: dark ? "#fff" : colors.ink }]}>{label}</Text>}
  </Pressable>;
}

export function Label({ children }: { children: ReactNode }) { return <Text style={s.label}>{children}</Text>; }

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.faint} {...props} style={[s.input, props.style]} />;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: colors.ink }]}><Text style={[s.chipText, active && { color: "#fff" }]}>{active ? "✓ " : ""}{label}</Text></Pressable>;
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return <View style={{ alignItems: "center", padding: 32, gap: 6 }}><Text style={{ fontSize: 17, fontWeight: "800", color: colors.ink }}>{title}</Text>{text ? <Text style={{ color: colors.muted, textAlign: "center" }}>{text}</Text> : null}</View>;
}

const s = StyleSheet.create({
  titleBar: { backgroundColor: colors.header, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, paddingTop: 10, paddingBottom: 18, paddingHorizontal: 54, alignItems: "center" },
  back: { position: "absolute", left: 18, top: 10 },
  backText: { fontSize: 32, lineHeight: 34, color: colors.ink },
  titleBarText: { fontSize: 26, fontWeight: "500", color: colors.ink },
  titleBarSub: { marginTop: 6, fontSize: 13, color: colors.ink },
  bh: { paddingHorizontal: 22, paddingTop: 6, gap: 6 },
  bhTitle: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 6 },
  bhSub: { color: colors.muted, lineHeight: 20, marginBottom: 6 },
  btn: { minHeight: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  btnText: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 11, letterSpacing: 1.2, color: colors.muted, fontWeight: "600", textTransform: "uppercase", marginBottom: 8 },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.ink },
  chip: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
});
