/**
 * Encrypted Token Storage for Meta Credentials
 * 
 * Stores OAuth tokens securely using Web Crypto API
 * In production, use a secure backend storage (e.g., encrypted database)
 */

interface StoredToken {
  accessToken: string;
  expiresAt: number;
  tokenType: string;
  refreshToken?: string;
}

interface EncryptedData {
  iv: string;
  data: string;
}

class MetaTokenStorage {
  private readonly STORAGE_KEY = 'screndly_meta_tokens';
  private encryptionKey: CryptoKey | null = null;

  /**
   * Initialize encryption key
   */
  async initialize(): Promise<void> {
    if (this.encryptionKey) {
      return;
    }

    // In production, derive this from a secure server-side secret
    const keyMaterial = await this.getKeyMaterial();
    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('screndly-salt-v1'),
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
   * In production, this should come from a secure server-side secret
   */
  private async getKeyMaterial(): Promise<CryptoKey> {
    // This is a placeholder. In production, use a secure server-generated secret
    const password = process.env.ENCRYPTION_SECRET || 'screndly-default-secret-change-in-production';
    
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

export const metaTokenStorage = new MetaTokenStorage();

/**
 * PRODUCTION SECURITY NOTES:
 * 
 * 1. Token Storage:
 *    - Do NOT store tokens in localStorage in production
 *    - Use secure backend storage (encrypted database)
 *    - Consider using httpOnly cookies for token transport
 * 
 * 2. Encryption:
 *    - Use server-side encryption with a secure key management system (e.g., AWS KMS, HashiCorp Vault)
 *    - Rotate encryption keys regularly
 *    - Never hardcode encryption secrets
 * 
 * 3. Token Lifecycle:
 *    - Implement token rotation
 *    - Set up automatic refresh before expiration
 *    - Log token access for security auditing
 * 
 * 4. Environment Variables:
 *    - Store all secrets in environment variables
 *    - Use different secrets for dev/staging/production
 *    - Never commit secrets to version control
 * 
 * 5. Compliance:
 *    - Follow GDPR/CCPA requirements for data storage
 *    - Implement data retention policies
 *    - Provide user data export/deletion capabilities
 */
