/**
 * Centralized API Configuration
 */

/**
 * Get the base API URL based on environment
 */
export function getApiUrl(): string {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        if (import.meta.env.DEV) return 'http://localhost:3000';
    }

    // In the browser, prefer same-origin API calls in production.
    // Vercel proxies `/api` and `/health` to Railway, which avoids CORS
    // issues during OAuth callback exchange.
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
        if (!isLocalHost) return '';
    }

    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    // Non-browser production fallback
    return 'https://screndly-production.up.railway.app';
}

/**
 * Get the direct backend URL, bypassing same-origin rewrites.
 * Use this for long-running requests where the Vercel proxy can terminate early.
 */
export function getDirectApiUrl(): string {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        if (import.meta.env.DEV) return 'http://localhost:3000';
    }

    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    return 'https://screndly-production.up.railway.app';
}
