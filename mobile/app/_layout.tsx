import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { consumeAuthLink } from "@/lib/authLink";
import { WorkoutProvider } from "@/lib/workoutStore";

export default function RootLayout() {
  useEffect(() => {
    async function handle(url: string | null) {
      if (!url || (!url.includes("access_token=") && !url.includes("code="))) return;
      try {
        const type = await consumeAuthLink(url);
        if (type === "recovery") router.replace("/reset-password" as never);
        else if (type === "invite") router.replace("/activate");
      } catch {
        router.replace({ pathname: "/login", params: { linkError: "La invitación expiró o no es válida." } });
      }
    }
    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener("url", ({ url }) => void handle(url));
    return () => subscription.remove();
  }, []);

  return <SafeAreaProvider><WorkoutProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#fff" } }} />
  </WorkoutProvider></SafeAreaProvider>;
}
