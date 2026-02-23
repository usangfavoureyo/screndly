/**
 * Meta OAuth and Token Management
 * 
 * Handles:
 * - OAuth flow (authorization code grant)
 * - Token exchange
 * - Long-lived token generation
 * - Token refresh
 * 
 * Reference: https://developers.facebook.com/docs/facebook-login/guides/access-tokens
 */

import { metaTokenStorage } from './metaTokenStorage';

// Required OAuth scopes for Screndly
// These must be approved in Meta App Review
export const REQUIRED_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'pages_read_engagement',
  'pages_show_list',
  'pages_manage_posts',
  'pages_manage_metadata',
  'pages_read_user_content',
  'publish_video',
  'business_management',
];

// OAuth configuration
const OAUTH_CONFIG = {
  clientId: process.env.META_APP_ID || '',
  clientSecret: process.env.META_APP_SECRET || '',
  redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:3000/auth/meta/callback',
  authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
  graphApiBase: 'https://graph.facebook.com/v18.0',
};

interface OAuthState {
  returnTo: string;
  timestamp: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class MetaAuth {
  private stateStore: Map<string, OAuthState> = new Map();

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(returnTo: string = '/'): string {
    const state = this.generateState(returnTo);
    
    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      state,
      scope: REQUIRED_SCOPES.join(','),
      response_type: 'code',
    });

    return `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string, state: string): Promise<{ success: boolean; returnTo: string; error?: string }> {
    // Verify state
    const storedState = this.stateStore.get(state);
    if (!storedState) {
      return { success: false, returnTo: '/', error: 'Invalid state parameter' };
    }

    // Check state expiration (5 minutes)
    if (Date.now() - storedState.timestamp > 5 * 60 * 1000) {
      this.stateStore.delete(state);
      return { success: false, returnTo: '/', error: 'State expired' };
    }

    this.stateStore.delete(state);

    try {
      // Exchange code for access token
      const shortLivedToken = await this.exchangeCodeForToken(code);
      
      // Exchange short-lived token for long-lived token
      const longLivedToken = await this.getLongLivedToken(shortLivedToken.access_token);
      
      // Store encrypted token
      await metaTokenStorage.saveToken('meta', {
        accessToken: longLivedToken.access_token,
        expiresAt: Date.now() + (longLivedToken.expires_in * 1000),
        tokenType: longLivedToken.token_type,
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
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code,
    });

    const response = await fetch(`${OAUTH_CONFIG.tokenUrl}?${params.toString()}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to exchange code for token');
    }

    return await response.json();
  }

  /**
   * Exchange short-lived token for long-lived token
   * Long-lived tokens last ~60 days
   */
  private async getLongLivedToken(shortLivedToken: string): Promise<LongLivedTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(`${OAUTH_CONFIG.tokenUrl}?${params.toString()}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get long-lived token');
    }

    return await response.json();
  }

  /**
   * Refresh access token if expiring soon
   */
  async refreshTokenIfNeeded(): Promise<boolean> {
    const token = await metaTokenStorage.getToken('meta');
    if (!token) {
      return false;
    }

    // Refresh if expiring within 7 days
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (token.expiresAt - Date.now() < sevenDaysMs) {
      try {
        const newToken = await this.getLongLivedToken(token.accessToken);
        
        await metaTokenStorage.saveToken('meta', {
          accessToken: newToken.access_token,
          expiresAt: Date.now() + (newToken.expires_in * 1000),
          tokenType: newToken.token_type,
        });

        return true;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Revoke access token
   */
  async revokeToken(): Promise<void> {
    const token = await metaTokenStorage.getToken('meta');
    if (!token) {
      return;
    }

    try {
      const url = `${OAUTH_CONFIG.graphApiBase}/me/permissions`;
      await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
        },
      });
    } catch (error) {
      console.error('Failed to revoke token:', error);
    }

    await metaTokenStorage.deleteToken('meta');
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await metaTokenStorage.getToken('meta');
    if (!token) {
      return false;
    }

    // Check if token is expired
    if (Date.now() >= token.expiresAt) {
      await metaTokenStorage.deleteToken('meta');
      return false;
    }

    return true;
  }

  /**
   * Get token info for debugging
   */
  async getTokenInfo(): Promise<{
    hasToken: boolean;
    expiresAt?: number;
    expiresIn?: number;
  }> {
    const token = await metaTokenStorage.getToken('meta');
    if (!token) {
      return { hasToken: false };
    }

    return {
      hasToken: true,
      expiresAt: token.expiresAt,
      expiresIn: Math.floor((token.expiresAt - Date.now()) / 1000),
    };
  }

  /**
   * Generate and store state parameter
   */
  private generateState(returnTo: string): string {
    const state = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);
    
    this.stateStore.set(state, {
      returnTo,
      timestamp: Date.now(),
    });

    // Clean up old states (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of this.stateStore.entries()) {
      if (value.timestamp < tenMinutesAgo) {
        this.stateStore.delete(key);
      }
    }

    return state;
  }
}

// Export singleton instance
export const metaAuth = new MetaAuth();

/**
 * Sample API calls for Meta App Review
 * 
 * Include these in your app review submission to demonstrate how you use each permission:
 * 
 * 1. instagram_basic:
 *    GET /{ig-user-id}?fields=id,username
 * 
 * 2. instagram_content_publish:
 *    POST /{ig-user-id}/media
 *    POST /{ig-user-id}/media_publish
 * 
 * 3. instagram_manage_insights:
 *    GET /{ig-media-id}/insights?metric=engagement,impressions,reach
 * 
 * 4. pages_read_engagement:
 *    GET /{page-id}?fields=engagement
 * 
 * 5. pages_show_list:
 *    GET /me/accounts
 * 
 * 6. pages_manage_posts:
 *    POST /{page-id}/feed
 *    DELETE /{post-id}
 * 
 * 7. pages_manage_metadata:
 *    POST /{page-id}
 * 
 * 8. pages_read_user_content:
 *    GET /{page-id}/posts
 * 
 * 9. publish_video:
 *    POST /{page-id}/videos
 * 
 * 10. business_management:
 *     GET /{business-id}
 */
