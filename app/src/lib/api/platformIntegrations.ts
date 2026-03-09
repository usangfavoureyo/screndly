import { apiClient } from './client';
import { getOAuthRedirectUri } from '../../utils/oauthRedirect';

export type ManagedPlatform =
  | 'Instagram'
  | 'Facebook'
  | 'Threads'
  | 'TikTok'
  | 'X'
  | 'YouTube'
  | 'Pinterest';

export interface ManagedPlatformStatus {
  connected: boolean;
  username?: string;
  lastPost?: string;
  profileUrl?: string;
  expiresAt?: string;
  error?: string;
}

type PlatformStatusMap = Record<ManagedPlatform, ManagedPlatformStatus>;

const PLATFORM_STORAGE_KEY = 'screndly_oauth_platform';
const STATE_STORAGE_KEY = 'screndly_oauth_state';
const CODE_VERIFIER_STORAGE_KEY = 'screndly_oauth_code_verifier';

const DEFAULT_STATUSES: PlatformStatusMap = {
  Instagram: { connected: false },
  Facebook: { connected: false },
  Threads: { connected: false },
  TikTok: { connected: false },
  X: { connected: false },
  YouTube: { connected: false },
  Pinterest: { connected: false },
};

function decodeJwtPayload(value: string): string | null {
  const parts = value.split('.');
  if (parts.length !== 3) return null;

  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);

  try {
    return atob(`${normalized}${padding}`);
  } catch {
    return null;
  }
}

function storeOAuthContext(platform: ManagedPlatform, url: string): void {
  const oauthUrl = new URL(url);
  const oauthState = oauthUrl.searchParams.get('state');

  localStorage.setItem(PLATFORM_STORAGE_KEY, platform);
  sessionStorage.setItem(PLATFORM_STORAGE_KEY, platform);

  if (!oauthState) {
    return;
  }

  localStorage.setItem(STATE_STORAGE_KEY, oauthState);
  sessionStorage.setItem(STATE_STORAGE_KEY, oauthState);

  try {
    const payloadRaw = decodeJwtPayload(oauthState);
    if (!payloadRaw) return;

    const payload = JSON.parse(payloadRaw) as { codeVerifier?: string };
    if (!payload.codeVerifier) return;

    localStorage.setItem(CODE_VERIFIER_STORAGE_KEY, payload.codeVerifier);
    sessionStorage.setItem(CODE_VERIFIER_STORAGE_KEY, payload.codeVerifier);
  } catch {
    // Best-effort only.
  }
}

export async function fetchManagedPlatformStatuses(): Promise<PlatformStatusMap> {
  const response = await apiClient.get<Partial<PlatformStatusMap>>('/api/platforms/status');

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to fetch platform status');
  }

  return {
    ...DEFAULT_STATUSES,
    ...response.data,
  };
}

export async function beginManagedPlatformOAuth(platform: ManagedPlatform): Promise<void> {
  const redirectUri = getOAuthRedirectUri(platform);
  const response = await apiClient.get<{ url?: string }>(
    `/api/platforms/auth/${platform}?redirectUri=${encodeURIComponent(redirectUri)}`
  );

  const oauthUrl = response.data?.url;
  if (!response.success || !oauthUrl) {
    throw new Error(response.error?.message || `Failed to start ${platform} connection`);
  }

  storeOAuthContext(platform, oauthUrl);
  window.location.href = oauthUrl;
}

export async function disconnectManagedPlatform(platform: ManagedPlatform): Promise<void> {
  const response = await apiClient.delete(`/api/platforms/${platform}`);
  if (!response.success) {
    throw new Error(response.error?.message || `Failed to disconnect ${platform}`);
  }
}
