import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

// En iOS/Android la sesión va al llavero seguro; en web (solo vista previa de desarrollo) a localStorage.
const ExpoSecureStoreAdapter = Platform.OS === "web"
  ? {
      getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
      setItem: async (key: string, value: string) => { globalThis.localStorage?.setItem(key, value); },
      removeItem: async (key: string) => { globalThis.localStorage?.removeItem(key); },
    }
  : {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    };

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { storage: ExpoSecureStoreAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } },
);
