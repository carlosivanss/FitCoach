import { useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function recoverPassword() {
    if (!email.trim()) {
      setError("Escribe primero tu correo electrónico.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    setError(resetError ? resetError.message : "Revisa tu correo para cambiar la contraseña.");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.brandMark}><Text style={styles.brandIcon}>F</Text></View>
        <Text style={styles.title}>FitCoach</Text>
        <Text style={styles.subtitle}>Tu entrenamiento y progreso en un solo lugar.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="correo@ejemplo.com"
            style={styles.input}
            value={email}
          />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="current-password"
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            disabled={busy || !email || !password}
            onPress={signIn}
            style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
          </Pressable>
          <Pressable disabled={busy} onPress={recoverPassword}><Text style={styles.recover}>¿Olvidaste tu contraseña?</Text></Pressable>
        </View>
        <Text style={styles.help}>Tu nutriólogo debe crear tu cuenta antes de iniciar sesión.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f5f7" },
  page: { flex: 1, justifyContent: "center", padding: 26 },
  brandMark: { width: 54, height: 54, borderRadius: 17, backgroundColor: "#6c5ce7", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  brandIcon: { color: "#fff", fontSize: 24, fontWeight: "900" },
  title: { color: "#17191c", fontSize: 36, fontWeight: "900", letterSpacing: -1.2 },
  subtitle: { color: "#68707c", fontSize: 15, lineHeight: 22, marginTop: 7, marginBottom: 30 },
  form: { backgroundColor: "#fff", borderRadius: 22, padding: 20, gap: 9 },
  label: { color: "#333741", fontSize: 13, fontWeight: "700", marginTop: 3 },
  input: { borderWidth: 1, borderColor: "#dfe2e8", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, marginBottom: 7 },
  error: { color: "#c9364f", fontSize: 13, marginVertical: 3 },
  button: { minHeight: 50, borderRadius: 13, backgroundColor: "#17191c", alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonPressed: { opacity: 0.72 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  recover: { color: "#6c5ce7", fontSize: 13, fontWeight: "700", textAlign: "center", padding: 8 },
  help: { color: "#838996", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 22 },
});
