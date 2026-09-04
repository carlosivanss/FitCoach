import { useEffect } from "react";
import { Stack } from "expo-router";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Linking } from "react-native";
import { consumeAuthLink } from "@/lib/authLink";

export default function RootLayout() {
  useEffect(() => {
    async function handle(url: string | null) {
      if (!url || (!url.includes("access_token=") && !url.includes("code="))) return;
      try {
        if (await consumeAuthLink(url)) router.replace("/activate");
      } catch {
        router.replace({ pathname: "/login", params: { linkError: "La invitación expiró o no es válida." } });
      }
    }
    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener("url", ({ url }) => void handle(url));
    return () => subscription.remove();
  }, []);

  return <><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} /></>;
}
