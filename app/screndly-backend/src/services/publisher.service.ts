import prisma from '../lib/prisma';
import { xService } from './platforms/x';
import { metaService } from './platforms/meta';
import { youtubeService } from './platforms/youtube';
import { tiktokService } from './platforms/tiktok';
import { pinterestService } from './platforms/pinterest';
import { ensureFreshPlatformConnection } from './platforms/connectionAuth';
import { notificationService } from './notification.service';

export interface PublishContent {
    text: string;
    title?: string;
    description?: string;
    link?: string;
    imageUrl?: string;
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

export class PublisherService {
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
            let connection = await prisma.platformConnection.findUnique({
                where: { platform }
            });
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
                    switch (platform) {
                        case 'X':
                            if (connection.accessToken) {
                                const xResult = await xService.postTweet(
                                    platformContent.text,
                                    platformContent.imagePath
                                        || platformContent.imageUrl
                                        || (mediaFilePath && this.isImage(mediaFilePath) ? mediaFilePath : undefined),
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
                            if (connection.accessToken && connection.userId) {
                                const fbResult = await metaService.postToFacebook(
                                    connection.userId,
                                    platformContent.text,
                                    platformContent.imageUrl || null,
                                    connection.accessToken,
                                    platformContent.link
                                );
                                result = {
                                    platform,
                                    ...fbResult,
                                    status: fbResult.success ? 'posted' : 'failed',
                                    postedAt: new Date().toISOString()
                                };
                            }
                            break;

                        case 'Instagram':
                            if (connection.accessToken && connection.userId && platformContent.imageUrl) {
                                const igResult = await metaService.postToInstagram(
                                    connection.userId,
                                    platformContent.text,
                                    platformContent.imageUrl,
                                    connection.accessToken
                                );
                                result = {
                                    platform,
                                    ...igResult,
                                    status: igResult.success ? 'posted' : 'failed',
                                    postedAt: new Date().toISOString()
                                };
                            }
                            break;

                        case 'Threads':
                            if (connection.accessToken && connection.userId) {
                                const threadsResult = await metaService.postToThreads(
                                    connection.userId,
                                    platformContent.text,
                                    platformContent.imageUrl || null,
                                    connection.accessToken
                                );
                                result = {
                                    platform,
                                    ...threadsResult,
                                    status: threadsResult.success ? 'posted' : 'failed',
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

                                if (boardId && platformContent.imageUrl) {
                                    const pinResult = await pinterestService.createPin(
                                        boardId,
                                        platformContent.title || platformContent.text.slice(0, 50),
                                        platformContent.text,
                                        platformContent.imageUrl,
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
                                    result.error = 'Pinterest requires Board ID and Image';
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
                await notificationService.notifyUser({
                    title: `Publish Failed: ${platform}`,
                    message: `Failed to publish to ${platform}: ${result.error}`,
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
