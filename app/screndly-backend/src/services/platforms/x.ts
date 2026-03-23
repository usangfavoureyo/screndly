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

    async postTweet(text: string, imageSources?: string | string[], connection?: PlatformConnection): Promise<XPostResult> {
        const authToken = connection?.accessToken || this.bearerToken;
        if (!authToken) {
            return { success: false, error: 'X access token not configured' };
        }

        try {
            const normalizedImageSources = this.normalizeImageSources(imageSources);
            const mediaIds: string[] = [];
            for (const imageSource of normalizedImageSources) {
                const mediaId = await this.uploadMedia(imageSource, connection);
                if (mediaId) {
                    mediaIds.push(mediaId);
                }
            }

            if (normalizedImageSources.length > 0 && mediaIds.length === 0) {
                return { success: false, error: 'Failed to upload image media to X' };
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
        const authToken = connection?.accessToken || this.bearerToken;
        if (!authToken) {
            return { success: false, error: 'X access token not configured' };
        }

        try {
            if (!/^https?:\/\//i.test(videoSource)) {
                const validation = await validateVideoForX(videoSource);
                if (!validation.ok) {
                    return { success: false, error: validation.issues.join(' ') };
                }
            }

            const mediaId = await this.uploadVideo(videoSource, connection);
            if (!mediaId) {
                return { success: false, error: 'Failed to upload video to X' };
            }

            const response = await fetch('https://api.x.com/2/tweets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text.slice(0, 280),
                    media: { media_ids: [mediaId] },
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

    private async uploadVideo(source: string, connection?: PlatformConnection): Promise<string | null> {
        const authToken = connection?.accessToken || this.bearerToken;
        if (!authToken) {
            return null;
        }

        try {
            const payload = await this.getUploadPayload(source);
            if (!payload.mimeType.startsWith('video/')) {
                throw new Error('X native video upload requires a video file');
            }

            const initializeResponse = await fetch('https://api.x.com/2/media/upload/initialize', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    media_type: payload.mimeType,
                    media_category: this.getMediaCategory(payload.mimeType),
                    total_bytes: payload.buffer.length,
                }),
            });

            const initializeData = await this.getJsonResponse(initializeResponse);
            if (!initializeResponse.ok) {
                throw new Error(
                    initializeData?.detail
                    || initializeData?.error
                    || `Failed to initialize X video upload (${initializeResponse.status})`
                );
            }

            const mediaId =
                initializeData?.data?.id
                || initializeData?.media_id
                || initializeData?.media_id_string;
            if (!mediaId) {
                throw new Error('X video upload initialization did not return a media id');
            }

            const chunkSize = 5 * 1024 * 1024;
            let segmentIndex = 0;
            for (let offset = 0; offset < payload.buffer.length; offset += chunkSize) {
                const chunk = payload.buffer.subarray(offset, Math.min(offset + chunkSize, payload.buffer.length));
                const formData = new FormData();
                formData.append('segment_index', String(segmentIndex));
                formData.append('media', new Blob([chunk], { type: payload.mimeType }), payload.fileName);

                const appendResponse = await fetch(`https://api.x.com/2/media/upload/${mediaId}/append`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                });

                if (!appendResponse.ok) {
                    const appendData = await this.getJsonResponse(appendResponse);
                    throw new Error(
                        appendData?.detail
                        || appendData?.error
                        || `Failed to append X video upload segment ${segmentIndex}`
                    );
                }

                segmentIndex += 1;
            }

            const finalizeResponse = await fetch(`https://api.x.com/2/media/upload/${mediaId}/finalize`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            const finalizeData = await this.getJsonResponse(finalizeResponse);
            if (!finalizeResponse.ok) {
                throw new Error(
                    finalizeData?.detail
                    || finalizeData?.error
                    || `Failed to finalize X video upload (${finalizeResponse.status})`
                );
            }

            const processingInfo =
                finalizeData?.data?.processing_info
                || finalizeData?.processing_info;
            await this.waitForVideoProcessing(mediaId, authToken, processingInfo);

            return mediaId;
        } catch (error) {
            console.error('[X] Video upload failed:', error);
            return null;
        }
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

            const response = await fetch(`https://api.x.com/2/media/upload?media_id=${encodeURIComponent(mediaId)}`, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            const data = await this.getJsonResponse(response);
            if (!response.ok) {
                throw new Error(
                    data?.detail
                    || data?.error
                    || `Failed to check X media processing status (${response.status})`
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
        }
    }

    async uploadMedia(imageUrl: string, connection?: PlatformConnection): Promise<string | null> {
        const authToken = connection?.accessToken || this.bearerToken;
        if (!authToken) {
            return null;
        }

        try {
            const rawPayload = await this.getUploadPayload(imageUrl);
            const payload = await this.normalizeImagePayload(
                rawPayload.buffer,
                rawPayload.fileName,
                rawPayload.mimeType
            );
            const formData = new FormData();
            formData.append('media', new Blob([payload.buffer], { type: payload.mimeType }), payload.fileName);
            formData.append('media_category', this.getMediaCategory(payload.mimeType));
            formData.append('media_type', payload.mimeType);
            formData.append('shared', 'false');

            const response = await fetch('https://api.x.com/2/media/upload', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: formData,
            });

            const data: any = await this.getJsonResponse(response);
            if (!response.ok) {
                throw new Error(data?.detail || data?.error || 'Failed to upload media to X');
            }

            return data?.data?.id || data?.media_id_string || data?.media_id || null;
        } catch (error) {
            console.error('[X] Media upload failed:', error);
            return null;
        }
    }
}

export const xService = new XService();
