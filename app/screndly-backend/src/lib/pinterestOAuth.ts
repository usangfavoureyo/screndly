import { env } from './env';

function normalizeCredential(value?: string): string {
    return value?.trim() || '';
}

export function getPinterestAppId(): string {
    return normalizeCredential(env.PINTEREST_APP_ID || env.PINTEREST_CLIENT_ID);
}

export function getPinterestAppSecret(): string {
    return normalizeCredential(env.PINTEREST_APP_SECRET || env.PINTEREST_CLIENT_SECRET);
}

