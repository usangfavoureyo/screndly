/**
 * Pinterest Token Storage
 * 
 * Handles secure storage and retrieval of Pinterest OAuth tokens.
 * Similar to other platform token storage utilities.
 */

const STORAGE_KEYS = {
    ACCESS_TOKEN: 'pinterest_access_token',
    REFRESH_TOKEN: 'pinterest_refresh_token',
    TOKEN_EXPIRY: 'pinterest_token_expiry',
    USER_INFO: 'pinterest_user_info',
};

/**
 * Get Pinterest access token
 */
export function getPinterestAccessToken(): string | null {
    try {
        const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

        // Check if token is expired
        if (token && expiry) {
            const expiryTime = parseInt(expiry, 10);
            if (Date.now() > expiryTime) {
                console.warn('[Pinterest] Token expired');
                return null; // Token needs refresh
            }
        }

        return token;
    } catch (_e) {
        return null;
    }
}

/**
 * Store Pinterest access token
 */
export function storePinterestAccessToken(
    accessToken: string,
    expiresIn: number = 86400, // Default 24 hours
    refreshToken?: string
): void {
    try {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(Date.now() + expiresIn * 1000));

        if (refreshToken) {
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        }
    } catch (_e) {
        console.error('[Pinterest] Failed to store token');
    }
}

/**
 * Get Pinterest refresh token
 */
export function getPinterestRefreshToken(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (_e) {
        return null;
    }
}

/**
 * Store Pinterest user info
 */
export function storePinterestUserInfo(userInfo: {
    id: string;
    username: string;
    profileImage?: string;
}): void {
    try {
        localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
    } catch (_e) {
        console.error('[Pinterest] Failed to store user info');
    }
}

/**
 * Get Pinterest user info
 */
export function getPinterestUserInfo(): {
    id: string;
    username: string;
    profileImage?: string;
} | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.USER_INFO);
        return stored ? JSON.parse(stored) : null;
    } catch (_e) {
        return null;
    }
}

/**
 * Clear all Pinterest tokens
 */
export function clearPinterestTokens(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
}

/**
 * Check if Pinterest is connected
 */
export function isPinterestConnected(): boolean {
    const token = getPinterestAccessToken();
    return !!token;
}

/**
 * Get token expiry time
 */
export function getTokenExpiry(): Date | null {
    try {
        const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
        return expiry ? new Date(parseInt(expiry, 10)) : null;
    } catch (_e) {
        return null;
    }
}

/**
 * Get time until token expires (in seconds)
 */
export function getTimeUntilExpiry(): number {
    try {
        const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
        if (!expiry) return 0;

        const expiryTime = parseInt(expiry, 10);
        const remaining = (expiryTime - Date.now()) / 1000;
        return Math.max(0, Math.round(remaining));
    } catch (_e) {
        return 0;
    }
}
