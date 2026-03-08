import { google } from 'googleapis';
import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../lib/env';

export const youtubeService = {
    async resolvePlaylistIds(youtube: any, playlistNamesOrIds: string[]): Promise<string[]> {
        const requested = playlistNamesOrIds
            .map((value) => value.trim())
            .filter(Boolean);

        if (requested.length === 0) {
            return [];
        }

        const existingPlaylists: Array<{ id?: string | null; title?: string | null }> = [];
        let pageToken: string | undefined;

        do {
            const response = await youtube.playlists.list({
                part: ['snippet'],
                mine: true,
                maxResults: 50,
                pageToken,
            });

            for (const item of response.data.items || []) {
                existingPlaylists.push({
                    id: item.id,
                    title: item.snippet?.title,
                });
            }

            pageToken = response.data.nextPageToken || undefined;
        } while (pageToken);

        const byNormalizedTitle = new Map(
            existingPlaylists
                .filter((playlist) => playlist.id && playlist.title)
                .map((playlist) => [playlist.title!.trim().toLowerCase(), playlist.id!])
        );
        const byId = new Set(
            existingPlaylists
                .map((playlist) => playlist.id)
                .filter((value): value is string => typeof value === 'string' && value.length > 0)
        );

        const resolvedIds: string[] = [];

        for (const requestedValue of requested) {
            if (byId.has(requestedValue)) {
                resolvedIds.push(requestedValue);
                continue;
            }

            const normalizedTitle = requestedValue.toLowerCase();
            const existingId = byNormalizedTitle.get(normalizedTitle);
            if (existingId) {
                resolvedIds.push(existingId);
                continue;
            }

            const createdPlaylist = await youtube.playlists.insert({
                part: ['snippet', 'status'],
                requestBody: {
                    snippet: {
                        title: requestedValue,
                    },
                    status: {
                        privacyStatus: 'public',
                    },
                },
            });

            const createdId = createdPlaylist.data.id;
            if (createdId) {
                resolvedIds.push(createdId);
                byId.add(createdId);
                byNormalizedTitle.set(normalizedTitle, createdId);
            }
        }

        return Array.from(new Set(resolvedIds));
    },

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
            playlistIds?: string[];
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

            if (videoId && metadata.playlistIds?.length) {
                try {
                    const playlistIds = await this.resolvePlaylistIds(youtube, metadata.playlistIds);

                    for (const playlistId of playlistIds) {
                        await youtube.playlistItems.insert({
                            part: ['snippet'],
                            requestBody: {
                                snippet: {
                                    playlistId,
                                    resourceId: {
                                        kind: 'youtube#video',
                                        videoId,
                                    },
                                },
                            },
                        });
                    }
                    console.log(`[YouTube] Added ${videoId} to ${playlistIds.length} playlist(s)`);
                } catch (playlistError: any) {
                    console.warn('[YouTube] Playlist assignment failed:', playlistError?.response?.data || playlistError?.message || playlistError);
                }
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
