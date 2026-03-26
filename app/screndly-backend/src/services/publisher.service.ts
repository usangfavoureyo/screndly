import axios from 'axios';
import fs from 'fs/promises';
import prisma from '../lib/prisma';
import { findPlatformConnection } from '../lib/platformConnections';
import path from 'path';
import sharp from 'sharp';
import { xService } from './platforms/x';
import { metaService } from './platforms/meta';
import { youtubeService } from './platforms/youtube';
import { tiktokService } from './platforms/tiktok';
import { pinterestService } from './platforms/pinterest';
import { ensureFreshPlatformConnection, hasPublishablePlatformConnection, hasUsablePlatformAccessToken } from './platforms/connectionAuth';
import { notificationService } from './notification.service';
import { getBackblazeAuthorizedDownloadUrl, uploadBufferToBackblaze, uploadLocalFileToBackblaze } from './backblaze';

export interface PublishContent {
    text: string;
    title?: string;
    description?: string;
    link?: string;
    imageUrl?: string;
    imageUrls?: string[];
    imagePath?: string;
    videoUrl?: string; // For platforms that support URL (TikTok)
    platformOverrides?: Partial<Record<string, Partial<Omit<PublishContent, 'platformOverrides'>>>>;
}

export interface PublishResult {
    platform: string;
    status: 'posted' | 'failed' | 'skipped';
    error?: string;
    id?: string;
    url?: string;
    postedAt: string;
}

export interface PublishOptions {
    youtubePlaylistIds?: string[];
    pinterestBoardId?: string;
    pinterestLink?: string;
}

function normalizePlatformName(platform: string): string {
    const normalized = platform.trim().toLowerCase();
    const platformMap: Record<string, string> = {
        x: 'X',
        twitter: 'X',
        facebook: 'Facebook',
        instagram: 'Instagram',
        threads: 'Threads',
        youtube: 'YouTube',
        tiktok: 'TikTok',
        pinterest: 'Pinterest'
    };

    return platformMap[normalized] || platform;
}

function describePublishItem(content: PublishContent, localVideoFile?: string | null): string {
    const explicitTitle = content.title?.trim();
    if (explicitTitle) {
        return explicitTitle;
    }

    const firstImage = content.imagePath || content.imageUrl || content.imageUrls?.[0];
    const localPath = localVideoFile || content.videoUrl || firstImage || content.link;
    if (localPath) {
        const cleanPath = localPath.split('?')[0];
        const lastSegment = cleanPath.split('/').pop();
        if (lastSegment) {
            return lastSegment;
        }
    }

    const fallbackText = content.text?.trim();
    if (fallbackText) {
        return fallbackText.slice(0, 80);
    }

    return 'Untitled item';
}

export class PublisherService {
    private normalizeRemoteMediaUrl(value: string): string {
        try {
            const parsed = new URL(value.trim());
            parsed.searchParams.delete('Authorization');
            return parsed.toString();
        } catch {
            return value.trim();
        }
    }

    private isBackblazeHostedUrl(value: string): boolean {
        try {
            const host = new URL(value).hostname.toLowerCase();
            return host.includes('backblazeb2.com');
        } catch {
            return false;
        }
    }

    private isMetaRiskyGeneratedImageUrl(value: string): boolean {
        if (!this.isBackblazeHostedUrl(value)) {
            return false;
        }

        const normalized = value.toLowerCase();
        return normalized.includes('/rss/logo-cards/')
            || normalized.includes('/social-publish/meta-images/')
            || normalized.includes('/generated-thumbnails/');
    }

    private getInvalidConnectionMessage(platform: string): string {
        switch (platform) {
            case 'Facebook':
                return 'Facebook connection is invalid or incomplete. Reconnect Facebook from Platforms.';
            case 'Instagram':
                return 'Instagram connection is invalid or incomplete. Reconnect Instagram from Platforms.';
            case 'Threads':
                return 'Threads connection is invalid or incomplete. Reconnect Threads from Platforms.';
            default:
                return 'Platform not configured';
        }
    }

