/**
 * TikTok OAuth 2.0 Authentication
 * 
 * Implements OAuth 2.0 Authorization Code Flow
 * 
 * Reference: https://developers.tiktok.com/doc/login-kit-web
 */

import { tiktokTokenStorage } from './tiktokTokenStorage';

// Required OAuth scopes
export const REQUIRED_SCOPES = [
  'user.info.basic',
  'video.publish',
  'video.upload',
];

// OAuth configuration
const OAUTH_CONFIG = {
  clientKey: process.env.TIKTOK_CLIENT_KEY || '',
  clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  redirectUri: process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/auth/tiktok/callback',
  authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
  tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
  revokeUrl: 'https://open.tiktokapis.com/v2/oauth/revoke/',
};

interface OAuthState {
  returnTo: string;
  timestamp: number;
  csrfState: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  open_id: string;
}

export class TikTokAuth {
  private stateStore: Map<string, OAuthState> = new Map();

  /**
   * Generate OAuth authorization URL
   */
  async getAuthorizationUrl(returnTo: string = '/'): Promise<string> {
    const state = this.generateRandomString(32);
    const csrfState = this.generateRandomString(32);

    // Store state
    this.stateStore.set(state, {
      returnTo,
      timestamp: Date.now(),
      csrfState,
    });

    const params = new URLSearchParams({
      client_key: OAUTH_CONFIG.clientKey,
      scope: REQUIRED_SCOPES.join(','),
      response_type: 'code',
      redirect_uri: OAUTH_CONFIG.redirectUri,
      state: csrfState,
    });

    return `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{ success: boolean; returnTo: string; error?: string }> {
    // Find matching stored state
    let storedState: OAuthState | undefined;
    let stateKey: string | undefined;

    for (const [key, value] of this.stateStore.entries()) {
      if (value.csrfState === state) {
        storedState = value;
        stateKey = key;
        break;
      }
    }

    if (!storedState || !stateKey) {
      return { success: false, returnTo: '/', error: 'Invalid state parameter' };
    }

    // Check state expiration (10 minutes)
    if (Date.now() - storedState.timestamp > 10 * 60 * 1000) {
      this.stateStore.delete(stateKey);
      return { success: false, returnTo: '/', error: 'State expired' };
    }

    this.stateStore.delete(stateKey);

    try {
      // Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(code);

      // Store tokens
      await tiktokTokenStorage.saveToken('tiktok', {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        refreshExpiresAt: Date.now() + (tokenResponse.refresh_expires_in * 1000),
        tokenType: tokenResponse.token_type,
        scope: tokenResponse.scope,
        openId: tokenResponse.open_id,
      });

      return { success: true, returnTo: storedState.returnTo };
    } catch (error: any) {
      return { success: false, returnTo: storedState.returnTo, error: error.message };
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      client_key: OAUTH_CONFIG.clientKey,
      client_secret: OAUTH_CONFIG.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: OAUTH_CONFIG.redirectUri,
    });

    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || error.message || 'Failed to exchange code for token');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return data.data;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<boolean> {
    const token = await tiktokTokenStorage.getToken('tiktok');
    if (!token || !token.refreshToken) {
      return false;
    }

    try {
      const params = new URLSearchParams({
        client_key: OAUTH_CONFIG.clientKey,
        client_secret: OAUTH_CONFIG.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      });

      const response = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      const tokenResponse: TokenResponse = data.data;

      // Update stored token
      await tiktokTokenStorage.saveToken('tiktok', {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        refreshExpiresAt: Date.now() + (tokenResponse.refresh_expires_in * 1000),
        tokenType: tokenResponse.token_type,
        scope: tokenResponse.scope,
        openId: tokenResponse.open_id,
      });

      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }

  /**
   * Refresh token if expiring soon (within 1 hour)
   */
  async refreshTokenIfNeeded(): Promise<boolean> {
    const token = await tiktokTokenStorage.getToken('tiktok');
    if (!token) {
      return false;
    }

    const oneHourMs = 60 * 60 * 1000;
    if (token.expiresAt - Date.now() < oneHourMs) {
      return await this.refreshToken();
    }

    return false;
  }

  /**
   * Revoke access token
   */
  async revokeToken(): Promise<void> {
    const token = await tiktokTokenStorage.getToken('tiktok');
    if (!token) {
      return;
    }

    try {
      const params = new URLSearchParams({
        client_key: OAUTH_CONFIG.clientKey,
        client_secret: OAUTH_CONFIG.clientSecret,
        token: token.accessToken,
      });

      await fetch(OAUTH_CONFIG.revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
    } catch (error) {
      console.error('Failed to revoke token:', error);
    }

    await tiktokTokenStorage.deleteToken('tiktok');
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await tiktokTokenStorage.getToken('tiktok');
    if (!token) {
      return false;
    }

    // Check if token is expired
    if (Date.now() >= token.expiresAt) {
      // Try to refresh
      const refreshed = await this.refreshToken();
      return refreshed;
    }

    return true;
  }

  /**
   * Get token info
   */
  async getTokenInfo(): Promise<{
    hasToken: boolean;
    expiresAt?: number;
    expiresIn?: number;
    scope?: string;
    openId?: string;
  }> {
    const token = await tiktokTokenStorage.getToken('tiktok');
    if (!token) {
      return { hasToken: false };
    }

    return {
      hasToken: true,
      expiresAt: token.expiresAt,
      expiresIn: Math.floor((token.expiresAt - Date.now()) / 1000),
      scope: token.scope,
      openId: token.openId,
    };
  }

  /**
   * Generate random string
   */
  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }
    return result;
  }
}

// Export singleton instance
export const tiktokAuth = new TikTokAuth();

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. Create TikTok Developer Account
 *    - Go to https://developers.tiktok.com/
 *    - Sign up with your TikTok account
 *    - Complete developer registration
 * 
 * 2. Create App
 *    - Go to Developer Portal → My Apps
 *    - Click "Create App"
 *    - App Name: Screndly
 *    - App Description: Automated movie trailer posting
 * 
 * 3. Configure App Settings
 *    - Add redirect URL: http://localhost:3000/auth/tiktok/callback
 *    - Request scopes: user.info.basic, video.publish, video.upload
 * 
 * 4. Get Credentials
 *    - Copy Client Key
 *    - Copy Client Secret
 * 
 * 5. Submit for Review (IMPORTANT)
 *    - TikTok requires app review before production use
 *    - Submit app for "Login Kit" and "Content Posting API" review
 *    - Provide use case documentation
 *    - Show demo video of integration
 *    - Review typically takes 3-5 business days
 * 
 * 6. Set Environment Variables
 *    TIKTOK_CLIENT_KEY=your_client_key
 *    TIKTOK_CLIENT_SECRET=your_client_secret
 *    TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback
 * 
 * 7. Required Scopes
 *    - user.info.basic: Get user profile
 *    - video.publish: Publish videos
 *    - video.upload: Upload video files
 */
