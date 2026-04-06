import axios, { type Method } from 'axios';
import fs from 'fs';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3';

type PlaylistSummary = {
    id: string;
    title: string;
    itemCount?: number;
    privacyStatus?: string;
};

function buildAuthHeaders(accessToken: string, extraHeaders: Record<string, string> = {}) {
    return {
        Authorization: `Bearer ${accessToken}`,
        ...extraHeaders,
    };
}

function inferMimeType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();

    switch (extension) {
        case 'mp4':
        case 'm4v':
            return 'video/mp4';
        case 'mov':
            return 'video/quicktime';
        case 'webm':
            return 'video/webm';
        case 'avi':
            return 'video/x-msvideo';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        default:
            return 'application/octet-stream';
    }
}

async function youtubeRequest<T>(options: {
    accessToken: string;
    method: Method;
    url: string;
    params?: Record<string, string | number | boolean | undefined>;
    data?: unknown;
    headers?: Record<string, string>;
    responseType?: 'json' | 'stream' | 'text';
    maxBodyLength?: number;
    maxContentLength?: number;
}) {
    return axios.request<T>({
        method: options.method,
        url: options.url,
        params: options.params,
        data: options.data,
        responseType: options.responseType,
        headers: buildAuthHeaders(options.accessToken, options.headers),
        maxBodyLength: options.maxBodyLength ?? Infinity,
        maxContentLength: options.maxContentLength ?? Infinity,
    });
}

async function listOwnedPlaylists(accessToken: string): Promise<PlaylistSummary[]> {
    const playlists: PlaylistSummary[] = [];
    let pageToken: string | undefined;

    do {
        const response = await youtubeRequest<{
            items?: Array<{
                id?: string;
                snippet?: { title?: string | null };
                contentDetails?: { itemCount?: number | null };
                status?: { privacyStatus?: string | null };
            }>;
            nextPageToken?: string;
        }>({
            accessToken,
            method: 'GET',
            url: `${YOUTUBE_API_BASE}/playlists`,
            params: {
                part: 'snippet,contentDetails,status',
                mine: true,
                maxResults: 50,
                pageToken,
            },
        });

        for (const item of response.data.items || []) {
            if (!item.id || !item.snippet?.title) {
                continue;
            }

            playlists.push({
                id: item.id,
                title: item.snippet.title,
                itemCount: typeof item.contentDetails?.itemCount === 'number'
                    ? item.contentDetails.itemCount
                    : undefined,
                privacyStatus: item.status?.privacyStatus || undefined,
            });
        }

        pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return playlists;
}

async function startResumableVideoUpload(accessToken: string, videoPath: string, metadata: {
    title: string;
    description: string;
    tags?: string[];
    privacyStatus?: 'private' | 'public' | 'unlisted';
}) {
    const fileSize = fs.statSync(videoPath).size;
    const mimeType = inferMimeType(videoPath);

    const response = await youtubeRequest({
        accessToken,
        method: 'POST',
        url: `${YOUTUBE_UPLOAD_BASE}/videos`,
        params: {
            uploadType: 'resumable',
            part: 'snippet,status',
        },
        data: {
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
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': String(fileSize),
            'X-Upload-Content-Type': mimeType,
        },
    });

    const uploadUrl = response.headers.location;
    if (typeof uploadUrl !== 'string' || uploadUrl.length === 0) {
        throw new Error('YouTube did not return a resumable upload URL.');
    }

    return { uploadUrl, fileSize, mimeType };
}

async function completeResumableVideoUpload(accessToken: string, uploadUrl: string, videoPath: string, fileSize: number, mimeType: string) {
    const response = await youtubeRequest<{
        id?: string;
        snippet?: Record<string, unknown>;
        status?: Record<string, unknown>;
    }>({
        accessToken,
        method: 'PUT',
        url: uploadUrl,
        data: fs.createReadStream(videoPath),
        headers: {
            'Content-Type': mimeType,
            'Content-Length': String(fileSize),
        },
    });

    return response.data;
}

async function uploadThumbnail(accessToken: string, videoId: string, thumbnailPath: string) {
    const fileSize = fs.statSync(thumbnailPath).size;
    const mimeType = inferMimeType(thumbnailPath);

    await youtubeRequest({
        accessToken,
        method: 'POST',
        url: `${YOUTUBE_UPLOAD_BASE}/thumbnails/set`,
        params: {
            videoId,
            uploadType: 'media',
        },
        data: fs.createReadStream(thumbnailPath),
        headers: {
            'Content-Type': mimeType,
            'Content-Length': String(fileSize),
        },
    });
}

async function addVideoToPlaylist(accessToken: string, playlistId: string, videoId: string) {
    await youtubeRequest({
        accessToken,
        method: 'POST',
        url: `${YOUTUBE_API_BASE}/playlistItems`,
        params: {
            part: 'snippet',
        },
        data: {
            snippet: {
                playlistId,
                resourceId: {
                    kind: 'youtube#video',
                    videoId,
                },
            },
        },
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
        },
    });
}

export const youtubeService = {
    async listPlaylists(accessToken: string, _refreshToken?: string) {
        return listOwnedPlaylists(accessToken);
    },

    async resolvePlaylistIds(accessToken: string, playlistNamesOrIds: string[], _refreshToken?: string): Promise<string[]> {
        const requested = playlistNamesOrIds
            .map((value) => value.trim())
            .filter(Boolean);

        if (requested.length === 0) {
            return [];
        }

        const existingPlaylists = await listOwnedPlaylists(accessToken);
        const byNormalizedTitle = new Map(
            existingPlaylists.map((playlist) => [playlist.title.trim().toLowerCase(), playlist.id])
        );
        const byId = new Set(existingPlaylists.map((playlist) => playlist.id));
        const resolvedIds: string[] = [];

        for (const requestedValue of requested) {
            if (byId.has(requestedValue)) {
                resolvedIds.push(requestedValue);
                continue;
            }

            const existingId = byNormalizedTitle.get(requestedValue.toLowerCase());
            if (existingId) {
                resolvedIds.push(existingId);
            }
        }

        return Array.from(new Set(resolvedIds));
    },

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
        _refreshToken?: string
    ) {
        try {
            const { uploadUrl, fileSize, mimeType } = await startResumableVideoUpload(accessToken, videoPath, metadata);
            const uploadResult = await completeResumableVideoUpload(accessToken, uploadUrl, videoPath, fileSize, mimeType);
            const videoId = uploadResult.id;

            if (!videoId) {
                throw new Error('YouTube did not return a video ID after upload.');
            }

            console.log(`[YouTube] Video uploaded: ${videoId}`);

            if (metadata.thumbnailPath) {
                await uploadThumbnail(accessToken, videoId, metadata.thumbnailPath);
                console.log(`[YouTube] Thumbnail set for: ${videoId}`);
            }

            if (metadata.playlistIds?.length) {
                try {
                    const playlistIds = await this.resolvePlaylistIds(accessToken, metadata.playlistIds);

                    for (const playlistId of playlistIds) {
                        await addVideoToPlaylist(accessToken, playlistId, videoId);
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
                    ...uploadResult,
                },
            };
        } catch (error: any) {
            console.error('[YouTube] Upload Error:', error?.response?.data || error.message);
            return {
                success: false,
                error: error?.response?.data?.error?.message || error.message,
            };
        }
    },
};
