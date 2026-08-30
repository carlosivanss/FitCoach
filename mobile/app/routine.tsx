import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

type ExerciseRow = { id: number; day_of_week: number; sets: number; reps_min: number | null; reps_max: number | null; rest_seconds: number; order_index: number; fc_exercises: { name: string; muscle_group: string } | { name: string; muscle_group: string }[] };
type LogValue = { reps: string; weight: string; done: boolean };

export default function RoutineScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routine, setRoutine] = useState<{ id: number; name: string; client_id: number } | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [currentDay, setCurrentDay] = useState(1);
  const [logs, setLogs] = useState<Record<string, LogValue>>({});
  const startedAt = useMemo(() => new Date(), []);

  useEffect(() => { void loadRoutine(); }, []);

  async function loadRoutine() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/login");
    const { data: client } = await supabase.from("fc_clients").select("id").eq("user_id", user.id).single();
    if (!client) { setLoading(false); return; }
    const { data: activeRoutine } = await supabase.from("fc_routines").select("id, name, client_id").eq("client_id", client.id).is("archived_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!activeRoutine) { setLoading(false); return; }
    const { data: rows, error } = await supabase.from("fc_routine_exercises").select("id, day_of_week, sets, reps_min, reps_max, rest_seconds, order_index, fc_exercises(name, muscle_group)").eq("routine_id", activeRoutine.id).order("day_of_week").order("order_index");
    if (error) Alert.alert("No se pudo cargar la rutina", error.message);
    const exerciseRows = (rows ?? []) as ExerciseRow[];
    const initial: Record<string, LogValue> = {};
    exerciseRows.forEach((exercise) => Array.from({ length: exercise.sets }, (_, index) => { initial[`${exercise.id}-${index + 1}`] = { reps: String(exercise.reps_max ?? exercise.reps_min ?? ""), weight: "", done: false }; }));
    setRoutine(activeRoutine); setExercises(exerciseRows); setLogs(initial); setCurrentDay(exerciseRows[0]?.day_of_week ?? 1); setLoading(false);
  }

  function update(key: string, patch: Partial<LogValue>) { setLogs((current) => ({ ...current, [key]: { ...current[key], ...patch } })); }

  async function finishWorkout() {
    if (!routine) return;
    const completedLogs = Object.entries(logs).filter(([, value]) => value.done);
    if (!completedLogs.length) return Alert.alert("Falta completar series", "Marca al menos una serie antes de finalizar.");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return router.replace("/login"); }
    const completedAt = new Date();
    const { data: session, error: sessionError } = await supabase.from("fc_workout_sessions").insert({ routine_id: routine.id, client_id: routine.client_id, recorded_by: user.id, status: "completed", started_at: startedAt.toISOString(), completed_at: completedAt.toISOString(), duration_seconds: Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)) }).select("id").single();
    if (sessionError || !session) { setSaving(false); return Alert.alert("No se guardó la sesión", sessionError?.message ?? "Intenta nuevamente."); }
    const rows = completedLogs.map(([key, value]) => { const [routineExerciseId, setNumber] = key.split("-").map(Number); return { session_id: session.id, routine_exercise_id: routineExerciseId, set_number: setNumber, reps_completed: value.reps ? Number(value.reps) : null, weight: value.weight ? Number(value.weight.replace(",", ".")) : null, weight_unit: "kg", completed_at: completedAt.toISOString() }; });
    const { error } = await supabase.from("fc_set_logs").insert(rows);
    setSaving(false);
    if (error) return Alert.alert("Sesión creada con series pendientes", error.message);
    Alert.alert("¡Entrenamiento completado!", "Tus pesos y repeticiones ya cuentan para tu progreso.", [{ text: "Ver inicio", onPress: () => router.replace("/") }]);
  }

  if (loading) return <SafeAreaView style={[s.safe, s.center]}><ActivityIndicator size="large" color="#17191c" /></SafeAreaView>;
  if (!routine) return <SafeAreaView style={[s.safe, s.center]}><Text style={s.title}>Sin rutina asignada</Text><Pressable onPress={() => router.back()}><Text style={s.link}>Volver</Text></Pressable></SafeAreaView>;
  const days = [...new Set(exercises.map((exercise) => exercise.day_of_week))];
  const visibleExercises = exercises.filter((exercise) => exercise.day_of_week === currentDay);
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"><Pressable onPress={() => router.back()}><Text style={s.link}>‹ Volver</Text></Pressable><View><Text style={s.title}>{routine.name}</Text><Text style={s.meta}>Día {currentDay} · {visibleExercises.length} ejercicios</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayTabs}>{days.map((day)=><Pressable key={day} onPress={()=>setCurrentDay(day)} style={[s.dayTab,currentDay===day&&s.dayTabActive]}><Text style={[s.dayText,currentDay===day&&s.dayTextActive]}>Día {day}</Text></Pressable>)}</ScrollView>{visibleExercises.map((exercise) => { const detail = Array.isArray(exercise.fc_exercises) ? exercise.fc_exercises[0] : exercise.fc_exercises; return <View style={s.exerciseCard} key={exercise.id}><Text style={s.exerciseTitle}>{detail?.name ?? "Ejercicio"}</Text><Text style={s.meta}>{detail?.muscle_group ?? ""} · descanso {exercise.rest_seconds} s</Text><View style={s.headers}><Text style={s.head}>Serie</Text><Text style={s.head}>Reps</Text><Text style={s.head}>Peso kg</Text><Text style={s.head}>Lista</Text></View>{Array.from({ length: exercise.sets }, (_, index) => { const key = `${exercise.id}-${index + 1}`; const value = logs[key]; return <View style={s.set} key={key}><Text style={s.number}>{index + 1}</Text><TextInput style={s.input} keyboardType="number-pad" value={value?.reps ?? ""} onChangeText={(reps) => update(key, { reps })} /><TextInput style={s.input} keyboardType="decimal-pad" placeholder="0" value={value?.weight ?? ""} onChangeText={(weight) => update(key, { weight })} /><Pressable style={[s.check, value?.done && s.checked]} onPress={() => update(key, { done: !value?.done })}><Text style={s.checkText}>{value?.done ? "✓" : ""}</Text></Pressable></View>; })}</View>; })}<Pressable disabled={saving} style={[s.primary, saving && s.disabled]} onPress={finishWorkout}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Finalizar día {currentDay}</Text>}</Pressable></ScrollView></SafeAreaView>;
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#f4f5f7"},center:{alignItems:"center",justifyContent:"center",gap:18},page:{padding:20,gap:18},link:{fontWeight:"700",color:"#5b6470"},title:{fontSize:30,fontWeight:"900",marginTop:8},meta:{color:"#737984",marginTop:4,textTransform:"capitalize"},dayTabs:{gap:9},dayTab:{paddingVertical:10,paddingHorizontal:16,borderRadius:999,backgroundColor:"#e5e7eb"},dayTabActive:{backgroundColor:"#17191c"},dayText:{fontWeight:"800",color:"#5f6670"},dayTextActive:{color:"white"},exerciseCard:{backgroundColor:"white",borderRadius:20,padding:17,gap:12},exerciseTitle:{fontSize:21,fontWeight:"900"},headers:{flexDirection:"row",justifyContent:"space-between",paddingTop:8},head:{fontSize:11,color:"#777d87",textTransform:"uppercase"},set:{flexDirection:"row",alignItems:"center",gap:10},number:{width:28,fontWeight:"800",textAlign:"center"},input:{flex:1,backgroundColor:"#f2f3f6",padding:12,borderRadius:11,textAlign:"center"},check:{width:42,height:42,borderRadius:11,borderWidth:1,borderColor:"#d7dae0",alignItems:"center",justifyContent:"center"},checked:{backgroundColor:"#17191c"},checkText:{color:"white",fontWeight:"900"},primary:{backgroundColor:"#17191c",minHeight:54,borderRadius:15,alignItems:"center",justifyContent:"center",marginTop:4},disabled:{opacity:.55},primaryText:{color:"white",fontWeight:"800",fontSize:16}});
