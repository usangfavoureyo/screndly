// X (Twitter) Platform Service
// Requires: X_API_KEY, X_API_SECRET, X_BEARER_TOKEN, X_ACCESS_TOKEN, X_ACCESS_SECRET

import { PlatformConnection } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { validateVideoForX } from '../platform-video-validation.service';

interface XPostResult {
    success: boolean;
    postId?: string;
    postUrl?: string;
    error?: string;
}

interface XUploadResult {
    mediaId: string | null;
    error?: string;
}

interface XResolvedMediaSource {
    source: string;
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    kind: 'image' | 'video';
    sourceType: 'file' | 'remote-url';
}

export interface XMentionComment {
    commentId: string;
    postId: string;
    username: string;
    userId?: string;
    content: string;
    createdAt: Date;
    parentPostCreatedAt?: Date;
}

export class XService {
    private static readonly MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
    private apiKey: string;
    private apiSecret: string;
    private bearerToken: string;

    constructor() {
        this.apiKey = process.env.X_API_KEY || '';
        this.apiSecret = process.env.X_API_SECRET || '';
        this.bearerToken = process.env.X_BEARER_TOKEN || '';
    }

    private async sleep(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    private normalizeImageSources(imageSources?: string | string[]): string[] {
        if (!imageSources) {
            return [];
        }

        const sources = Array.isArray(imageSources) ? imageSources : [imageSources];
        const seen = new Set<string>();
        const normalized: string[] = [];

        for (const source of sources) {
            const trimmed = source.trim();
            if (!trimmed || seen.has(trimmed)) {
                continue;
            }
            seen.add(trimmed);
            normalized.push(trimmed);
        }

        return normalized.slice(0, 4);
    }

    private async getJsonResponse(response: Response): Promise<any> {
        return response.json().catch(() => ({}));
    }

    private getUserAccessToken(connection?: PlatformConnection): string | null {
        const token = connection?.accessToken?.trim();
        return token ? token : null;
    }

    private logUploadDebug(label: string, payload: Record<string, unknown>) {
        console.log(`[X] ${label}`, payload);
    }

    private extractApiErrorMessage(data: any, fallback: string): string {
        const detailedErrors = Array.isArray(data?.errors)
            ? data.errors
                .map((error: any) => {
                    const detail = typeof error?.detail === 'string' ? error.detail.trim() : '';
                    const title = typeof error?.title === 'string' ? error.title.trim() : '';
                    return detail || title;
                })
                .filter(Boolean)
            : [];

        if (detailedErrors.length > 0) {
            const joined = detailedErrors.join(' | ');
            if (/forbidden|not authorized|unauthorized|insufficient/i.test(joined)) {
                return `${joined}. Reconnect X from Platforms so Screndly gets a fresh user token for media upload.`;
            }
            return joined;
        }

        const detail =
            data?.detail
            || data?.error
            || data?.errors?.[0]?.detail
            || data?.errors?.[0]?.message
            || data?.title
            || fallback;

        if (typeof detail !== 'string') {
            return fallback;
        }

        if (/forbidden|not authorized|unauthorized|insufficient/i.test(detail)) {
            return `${detail}. Reconnect X from Platforms so Screndly gets a fresh user token for media upload.`;
        }

        return detail;
    }

    async postTweet(text: string, imageSources?: string | string[], connection?: PlatformConnection): Promise<XPostResult> {
        const authToken = this.getUserAccessToken(connection);
        if (!authToken) {
            return { success: false, error: 'X user access token not configured. Reconnect X from Platforms.' };
        }

        try {
            const normalizedImageSources = this.normalizeImageSources(imageSources);
            const mediaIds: string[] = [];
            const uploadErrors: string[] = [];
            for (const imageSource of normalizedImageSources) {
                const uploadResult = await this.uploadMedia(imageSource, connection);
                if (uploadResult.mediaId) {
                    mediaIds.push(uploadResult.mediaId);
                } else if (uploadResult.error) {
                    uploadErrors.push(uploadResult.error);
                }
            }

            if (normalizedImageSources.length > 0 && mediaIds.length === 0) {
                return { success: false, error: uploadErrors[0] || 'Failed to upload image media to X' };
            }

            this.logUploadDebug('Create tweet payload', {
                textLength: text.slice(0, 280).length,
                mediaIds,
            });
            const response = await fetch('https://api.x.com/2/tweets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text.slice(0, 280), // Twitter character limit
                    ...(mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {}),
                }),
            });

