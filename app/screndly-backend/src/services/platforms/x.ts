// X (Twitter) Platform Service
// Requires: X_API_KEY, X_API_SECRET, X_BEARER_TOKEN, X_ACCESS_TOKEN, X_ACCESS_SECRET

import { PlatformConnection } from '@prisma/client';

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
            // Twitter API v2 endpoint
            const response = await fetch('https://api.twitter.com/2/tweets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text.slice(0, 280), // Twitter character limit
                    // If imageUrl provided, would need to upload media first
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
                postUrl: `https://twitter.com/i/web/status/${data.data?.id}`,
            };
        } catch (error) {
            return { success: false, error: `X API error: ${error}` };
        }
    }

    async uploadMedia(imageUrl: string): Promise<string | null> {
        // TODO: Implement media upload using Twitter API v1.1 media/upload
        // This requires downloading the image and uploading as multipart/form-data
        return null;
    }
}

export const xService = new XService();
