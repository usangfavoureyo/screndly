/**
 * Platform Connection Management
 *
 * Stores the last known backend connection state locally so the
 * Platforms page can render quickly and survive refreshes.
 */

export type PlatformType = 'Instagram' | 'Facebook' | 'Threads' | 'TikTok' | 'X' | 'YouTube' | 'Pinterest';

export interface PlatformConnection {
  platform: PlatformType;
  connected: boolean;
  connectedAt?: string;
  lastSync?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  userId?: string;
  username?: string;
  profileImage?: string;
  profileUrl?: string;
  error?: string;
}

export interface ConnectionStatus {
  health: 'healthy' | 'warning' | 'error' | 'disconnected';
  message: string;
}

interface BackendPlatformStatus {
  connected: boolean;
  username?: string;
  lastPost?: string;
  profileUrl?: string;
  expiresAt?: string;
  error?: string;
}

const STORAGE_KEY = 'screndly_platform_connections';

/**
 * Get all platform connections
 */
export function getPlatformConnections(): Record<PlatformType, PlatformConnection> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultConnections();
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading platform connections:', error);
    return getDefaultConnections();
  }
}

/**
 * Get default disconnected state for all platforms
 */
function getDefaultConnections(): Record<PlatformType, PlatformConnection> {
  return {
    Instagram: { platform: 'Instagram', connected: false },
    Facebook: { platform: 'Facebook', connected: false },
    Threads: { platform: 'Threads', connected: false },
    TikTok: { platform: 'TikTok', connected: false },
    X: { platform: 'X', connected: false },
    YouTube: { platform: 'YouTube', connected: false },
    Pinterest: { platform: 'Pinterest', connected: false },
  };
}

/**
 * Save platform connections to localStorage
 */
function saveConnections(connections: Record<PlatformType, PlatformConnection>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
  } catch (error) {
    console.error('Error saving platform connections:', error);
  }
}

function buildProfileUrl(platform: PlatformType, username?: string): string | undefined {
  if (!username) return undefined;

  const cleanUsername = username.replace(/^@/, '');
  const profileUrls: Record<PlatformType, string> = {
    Instagram: `https://www.instagram.com/${cleanUsername}`,
    Facebook: `https://www.facebook.com/${cleanUsername}`,
    Threads: `https://www.threads.net/@${cleanUsername}`,
    TikTok: `https://www.tiktok.com/@${cleanUsername}`,
    X: `https://x.com/${cleanUsername}`,
    YouTube: `https://youtube.com/@${cleanUsername}`,
    Pinterest: `https://www.pinterest.com/${cleanUsername}`,
  };

  return profileUrls[platform];
}

export function syncPlatformConnectionsFromBackend(
  backendStatus: Partial<Record<PlatformType, BackendPlatformStatus>>
): Record<PlatformType, PlatformConnection> {
  const existing = getPlatformConnections();
  const nextConnections = getDefaultConnections();

  (Object.keys(nextConnections) as PlatformType[]).forEach((platform) => {
    const serverConnection = backendStatus[platform];
    const existingConnection = existing[platform];

    if (serverConnection?.connected) {
      const username = serverConnection.username || existingConnection?.username;
      nextConnections[platform] = {
        platform,
        connected: true,
        connectedAt: existingConnection?.connectedAt || serverConnection.lastPost || new Date().toISOString(),
        lastSync: serverConnection.lastPost || new Date().toISOString(),
        expiresAt: serverConnection.expiresAt || existingConnection?.expiresAt,
        userId: existingConnection?.userId,
        username,
        profileUrl: serverConnection.profileUrl || buildProfileUrl(platform, username) || existingConnection?.profileUrl,
        error: serverConnection.error,
      };
      return;
    }

    nextConnections[platform] = {
      platform,
      connected: false,
    };
  });

  saveConnections(nextConnections);
  return nextConnections;
}

/**
 * Get connection for specific platform
 */
export function getPlatformConnection(platform: PlatformType): PlatformConnection {
  const connections = getPlatformConnections();
  return connections[platform] || { platform, connected: false };
}

/**
 * Check if platform is connected
 */
export function isPlatformConnected(platform: PlatformType): boolean {
  const connection = getPlatformConnection(platform);
  return connection?.connected || false;
}

/**
 * Disconnect from a platform
 */
export function disconnectPlatform(platform: PlatformType): void {
  const connections = getPlatformConnections();

  connections[platform] = {
    platform,
    connected: false,
  };

  saveConnections(connections);
}

import { getToken as getSharedToken, migrateLegacyToken as sharedMigrateLegacyToken } from '../lib/api/authToken';

/**
 * Migrate legacy tokens to the new unified key
 */
export function migrateLegacyToken(): void {
  sharedMigrateLegacyToken();
}

/**
 * Get stored token
 */
export function getToken(): string | null {
  return getSharedToken();
}

/**
 * Get connection health status
 */
export function getConnectionStatus(platform: PlatformType): ConnectionStatus {
  const connection = getPlatformConnection(platform);

  if (!connection.connected) {
    return {
      health: 'disconnected',
      message: 'Not connected',
    };
  }

  if (connection.error) {
    return {
      health: 'error',
      message: connection.error,
    };
  }

  // Only treat a connection as unhealthy when the token is already expired.
  if (connection.expiresAt) {
    const expiresAt = new Date(connection.expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return {
        health: 'error',
        message: 'Token expired - reconnect required',
      };
    }

  }

  return {
    health: 'healthy',
    message: 'Connected',
  };
}

/**
 * Format last connection time
 */
export function formatLastConnection(connection: PlatformConnection): string {
  if (!connection.connectedAt) {
    return 'Never';
  }

  const date = new Date(connection.connectedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

/**
 * Get all connected platforms
 */
export function getConnectedPlatforms(): PlatformType[] {
  const connections = getPlatformConnections();
  return Object.values(connections)
    .filter(conn => conn.connected)
    .map(conn => conn.platform);
}

/**
 * Get connection statistics
 */
export function getConnectionStats(): {
  total: number;
  connected: number;
  disconnected: number;
  healthIssues: number;
} {
  const connections = getPlatformConnections();
  const allConnections = Object.values(connections);

  return {
    total: allConnections.length,
    connected: allConnections.filter(c => c.connected).length,
    disconnected: allConnections.filter(c => !c.connected).length,
    healthIssues: allConnections.filter(c => {
      const status = getConnectionStatus(c.platform);
      return status.health === 'error' || status.health === 'warning';
    }).length,
  };
}
