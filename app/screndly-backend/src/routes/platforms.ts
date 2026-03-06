import { PlatformConnection, Prisma } from '@prisma/client';
import { Router } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';
import { env } from '../lib/env';
import multer from 'multer';
import { xService } from '../services/platforms/x';
import { metaService } from '../services/platforms/meta';
import { youtubeService } from '../services/platforms/youtube';
import { tiktokService } from '../services/platforms/tiktok';
import { pinterestService } from '../services/platforms/pinterest';
import { ensureFreshPlatformConnection } from '../services/platforms/connectionAuth';
import { authenticate } from '../middleware/auth';
import { google } from 'googleapis';
import fs from 'fs';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';
import { pipeline } from 'stream/promises';
import { createHash, randomBytes } from 'crypto';

const router = Router();
const upload = multer({ dest: 'uploads/' });

type SupportedPlatform = 'Instagram' | 'Facebook' | 'Threads' | 'TikTok' | 'X' | 'YouTube' | 'Pinterest';

interface BackendPlatformStatus {
    connected: boolean;
    username?: string;
    lastPost?: string;
    profileUrl?: string;
    expiresAt?: string;
}

interface OAuthStatePayload {
    platform: SupportedPlatform;
    redirectUri: string;
    nonce: string;
    codeVerifier?: string;
}

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

function normalizePlatform(value?: string | null): SupportedPlatform | null {
    if (!value) return null;

    switch (value.trim().toLowerCase()) {
        case 'instagram':
            return 'Instagram';
        case 'facebook':
            return 'Facebook';
        case 'threads':
            return 'Threads';
        case 'tiktok':
            return 'TikTok';
        case 'x':
        case 'twitter':
            return 'X';
        case 'youtube':
            return 'YouTube';
        case 'pinterest':
            return 'Pinterest';
        default:
            return null;
    }
}

function getRedirectUri(override?: string): string {
    if (override) {
        return override.replace(/\/+$/, '');
    }

    return `${(env.FRONTEND_URL || '').replace(/\/+$/, '')}/platforms/callback`;
}

function getStateSecret(): string {
    return env.JWT_SECRET || env.ADMIN_SECRET;
}

function createCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
}

function createCodeChallenge(codeVerifier: string): string {
    return createHash('sha256').update(codeVerifier).digest('base64url');
}

function createOAuthState(platform: SupportedPlatform, redirectUri: string, codeVerifier?: string): string {
    return jwt.sign(
        {
            platform,
            redirectUri,
            nonce: randomBytes(12).toString('hex'),
            codeVerifier,
        } satisfies OAuthStatePayload,
        getStateSecret(),
        { expiresIn: '10m' }
    );
}

function decodeOAuthState(state?: string): OAuthStatePayload | null {
    if (!state) return null;

    try {
        const decoded = jwt.verify(state, getStateSecret());
        if (!decoded || typeof decoded !== 'object') return null;

        const record = decoded as Record<string, unknown>;
        const platform = normalizePlatform(typeof record.platform === 'string' ? record.platform : '');
        const redirectUri = record.redirectUri;
        const nonce = record.nonce;
        const codeVerifier = record.codeVerifier;

        if (!platform || typeof redirectUri !== 'string' || typeof nonce !== 'string') {
            return null;
        }

        return {
            platform,
            redirectUri,
            nonce,
            codeVerifier: typeof codeVerifier === 'string' ? codeVerifier : undefined,
        };
    } catch {
        return null;
    }
}

function getJsonObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
        return {};
    }

    return { ...(value as Prisma.JsonObject) };
}

function getJsonString(value: Prisma.JsonObject, key: string): string | undefined {
    const candidate = value[key];
    return typeof candidate === 'string' ? candidate : undefined;
}

