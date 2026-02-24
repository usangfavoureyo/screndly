/**
 * Centralized API Configuration
 */

/**
 * Get the base API URL based on environment
 */
export function getApiUrl(): string {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
        if (import.meta.env.DEV) return 'http://localhost:3000';
    }
    // Production fallback
    return 'https://screndly-production.up.railway.app';
}
