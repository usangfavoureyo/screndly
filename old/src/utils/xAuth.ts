/**
 * X (Twitter) OAuth 2.0 Authentication with PKCE
 * 
 * Implements OAuth 2.0 Authorization Code Flow with PKCE
 * 
 * Reference: https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
 */

import { xTokenStorage } from './xTokenStorage';

// Required OAuth scopes
export const REQUIRED_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access', // For refresh tokens
];

// OAuth configuration
const OAUTH_CONFIG = {
  clientId: process.env.X_CLIENT_ID || '',
  clientSecret: process.env.X_CLIENT_SECRET || '', // Optional for PKCE
  redirectUri: process.env.X_REDIRECT_URI || 'http://localhost:3000/auth/x/callback',
  authUrl: 'https://twitter.com/i/oauth2/authorize',
  tokenUrl: 'https://api.twitter.com/2/oauth2/token',
  revokeUrl: 'https://api.twitter.com/2/oauth2/revoke',
};

interface OAuthState {
  returnTo: string;
  timestamp: number;
  codeVerifier: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export class XAuth {
  private stateStore: Map<string, OAuthState> = new Map();

  /**
   * Generate OAuth authorization URL with PKCE
   */
  async getAuthorizationUrl(returnTo: string = '/'): Promise<string> {
    const state = this.generateRandomString(32);
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store state and code verifier
    this.stateStore.set(state, {
      returnTo,
      timestamp: Date.now(),
      codeVerifier,
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: OAUTH_CONFIG.clientId,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      scope: REQUIRED_SCOPES.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
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
    // Verify state
    const storedState = this.stateStore.get(state);
    if (!storedState) {
      return { success: false, returnTo: '/', error: 'Invalid state parameter' };
    }

    // Check state expiration (10 minutes)
    if (Date.now() - storedState.timestamp > 10 * 60 * 1000) {
      this.stateStore.delete(state);
      return { success: false, returnTo: '/', error: 'State expired' };
    }

    const codeVerifier = storedState.codeVerifier;
    this.stateStore.delete(state);

    try {
      // Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier);

      // Store tokens
      await xTokenStorage.saveToken('x', {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
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
  private async exchangeCodeForToken(
    code: string,
    codeVerifier: string
  ): Promise<TokenResponse> {
    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: OAUTH_CONFIG.clientId,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code_verifier: codeVerifier,
    });

    // Add client secret if available (not required for PKCE)
    if (OAUTH_CONFIG.clientSecret) {
      params.append('client_secret', OAUTH_CONFIG.clientSecret);
    }

    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Failed to exchange code for token');
    }

    return await response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<boolean> {
    const token = await xTokenStorage.getToken('x');
    if (!token || !token.refreshToken) {
      return false;
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: OAUTH_CONFIG.clientId,
      });

      if (OAUTH_CONFIG.clientSecret) {
        params.append('client_secret', OAUTH_CONFIG.clientSecret);
      }

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

      const tokenResponse: TokenResponse = await response.json();

      // Update stored token
      await xTokenStorage.saveToken('x', {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || token.refreshToken,
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        tokenType: tokenResponse.token_type,
        scope: tokenResponse.scope,
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
    const token = await xTokenStorage.getToken('x');
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
    const token = await xTokenStorage.getToken('x');
    if (!token) {
      return;
    }

    try {
      const params = new URLSearchParams({
        token: token.accessToken,
        client_id: OAUTH_CONFIG.clientId,
      });

      if (OAUTH_CONFIG.clientSecret) {
        params.append('client_secret', OAUTH_CONFIG.clientSecret);
      }

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

    await xTokenStorage.deleteToken('x');
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await xTokenStorage.getToken('x');
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
    const token = await xTokenStorage.getToken('x');
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
   * Generate random string for state and code verifier
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
   * Generate code challenge from verifier (SHA-256)
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    
    // Base64URL encode
    return this.base64UrlEncode(hash);
  }

  /**
   * Base64URL encode
   */
  private base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

// Export singleton instance
export const xAuth = new XAuth();

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. Create X Developer Account
 *    - Go to https://developer.twitter.com/en/portal/dashboard
 *    - Create a new Project and App
 * 
 * 2. Configure App Settings
 *    - Set App permissions to "Read and Write"
 *    - Enable OAuth 2.0
 *    - Add callback URL: http://localhost:3000/auth/x/callback
 * 
 * 3. Get Credentials
 *    - Copy Client ID
 *    - Generate Client Secret (optional for PKCE)
 * 
 * 4. Set Environment Variables
 *    X_CLIENT_ID=your_client_id
 *    X_CLIENT_SECRET=your_client_secret (optional)
 *    X_REDIRECT_URI=http://localhost:3000/auth/x/callback
 * 
 * 5. Required Scopes
 *    - tweet.read: Read tweets
 *    - tweet.write: Create tweets
 *    - users.read: Get user info
 *    - offline.access: Get refresh tokens
 */
