import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';
const IV_LENGTH = 16;
// Key length for aes-256-cbc must be 32 bytes
// We will retrieve it from env and ensure it's correct length or hash it

function getKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
        throw new Error('ENCRYPTION_KEY is not defined in environment variables');
    }
    // If key is hex string of length 64 (32 bytes), use it directly
    // Otherwise create a hash to ensure stable 32 byte key
    if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
        return Buffer.from(secret, 'hex');
    }
    // Fallback: scrypt or simple hash. Using sha256 for determinism if user provides a passphrase
    return crypto.createHash('sha256').update(String(secret)).digest();
}

export function encrypt(text: string): string {
    if (!text) return text;
    // Don't double encrypt
    if (text.includes(':')) {
        // Simple heuristic check, real check would be try decrypt
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);

    // Return IV + Encrypted data
    return `${iv.toString(ENCODING)}:${encrypted}`;
}

export function decrypt(text: string): string {
    if (!text) return text;

    const parts = text.split(':');
    if (parts.length !== 2) {
        // Not encrypted or invalid format, return as is (could be legacy plain text)
        return text;
    }

    try {
        const iv = Buffer.from(parts[0], ENCODING);
        const encryptedText = parts[1];
        const key = getKey();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        let decrypted = decipher.update(encryptedText, ENCODING, 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        // Failed to decrypt (wrong key? corrupted?), return original
        console.warn('Failed to decrypt value:', error);
        return text;
    }
}
