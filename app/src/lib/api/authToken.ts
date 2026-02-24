/**
 * Unified Authentication Token Management
 * 
 * This file is a standalone utility to avoid circular dependencies
 * between lib/auth.ts and lib/api/client.ts.
 */

export const TOKEN_KEY = 'screndly_auth_token';
export const LEGACY_TOKEN_KEY = 'screndly_token';
export const KEEP_SIGNED_IN_KEY = 'screndly_keep_signed_in';
export const SESSION_ACTIVE_KEY = 'screndly_session_active';

/**
 * Migrate legacy tokens to the new unified key
 */
export function migrateLegacyToken(): void {
    if (typeof window === 'undefined') return;

    try {
        const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
        const currentToken = localStorage.getItem(TOKEN_KEY);

        if (legacyToken && !currentToken) {
            console.log('[Auth] Migrating legacy token to unified key');
            localStorage.setItem(TOKEN_KEY, legacyToken);
            // We don't delete the legacy one immediately for safety
        }
    } catch (e) {
        console.error('[Auth] Migration failed:', e);
    }
}

export const CLIENT_VERSION = '1.0.1-auth-debug-phase-3';

/**
 * Get the stored authentication token
 */
export function getToken(): string | null {
    if (typeof window === 'undefined') return null;

    // Always run migration check
    migrateLegacyToken();

    try {
        const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

        // Sanitize: sometimes "undefined", "null" or "[object Object]" strings get stored by accident
        if (!token ||
            token === 'undefined' ||
            token === 'null' ||
            token === '[object Object]' ||
            token.trim() === '') {
            return null;
        }

        return token;
    } catch (e) {
        return null;
    }
}

/**
 * Get authentication headers for fetch/apiClient
 */
export function getAuthHeaders(): Record<string, string> {
    const token = getToken();
    if (token) {
        return { Authorization: `Bearer ${token}` };
    }
    return {};
}

/**
 * Store the token and persistence preference
 */
export function setToken(token: string | null | undefined, rememberMe: boolean = true): void {
    if (typeof window === 'undefined') return;

    if (!token || token === 'undefined' || token === 'null') {
        console.warn(`[Auth Warning] Attempted to set nullish token: ${token}. Clearing instead.`);
        clearAuth();
        return;
    }

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(KEEP_SIGNED_IN_KEY, String(rememberMe));
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

    // Cleanup legacy
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
}

/**
 * Clear all authentication state
 */
export function clearAuth(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(KEEP_SIGNED_IN_KEY);
    sessionStorage.removeItem(SESSION_ACTIVE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
}
