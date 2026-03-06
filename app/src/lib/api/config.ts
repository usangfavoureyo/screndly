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

    // In the browser, prefer same-origin API calls in production.
    // Vercel proxies `/api` and `/health` to Railway, which avoids CORS
    // issues during OAuth callback exchange.
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
        if (!isLocalHost) return '';
    }

    // Non-browser production fallback
    return 'https://screndly-production.up.railway.app';
}
