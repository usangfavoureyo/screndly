import axios from 'axios';
import fs from 'fs/promises';
import os from 'os';
import prisma from '../lib/prisma';
import { findPlatformConnection } from '../lib/platformConnections';
import path from 'path';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { promisify } from 'util';
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
    videoUrls?: string[];
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

interface ImagePreflightResult {
    source: string;
    mimeType: string;
    bytes: number;
    width?: number;
    height?: number;
}

export interface PublishOptions {
    youtubePlaylistIds?: string[];
    pinterestBoardId?: string;
    pinterestLink?: string;
}

interface StoryPublishQueueItem {
    kind: 'image' | 'video';
    mediaUrl: string;
}

interface StoryVideoSource {
    source: string;
    sourceType: 'local-file' | 'remote-url';
}

const execFileAsync = promisify(execFile);
const STORY_VIDEO_SEGMENT_SECONDS = 60;
const STORY_MAX_ITEMS = 4;

function normalizePlatformName(platform: string): string {
    const normalized = platform.trim().toLowerCase();
    const platformMap: Record<string, string> = {
        x: 'X',
        twitter: 'X',
        facebook: 'Facebook',
        facebookfeed: 'FacebookFeed',
        facebook_feed: 'FacebookFeed',
        facebookstories: 'FacebookStories',
        facebook_stories: 'FacebookStories',
        instagram: 'Instagram',
        instagramfeed: 'InstagramFeed',
        instagram_feed: 'InstagramFeed',
        instagramreels: 'InstagramReels',
        instagram_reels: 'InstagramReels',
        instagramstories: 'InstagramStories',
        instagram_stories: 'InstagramStories',
        threads: 'Threads',
        youtube: 'YouTube',
        youtubelongform: 'YouTubeLongform',
        youtube_longform: 'YouTubeLongform',
        youtubeshorts: 'YouTubeShorts',
        youtube_shorts: 'YouTubeShorts',
        tiktok: 'TikTok',
        pinterest: 'Pinterest'
    };

    return platformMap[normalized] || platform;
}