function buildProfileUrl(
    platform: SupportedPlatform,
    username?: string | null,
    userId?: string | null,
    metadata?: Prisma.JsonObject
): string | undefined {
    const explicitProfileUrl = metadata ? getJsonString(metadata, 'profileUrl') : undefined;
    if (explicitProfileUrl) return explicitProfileUrl;

    const cleanUsername = username?.replace(/^@/, '');

    switch (platform) {
        case 'Facebook':
            return userId ? `https://www.facebook.com/${userId}` : cleanUsername ? `https://www.facebook.com/${cleanUsername}` : undefined;
        case 'Instagram':
            return cleanUsername ? `https://www.instagram.com/${cleanUsername}` : undefined;
        case 'Threads':
            return cleanUsername ? `https://www.threads.net/@${cleanUsername}` : undefined;
        case 'TikTok':
            return cleanUsername ? `https://www.tiktok.com/@${cleanUsername}` : undefined;
        case 'X':
            return cleanUsername ? `https://x.com/${cleanUsername}` : undefined;
        case 'YouTube':
            if (cleanUsername) {
                return cleanUsername.startsWith('UC')
                    ? `https://www.youtube.com/channel/${cleanUsername}`
                    : `https://www.youtube.com/@${cleanUsername}`;
            }
            return userId ? `https://www.youtube.com/channel/${userId}` : undefined;
        case 'Pinterest':
            return cleanUsername ? `https://www.pinterest.com/${cleanUsername}` : undefined;
        default:
            return undefined;
    }
}

async function downloadRemoteFile(remoteUrl: string, label: string): Promise<string> {
    const parsedUrl = new URL(remoteUrl);
    const extension = path.extname(parsedUrl.pathname) || '.bin';
    const filePath = path.join(os.tmpdir(), `${label}-${Date.now()}-${randomBytes(6).toString('hex')}${extension}`);
    const response = await axios.get(remoteUrl, { responseType: 'stream', timeout: 60000 });
    await pipeline(response.data as NodeJS.ReadableStream, fs.createWriteStream(filePath));
    return filePath;
}

async function cleanupFile(filePath: string | null): Promise<void> {
    if (!filePath) return;

    try {
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    } catch {
        // Best-effort cleanup only.
    }
}

async function updateConnectionMetadata(platform: SupportedPlatform, patch: Prisma.JsonObject): Promise<void> {
    const connection = await prisma.platformConnection.findUnique({ where: { platform } });
    if (!connection) return;

    await prisma.platformConnection.update({
        where: { platform },
        data: {
            metadata: {
                ...getJsonObject(connection.metadata),
                ...patch,
            },
        },
    });
}

function assertConfigured(label: string, values: Record<string, string | undefined>): void {
    const missing = Object.entries(values)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missing.length > 0) {
        throw new Error(`${label} OAuth is not configured. Missing: ${missing.join(', ')}`);
    }
}

async function fetchInstagramProfile(igUserId: string, accessToken: string): Promise<{ username?: string; profileUrl?: string }> {
    const response = await axios.get(`${META_GRAPH_BASE}/${igUserId}`, {
        params: {
            fields: 'username',
            access_token: accessToken
        }
    });

    const username = typeof response.data?.username === 'string' ? response.data.username : undefined;
    return {
        username,
        profileUrl: username ? `https://www.instagram.com/${username}` : undefined
    };
}

