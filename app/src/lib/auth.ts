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
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(KEEP_SIGNED_IN_KEY, String(rememberMe));
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
    sessionStorage.removeItem(TOKEN_KEY);
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
  const keepSignedIn = localStorage.getItem(KEEP_SIGNED_IN_KEY) === 'true';
  const sessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true';

  if (!keepSignedIn && !sessionActive) {
    if (localStorage.getItem(TOKEN_KEY)) {
      console.log('[Auth] Session ended (Keep Me Signed In = false). Logging out.');
      logout();
    }
    return false;
  }

  sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

  const token = getToken();

  if (!token) {
    return false;
  }

  try {
    const backendUrl = getApiUrl();
    const response = await fetch(`${backendUrl}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (response.status === 404) {
      return verifyDevToken(token);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();

      if (response.ok && data.valid) {
        return true;
      }

      console.log('[Auth] Token verification failed');
      logout();
      return false;
    }

    return verifyDevToken(token);
  } catch (_error) {
    return verifyDevToken(token);
  }
}

export function logout(): void {
  sharedClearAuth();
  window.location.reload();
}

export function getToken(): string | null {
  return sharedGetToken();
}
