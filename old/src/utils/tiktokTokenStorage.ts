/**
 * Encrypted Token Storage for TikTok Credentials
 * 
 * Stores OAuth tokens securely using Web Crypto API
 */

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
  tokenType: string;
  scope: string;
  openId: string;
}

interface EncryptedData {
  iv: string;
  data: string;
}

class TikTokTokenStorage {
  private readonly STORAGE_KEY = 'screndly_tiktok_tokens';
  private encryptionKey: CryptoKey | null = null;

  /**
   * Initialize encryption key
   */
  async initialize(): Promise<void> {
    if (this.encryptionKey) {
      return;
    }

    const keyMaterial = await this.getKeyMaterial();
    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('screndly-tiktok-salt-v1'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Save encrypted token
   */
  async saveToken(platform: string, token: StoredToken): Promise<void> {
    await this.initialize();
    
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const encrypted = await this.encrypt(JSON.stringify(token));
    
    const tokens = this.getAllTokensRaw();
    tokens[platform] = encrypted;
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tokens));
  }

  /**
   * Get decrypted token
   */
  async getToken(platform: string): Promise<StoredToken | null> {
    await this.initialize();
    
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const tokens = this.getAllTokensRaw();
    const encrypted = tokens[platform];
    
    if (!encrypted) {
      return null;
    }

    try {
      const decrypted = await this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to decrypt token:', error);
      return null;
    }
  }

  /**
   * Delete token
   */
  async deleteToken(platform: string): Promise<void> {
    const tokens = this.getAllTokensRaw();
    delete tokens[platform];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tokens));
  }

  /**
   * Delete all tokens
   */
  async deleteAllTokens(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Check if token exists
   */
  async hasToken(platform: string): Promise<boolean> {
    const tokens = this.getAllTokensRaw();
    return platform in tokens;
  }

  /**
   * Get all raw (encrypted) tokens
   */
  private getAllTokensRaw(): Record<string, EncryptedData> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      return {};
    }

    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  }

  /**
   * Encrypt data using AES-GCM
   */
  private async encrypt(data: string): Promise<EncryptedData> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      this.encryptionKey,
      encodedData
    );

    return {
      iv: this.arrayBufferToBase64(iv),
      data: this.arrayBufferToBase64(encrypted),
    };
  }

  /**
   * Decrypt data using AES-GCM
   */
  private async decrypt(encrypted: EncryptedData): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = this.base64ToArrayBuffer(encrypted.iv);
    const data = this.base64ToArrayBuffer(encrypted.data);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      this.encryptionKey,
      data
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Get key material for encryption
   */
  private async getKeyMaterial(): Promise<CryptoKey> {
    const password = process.env.ENCRYPTION_SECRET || 'screndly-tiktok-default-secret-change-in-production';
    
    return await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const tiktokTokenStorage = new TikTokTokenStorage();
