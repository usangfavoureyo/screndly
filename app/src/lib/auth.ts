/**
 * Client-side Authentication Utilities
 * Handles JWT token storage and validation.
 */

import {
  TOKEN_KEY as SHARED_TOKEN_KEY,
  getToken as sharedGetToken,
  setToken as sharedSetToken,
  clearAuth as sharedClearAuth
} from './api/authToken';
import { getApiUrl } from './api/config';

export const TOKEN_KEY = SHARED_TOKEN_KEY;
const KEEP_SIGNED_IN_KEY = 'screndly_keep_signed_in';
const SESSION_ACTIVE_KEY = 'screndly_session_active';

function getOptionalDevPassword(): string | null {
  const enabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_AUTH === 'true';
  const password = typeof import.meta.env.VITE_APP_PASSWORD === 'string'
    ? import.meta.env.VITE_APP_PASSWORD.trim()
    : '';

  return enabled && password ? password : null;
}

function createDevToken(password: string): string {
  const payload = {
    app: 'screndly',
    authenticated: true,
    password,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
  };

  return btoa(JSON.stringify(payload));
}

function verifyDevToken(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }

    const configuredPassword = getOptionalDevPassword();
    return !!configuredPassword && payload.password === configuredPassword;
  } catch {
    return false;
  }
}

function normalizeBase64Segment(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const paddingNeeded = (4 - (normalized.length % 4)) % 4;
  return normalized.padEnd(normalized.length + paddingNeeded, '=');
}

function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(atob(normalizeBase64Segment(segment)));
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isLegacyDevToken(token: string): boolean {
  if (token.includes('.')) {
    return false;
  }

  const payload = decodeJsonSegment(token);
  return !!payload && (
    'authenticated' in payload ||
    'password' in payload ||
    'app' in payload
  );
}

function hasUnexpiredJwt(token: string): boolean {
  const [, payloadSegment] = token.split('.');
  if (!payloadSegment) {
    return false;
  }

  const payload = decodeJsonSegment(payloadSegment);
  if (!payload) {
    return false;
  }

  const exp = typeof payload.exp === 'number'
    ? payload.exp
    : typeof payload.exp === 'string'
      ? Number(payload.exp)
      : null;

  if (exp == null || !Number.isFinite(exp)) {
    // Treat JWTs without an exp as valid offline to avoid forced logout
    // when the backend is unreachable.
    return true;
  }

  return exp > Math.floor(Date.now() / 1000);
}

function hasOfflineUsableToken(token: string): boolean {
  if (verifyDevToken(token)) {
    return true;
  }

  if (isLegacyDevToken(token)) {
    return false;
  }

  if (token.split('.').length === 3) {
    return hasUnexpiredJwt(token);
  }

  // Opaque backend tokens cannot be validated client-side. If one is present,
  // preserve the session offline and let the server re-verify when reachable.
  return true;
}

export async function login(password: string, rememberMe: boolean = true): Promise<{
  success: boolean;
  error?: string;
  remainingAttempts?: number;
}> {
  try {
    const backendUrl = getApiUrl();
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();

      if (response.ok && data.success) {
        sharedSetToken(data.token, rememberMe);
        return { success: true };
      }

      if (data.error === 'Server configuration error') {
        console.log('[Auth] API has config error, checking optional dev auth fallback');
        return handleDevLogin(password, rememberMe);
      }

      return {
        success: false,
        error: data.error || 'Login failed',
        remainingAttempts: data.remainingAttempts,
      };
    }

    console.log('[Auth] API not available, checking optional dev auth fallback');
    return handleDevLogin(password, rememberMe);
  } catch (error) {
    console.error('[Auth] Login error:', error);
    console.log('[Auth] Falling back to optional dev auth');
    return handleDevLogin(password, rememberMe);
  }
}

function handleDevLogin(password: string, rememberMe: boolean): {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
} {
  const configuredPassword = getOptionalDevPassword();

  if (!configuredPassword) {
    return {
      success: false,
      error: 'Backend authentication is unavailable. Check the backend or enable local dev auth explicitly.',
    };
  }

  if (password === configuredPassword) {
    const token = createDevToken(password);
    sharedSetToken(token, rememberMe);
    console.log('Login successful (development mode)');
    return { success: true };
  }

  return {
    success: false,
    error: 'Invalid password',
    remainingAttempts: 5,
  };
}

export async function verifyAuth(): Promise<boolean> {
  console.log('[verifyAuth] started');
  const keepSignedIn = localStorage.getItem(KEEP_SIGNED_IN_KEY) === 'true';
  const sessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true';
  console.log('[verifyAuth] keepSignedIn:', keepSignedIn, 'sessionActive:', sessionActive);

  if (!keepSignedIn && !sessionActive) {
    if (sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)) {
      console.log('[Auth] Session ended (Keep Me Signed In = false). Logging out.');
      logout();
    }
    console.log('[verifyAuth] returning false (!keepSignedIn && !sessionActive)');
    return false;
  }

  sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

  const token = getToken();
  console.log('[verifyAuth] token present:', !!token);

  if (!token) {
    console.log('[verifyAuth] returning false (!token)');
    return false;
  }

  const offlineUsable = hasOfflineUsableToken(token);
  console.log('[verifyAuth] offlineUsable:', offlineUsable);

  try {
    const backendUrl = getApiUrl();
    console.log('[verifyAuth] fetching from', backendUrl);
    const response = await fetch(`${backendUrl}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });
    console.log('[verifyAuth] response status:', response.status);

    if (response.status === 404) {
      return offlineUsable;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('[verifyAuth] data:', data);

      if (response.ok && data.valid) {
        return true;
      }

      if (response.status === 401 || response.status === 403) {
        console.log('[Auth] Token verification failed');
        logout();
        return false;
      }

      return offlineUsable;
    }

    return offlineUsable;
  } catch (_error) {
    console.log('[verifyAuth] error caught:', _error);
    return offlineUsable;
  }
}

export function hasStoredAuthSession(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const token = getToken();
  if (!token) {
    return false;
  }

  const keepSignedIn = localStorage.getItem(KEEP_SIGNED_IN_KEY) === 'true';
  const sessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true';

  return (keepSignedIn || sessionActive) && hasOfflineUsableToken(token);
}

export function logout(): void {
  sharedClearAuth();
  window.location.reload();
}

export function getToken(): string | null {
  return sharedGetToken();
}
