import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env';

const router = Router();
const { JWT_SECRET, APP_PASSWORD } = env;

// POST /api/auth/login
router.post('/login', (req, res) => {
    try {
        const { password } = req.body;

        if (password === APP_PASSWORD) {
            const token = jwt.sign(
                { authenticated: true, app: 'screndly' },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            return res.json({ success: true, token });
        }

        return res.status(401).json({ success: false, error: 'Invalid password' });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// POST /api/auth/verify
router.post('/verify', (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ valid: false, error: 'Token required' });
        }

        try {
            jwt.verify(token, JWT_SECRET);
            return res.json({ valid: true });
        } catch (err) {
            return res.status(401).json({ valid: false, error: 'Invalid token' });
        }
    } catch (error) {
        return res.status(500).json({ valid: false, error: 'Verification error' });
    }
});

export default router;
