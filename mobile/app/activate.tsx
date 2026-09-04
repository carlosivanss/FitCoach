import { useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";

export default function ActivateScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function activate() {
    setError("");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return setError("La invitación expiró. Solicita una nueva."); }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setBusy(false); return setError(updateError.message); }
    const { data: profile } = await supabase.from("fc_profiles").select("role").eq("user_id", user.id).single();
    setBusy(false);
    if (profile?.role !== "patient") return setError("Esta cuenta no está vinculada con un paciente.");
    router.replace("/");
  }

  return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={s.brand}><Text style={s.brandText}>F</Text></View>
    <Text style={s.title}>Activa tu cuenta</Text>
    <Text style={s.subtitle}>Crea una contraseña para entrar a tus rutinas y registrar tu progreso.</Text>
    <View style={s.card}>
      <Text style={s.label}>Nueva contraseña</Text><TextInput style={s.input} secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword}/>
      <Text style={s.label}>Confirmar contraseña</Text><TextInput style={s.input} secureTextEntry autoCapitalize="none" value={confirm} onChangeText={setConfirm}/>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Pressable disabled={busy} onPress={activate} style={[s.button,busy&&s.disabled]}>{busy?<ActivityIndicator color="#fff"/>:<Text style={s.buttonText}>Activar cuenta</Text>}</Pressable>
    </View>
  </KeyboardAvoidingView></SafeAreaView>;
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#f4f5f7"},page:{flex:1,justifyContent:"center",padding:26},brand:{width:54,height:54,borderRadius:17,backgroundColor:"#6c5ce7",alignItems:"center",justifyContent:"center",marginBottom:18},brandText:{color:"white",fontSize:24,fontWeight:"900"},title:{fontSize:32,fontWeight:"900",color:"#17191c"},subtitle:{color:"#68707c",fontSize:15,lineHeight:22,marginTop:8,marginBottom:24},card:{backgroundColor:"white",borderRadius:22,padding:20,gap:9},label:{color:"#333741",fontSize:13,fontWeight:"700",marginTop:3},input:{borderWidth:1,borderColor:"#dfe2e8",borderRadius:12,paddingHorizontal:14,paddingVertical:13,fontSize:16,marginBottom:7},error:{color:"#c9364f",fontSize:13},button:{minHeight:50,borderRadius:13,backgroundColor:"#17191c",alignItems:"center",justifyContent:"center",marginTop:8},disabled:{opacity:.55},buttonText:{color:"white",fontSize:15,fontWeight:"800"}});
