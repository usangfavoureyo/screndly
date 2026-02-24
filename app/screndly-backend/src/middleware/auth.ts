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

    // Log the incoming request for debugging
    console.log(`[Auth] Request: ${req.method} ${req.originalUrl} from Host: ${req.headers.host || req.hostname}`);

    if (!authHeader) {
        console.warn(`[Auth] Missing auth header for ${req.method} ${req.originalUrl}. Headers keys: ${Object.keys(req.headers).join(', ')}`);
        return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    // Support "Bearer <token>" or just "<token>"
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const token = rawToken.trim(); // Remove any accidental whitespace

    // Method 1: Check against ADMIN_SECRET (production API access)
    if (ADMIN_SECRET && token === ADMIN_SECRET) {
        return next();
    }
    // Method 2: Verify JWT token (user authentication)
    try {
        if (!JWT_SECRET) {
            console.error('[Auth] JWT_SECRET is missing or empty in environment!');
        }

        // Attempt to verify as a standard JWT first (Production Mode)
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded && (decoded.app === 'screndly' || decoded.authenticated)) {
            return next();
        }
        console.warn(`[Auth] JWT Decoded but payload invalid for ${req.originalUrl}. Payload:`, JSON.stringify(decoded));
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

            // Check if it's a valid Screndly dev token
            if (payload.app === 'screndly' && payload.authenticated) {
                return next();
            }
        } catch {
            // Failed base64 decode
        }

        if (isLikelySignedJWT) {
            console.warn(`[Auth] JWT Verification totally failed for ${req.method} ${req.originalUrl}: ${err.message}`);
        }
    }

    return res.status(403).json({ success: false, error: 'Forbidden: Invalid token' });
}
