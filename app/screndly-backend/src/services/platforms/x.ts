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

    private extractApiErrorMessage(data: any, fallback: string): string {
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
        const initializeResponse = await fetch('https://api.x.com/2/media/upload', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                command: 'INIT',
                media_type: payload.mimeType,
                media_category: this.getMediaCategory(payload.mimeType),
                total_bytes: payload.buffer.length,
            }),
        });

        const initializeData = await this.getJsonResponse(initializeResponse);
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
            const payload = await this.getUploadPayload(source);
            if (!payload.mimeType.startsWith('video/')) {
                throw new Error('X native video upload requires a video file');
            }
            const mediaId = await this.initializeMediaUpload(authToken, payload);

            const processingInfo = await this.appendAndFinalizeUpload(mediaId, payload, authToken);
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
            formData.append('command', 'APPEND');
            formData.append('media_id', mediaId);
            formData.append('segment_index', String(segmentIndex));
            formData.append('media', new Blob([chunk], { type: payload.mimeType }), payload.fileName);

            const appendResponse = await fetch('https://api.x.com/2/media/upload', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: formData,
            });

            if (!appendResponse.ok) {
                const appendData = await this.getJsonResponse(appendResponse);
                throw new Error(
                    this.extractApiErrorMessage(
                        appendData,
                        `Failed to append X video upload segment ${segmentIndex} (${appendResponse.status})`
                    )
                );
            }

            segmentIndex += 1;
        }

        const finalizeResponse = await fetch('https://api.x.com/2/media/upload', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                command: 'FINALIZE',
                media_id: mediaId,
            }),
        });

        const finalizeData = await this.getJsonResponse(finalizeResponse);
        if (!finalizeResponse.ok) {
            throw new Error(
                this.extractApiErrorMessage(
                    finalizeData,
                    `Failed to finalize X video upload (${finalizeResponse.status})`
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
            if (!response.ok) {
                throw new Error(
                    this.extractApiErrorMessage(
                        data,
                        `Failed to check X media processing status (${response.status})`
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
            const rawPayload = await this.getUploadPayload(imageUrl);
            const payload = await this.normalizeImagePayload(
                rawPayload.buffer,
                rawPayload.fileName,
                rawPayload.mimeType
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