    private getMimeType(filePath: string): string {
        const extension = path.extname(filePath).toLowerCase();
        switch (extension) {
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

    private getResolvedImageUrls(content: PublishContent): string[] {
        const candidates = [
            ...(Array.isArray(content.imageUrls) ? content.imageUrls : []),
            content.imageUrl,
            content.imagePath,
        ];

        const seen = new Set<string>();
        const resolved: string[] = [];
        for (const candidate of candidates) {
            if (typeof candidate !== 'string') continue;
            const trimmed = candidate.trim();
            if (!trimmed || seen.has(trimmed)) continue;
            seen.add(trimmed);
            resolved.push(trimmed);
        }

        return resolved;
    }

    private getRemoteCoverImageUrl(content: PublishContent): string | undefined {
        return this.getResolvedImageUrls(content).find((value) => /^https?:\/\//i.test(value));
    }

    private async getResolvedPublishImageUrls(content: PublishContent, platform: string): Promise<string[]> {
        const rawUrls = this
            .getResolvedImageUrls(content)
            .slice(0, this.getPlatformImageLimit(platform));

        return Promise.all(rawUrls.map((value) => getBackblazeAuthorizedDownloadUrl(this.normalizeRemoteMediaUrl(value))));
    }

    private async getResolvedRemoteCoverImageUrl(content: PublishContent): Promise<string | undefined> {
        const value = this.getRemoteCoverImageUrl(content);
        return value ? getBackblazeAuthorizedDownloadUrl(this.normalizeRemoteMediaUrl(value)) : undefined;
    }

    private async prepareHostedMetaImageUrl(source: string, cache: Map<string, string>): Promise<string> {
        const cacheKey = source.trim();
        const cached = cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        let sourceBuffer: Buffer;
        let originalName: string;

        if (/^https?:\/\//i.test(cacheKey)) {
            const remoteUrl = this.normalizeRemoteMediaUrl(cacheKey);
            cache.set(cacheKey, remoteUrl);
            return remoteUrl;
        } else {
            sourceBuffer = await fs.readFile(cacheKey);
            originalName = path.basename(cacheKey);
        }

        const baseName = path.parse(originalName).name || 'image';
        const normalizedBuffer = await sharp(sourceBuffer, { animated: false })
            .rotate()
            .resize({
                width: 4096,
                height: 4096,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 90, mozjpeg: true })
            .toBuffer();

        const uploadedImage = await uploadBufferToBackblaze(
            normalizedBuffer,
            `${baseName}.jpg`,
            {
                bucketTypes: ['general', 'design'],
                prefix: 'social-publish/meta-images',
                contentType: 'image/jpeg',
            }
        );

        const hostedUrl = uploadedImage.url;
        cache.set(cacheKey, hostedUrl);
        return hostedUrl;
    }

    private async getResolvedMetaPublishImageUrls(
        content: PublishContent,
        platform: string,
        cache: Map<string, string>
    ): Promise<string[]> {
        const rawUrls = this
            .getResolvedImageUrls(content)
            .slice(0, this.getPlatformImageLimit(platform));

        const resolved: string[] = [];
        for (const value of rawUrls) {
            const trimmed = value.trim();
            if (!trimmed) {
                continue;
            }

            if (/^https?:\/\//i.test(trimmed) || this.isImage(trimmed)) {
                resolved.push(await this.prepareHostedMetaImageUrl(trimmed, cache));
            }
        }

        const safeUrls = resolved.filter((value) => !this.isMetaRiskyGeneratedImageUrl(value));
        if (safeUrls.length > 0) {
            return safeUrls;
        }

        return resolved.some((value) => this.isMetaRiskyGeneratedImageUrl(value)) ? [] : resolved;
    }

    private getPlatformImageLimit(platform: string): number {
        switch (platform) {
            case 'X':
                return 4;
            case 'Threads':
            case 'Facebook':
                return 3;
            default:
                return 1;
        }
    }

    private isVideo(filePath: string): boolean {
        return /\.(mp4|mov|m4v|webm)$/i.test(filePath);
    }

    private isDirectVideoUrl(value?: string): value is string {
        return typeof value === 'string' && /^https?:\/\/.+\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(value.trim());
    }

    private buildHostedVideoOriginalName(content: PublishContent, mediaFilePath: string): string {
        const parsedPath = path.parse(mediaFilePath);
        const extension = parsedPath.ext || '.mp4';
        const explicitTitle = content.title?.trim();

        if (explicitTitle) {
            const normalizedTitle = explicitTitle.replace(/\s+/g, ' ').trim();
            return `${normalizedTitle}${extension}`;
        }

        return `${parsedPath.name}${extension}`;
    }

    private async resolveHostedVideoUrl(
        content: PublishContent,
        mediaFilePath: string | null | undefined,
        directVideoUrl: string | undefined,
        cache: Map<string, string>
    ): Promise<string> {
        if (this.isDirectVideoUrl(directVideoUrl)) {
            return this.normalizeRemoteMediaUrl(directVideoUrl.trim());
        }

        if (!mediaFilePath || !this.isVideo(mediaFilePath)) {
            throw new Error('A local video file or direct video URL is required');
        }

        const cacheKey = mediaFilePath;
        const cached = cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const uploaded = await uploadLocalFileToBackblaze(
            mediaFilePath,
            this.buildHostedVideoOriginalName(content, mediaFilePath),
            {
                bucketTypes: ['videos', 'general'],
                prefix: 'youtube-poller/videos',
                contentType: this.getMimeType(mediaFilePath),
            }
        );

        const hostedUrl = uploaded.url;
        cache.set(cacheKey, hostedUrl);
        return hostedUrl;
    }

    /**
     * Publish content to multiple platforms w/ Retry Logic
     */
    async publish(
        platforms: string[],
        content: PublishContent,
        mediaFilePath?: string | null,
        options: PublishOptions = {}
    ): Promise<PublishResult[]> {
        const results: PublishResult[] = [];
        const normalizedPlatforms = platforms.map(normalizePlatformName);
        const hostedVideoUrlCache = new Map<string, string>();
        const hostedMetaImageUrlCache = new Map<string, string>();

        console.log(`[Publisher] Publishing to ${normalizedPlatforms.join(', ')}...`);

        // Fetch Retry Settings
        let maxRetries = 0;
        let retryDelay = 2000;
        try {
            const settings = await prisma.setting.findMany({ where: { key: { in: ['maxRetries', 'retryDelay'] } } });
            maxRetries = parseInt(settings.find(s => s.key === 'maxRetries')?.value as string) || 0;
            retryDelay = parseInt(settings.find(s => s.key === 'retryDelay')?.value as string) || 2000;
        } catch (e) {
            // Default to 0 retries
        }

        for (const platform of normalizedPlatforms) {
            const platformContent = {
                ...content,
                ...(content.platformOverrides?.[platform] || {})
            };

            // Get platform connection
            let connection = await findPlatformConnection(platform);
            connection = await ensureFreshPlatformConnection(connection);

            let result: PublishResult = {
                platform,
                status: 'failed',
                error: 'Platform not configured',
                postedAt: new Date().toISOString()
            };

            if (!connection) {
                console.warn(`[Publisher] No connection found for ${platform}`);
                results.push(result);
                continue;
            }

            // Retry Loop
            let attempts = 0;
            let success = false;

            while (attempts <= maxRetries && !success) {
                if (attempts > 0) {
                    console.log(`[Publisher] Retrying ${platform} (Attempt ${attempts + 1}/${maxRetries + 1})...`);
                    await new Promise(res => setTimeout(res, retryDelay));
                }

                try {
                    const useMetaSafeImages = platform === 'Facebook' || platform === 'Instagram' || platform === 'Threads';
                    const resolvedImageUrls = useMetaSafeImages
                        ? await this.getResolvedMetaPublishImageUrls(platformContent, platform, hostedMetaImageUrlCache)
                        : await this.getResolvedPublishImageUrls(platformContent, platform);
                    const primaryImageUrl = resolvedImageUrls[0];
                    const remoteCoverImageUrl = await this.getResolvedRemoteCoverImageUrl(platformContent);
                    const localVideoFile = mediaFilePath && this.isVideo(mediaFilePath) ? mediaFilePath : null;
                    const directVideoUrl = platformContent.videoUrl;

                    switch (platform) {
                        case 'X':
                            if (connection.accessToken) {
                                const xVideoSource = localVideoFile || (this.isDirectVideoUrl(directVideoUrl) ? directVideoUrl : null);
                                const xResult = xVideoSource
                                    ? await xService.postVideoTweet(platformContent.text, xVideoSource, connection)
                                    : await xService.postTweet(
                                        platformContent.text,
                                        resolvedImageUrls.length > 0
                                            ? resolvedImageUrls
                                            : (mediaFilePath && this.isImage(mediaFilePath) ? [mediaFilePath] : undefined),
                                        connection
                                    );
                                result = {
                                    platform,
                                    ...xResult,
                                    status: xResult.success ? 'posted' : 'failed',
                                    postedAt: new Date().toISOString()
                                };
                            }
                            break;

                        case 'Facebook':
                            if (hasPublishablePlatformConnection(connection)) {
                                const facebookUserId = connection.userId as string;
                                const facebookAccessToken = connection.accessToken as string;
                                const fbResult = localVideoFile
                                    ? await metaService.postVideoToFacebook(
                                        facebookUserId,
                                        platformContent.text,
                                        localVideoFile,
                                        facebookAccessToken
                                    )
                                    : await metaService.postToFacebook(
                                        facebookUserId,
                                        platformContent.text,
                                        resolvedImageUrls.length > 0 ? resolvedImageUrls : (primaryImageUrl || null),
                                        facebookAccessToken,
                                        platformContent.link
                                    );
                                result = {
                                    platform,
                                    ...fbResult,
                                    status: fbResult.success ? 'posted' : 'failed',
                                    postedAt: new Date().toISOString()
                                };
                            } else {
                                result = {
                                    platform,
                                    status: 'failed',
                                    error: this.getInvalidConnectionMessage(platform),
                                    postedAt: new Date().toISOString()
                                };
                            }
                            break;

                        case 'Instagram':
                            if (hasUsablePlatformAccessToken(connection) && connection.userId) {
                                const instagramAccessToken = connection.accessToken as string;
                                const igResult = localVideoFile || this.isDirectVideoUrl(directVideoUrl)
                                    ? await metaService.postVideoToInstagramReel(
                                        connection.userId,
                                        platformContent.text,
                                        await this.resolveHostedVideoUrl(platformContent, localVideoFile, directVideoUrl, hostedVideoUrlCache),
                                        instagramAccessToken,
                                        remoteCoverImageUrl
                                    )
                                        : primaryImageUrl
                                        ? await metaService.postToInstagram(
                                            connection.userId,
                                            platformContent.text,
                                            primaryImageUrl,
                                            instagramAccessToken
                                        )
                                        : { success: false as const, error: 'Instagram requires an image or video' };
                                result = {
                                    platform,
                                    ...igResult,
                                    status: igResult.success ? 'posted' : 'failed',
                                    postedAt: new Date().toISOString()
                                };
                            } else {
                                result = {
                                    platform,
                                    status: 'failed',
                                    error: 'Instagram connection is invalid or incomplete. Reconnect Instagram from Platforms.',
                                    postedAt: new Date().toISOString()
                                };
                            }
                            break;

                        case 'Threads':
                            if (hasPublishablePlatformConnection(connection)) {
                                const threadsUserId = connection.userId as string;
                                const threadsAccessToken = connection.accessToken as string;
                                const threadsResult = localVideoFile || this.isDirectVideoUrl(directVideoUrl)
                                    ? await metaService.postVideoToThreads(
                                        threadsUserId,
                                        platformContent.text,
                                        await this.resolveHostedVideoUrl(platformContent, localVideoFile, directVideoUrl, hostedVideoUrlCache),
                                        threadsAccessToken
                                    )
                                    : await metaService.postToThreads(
                                        threadsUserId,
                                        platformContent.text,
                                        resolvedImageUrls.length > 0 ? resolvedImageUrls : (primaryImageUrl || null),
                                        threadsAccessToken
                                    );
                                result = {
                                    platform,
                                    ...threadsResult,
                                    status: threadsResult.success ? 'posted' : 'failed',
                                    postedAt: new Date().toISOString()
                                };
                            } else {
                                result = {
                                    platform,
                                    status: 'failed',
                                    error: this.getInvalidConnectionMessage(platform),
                                    postedAt: new Date().toISOString()
                                };
                            }
                            break;

                        case 'TikTok':
                            if (connection.accessToken) {
                                if (platformContent.videoUrl || (mediaFilePath && !this.isImage(mediaFilePath))) {
                                    if (platformContent.videoUrl || mediaFilePath) {
                                        const ttResult = await tiktokService.postVideo(
                                            {
                                                filePath: mediaFilePath && !this.isImage(mediaFilePath) ? mediaFilePath : undefined,
                                                videoUrl: platformContent.videoUrl || undefined,
                                            },
                                            platformContent.title || platformContent.text,
                                            connection.accessToken
                                        );
                                        result = {
                                            platform,
                                            ...ttResult,
                                            status: ttResult.success ? 'posted' : 'failed',
                                            postedAt: new Date().toISOString()
                                        };
                                    }
                                } else {
                                    result.error = 'TikTok requires a video URL or file';
                                }
                            }
                            break;

                        case 'YouTube':
                            if (connection.accessToken && mediaFilePath && !this.isImage(mediaFilePath)) {
                                const ytResult = await youtubeService.uploadVideo(
                                    connection.accessToken,
                                    mediaFilePath,
                                    {
                                        title: platformContent.title || platformContent.text.slice(0, 100),
                                        description: platformContent.description || platformContent.text,
                                        privacyStatus: 'public',
                                        thumbnailPath: platformContent.imagePath && this.isImage(platformContent.imagePath)
                                            ? platformContent.imagePath
                                            : undefined,
                                        playlistIds: options.youtubePlaylistIds // Pass playlists
                                    } as any,
                                    connection.refreshToken || undefined
                                );
                                result = {
                                    platform,
                                    ...ytResult,
                                    status: ytResult.success ? 'posted' : 'failed',
                                    postedAt: new Date().toISOString()
                                };
                            } else {
                                result.error = 'YouTube requires a video file upload';
                            }
                            break;

                        case 'Pinterest':
                            if (connection.accessToken) {
                                // Use options boardId OR settings default
                                const boardId = options.pinterestBoardId || (connection.metadata as any)?.boardId || (connection.metadata as any)?.defaultBoardId;

                                if (boardId && (primaryImageUrl || localVideoFile)) {
                                    const pinResult = localVideoFile
                                        ? await pinterestService.createVideoPin(
                                            boardId,
                                            platformContent.title || platformContent.text.slice(0, 50),
                                            platformContent.text,
                                            localVideoFile,
                                            connection.accessToken,
                                            {
                                                link: options.pinterestLink || platformContent.link,
                                                coverImageUrl: remoteCoverImageUrl,
                                            }
                                        )
                                        : await pinterestService.createPin(
                                            boardId,
                                            platformContent.title || platformContent.text.slice(0, 50),
                                            platformContent.text,
                                            primaryImageUrl!,
                                            connection.accessToken,
                                            { link: options.pinterestLink || platformContent.link }
                                        );
                                    result = {
                                        platform,
                                        ...pinResult,
                                        status: pinResult.success ? 'posted' : 'failed',
                                        postedAt: new Date().toISOString()
                                    };
                                } else {
                                    result.error = 'Pinterest requires a board plus an image or video';
                                }
                            }
                            break;

                        default:
                            result.error = 'Unknown platform';
                    }

                    if (result.status === 'posted') {
                        success = true;
                    } else {
                        throw new Error(result.error);
                    }

                } catch (err: any) {
                    console.error(`[Publisher] Error posting to ${platform} (Attempt ${attempts + 1}):`, err);
                    result.error = err.message;
                    attempts++;
                }
            }

            // Notification Logic using helper (Only errors for now)
            if (result.status === 'failed') {
                const itemLabel = describePublishItem(platformContent, mediaFilePath);
                await notificationService.notifyUser({
                    title: `${platform} publish failed`,
                    message: `${itemLabel} failed to publish to ${platform}: ${result.error}`,
                    type: 'error',
                    source: 'upload', // Using 'upload' as generic publish source
                    actionPage: '/uploads' // or history
                });
            }

            results.push(result);
        }

        return results;
    }

    private isImage(path: string): boolean {
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
    }
}

export const publisherService = new PublisherService();
