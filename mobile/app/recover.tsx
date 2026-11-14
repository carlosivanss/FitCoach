import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { BackHeader, Button, Input, Label, Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";

export default function Recover() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setMsg("Escribe un correo válido.");
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: "fitcoach://activate?flow=recovery" });
    setBusy(false);
    // Mensaje neutro: no revela si el correo está registrado.
    setMsg(error && error.status !== 400 ? error.message : "Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.");
  }
  return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <BackHeader title="Recupera tu cuenta" subtitle="Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña." />
    <View style={s.body}>
      <View><Label>Correo electrónico</Label><Input autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="example@gmail.com" /></View>
      {msg ? <Text style={s.msg}>{msg}</Text> : null}
      <Button label="Enviar enlace" busy={busy} disabled={!email} onPress={send} />
      <Pressable onPress={() => router.back()}><Text style={s.link}>¿Recordaste tu contraseña? Inicia sesión</Text></Pressable>
    </View>
  </KeyboardAvoidingView></Screen>;
}
const s = StyleSheet.create({ body: { padding: 22, gap: 20, marginTop: 10 }, msg: { color: colors.muted, fontSize: 13, lineHeight: 19 }, link: { textAlign: "center", color: colors.muted, fontSize: 13, lineHeight: 20 } });
