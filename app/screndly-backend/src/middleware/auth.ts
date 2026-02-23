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
    const authHeader = req.headers.authorization;
    const { ADMIN_SECRET, JWT_SECRET, APP_PASSWORD } = env;

    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    // Support "Bearer <token>" or just "<token>"
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    // Method 1: Check against ADMIN_SECRET (production API access)
    if (ADMIN_SECRET && token === ADMIN_SECRET) {
        return next();
    }

    // Method 2: Verify JWT token (user authentication)
    try {
        // Attempt to verify as a standard JWT first (Production Mode)
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded && decoded.app === 'screndly') {
            return next();
        }
    } catch (err) {
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
            // Failed both signed JWT and base64 decode
        }
    }

    return res.status(403).json({ success: false, error: 'Forbidden: Invalid token' });
}
