import { supabase } from "./supabase";

function paramsFromUrl(url: string) {
  const [base, fragment = ""] = url.split("#");
  const query = base.includes("?") ? base.slice(base.indexOf("?") + 1) : "";
  return new URLSearchParams([query, fragment].filter(Boolean).join("&"));
}

export async function consumeAuthLink(url: string) {
  const params = paramsFromUrl(url);
  const linkType = params.get("type") === "recovery" || params.get("flow") === "recovery" ? "recovery" : "invite";
  const errorDescription = params.get("error_description");
  if (errorDescription) throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return linkType;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw error;
  return linkType;
}
