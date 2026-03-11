import { SUPABASE_URL, SUPABASE_ANON_KEY, TV_LOGIN_REDIRECT_BASE_URL, assertSupabaseConfig } from "../../config.js";
import { SessionStore } from "../storage/sessionStore.js";
import { AuthManager } from "./authManager.js";
import { AuthState } from "./authState.js";

let lastError = null;
let qrCallerSession = null;

function isJwtLike(token) {
  const value = String(token || "").trim();
  return value.split(".").length === 3;
}

function getQrCallerToken() {
  const token = qrCallerSession?.accessToken;
  if (isJwtLike(token)) {
    return token;
  }
  return null;
}

function setQrCallerSession(tokens) {
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    qrCallerSession = null;
    return;
  }
  qrCallerSession = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}

function clearQrCallerSession() {
  qrCallerSession = null;
}

function generateDeviceNonce() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(24);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function resolveRedirectBaseUrl() {
  if (TV_LOGIN_REDIRECT_BASE_URL) {
    return TV_LOGIN_REDIRECT_BASE_URL;
  }
  if (typeof window !== "undefined") {
    const protocol = String(window.location?.protocol || "");
    if (protocol === "http:" || protocol === "https:") {
      return window.location.origin;
    }
  }
  return TV_LOGIN_REDIRECT_BASE_URL;
}

function extractOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildRedirectCandidates() {
  const candidates = [];
  const base = resolveRedirectBaseUrl();
  if (base) {
    candidates.push(base);
    if (base.endsWith("/")) {
      candidates.push(base.slice(0, -1));
    } else {
      candidates.push(`${base}/`);
    }
    const origin = extractOrigin(base);
    if (origin) {
      candidates.push(origin);
      candidates.push(`${origin}/`);
    }
  }
  return Array.from(new Set(candidates.filter(Boolean)));
}