            if (!response.ok) {
                const errorData: any = await response.json();
                this.logUploadDebug('Create tweet response', {
                    status: response.status,
                    body: errorData,
                });
                return { success: false, error: errorData.detail || 'Failed to post tweet' };
            }

            const data: any = await response.json();
            return {
                success: true,
                postId: data.data?.id,
                postUrl: `https://x.com/i/web/status/${data.data?.id}`,
            };
        } catch (error) {
            return { success: false, error: `X API error: ${error}` };
        }
    }

    async postVideoTweet(text: string, videoSource: string, connection?: PlatformConnection): Promise<XPostResult> {
        const authToken = this.getUserAccessToken(connection);
        if (!authToken) {
            return { success: false, error: 'X user access token not configured. Reconnect X from Platforms.' };
        }

        try {
            if (!/^https?:\/\//i.test(videoSource)) {
                const validation = await validateVideoForX(videoSource);
                if (!validation.ok) {
                    return { success: false, error: validation.issues.join(' ') };
                }
            }

            const uploadResult = await this.uploadVideo(videoSource, connection);
            if (!uploadResult.mediaId) {
                return { success: false, error: uploadResult.error || 'Failed to upload video to X' };
            }

            this.logUploadDebug('Create video tweet payload', {
                textLength: text.slice(0, 280).length,
                mediaId: uploadResult.mediaId,
            });
            const response = await fetch('https://api.x.com/2/tweets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text.slice(0, 280),
                    media: { media_ids: [uploadResult.mediaId] },
                }),
            });

            if (!response.ok) {
                const errorData: any = await response.json().catch(() => ({}));
                this.logUploadDebug('Create video tweet response', {
                    status: response.status,
                    body: errorData,
                });
                return { success: false, error: errorData.detail || errorData.error || 'Failed to post video tweet' };
            }

            const data: any = await response.json();
            return {
                success: true,
                postId: data.data?.id,
                postUrl: `https://x.com/i/web/status/${data.data?.id}`,
            };
        } catch (error) {
            return { success: false, error: `X API error: ${error}` };
        }
    }

    private getMimeType(filePath: string): string {
        switch (path.extname(filePath).toLowerCase()) {
            case '.jpg':
            case '.jpeg':
                return 'image/jpeg';
            case '.png':
                return 'image/png';
            case '.gif':
                return 'image/gif';
            case '.webp':
                return 'image/webp';
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

    private async getUploadPayload(source: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
        if (/^https?:\/\//i.test(source)) {
            const response = await fetch(source);
            if (!response.ok) {
                throw new Error(`Failed to download media for X upload: ${response.status} ${response.statusText}`);
            }

            const url = new URL(source);
            const fileName = path.basename(url.pathname) || 'image.jpg';
            const mimeType = response.headers.get('content-type') || this.getMimeType(fileName);
            return {
                buffer: Buffer.from(await response.arrayBuffer()),
                fileName,
                mimeType,
            };
        }

        const buffer = await fs.readFile(source);
        return {
            buffer,
            fileName: path.basename(source),
            mimeType: this.getMimeType(source),
        };
    }

    private isSupportedImageMime(mimeType: string): boolean {
        return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType);
    }

    private isSupportedVideoMime(mimeType: string): boolean {
        return ['video/mp4'].includes(mimeType);
    }

    async resolveMediaSource(source: string): Promise<XResolvedMediaSource> {
        const payload = await this.getUploadPayload(source);
        const mimeType = payload.mimeType.split(';')[0].trim().toLowerCase();
        const kind = mimeType.startsWith('video/')
            ? 'video'
            : mimeType.startsWith('image/')
                ? 'image'
                : null;

        if (!kind) {
            throw new Error(`Unsupported media type for X: ${mimeType || 'unknown'}`);
        }

        if (payload.buffer.length === 0) {
            throw new Error('Media file is empty');
        }

        if (kind === 'image' && !this.isSupportedImageMime(mimeType)) {
            throw new Error(`Unsupported image type for X: ${mimeType}`);
        }

        if (kind === 'video' && !this.isSupportedVideoMime(mimeType)) {
            throw new Error(`Unsupported video type for X: ${mimeType}`);
        }

        const resolved: XResolvedMediaSource = {
            source,
            buffer: payload.buffer,
            fileName: payload.fileName,
            mimeType,
            kind,
            sourceType: /^https?:\/\//i.test(source) ? 'remote-url' : 'file',
        };

        this.logUploadDebug('Resolved media source', {
            sourceType: resolved.sourceType,
            kind: resolved.kind,
            fileName: resolved.fileName,
            mimeType: resolved.mimeType,
            bytes: resolved.buffer.length,
        });

        return resolved;
    }

    private getMediaCategory(mimeType: string): string {
        if (mimeType.startsWith('video/')) {
            return 'tweet_video';
        }
        if (mimeType === 'image/gif') {
            return 'tweet_gif';
        }
        return 'tweet_image';
    }

    private async normalizeImagePayload(
        buffer: Buffer,
        fileName: string,
        mimeType: string
    ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
        if (!mimeType.startsWith('image/') || mimeType === 'image/gif') {
            return { buffer, fileName, mimeType };
        }

        let width = 4096;
        let quality = 88;
        let normalizedBuffer = await sharp(buffer, { animated: false })
            .rotate()
            .resize({
                width,
                height: 4096,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();

        while (normalizedBuffer.length > XService.MAX_IMAGE_UPLOAD_BYTES && (width > 1280 || quality > 60)) {
            width = Math.max(1280, Math.round(width * 0.82));
            quality = Math.max(60, quality - 8);
            normalizedBuffer = await sharp(buffer, { animated: false })
                .rotate()
                .resize({
                    width,
                    height: 4096,
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality, mozjpeg: true })
                .toBuffer();
        }

        if (normalizedBuffer.length > XService.MAX_IMAGE_UPLOAD_BYTES) {
            throw new Error('Image exceeds X 5MB upload limit after optimization');
        }

        const parsedName = path.parse(fileName);
        return {
            buffer: normalizedBuffer,
            fileName: `${parsedName.name || 'image'}.jpg`,
            mimeType: 'image/jpeg',
        };
    }

    private async initializeMediaUpload(
        authToken: string,
        payload: { buffer: Buffer; mimeType: string }
    ): Promise<string> {
        const initializePayload = {
            media_type: payload.mimeType,
            media_category: this.getMediaCategory(payload.mimeType),
            total_bytes: payload.buffer.length,
        };
        const initializeResponse = await fetch('https://api.x.com/2/media/upload/initialize', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(initializePayload),
        });

        const initializeData = await this.getJsonResponse(initializeResponse);
        this.logUploadDebug('INIT response', {
            status: initializeResponse.status,
            request: initializePayload,
            body: initializeData,
        });
        if (!initializeResponse.ok) {
            throw new Error(
                this.extractApiErrorMessage(
                    initializeData,
                    `Failed to initialize X media upload (${initializeResponse.status})`
                )
            );
        }

        const mediaId =
            initializeData?.data?.id
            || initializeData?.media_id
            || initializeData?.media_id_string;
        if (!mediaId) {
            throw new Error('X media upload initialization did not return a media id');
        }

        return String(mediaId);
    }

    private async uploadVideo(source: string, connection?: PlatformConnection): Promise<XUploadResult> {
        const authToken = this.getUserAccessToken(connection);
        if (!authToken) {
            return { mediaId: null, error: 'X user access token not configured. Reconnect X from Platforms.' };
        }

        try {
            const resolved = await this.resolveMediaSource(source);
            if (resolved.kind !== 'video') {
                throw new Error('X native video upload requires a video file');
            }
            const mediaId = await this.initializeMediaUpload(authToken, {
                buffer: resolved.buffer,
                mimeType: resolved.mimeType,
            });

            const processingInfo = await this.appendAndFinalizeUpload(mediaId, {
                buffer: resolved.buffer,
                fileName: resolved.fileName,
                mimeType: resolved.mimeType,
            }, authToken);
            await this.waitForVideoProcessing(mediaId, authToken, processingInfo);

            return { mediaId };
        } catch (error) {
            console.error('[X] Video upload failed:', error);
            return {
                mediaId: null,
                error: error instanceof Error ? error.message : 'Failed to upload video to X',
            };
        }
    }

    async getRecentMentions(connection: PlatformConnection, since?: Date): Promise<XMentionComment[]> {
        const authToken = this.getUserAccessToken(connection);
        if (!authToken) {
            throw new Error('X user access token not configured. Reconnect X from Platforms.');
        }

        if (!connection.userId) {
            throw new Error('X user id missing on platform connection. Reconnect X from Platforms.');
        }

        const params = new URLSearchParams({
            max_results: '25',
            expansions: 'author_id',
            'tweet.fields': 'author_id,conversation_id,created_at,in_reply_to_user_id,text',
            'user.fields': 'username',
        });

        if (since) {
            params.set('start_time', since.toISOString());
        }

        const response = await fetch(
            `https://api.x.com/2/users/${encodeURIComponent(connection.userId)}/mentions?${params.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            }
        );

        const data = await this.getJsonResponse(response);
        this.logUploadDebug('Mentions response', {
            status: response.status,
            hasData: Array.isArray(data?.data),
            count: Array.isArray(data?.data) ? data.data.length : 0,
        });

        if (!response.ok) {
            throw new Error(
                this.extractApiErrorMessage(
                    data,
                    `Failed to fetch X mentions (${response.status})`
                )
            );
        }

        const users = new Map<string, string>();
        const includedUsers = Array.isArray(data?.includes?.users) ? data.includes.users : [];
        for (const user of includedUsers) {
            if (typeof user?.id === 'string' && typeof user?.username === 'string') {
                users.set(user.id, user.username);
            }
        }

        const tweets = Array.isArray(data?.data) ? data.data : [];
        const conversationIds = Array.from(
            new Set(
                tweets
                    .map((tweet: any) =>
                        typeof tweet?.conversation_id === 'string' ? tweet.conversation_id : null
                    )
                    .filter((value: string | null): value is string => Boolean(value))
            )
        );

        const conversationCreatedAt = new Map<string, Date>();
        for (let index = 0; index < conversationIds.length; index += 100) {
            const batch = conversationIds.slice(index, index + 100);
            const lookupParams = new URLSearchParams({
                ids: batch.join(','),
                'tweet.fields': 'created_at',
            });
            const lookupResponse = await fetch(
                `https://api.x.com/2/tweets?${lookupParams.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                }
            );
            const lookupData = await this.getJsonResponse(lookupResponse);
            if (!lookupResponse.ok) {
                throw new Error(
                    this.extractApiErrorMessage(
                        lookupData,
                        `Failed to fetch X root tweets (${lookupResponse.status})`
                    )
                );
            }

            const rootTweets = Array.isArray(lookupData?.data) ? lookupData.data : [];
            for (const tweet of rootTweets) {
                if (typeof tweet?.id === 'string' && typeof tweet?.created_at === 'string') {
                    const createdAt = new Date(tweet.created_at);
                    if (!Number.isNaN(createdAt.getTime())) {
                        conversationCreatedAt.set(tweet.id, createdAt);
                    }
                }
            }
        }

        return tweets
            .filter((tweet: any) => {
                if (typeof tweet?.id !== 'string' || typeof tweet?.text !== 'string') {
                    return false;
                }

                if (typeof tweet?.author_id !== 'string' || tweet.author_id === connection.userId) {
                    return false;
                }

                if (tweet?.in_reply_to_user_id && tweet.in_reply_to_user_id !== connection.userId) {
                    return false;
                }

                return true;
            })
            .map((tweet: any) => ({
                commentId: String(tweet.id),
                postId: typeof tweet?.conversation_id === 'string' ? tweet.conversation_id : String(tweet.id),
                username: users.get(String(tweet.author_id)) || String(tweet.author_id),
                userId: typeof tweet?.author_id === 'string' ? tweet.author_id : undefined,
                content: String(tweet.text || '').trim(),
                createdAt: new Date(tweet.created_at || Date.now()),
                parentPostCreatedAt: typeof tweet?.conversation_id === 'string'
                    ? conversationCreatedAt.get(tweet.conversation_id)
                    : undefined,
            }))
            .filter((mention: { content: string }) => mention.content.length > 0);
    }

    async replyToTweet(tweetId: string, text: string, connection?: PlatformConnection): Promise<XPostResult> {
        const authToken = this.getUserAccessToken(connection);
        if (!authToken) {
            return { success: false, error: 'X user access token not configured. Reconnect X from Platforms.' };
        }

        try {
            const response = await fetch('https://api.x.com/2/tweets', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text.slice(0, 280),
                    reply: {
                        in_reply_to_tweet_id: tweetId,
                    },
                }),
            });

            const data = await this.getJsonResponse(response);
            this.logUploadDebug('Reply tweet response', {
                status: response.status,
                body: data,
            });

            if (!response.ok) {
                return {
                    success: false,
                    error: this.extractApiErrorMessage(data, `Failed to reply on X (${response.status})`),
                };
            }

            return {
                success: true,
                postId: data?.data?.id,
                postUrl: data?.data?.id ? `https://x.com/i/web/status/${data.data.id}` : undefined,
            };
        } catch (error) {
            return { success: false, error: `X API error: ${error}` };
        }
    }

    private async appendAndFinalizeUpload(
        mediaId: string,
        payload: { buffer: Buffer; fileName: string; mimeType: string },
        authToken: string
    ): Promise<{ state?: string; check_after_secs?: number } | undefined> {
        const chunkSize = 5 * 1024 * 1024;
        let segmentIndex = 0;

        for (let offset = 0; offset < payload.buffer.length; offset += chunkSize) {
            const chunk = payload.buffer.subarray(offset, Math.min(offset + chunkSize, payload.buffer.length));
            const formData = new FormData();
            formData.append('segment_index', String(segmentIndex));
            formData.append('media', new Blob([chunk], { type: payload.mimeType }), payload.fileName);

            const appendResponse = await fetch(`https://api.x.com/2/media/upload/${encodeURIComponent(mediaId)}/append`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: formData,
            });

            if (!appendResponse.ok) {
                const appendData = await this.getJsonResponse(appendResponse);
                this.logUploadDebug('APPEND response', {
                    status: appendResponse.status,
                    segmentIndex,
                    body: appendData,
                });
                throw new Error(
                    this.extractApiErrorMessage(
                        appendData,
                        `X video upload APPEND failed at segment ${segmentIndex} (${appendResponse.status})`
                    )
                );
            }

            segmentIndex += 1;
        }

        const finalizeResponse = await fetch(`https://api.x.com/2/media/upload/${encodeURIComponent(mediaId)}/finalize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });

        const finalizeData = await this.getJsonResponse(finalizeResponse);
        this.logUploadDebug('FINALIZE response', {
            status: finalizeResponse.status,
            body: finalizeData,
        });
        if (!finalizeResponse.ok) {
            throw new Error(
                this.extractApiErrorMessage(
                    finalizeData,
                    `X video upload FINALIZE failed (${finalizeResponse.status})`
                )
            );
        }

        return finalizeData?.data?.processing_info || finalizeData?.processing_info;
    }

    private async waitForVideoProcessing(
        mediaId: string,
        authToken: string,
        processingInfo?: { state?: string; check_after_secs?: number }
    ): Promise<void> {
        let state = processingInfo?.state;
        let checkAfterSeconds = processingInfo?.check_after_secs || 2;

        while (state === 'pending' || state === 'in_progress') {
            await this.sleep(Math.max(checkAfterSeconds, 1) * 1000);

            const response = await fetch(
                `https://api.x.com/2/media/upload?command=STATUS&media_id=${encodeURIComponent(mediaId)}`,
                {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                }
            );

            const data = await this.getJsonResponse(response);
            this.logUploadDebug('STATUS response', {
                status: response.status,
                body: data,
            });
            if (!response.ok) {
                throw new Error(
                    this.extractApiErrorMessage(
                        data,
                        `X video upload STATUS failed (${response.status})`
                    )
                );
            }

            const nextInfo = data?.data?.processing_info || data?.processing_info;
            state = nextInfo?.state;
            checkAfterSeconds = nextInfo?.check_after_secs || 2;

            if (state === 'failed') {
                const errorMessage =
                    nextInfo?.error?.message
                    || nextInfo?.error?.name
                    || 'X reported that video processing failed';
                throw new Error(errorMessage);
            }

            if (!state || state === 'succeeded') {
                return;
            }
        }
    }

    async uploadMedia(imageUrl: string, connection?: PlatformConnection): Promise<XUploadResult> {
        const authToken = this.getUserAccessToken(connection);
        if (!authToken) {
            return { mediaId: null, error: 'X user access token not configured. Reconnect X from Platforms.' };
        }

        try {
            const resolved = await this.resolveMediaSource(imageUrl);
            if (resolved.kind !== 'image') {
                throw new Error('X image upload requires an image file');
            }
            const payload = await this.normalizeImagePayload(
                resolved.buffer,
                resolved.fileName,
                resolved.mimeType
            );
            const jsonUploadResponse = await fetch('https://api.x.com/2/media/upload', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    media: payload.buffer.toString('base64'),
                    media_type: payload.mimeType,
                    media_category: this.getMediaCategory(payload.mimeType),
                }),
            });

            const jsonUploadData = await this.getJsonResponse(jsonUploadResponse);
            if (jsonUploadResponse.ok) {
                const mediaId =
                    jsonUploadData?.data?.id
                    || jsonUploadData?.media_id_string
                    || jsonUploadData?.media_id;

                if (mediaId) {
                    return { mediaId };
                }
            } else if (jsonUploadResponse.status === 403) {
                throw new Error(
                    this.extractApiErrorMessage(
                        jsonUploadData,
                        `Failed to upload X image media (${jsonUploadResponse.status})`
                    )
                );
            }

            const formData = new FormData();
            formData.append('media', new Blob([payload.buffer], { type: payload.mimeType }), payload.fileName);
            formData.append('media_category', this.getMediaCategory(payload.mimeType));
            formData.append('media_type', payload.mimeType);

            const uploadResponse = await fetch('https://api.x.com/2/media/upload', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: formData,
            });

            const uploadData = await this.getJsonResponse(uploadResponse);
            if (uploadResponse.ok) {
                const mediaId =
                    uploadData?.data?.id
                    || uploadData?.media_id_string
                    || uploadData?.media_id;

                if (mediaId) {
                    return { mediaId };
                }
            }

            const mediaId = await this.initializeMediaUpload(authToken, payload);

            const processingInfo = await this.appendAndFinalizeUpload(mediaId, payload, authToken);
            if (processingInfo?.state === 'failed') {
                throw new Error('X reported that image processing failed');
            }

            return { mediaId };
        } catch (error) {
            console.error('[X] Media upload failed:', error);
            return {
                mediaId: null,
                error: error instanceof Error ? error.message : 'Failed to upload image media to X',
            };
        }
    }
}

export const xService = new XService();
