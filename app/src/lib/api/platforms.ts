import { apiClient } from './client';

export interface PlatformSelection {
    x: boolean;
    facebook: boolean;
    instagram: boolean;
    threads: boolean;
    youtube: boolean;
    tiktok?: boolean;
    pinterest: boolean;
}

export interface PublishContent {
    text: string;
    title?: string; // For YouTube/TikTok
    link?: string; // For Pinterest/FB
    imageUrl?: string; // If posting image
    videoUrl?: string; // If posting video from URL
    sharedThumbnailUrl?: string;
    youtubeThumbnailUrl?: string;
    xThumbnailUrl?: string;
    youtubeTitle?: string;
    youtubeDescription?: string;
    youtubePlaylistIds?: string[];
}

export interface PublishResult {
    success: boolean;
    data?: {
        results: any[];
        summary: {
            total: number;
            posted: number;
            failed: number;
        };
    };
    error?: any;
}

/**
 * Publish content to selected social platforms
 * Handles both file uploads and text/url posts
 */
export async function publishContent(
    platforms: PlatformSelection,
    content: PublishContent,
    mediaFile?: File
): Promise<PublishResult> {
    const selectedPlatforms = Object.entries(platforms)
        .filter(([_, selected]) => selected)
        .map(([platform]) => {
            // Map frontend keys to backend platform names
            const map: Record<string, string> = {
                x: 'X',
                facebook: 'Facebook',
                instagram: 'Instagram',
                threads: 'Threads',
                youtube: 'YouTube',
                tiktok: 'TikTok',
                pinterest: 'Pinterest'
            };
            return map[platform];
        });

    if (selectedPlatforms.length === 0) {
        return { success: false, error: { message: 'No platforms selected' } };
    }

    try {
        // If we have a file, use the uploadFile method from apiClient
        if (mediaFile) {
            // We need to prepare payload. 
            // apiClient.uploadFile sends FormData.
            // platforms and content need to be strings or handled by uploadFile logic if we modify it, 
            // but standard FormData appends strings.

            const response = await apiClient.uploadFile<any>(
                '/api/platforms/post',
                mediaFile,
                undefined, // onProgress
                {
                    platforms: JSON.stringify(selectedPlatforms),
                    content: JSON.stringify(content)
                }
            );

            return response;
        } else {
            // Regular JSON post
            const response = await apiClient.post<any>('/api/platforms/post', {
                platforms: selectedPlatforms,
                content
            });

            return response;
        }
    } catch (error: any) {
        console.error('Publish error:', error);
        return {
            success: false,
            error: {
                message: error.message || 'Failed to publish content'
            }
        };
    }
}
