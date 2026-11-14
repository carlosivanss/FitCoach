import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { RoutineEx } from "@/lib/data";
import { Button } from "@/components/ui";
import { colors, radius } from "@/theme";

/** Hoja inferior con las acciones de un ejercicio (PDF: reemplazar, nota, video, favorito). */
export function ExerciseMenu({ ex, userId, onClose, onReplace }: { ex: RoutineEx | null; userId: string; onClose: () => void; onReplace: (ex: RoutineEx, remember: boolean) => void }) {
  const [fav, setFav] = useState(false);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setNoting(false); setNote(""); setFav(false);
    if (!ex) return;
    void supabase.from("fc_favorite_exercises").select("exercise_id").eq("user_id", userId).eq("exercise_id", ex.exercise_id).maybeSingle().then(({ data }) => setFav(Boolean(data)));
    void supabase.from("fc_exercise_notes").select("note").eq("user_id", userId).eq("exercise_id", ex.exercise_id).order("updated_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setNote(data?.note ?? ""));
  }, [ex?.id, userId]);

  if (!ex) return null;

  async function toggleFav() {
    const q = fav
      ? supabase.from("fc_favorite_exercises").delete().eq("user_id", userId).eq("exercise_id", ex!.exercise_id)
      : supabase.from("fc_favorite_exercises").insert({ user_id: userId, exercise_id: ex!.exercise_id });
    const { error } = await q;
    if (error) return Alert.alert("No se pudo actualizar", error.message);
    setFav(!fav); onClose();
  }
  async function saveNote() {
    const text = note.trim();
    const del = supabase.from("fc_exercise_notes").delete().eq("user_id", userId).eq("exercise_id", ex!.exercise_id);
    const { error: e1 } = await del;
    if (e1) return Alert.alert("No se pudo guardar", e1.message);
    if (text) {
      const { error } = await supabase.from("fc_exercise_notes").insert({ user_id: userId, exercise_id: ex!.exercise_id, note: text.slice(0, 4000) });
      if (error) return Alert.alert("No se pudo guardar", error.message);
    }
    onClose();
  }

  const Row = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) =>
    <Pressable style={s.row} onPress={onPress}><Text style={s.icon}>{icon}</Text><Text style={s.rowText}>{label}</Text></Pressable>;

  return <Modal transparent animationType="slide" visible onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPress={onClose} />
    <View style={s.sheet}>
      <View style={s.grab} />
      <Text style={s.title}>{ex.name}</Text>
      {noting ? <View style={{ gap: 12 }}>
        <TextInput multiline autoFocus value={note} onChangeText={setNote} placeholder="Escribe tu nota (ajustes de peso, sensaciones…)" placeholderTextColor={colors.faint} style={s.noteInput} maxLength={4000} />
        <Button label="Guardar nota" onPress={saveNote} />
      </View> : <View>
        <Row icon="⇄" label="Reemplazar" onPress={() => { onClose(); onReplace(ex, false); }} />
        <Row icon="⊖" label="Reemplazar y no sugerir" onPress={() => { onClose(); onReplace(ex, true); }} />
        <Row icon="▭" label={note ? "Editar nota" : "Añadir nota"} onPress={() => setNoting(true)} />
        <Row icon="▷" label="Video e instrucciones" onPress={() => { onClose(); router.push({ pathname: "/exercise-info", params: { id: String(ex.id) } }); }} />
        <Row icon={fav ? "★" : "☆"} label={fav ? "Quitar de favoritos" : "Favorito"} onPress={toggleFav} />
      </View>}
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: colors.header, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 22, paddingBottom: 34 },
  grab: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#fff", marginBottom: 14 },
  title: { fontSize: 22, textAlign: "center", color: colors.ink, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13 },
  icon: { width: 24, fontSize: 18, color: colors.ink, textAlign: "center" }, rowText: { fontSize: 17, color: colors.ink },
  noteInput: { backgroundColor: "#fff", borderRadius: radius.md, minHeight: 110, padding: 14, fontSize: 16, color: colors.ink, textAlignVertical: "top" },
});
