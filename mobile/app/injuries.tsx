import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { BackHeader, Button, Chip, Input, Label, Screen } from "@/components/ui";
import { Me, loadMe } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { colors, radius } from "@/theme";

type Inj = { id: number; custom_name: string | null; notes: string | null; severity: "mild" | "moderate" | "severe"; status: "active" | "resolved"; fc_injuries: { name: string } | { name: string }[] | null };
const SEV = { mild: "Leve", moderate: "Moderada", severe: "Fuerte" } as const;
const COMMON = ["Rodilla", "Hombro", "Espalda baja", "Tobillo", "Muñeca", "Cadera", "Cuello", "Codo"];

/** "Agregar lesiones": las zonas se mandan a Fito IA como limitaciones para no incluir ejercicios que las comprometan. */
export default function Injuries() {
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<Inj[] | null>(null);
  const [area, setArea] = useState(""); const [sev, setSev] = useState<Inj["severity"]>("mild"); const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const m = await loadMe(); setMe(m); if (!m?.clientId) return setItems([]);
    const { data } = await supabase.from("fc_client_injuries").select("id, custom_name, notes, severity, status, fc_injuries(name)").eq("client_id", m.clientId).order("created_at", { ascending: false });
    setItems((data ?? []) as unknown as Inj[]);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function add() {
    const name = area.trim(); if (!me?.clientId) return;
    if (name.length < 2) return Alert.alert("Escribe la zona", "Indica qué zona del cuerpo está lesionada.");
    setBusy(true);
    const { error } = await supabase.from("fc_client_injuries").insert({ client_id: me.clientId, custom_name: name.slice(0, 120), notes: notes.trim().slice(0, 500) || null, severity: sev, recorded_by: me.userId });
    setBusy(false);
    if (error) return Alert.alert("No se pudo guardar", error.message);
    setArea(""); setNotes(""); setSev("mild"); await load();
  }
  async function toggle(i: Inj) {
    const { error } = await supabase.from("fc_client_injuries").update({ status: i.status === "active" ? "resolved" : "active" }).eq("id", i.id);
    if (error) return Alert.alert("No se pudo actualizar", error.message);
    await load();
  }
  const nameOf = (i: Inj) => i.custom_name ?? (Array.isArray(i.fc_injuries) ? i.fc_injuries[0]?.name : i.fc_injuries?.name) ?? "Lesión";

  return <Screen>
    <BackHeader title="Agregar lesiones" subtitle="Cuéntanos qué zonas cuidar para que tu rutina las respete." />
    <ScrollView contentContainerStyle={{ padding: 22, gap: 22, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 12 }}>
        <Label>Zona lesionada</Label>
        <View style={s.wrap}>{COMMON.map((c) => <Chip key={c} label={c} active={area === c} onPress={() => setArea(area === c ? "" : c)} />)}</View>
        <Input value={area} onChangeText={setArea} maxLength={120} placeholder="O escribe otra (ej. Rodilla derecha)" />
        <Label>Intensidad</Label>
        <View style={s.seg}>{(Object.keys(SEV) as Inj["severity"][]).map((k) => <Pressable key={k} onPress={() => setSev(k)} style={[s.segItem, sev === k && s.segOn]}><Text style={[s.segText, sev === k && { fontWeight: "700", color: colors.ink }]}>{SEV[k]}</Text></Pressable>)}</View>
        <Input value={notes} onChangeText={setNotes} maxLength={500} multiline placeholder="Notas (opcional)" style={{ minHeight: 70, textAlignVertical: "top" }} />
        <Button label="Guardar lesión" busy={busy} onPress={add} />
      </View>
      <View style={{ gap: 10 }}>
        <Label>Registradas</Label>
        {items === null ? <ActivityIndicator color={colors.ink} /> : !items.length ? <Text style={s.empty}>No tienes lesiones registradas.</Text> : items.map((i) => <View key={i.id} style={s.card}>
          <View style={{ flex: 1 }}><Text style={[s.name, i.status === "resolved" && { color: colors.faint }]}>{nameOf(i)}</Text><Text style={s.meta}>{SEV[i.severity]}{i.notes ? ` · ${i.notes}` : ""}</Text></View>
          <Pressable onPress={() => toggle(i)} style={s.pill}><Text style={s.pillText}>{i.status === "active" ? "Marcar superada" : "Reactivar"}</Text></Pressable>
        </View>)}
      </View>
    </ScrollView>
  </Screen>;
}
const s = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seg: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 }, segItem: { flex: 1, paddingVertical: 11, alignItems: "center", borderRadius: radius.sm }, segOn: { backgroundColor: "#fff" }, segText: { color: colors.muted },
  card: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14 }, name: { fontSize: 15, fontWeight: "700", color: colors.ink }, meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  pill: { backgroundColor: colors.surfaceStrong, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }, pillText: { fontSize: 11, fontWeight: "600", color: colors.ink }, empty: { color: colors.muted, fontSize: 13 },
});
