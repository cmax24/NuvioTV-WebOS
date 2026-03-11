const runtimeConfig = globalThis.__NUVIO_CONFIG__ || {};

function normalizeConfigValue(value) {
  const text = String(value ?? "").trim();
  return text || "";
}

export const SUPABASE_URL = normalizeConfigValue(runtimeConfig.SUPABASE_URL);
export const SUPABASE_ANON_KEY = normalizeConfigValue(runtimeConfig.SUPABASE_ANON_KEY);
export const TV_LOGIN_REDIRECT_BASE_URL = normalizeConfigValue(runtimeConfig.TV_LOGIN_REDIRECT_BASE_URL);

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function assertSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE runtime config. Set window.__NUVIO_CONFIG__.SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
}
