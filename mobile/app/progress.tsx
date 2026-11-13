import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

type Measurement = { id: number; measured_on: string; weight_kg: number | null; body_fat_percent: number | null; muscle_mass_kg: number | null; waist_cm: number | null };

export default function ProgressScreen() {
  const [clientId, setClientId] = useState<number | null>(null);
  const [items, setItems] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [measuredOn] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [muscle, setMuscle] = useState("");
  const [waist, setWaist] = useState("");

  useEffect(() => { void load(); }, []);
  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/login");
    const { data: client } = await supabase.from("fc_clients").select("id").eq("user_id", user.id).single();
    if (!client) { setLoading(false); return; }
    setClientId(client.id);
    const { data, error } = await supabase.from("fc_body_measurements").select("id, measured_on, weight_kg, body_fat_percent, muscle_mass_kg, waist_cm").eq("client_id", client.id).order("measured_on", { ascending: false }).limit(12);
    if (error) Alert.alert("No se pudo cargar el progreso", error.message);
    setItems((data ?? []) as Measurement[]); setLoading(false);
  }
  function numberOrNull(value: string) { return value.trim() ? Number(value.replace(",", ".")) : null; }
  async function save() {
    if (!clientId || ![weight, fat, muscle, waist].some((value) => value.trim())) return Alert.alert("Agrega una medida", "Captura al menos un dato para guardar.");
    const values = [weight, fat, muscle, waist].filter(Boolean).map(numberOrNull);
    if (values.some((value) => value !== null && !Number.isFinite(value))) return Alert.alert("Revisa los datos", "Utiliza solamente números.");
    const parsed = { weight: numberOrNull(weight), fat: numberOrNull(fat), muscle: numberOrNull(muscle), waist: numberOrNull(waist) };
    if (parsed.weight !== null && (parsed.weight < 10 || parsed.weight > 700)) return Alert.alert("Revisa el peso", "Debe estar entre 10 y 700 kg.");
    if (parsed.fat !== null && (parsed.fat < 0 || parsed.fat > 100)) return Alert.alert("Revisa la grasa corporal", "Debe estar entre 0 y 100%.");
    if (parsed.muscle !== null && (parsed.muscle < 0 || parsed.muscle > 500)) return Alert.alert("Revisa la masa muscular", "Debe estar entre 0 y 500 kg.");
    if (parsed.waist !== null && (parsed.waist < 20 || parsed.waist > 400)) return Alert.alert("Revisa la cintura", "Debe estar entre 20 y 400 cm.");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return router.replace("/login"); }
    const { error } = await supabase.rpc("fc_record_my_body_measurement", { p_measured_on: measuredOn, p_weight_kg: parsed.weight, p_body_fat_percent: parsed.fat, p_muscle_mass_kg: parsed.muscle, p_waist_cm: parsed.waist, p_notes: null });
    setSaving(false);
    if (error) return Alert.alert("No se guardaron las medidas", error.message);
    setWeight(""); setFat(""); setMuscle(""); setWaist(""); await load();
    Alert.alert("Medición guardada", "Tu progreso ya está actualizado.");
  }
  const weights = items.filter((item) => item.weight_kg !== null).slice(0, 7).reverse();
  const maxWeight = Math.max(...weights.map((item) => Number(item.weight_kg)), 1);
  if (loading) return <SafeAreaView style={[s.safe,s.center]}><ActivityIndicator size="large" color="#17191c" /></SafeAreaView>;
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"><Pressable onPress={() => router.back()}><Text style={s.link}>‹ Volver</Text></Pressable><View><Text style={s.title}>Mi progreso</Text><Text style={s.meta}>Registra tus medidas para observar cambios con el tiempo.</Text></View><View style={s.card}><Text style={s.sectionTitle}>Nueva medición</Text><View style={s.grid}><Field label="Peso (kg)" value={weight} onChange={setWeight} /><Field label="Grasa corporal (%)" value={fat} onChange={setFat} /><Field label="Masa muscular (kg)" value={muscle} onChange={setMuscle} /><Field label="Cintura (cm)" value={waist} onChange={setWaist} /></View><Pressable disabled={saving} style={[s.primary,saving&&s.disabled]} onPress={save}>{saving?<ActivityIndicator color="#fff"/>:<Text style={s.primaryText}>Guardar medición</Text>}</Pressable></View><View style={s.card}><Text style={s.sectionTitle}>Evolución de peso</Text>{weights.length ? <View style={s.bars}>{weights.map((item) => <View style={s.barColumn} key={item.id}><View style={[s.bar,{height:Math.max(12,(Number(item.weight_kg)/maxWeight)*110)}]} /><Text style={s.barValue}>{item.weight_kg}</Text><Text style={s.barDate}>{item.measured_on.slice(5)}</Text></View>)}</View> : <Text style={s.empty}>Todavía no hay registros de peso.</Text>}</View><View style={s.card}><Text style={s.sectionTitle}>Historial reciente</Text>{items.length ? items.map((item) => <View style={s.history} key={item.id}><Text style={s.historyDate}>{item.measured_on}</Text><Text style={s.historyValues}>{item.weight_kg ? `${item.weight_kg} kg` : ""}{item.body_fat_percent ? ` · ${item.body_fat_percent}% grasa` : ""}{item.muscle_mass_kg ? ` · ${item.muscle_mass_kg} kg músculo` : ""}{item.waist_cm ? ` · ${item.waist_cm} cm cintura` : ""}</Text></View>) : <Text style={s.empty}>Tu historial aparecerá aquí.</Text>}</View></ScrollView></SafeAreaView>;
}

function Field({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}) { return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput style={s.input} keyboardType="decimal-pad" placeholder="—" value={value} onChangeText={onChange}/></View>; }
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#f4f5f7"},center:{alignItems:"center",justifyContent:"center"},page:{padding:20,gap:18},link:{fontWeight:"700",color:"#5b6470"},title:{fontSize:30,fontWeight:"900",marginTop:8},meta:{color:"#737984",lineHeight:20,marginTop:5},card:{backgroundColor:"white",borderRadius:20,padding:18,gap:16},sectionTitle:{fontSize:18,fontWeight:"900"},grid:{flexDirection:"row",flexWrap:"wrap",gap:10},field:{width:"48%",gap:6},label:{fontSize:12,fontWeight:"700",color:"#555c66"},input:{backgroundColor:"#f1f2f5",borderRadius:12,padding:13,fontSize:17},primary:{backgroundColor:"#17191c",minHeight:50,borderRadius:13,alignItems:"center",justifyContent:"center"},primaryText:{color:"white",fontWeight:"800"},disabled:{opacity:.55},bars:{height:165,flexDirection:"row",alignItems:"flex-end",justifyContent:"space-around",gap:7},barColumn:{flex:1,alignItems:"center",gap:4},bar:{width:"75%",backgroundColor:"#6c5ce7",borderRadius:7},barValue:{fontSize:10,fontWeight:"800"},barDate:{fontSize:9,color:"#858b95"},empty:{color:"#7a818c",textAlign:"center",paddingVertical:20},history:{borderTopWidth:1,borderTopColor:"#eceef2",paddingTop:12},historyDate:{fontSize:12,fontWeight:"800"},historyValues:{color:"#68707c",fontSize:12,marginTop:4,lineHeight:18}});
