import { Router } from 'express';
import prisma from '../lib/prisma';
import { env } from '../lib/env';
import multer from 'multer';
import { xService } from '../services/platforms/x';
import { metaService } from '../services/platforms/meta';
import { youtubeService } from '../services/platforms/youtube';
import { tiktokService } from '../services/platforms/tiktok';
import { pinterestService } from '../services/platforms/pinterest';
import { authenticate } from '../middleware/auth';
import fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// POST /api/platforms/post
// HANDLES FILE UPLOADS for Video/Image content
router.post('/post', authenticate, upload.single('mediaFile'), async (req, res) => {
    try {
        const { platforms, content } = req.body;
        // Content might be JSON stringified if multipart/form-data
        const parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
        const { text, link, title } = parsedContent;

        let imageUrl = parsedContent.imageUrl;
        let videoUrl = parsedContent.videoUrl;

        // If a file was uploaded, decide if it's image or video based on mimetype
        // For local files, we pass the path
        let localFilePath = req.file ? req.file.path : null;

        const results = [];
        let platformList = typeof platforms === 'string' ? JSON.parse(platforms) : platforms;

        for (const platform of platformList) {
            // Get platform connection
            const connection = await prisma.platformConnection.findUnique({
                where: { platform }
            });

            let result: any = { platform, status: 'failed', error: 'Platform not configured' };

            try {
                switch (platform) {
                    case 'X':
                        if (connection?.accessToken) {
                            const xResult = await xService.postTweet(text, imageUrl, connection);
                            result = { platform, ...xResult, status: xResult.success ? 'posted' : 'failed' };
                        }
                        break;

                    case 'Facebook':
                        if (connection?.accessToken && connection.userId) {
                            const fbResult = await metaService.postToFacebook(
                                connection.userId,
                                text,
                                imageUrl,
                                connection.accessToken,
                                link
                            );
                            result = { platform, ...fbResult, status: fbResult.success ? 'posted' : 'failed' };
                        }
                        break;

                    case 'Instagram':
                        if (connection?.accessToken && connection.userId && imageUrl) {
                            const igResult = await metaService.postToInstagram(
                                connection.userId,
                                text,
                                imageUrl,
                                connection.accessToken
                            );
                            result = { platform, ...igResult, status: igResult.success ? 'posted' : 'failed' };
                        }
                        break;

                    case 'Threads':
                        if (connection?.accessToken && connection.userId) {
                            const threadsResult = await metaService.postToThreads(
                                connection.userId,
                                text,
                                imageUrl,
                                connection.accessToken
                            );
                            result = { platform, ...threadsResult, status: threadsResult.success ? 'posted' : 'failed' };
                        }
                        break;

                    case 'TikTok':
                        // TikTok needs videoUrl (Pull from URL) OR File Upload
                        // If we have a local file, we would need to upload it to a public URL first or use a different API endpoint
                        // For now, assuming videoUrl is provided or we leverage the file if strictly supported
                        if (connection?.accessToken) {
                            if (videoUrl) {
                                const ttResult = await tiktokService.postVideo(videoUrl, title || text, connection.accessToken);
                                result = { platform, ...ttResult, status: ttResult.success ? 'posted' : 'failed' };
                            } else {
                                result = { platform, status: 'failed', error: 'TikTok requires a public video URL' };
                            }
                        }
                        break;

                    case 'YouTube':
                        if (connection?.accessToken && localFilePath) {
                            // Refresh token logic should be handled here or in service
                            const ytResult = await youtubeService.uploadVideo(
                                connection.accessToken,
                                localFilePath,
                                {
                                    title: title || text.slice(0, 100),
                                    description: text,
                                    privacyStatus: 'private' // Default to private for safety
                                },
                                connection.refreshToken || undefined
                            );
                            result = { platform, ...ytResult, status: ytResult.success ? 'posted' : 'failed' };
                        } else {
                            result = { platform, status: 'failed', error: 'YouTube requires a video file upload' };
                        }
                        break;

                    default:
                        result = { platform, status: 'failed', error: 'Unknown platform' };
                }
            } catch (err: any) {
                result = { platform, status: 'failed', error: err.message };
            }

            result.postedAt = new Date().toISOString();
            results.push(result);
        }

        // Cleanup uploaded file
        if (localFilePath) {
            fs.unlinkSync(localFilePath);
        }

        const posted = results.filter(r => r.status === 'posted').length;
        const failed = results.filter(r => r.status === 'failed').length;

        res.json({
            success: true,
            data: {
                results,
                summary: { total: platformList.length, posted, failed }
            }
        });
    } catch (error) {
        console.error('Platform post error:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to post to platforms' } });
    }
});

