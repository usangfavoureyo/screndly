import { PlatformConnection, Prisma } from '@prisma/client';
import { Router } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';
import { env } from '../lib/env';
import { findPlatformConnection, findPlatformConnections, updatePlatformConnection, upsertPlatformConnection } from '../lib/platformConnections';
import { assertXOAuthConfigured, buildXTokenRequest, getXOAuthClientId } from '../lib/xOAuth';
import { getTikTokClientKey, getTikTokClientSecret } from '../lib/tiktokOAuth';
import { getPinterestAppId, getPinterestAppSecret } from '../lib/pinterestOAuth';
import multer from 'multer';
import { xService } from '../services/platforms/x';
import { metaService } from '../services/platforms/meta';
import { youtubeService } from '../services/platforms/youtube';
import { tiktokService } from '../services/platforms/tiktok';
import { pinterestService } from '../services/platforms/pinterest';
import { ensureFreshPlatformConnection, hasPublishablePlatformConnection, hasUsablePlatformAccessToken } from '../services/platforms/connectionAuth';
import { getBackblazeAuthorizedDownloadUrl, uploadBufferToBackblaze, uploadLocalFileToBackblaze } from '../services/backblaze';
import { publisherService } from '../services/publisher.service';
import { authenticate } from '../middleware/auth';
import { google } from 'googleapis';
import fs from 'fs';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';
import { pipeline } from 'stream/promises';
import { createHash, randomBytes } from 'crypto';
import sharp from 'sharp';
import { resolveTMDbPublishImages } from '../services/tmdb-publish-image-selection';

const router = Router();
const upload = multer({ dest: 'uploads/' });

type SupportedPlatform =
    | 'Instagram'
    | 'InstagramFeed'
    | 'InstagramReels'
    | 'InstagramStories'
    | 'Facebook'
    | 'FacebookFeed'
    | 'FacebookStories'
    | 'Threads'
    | 'TikTok'
    | 'X'
    | 'YouTube'
    | 'YouTubeLongform'
    | 'YouTubeShorts'
    | 'Pinterest';

interface BackendPlatformStatus {
    connected: boolean;
    username?: string;
    lastPost?: string;
    profileUrl?: string;
    expiresAt?: string;
    error?: string;
}

interface OAuthStatePayload {
    platform: SupportedPlatform;
    redirectUri: string;
    nonce: string;
    codeVerifier?: string;
}

interface PinterestBoardPayload {
    id: string;
    name: string;
    description?: string;
    privacy?: string;
    pin_count?: number;
}

interface YouTubePlaylistPayload {
    id: string;
    title: string;
    itemCount?: number;
    privacyStatus?: string;
}

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';
const META_COMMENT_AUTOMATION_SCOPES = {
    Facebook: ['pages_manage_engagement'],
    Instagram: ['instagram_manage_comments'],
} as const;
const META_BASE_SCOPES = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'] as const;
type NormalizedMediaChoice =
    | { kind: 'none' }
    | { kind: 'image'; source: string; sourceType: 'file' | 'remote-url' }
    | { kind: 'video'; source: string; sourceType: 'file' | 'remote-url' };

function asNonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asNonEmptyStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter(Boolean);
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed
                    .filter((entry): entry is string => typeof entry === 'string')
                    .map((entry) => entry.trim())
                    .filter(Boolean);
            }
        } catch {
            return value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean);
        }
    }

    return [];
}

function normalizeImageAssetTypes(value: unknown): string[] {
    return asNonEmptyStringArray(value).map((entry) => entry.toLowerCase());
}

function resolvePreferredMediaChoice(options: {
    localFilePath: string | null;
    mimeType?: string | null;
    imageUrl?: string;
    videoUrl?: string;
}): NormalizedMediaChoice {
    if (options.localFilePath && options.mimeType) {
        if (isVideoMimeType(options.mimeType)) {
            return { kind: 'video', source: options.localFilePath, sourceType: 'file' };
        }
        if (isImageMimeType(options.mimeType)) {
            return { kind: 'image', source: options.localFilePath, sourceType: 'file' };
        }
    }

    if (options.videoUrl) {
        return { kind: 'video', source: options.videoUrl, sourceType: 'remote-url' };
    }

    if (options.imageUrl) {
        return { kind: 'image', source: options.imageUrl, sourceType: 'remote-url' };
    }

    return { kind: 'none' };
}

function normalizePlatform(value?: string | null): SupportedPlatform | null {
    if (!value) return null;

    switch (value.trim().toLowerCase()) {
        case 'instagram':
            return 'Instagram';
        case 'instagramfeed':
        case 'instagram_feed':
        case 'instagram feed':
            return 'InstagramFeed';
        case 'instagramreels':
        case 'instagram_reels':
        case 'instagram reels':
            return 'InstagramReels';
        case 'instagramstories':
        case 'instagram_stories':
        case 'instagram stories':
            return 'InstagramStories';
        case 'facebook':
            return 'Facebook';
        case 'facebookfeed':
        case 'facebook_feed':
        case 'facebook feed':
            return 'FacebookFeed';
        case 'facebookstories':
        case 'facebook_stories':
        case 'facebook stories':
            return 'FacebookStories';
        case 'threads':
            return 'Threads';
        case 'tiktok':
            return 'TikTok';
        case 'x':
        case 'twitter':
            return 'X';
        case 'youtube':
            return 'YouTube';
        case 'youtubelongform':
        case 'youtube_longform':
        case 'youtube longform':
        case 'youtube long-form':
            return 'YouTubeLongform';
        case 'youtubeshorts':
        case 'youtube_shorts':
        case 'youtube shorts':
            return 'YouTubeShorts';
        case 'pinterest':
            return 'Pinterest';
        default:
            return null;
    }
}

