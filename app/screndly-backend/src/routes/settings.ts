import { Router } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { encrypt, decrypt } from '../lib/encryption';

const router = Router();

// Validation Schema for Settings Update
const settingsSchema = z.object({
    // Add specific validations as needed, using record/any for flexibility initially
    // checking against known keys would be better but the settings object is huge
}).passthrough();

// SENSITIVE KEYS LIST
// These keys will be masked on GET and Encrypted on PUT
const SENSITIVE_KEYS = [
    'youtubeKey', 'openaiKey', 'serperKey', 'tmdbKey', 'flash3Key',
    'googleVideoIntelligenceKey', 'shotstackKey', 's3Key',
    'backblazeKeyId', 'backblazeApplicationKey',
    'backblazeVideosKeyId', 'backblazeVideosApplicationKey',
    'backblazeDesignKeyId', 'backblazeDesignApplicationKey',
    'videoGoogleSearchApiKey', 'photopeaApiKey',
    'commentGoogleSearchApiKey'
];

// Mask string for UI
const MASK_STRING = '••••••••••••••••';

// GET /api/settings
// NOW PROTECTED WITH AUTH
router.get('/', authenticate, async (req, res) => {
    try {
        const allSettings = await prisma.setting.findMany();

        // Transform into a single object
        const settingsObject: Record<string, any> = {};
        allSettings.forEach(s => {
            // We store values encrypted in DB.
            // But for the frontend, we just want to know if they are set (masked)
            // OR if they are non-sensitive, return the value.
            // We COULD decrypt everything here, but best practice is to never send secrets to frontend.

            if (SENSITIVE_KEYS.includes(s.key)) {
                // Check if value exists and is not empty to show mask
                const valueStr = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
                settingsObject[s.key] = valueStr && valueStr.length > 0 ? MASK_STRING : '';
            } else {
                settingsObject[s.key] = s.value;
            }
        });

        res.json({ success: true, data: settingsObject });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch settings' } });
    }
});

// PUT /api/settings
// NOW PROTECTED WITH AUTH
router.put('/', authenticate, async (req, res) => {
    try {
        const updates = req.body;

        const promises = Object.entries(updates).map(async ([key, value]) => {
            // 1. Skip if value is the mask string (user didn't change it)
            if (typeof value === 'string' && value === MASK_STRING) {
                return;
            }

            // 2. Encrypt if sensitive
            let valueToSave = value;
            if (SENSITIVE_KEYS.includes(key) && typeof value === 'string' && value.length > 0) {
                valueToSave = encrypt(value);
            }

            // 3. Upsert
            return prisma.setting.upsert({
                where: { key },
                update: { value: valueToSave as any },
                create: { key, value: valueToSave as any }
            });
        });

        await Promise.all(promises);

        // Return updated settings (masked)
        // Re-fetch to be consistent
        const allSettings = await prisma.setting.findMany();
        const settingsObject: Record<string, any> = {};

        allSettings.forEach(s => {
            if (SENSITIVE_KEYS.includes(s.key)) {
                const valueStr = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
                settingsObject[s.key] = valueStr && valueStr.length > 0 ? MASK_STRING : '';
            } else {
                settingsObject[s.key] = s.value;
            }
        });

        res.json({ success: true, data: settingsObject });

    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to update settings' } });
    }
});

export default router;
