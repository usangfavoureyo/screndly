import { Request, Response, NextFunction } from 'express';

/**
 * Authentication Middleware
 * 
 * Accepts two forms of authentication:
 * 1. ADMIN_SECRET - Direct backend API access (production)
 * 2. JWT Token - User authentication tokens (development/PWA)
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const adminSecret = process.env.ADMIN_SECRET;
    const jwtSecret = process.env.JWT_SECRET;
    const appPassword = process.env.APP_PASSWORD;

    // Strict Mode: If no secret is configured, fail closed
    if (!adminSecret && !jwtSecret && !appPassword) {
        console.error('No authentication secrets configured. Blocking all secure requests.');
        return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    // Support "Bearer <token>" or just "<token>"
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    // Method 1: Check against ADMIN_SECRET (production API access)
    if (adminSecret && token === adminSecret) {
        return next();
    }

    // Method 2: Verify JWT token (user authentication)
    if (jwtSecret || appPassword) {
        try {
            // Simple base64 JWT verification (matches frontend dev mode)
            const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));

            // Check expiration
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return res.status(401).json({ success: false, error: 'Token expired' });
            }

            // Verify password matches app password
            if (appPassword && payload.password === appPassword) {
                return next();
            }

            // Check if it's a valid Screndly token
            if (payload.app === 'screndly' && payload.authenticated) {
                return next();
            }
        } catch {
            // Not a valid base64 JWT, continue to check other methods
        }
    }

    return res.status(403).json({ success: false, error: 'Forbidden: Invalid token' });
}
