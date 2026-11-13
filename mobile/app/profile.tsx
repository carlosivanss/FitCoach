import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

type ProfileForm = { full_name: string; phone: string; experience_level: string; preferred_units: string };

export default function ProfileScreen() {
  const [form, setForm] = useState<ProfileForm>({ full_name: "", phone: "", experience_level: "beginner", preferred_units: "kg" });
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, []);
  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/login");
    const [{ data: profile, error: profileError }, { data: client, error: clientError }] = await Promise.all([
      supabase.from("fc_profiles").select("full_name, phone, experience_level, preferred_units").eq("user_id", user.id).single(),
      supabase.from("fc_clients").select("birth_date").eq("user_id", user.id).single(),
    ]);
    if (profileError || clientError) Alert.alert("No se pudo cargar el perfil", profileError?.message ?? clientError?.message);
    if (profile) setForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "", experience_level: profile.experience_level ?? "beginner", preferred_units: profile.preferred_units ?? "kg" });
    setEmail(user.email ?? ""); setBirthDate(client?.birth_date ?? null); setLoading(false);
  }

  async function save() {
    if (form.full_name.trim().length < 2) return Alert.alert("Revisa tu nombre", "Escribe al menos dos caracteres.");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return router.replace("/login"); }
    const { error } = await supabase.rpc("fc_update_my_profile", { p_full_name: form.full_name.trim(), p_phone: form.phone.trim() || null, p_experience_level: form.experience_level, p_preferred_units: form.preferred_units });
    setSaving(false);
    if (error) return Alert.alert("No se guardó el perfil", error.message);
    Alert.alert("Perfil actualizado", "Tus cambios se guardaron correctamente.");
  }

  if (loading) return <SafeAreaView style={[s.safe,s.center]}><ActivityIndicator size="large" color="#17191c" /></SafeAreaView>;
  return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Pressable onPress={()=>router.back()}><Text style={s.link}>‹ Volver</Text></Pressable><View><Text style={s.title}>Mi perfil</Text><Text style={s.meta}>Tu fecha de nacimiento proviene del expediente y no necesitas capturarla otra vez.</Text></View>
    <View style={s.card}><Field label="Nombre completo" value={form.full_name} onChange={value=>setForm({...form,full_name:value})}/><Field label="Teléfono" value={form.phone} onChange={value=>setForm({...form,phone:value})} keyboard="phone-pad"/><View style={s.readonly}><Text style={s.label}>Correo</Text><Text style={s.value}>{email}</Text></View><View style={s.readonly}><Text style={s.label}>Fecha de nacimiento</Text><Text style={s.value}>{birthDate||"No registrada"}</Text></View></View>
    <View style={s.card}><Text style={s.section}>Preferencias</Text><Text style={s.label}>Experiencia</Text><View style={s.options}>{[["beginner","Principiante"],["intermediate","Intermedio"],["advanced","Avanzado"]].map(([value,label])=><Pressable key={value} onPress={()=>setForm({...form,experience_level:value})} style={[s.option,form.experience_level===value&&s.optionActive]}><Text style={[s.optionText,form.experience_level===value&&s.optionTextActive]}>{label}</Text></Pressable>)}</View><Text style={s.label}>Unidades</Text><View style={s.options}>{["kg","lb"].map(value=><Pressable key={value} onPress={()=>setForm({...form,preferred_units:value})} style={[s.option,form.preferred_units===value&&s.optionActive]}><Text style={[s.optionText,form.preferred_units===value&&s.optionTextActive]}>{value.toUpperCase()}</Text></Pressable>)}</View></View>
    <Pressable disabled={saving} onPress={save} style={[s.primary,saving&&s.disabled]}>{saving?<ActivityIndicator color="#fff"/>:<Text style={s.primaryText}>Guardar cambios</Text>}</Pressable>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function Field({label,value,onChange,keyboard="default"}:{label:string;value:string;onChange:(value:string)=>void;keyboard?:"default"|"phone-pad"}) { return <View><Text style={s.label}>{label}</Text><TextInput style={s.input} value={value} onChangeText={onChange} keyboardType={keyboard}/></View>; }
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#f4f5f7"},flex:{flex:1},center:{alignItems:"center",justifyContent:"center"},page:{padding:20,gap:18},link:{fontWeight:"700",color:"#5b6470"},title:{fontSize:30,fontWeight:"900",color:"#17191c"},meta:{color:"#737984",lineHeight:20,marginTop:5},card:{backgroundColor:"white",borderRadius:20,padding:18,gap:14},section:{fontSize:18,fontWeight:"900"},label:{fontSize:12,fontWeight:"700",color:"#555c66",marginBottom:6},input:{backgroundColor:"#f1f2f5",borderRadius:12,padding:13,fontSize:16,color:"#17191c"},readonly:{borderBottomWidth:1,borderBottomColor:"#eceef2",paddingBottom:11},value:{fontSize:15,color:"#17191c"},options:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:5},option:{paddingVertical:10,paddingHorizontal:13,borderRadius:999,backgroundColor:"#e5e7eb"},optionActive:{backgroundColor:"#6c5ce7"},optionText:{fontWeight:"800",color:"#5f6670",fontSize:12},optionTextActive:{color:"white"},primary:{backgroundColor:"#17191c",minHeight:54,borderRadius:15,alignItems:"center",justifyContent:"center"},disabled:{opacity:.55},primaryText:{color:"white",fontWeight:"800",fontSize:16}});
