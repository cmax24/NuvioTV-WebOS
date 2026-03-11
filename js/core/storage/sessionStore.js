const TOKEN_KEYS = ["access_token", "refresh_token", "is_anonymous_session"];

function getSessionStorage() {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

function getLocalStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function getPersistentValue(key) {
  const local = getLocalStorage();
  const session = getSessionStorage();

  const localValue = local?.getItem(key);
  if (localValue != null) {
    if (session?.getItem(key) !== localValue) {
      try {
        session?.setItem(key, localValue);
      } catch {
        // Ignore storage sync errors.
      }
    }
    return localValue;
  }

  const sessionValue = session?.getItem(key);
  if (sessionValue != null) {
    try {
      local?.setItem(key, sessionValue);
    } catch {
      // Ignore storage sync errors.
    }
    return sessionValue;
  }

  return null;
}

function setPersistentValue(key, value) {
  const session = getSessionStorage();
  const local = getLocalStorage();

  if (value == null) {
    session?.removeItem(key);
    local?.removeItem(key);
    return;
  }

  if (local) {
    local.setItem(key, value);
  }
  if (session) {
    session.setItem(key, value);
  }
}

function clearAllSessionKeys() {
  TOKEN_KEYS.forEach((key) => {
    setPersistentValue(key, null);
  });
}

export const SessionStore = {

  normalizeToken(value) {
    const text = String(value ?? "").trim();
    if (!text || text === "null" || text === "undefined") {
      return null;
    }
    return text;
  },

  get isAnonymousSession() {
    return getPersistentValue("is_anonymous_session") === "1";
  },

  set isAnonymousSession(value) {
    if (value) {
      setPersistentValue("is_anonymous_session", "1");
    } else {
      setPersistentValue("is_anonymous_session", null);
    }
  },

  get accessToken() {
    return this.normalizeToken(getPersistentValue("access_token"));
  },

  set accessToken(value) {
    const normalized = this.normalizeToken(value);
    setPersistentValue("access_token", normalized);
  },

  get refreshToken() {
    return this.normalizeToken(getPersistentValue("refresh_token"));
  },

  set refreshToken(value) {
    const normalized = this.normalizeToken(value);
    setPersistentValue("refresh_token", normalized);
  },

  clear() {
    clearAllSessionKeys();
  }
};
