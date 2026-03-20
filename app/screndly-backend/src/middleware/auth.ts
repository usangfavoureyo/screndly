import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env';

/**
 * Authentication Middleware
 * 
 * Accepts two forms of authentication:
 * 1. ADMIN_SECRET - Direct backend API access (production)
 * 2. JWT Token - User authentication tokens (production/development)
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
    // Handle OPTIONS preflight requests automatically (Browser safety)
    if (req.method === 'OPTIONS') {
        return next();
    }

    const authHeader = req.headers.authorization;
    const { ADMIN_SECRET, JWT_SECRET, APP_PASSWORD } = env;

    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    // Support "Bearer <token>" or just "<token>"
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const token = rawToken.trim(); // Remove any accidental whitespace
    const version = req.headers['x-screndly-version'] || 'legacy';

    // 1. Explicitly reject "null" or poison string tokens
    const poisonStrings = ['null', 'undefined', '[object object]', 'nan', 'false', 'true'];
    if (poisonStrings.includes(token.toLowerCase())) {
        console.error(`[Auth Alert] [v:${version}] Poison token detected in header: "${token}". Rejecting.`);
        // Set a hint for the frontend that it's stale
        res.setHeader('X-Screndly-Hint', 'STALE_CLIENT_DETECTED');
        return res.status(401).json({
            success: false,
            error: 'Authentication state corrupted. Please perform a hard-refresh (Ctrl+Shift+R).',
            code: 'POISON_TOKEN',
            version: version
        });
    }

    // Method 1: Check against ADMIN_SECRET (production API access)
    if (ADMIN_SECRET && token === ADMIN_SECRET) {
        return next();
    }

    // Method 2: Verify JWT token (user authentication)
    try {
        if (!JWT_SECRET) {
            console.error('[Auth Alert] JWT_SECRET is missing or empty in environment!');
        }

        // Attempt to verify as a standard JWT first (Production Mode)
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        if (decoded && (decoded.app === 'screndly' || decoded.authenticated)) {
            return next();
        }
    } catch (err: any) {
        // Log verification failure details with specificity
        const isLikelySignedJWT = token.includes('.');
        if (isLikelySignedJWT) {
            let reason = 'Unknown verification error';
            if (err.name === 'TokenExpiredError') reason = 'Token Expired';
            if (err.name === 'JsonWebTokenError') reason = `Invalid Signature / Malformed (${err.message})`;

            console.error(`[Auth Alert] JWT Verification failed (${reason}) for ${req.originalUrl}. Secret length: ${JWT_SECRET?.length || 0}. Token preview: ${token.substring(0, 15)}...`);
        }

        // Not a valid signed JWT, fallback to base64 check for dev-mode tokens
        try {
            const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));

            // Check expiration
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return res.status(401).json({ success: false, error: 'Token expired' });
            }

            // Verify password matches app password (Dev fallback)
            if (APP_PASSWORD && payload.password === APP_PASSWORD) {
                return next();
            }

        } catch {
            // Failed base64 decode
            if (!isLikelySignedJWT) {
                console.warn(`[Auth Alert] Token is neither valid JWT nor valid Base64 for ${req.originalUrl}`);
            }
        }
    }

    console.error(`[Auth Alert] All auth methods failed for ${req.originalUrl}. Token type: ${token.includes('.') ? 'JWT' : 'Other'}. Preview: ${token.substring(0, 10)}... (Len: ${token.length})`);
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid token' });
}
