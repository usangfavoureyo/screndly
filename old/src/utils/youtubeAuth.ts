/**
 * YouTube OAuth 2.0 Authentication
 * 
 * Implements OAuth 2.0 Authorization Code Flow with PKCE
 * 
 * Reference: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
 */

import { youtubeTokenStorage } from './youtubeTokenStorage';

// Required OAuth scopes
export const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

// OAuth configuration
const OAUTH_CONFIG = {
  clientId: process.env.YOUTUBE_CLIENT_ID || '',
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
  redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/auth/youtube/callback',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
};

interface OAuthState {
  returnTo: string;
  timestamp: number;
  csrfState: string;
  codeVerifier: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export class YouTubeAuth {
  private stateStore: Map<string, OAuthState> = new Map();

  /**
   * Generate OAuth authorization URL with PKCE
   */
  async getAuthorizationUrl(returnTo: string = '/'): Promise<string> {
    const state = this.generateRandomString(32);
    const csrfState = this.generateRandomString(32);
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store state
    this.stateStore.set(state, {
      returnTo,
      timestamp: Date.now(),
      csrfState,
      codeVerifier,
    });

    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      response_type: 'code',
      scope: REQUIRED_SCOPES.join(' '),
      state: csrfState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent screen to ensure refresh token
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
      const tokenResponse = await this.exchangeCodeForToken(code, storedState.codeVerifier);

      // Store tokens
      await youtubeTokenStorage.saveToken('youtube', {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || '',
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        tokenType: tokenResponse.token_type,
        scope: tokenResponse.scope,
      });

      return { success: true, returnTo: storedState.returnTo };
    } catch (error: any) {
      return { success: false, returnTo: storedState.returnTo, error: error.message };
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: OAUTH_CONFIG.redirectUri,
    });

    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || error.error || 'Failed to exchange code for token');
    }

    return await response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<boolean> {
    const token = await youtubeTokenStorage.getToken('youtube');
    if (!token || !token.refreshToken) {
      return false;
    }

    try {
      const params = new URLSearchParams({
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
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

      // Update stored token (keep existing refresh token if not provided)
      await youtubeTokenStorage.saveToken('youtube', {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || token.refreshToken,
        expiresAt: Date.now() + (data.expires_in * 1000),
        tokenType: data.token_type,
        scope: data.scope,
      });

      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }

  /**
   * Refresh token if expiring soon (within 5 minutes)
   */
  async refreshTokenIfNeeded(): Promise<boolean> {
    const token = await youtubeTokenStorage.getToken('youtube');
    if (!token) {
      return false;
    }

    const fiveMinutesMs = 5 * 60 * 1000;
    if (token.expiresAt - Date.now() < fiveMinutesMs) {
      return await this.refreshToken();
    }

    return false;
  }

  /**
   * Revoke access token
   */
  async revokeToken(): Promise<void> {
    const token = await youtubeTokenStorage.getToken('youtube');
    if (!token) {
      return;
    }

    try {
      const params = new URLSearchParams({
        token: token.accessToken,
      });

      await fetch(`${OAUTH_CONFIG.revokeUrl}?${params.toString()}`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to revoke token:', error);
    }

    await youtubeTokenStorage.deleteToken('youtube');
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await youtubeTokenStorage.getToken('youtube');
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
  }> {
    const token = await youtubeTokenStorage.getToken('youtube');
    if (!token) {
      return { hasToken: false };
    }

    return {
      hasToken: true,
      expiresAt: token.expiresAt,
      expiresIn: Math.floor((token.expiresAt - Date.now()) / 1000),
      scope: token.scope,
    };
  }

  /**
   * Generate random string
   */
  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }
    return result;
  }

  /**
   * Generate PKCE code challenge from code verifier
   */
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to base64url
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

// Export singleton instance
export const youtubeAuth = new YouTubeAuth();

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. Create Google Cloud Project
 *    - Go to https://console.cloud.google.com/
 *    - Create new project or select existing
 *    - Enable YouTube Data API v3
 * 
 * 2. Configure OAuth Consent Screen
 *    - Go to APIs & Services → OAuth consent screen
 *    - User Type: External (for public use) or Internal (workspace only)
 *    - App name: Screndly
 *    - User support email: support@screndly.com
 *    - Developer contact: dev@screndly.com
 *    - Add scopes: youtube.upload, youtube, youtube.force-ssl
 *    - Add test users (for testing before verification)
 * 
 * 3. Create OAuth 2.0 Credentials
 *    - Go to APIs & Services → Credentials
 *    - Create OAuth 2.0 Client ID
 *    - Application type: Web application
 *    - Name: Screndly Web App
 *    - Authorized redirect URIs:
 *      - http://localhost:3000/auth/youtube/callback (development)
 *      - https://screndly.com/auth/youtube/callback (production)
 * 
 * 4. Get Credentials
 *    - Copy Client ID
 *    - Copy Client Secret
 * 
 * 5. Set Environment Variables
 *    YOUTUBE_CLIENT_ID=your_client_id
 *    YOUTUBE_CLIENT_SECRET=your_client_secret
 *    YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback
 * 
 * 6. Submit for Verification (IMPORTANT)
 *    - Unverified apps limited to 100 users
 *    - For production, submit OAuth consent screen for verification
 *    - Go to OAuth consent screen → Submit for verification
 *    - Provide:
 *      - Privacy Policy URL
 *      - Terms of Service URL
 *      - App homepage
 *      - Use case justification
 *      - Demo video (YouTube upload flow)
 *    - Review time: 3-7 business days
 * 
 * 7. Quota Increase (Optional)
 *    - Default quota: 10,000 units/day
 *    - 1 upload = 1,600 units (6 uploads/day)
 *    - Request quota increase:
 *      - Go to YouTube Data API → Quotas
 *      - Click "Request quota increase"
 *      - Explain use case and expected volume
 *      - May require additional verification
 */
