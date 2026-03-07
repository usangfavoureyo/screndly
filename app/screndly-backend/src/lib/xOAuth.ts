import { env } from './env';

export function getXOAuthClientId(): string {
    return env.X_CLIENT_ID || env.X_API_KEY || '';
}

export function getXOAuthClientSecret(): string {
    return env.X_CLIENT_SECRET || env.X_API_SECRET || '';
}

export function assertXOAuthConfigured(): void {
    if (!getXOAuthClientId()) {
        throw new Error('X OAuth is not configured. Missing: X_CLIENT_ID (or X_API_KEY)');
    }
}

export function buildXTokenRequest(
    params: URLSearchParams
): { params: URLSearchParams; headers: Record<string, string> } {
    const clientId = getXOAuthClientId();
    const clientSecret = getXOAuthClientSecret();
    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (clientSecret) {
        headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
        return { params, headers };
    }

    params.append('client_id', clientId);
    return { params, headers };
}
