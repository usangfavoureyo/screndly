import { encrypt, decrypt } from './encryption';

console.log('--- STARTING ENCRYPTION TEST ---');

// Mock Env
process.env.ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000000';

try {
    const secret = 'super-secret-api-key';
    const encrypted = encrypt(secret);

    if (encrypted === secret) throw new Error('Encryption failed: Identical to secret');
    if (!encrypted.includes(':')) throw new Error('Encryption failed: Missing IV');

    console.log('✅ Encrypt Success:', encrypted);

    const decrypted = decrypt(encrypted);
    if (decrypted !== secret) throw new Error(`Decryption failed: Expected ${secret}, got ${decrypted}`);

    console.log('✅ Decrypt Success');

    const plain = 'legacy-text';
    const legacy = decrypt(plain);
    if (legacy !== plain) throw new Error('Legacy support failed');

    console.log('✅ Legacy Support Success');
    console.log('--- ALL TESTS PASSED ---');

} catch (e) {
    console.error('❌ TEST FAILED:', e);
    process.exit(1);
}