// GET /api/platforms/status (Protected)
router.get('/status', authenticate, async (req, res) => {
    // ... existing logic ...
    try {
        const connections = await prisma.platformConnection.findMany();
        const status: Record<string, any> = {
            X: { connected: false },
            Facebook: { connected: false },
            Instagram: { connected: false },
            Threads: { connected: false },
            YouTube: { connected: false },
            TikTok: { connected: false },
            Pinterest: { connected: false }
        };
        connections.forEach(conn => {
            status[conn.platform] = {
                connected: !!conn.accessToken,
                username: conn.username,
                lastPost: conn.updatedAt?.toISOString()
            };
        });
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch status' } });
    }
});

// POST /api/platforms/connect (Protected)
router.post('/connect', authenticate, async (req, res) => {
    // ... existing logic ...
    try {
        const { platform, accessToken, refreshToken, expiresAt, username, userId, metadata } = req.body;
        const connection = await prisma.platformConnection.upsert({
            where: { platform },
            update: { accessToken, refreshToken, expiresAt: expiresAt ? new Date(expiresAt) : null, username, userId, metadata },
            create: { platform, accessToken, refreshToken, expiresAt: expiresAt ? new Date(expiresAt) : null, username, userId, metadata }
        });
        res.json({ success: true, data: { connected: true, platform } });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Connect failed' } });
    }
});

// DELETE /api/platforms/:platform (Protected)
router.delete('/:platform', authenticate, async (req, res) => {
    // ... existing logic ...
    try {
        await prisma.platformConnection.delete({ where: { platform: req.params.platform } });
        res.json({ success: true, data: { message: 'Disconnected' } });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Disconnect failed' } });
    }
});

// GET /api/platforms/auth/:platform (Protected)
// Returns the OAuth URL to redirect the user to
router.get('/auth/:platform', authenticate, async (req, res) => {
    try {
        const { platform } = req.params;
        const redirectUri = req.query.redirectUri as string || `${env.FRONTEND_URL}/platforms/callback`;
        let oauthUrl = '';

        switch (platform.toLowerCase()) {
            case 'instagram':
            case 'facebook':
                const appId = env.META_APP_ID;
                if (!appId) throw new Error('Meta App ID not configured in environment');
                // Standard Facebook/Instagram Graph API OAuth URL
                oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&state=${platform}&scope=instagram_basic,instagram_content_publish,pages_show_list,pages_manage_posts`;
                break;
            default:
                throw new Error('Unsupported platform for automated OAuth yet');
        }

        res.json({ success: true, data: { url: oauthUrl } });
    } catch (error: any) {
        console.error('OAuth URL Error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to generate OAuth URL' } });
    }
});

import axios from 'axios';

// POST /api/platforms/callback (Protected)
// Exchanges the auth code for an access token
router.post('/callback', authenticate, async (req, res) => {
    try {
        const { platform, code, redirectUri } = req.body;
        if (!platform || !code) throw new Error('Platform and code are required');

        let accessToken = '';

        if (platform.toLowerCase() === 'instagram' || platform.toLowerCase() === 'facebook') {
            const appId = env.META_APP_ID;
            const appSecret = env.META_APP_SECRET;
            if (!appId || !appSecret) throw new Error('Meta App credentials not configured');

            // Exchange code for token
            const tokenResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${redirectUri}&client_secret=${appSecret}&code=${code}`);
            accessToken = tokenResponse.data.access_token;
        } else {
            throw new Error('Unsupported platform for callback exchange');
        }

        // Save to DB
        const normalizedPlatform = platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
        await prisma.platformConnection.upsert({
            where: { platform: normalizedPlatform },
            update: { accessToken, updatedAt: new Date() },
            create: { platform: normalizedPlatform, accessToken }
        });

        res.json({ success: true, data: { message: 'Authentication successful', platform: normalizedPlatform } });
    } catch (error: any) {
        console.error('OAuth Callback Error:', error?.response?.data || error.message);
        res.status(500).json({ success: false, error: { message: error?.response?.data?.error?.message || error.message || 'OAuth callback failed' } });
    }
});

export default router;