function getConnectionPlatform(platform: SupportedPlatform): Exclude<SupportedPlatform, 'InstagramFeed' | 'InstagramReels' | 'InstagramStories' | 'FacebookFeed' | 'FacebookStories'> {
    switch (platform) {
        case 'InstagramFeed':
        case 'InstagramReels':
        case 'InstagramStories':
            return 'Instagram';
        case 'FacebookFeed':
        case 'FacebookStories':
            return 'Facebook';
        case 'YouTubeLongform':
        case 'YouTubeShorts':
            return 'YouTube';
        default:
            return platform;
    }
}

function getPublishPlatformLabel(platform: SupportedPlatform): string {
    switch (platform) {
        case 'InstagramFeed':
            return 'Instagram Feed';
        case 'InstagramReels':
            return 'Instagram Reels';
        case 'InstagramStories':
            return 'Instagram Stories';
        case 'FacebookFeed':
            return 'Facebook Feed';
        case 'FacebookStories':
            return 'Facebook Stories';
        case 'YouTubeLongform':
            return 'YouTube Long-form';
        case 'YouTubeShorts':
            return 'YouTube Shorts';
        default:
            return platform;
    }
}

function createDisconnectedStatus(): Record<SupportedPlatform, BackendPlatformStatus> {
    return {
        X: { connected: false },
        Facebook: { connected: false },
        FacebookFeed: { connected: false },
        FacebookStories: { connected: false },
        Instagram: { connected: false },
        InstagramFeed: { connected: false },
        InstagramReels: { connected: false },
        InstagramStories: { connected: false },
        Threads: { connected: false },
        YouTube: { connected: false },
        YouTubeLongform: { connected: false },
        YouTubeShorts: { connected: false },
        TikTok: { connected: false },
        Pinterest: { connected: false },
    };
}

function getRedirectUri(override?: string): string {
    if (override) {
        return override.replace(/\/+$/, '');
    }

    return `${(env.FRONTEND_URL || '').replace(/\/+$/, '')}/platforms/callback`;
}

function getRequestedRedirectUri(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }

    try {
        const parsed = new URL(trimmed);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return undefined;
        }

        return parsed.toString().replace(/\/+$/, '');
    } catch {
        return undefined;
    }
}

function normalizePinterestBoard(board: any): PinterestBoardPayload | null {
    if (!board?.id || !board?.name) {
        return null;
    }

    return {
        id: String(board.id),
        name: String(board.name),
        description: typeof board.description === 'string' ? board.description : undefined,
        privacy: typeof board.privacy === 'string' ? board.privacy : undefined,
        pin_count: typeof board.pin_count === 'number' ? board.pin_count : undefined,
    };
}

function extractProviderMessage(error: any): string {
    const data = error?.response?.data;
    const oauthError = typeof data?.error === 'string' ? data.error : undefined;
    const oauthErrorDescription = typeof data?.error_description === 'string'
        ? data.error_description
        : undefined;

    if (oauthErrorDescription) {
        return oauthError ? `${oauthError}: ${oauthErrorDescription}` : oauthErrorDescription;
    }

    return (
        data?.error?.message ||
        data?.error_message ||
        data?.message ||
        data?.detail ||
        data?.title ||
        data?.errors?.[0]?.message ||
        oauthError ||
        error.message ||
        'OAuth callback failed'
    );
}

function createProviderStageError(stage: string, error: any): Error {
    const message = extractProviderMessage(error);
    const wrapped = new Error(`${stage}: ${message}`);
    (wrapped as Error & { response?: unknown }).response = error?.response;
    return wrapped;
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
    const resolvedUrl = await getBackblazeAuthorizedDownloadUrl(remoteUrl);
    const parsedUrl = new URL(resolvedUrl);
    const extension = path.extname(parsedUrl.pathname) || '.bin';
    const filePath = path.join(os.tmpdir(), `${label}-${Date.now()}-${randomBytes(6).toString('hex')}${extension}`);
    const response = await axios.get(resolvedUrl, { responseType: 'stream', timeout: 60000 });
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

function isImageMimeType(value?: string | null): boolean {
    return typeof value === 'string' && value.startsWith('image/');
}

function isVideoMimeType(value?: string | null): boolean {
    return typeof value === 'string' && value.startsWith('video/');
}

function getMimeTypeFromFilePath(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.gif':
            return 'image/gif';
        case '.mp4':
            return 'video/mp4';
        case '.mov':
            return 'video/quicktime';
        case '.m4v':
            return 'video/x-m4v';
        case '.webm':
            return 'video/webm';
        default:
            return 'application/octet-stream';
    }
}

async function preserveUploadedFileExtension(file?: Express.Multer.File): Promise<string | null> {
    if (!file?.path) {
        return null;
    }

    if (path.extname(file.path)) {
        return file.path;
    }

    const originalExtension = path.extname(file.originalname || '');
    if (!originalExtension) {
        return file.path;
    }

    const renamedPath = `${file.path}${originalExtension.toLowerCase()}`;
    await fs.promises.rename(file.path, renamedPath);
    file.path = renamedPath;
    return renamedPath;
}

function buildRemoteFileName(remoteUrl: string, fallbackBaseName: string): string {
    try {
        const parsedUrl = new URL(remoteUrl);
        const candidate = path.basename(parsedUrl.pathname);
        if (candidate && candidate !== '/') {
            return candidate;
        }
    } catch {
        // Ignore and use fallback.
    }

    return `${fallbackBaseName}-${Date.now()}`;
}

async function downloadRemoteBuffer(remoteUrl: string): Promise<{ buffer: Buffer; fileName: string }> {
    const resolvedUrl = await getBackblazeAuthorizedDownloadUrl(remoteUrl);
    const response = await axios.get(resolvedUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
    });

    return {
        buffer: Buffer.from(response.data),
        fileName: buildRemoteFileName(resolvedUrl, 'remote-media'),
    };
}

function normalizeYouTubePlaylist(playlist: any): YouTubePlaylistPayload | null {
    if (!playlist?.id || !playlist?.title) {
        return null;
    }

    return {
        id: String(playlist.id),
        title: String(playlist.title),
        itemCount: typeof playlist.itemCount === 'number' ? playlist.itemCount : undefined,
        privacyStatus: typeof playlist.privacyStatus === 'string' ? playlist.privacyStatus : undefined,
    };
}

