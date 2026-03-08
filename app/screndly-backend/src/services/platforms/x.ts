// X (Twitter) Platform Service
// Requires: X_API_KEY, X_API_SECRET, X_BEARER_TOKEN, X_ACCESS_TOKEN, X_ACCESS_SECRET

import { PlatformConnection } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

interface XPostResult {
    success: boolean;
    postId?: string;
    postUrl?: string;
    error?: string;
}

export class XService {
    private apiKey: string;
    private apiSecret: string;
    private bearerToken: string;

    constructor() {
        this.apiKey = process.env.X_API_KEY || '';
        this.apiSecret = process.env.X_API_SECRET || '';
        this.bearerToken = process.env.X_BEARER_TOKEN || '';
    }

    async postTweet(text: string, imageUrl?: string, connection?: PlatformConnection): Promise<XPostResult> {
        const authToken = connection?.accessToken || this.bearerToken;
        if (!authToken) {
            return { success: false, error: 'X access token not configured' };
        }

        try {
            let mediaId: string | null = null;
            if (imageUrl) {
                mediaId = await this.uploadMedia(imageUrl, connection);
            }

            const response = await fetch('https://api.x.com/2/tweets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text.slice(0, 280), // Twitter character limit
                    ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
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
            default:
                return 'application/octet-stream';
        }
    }

    private async getUploadPayload(source: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
        if (/^https?:\/\//i.test(source)) {
            const response = await fetch(source);
            if (!response.ok) {
                throw new Error(`Failed to download image for X upload: ${response.status} ${response.statusText}`);
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

    async uploadMedia(imageUrl: string, connection?: PlatformConnection): Promise<string | null> {
        const authToken = connection?.accessToken || this.bearerToken;
        if (!authToken) {
            return null;
        }

        try {
            const payload = await this.getUploadPayload(imageUrl);
            const formData = new FormData();
            formData.append('media', new Blob([payload.buffer], { type: payload.mimeType }), payload.fileName);

            const response = await fetch('https://api.x.com/2/media/upload', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: formData,
            });

            const data: any = await response.json().catch(() => ({}));
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