// POST /api/platforms/post
// HANDLES FILE UPLOADS for Video/Image content
router.post('/post', authenticate, upload.single('mediaFile'), async (req, res) => {
    let localFilePath: string | null = req.file ? req.file.path : null;
    let downloadedVideoPath: string | null = null;

    try {
        const { platforms, content } = req.body;
        // Content might be JSON stringified if multipart/form-data
        const parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
        const { text, link, title } = parsedContent;

        let imageUrl = parsedContent.imageUrl;
        let videoUrl = parsedContent.videoUrl;

        const results = [];
        let platformList = typeof platforms === 'string' ? JSON.parse(platforms) : platforms;
        platformList = (platformList || [])
            .map((value: string) => normalizePlatform(value))
            .filter((value: SupportedPlatform | null): value is SupportedPlatform => value !== null);

        for (const platform of platformList) {
            // Get platform connection
            let connection = await prisma.platformConnection.findUnique({
                where: { platform }
            });
            connection = await ensureFreshPlatformConnection(connection);

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
                        if (!localFilePath && videoUrl) {
                            downloadedVideoPath = downloadedVideoPath || await downloadRemoteFile(videoUrl, 'screndly-youtube');
                        }

                        if (connection?.accessToken && (localFilePath || downloadedVideoPath)) {
                            // Refresh token logic should be handled here or in service
                            const ytResult = await youtubeService.uploadVideo(
                                connection.accessToken,
                                localFilePath || downloadedVideoPath!,
                                {
                                    title: title || text.slice(0, 100),
                                    description: text,
                                    privacyStatus: 'private' // Default to private for safety
                                },
                                connection.refreshToken || undefined
                            );
                            result = { platform, ...ytResult, status: ytResult.success ? 'posted' : 'failed' };
                        } else {
                            result = { platform, status: 'failed', error: 'YouTube requires a video file upload or public video URL' };
                        }
                        break;

                    case 'Pinterest':
                        if (connection?.accessToken && imageUrl) {
                            const metadata = getJsonObject(connection.metadata);
                            let boardId = getJsonString(metadata, 'boardId');
                            let boardName = getJsonString(metadata, 'boardName');

                            if (!boardId) {
                                const boardsResponse = await pinterestService.getBoards(connection.accessToken);
                                const firstBoard = Array.isArray(boardsResponse?.items) ? boardsResponse.items[0] : null;
                                if (firstBoard?.id) {
                                    boardId = firstBoard.id;
                                    boardName = firstBoard.name;
                                } else {
                                    const createdBoard = await pinterestService.createBoard(
                                        'Screndly',
                                        'Created automatically by Screndly',
                                        connection.accessToken
                                    );
                                    if (createdBoard?.id) {
                                        boardId = createdBoard.id;
                                        boardName = createdBoard.name || 'Screndly';
                                    }
                                }

                                if (boardId) {
                                    await updateConnectionMetadata(platform, {
                                        ...metadata,
                                        boardId,
                                        boardName: boardName || 'Screndly'
                                    });
                                }
                            }

                            if (!boardId) {
                                result = { platform, status: 'failed', error: 'Pinterest board not available for posting' };
                                break;
                            }

                            const pinResult = await pinterestService.createPin(
                                boardId,
                                title || text.slice(0, 100) || 'Screndly Pin',
                                text,
                                imageUrl,
                                connection.accessToken,
                                {
                                    link,
                                    altText: title || text.slice(0, 100) || 'Screndly Pin'
                                }
                            );
                            result = { platform, ...pinResult, status: pinResult.success ? 'posted' : 'failed' };
                        } else {
                            result = { platform, status: 'failed', error: 'Pinterest requires an image URL' };
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

            if (result.status === 'posted') {
                await updateConnectionMetadata(platform, { lastPostAt: result.postedAt as string });
            }
        }

        // Cleanup uploaded file
        await cleanupFile(localFilePath);
        await cleanupFile(downloadedVideoPath);
        localFilePath = null;
        downloadedVideoPath = null;

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
        await cleanupFile(localFilePath);
        await cleanupFile(downloadedVideoPath);
        res.status(500).json({ success: false, error: { message: 'Failed to post to platforms' } });
    }
});

// GET /api/platforms/status (Protected)
router.get('/status', authenticate, async (req, res) => {
    // ... existing logic ...
    try {
        const connections = await prisma.platformConnection.findMany();
        const status: Record<SupportedPlatform, BackendPlatformStatus> = {
            X: { connected: false },
            Facebook: { connected: false },
            Instagram: { connected: false },
            Threads: { connected: false },
            YouTube: { connected: false },
            TikTok: { connected: false },
            Pinterest: { connected: false }
        };
        connections.forEach(conn => {
            const platform = normalizePlatform(conn.platform);
            if (!platform) return;

            const metadata = getJsonObject(conn.metadata);
            status[platform] = {
                connected: !!conn.accessToken,
                username: conn.username || undefined,
                lastPost: getJsonString(metadata, 'lastPostAt'),
                profileUrl: buildProfileUrl(platform, conn.username, conn.userId, metadata),
                expiresAt: conn.expiresAt?.toISOString()
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
        const normalizedPlatform = normalizePlatform(platform);
        if (!normalizedPlatform) {
            return res.status(400).json({ success: false, error: { message: 'Unsupported platform' } });
        }
        const connection = await prisma.platformConnection.upsert({
            where: { platform: normalizedPlatform },
            update: { accessToken, refreshToken, expiresAt: expiresAt ? new Date(expiresAt) : null, username, userId, metadata },
            create: { platform: normalizedPlatform, accessToken, refreshToken, expiresAt: expiresAt ? new Date(expiresAt) : null, username, userId, metadata }
        });
        res.json({ success: true, data: { connected: true, platform: normalizedPlatform } });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Connect failed' } });
    }
});

// DELETE /api/platforms/:platform (Protected)
router.delete('/:platform', authenticate, async (req, res) => {
    // ... existing logic ...
    try {
        const normalizedPlatform = normalizePlatform(req.params.platform);
        if (!normalizedPlatform) {
            return res.status(400).json({ success: false, error: { message: 'Unsupported platform' } });
        }

        await prisma.platformConnection.deleteMany({ where: { platform: normalizedPlatform } });
        res.json({ success: true, data: { message: 'Disconnected' } });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Disconnect failed' } });
    }
});

// GET /api/platforms/auth/:platform (Protected)
// Returns the OAuth URL to redirect the user to
router.get('/auth/:platform', authenticate, async (req, res) => {
    try {
        const platform = normalizePlatform(req.params.platform);
        if (!platform) throw new Error('Unsupported platform');

        const redirectUri = getRedirectUri();
        let oauthUrl = '';
        const stateFor = (codeVerifier?: string) => createOAuthState(platform, redirectUri, codeVerifier);

        switch (platform) {
            case 'Instagram':
            case 'Facebook': {
                assertConfigured('Meta', { META_APP_ID: env.META_APP_ID });
                const scopes = platform === 'Instagram'
                    ? ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_manage_posts', 'pages_read_engagement']
                    : ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'];

                oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${env.META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(stateFor())}&response_type=code&scope=${encodeURIComponent(scopes.join(','))}`;
                break;
            }

            case 'Threads': {
                assertConfigured('Threads', {
                    THREADS_APP_ID: env.THREADS_APP_ID,
                });
                const scopes = ['threads_basic', 'threads_content_publish'];
                oauthUrl = `https://threads.net/oauth/authorize?client_id=${encodeURIComponent(env.THREADS_APP_ID || '')}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(','))}&response_type=code&state=${encodeURIComponent(stateFor())}`;
                break;
            }

            case 'X': {
                assertConfigured('X', { X_CLIENT_ID: env.X_CLIENT_ID });
                const codeVerifier = createCodeVerifier();
                const codeChallenge = createCodeChallenge(codeVerifier);
                const scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

                oauthUrl = `https://x.com/i/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(env.X_CLIENT_ID || '')}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${encodeURIComponent(stateFor(codeVerifier))}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
                break;
            }

            case 'YouTube': {
                assertConfigured('YouTube', {
                    YOUTUBE_CLIENT_ID: env.YOUTUBE_CLIENT_ID,
                    YOUTUBE_CLIENT_SECRET: env.YOUTUBE_CLIENT_SECRET
                });

                const codeVerifier = createCodeVerifier();
                const codeChallenge = createCodeChallenge(codeVerifier);
                const scopes = [
                    'https://www.googleapis.com/auth/youtube.upload',
                    'https://www.googleapis.com/auth/youtube',
                    'https://www.googleapis.com/auth/youtube.force-ssl'
                ];

                oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(env.YOUTUBE_CLIENT_ID || '')}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&state=${encodeURIComponent(stateFor(codeVerifier))}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&access_type=offline&include_granted_scopes=true&prompt=consent`;
                break;
            }

            case 'TikTok': {
                assertConfigured('TikTok', {
                    TIKTOK_CLIENT_KEY: env.TIKTOK_CLIENT_KEY,
                    TIKTOK_CLIENT_SECRET: env.TIKTOK_CLIENT_SECRET
                });

                const scopes = ['user.info.basic', 'video.publish', 'video.upload'];
                oauthUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(env.TIKTOK_CLIENT_KEY || '')}&scope=${encodeURIComponent(scopes.join(','))}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(stateFor())}`;
                break;
            }

            case 'Pinterest': {
                assertConfigured('Pinterest', {
                    PINTEREST_APP_ID: env.PINTEREST_APP_ID,
                    PINTEREST_APP_SECRET: env.PINTEREST_APP_SECRET
                });

                const scopes = ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'];
                oauthUrl = `https://www.pinterest.com/oauth/?consumer_id=${encodeURIComponent(env.PINTEREST_APP_ID || '')}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&refreshable=true&scope=${encodeURIComponent(scopes.join(','))}&state=${encodeURIComponent(stateFor())}`;
                break;
            }

            default:
                throw new Error('Unsupported platform for automated OAuth');
        }

        res.json({ success: true, data: { url: oauthUrl } });
    } catch (error: any) {
        console.error('OAuth URL Error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to generate OAuth URL' } });
    }
});