async function prepareHostedImageUrl(options: {
    localFilePath?: string | null;
    originalName?: string | null;
    remoteUrl?: string | null;
    prefix?: string;
}): Promise<string | undefined> {
    const prefix = options.prefix || 'platform-posts/images';
    let sourceBuffer: Buffer;
    let originalName: string;

    if (options.localFilePath) {
        sourceBuffer = await fs.promises.readFile(options.localFilePath);
        originalName = options.originalName || path.basename(options.localFilePath);
    } else if (options.remoteUrl) {
        const remote = await downloadRemoteBuffer(options.remoteUrl);
        sourceBuffer = remote.buffer;
        originalName = remote.fileName;
    } else {
        return undefined;
    }

    const baseName = path.parse(originalName).name || 'image';
    const normalizedBuffer = await sharp(sourceBuffer, { animated: false })
        .rotate()
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();

    const uploadedImage = await uploadBufferToBackblaze(
        normalizedBuffer,
        `${baseName}.jpg`,
        {
            bucketTypes: ['general', 'design'],
            prefix,
            contentType: 'image/jpeg',
        }
    );

    return getBackblazeAuthorizedDownloadUrl(uploadedImage.url);
}

async function updateConnectionMetadata(platform: SupportedPlatform, patch: Prisma.JsonObject): Promise<void> {
    const connection = await findPlatformConnection(platform);
    if (!connection) return;

    await updatePlatformConnection(platform, {
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        expiresAt: connection.expiresAt,
        username: connection.username,
        userId: connection.userId,
        metadata: {
            ...getJsonObject(connection.metadata),
            ...patch,
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
    let localFilePath: string | null = null;
    let downloadedVideoPath: string | null = null;
    let downloadedThumbnailPath: string | null = null;
    let preparedImageUrl: string | undefined;
    let hostedVideoUrl: string | undefined;

    try {
        localFilePath = await preserveUploadedFileExtension(req.file);
        const { platforms, content } = req.body;
        // Content might be JSON stringified if multipart/form-data
        const parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
        const {
            title,
            youtubeTitle,
            youtubeDescription,
            sharedThumbnailUrl,
            youtubeThumbnailUrl
        } = parsedContent;
        const text = asNonEmptyString(parsedContent?.text) || '';
        const link = asNonEmptyString(parsedContent?.link);
        const pinterestRequestedBoard = asNonEmptyString(parsedContent?.pinterestBoardId)
            || asNonEmptyString(parsedContent?.pinterestBoardName);
        const youtubePlaylists = Array.isArray(parsedContent?.youtubePlaylistIds)
            ? parsedContent.youtubePlaylistIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
            : typeof parsedContent?.youtubePlaylistIds === 'string'
                ? parsedContent.youtubePlaylistIds.split(',').map((value: string) => value.trim()).filter(Boolean)
                : [];

        let imageUrl = asNonEmptyString(parsedContent?.imageUrl);
        let imageUrls = asNonEmptyStringArray(parsedContent?.imageUrls);
        const imageTypes = normalizeImageAssetTypes(parsedContent?.imageTypes);
        let videoUrl = asNonEmptyString(parsedContent?.videoUrl);
        const hasUploadedImage = Boolean(localFilePath && isImageMimeType(req.file?.mimetype));
        const hasUploadedVideo = Boolean(localFilePath && isVideoMimeType(req.file?.mimetype));
        const normalizedTmdbImages = await resolveTMDbPublishImages({
            imageUrl,
            imageUrls,
            imageType: asNonEmptyString(parsedContent?.imageType),
            imageTypes,
        });
        imageUrl = normalizedTmdbImages.imageUrl;
        imageUrls = normalizedTmdbImages.imageUrls;

        const coverImageUrl = sharedThumbnailUrl || imageUrl || imageUrls[0];
        const preferredMedia = resolvePreferredMediaChoice({
            localFilePath,
            mimeType: req.file?.mimetype,
            imageUrl,
            videoUrl,
        });

        console.log('[Platforms] Normalized publish media input', {
            selectedSource: preferredMedia.kind === 'none' ? 'none' : `${preferredMedia.kind}:${preferredMedia.sourceType}`,
            hasUploadedFile: Boolean(localFilePath),
            originalMimeType: req.file?.mimetype || null,
            imageUrlPresent: Boolean(imageUrl),
            imageUrlsCount: imageUrls.length,
            videoUrlPresent: Boolean(videoUrl),
            textLength: text.length,
        });

        if (preferredMedia.kind === 'video') {
            imageUrl = undefined;
        } else if (preferredMedia.kind === 'image') {
            videoUrl = undefined;
        } else {
            imageUrl = undefined;
            videoUrl = undefined;
        }

        const getPreparedImageUrl = async (): Promise<string | undefined> => {
            if (preparedImageUrl !== undefined) {
                return preparedImageUrl;
            }

            preparedImageUrl = await prepareHostedImageUrl({
                localFilePath: hasUploadedImage ? localFilePath : null,
                originalName: req.file?.originalname,
                remoteUrl: !hasUploadedImage ? coverImageUrl : null,
            });

            return preparedImageUrl;
        };

        let preparedImageUrls: string[] = [];
        let preparedImageUrlsReady = false;
        const getPreparedImageUrls = async (): Promise<string[]> => {
            if (preparedImageUrlsReady) {
                return preparedImageUrls;
            }

            if (hasUploadedImage && localFilePath) {
                const uploadedImage = await prepareHostedImageUrl({
                    localFilePath,
                    originalName: req.file?.originalname,
                });
                preparedImageUrls = uploadedImage ? [uploadedImage] : [];
                preparedImageUrlsReady = true;
                return preparedImageUrls;
            }

            if (imageUrls.length > 0) {
                preparedImageUrls = await Promise.all(
                    imageUrls.map((source) => prepareHostedImageUrl({ remoteUrl: source })),
                ).then((sources) => sources.filter((value): value is string => typeof value === 'string' && value.trim().length > 0));
                preparedImageUrlsReady = true;
                return preparedImageUrls;
            }

            const singleImage = await getPreparedImageUrl();
            preparedImageUrls = singleImage ? [singleImage] : [];
            preparedImageUrlsReady = true;
            return preparedImageUrls;
        };

        const getDownloadedVideoPath = async (): Promise<string> => {
            if (hasUploadedVideo && localFilePath) {
                return localFilePath;
            }

            if (downloadedVideoPath) {
                return downloadedVideoPath;
            }

            if (!videoUrl) {
                throw new Error('A public video URL is required');
            }

            downloadedVideoPath = await downloadRemoteFile(videoUrl, 'screndly-video');
            return downloadedVideoPath;
        };

        const getHostedVideoUrl = async (): Promise<string> => {
            if (hostedVideoUrl) {
                return hostedVideoUrl;
            }

            const sourcePath = await getDownloadedVideoPath();
            const fileName = hasUploadedVideo && req.file?.originalname
                ? req.file.originalname
                : buildRemoteFileName(videoUrl || '', 'remote-video.mp4');

            const uploadedVideo = await uploadLocalFileToBackblaze(sourcePath, fileName, {
                bucketTypes: ['videos', 'general'],
                prefix: 'platform-posts/videos',
                contentType: hasUploadedVideo
                    ? (req.file?.mimetype || getMimeTypeFromFilePath(sourcePath))
                    : getMimeTypeFromFilePath(sourcePath),
            });

            hostedVideoUrl = await getBackblazeAuthorizedDownloadUrl(uploadedVideo.url);
            return hostedVideoUrl;
        };

        const getDownloadedThumbnailPath = async (thumbnailUrl?: string): Promise<string | null> => {
            if (!thumbnailUrl) {
                return null;
            }

            if (downloadedThumbnailPath) {
                return downloadedThumbnailPath;
            }

            downloadedThumbnailPath = await downloadRemoteFile(thumbnailUrl, 'screndly-thumbnail');
            return downloadedThumbnailPath;
        };

        const results = [];
        let platformList = typeof platforms === 'string' ? JSON.parse(platforms) : platforms;
        platformList = (platformList || [])
            .map((value: string) => normalizePlatform(value))
            .filter((value: SupportedPlatform | null): value is SupportedPlatform => value !== null);

        for (const platform of platformList) {
            const connectionPlatform = getConnectionPlatform(platform);
            const platformLabel = getPublishPlatformLabel(platform);
            // Get platform connection
            let connection = await findPlatformConnection(connectionPlatform);
            connection = await ensureFreshPlatformConnection(connection);

            let result: any = { platform: platformLabel, status: 'failed', error: 'Platform not configured' };

            try {
                switch (platform) {
                    case 'X':
                        if (connection?.accessToken) {
                            const normalizedImageSources = imageUrls.length > 0
                                ? imageUrls
                                : preferredMedia.kind === 'image'
                                    ? [preferredMedia.source]
                                    : [];
                            const xResult = preferredMedia.kind === 'video'
                                ? await xService.postVideoTweet(
                                    text,
                                    preferredMedia.source,
                                    connection
                                )
                                : await xService.postTweet(
                                    text,
                                    normalizedImageSources.length > 0 ? normalizedImageSources : undefined,
                                    connection
                                );
                            result = { platform: platformLabel, ...xResult, status: xResult.success ? 'posted' : 'failed' };
                        }
                        break;

                    case 'Facebook':
                    case 'FacebookFeed':
                        if (connection?.accessToken && connection.userId) {
                            const preparedImageSources = await getPreparedImageUrls();
                            const fbResult = (hasUploadedVideo || videoUrl)
                                ? await metaService.postVideoToFacebook(
                                    connection.userId,
                                    text,
                                    await getDownloadedVideoPath(),
                                    connection.accessToken
                                )
                                : await metaService.postToFacebook(
                                    connection.userId,
                                    text,
                                    preparedImageSources.length > 0 ? preparedImageSources : ((await getPreparedImageUrl()) ?? null),
                                    connection.accessToken,
                                    link
                                );

                            let warning: string | undefined;
                            if (fbResult.success && fbResult.data?.id && (hasUploadedVideo || videoUrl) && sharedThumbnailUrl) {
                                const thumbnailPath = await getDownloadedThumbnailPath(sharedThumbnailUrl);
                                if (thumbnailPath) {
                                    const thumbnailResult = await metaService.setFacebookVideoThumbnail(
                                        fbResult.data.id,
                                        thumbnailPath,
                                        connection.accessToken
                                    );
                                    if (!thumbnailResult.success) {
                                        warning = thumbnailResult.error;
                                    }
                                }
                            }

                            result = {
                                platform: platformLabel,
                                ...fbResult,
                                status: fbResult.success ? 'posted' : 'failed',
                                ...(warning ? { warning } : {}),
                            };
                        }
                        break;

                    case 'FacebookStories':
                        if (!hasUploadedVideo && !videoUrl && !hasUploadedImage && !imageUrl) {
                            result = {
                                platform: platformLabel,
                                status: 'failed',
                                error: 'Facebook Stories requires an image or video URL, or an uploaded image/video file.',
                            };
                        } else if (connection?.accessToken && connection.userId) {
                            const fbStoryResult = await metaService.postToFacebookStory(
                                connection.userId,
                                (hasUploadedVideo || videoUrl)
                                    ? await getHostedVideoUrl()
                                    : await getPreparedImageUrl() || '',
                                connection.accessToken,
                                (hasUploadedVideo || videoUrl) ? 'video' : 'image'
                            );
                            result = {
                                platform: platformLabel,
                                ...fbStoryResult,
                                status: fbStoryResult.success ? 'posted' : 'failed',
                            };
                        }
                        break;

                    case 'Instagram':
                    case 'InstagramFeed':
                    case 'InstagramReels':
                    case 'InstagramStories':
                        if (!hasUploadedVideo && !videoUrl && !hasUploadedImage && !imageUrl) {
                            result = {
                                platform: platformLabel,
                                status: 'failed',
                                error: 'Instagram requires an image or video URL, or an uploaded image/video file.',
                            };
                        } else if (hasUsablePlatformAccessToken(connection) && connection?.userId) {
                            const instagramAccessToken = connection.accessToken as string;
                            const mediaKind = (hasUploadedVideo || videoUrl) ? 'video' : 'image';

                            if (platform === 'InstagramFeed' && mediaKind !== 'image') {
                                result = {
                                    platform: platformLabel,
                                    status: 'failed',
                                    error: 'Instagram Feed publishing currently requires a single image.',
                                };
                                break;
                            }

                            if (platform === 'InstagramReels' && mediaKind !== 'video') {
                                result = {
                                    platform: platformLabel,
                                    status: 'failed',
                                    error: 'Instagram Reels publishing requires a video.',
                                };
                                break;
                            }

                            const igResult =
                                platform === 'InstagramStories'
                                    ? await metaService.postToInstagramStory(
                                        connection.userId,
                                        mediaKind === 'video' ? await getHostedVideoUrl() : await getPreparedImageUrl() || '',
                                        instagramAccessToken,
                                        mediaKind
                                    )
                                    : platform === 'InstagramFeed'
                                        ? await metaService.postToInstagram(
                                            connection.userId,
                                            text,
                                            await getPreparedImageUrl() || '',
                                            instagramAccessToken
                                        )
                                        : (hasUploadedVideo || videoUrl)
                                            ? await metaService.postVideoToInstagramReel(
                                                connection.userId,
                                                text,
                                                await getHostedVideoUrl(),
                                                instagramAccessToken,
                                                await getPreparedImageUrl()
                                            )
                                            : await metaService.postToInstagram(
                                                connection.userId,
                                                text,
                                                await getPreparedImageUrl() || '',
                                                instagramAccessToken
                                            );
                            result = { platform: platformLabel, ...igResult, status: igResult.success ? 'posted' : 'failed' };
                        } else {
                            result = {
                                platform: platformLabel,
                                status: 'failed',
                                error: 'Instagram connection is invalid or incomplete. Reconnect Instagram from Platforms.',
                            };
                        }
                        break;

                    case 'Threads':
                        if (connection?.accessToken && connection.userId) {
                            const preparedImageSources = await getPreparedImageUrls();
                            const threadsResult = (hasUploadedVideo || videoUrl)
                                ? await metaService.postVideoToThreads(
                                    connection.userId,
                                    text,
                                    await getHostedVideoUrl(),
                                    connection.accessToken
                                )
                                : await metaService.postToThreads(
                                        connection.userId,
                                        text,
                                        preparedImageSources.length > 0 ? preparedImageSources : null,
                                        connection.accessToken
                                    );
                            result = { platform: platformLabel, ...threadsResult, status: threadsResult.success ? 'posted' : 'failed' };
                        }
                        break;

                    case 'TikTok':
                        if (connection?.accessToken) {
                            if (localFilePath || videoUrl) {
                                const tiktokSourcePath = await getDownloadedVideoPath();
                                const ttResult = await tiktokService.postVideo(
                                    {
                                        filePath: tiktokSourcePath,
                                        fileName: req.file?.originalname || buildRemoteFileName(videoUrl || '', 'screndly-tiktok-video'),
                                        mimeType: req.file?.mimetype || getMimeTypeFromFilePath(tiktokSourcePath),
                                    },
                                    title || text,
                                    connection.accessToken
                                );
                            result = { platform: platformLabel, ...ttResult, status: ttResult.success ? 'posted' : 'failed' };
                        } else {
                                result = { platform: platformLabel, status: 'failed', error: 'TikTok requires a video file upload or public video URL' };
                            }
                        }
                        break;

                    case 'YouTube':
                    case 'YouTubeLongform':
                    case 'YouTubeShorts':
                        if (!localFilePath && videoUrl) {
                            downloadedVideoPath = downloadedVideoPath || await downloadRemoteFile(videoUrl, 'screndly-youtube');
                        }

                        if (connection?.accessToken && (localFilePath || downloadedVideoPath)) {
                            const youtubeThumbnailPath = await getDownloadedThumbnailPath(youtubeThumbnailUrl);
                            // Refresh token logic should be handled here or in service
                            const ytResult = await youtubeService.uploadVideo(
                                connection.accessToken,
                                localFilePath || downloadedVideoPath!,
                                {
                                    title: youtubeTitle || title || text.slice(0, 100),
                                    description: youtubeDescription || text,
                                    privacyStatus: 'public',
                                    thumbnailPath: youtubeThumbnailPath || undefined,
                                    playlistIds: platform === 'YouTubeShorts' ? [] : youtubePlaylists,
                                },
                                connection.refreshToken || undefined
                            );
                            result = { platform: platformLabel, ...ytResult, status: ytResult.success ? 'posted' : 'failed' };
                        } else {
                            result = { platform: platformLabel, status: 'failed', error: 'YouTube requires a video file upload or public video URL' };
                        }
                        break;

                    case 'Pinterest':
                        if (!hasUploadedVideo && !videoUrl && !hasUploadedImage && !imageUrl) {
                            result = { platform: platformLabel, status: 'failed', error: 'Pinterest requires an image or video URL, or an uploaded image/video file.' };
                        } else if (connection?.accessToken) {
                            const metadata = getJsonObject(connection.metadata);
                            let boardId = getJsonString(metadata, 'boardId');
                            let boardName = getJsonString(metadata, 'boardName');

                            if (pinterestRequestedBoard && pinterestRequestedBoard !== boardId) {
                                if (pinterestRequestedBoard === boardName && boardId) {
                                    // Keep existing metadata board id when legacy settings store the board name.
                                } else {
                                    const boardsResponse = await pinterestService.getBoards(connection.accessToken);
                                    const matchedBoard = Array.isArray(boardsResponse?.items)
                                        ? boardsResponse.items.find((board: any) => board?.id === pinterestRequestedBoard || board?.name === pinterestRequestedBoard)
                                        : null;
                                    if (matchedBoard?.id) {
                                        boardId = matchedBoard.id;
                                        boardName = matchedBoard.name || boardName;
                                    }
                                }
                            }

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
                                result = { platform: platformLabel, status: 'failed', error: 'Pinterest board not available for posting' };
                                break;
                            }

                            const pinResult = (hasUploadedVideo || videoUrl)
                                ? await pinterestService.createVideoPin(
                                    boardId,
                                    title || text.slice(0, 100) || 'Screndly Pin',
                                    text,
                                    await getDownloadedVideoPath(),
                                    connection.accessToken,
                                    {
                                        link,
                                        altText: title || text.slice(0, 100) || 'Screndly Pin',
                                        coverImageUrl: await getPreparedImageUrl(),
                                    }
                                )
                                : await pinterestService.createPin(
                                    boardId,
                                    title || text.slice(0, 100) || 'Screndly Pin',
                                    text,
                                    await getPreparedImageUrl() || '',
                                    connection.accessToken,
                                    {
                                        link,
                                        altText: title || text.slice(0, 100) || 'Screndly Pin'
                                    }
                                );
                            result = { platform: platformLabel, ...pinResult, status: pinResult.success ? 'posted' : 'failed' };
                        } else {
                            result = { platform: platformLabel, status: 'failed', error: 'Pinterest requires an image or video URL, or an uploaded image/video file.' };
                        }
                        break;

                    default:
                        result = { platform: platformLabel, status: 'failed', error: 'Unknown platform' };
                }
            } catch (err: any) {
                result = { platform: platformLabel, status: 'failed', error: err.message };
            }

            result.postedAt = new Date().toISOString();
            results.push(result);

            if (result.status === 'posted') {
                await updateConnectionMetadata(connectionPlatform, { lastPostAt: result.postedAt as string });
            }
        }

        // Cleanup uploaded file
        await cleanupFile(localFilePath);
        await cleanupFile(downloadedVideoPath);
        await cleanupFile(downloadedThumbnailPath);
        localFilePath = null;
        downloadedVideoPath = null;
        downloadedThumbnailPath = null;

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
        await cleanupFile(downloadedThumbnailPath);
        res.status(500).json({ success: false, error: { message: 'Failed to post to platforms' } });
    }
});

// GET /api/platforms/status (Protected)
router.get('/status', authenticate, async (req, res) => {
    // ... existing logic ...
    try {
        const connections = await findPlatformConnections();
        const refreshedConnections = await Promise.all(
            connections.map(async (connection) => {
                try {
                    const freshConnection = await ensureFreshPlatformConnection(connection);
                    return {
                        connection: freshConnection || connection,
                        error: undefined as string | undefined,
                    };
                } catch (error: any) {
                    console.error(`[Platforms] Failed to refresh ${connection.platform} status:`, error?.response?.data || error);
                    return {
                        connection,
                        error: extractProviderMessage(error),
                    };
                }
            })
        );
        const status: Record<SupportedPlatform, BackendPlatformStatus> = createDisconnectedStatus();
        refreshedConnections.forEach(({ connection: conn, error }) => {
            const platform = normalizePlatform(conn.platform);
            if (!platform) return;

            const metadata = getJsonObject(conn.metadata);
            const connected = hasPublishablePlatformConnection(conn);
            const nextStatus: BackendPlatformStatus = {
                connected,
                username: conn.username || undefined,
                lastPost: getJsonString(metadata, 'lastPostAt'),
                profileUrl: buildProfileUrl(platform, conn.username, conn.userId, metadata),
                expiresAt: conn.expiresAt?.toISOString(),
                error: error || (!connected && hasUsablePlatformAccessToken(conn)
                    ? `${platform} connection is incomplete. Reconnect ${platform} from Platforms.`
                    : undefined),
            };

            status[platform] = nextStatus;

            if (platform === 'Instagram') {
                status.InstagramFeed = nextStatus;
                status.InstagramReels = nextStatus;
                status.InstagramStories = nextStatus;
            }

            if (platform === 'Facebook') {
                status.FacebookFeed = nextStatus;
                status.FacebookStories = nextStatus;
            }

            if (platform === 'YouTube') {
                status.YouTubeLongform = nextStatus;
                status.YouTubeShorts = nextStatus;
            }
        });
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch status' } });
    }
});

// GET /api/platforms/pinterest/boards (Protected)
router.get('/pinterest/boards', authenticate, async (_req, res) => {
    try {
        const connection = await findPlatformConnection('Pinterest');
        const freshConnection = await ensureFreshPlatformConnection(connection);

        if (!freshConnection?.accessToken) {
            return res.status(404).json({ success: false, error: { message: 'Pinterest is not connected' } });
        }

        const boardsResponse = await pinterestService.getBoards(freshConnection.accessToken);
        const boards = Array.isArray(boardsResponse?.items)
            ? boardsResponse.items.map(normalizePinterestBoard).filter(Boolean)
            : [];

        return res.json({ success: true, data: boards });
    } catch (error: any) {
        console.error('Pinterest boards fetch error:', error?.response?.data || error);
        return res.status(500).json({
            success: false,
            error: { message: extractProviderMessage(error) || 'Failed to fetch Pinterest boards' },
        });
    }
});

// GET /api/platforms/youtube/playlists (Protected)
router.get('/youtube/playlists', authenticate, async (_req, res) => {
    try {
        const connection = await findPlatformConnection('YouTube');
        const freshConnection = await ensureFreshPlatformConnection(connection);

        if (!freshConnection || !hasUsablePlatformAccessToken(freshConnection)) {
            return res.status(404).json({ success: false, error: { message: 'YouTube is not connected' } });
        }

        const accessToken = freshConnection.accessToken;
        if (!accessToken) {
            return res.status(404).json({ success: false, error: { message: 'YouTube is not connected' } });
        }

        const playlists = await youtubeService.listPlaylists(
            accessToken,
            freshConnection.refreshToken || undefined
        );

        return res.json({
            success: true,
            data: playlists
                .map(normalizeYouTubePlaylist)
                .filter((playlist): playlist is YouTubePlaylistPayload => !!playlist),
        });
    } catch (error: any) {
        console.error('YouTube playlists fetch error:', error?.response?.data || error);
        return res.status(500).json({
            success: false,
            error: { message: extractProviderMessage(error) || 'Failed to fetch YouTube playlists' },
        });
    }
});

// POST /api/platforms/pinterest/boards (Protected)
router.post('/pinterest/boards', authenticate, async (req, res) => {
    try {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';

        if (!name) {
            return res.status(400).json({ success: false, error: { message: 'Board name is required' } });
        }

        const connection = await findPlatformConnection('Pinterest');
        const freshConnection = await ensureFreshPlatformConnection(connection);

        if (!freshConnection?.accessToken) {
            return res.status(404).json({ success: false, error: { message: 'Pinterest is not connected' } });
        }

        const createdBoard = normalizePinterestBoard(
            await pinterestService.createBoard(name, description, freshConnection.accessToken)
        );

        if (!createdBoard) {
            return res.status(502).json({
                success: false,
                error: { message: 'Pinterest did not return a valid board' },
            });
        }

        return res.status(201).json({ success: true, data: createdBoard });
    } catch (error: any) {
        console.error('Pinterest board creation error:', error?.response?.data || error);
        return res.status(500).json({
            success: false,
            error: { message: extractProviderMessage(error) || 'Failed to create Pinterest board' },
        });
    }
});

// POST /api/platforms/connect (Protected)
router.post('/connect', authenticate, async (req, res) => {
    return res.status(410).json({
        success: false,
        error: { message: 'Manual platform token ingestion is disabled. Use the signed OAuth flow instead.' },
    });
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
router.get('/auth/:platform', async (req, res) => {
    try {
        const platform = normalizePlatform(req.params.platform);
        if (!platform) throw new Error('Unsupported platform');

        const redirectUri = getRedirectUri(getRequestedRedirectUri(req.query.redirectUri));
        const shouldRedirect = req.query.redirect === '1' || req.query.redirect === 'true';
        let oauthUrl = '';
        const stateFor = (codeVerifier?: string) => createOAuthState(platform, redirectUri, codeVerifier);

        switch (platform) {
            case 'Instagram':
            case 'Facebook': {
                assertConfigured('Meta', { META_APP_ID: env.META_APP_ID });
                const scopes = platform === 'Instagram'
                    ? ['instagram_basic', 'instagram_content_publish', ...META_BASE_SCOPES, ...META_COMMENT_AUTOMATION_SCOPES.Instagram]
                    : [...META_BASE_SCOPES, ...META_COMMENT_AUTOMATION_SCOPES.Facebook];

                oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${env.META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(stateFor())}&response_type=code&scope=${encodeURIComponent(scopes.join(','))}`;
                break;
            }

            case 'Threads': {
                assertConfigured('Threads', {
                    THREADS_APP_ID: env.THREADS_APP_ID,
                });
                const scopes = [
                    'threads_basic',
                    'threads_content_publish',
                    'threads_read_replies',
                    'threads_manage_replies',
                ];
                oauthUrl = `https://threads.net/oauth/authorize?client_id=${encodeURIComponent(env.THREADS_APP_ID || '')}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(','))}&response_type=code&state=${encodeURIComponent(stateFor())}`;
                break;
            }

            case 'X': {
                assertXOAuthConfigured();
                const xClientId = getXOAuthClientId();
                const codeVerifier = createCodeVerifier();
                const codeChallenge = createCodeChallenge(codeVerifier);
                const scopes = ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'];

                oauthUrl = `https://x.com/i/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(xClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${encodeURIComponent(stateFor(codeVerifier))}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
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
                const tiktokClientKey = getTikTokClientKey();
                const tiktokClientSecret = getTikTokClientSecret();
                assertConfigured('TikTok', {
                    TIKTOK_CLIENT_KEY: tiktokClientKey,
                    TIKTOK_CLIENT_SECRET: tiktokClientSecret
                });

                const scopes = ['user.info.basic', 'video.publish', 'video.upload'];
                oauthUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(tiktokClientKey)}&scope=${encodeURIComponent(scopes.join(','))}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(stateFor())}`;
                break;
            }

            case 'Pinterest': {
                const pinterestAppId = getPinterestAppId();
                const pinterestAppSecret = getPinterestAppSecret();
                assertConfigured('Pinterest', {
                    PINTEREST_APP_ID: pinterestAppId,
                    PINTEREST_APP_SECRET: pinterestAppSecret
                });

                const scopes = ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'];
                oauthUrl = `https://www.pinterest.com/oauth/?consumer_id=${encodeURIComponent(pinterestAppId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&refreshable=true&scope=${encodeURIComponent(scopes.join(','))}&state=${encodeURIComponent(stateFor())}`;
                break;
            }

            default:
                throw new Error('Unsupported platform for automated OAuth');
        }

        if (shouldRedirect) {
            return res.redirect(oauthUrl);
        }

        res.json({ success: true, data: { url: oauthUrl } });
    } catch (error: any) {
        console.error('OAuth URL Error:', error);
        const requestedRedirect = getRequestedRedirectUri(req.query.redirectUri);
        const redirectUri = requestedRedirect ? getRedirectUri(requestedRedirect) : null;
        const shouldRedirect = req.query.redirect === '1' || req.query.redirect === 'true';

        if (shouldRedirect && redirectUri) {
            const callbackUrl = new URL(redirectUri);
            callbackUrl.searchParams.set('error', 'oauth_start_failed');
            callbackUrl.searchParams.set('error_description', error.message || 'Failed to generate OAuth URL');
            return res.redirect(callbackUrl.toString());
        }

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
            const grantedScopeInfo = await metaService.getGrantedScopes(userAccessToken);
            const grantedScopes = Array.from(new Set([
                ...grantedScopeInfo.scopes,
                ...grantedScopeInfo.granularScopes,
            ])).sort();

            // 3. Perform Discovery
            if (normalizedPlatform === 'Facebook') {
                const requiredAutomationScopes = [...META_COMMENT_AUTOMATION_SCOPES.Facebook];
                const pages = await metaService.getPages(userAccessToken);
                if (!pages || pages.length === 0) {
                    throw new Error('No Facebook Pages were found for this account. Connect an account that manages at least one Facebook Page.');
                }

                const page = pages[0];
                if (!page?.id || !page?.access_token) {
                    throw new Error('Facebook returned an incomplete Page record. Please reconnect and ensure page permissions are granted.');
                }

                await upsertPlatformConnection('Facebook', {
                    accessToken: page.access_token,
                    userId: page.id,
                    username: page.name,
                    expiresAt,
                    metadata: {
                        userToken: userAccessToken,
                        profileUrl: `https://www.facebook.com/${page.id}`,
                        grantedScopes,
                        requiredAutomationScopes,
                        automationReplyScopesGranted: requiredAutomationScopes.every((scope) => grantedScopes.includes(scope)),
                    }
                });
            } else if (normalizedPlatform === 'Instagram') {
                const requiredAutomationScopes = [...META_COMMENT_AUTOMATION_SCOPES.Instagram];
                const pages = await metaService.getPages(userAccessToken);
                if (!pages || pages.length === 0) {
                    throw new Error('No Facebook Pages were found for this account. Instagram Business connections require a Facebook Page linked to an Instagram professional account.');
                }
                let igId = null;
                let matchedPage: any = null;

                for (const page of pages) {
                    igId = await metaService.getInstagramBusinessId(page.id, page.access_token);
                    if (igId) {
                        matchedPage = page;
                        break;
                    }
                }

                if (igId && matchedPage?.id) {
                    const profile = await fetchInstagramProfile(igId, userAccessToken);
                    await upsertPlatformConnection('Instagram', {
                        accessToken: userAccessToken,
                        userId: igId,
                        username: profile.username || igId,
                        expiresAt,
                        metadata: {
                            userToken: userAccessToken,
                            pageId: matchedPage.id,
                            pageName: matchedPage.name,
                            profileUrl: profile.profileUrl,
                            grantedScopes,
                            requiredAutomationScopes,
                            automationReplyScopesGranted: requiredAutomationScopes.every((scope) => grantedScopes.includes(scope)),
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
            await upsertPlatformConnection('Threads', {
                accessToken: userAccessToken,
                userId: profile.id,
                username: profile.username || profile.name || profile.id,
                expiresAt,
                metadata: {
                    automationReplyScopesGranted: true,
                    requiredAutomationScopes: ['threads_read_replies', 'threads_manage_replies'],
                    profileUrl: profile.username ? `https://www.threads.net/@${profile.username}` : undefined,
                    profileImageUrl: profile.threads_profile_picture_url,
                    bio: profile.threads_biography,
                    isVerified: profile.is_verified
                }
            });
        } else if (normalizedPlatform === 'X') {
            if (!effectiveCodeVerifier) throw new Error('Missing PKCE verifier for X OAuth');
            assertXOAuthConfigured();

            const params = new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                redirect_uri: effectiveRedirectUri,
                code_verifier: effectiveCodeVerifier
            });
            const { params: tokenParams, headers: tokenHeaders } = buildXTokenRequest(params);

            let tokenResponse;
            try {
                tokenResponse = await axios.post('https://api.x.com/2/oauth2/token', tokenParams.toString(), {
                    headers: tokenHeaders
                });
            } catch (error) {
                throw createProviderStageError('X token exchange failed', error);
            }

            const tokenData = tokenResponse.data as {
                access_token: string;
                refresh_token?: string;
                expires_in?: number;
                scope?: string;
                token_type?: string;
            };

            let profileResponse;
            try {
                profileResponse = await axios.get('https://api.x.com/2/users/me', {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                    params: { 'user.fields': 'username,profile_image_url' }
                });
            } catch (error) {
                throw createProviderStageError('X profile lookup failed', error);
            }

            const profile = profileResponse.data?.data || {};
            if (!profile?.id) {
                throw new Error('X did not return the authenticated user profile. Check that the app has access to users.read.');
            }

            await upsertPlatformConnection('X', {
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

            await upsertPlatformConnection('YouTube', {
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
            });
        } else if (normalizedPlatform === 'TikTok') {
            const tiktokClientKey = getTikTokClientKey();
            const tiktokClientSecret = getTikTokClientSecret();
            assertConfigured('TikTok', {
                TIKTOK_CLIENT_KEY: tiktokClientKey,
                TIKTOK_CLIENT_SECRET: tiktokClientSecret
            });

            const params = new URLSearchParams({
                client_key: tiktokClientKey,
                client_secret: tiktokClientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: effectiveRedirectUri
            });

            let tokenResponse;
            try {
                tokenResponse = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', params.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cache-Control': 'no-cache'
                    }
                });
            } catch (error) {
                throw createProviderStageError('TikTok token exchange failed', error);
            }

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

            await upsertPlatformConnection('TikTok', {
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
            });
        } else if (normalizedPlatform === 'Pinterest') {
            const pinterestAppId = getPinterestAppId();
            const pinterestAppSecret = getPinterestAppSecret();
            assertConfigured('Pinterest', {
                PINTEREST_APP_ID: pinterestAppId,
                PINTEREST_APP_SECRET: pinterestAppSecret
            });

            const basicAuth = Buffer.from(`${pinterestAppId}:${pinterestAppSecret}`).toString('base64');
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

            await upsertPlatformConnection('Pinterest', {
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

        const providerMessage = extractProviderMessage(error);

        res.status(statusCode).json({
            success: false,
            error: { message: providerMessage }
        });
    }
});

export default router;
