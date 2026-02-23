import prisma from '../lib/prisma';
import fs from 'fs';
import { xService } from './platforms/x';
import { metaService } from './platforms/meta';
import { youtubeService } from './platforms/youtube';
import { tiktokService } from './platforms/tiktok';
import { pinterestService } from './platforms/pinterest';
import { notificationService } from './notification.service';

export interface PublishContent {
    text: string;
    title?: string;
    link?: string;
    imageUrl?: string;
    videoUrl?: string; // For platforms that support URL (TikTok)
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

        console.log(`[Publisher] Publishing to ${platforms.join(', ')}...`);

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

        for (const platform of platforms) {
            // Get platform connection
            const connection = await prisma.platformConnection.findUnique({
                where: { platform }
            });

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
                                    content.text,
                                    content.imageUrl || (mediaFilePath && this.isImage(mediaFilePath) ? mediaFilePath : undefined),
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
                                    content.text,
                                    content.imageUrl || null,
                                    connection.accessToken,
                                    content.link
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
                            if (connection.accessToken && connection.userId && content.imageUrl) {
                                const igResult = await metaService.postToInstagram(
                                    connection.userId,
                                    content.text,
                                    content.imageUrl,
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
                                    content.text,
                                    content.imageUrl || null,
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
                                if (content.videoUrl || (mediaFilePath && !this.isImage(mediaFilePath))) {
                                    const videoSource = content.videoUrl || mediaFilePath;
                                    if (videoSource) {
                                        const ttResult = await tiktokService.postVideo(
                                            videoSource,
                                            content.title || content.text,
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
                                        title: content.title || content.text.slice(0, 100),
                                        description: content.text,
                                        privacyStatus: 'public',
                                        thumbnailPath: undefined,
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
                                const boardId = options.pinterestBoardId || (connection.metadata as any)?.defaultBoardId;

                                if (boardId && content.imageUrl) {
                                    const pinResult = await pinterestService.createPin(
                                        boardId,
                                        content.title || content.text.slice(0, 50),
                                        content.text,
                                        content.imageUrl,
                                        connection.accessToken,
                                        { link: options.pinterestLink || content.link }
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
