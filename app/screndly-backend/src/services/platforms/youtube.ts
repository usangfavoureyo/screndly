import { google } from 'googleapis';
import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../lib/env';

export const youtubeService = {
    /**
     * Get an authenticated YouTube API client
     */
    getClient(accessToken: string, refreshToken?: string): OAuth2Client {
        const oauth2Client = new google.auth.OAuth2(
            env.YOUTUBE_CLIENT_ID,
            env.YOUTUBE_CLIENT_SECRET,
            env.FRONTEND_URL // Redirect URI
        );

        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        return oauth2Client;
    },

    /**
     * Upload a video to YouTube
     */
    async uploadVideo(
        accessToken: string,
        videoPath: string,
        metadata: {
            title: string;
            description: string;
            tags?: string[];
            privacyStatus?: 'private' | 'public' | 'unlisted';
            thumbnailPath?: string;
        },
        refreshToken?: string
    ) {
        try {
            const auth = this.getClient(accessToken, refreshToken);
            const youtube = google.youtube({ version: 'v3', auth });

            // 1. Upload Video
            const res = await youtube.videos.insert({
                part: ['snippet', 'status'],
                requestBody: {
                    snippet: {
                        title: metadata.title,
                        description: metadata.description,
                        tags: metadata.tags || [],
                    },
                    status: {
                        privacyStatus: metadata.privacyStatus || 'private',
                        selfDeclaredMadeForKids: false,
                    },
                },
                media: {
                    body: fs.createReadStream(videoPath),
                },
            });

            const videoId = res.data.id!;
            console.log(`[YouTube] Video uploaded: ${videoId}`);

            // 2. Upload Thumbnail (if provided)
            if (metadata.thumbnailPath && videoId) {
                await youtube.thumbnails.set({
                    videoId: videoId,
                    media: {
                        body: fs.createReadStream(metadata.thumbnailPath),
                    },
                });
                console.log(`[YouTube] Thumbnail set for: ${videoId}`);
            }

            return {
                success: true,
                data: {
                    id: videoId,
                    url: `https://youtu.be/${videoId}`,
                    ...res.data
                }
            };

        } catch (error: any) {
            console.error('[YouTube] Upload Error:', error?.response?.data || error.message);
            return {
                success: false,
                error: error?.response?.data?.error?.message || error.message
            };
        }
    }
};
