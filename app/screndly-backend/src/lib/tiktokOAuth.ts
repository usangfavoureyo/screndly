import { env } from './env';

function normalizeCredential(value?: string): string {
    return value?.trim() || '';
}

export function getTikTokClientKey(): string {
    return normalizeCredential(env.TIKTOK_CLIENT_KEY);
}

export function getTikTokClientSecret(): string {
    return normalizeCredential(env.TIKTOK_CLIENT_SECRET);
}

export function hasTikTokCredentialWhitespace(): boolean {
    return (env.TIKTOK_CLIENT_KEY || '') !== getTikTokClientKey()
        || (env.TIKTOK_CLIENT_SECRET || '') !== getTikTokClientSecret();
}
