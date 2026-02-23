/**
 * JWT Verification API - Vercel Serverless Function
 * Validates JWT tokens on app load
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token is required' });
  }

  if (!JWT_SECRET) {
    console.error('Missing JWT_SECRET environment variable');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Verify JWT signature and expiry
    const decoded = verify(token, JWT_SECRET);

    // Validate payload structure
    if (
      typeof decoded === 'object' &&
      decoded.app === 'screndly' &&
      decoded.authenticated === true
    ) {
      return res.status(200).json({
        valid: true,
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
      });
    }

    return res.status(401).json({ valid: false, error: 'Invalid token payload' });
  } catch (error: any) {
    // JWT verification failed (expired, invalid signature, etc.)
    return res.status(401).json({
      valid: false,
      error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
      code: error.name,
    });
  }
}
