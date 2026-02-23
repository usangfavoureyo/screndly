/**
 * Pinterest Adapter for Screndly
 * 
 * Publishes Pin content to Pinterest boards.
 * Supports video pins and image pins.
 * 
 * References:
 * - Pinterest API: https://developers.pinterest.com/docs/api/v5/
 * - Content creation: https://developers.pinterest.com/docs/api/v5/#tag/pins/POST/pins
 */

import { getPinterestAccessToken } from '../utils/pinterestTokenStorage';

// Test mode toggle
export const TEST_MODE = typeof process !== 'undefined'
    ? (process.env?.NODE_ENV === 'test' || process.env?.PINTEREST_TEST_MODE === 'true')
    : false;

// Pinterest API Base URL
const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

// Pin Requirements
export const PINTEREST_PIN_REQUIREMENTS = {
    video: {
        minDuration: 4, // seconds
        maxDuration: 900, // 15 minutes
        maxSize: 2 * 1024 * 1024 * 1024, // 2 GB
        formats: ['MP4', 'MOV'],
        aspectRatio: { min: 1 / 2.1, max: 1.91 / 1 },
        minResolution: { width: 240, height: 240 },
    },
    image: {
        maxSize: 32 * 1024 * 1024, // 32 MB
        formats: ['JPEG', 'PNG', 'GIF', 'WEBP'],
        aspectRatio: { min: 2 / 3, max: 1 / 1.91 },
        recommendedSize: { width: 1000, height: 1500 }, // 2:3 ratio
    },
    description: {
        maxLength: 500,
    },
    title: {
        maxLength: 100,
    },
};

// Rate limits
export const PINTEREST_RATE_LIMITS = {
    pinsPerDay: 100,
    pinsPerHour: 20,
    requestsPerMinute: 100,
};

interface PinOptions {
    title: string;
    description: string;
    boardId: string;
    mediaUrl: string;
    mediaType: 'video' | 'image';
    link?: string;
    altText?: string;
    thumbnailUrl?: string;
}

interface PinResult {
    success: boolean;
    pinId?: string;
    pinUrl?: string;
    error?: string;
    retryAfter?: number;
    logs: string[];
}

/**
 * Pinterest Adapter Class
 */
class PinterestAdapter {
    private readonly MAX_DESCRIPTION_LENGTH = 500;
    private readonly MAX_TITLE_LENGTH = 100;

    constructor() { }

    /**
     * Initialize adapter
     */
    async initialize(): Promise<void> {
        const accessToken = getPinterestAccessToken();

        if (!accessToken && !TEST_MODE) {
            console.warn('[PinterestAdapter] No access token found');
        }
    }

    /**
     * Create a Pin
     */
    async createPin(options: PinOptions): Promise<PinResult> {
        const logs: string[] = [];
        logs.push(`Creating ${options.mediaType} pin to board ${options.boardId}`);

        try {
            const accessToken = getPinterestAccessToken();

            if (!accessToken) {
                if (TEST_MODE) {
                    logs.push('[TEST MODE] Simulating pin creation');
                    return this.simulateSuccess(logs);
                }

                return {
                    success: false,
                    error: 'Not authenticated with Pinterest',
                    logs,
                };
            }

            // Validate and truncate
            const title = this.truncateText(options.title, this.MAX_TITLE_LENGTH);
            const description = this.truncateText(options.description, this.MAX_DESCRIPTION_LENGTH);

            logs.push(`Title: ${title.substring(0, 50)}...`);
            logs.push(`Description length: ${description.length}`);

            // Create pin based on media type
            if (options.mediaType === 'video') {
                return await this.createVideoPin({
                    ...options,
                    title,
                    description,
                }, accessToken, logs);
            } else {
                return await this.createImagePin({
                    ...options,
                    title,
                    description,
                }, accessToken, logs);
            }
        } catch (error) {
            return this.handleError(error, logs);
        }
    }