const isAuthorizationCodeReusedError = (error: any): boolean => {
    const message = String(
        error?.response?.data?.error?.message ||
        error?.message ||
        ''
    ).toLowerCase();
    return message.includes('authorization code has been used');
};

// POST /api/platforms/callback
// Exchanges the auth code for an access token and performs deep integration (long-lived tokens, Page/IG IDs)
// The callback relies on the signed OAuth state generated by `/auth/:platform`.
router.post('/callback', async (req, res) => {
    try {
        const { platform, code, redirectUri, state, codeVerifier } = req.body;
        if (!code) throw new Error('Authorization code is required');

        const decodedState = decodeOAuthState(state);
        const normalizedPlatform = decodedState?.platform || normalizePlatform(platform);
        const effectiveRedirectUri = decodedState?.redirectUri || getRedirectUri(redirectUri);
        const effectiveCodeVerifier = decodedState?.codeVerifier || (typeof codeVerifier === 'string' ? codeVerifier : undefined);

        if (!normalizedPlatform) throw new Error('Platform is required');

        if (normalizedPlatform === 'Instagram' || normalizedPlatform === 'Facebook') {
            const appId = env.META_APP_ID;
            const appSecret = env.META_APP_SECRET;
            if (!appId || !appSecret) throw new Error('Meta App credentials not configured');

            // 1. Exchange code for short-lived token
            const tokenResponse = await axios.get(`${META_GRAPH_BASE}/oauth/access_token`, {
                params: {
                    client_id: appId,
                    redirect_uri: effectiveRedirectUri,
                    client_secret: appSecret,
                    code
                }
            });
            const shortToken = tokenResponse.data.access_token;

            // 2. Exchange for long-lived (60 days) token
            const longTokenData = await metaService.exchangeForLongLivedToken(shortToken);
            const userAccessToken = longTokenData.access_token;
            const expiresAt = longTokenData.expires_in ? new Date(Date.now() + longTokenData.expires_in * 1000) : null;

            // 3. Perform Discovery
            if (normalizedPlatform === 'Facebook') {
                const pages = await metaService.getPages(userAccessToken);
                if (!pages || pages.length === 0) {
                    throw new Error('No Facebook Pages were found for this account. Connect an account that manages at least one Facebook Page.');
                }

                const page = pages[0];
                if (!page?.id || !page?.access_token) {
                    throw new Error('Facebook returned an incomplete Page record. Please reconnect and ensure page permissions are granted.');
                }

                await prisma.platformConnection.upsert({
                    where: { platform: 'Facebook' },
                    update: {
                        accessToken: page.access_token, // Page Token
                        userId: page.id,               // Page ID
                        username: page.name,
                        expiresAt,
                        metadata: {
                            userToken: userAccessToken,
                            profileUrl: `https://www.facebook.com/${page.id}`
                        }
                    },
                    create: {
                        platform: 'Facebook',
                        accessToken: page.access_token,
                        userId: page.id,
                        username: page.name,
                        expiresAt,
                        metadata: {
                            userToken: userAccessToken,
                            profileUrl: `https://www.facebook.com/${page.id}`
                        }
                    }
                });
            } else if (normalizedPlatform === 'Instagram') {
                const pages = await metaService.getPages(userAccessToken);
                if (!pages || pages.length === 0) {
                    throw new Error('No Facebook Pages were found for this account. Instagram Business connections require a Facebook Page linked to an Instagram professional account.');
                }
                let igId = null;

                for (const page of pages) {
                    igId = await metaService.getInstagramBusinessId(page.id, page.access_token);
                    if (igId) {
                        break;
                    }
                }

                if (igId) {
                    const profile = await fetchInstagramProfile(igId, userAccessToken);
                    await prisma.platformConnection.upsert({
                        where: { platform: 'Instagram' },
                        update: {
                            accessToken: userAccessToken,
                            userId: igId,
                            username: profile.username || igId,
                            expiresAt,
                            metadata: {
                                profileUrl: profile.profileUrl
                            }
                        },
                        create: {
                            platform: 'Instagram',
                            accessToken: userAccessToken,
                            userId: igId,
                            username: profile.username || igId,
                            expiresAt,
                            metadata: {
                                profileUrl: profile.profileUrl
                            }
                        }
                    });
                } else {
                    throw new Error('No Instagram Business Account found connected to your Facebook Pages');
                }
            }
        } else if (normalizedPlatform === 'Threads') {
            assertConfigured('Threads', {
                THREADS_APP_ID: env.THREADS_APP_ID,
                THREADS_APP_SECRET: env.THREADS_APP_SECRET
            });

            const params = new URLSearchParams({
                client_id: env.THREADS_APP_ID || '',
                client_secret: env.THREADS_APP_SECRET || '',
                code,
                grant_type: 'authorization_code',
                redirect_uri: effectiveRedirectUri
            });

            const tokenResponse = await axios.post('https://graph.threads.net/oauth/access_token', params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const shortToken = tokenResponse.data.access_token;
            const longTokenData = await metaService.exchangeThreadsForLongLivedToken(shortToken);
            const userAccessToken = longTokenData.access_token;
            const expiresAt = longTokenData.expires_in ? new Date(Date.now() + longTokenData.expires_in * 1000) : null;

            const profile = await metaService.getThreadsProfile(userAccessToken);
            await prisma.platformConnection.upsert({
                where: { platform: 'Threads' },
                update: {
                    accessToken: userAccessToken,
                    userId: profile.id,
                    username: profile.username || profile.name || profile.id,
                    expiresAt,
                    metadata: {
                        profileUrl: profile.username ? `https://www.threads.net/@${profile.username}` : undefined,
                        profileImageUrl: profile.threads_profile_picture_url,
                        bio: profile.threads_biography,
                        isVerified: profile.is_verified
                    }
                },
                create: {
                    platform: 'Threads',
                    accessToken: userAccessToken,
                    userId: profile.id,
                    username: profile.username || profile.name || profile.id,
                    expiresAt,
                    metadata: {
                        profileUrl: profile.username ? `https://www.threads.net/@${profile.username}` : undefined,
                        profileImageUrl: profile.threads_profile_picture_url,
                        bio: profile.threads_biography,
                        isVerified: profile.is_verified
                    }
                }
            });
        } else if (normalizedPlatform === 'X') {
            if (!effectiveCodeVerifier) throw new Error('Missing PKCE verifier for X OAuth');
            assertConfigured('X', { X_CLIENT_ID: env.X_CLIENT_ID });

            const params = new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: env.X_CLIENT_ID || '',
                redirect_uri: effectiveRedirectUri,
                code_verifier: effectiveCodeVerifier
            });

            if (env.X_CLIENT_SECRET) {
                params.append('client_secret', env.X_CLIENT_SECRET);
            }

            const tokenResponse = await axios.post('https://api.x.com/2/oauth2/token', params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const tokenData = tokenResponse.data as {
                access_token: string;
                refresh_token?: string;
                expires_in?: number;
                scope?: string;
                token_type?: string;
            };

            const profileResponse = await axios.get('https://api.x.com/2/users/me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
                params: { 'user.fields': 'username,profile_image_url' }
            });

            const profile = profileResponse.data?.data || {};
            if (!profile?.id) {
                throw new Error('X did not return the authenticated user profile. Check that the app has access to users.read.');
            }

            await prisma.platformConnection.upsert({
                where: { platform: 'X' },
                update: {
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || null,
                    expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
                    userId: profile.id,
                    username: profile.username || profile.id,
                    metadata: {
                        profileUrl: profile.username ? `https://x.com/${profile.username}` : undefined,
                        profileImageUrl: profile.profile_image_url,
                        scope: tokenData.scope,
                        tokenType: tokenData.token_type
                    }
                },
                create: {
                    platform: 'X',
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || null,
                    expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
                    userId: profile.id,
                    username: profile.username || profile.id,
                    metadata: {
                        profileUrl: profile.username ? `https://x.com/${profile.username}` : undefined,
                        profileImageUrl: profile.profile_image_url,
                        scope: tokenData.scope,
                        tokenType: tokenData.token_type
                    }
                }
            });
        } else if (normalizedPlatform === 'YouTube') {
            if (!effectiveCodeVerifier) throw new Error('Missing PKCE verifier for YouTube OAuth');
            assertConfigured('YouTube', {
                YOUTUBE_CLIENT_ID: env.YOUTUBE_CLIENT_ID,
                YOUTUBE_CLIENT_SECRET: env.YOUTUBE_CLIENT_SECRET
            });

            const params = new URLSearchParams({
                client_id: env.YOUTUBE_CLIENT_ID || '',
                client_secret: env.YOUTUBE_CLIENT_SECRET || '',
                code,
                grant_type: 'authorization_code',
                redirect_uri: effectiveRedirectUri,
                code_verifier: effectiveCodeVerifier
            });

            const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const tokenData = tokenResponse.data as {
                access_token: string;
                refresh_token?: string;
                expires_in?: number;
                scope?: string;
                token_type?: string;
            };

            const oauthClient = new google.auth.OAuth2(
                env.YOUTUBE_CLIENT_ID,
                env.YOUTUBE_CLIENT_SECRET,
                effectiveRedirectUri
            );
            oauthClient.setCredentials({
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token
            });

            const youtube = google.youtube({ version: 'v3', auth: oauthClient });
            const channelResponse = await youtube.channels.list({
                part: ['snippet'],
                mine: true
            });
            const channel = channelResponse.data.items?.[0];
            if (!channel?.id) {
                throw new Error('No YouTube channel found for this account');
            }

            const customUrl = channel.snippet?.customUrl?.replace(/^@/, '');
            const username = customUrl || channel.snippet?.title || channel.id;

            await prisma.platformConnection.upsert({
                where: { platform: 'YouTube' },
                update: {
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || null,
                    expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
                    userId: channel.id,
                    username,
                    metadata: {
                        profileUrl: customUrl ? `https://www.youtube.com/@${customUrl}` : `https://www.youtube.com/channel/${channel.id}`,
                        profileImageUrl: channel.snippet?.thumbnails?.default?.url,
                        scope: tokenData.scope,
                        tokenType: tokenData.token_type
                    }
                },
                create: {
                    platform: 'YouTube',
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || null,
                    expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
                    userId: channel.id,
                    username,
                    metadata: {
                        profileUrl: customUrl ? `https://www.youtube.com/@${customUrl}` : `https://www.youtube.com/channel/${channel.id}`,
                        profileImageUrl: channel.snippet?.thumbnails?.default?.url,
                        scope: tokenData.scope,
                        tokenType: tokenData.token_type
                    }
                }
            });
        } else if (normalizedPlatform === 'TikTok') {
            assertConfigured('TikTok', {
                TIKTOK_CLIENT_KEY: env.TIKTOK_CLIENT_KEY,
                TIKTOK_CLIENT_SECRET: env.TIKTOK_CLIENT_SECRET
            });

            const params = new URLSearchParams({
                client_key: env.TIKTOK_CLIENT_KEY || '',
                client_secret: env.TIKTOK_CLIENT_SECRET || '',
                code,
                grant_type: 'authorization_code',
                redirect_uri: effectiveRedirectUri
            });

            const tokenResponse = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache'
                }
            });

            const tokenData = (tokenResponse.data?.data || tokenResponse.data) as {
                access_token: string;
                refresh_token?: string;
                expires_in?: number;
                refresh_expires_in?: number;
                scope?: string;
                token_type?: string;
                open_id?: string;
            };
            if (!tokenData.access_token) {
                throw new Error('TikTok did not return an access token.');
            }

            const userInfo = await tiktokService.getUserInfo(tokenData.access_token);
            const username = userInfo?.display_name || userInfo?.username || userInfo?.open_id || tokenData.open_id || 'TikTok User';
            const userId = userInfo?.open_id || tokenData.open_id || null;
            if (!userId) {
                throw new Error('TikTok did not return the account identifier required to save the connection.');
            }

            await prisma.platformConnection.upsert({
                where: { platform: 'TikTok' },
                update: {
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || null,
                    expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
                    userId,
                    username,
                    metadata: {
                        avatarUrl: userInfo?.avatar_url || userInfo?.avatar_large_url || userInfo?.avatar_url_100,
                        profileUrl: userInfo?.profile_deep_link,
                        refreshExpiresAt: tokenData.refresh_expires_in ? new Date(Date.now() + tokenData.refresh_expires_in * 1000).toISOString() : undefined,
                        scope: tokenData.scope,
                        tokenType: tokenData.token_type
                    }
                },
                create: {
                    platform: 'TikTok',
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || null,
                    expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
                    userId,
                    username,
                    metadata: {
                        avatarUrl: userInfo?.avatar_url || userInfo?.avatar_large_url || userInfo?.avatar_url_100,
                        profileUrl: userInfo?.profile_deep_link,
                        refreshExpiresAt: tokenData.refresh_expires_in ? new Date(Date.now() + tokenData.refresh_expires_in * 1000).toISOString() : undefined,
                        scope: tokenData.scope,
                        tokenType: tokenData.token_type
                    }
                }
            });
        } else if (normalizedPlatform === 'Pinterest') {
            assertConfigured('Pinterest', {
                PINTEREST_APP_ID: env.PINTEREST_APP_ID,
                PINTEREST_APP_SECRET: env.PINTEREST_APP_SECRET
            });

            const basicAuth = Buffer.from(`${env.PINTEREST_APP_ID}:${env.PINTEREST_APP_SECRET}`).toString('base64');
            const params = new URLSearchParams({
                code,
                redirect_uri: effectiveRedirectUri,
                grant_type: 'authorization_code'
            });

            const tokenResponse = await axios.post('https://api.pinterest.com/v5/oauth/token', params.toString(), {
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const tokenData = tokenResponse.data as {
                access_token: string;
                refresh_token?: string;
                expires_in?: number;
                scope?: string;
                token_type?: string;
            };

            const userInfo = await pinterestService.getUserInfo(tokenData.access_token);
            const boardsResponse = await pinterestService.getBoards(tokenData.access_token);
            const firstBoard = Array.isArray(boardsResponse?.items) ? boardsResponse.items[0] : null;
            const boardId = firstBoard?.id;
            const boardName = firstBoard?.name;
            const username = userInfo?.username || userInfo?.id || 'Pinterest User';

            await prisma.platformConnection.upsert({
                where: { platform: 'Pinterest' },
                update: {
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || null,
                    expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
                    userId: userInfo?.id || null,
                    username,
                    metadata: {
                        boardId: boardId || undefined,
                        boardName: boardName || undefined,
                        profileUrl: userInfo?.username ? `https://www.pinterest.com/${userInfo.username}` : undefined,
                        scope: tokenData.scope,
                        tokenType: tokenData.token_type
                    }
                },
                create: {
                    platform: 'Pinterest',
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || null,
                    expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
                    userId: userInfo?.id || null,
                    username,
                    metadata: {
                        boardId: boardId || undefined,
                        boardName: boardName || undefined,
                        profileUrl: userInfo?.username ? `https://www.pinterest.com/${userInfo.username}` : undefined,
                        scope: tokenData.scope,
                        tokenType: tokenData.token_type
                    }
                }
            });
        } else {
            throw new Error('Unsupported platform for callback exchange');
        }

        res.json({ success: true, data: { message: 'Authentication successful', platform: normalizedPlatform } });
    } catch (error: any) {
        console.error('OAuth Callback Error:', error?.response?.data || error);
        if (isAuthorizationCodeReusedError(error)) {
            return res.status(400).json({
                success: false,
                error: { message: 'This authorization code has been used. Please connect again from Platforms.' }
            });
        }

        const statusCode = error?.response?.status && Number.isInteger(error.response.status)
            ? error.response.status
            : 500;

        const providerMessage =
            error?.response?.data?.error?.message ||
            error?.response?.data?.error_message ||
            error?.response?.data?.message ||
            error.message ||
            'OAuth callback failed';

        res.status(statusCode).json({
            success: false,
            error: { message: providerMessage }
        });
    }
});

export default router;
