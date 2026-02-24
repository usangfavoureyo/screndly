/**
 * Platform Connection Management
 * 
 * Handles connection state, OAuth simulation, and connection health
 * for social media platforms. Ready for backend integration.
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
 * Connect to a platform (simulates OAuth flow)
 * In production, this would redirect to OAuth provider
 */
export async function connectPlatform(
  platform: PlatformType,
  mockData?: {
    userId?: string;
    username?: string;
    accessToken?: string;
  }
): Promise<PlatformConnection> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const connections = getPlatformConnections();

  // Simulate successful OAuth connection
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days

  // Generate mock username and profile URL
  const username = mockData?.username || `screenrender_user${Math.floor(Math.random() * 1000)}`;

  // Generate platform-specific profile URLs
  const profileUrls: Record<PlatformType, string> = {
    Instagram: `https://www.instagram.com/${username.replace('@', '')}`,
    Facebook: `https://www.facebook.com/${mockData?.userId || `user.${Math.random().toString(36).substr(2, 9)}`}`,
    Threads: `https://www.threads.net/@${username.replace('@', '')}`,
    TikTok: `https://www.tiktok.com/@${username.replace('@', '')}`,
    X: `https://x.com/${username.replace('@', '')}`,
    YouTube: `https://youtube.com/@${username.replace('@', '')}`,
    Pinterest: `https://www.pinterest.com/${username.replace('@', '')}`,
  };

  const connection: PlatformConnection = {
    platform,
    connected: true,
    connectedAt: now,
    lastSync: now,
    accessToken: mockData?.accessToken || `mock_access_token_${Date.now()}`,
    refreshToken: `mock_refresh_token_${Date.now()}`,
    expiresAt,
    userId: mockData?.userId || `user_${Math.random().toString(36).substr(2, 9)}`,
    username: username.startsWith('@') ? username : `@${username}`,
    profileUrl: profileUrls[platform],
  };

  connections[platform] = connection;
  saveConnections(connections);

  return connection;
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

/**
 * Refresh platform connection (simulate token refresh)
 */
export async function refreshPlatformConnection(platform: PlatformType): Promise<PlatformConnection> {
  const connection = getPlatformConnection(platform);

  if (!connection.connected) {
    throw new Error('Platform is not connected');
  }

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const connections = getPlatformConnections();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  connections[platform] = {
    ...connection,
    lastSync: now,
    accessToken: `mock_access_token_${Date.now()}`,
    expiresAt,
    error: undefined,
  };

  saveConnections(connections);
  return connections[platform];
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

  // Check token expiration
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

    if (daysUntilExpiry < 7) {
      return {
        health: 'warning',
        message: `Token expires in ${daysUntilExpiry} days`,
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
 * Simulate platform API health check
 */
export async function checkPlatformHealth(platform: PlatformType): Promise<boolean> {
  const connection = getPlatformConnection(platform);

  if (!connection.connected) {
    return false;
  }

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));

  // Randomly simulate success/failure for demo purposes
  // In production, this would be an actual API health check
  return Math.random() > 0.1; // 90% success rate
}

/**
 * Get OAuth authorization URL (for backend integration)
 * This is where you'd redirect users in production
 */
export function getOAuthUrl(platform: PlatformType, redirectUri: string): string {
  const clientIds: Record<PlatformType, string> = {
    Instagram: process.env.INSTAGRAM_CLIENT_ID || 'YOUR_INSTAGRAM_CLIENT_ID',
    Facebook: process.env.FACEBOOK_CLIENT_ID || 'YOUR_FACEBOOK_CLIENT_ID',
    Threads: process.env.THREADS_CLIENT_ID || 'YOUR_THREADS_CLIENT_ID',
    TikTok: process.env.TIKTOK_CLIENT_ID || 'YOUR_TIKTOK_CLIENT_ID',
    X: process.env.X_CLIENT_ID || 'YOUR_X_CLIENT_ID',
    YouTube: process.env.YOUTUBE_CLIENT_ID || 'YOUR_YOUTUBE_CLIENT_ID',
    Pinterest: process.env.PINTEREST_CLIENT_ID || 'YOUR_PINTEREST_CLIENT_ID',
  };

  const scopes: Record<PlatformType, string> = {
    Instagram: 'instagram_basic instagram_content_publish',
    Facebook: 'pages_manage_posts pages_read_engagement',
    Threads: 'threads_basic threads_content_publish',
    TikTok: 'user.info.basic video.list video.upload',
    X: 'tweet.read tweet.write users.read offline.access',
    YouTube: 'youtube.upload youtube.readonly',
    Pinterest: 'boards:read boards:write pins:read pins:write user_accounts:read',
  };

  const authUrls: Record<PlatformType, string> = {
    Instagram: 'https://api.instagram.com/oauth/authorize',
    Facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
    Threads: 'https://threads.net/oauth/authorize',
    TikTok: 'https://www.tiktok.com/auth/authorize',
    X: 'https://twitter.com/i/oauth2/authorize',
    YouTube: 'https://accounts.google.com/o/oauth2/v2/auth',
    Pinterest: 'https://www.pinterest.com/oauth/',
  };

  const params = new URLSearchParams({
    client_id: clientIds[platform],
    redirect_uri: redirectUri,
    scope: scopes[platform],
    response_type: 'code',
    state: `${platform}_${Date.now()}`,
  });

  return `${authUrls[platform]}?${params.toString()}`;
}

/**
 * Handle OAuth callback (for backend integration)
 * This would process the authorization code from OAuth provider
 */
export async function handleOAuthCallback(
  platform: PlatformType,
  code: string,
  state: string
): Promise<PlatformConnection> {
  // In production, this would exchange code for access token via backend
  // For now, simulate the connection
  return connectPlatform(platform);
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