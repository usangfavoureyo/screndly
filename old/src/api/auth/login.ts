/**
 * Secure Authentication API - Vercel Serverless Function
 * Validates password server-side and returns JWT token
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sign } from 'jsonwebtoken';

// Rate limiting storage (in-memory, resets on cold start)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const JWT_SECRET = process.env.JWT_SECRET!;
const APP_PASSWORD = process.env.APP_PASSWORD!;
const JWT_EXPIRY = '7d'; // Token expires in 7 days

/**
 * Rate limiting check
 */
function checkRateLimit(ip: string): { allowed: boolean; remainingAttempts?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (!attempt || now > attempt.resetAt) {
    // Reset or create new tracking
    loginAttempts.set(ip, { count: 0, resetAt: now + LOCKOUT_DURATION });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  if (attempt.count >= MAX_ATTEMPTS) {
    const minutesRemaining = Math.ceil((attempt.resetAt - now) / 60000);
    return { allowed: false, remainingAttempts: 0 };
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - attempt.count };
}

/**
 * Record failed login attempt
 */
function recordFailedAttempt(ip: string) {
  const attempt = loginAttempts.get(ip);
  if (attempt) {
    attempt.count += 1;
  }
}

/**
 * Clear login attempts on success
 */
function clearAttempts(ip: string) {
  loginAttempts.delete(ip);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get client IP for rate limiting
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
             (req.headers['x-real-ip'] as string) || 
             'unknown';

  // Check rate limit
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }

  // Validate request body
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    recordFailedAttempt(ip);
    return res.status(400).json({
      error: 'Password is required',
      remainingAttempts: rateLimit.remainingAttempts! - 1,
    });
  }

  // Validate environment variables
  if (!JWT_SECRET || !APP_PASSWORD) {
    console.error('Missing JWT_SECRET or APP_PASSWORD environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Validate password (timing-safe comparison)
  const isValid = timingSafeEqual(password, APP_PASSWORD);

  if (!isValid) {
    recordFailedAttempt(ip);
    const remainingAttempts = rateLimit.remainingAttempts! - 1;
    
    return res.status(401).json({
      error: 'Invalid password',
      remainingAttempts,
      code: 'INVALID_PASSWORD',
    });
  }

  // Success - clear attempts and generate JWT
  clearAttempts(ip);

  const token = sign(
    {
      app: 'screndly',
      authenticated: true,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRY,
    }
  );

  return res.status(200).json({
    success: true,
    token,
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}
