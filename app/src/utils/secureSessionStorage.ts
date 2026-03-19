export function getSessionStoredJson<T>(primaryKey: string, legacyKeys: string[] = []): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const sessionValue = sessionStorage.getItem(primaryKey);
    if (sessionValue) {
      return JSON.parse(sessionValue) as T;
    }

    for (const legacyKey of legacyKeys) {
      const legacyValue = localStorage.getItem(legacyKey);
      if (!legacyValue) {
        continue;
      }

      sessionStorage.setItem(primaryKey, legacyValue);
      localStorage.removeItem(legacyKey);
      localStorage.removeItem(primaryKey);
      return JSON.parse(legacyValue) as T;
    }

    const persistedValue = localStorage.getItem(primaryKey);
    if (persistedValue) {
      sessionStorage.setItem(primaryKey, persistedValue);
      localStorage.removeItem(primaryKey);
      return JSON.parse(persistedValue) as T;
    }
  } catch (error) {
    console.error('[SecureSessionStorage] Failed to read JSON value:', error);
  }

  return null;
}

export function setSessionStoredJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[SecureSessionStorage] Failed to write JSON value:', error);
  }
}

export function removeSessionStoredValue(key: string, legacyKeys: string[] = []): void {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
  legacyKeys.forEach((legacyKey) => localStorage.removeItem(legacyKey));
}

export function getSessionStoredValue(key: string, legacyKeys: string[] = []): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue) {
    return sessionValue;
  }

  for (const legacyKey of legacyKeys) {
    const legacyValue = localStorage.getItem(legacyKey);
    if (!legacyValue) {
      continue;
    }

    sessionStorage.setItem(key, legacyValue);
    localStorage.removeItem(legacyKey);
    localStorage.removeItem(key);
    return legacyValue;
  }

  const persistedValue = localStorage.getItem(key);
  if (persistedValue) {
    sessionStorage.setItem(key, persistedValue);
    localStorage.removeItem(key);
    return persistedValue;
  }

  return null;
}

export function setSessionStoredValue(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.setItem(key, value);
  localStorage.removeItem(key);
}