function toEpochMillis(session) {
  if (typeof session?.expires_at_millis === "number") {
    return session.expires_at_millis;
  }
  if (session?.expires_at) {
    const parsed = Date.parse(session.expires_at);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now() + (5 * 60 * 1000);
}

function isLegacyStartSignatureError(text) {
  const message = String(text || "").toLowerCase();
  return message.includes("start_tv_login_session")
    && message.includes("could not find the function")
    && message.includes("p_device_name");
}

function isJwtAuthError(text) {
  const message = String(text || "").toLowerCase();
  return message.includes("jwt expired")
    || message.includes("pgrst303")
    || message.includes("invalid jwt")
    || message.includes("jwt malformed")
    || (message.includes("jwt") && message.includes("expired"));
}

async function parseErrorText(response) {
  try {
    return await response.text();
  } catch {
    return `HTTP ${response.status}`;
  }
}

function extractSessionTokens(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const accessToken = payload.access_token || payload.accessToken || payload?.session?.access_token || null;
  const refreshToken = payload.refresh_token || payload.refreshToken || payload?.session?.refresh_token || null;
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

async function ensureQrSessionAuthenticated() {
  assertSupabaseConfig();
  if (getQrCallerToken()) {
    return true;
  }

  const commonHeaders = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
  };

  const tryAnonymousSignup = async () => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        data: { tv_client: "webos" }
      })
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `HTTP ${response.status}`);
    }
    return text ? JSON.parse(text) : {};
  };

  const tryAnonymousToken = async () => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=anonymous`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({})
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `HTTP ${response.status}`);
    }
    return text ? JSON.parse(text) : {};
  };

  let payload;
  try {
    payload = await tryAnonymousSignup();
  } catch (firstError) {
    payload = await tryAnonymousToken().catch((secondError) => {
      throw new Error(`${firstError?.message || "anonymous signup failed"} | ${secondError?.message || "anonymous token failed"}`);
    });
  }

  const tokens = extractSessionTokens(payload);
  if (!tokens) {
    throw new Error("Anonymous auth did not return session tokens");
  }
  setQrCallerSession(tokens);
  return true;
}

async function recoverQrSessionFromAuthError(rawErrorText) {
  if (!isJwtAuthError(rawErrorText)) {
    return false;
  }
  clearQrCallerSession();
  try {
    await ensureQrSessionAuthenticated();
    return Boolean(getQrCallerToken());
  } catch (_) {
    return false;
  }
}

async function startRpc(deviceNonce, redirectBaseUrl, callerToken, includeDeviceName = true) {
  assertSupabaseConfig();
  const payload = {
    p_device_nonce: deviceNonce,
    p_redirect_base_url: redirectBaseUrl
  };
  if (includeDeviceName) {
    payload.p_device_name = "webOS TV";
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/start_tv_login_session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${callerToken || SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await parseErrorText(response);
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data?.[0] || null;
}

export const QrLoginService = {

  getLastError() {
    return lastError;
  },

  async start() {
    lastError = null;
    try {
      assertSupabaseConfig();
      clearQrCallerSession();
      await ensureQrSessionAuthenticated();
      const deviceNonce = generateDeviceNonce();
      const redirectCandidates = buildRedirectCandidates();
      if (!redirectCandidates.length) {
        throw new Error("Missing redirect_base_url configuration");
      }

      let session = null;
      let lastStartError = null;
      let authRecoveryUsed = false;

      const runStartRpc = async (redirectCandidate) => {
        const callerToken = getQrCallerToken();
        if (!callerToken) {
          throw new Error("Missing QR caller session token");
        }
        try {
          return await startRpc(deviceNonce, redirectCandidate, callerToken, true);
        } catch (error) {
          const message = String(error?.message || "");
          if (!isLegacyStartSignatureError(message)) {
            throw error;
          }
          return startRpc(deviceNonce, redirectCandidate, callerToken, false);
        }
      };

      for (const redirectCandidate of redirectCandidates) {
        try {
          session = await runStartRpc(redirectCandidate);
          if (session) {
            break;
          }
        } catch (error) {
          const message = String(error?.message || "");
          if (!authRecoveryUsed) {
            const recovered = await recoverQrSessionFromAuthError(message);
            if (recovered) {
              authRecoveryUsed = true;
              try {
                session = await runStartRpc(redirectCandidate);
                if (session) {
                  break;
                }
              } catch (retryError) {
                lastStartError = retryError;
                continue;
              }
            }
          }
          lastStartError = error;
          continue;
        }
      }

      if (!session) {
        if (lastStartError) {
          throw new Error(`${lastStartError.message} | tried redirect_base_url: ${redirectCandidates.join(" , ")}`);
        }
        throw new Error("Empty response from start_tv_login_session");
      }

      return {
        code: session.code,
        loginUrl: session.qr_content || session.web_url || null,
        qrImageUrl: session.qr_image_url || `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(session.qr_content || session.web_url || "")}`,
        expiresAt: toEpochMillis(session),
        pollIntervalSeconds: Number(session.poll_interval_seconds || 3),
        deviceNonce
      };
    } catch (error) {
      clearQrCallerSession();
      lastError = String(error?.message || "QR start failed");
      console.error("QR start error:", error);
      return null;
    }
  },

  async poll(code, deviceNonce) {
    lastError = null;
    try {
      assertSupabaseConfig();
      const callerToken = getQrCallerToken();
      if (!callerToken) {
        lastError = "Invalid caller session";
        return null;
      }
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/poll_tv_login_session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${callerToken}`
        },
        body: JSON.stringify({
          p_code: code,
          p_device_nonce: deviceNonce
        })
      });

      if (!response.ok) {
        const errorText = await parseErrorText(response);
        lastError = errorText;
        return null;
      }

      const data = await response.json();
      return data?.[0]?.status || null;
    } catch (error) {
      lastError = String(error?.message || "QR poll failed");
      console.error("QR poll error:", error);
      return null;
    }
  },

  async exchange(code, deviceNonce) {
    lastError = null;
    try {
      assertSupabaseConfig();
      const callerToken = getQrCallerToken();
      if (!callerToken) {
        lastError = "Invalid caller session";
        return false;
      }
      const response = await fetch(`${SUPABASE_URL}/functions/v1/tv-logins-exchange`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${callerToken}`
        },
        body: JSON.stringify({
          code,
          device_nonce: deviceNonce
        })
      });

      if (!response.ok) {
        const errorText = await parseErrorText(response);
        lastError = errorText;
        console.error("Exchange failed", lastError);
        return false;
      }

      const result = await response.json();
      const tokens = extractSessionTokens(result) || {
        accessToken: result?.access_token || null,
        refreshToken: result?.refresh_token || null
      };
      if (!tokens?.accessToken || !tokens?.refreshToken) {
        lastError = "QR exchange missing session tokens";
        return false;
      }
      SessionStore.accessToken = tokens.accessToken;
      SessionStore.refreshToken = tokens.refreshToken;
      SessionStore.isAnonymousSession = false;
      clearQrCallerSession();
      AuthManager.setState(AuthState.AUTHENTICATED);
      return result;
    } catch (error) {
      lastError = String(error?.message || "QR exchange failed");
      console.error("QR exchange error:", error);
      return false;
    }
  },

  cleanup() {
    clearQrCallerSession();
  }

};
