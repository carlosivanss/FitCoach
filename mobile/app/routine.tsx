import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

type ExerciseRow = { id: number; day_of_week: number; sets: number; reps_min: number | null; reps_max: number | null; rest_seconds: number; order_index: number; fc_exercises: { name: string; muscle_group: string } | { name: string; muscle_group: string }[] };
type LogValue = { reps: string; weight: string; done: boolean };
type RoutineOption = { id: number; name: string; client_id: number; days_per_week: number; updated_at: string };
const DAY_NAMES = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function RoutineScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routines, setRoutines] = useState<RoutineOption[]>([]);
  const [routine, setRoutine] = useState<RoutineOption | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [currentDay, setCurrentDay] = useState(1);
  const [logs, setLogs] = useState<Record<string, LogValue>>({});
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);

  useEffect(() => { void loadRoutine(); }, []);

  async function loadRoutine() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/login");
    const { data: client } = await supabase.from("fc_clients").select("id").eq("user_id", user.id).single();
    if (!client) { setLoading(false); return; }
    const { data: activeRoutines, error } = await supabase.from("fc_routines").select("id, name, client_id, days_per_week, updated_at").eq("client_id", client.id).is("archived_at", null).order("updated_at", { ascending: false });
    if (error) Alert.alert("No se pudieron cargar las rutinas", error.message);
    const options = (activeRoutines ?? []) as RoutineOption[];
    setRoutines(options); setLoading(false);
    if (options.length === 1) await chooseRoutine(options[0]);
  }

  async function chooseRoutine(selected: RoutineOption) {
    setLoading(true);
    const { data: rows, error } = await supabase.from("fc_routine_exercises").select("id, day_of_week, sets, reps_min, reps_max, rest_seconds, order_index, fc_exercises(name, muscle_group)").eq("routine_id", selected.id).order("day_of_week").order("order_index");
    if (error) Alert.alert("No se pudo cargar la rutina", error.message);
    const exerciseRows = (rows ?? []) as ExerciseRow[];
    const initial: Record<string, LogValue> = {};
    exerciseRows.forEach((exercise) => Array.from({ length: exercise.sets }, (_, index) => { initial[`${exercise.id}-${index + 1}`] = { reps: String(exercise.reps_max ?? exercise.reps_min ?? ""), weight: "", done: false }; }));
    setRoutine(selected); setExercises(exerciseRows); setLogs(initial); setCurrentDay(exerciseRows[0]?.day_of_week ?? 1); setStartedAt(new Date()); setLoading(false);
  }

  useEffect(() => {
    if (restRemaining <= 0) return;
    const timer = setInterval(() => setRestRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [restRemaining > 0]);

  function update(key: string, patch: Partial<LogValue>) { setLogs((current) => ({ ...current, [key]: { ...current[key], ...patch } })); }

  function toggleSet(key: string, exercise: ExerciseRow) {
    const willComplete = !logs[key]?.done;
    update(key, { done: willComplete });
    if (willComplete && exercise.rest_seconds > 0) setRestRemaining(exercise.rest_seconds);
  }

  async function finishWorkout() {
    if (!routine) return;
    const currentIds = new Set(exercises.filter((item) => item.day_of_week === currentDay).map((item) => item.id));
    const completedLogs = Object.entries(logs).filter(([key, value]) => currentIds.has(Number(key.split("-")[0])) && value.done);
    if (!completedLogs.length) return Alert.alert("Falta completar series", "Marca al menos una serie antes de finalizar.");
    const invalid = completedLogs.some(([, value]) => !Number.isInteger(Number(value.reps)) || Number(value.reps) < 0 || Number(value.reps) > 500 || (value.weight.trim() !== "" && (!Number.isFinite(Number(value.weight.replace(",", "."))) || Number(value.weight.replace(",", ".")) < 0)));
    if (invalid) return Alert.alert("Revisa las series", "Las repeticiones deben ser números enteros y el peso no puede ser negativo.");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return router.replace("/login"); }
    const completedAt = new Date();
    const beganAt = startedAt ?? completedAt;
    const rows = completedLogs.map(([key, value]) => { const [routineExerciseId, setNumber] = key.split("-").map(Number); return { routine_exercise_id: routineExerciseId, set_number: setNumber, reps_completed: Number(value.reps), weight: value.weight.trim() ? Number(value.weight.replace(",", ".")) : null }; });
    const { error: completeError } = await supabase.rpc("fc_complete_my_workout", { p_routine_id: routine.id, p_day_of_week: currentDay, p_started_at: beganAt.toISOString(), p_completed_at: completedAt.toISOString(), p_sets: rows });
    setSaving(false);
    if (completeError) return Alert.alert("No se guardó el entrenamiento", completeError.message);
    Alert.alert("¡Entrenamiento completado!", "Tus pesos y repeticiones ya cuentan para tu progreso.", [{ text: "Ver inicio", onPress: () => router.replace("/") }]);
  }

  if (loading) return <SafeAreaView style={[s.safe, s.center]}><ActivityIndicator size="large" color="#17191c" /></SafeAreaView>;
  if (!routines.length) return <SafeAreaView style={[s.safe, s.center]}><Text style={s.title}>Sin rutina asignada</Text><Text style={s.meta}>Tu nutriólogo está preparando tu plan.</Text><Pressable onPress={() => router.back()}><Text style={s.link}>Volver</Text></Pressable></SafeAreaView>;
  if (!routine) return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page}><Pressable onPress={() => router.back()}><Text style={s.link}>‹ Volver</Text></Pressable><View><Text style={s.title}>Elige una rutina</Text><Text style={s.meta}>Selecciona el plan que entrenarás hoy.</Text></View>{routines.map((item)=><Pressable key={item.id} style={s.routineChoice} onPress={()=>void chooseRoutine(item)}><View><Text style={s.exerciseTitle}>{item.name}</Text><Text style={s.meta}>{item.days_per_week} días por semana</Text></View><Text style={s.choiceArrow}>›</Text></Pressable>)}</ScrollView></SafeAreaView>;
  const days = [...new Set(exercises.map((exercise) => exercise.day_of_week))];
  const visibleExercises = exercises.filter((exercise) => exercise.day_of_week === currentDay);
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"><Pressable onPress={() => setRoutine(null)}><Text style={s.link}>‹ Cambiar rutina</Text></Pressable><View><Text style={s.title}>{routine.name}</Text><Text style={s.meta}>Día {currentDay} · {visibleExercises.length} ejercicios</Text></View>{restRemaining>0?<View style={s.timer}><View><Text style={s.timerLabel}>Descanso</Text><Text style={s.timerValue}>{Math.floor(restRemaining/60)}:{String(restRemaining%60).padStart(2,"0")}</Text></View><Pressable onPress={()=>setRestRemaining(0)}><Text style={s.timerSkip}>Omitir</Text></Pressable></View>:null}<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayTabs}>{days.map((day)=><Pressable key={day} onPress={()=>setCurrentDay(day)} style={[s.dayTab,currentDay===day&&s.dayTabActive]}><Text style={[s.dayText,currentDay===day&&s.dayTextActive]}>Día {day}</Text></Pressable>)}</ScrollView>{visibleExercises.map((exercise) => { const detail = Array.isArray(exercise.fc_exercises) ? exercise.fc_exercises[0] : exercise.fc_exercises; return <View style={s.exerciseCard} key={exercise.id}><Text style={s.exerciseTitle}>{detail?.name ?? "Ejercicio"}</Text><Text style={s.meta}>{detail?.muscle_group ?? ""} · descanso {exercise.rest_seconds} s</Text><View style={s.headers}><Text style={s.head}>Serie</Text><Text style={s.head}>Reps</Text><Text style={s.head}>Peso kg</Text><Text style={s.head}>Lista</Text></View>{Array.from({ length: exercise.sets }, (_, index) => { const key = `${exercise.id}-${index + 1}`; const value = logs[key]; return <View style={s.set} key={key}><Text style={s.number}>{index + 1}</Text><TextInput style={s.input} keyboardType="number-pad" value={value?.reps ?? ""} onChangeText={(reps) => update(key, { reps })} /><TextInput style={s.input} keyboardType="decimal-pad" placeholder="0" value={value?.weight ?? ""} onChangeText={(weight) => update(key, { weight })} /><Pressable style={[s.check, value?.done && s.checked]} onPress={() => toggleSet(key, exercise)}><Text style={s.checkText}>{value?.done ? "✓" : ""}</Text></Pressable></View>; })}</View>; })}<Pressable disabled={saving} style={[s.primary, saving && s.disabled]} onPress={finishWorkout}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Finalizar día {currentDay}</Text>}</Pressable></ScrollView></SafeAreaView>;
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#f4f5f7"},center:{alignItems:"center",justifyContent:"center",gap:18,padding:24},page:{padding:20,gap:18},link:{fontWeight:"700",color:"#5b6470"},title:{fontSize:30,fontWeight:"900",marginTop:8},meta:{color:"#737984",marginTop:4,textTransform:"capitalize"},routineChoice:{backgroundColor:"white",borderRadius:20,padding:20,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},choiceArrow:{fontSize:32,color:"#6c5ce7"},timer:{backgroundColor:"#6c5ce7",borderRadius:18,padding:17,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},timerLabel:{color:"#ded9ff",fontSize:12,fontWeight:"700"},timerValue:{color:"white",fontSize:28,fontWeight:"900",marginTop:2},timerSkip:{color:"white",fontWeight:"800",padding:10},dayTabs:{gap:9},dayTab:{paddingVertical:10,paddingHorizontal:16,borderRadius:999,backgroundColor:"#e5e7eb"},dayTabActive:{backgroundColor:"#17191c"},dayText:{fontWeight:"800",color:"#5f6670"},dayTextActive:{color:"white"},exerciseCard:{backgroundColor:"white",borderRadius:20,padding:17,gap:12},exerciseTitle:{fontSize:21,fontWeight:"900"},headers:{flexDirection:"row",justifyContent:"space-between",paddingTop:8},head:{fontSize:11,color:"#777d87",textTransform:"uppercase"},set:{flexDirection:"row",alignItems:"center",gap:10},number:{width:28,fontWeight:"800",textAlign:"center"},input:{flex:1,backgroundColor:"#f2f3f6",padding:12,borderRadius:11,textAlign:"center"},check:{width:42,height:42,borderRadius:11,borderWidth:1,borderColor:"#d7dae0",alignItems:"center",justifyContent:"center"},checked:{backgroundColor:"#17191c"},checkText:{color:"white",fontWeight:"900"},primary:{backgroundColor:"#17191c",minHeight:54,borderRadius:15,alignItems:"center",justifyContent:"center",marginTop:4},disabled:{opacity:.55},primaryText:{color:"white",fontWeight:"800",fontSize:16}});
