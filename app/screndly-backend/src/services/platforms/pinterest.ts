// Pinterest Platform Service
// Requires: PINTEREST_APP_ID, PINTEREST_APP_SECRET

import fs from 'fs/promises';
import path from 'path';

interface PinterestPostResult {
    success: boolean;
    pinId?: string;
    pinUrl?: string;
    error?: string;
}

interface PinterestMediaUpload {
    media_id?: string;
    upload_url?: string;
    upload_parameters?: Record<string, string>;
}

export class PinterestService {
    private appId: string;
    private appSecret: string;
    private baseUrl = 'https://api.pinterest.com/v5';

    constructor() {
        this.appId = process.env.PINTEREST_APP_ID || '';
        this.appSecret = process.env.PINTEREST_APP_SECRET || '';
    }

    private async getJsonResponse(response: Response): Promise<any> {
        return response.json().catch(() => ({}));
    }

    private getMimeType(filePath: string): string {
        switch (path.extname(filePath).toLowerCase()) {
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

    private async sleep(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    private async registerVideoUpload(accessToken: string): Promise<PinterestMediaUpload> {
        const response = await fetch(`${this.baseUrl}/media`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                media_type: 'video',
            }),
        });

        const data = await this.getJsonResponse(response);
        if (!response.ok) {
            throw new Error(data?.message || data?.code || `Pinterest media registration failed (${response.status})`);
        }

        return data as PinterestMediaUpload;
    }

    private async uploadVideoAsset(
        uploadUrl: string,
        uploadParameters: Record<string, string>,
        filePath: string
    ): Promise<void> {
        const buffer = await fs.readFile(filePath);
        const formData = new FormData();

        for (const [key, value] of Object.entries(uploadParameters || {})) {
            formData.append(key, value);
        }

        formData.append(
            'file',
            new Blob([buffer], { type: this.getMimeType(filePath) }),
            path.basename(filePath)
        );

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const message = await response.text().catch(() => '');
            throw new Error(message || `Pinterest media upload failed (${response.status})`);
        }
    }

    private async waitForMediaReady(mediaId: string, accessToken: string): Promise<void> {
        const maxAttempts = 30;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const response = await fetch(`${this.baseUrl}/media/${mediaId}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            const data = await this.getJsonResponse(response);
            if (!response.ok) {
                throw new Error(data?.message || data?.code || `Pinterest media status check failed (${response.status})`);
            }

            const status = String(data?.status || '').toLowerCase();
            if (!status || status === 'succeeded') {
                return;
            }

            if (status === 'failed') {
                throw new Error(data?.message || data?.code || 'Pinterest media processing failed');
            }

            await this.sleep(5_000);
        }

        throw new Error('Pinterest media processing timed out');
    }

    // Create a Pin
    async createPin(
        boardId: string,
        title: string,
        description: string,
        imageUrl: string,
        accessToken: string,
        options?: {
            link?: string;
            altText?: string;
        }
    ): Promise<PinterestPostResult> {
        if (!accessToken) {
            return { success: false, error: 'Pinterest access token required' };
        }

        try {
            const response = await fetch(`${this.baseUrl}/pins`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    board_id: boardId,
                    title: title.slice(0, 100),
                    description: description.slice(0, 500),
                    media_source: {
                        source_type: 'image_url',
                        url: imageUrl,
                    },
                    link: options?.link,
                    alt_text: options?.altText || title,
                }),
            });

            const data: any = await response.json();

            if (data.code) {
                return { success: false, error: data.message };
            }

            return {
                success: true,
                pinId: data.id,
                pinUrl: `https://pinterest.com/pin/${data.id}`,
            };
        } catch (error) {
            return { success: false, error: `Pinterest API error: ${error}` };
        }
    }

    async createVideoPin(
        boardId: string,
        title: string,
        description: string,
        videoPath: string,
        accessToken: string,
        options?: {
            link?: string;
            altText?: string;
            coverImageUrl?: string;
        }
    ): Promise<PinterestPostResult> {
        if (!accessToken) {
            return { success: false, error: 'Pinterest access token required' };
        }

        try {
            const upload = await this.registerVideoUpload(accessToken);
            if (!upload.media_id || !upload.upload_url || !upload.upload_parameters) {
                throw new Error('Pinterest video upload registration was incomplete');
            }

            await this.uploadVideoAsset(upload.upload_url, upload.upload_parameters, videoPath);
            await this.waitForMediaReady(upload.media_id, accessToken);

            const response = await fetch(`${this.baseUrl}/pins`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    board_id: boardId,
                    title: title.slice(0, 100),
                    description: description.slice(0, 500),
                    media_source: {
                        source_type: 'video_id',
                        media_id: upload.media_id,
                        ...(options?.coverImageUrl ? { cover_image_url: options.coverImageUrl } : {}),
                    },
                    link: options?.link,
                    alt_text: options?.altText || title,
                }),
            });

            const data = await this.getJsonResponse(response);
            if (!response.ok || data?.code) {
                throw new Error(data?.message || data?.code || 'Failed to create Pinterest video pin');
            }

            return {
                success: true,
                pinId: data.id,
                pinUrl: `https://pinterest.com/pin/${data.id}`,
            };
        } catch (error) {
            return { success: false, error: `Pinterest video API error: ${error}` };
        }
    }

    // Get user's boards
    async getBoards(accessToken: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/boards`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            return await response.json();
        } catch (error) {
            return { items: [] };
        }
    }

    // Create a board
    async createBoard(name: string, description: string, accessToken: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/boards`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name.slice(0, 50),
                    description: description.slice(0, 500),
                    privacy: 'PUBLIC',
                }),
            });

            return await response.json();
        } catch (error) {
            return { error: `Failed to create board: ${error}` };
        }
    }

    // Get user info
    async getUserInfo(accessToken: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/user_account`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            return await response.json();
        } catch (error) {
            return null;
        }
    }
}

export const pinterestService = new PinterestService();
