/**
 * Client-side Authentication Utilities
 * Handles JWT token storage and validation
 * Supports both production (Vercel API) and development (client-side) modes
 */

import { AUTH_CONFIG } from '../config/auth.config';
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

/**
 * Simple JWT creation for development mode
 */
function createDevToken(password: string): string {
  const payload = {
    app: 'screndly',
    authenticated: true,
    password, // For dev verification
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  };

  // Simple base64 encoding for dev (NOT secure, only for dev environment)
  return btoa(JSON.stringify(payload));
}

/**
 * Verify dev token
 */
function verifyDevToken(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }

    // Verify password matches - safely check env var, fallback to config
    let envPassword: string | undefined;
    try {
      envPassword = import.meta?.env?.VITE_APP_PASSWORD;
    } catch {
      // Environment not available
    }

    const configuredPassword = envPassword || AUTH_CONFIG.DEV_PASSWORD;
    return payload.password === configuredPassword;
  } catch {
    return false;
  }
}

/**
 * Login with password
 * Tries API first, falls back to dev mode if API unavailable
 */
export async function login(password: string, rememberMe: boolean = true): Promise<{
  success: boolean;
  error?: string;
  remainingAttempts?: number;
}> {
  try {
    // First, try production API (Vercel serverless function)
    const backendUrl = getApiUrl();
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    // Check if we got JSON response (production mode)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();

      if (response.ok && data.success) {
        // MANDATORY: Use unified token storage
        sharedSetToken(data.token, rememberMe);
        return { success: true };
      }

      // If API returned an error, check if we should fall back to dev mode
      // This handles cases where API exists but has config issues
      if (data.error === 'Server configuration error') {
        console.log('[Auth] API has config error, trying dev mode');
        return handleDevLogin(password, rememberMe);
      }

      return {
        success: false,
        error: data.error || 'Login failed',
        remainingAttempts: data.remainingAttempts,
      };
    }

    // If we got HTML response, API doesn't exist - fall back to dev mode
    console.log('[Auth] API not available, using development mode authentication');
    return handleDevLogin(password, rememberMe);
  } catch (error) {
    console.error('[Auth] Login error:', error);
    // Network error or API not available - try dev mode
    console.log('[Auth] Falling back to dev mode');
    return handleDevLogin(password, rememberMe);
  }
}

/**
 * Handle login in development mode (frontend-only)
 */
function handleDevLogin(password: string, rememberMe: boolean): {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
} {
  // Check if dev mode is enabled
  if (!AUTH_CONFIG.ENABLE_DEV_MODE) {
    return {
      success: false,
      error: 'Backend API is required but not available',
    };
  }

  // Get password - safely check import.meta.env first, then fallback to config
  let envPassword: string | undefined;

  try {
    // import.meta.env might be undefined in some environments
    envPassword = import.meta?.env?.VITE_APP_PASSWORD;
  } catch (_error) {
    console.log('Environment variables not available, using config file');
  }

  // Use config file as primary source
  const configuredPassword = envPassword || AUTH_CONFIG.DEV_PASSWORD;

  if (!configuredPassword) {
    console.error('No password configured in auth.config.ts or environment');
    return {
      success: false,
      error: 'Authentication not configured. Check /config/auth.config.ts',
    };
  }

  // Simple password comparison for dev mode
  if (password === configuredPassword) {
    // Create and store dev token
    const token = createDevToken(password);

    // MANDATORY Implementation: localStorage
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(KEEP_SIGNED_IN_KEY, String(rememberMe));
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

    // Cleanup old session storage usage
    sessionStorage.removeItem(TOKEN_KEY);

    console.log('✅ Login successful (development mode)');
    return { success: true };
  }

  return {
    success: false,
    error: 'Invalid password',
    remainingAttempts: 5, // Mock remaining attempts for dev
  };
}

/**
 * Verify if user is authenticated
 * Tries API first, falls back to dev token verification if API unavailable
 */
export async function verifyAuth(): Promise<boolean> {
  // 1. Check Session Logic first
  const keepSignedIn = localStorage.getItem(KEEP_SIGNED_IN_KEY) === 'true';
  const sessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true';

  // If user did NOT check "Keep me signed in", and this is a fresh session (tab close/reopen),
  // then we must treat them as logged out (Mandatory Requirement)
  if (!keepSignedIn && !sessionActive) {
    // Only clear if we actually have a token to protect against infinite loops
    if (localStorage.getItem(TOKEN_KEY)) {
      console.log('[Auth] Session ended (Keep Me Signed In = false). Logging out.');
      logout();
    }
    return false;
  }

  // Mark session as active immediately if we proceed
  sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

  const token = getToken();

  if (!token) {
    return false;
  }

  try {
    // Try production API first
    const backendUrl = getApiUrl();
    const response = await fetch(`${backendUrl}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    // If API returns 404 or non-JSON, fall back to dev mode
    if (response.status === 404) {
      return verifyDevToken(token);
    }

    // Check if we got JSON response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();

      if (response.ok && data.valid) {
        return true;
      }

      // Token invalid or expired - clear it
      console.log('[Auth] Token verification failed');
      logout();
      return false;
    }

    // API not available (returned HTML) - use dev mode verification
    return verifyDevToken(token);
  } catch (_error) {
    // Network error - try dev mode verification
    return verifyDevToken(token);
  }
}

/**
 * Logout user
 */
export function logout(): void {
  sharedClearAuth();
  window.location.reload();
}

/**
 * Get stored token
 */
export function getToken(): string | null {
  return sharedGetToken();
}