function getConnectionPlatformName(platform: string): string {
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

const ACTIVE_X_PUBLISHES = new Map<string, Promise<PublishResult>>();
const X_PUBLISH_LEDGER_SERVICE = 'publisher';
const X_PUBLISH_LEDGER_CATEGORY = 'x_publish_success';
const X_PUBLISH_LEDGER_WINDOW_MS = 24 * 60 * 60 * 1000;

export class PublisherService {
    private normalizeRemoteMediaUrl(value: string): string {
        try {
            const parsed = new URL(value.trim());
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

    private isMetaHostedImageUrl(value: string): boolean {
        return this.isBackblazeHostedUrl(value) && value.toLowerCase().includes('/social-publish/meta-images/');
    }

    private isMetaRiskyGeneratedImageUrl(value: string): boolean {
        if (!this.isBackblazeHostedUrl(value)) {
            return false;
        }

        const normalized = value.toLowerCase();
        return normalized.includes('/rss/logo-cards/')
            || normalized.includes('/generated-thumbnails/');
    }

    private isAcceptedMetaPublishImageUrl(value: string): boolean {
        if (this.isMetaHostedImageUrl(value) && !this.isMetaRiskyGeneratedImageUrl(value)) {
            return true;
        }

        return this.isDirectMetaSafeRemoteImageSource(value) && !this.isRiskyGeneratedImageSource(value);
    }

    private isRiskyGeneratedImageSource(value: string): boolean {
        const normalized = value.trim().toLowerCase();
        return normalized.includes('/rss/logo-cards/')
            || normalized.includes('/generated-thumbnails/');
    }

    private isDirectMetaSafeRemoteImageSource(value: string): boolean {
        try {
            const url = new URL(value.trim());
            const host = url.hostname.toLowerCase();
            return host === 'image.tmdb.org';
        } catch {
            return false;
        }
    }

    private getInvalidConnectionMessage(platform: string): string {
        switch (platform) {
            case 'Facebook':
            case 'FacebookFeed':
            case 'FacebookStories':
                return 'Facebook connection is invalid or incomplete. Reconnect Facebook from Platforms.';
            case 'Instagram':
            case 'InstagramFeed':
            case 'InstagramReels':
            case 'InstagramStories':
                return 'Instagram connection is invalid or incomplete. Reconnect Instagram from Platforms.';
            case 'Threads':
                return 'Threads connection is invalid or incomplete. Reconnect Threads from Platforms.';
            case 'YouTube':
            case 'YouTubeLongform':
            case 'YouTubeShorts':
                return 'YouTube connection is invalid or incomplete. Reconnect YouTube from Platforms.';
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

    private getResolvedVideoUrls(content: PublishContent): string[] {
        const candidates = [
            ...(Array.isArray(content.videoUrls) ? content.videoUrls : []),
            content.videoUrl,
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

    private async getResolvedPublishImageUrls(content: PublishContent, platform: string): Promise<string[]> {
        const rawUrls = this
            .getResolvedImageUrls(content)
            .slice(0, this.getPlatformImageLimit(platform));

        return Promise.all(rawUrls.map((value) => getBackblazeAuthorizedDownloadUrl(this.normalizeRemoteMediaUrl(value))));
    }

    private getImageByteLimit(platform: string): number {
        switch (platform) {
            case 'Facebook':
            case 'Threads':
            case 'Instagram':
                return 8 * 1024 * 1024;
            case 'X':
                return 15 * 1024 * 1024;
            default:
                return 15 * 1024 * 1024;
        }
    }

    private async preflightRemoteImage(source: string, platform: string): Promise<ImagePreflightResult> {
        const normalizedSource = await getBackblazeAuthorizedDownloadUrl(this.normalizeRemoteMediaUrl(source));
        const response = await fetch(normalizedSource);
        if (!response.ok) {
            throw new Error(`preflight fetch failed (${response.status})`);
        }

        const mimeType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!mimeType.startsWith('image/')) {
            throw new Error(`preflight expected image content but received ${mimeType || 'unknown content type'}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length === 0) {
            throw new Error('preflight fetched an empty image');
        }

        const byteLimit = this.getImageByteLimit(platform);
        if (buffer.length > byteLimit) {
            throw new Error(`preflight image exceeds ${Math.round(byteLimit / (1024 * 1024))}MB limit`);
        }

        const metadata = await sharp(buffer, { animated: false }).metadata().catch(() => null);
        if (!metadata?.width || !metadata?.height) {
            throw new Error('preflight could not read image dimensions');
        }

        if (metadata.width < 200 || metadata.height < 200) {
            throw new Error(`preflight image is too small (${metadata.width}x${metadata.height})`);
        }

        return {
            source: normalizedSource,
            mimeType,
            bytes: buffer.length,
            width: metadata.width,
            height: metadata.height,
        };
    }

    private async preflightPublishImages(
        platform: string,
        resolvedImageUrls: string[]
    ): Promise<ImagePreflightResult[]> {
        if (resolvedImageUrls.length === 0 || (platform !== 'X' && platform !== 'Facebook' && platform !== 'Threads')) {
            return [];
        }

        const results: ImagePreflightResult[] = [];
        for (const imageUrl of resolvedImageUrls) {
            results.push(await this.preflightRemoteImage(imageUrl, platform));
        }

        console.log(`[Publisher] ${platform} image preflight passed`, results.map((result) => ({
            kind: 'image',
            sourceType: /^https?:\/\//i.test(result.source) ? 'remote-url' : 'local-file',
            mimeType: result.mimeType,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
        })));

        return results;
    }

    private async buildMediaFingerprintParts(
        resolvedImageUrls: string[],
        videoSource?: string | null
    ): Promise<string[]> {
        const parts = [...resolvedImageUrls];

        if (videoSource) {
            if (/^https?:\/\//i.test(videoSource)) {
                parts.push(this.normalizeRemoteMediaUrl(videoSource));
            } else {
                try {
                    const stats = await fs.stat(videoSource);
                    parts.push(`${path.resolve(videoSource)}:${stats.size}:${Math.trunc(stats.mtimeMs)}`);
                } catch {
                    parts.push(path.resolve(videoSource));
                }
            }
        }

        return parts;
    }

    private async buildXPublishFingerprint(
        content: PublishContent,
        resolvedImageUrls: string[],
        videoSource?: string | null
    ): Promise<string> {
        const mediaParts = await this.buildMediaFingerprintParts(resolvedImageUrls, videoSource);
        const payload = JSON.stringify({
            platform: 'X',
            text: content.text.trim(),
            title: content.title?.trim() || '',
            description: content.description?.trim() || '',
            link: content.link?.trim() || '',
            media: mediaParts,
        });

        return createHash('sha1').update(payload).digest('hex');
    }

    private async findRecentXPublish(fingerprint: string): Promise<PublishResult | null> {
        const logs = await prisma.log.findMany({
            where: {
                service: X_PUBLISH_LEDGER_SERVICE,
                timestamp: { gte: new Date(Date.now() - X_PUBLISH_LEDGER_WINDOW_MS) },
            },
            orderBy: { timestamp: 'desc' },
            take: 100,
        });

        for (const log of logs) {
            const metadata = log.metadata as Record<string, unknown> | null;
            if (!metadata || metadata.category !== X_PUBLISH_LEDGER_CATEGORY || metadata.fingerprint !== fingerprint) {
                continue;
            }

            const postId = typeof metadata.postId === 'string' ? metadata.postId : undefined;
            const postUrl = typeof metadata.postUrl === 'string' ? metadata.postUrl : undefined;

            return {
                platform: 'X',
                status: 'posted',
                id: postId,
                url: postUrl,
                postedAt: log.timestamp.toISOString(),
            };
        }

        return null;
    }

    private async recordXPublishSuccess(
        fingerprint: string,
        content: PublishContent,
        result: { postId?: string; postUrl?: string }
    ): Promise<void> {
        await prisma.log.create({
            data: {
                level: 'info',
                service: X_PUBLISH_LEDGER_SERVICE,
                message: `X publish succeeded: ${describePublishItem(content)}`,
                metadata: {
                    category: X_PUBLISH_LEDGER_CATEGORY,
                    fingerprint,
                    postId: result.postId || null,
                    postUrl: result.postUrl || null,
                } as any,
            },
        });
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
            const remoteUrl = await getBackblazeAuthorizedDownloadUrl(this.normalizeRemoteMediaUrl(cacheKey));
            const response = await fetch(remoteUrl);
            if (!response.ok) {
                throw new Error(`Failed to download remote image (${response.status})`);
            }

            sourceBuffer = Buffer.from(await response.arrayBuffer());

            try {
                const parsedUrl = new URL(remoteUrl);
                originalName = path.basename(parsedUrl.pathname) || 'image.jpg';
            } catch {
                originalName = 'image.jpg';
            }
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
        if (!this.isMetaHostedImageUrl(hostedUrl)) {
            throw new Error('Failed to create a Meta-safe hosted image URL');
        }

        const authorizedHostedUrl = await getBackblazeAuthorizedDownloadUrl(hostedUrl, 7 * 24 * 60 * 60);
        cache.set(cacheKey, authorizedHostedUrl);
        return authorizedHostedUrl;
    }

    private async getResolvedMetaPublishImageUrls(
        content: PublishContent,
        platform: string,
        cache: Map<string, string>
    ): Promise<string[]> {
        const rawUrls = this
            .getResolvedImageUrls(content)
            .slice(0, this.getPlatformImageLimit(platform));
        const preferredRawUrls = rawUrls.filter((value) => !this.isRiskyGeneratedImageSource(value));
        const fallbackRawUrls = rawUrls.filter((value) => this.isRiskyGeneratedImageSource(value));
        const orderedRawUrls = preferredRawUrls.length > 0
            ? [...preferredRawUrls, ...fallbackRawUrls]
            : rawUrls;

        const resolved: string[] = [];
        for (const value of orderedRawUrls) {
            const trimmed = value.trim();
            if (!trimmed) {
                continue;
            }

            if (/^https?:\/\//i.test(trimmed) || this.isImage(trimmed)) {
                try {
                    if (this.isDirectMetaSafeRemoteImageSource(trimmed) && !this.isRiskyGeneratedImageSource(trimmed)) {
                        resolved.push(
                            await getBackblazeAuthorizedDownloadUrl(
                                this.normalizeRemoteMediaUrl(trimmed),
                                7 * 24 * 60 * 60
                            )
                        );
                    } else {
                        resolved.push(await this.prepareHostedMetaImageUrl(trimmed, cache));
                    }
                } catch (error) {
                    console.warn(`[Publisher] Skipping Meta image candidate for ${platform}`, {
                        source: trimmed,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }

        const safeUrls = resolved.filter((value) => this.isAcceptedMetaPublishImageUrl(value));
        if (safeUrls.length > 0) {
            return safeUrls;
        }

        if (orderedRawUrls.length > 0) {
            throw new Error('Meta publish requires at least one valid Meta-safe image asset');
        }

        return [];
    }

    private getPlatformImageLimit(platform: string): number {
        switch (platform) {
            case 'X':
            case 'InstagramStories':
            case 'FacebookStories':
                return 4;
            case 'Threads':
            case 'Facebook':
            case 'FacebookFeed':
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

    private isStoryPlatform(platform: string): boolean {
        return platform === 'InstagramStories' || platform === 'FacebookStories';
    }

    private async getAccessibleRemoteVideoUrl(source: string): Promise<string> {
        const normalized = this.normalizeRemoteMediaUrl(source.trim());
        if (!this.isBackblazeHostedUrl(normalized)) {
            return normalized;
        }

        try {
            const parsed = new URL(normalized);
            if (parsed.searchParams.has('Authorization')) {
                return normalized;
            }
        } catch {
            return normalized;
        }

        return getBackblazeAuthorizedDownloadUrl(normalized, 7 * 24 * 60 * 60);
    }

    private async downloadRemoteVideoToTemp(source: string): Promise<string> {
        const remoteUrl = await this.getAccessibleRemoteVideoUrl(source);
        const response = await fetch(remoteUrl);
        if (!response.ok) {
            throw new Error(`Failed to download story video (${response.status})`);
        }

        const fileBuffer = Buffer.from(await response.arrayBuffer());
        const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'screndly-story-video-'));
        const extension = path.extname(new URL(remoteUrl, 'http://localhost').pathname) || '.mp4';
        const targetPath = path.join(targetDir, `source${extension}`);
        await fs.writeFile(targetPath, fileBuffer);
        return targetPath;
    }

    private async probeVideoDurationSeconds(filePath: string): Promise<number> {
        const { stdout } = await execFileAsync('ffprobe', [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            filePath,
        ]);

        const duration = Number.parseFloat(stdout.trim());
        if (!Number.isFinite(duration) || duration <= 0) {
            throw new Error('Failed to read story video duration.');
        }

        return duration;
    }

    private buildStoryClipRanges(durationSeconds: number): Array<{ startSeconds: number; clipDurationSeconds: number }> {
        const ranges: Array<{ startSeconds: number; clipDurationSeconds: number }> = [];
        let startSeconds = 0;

        while (startSeconds < durationSeconds) {
            const clipDurationSeconds = Math.min(STORY_VIDEO_SEGMENT_SECONDS, durationSeconds - startSeconds);
            ranges.push({
                startSeconds,
                clipDurationSeconds,
            });
            startSeconds += STORY_VIDEO_SEGMENT_SECONDS;
        }

        return ranges;
    }

    private buildStoryClipBaseName(source: string): string {
        const rawName = source.split('?')[0].split('/').pop() || 'story-video';
        const baseName = path.parse(rawName).name || 'story-video';
        const normalized = baseName.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        return normalized || 'story-video';
    }

    private async uploadStoryVideoClip(filePath: string, baseName: string, clipIndex: number, totalClips: number): Promise<string> {
        const uploaded = await uploadLocalFileToBackblaze(filePath, `${baseName}-story-${clipIndex + 1}-of-${totalClips}.mp4`, {
            bucketTypes: ['videos', 'general'],
            prefix: 'platform-posts/story-clips',
            contentType: 'video/mp4',
        });

        return getBackblazeAuthorizedDownloadUrl(uploaded.url, 7 * 24 * 60 * 60);
    }

    private async cleanupTempPath(targetPath?: string | null): Promise<void> {
        if (!targetPath) {
            return;
        }

        await fs.rm(path.dirname(targetPath), { recursive: true, force: true }).catch(() => undefined);
    }

    private async buildStoryVideoQueue(
        content: PublishContent,
        mediaFilePath: string | null | undefined,
        cache: Map<string, string>
    ): Promise<StoryPublishQueueItem[]> {
        const videoSources: StoryVideoSource[] = [];

        if (mediaFilePath && this.isVideo(mediaFilePath)) {
            videoSources.push({ source: mediaFilePath, sourceType: 'local-file' });
        }

        for (const source of this.getResolvedVideoUrls(content)) {
            videoSources.push({ source, sourceType: 'remote-url' });
        }

        const dedupe = new Set<string>();
        const queue: StoryPublishQueueItem[] = [];

        for (const source of videoSources) {
            const dedupeKey = `${source.sourceType}:${source.source}`;
            if (dedupe.has(dedupeKey)) {
                continue;
            }
            dedupe.add(dedupeKey);

            let localSourcePath: string | null = null;
            try {
                localSourcePath =
                    source.sourceType === 'local-file'
                        ? source.source
                        : await this.downloadRemoteVideoToTemp(source.source);

                const durationSeconds = await this.probeVideoDurationSeconds(localSourcePath);
                const clipRanges = this.buildStoryClipRanges(durationSeconds);
                const baseName = this.buildStoryClipBaseName(source.source);

                if (clipRanges.length === 1) {
                    const mediaUrl =
                        source.sourceType === 'remote-url'
                            ? await this.getAccessibleRemoteVideoUrl(source.source)
                            : await this.resolveHostedVideoUrl(content, localSourcePath, undefined, cache);
                    queue.push({ kind: 'video', mediaUrl });
                } else {
                    for (let index = 0; index < clipRanges.length; index += 1) {
                        const clipRange = clipRanges[index];
                        const clipDir = await fs.mkdtemp(path.join(os.tmpdir(), 'screndly-story-clip-'));
                        const clipPath = path.join(clipDir, `${baseName}-${index + 1}.mp4`);

                        try {
                            await execFileAsync('ffmpeg', [
                                '-y',
                                '-ss',
                                clipRange.startSeconds.toString(),
                                '-i',
                                localSourcePath,
                                '-t',
                                clipRange.clipDurationSeconds.toString(),
                                '-c:v',
                                'libx264',
                                '-preset',
                                'veryfast',
                                '-crf',
                                '22',
                                '-c:a',
                                'aac',
                                '-movflags',
                                '+faststart',
                                clipPath,
                            ], {
                                timeout: 5 * 60 * 1000,
                                maxBuffer: 10 * 1024 * 1024,
                            });

                            queue.push({
                                kind: 'video',
                                mediaUrl: await this.uploadStoryVideoClip(clipPath, baseName, index, clipRanges.length),
                            });
                        } finally {
                            await this.cleanupTempPath(clipPath);
                        }
                    }
                }
            } finally {
                if (source.sourceType === 'remote-url') {
                    await this.cleanupTempPath(localSourcePath);
                }
            }
        }

        return queue;
    }

    private async buildStoryPublishQueue(
        content: PublishContent,
        platform: string,
        mediaFilePath: string | null | undefined,
        hostedVideoUrlCache: Map<string, string>,
        hostedMetaImageUrlCache: Map<string, string>
    ): Promise<StoryPublishQueueItem[]> {
        const imageQueue = await this.getResolvedMetaPublishImageUrls(content, platform, hostedMetaImageUrlCache);
        const hasLocalImage = Boolean(mediaFilePath && this.isImage(mediaFilePath));
        const hasAnyVideo = Boolean((mediaFilePath && this.isVideo(mediaFilePath)) || this.getResolvedVideoUrls(content).length > 0);

        if (hasAnyVideo && (imageQueue.length > 0 || hasLocalImage)) {
            throw new Error('Story publishing does not support mixed image and video uploads in the same post.');
        }

        if (hasAnyVideo) {
            const videoQueue = await this.buildStoryVideoQueue(content, mediaFilePath, hostedVideoUrlCache);
            if (videoQueue.length > STORY_MAX_ITEMS) {
                throw new Error(`Stories support up to ${STORY_MAX_ITEMS} items after splitting videos longer than 60 seconds.`);
            }
            return videoQueue;
        }

        const resolvedImages = imageQueue.length > 0
            ? imageQueue
            : hasLocalImage && mediaFilePath
                ? [await this.prepareHostedMetaImageUrl(mediaFilePath, hostedMetaImageUrlCache)]
                : [];

        if (resolvedImages.length > STORY_MAX_ITEMS) {
            throw new Error(`Stories support up to ${STORY_MAX_ITEMS} items per post.`);
        }

        return resolvedImages.map((mediaUrl) => ({ kind: 'image', mediaUrl }));
    }

    private async publishStorySequence(
        platform: 'InstagramStories' | 'FacebookStories',
        content: PublishContent,
        mediaFilePath: string | null | undefined,
        connection: Awaited<ReturnType<typeof findPlatformConnection>>,
        hostedVideoUrlCache: Map<string, string>,
        hostedMetaImageUrlCache: Map<string, string>
    ): Promise<PublishResult> {
        const queue = await this.buildStoryPublishQueue(
            content,
            platform,
            mediaFilePath,
            hostedVideoUrlCache,
            hostedMetaImageUrlCache,
        );

        if (queue.length === 0) {
            return {
                platform,
                status: 'failed',
                error: `${platform === 'InstagramStories' ? 'Instagram Stories' : 'Facebook Stories'} requires at least one story image or video.`,
                postedAt: new Date().toISOString(),
            };
        }

        let postedCount = 0;
        let lastId: string | undefined;

        for (let index = 0; index < queue.length; index += 1) {
            const entry = queue[index];
            const storyResult =
                platform === 'InstagramStories'
                    ? await metaService.postToInstagramStory(
                        connection?.userId as string,
                        entry.mediaUrl,
                        connection?.accessToken as string,
                        entry.kind,
                    )
                    : await metaService.postToFacebookStory(
                        connection?.userId as string,
                        entry.mediaUrl,
                        connection?.accessToken as string,
                        entry.kind,
                    );

            if (!storyResult.success) {
                const prefix = postedCount > 0 ? `Published ${postedCount} of ${queue.length} story items before failure. ` : '';
                return {
                    platform,
                    status: 'failed',
                    error: `${prefix}${storyResult.error || `Story item ${index + 1} failed.`}`.trim(),
                    postedAt: new Date().toISOString(),
                };
            }

            postedCount += 1;
            lastId = storyResult.data?.id;
        }

        return {
            platform,
            status: 'posted',
            id: lastId,
            postedAt: new Date().toISOString(),
        };
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

        const hostedUrl = await getBackblazeAuthorizedDownloadUrl(uploaded.url, 7 * 24 * 60 * 60);
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
            const platformMaxRetries = platform === 'X' || this.isStoryPlatform(platform) ? 0 : maxRetries;

            // Get platform connection
            const connectionPlatform = getConnectionPlatformName(platform);
            let connection = await findPlatformConnection(connectionPlatform);
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

            while (attempts <= platformMaxRetries && !success) {
                if (attempts > 0) {
                    console.log(`[Publisher] Retrying ${platform} (Attempt ${attempts + 1}/${platformMaxRetries + 1})...`);
                    await new Promise(res => setTimeout(res, retryDelay));
                }

                try {
                    const useMetaSafeImages = platform === 'Facebook' || platform === 'Instagram' || platform === 'Threads';
                    const resolvedImageUrls = useMetaSafeImages
                        ? await this.getResolvedMetaPublishImageUrls(platformContent, platform, hostedMetaImageUrlCache)
                        : await this.getResolvedPublishImageUrls(platformContent, platform);
                    await this.preflightPublishImages(platform, resolvedImageUrls);
                    const primaryImageUrl = resolvedImageUrls[0];
                    const remoteCoverImageUrl = await this.getResolvedRemoteCoverImageUrl(platformContent);
                    const localVideoFile = mediaFilePath && this.isVideo(mediaFilePath) ? mediaFilePath : null;
                    const directVideoUrl = platformContent.videoUrl;

                    switch (platform) {
                        case 'X':
                            if (connection.accessToken) {
                                const xVideoSource = localVideoFile || (this.isDirectVideoUrl(directVideoUrl) ? directVideoUrl : null);
                                const xFingerprint = await this.buildXPublishFingerprint(
                                    platformContent,
                                    resolvedImageUrls.length > 0
                                        ? resolvedImageUrls
                                        : (mediaFilePath && this.isImage(mediaFilePath) ? [mediaFilePath] : []),
                                    xVideoSource
                                );
                                const recentXPublish = await this.findRecentXPublish(xFingerprint);
                                const activeXPublish = ACTIVE_X_PUBLISHES.get(xFingerprint);

                                if (recentXPublish) {
                                    console.log('[Publisher] Reusing recent successful X publish', {
                                        fingerprint: xFingerprint,
                                        postId: recentXPublish.id,
                                    });
                                    result = recentXPublish;
                                    success = true;
                                    break;
                                }

                                if (activeXPublish) {
                                    console.log('[Publisher] Waiting for in-flight X publish', {
                                        fingerprint: xFingerprint,
                                    });
                                    result = await activeXPublish;
                                    success = result.status === 'posted';
                                    break;
                                }

                                const xPublishPromise = (async (): Promise<PublishResult> => {
                                    const publishResult = xVideoSource
                                        ? await xService.postVideoTweet(platformContent.text, xVideoSource, connection)
                                        : await xService.postTweet(
                                            platformContent.text,
                                            resolvedImageUrls.length > 0
                                                ? resolvedImageUrls
                                                : (mediaFilePath && this.isImage(mediaFilePath) ? [mediaFilePath] : undefined),
                                            connection
                                        );

                                    const nextResult: PublishResult = {
                                        platform,
                                        ...publishResult,
                                        status: publishResult.success ? 'posted' : 'failed',
                                        postedAt: new Date().toISOString()
                                    };

                                    if (publishResult.success) {
                                        await this.recordXPublishSuccess(xFingerprint, platformContent, publishResult);
                                    }

                                    return nextResult;
                                })();

                                ACTIVE_X_PUBLISHES.set(xFingerprint, xPublishPromise);
                                try {
                                    result = await xPublishPromise;
                                } finally {
                                    ACTIVE_X_PUBLISHES.delete(xFingerprint);
                                }
                            }
                            break;

                        case 'Facebook':
                        case 'FacebookFeed':
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

                        case 'FacebookStories':
                            if (hasPublishablePlatformConnection(connection)) {
                                result = await this.publishStorySequence(
                                    'FacebookStories',
                                    platformContent,
                                    localVideoFile || mediaFilePath,
                                    connection,
                                    hostedVideoUrlCache,
                                    hostedMetaImageUrlCache,
                                );
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
                        case 'InstagramFeed':
                        case 'InstagramReels':
                        case 'InstagramStories':
                            if (hasUsablePlatformAccessToken(connection) && connection.userId) {
                                const instagramAccessToken = connection.accessToken as string;
                                const mediaKind = localVideoFile || this.isDirectVideoUrl(directVideoUrl) ? 'video' : 'image';

                                if (platform === 'InstagramFeed' && mediaKind !== 'image') {
                                    result = {
                                        platform,
                                        status: 'failed',
                                        error: 'Instagram Feed publishing currently requires a single image.',
                                        postedAt: new Date().toISOString()
                                    };
                                    break;
                                }

                                if (platform === 'InstagramReels' && mediaKind !== 'video') {
                                    result = {
                                        platform,
                                        status: 'failed',
                                        error: 'Instagram Reels publishing requires a video.',
                                        postedAt: new Date().toISOString()
                                    };
                                    break;
                                }

                                if (platform === 'InstagramStories') {
                                    result = await this.publishStorySequence(
                                        'InstagramStories',
                                        platformContent,
                                        localVideoFile || mediaFilePath,
                                        connection,
                                        hostedVideoUrlCache,
                                        hostedMetaImageUrlCache,
                                    );
                                } else {
                                    const igResult = mediaKind === 'video'
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
                                }
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
                        case 'YouTubeLongform':
                        case 'YouTubeShorts':
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
