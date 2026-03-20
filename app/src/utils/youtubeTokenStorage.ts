import { getSessionStoredJson, removeSessionStoredValue, setSessionStoredJson } from './secureSessionStorage';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
}

class YouTubeTokenStorage {
  private readonly STORAGE_KEY = 'screndly_youtube_tokens';

  async initialize(): Promise<void> {
    return;
  }

  async saveToken(platform: string, token: StoredToken): Promise<void> {
    const tokens = this.getAllTokensRaw();
    tokens[platform] = token;
    setSessionStoredJson(this.STORAGE_KEY, tokens);
  }

  async getToken(platform: string): Promise<StoredToken | null> {
    const tokens = this.getAllTokensRaw();
    return tokens[platform] ?? null;
  }

  async deleteToken(platform: string): Promise<void> {
    const tokens = this.getAllTokensRaw();
    delete tokens[platform];
    setSessionStoredJson(this.STORAGE_KEY, tokens);
  }

  async deleteAllTokens(): Promise<void> {
    removeSessionStoredValue(this.STORAGE_KEY);
  }

  async hasToken(platform: string): Promise<boolean> {
    const tokens = this.getAllTokensRaw();
    return platform in tokens;
  }

  private getAllTokensRaw(): Record<string, StoredToken> {
    return getSessionStoredJson<Record<string, StoredToken>>(this.STORAGE_KEY) ?? {};
  }
}

export const youtubeTokenStorage = new YouTubeTokenStorage();
