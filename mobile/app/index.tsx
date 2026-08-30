import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { supabase } from "@/lib/supabase";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Paciente");
  const [hasRoutine, setHasRoutine] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [weight, setWeight] = useState<string>("—");
  const [completion, setCompletion] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const [{ data: profile }, { data: client }] = await Promise.all([
        supabase.from("fc_profiles").select("full_name, role").eq("user_id", user.id).single(),
        supabase.from("fc_clients").select("id, full_name").eq("user_id", user.id).single(),
      ]);

      if (profile?.role !== "patient") {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      const clientName = client?.full_name || profile.full_name || "Paciente";
      setName(clientName.split(" ")[0]);

      if (client?.id) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const [{ data: routine }, { data: measurement }, { count: completedCount }] = await Promise.all([
          supabase
          .from("fc_routines")
          .select("id, name, days_per_week")
          .eq("client_id", client.id)
          .is("archived_at", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
          supabase.from("fc_body_measurements").select("weight_kg").eq("client_id", client.id).not("weight_kg", "is", null).order("measured_on", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("fc_workout_sessions").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "completed").gte("completed_at", weekStart.toISOString()),
        ]);
        setHasRoutine(Boolean(routine));
        setRoutineName(routine?.name ?? "");
        setWeight(measurement?.weight_kg ? `${measurement.weight_kg} kg` : "—");
        setCompletion(routine?.days_per_week ? Math.min(100, Math.round(((completedCount ?? 0) / routine.days_per_week) * 100)) : 0);
      }
      setLoading(false);
    }

    load();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return <SafeAreaView style={[s.safe, s.center]}><ActivityIndicator size="large" color="#6c5ce7" /></SafeAreaView>;
  }

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page}>
    <View style={s.top}><View><Text style={s.hello}>¡Hola, {name}!</Text><Text style={s.sub}>Este es tu espacio de entrenamiento.</Text></View><Pressable onPress={signOut}><Text style={s.logout}>Salir</Text></Pressable></View>
    <View style={s.week}><Text style={s.sectionTitle}>Tu rutina</Text>{hasRoutine ? <><Text style={s.workout}>{routineName}</Text><Text style={s.meta}>Registra cada serie para actualizar tu progreso.</Text></> : <><Text style={s.workout}>Aún no tienes rutina</Text><Text style={s.meta}>Tu nutriólogo está preparando tu plan.</Text></>}</View>
    {hasRoutine ? <Link href="/routine" asChild><Pressable style={s.primary}><Text style={s.primaryText}>Ver rutina</Text></Pressable></Link> : null}
    <View style={s.row}><View style={s.stat}><Text style={s.statValue}>{weight}</Text><Text style={s.meta}>Peso actual</Text></View><View style={s.stat}><Text style={s.statValue}>{completion}%</Text><Text style={s.meta}>Cumplimiento semanal</Text></View></View>
    <View style={s.sectionRow}><Text style={s.sectionTitle}>Tu progreso</Text><Link href={"/progress" as never} asChild><Pressable><Text style={s.progressLink}>Ver y registrar</Text></Pressable></Link></View><View style={s.chart}><View style={s.chartHead}><Text style={s.meta}>Meta semanal</Text><Text style={s.chartValue}>{completion}%</Text></View><View style={s.track}><View style={[s.fill,{width:`${completion}%`}]} /></View><Text style={s.emptyText}>{completion ? "Tu avance se actualiza al finalizar cada rutina." : "Completa tu primera rutina para comenzar la gráfica."}</Text></View>
  </ScrollView></SafeAreaView>;
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#f4f5f7"},center:{alignItems:"center",justifyContent:"center"},page:{padding:20,gap:16},top:{backgroundColor:"#d7d8dc",padding:20,borderRadius:20,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},hello:{fontSize:24,fontWeight:"800"},sub:{color:"#5f636b",marginTop:4},logout:{color:"#6c5ce7",fontWeight:"800"},week:{backgroundColor:"white",padding:20,borderRadius:18},sectionTitle:{fontSize:16,fontWeight:"800"},sectionRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},progressLink:{color:"#6c5ce7",fontWeight:"800",fontSize:12},workout:{fontSize:22,fontWeight:"800",marginTop:17},meta:{fontSize:12,color:"#777d87",marginTop:5},primary:{backgroundColor:"#17191c",padding:16,borderRadius:14,alignItems:"center"},primaryText:{color:"white",fontWeight:"800"},row:{flexDirection:"row",gap:12},stat:{flex:1,backgroundColor:"white",padding:17,borderRadius:16},statValue:{fontSize:21,fontWeight:"800"},chart:{minHeight:140,backgroundColor:"white",borderRadius:18,padding:20,gap:15},chartHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},chartValue:{fontSize:22,fontWeight:"900"},track:{height:12,borderRadius:999,backgroundColor:"#e8e9ed",overflow:"hidden"},fill:{height:"100%",backgroundColor:"#6c5ce7",borderRadius:999},emptyText:{color:"#777d87",fontSize:13,lineHeight:20,textAlign:"center"}});