    /**
     * Create a video pin
     */
    private async createVideoPin(
        options: PinOptions,
        accessToken: string,
        logs: string[]
    ): Promise<PinResult> {
        logs.push('Creating video pin...');

        if (TEST_MODE) {
            logs.push('[TEST MODE] Simulating video upload');
            await this.sleep(1000);
            return this.simulateSuccess(logs);
        }

        // Register video
        logs.push('Registering video...');
        const registerResponse = await fetch(`${PINTEREST_API_BASE}/media`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                media_type: 'video',
            }),
        });

        if (!registerResponse.ok) {
            const error = await registerResponse.json().catch(() => ({}));
            return {
                success: false,
                error: error.message || 'Failed to register video',
                logs,
            };
        }

        const registerData = await registerResponse.json();
        const mediaId = registerData.media_id;
        logs.push(`Media ID: ${mediaId}`);

        // Upload video to Pinterest's upload URL
        logs.push('Uploading video...');
        const uploadUrl = registerData.upload_url;

        // Fetch video from URL and upload
        const videoResponse = await fetch(options.mediaUrl);
        const videoBlob = await videoResponse.blob();

        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            body: videoBlob,
        });

        if (!uploadResponse.ok) {
            return {
                success: false,
                error: 'Failed to upload video',
                logs,
            };
        }

        // Wait for processing
        logs.push('Waiting for video processing...');
        await this.waitForMediaProcessing(mediaId, accessToken, logs);

        // Create the pin with the processed video
        return await this.createPinWithMedia({
            ...options,
            mediaId,
        }, accessToken, logs);
    }

    /**
     * Create an image pin
     */
    private async createImagePin(
        options: PinOptions,
        accessToken: string,
        logs: string[]
    ): Promise<PinResult> {
        logs.push('Creating image pin...');

        if (TEST_MODE) {
            logs.push('[TEST MODE] Simulating image pin creation');
            await this.sleep(500);
            return this.simulateSuccess(logs);
        }

        // For images, we can use the URL directly
        const response = await fetch(`${PINTEREST_API_BASE}/pins`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                board_id: options.boardId,
                title: options.title,
                description: options.description,
                link: options.link,
                alt_text: options.altText,
                media_source: {
                    source_type: 'image_url',
                    url: options.mediaUrl,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            return {
                success: false,
                error: error.message || 'Failed to create pin',
                retryAfter: response.status === 429
                    ? parseInt(response.headers.get('Retry-After') || '60', 10)
                    : undefined,
                logs,
            };
        }

        const data = await response.json();
        logs.push(`Pin created: ${data.id}`);

        return {
            success: true,
            pinId: data.id,
            pinUrl: `https://pinterest.com/pin/${data.id}`,
            logs,
        };
    }

    /**
     * Create pin with uploaded media
     */
    private async createPinWithMedia(
        options: PinOptions & { mediaId: string },
        accessToken: string,
        logs: string[]
    ): Promise<PinResult> {
        logs.push('Creating pin with uploaded media...');

        const response = await fetch(`${PINTEREST_API_BASE}/pins`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                board_id: options.boardId,
                title: options.title,
                description: options.description,
                link: options.link,
                alt_text: options.altText,
                media_source: {
                    source_type: 'video_id',
                    media_id: options.mediaId,
                    cover_image_url: options.thumbnailUrl,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            return {
                success: false,
                error: error.message || 'Failed to create pin',
                retryAfter: response.status === 429
                    ? parseInt(response.headers.get('Retry-After') || '60', 10)
                    : undefined,
                logs,
            };
        }

        const data = await response.json();
        logs.push(`Pin created: ${data.id}`);

        return {
            success: true,
            pinId: data.id,
            pinUrl: `https://pinterest.com/pin/${data.id}`,
            logs,
        };
    }

    /**
     * Wait for media to finish processing
     */
    private async waitForMediaProcessing(
        mediaId: string,
        accessToken: string,
        logs: string[]
    ): Promise<void> {
        const maxAttempts = 30;
        const pollInterval = 5000; // 5 seconds

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const response = await fetch(`${PINTEREST_API_BASE}/media/${mediaId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to check media status');
            }

            const data = await response.json();
            const status = data.status;

            logs.push(`Processing status: ${status}`);

            if (status === 'succeeded') {
                return;
            }

            if (status === 'failed') {
                throw new Error('Media processing failed');
            }

            await this.sleep(pollInterval);
        }

        throw new Error('Media processing timeout');
    }

    /**
     * Get user's boards
     */
    async getBoards(): Promise<Array<{ id: string; name: string; privacy: string }>> {
        const accessToken = getPinterestAccessToken();

        if (!accessToken) {
            if (TEST_MODE) {
                return this.getMockBoards();
            }
            return [];
        }

        try {
            const response = await fetch(`${PINTEREST_API_BASE}/boards`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                return TEST_MODE ? this.getMockBoards() : [];
            }

            const data = await response.json();
            return data.items.map((board: any) => ({
                id: board.id,
                name: board.name,
                privacy: board.privacy,
            }));
        } catch (_error) {
            return TEST_MODE ? this.getMockBoards() : [];
        }
    }

    /**
     * Get mock boards for testing
     */
    private getMockBoards(): Array<{ id: string; name: string; privacy: string }> {
        return [
            { id: '1', name: 'Movie Trailers', privacy: 'PUBLIC' },
            { id: '2', name: 'Entertainment News', privacy: 'PUBLIC' },
            { id: '3', name: 'New Releases', privacy: 'PUBLIC' },
        ];
    }

    /**
     * Get quota usage
     */
    async getQuotaUsage(): Promise<{
        daily: { used: number; limit: number };
        hourly: { used: number; limit: number };
    }> {
        // Pinterest API doesn't expose quota directly
        // We track locally
        const stored = localStorage.getItem('screndly_pinterest_quota');

        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (_e) {
                // Return defaults
            }
        }

        return {
            daily: { used: 0, limit: PINTEREST_RATE_LIMITS.pinsPerDay },
            hourly: { used: 0, limit: PINTEREST_RATE_LIMITS.pinsPerHour },
        };
    }

    /**
     * Increment quota usage
     */
    private incrementQuota(): void {
        const quota = {
            daily: { used: 0, limit: PINTEREST_RATE_LIMITS.pinsPerDay },
            hourly: { used: 0, limit: PINTEREST_RATE_LIMITS.pinsPerHour },
        };

        try {
            const stored = localStorage.getItem('screndly_pinterest_quota');
            if (stored) {
                const parsed = JSON.parse(stored);
                quota.daily.used = parsed.daily?.used || 0;
                quota.hourly.used = parsed.hourly?.used || 0;
            }
        } catch (_e) {
            // Use defaults
        }

        quota.daily.used += 1;
        quota.hourly.used += 1;

        localStorage.setItem('screndly_pinterest_quota', JSON.stringify(quota));
    }

    /**
     * Truncate text to max length
     */
    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Simulate successful pin creation (for testing)
     */
    private simulateSuccess(logs: string[]): PinResult {
        const mockPinId = `mock_${Date.now()}`;
        logs.push(`[TEST MODE] Mock pin created: ${mockPinId}`);

        return {
            success: true,
            pinId: mockPinId,
            pinUrl: `https://pinterest.com/pin/${mockPinId}`,
            logs,
        };
    }

    /**
     * Handle errors
     */
    private handleError(error: any, logs: string[]): PinResult {
        const message = error?.message || 'Unknown error';
        logs.push(`Error: ${message}`);

        return {
            success: false,
            error: message,
            logs,
        };
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const pinterestAdapter = new PinterestAdapter();
