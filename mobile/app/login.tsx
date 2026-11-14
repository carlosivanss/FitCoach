import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const { linkError } = useLocalSearchParams<{ linkError?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function signIn() {
    setBusy(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError || !data.user) {
      setBusy(false);
      setError("Correo o contraseña incorrectos.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("fc_profiles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    if (profileError || profile?.role !== "patient") {
      await supabase.auth.signOut();
      setBusy(false);
      setError("Esta aplicación es exclusiva para pacientes.");
      return;
    }

    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.brand}>
          <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>FitCoach</Text>
          <Text style={styles.subtitle}>Tu plataforma de entrenamiento</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="example@gmail.com" placeholderTextColor="#a3a5ab" style={styles.input} value={email} />
          <Text style={styles.label}>Contraseña</Text>
          <View>
            <TextInput autoCapitalize="none" autoComplete="current-password" onChangeText={setPassword} placeholder="Tu contraseña" placeholderTextColor="#a3a5ab" secureTextEntry={!show} style={[styles.input, { paddingRight: 52 }]} value={password} />
            <Pressable accessibilityLabel={show ? "Ocultar contraseña" : "Mostrar contraseña"} hitSlop={10} onPress={() => setShow(!show)} style={styles.eye}><Text style={{ fontSize: 18 }}>{show ? "🙈" : "👁"}</Text></Pressable>
          </View>
          <Pressable style={{ alignSelf: "flex-end" }} onPress={() => router.push("/recover" as never)}><Text style={styles.recover}>Olvidaste tu contraseña?</Text></Pressable>
          {error || linkError ? <Text style={styles.error}>{error || linkError}</Text> : null}
        </View>
        <Pressable disabled={busy || !email || !password} onPress={signIn} style={({ pressed }) => [styles.button, (pressed || busy || !email || !password) && styles.buttonPressed]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>
        <Text style={styles.help}>Tu nutriólogo debe crear tu cuenta antes de iniciar sesión.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  page: { flex: 1, justifyContent: "center", padding: 24, gap: 22 },
  brand: { alignItems: "center", gap: 6 },
  logo: { width: 120, height: 120 },
  title: { color: "#111113", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#6f7178", fontSize: 12 },
  form: { gap: 8 },
  label: { color: "#6f7178", fontSize: 11, letterSpacing: 1.2, fontWeight: "600", textTransform: "uppercase", marginTop: 6 },
  input: { backgroundColor: "#f1f1f3", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#111113" },
  eye: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  error: { color: "#c9364f", fontSize: 13, marginTop: 4 },
  button: { minHeight: 54, borderRadius: 999, backgroundColor: "#111113", alignItems: "center", justifyContent: "center" },
  buttonPressed: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  recover: { color: "#111113", fontSize: 12, fontWeight: "600", paddingVertical: 6 },
  help: { color: "#a3a5ab", fontSize: 12, lineHeight: 18, textAlign: "center" },
});
