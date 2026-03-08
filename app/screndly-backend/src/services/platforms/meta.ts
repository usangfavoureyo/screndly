import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const FACEBOOK_API_VERSION = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;
const GRAPH_VIDEO_BASE_URL = `https://graph-video.facebook.com/${FACEBOOK_API_VERSION}`;
const THREADS_API_VERSION = 'v1.0';
const THREADS_BASE_URL = `https://graph.threads.net/${THREADS_API_VERSION}`;

type MetaPostResult =
    | { success: true; data: { id: string; platform: string } }
    | { success: false; error: string };

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function extractMetaError(error: any): string {
    return (
        error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.response?.data?.error_message
        || error?.message
        || 'Meta API request failed'
    );
}

function getMimeType(filePath: string): string {
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

async function waitForInstagramMediaReady(containerId: string, accessToken: string): Promise<void> {
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const statusResponse = await axios.get(`${BASE_URL}/${containerId}`, {
            params: {
                fields: 'status_code,status',
                access_token: accessToken,
            },
        });

        const status = String(
            statusResponse.data?.status_code
            || statusResponse.data?.status
            || ''
        ).toUpperCase();

        if (!status || status === 'FINISHED' || status === 'PUBLISHED' || status === 'READY') {
            return;
        }

        if (status === 'ERROR' || status === 'EXPIRED' || status === 'FAILED') {
            throw new Error(`Instagram media processing failed with status ${status}`);
        }

        await sleep(5_000);
    }

    throw new Error('Instagram media processing timed out');
}

async function waitForThreadsMediaReady(containerId: string, accessToken: string): Promise<void> {
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const statusResponse = await axios.get(`${THREADS_BASE_URL}/${containerId}`, {
            params: {
                fields: 'status,error_message',
                access_token: accessToken,
            },
        });

        const status = String(statusResponse.data?.status || '').toUpperCase();
        if (!status || status === 'FINISHED' || status === 'PUBLISHED' || status === 'READY') {
            return;
        }

        if (status === 'ERROR' || status === 'EXPIRED' || status === 'FAILED') {
            throw new Error(statusResponse.data?.error_message || `Threads media processing failed with status ${status}`);
        }

        await sleep(5_000);
    }

    throw new Error('Threads media processing timed out');
}

export const metaService = {
    /**
     * Post text/link/image to Facebook Page
     */
    async postToFacebook(
        pageId: string,
        message: string,
        imageUrl: string | null,
        accessToken: string,
        link?: string
    ) {
        try {
            let endpoint = `/${pageId}/feed`;
            const payload: any = {
                message,
                access_token: accessToken,
            };

            if (imageUrl) {
                endpoint = `/${pageId}/photos`;
                payload.url = imageUrl;
                // Facebook photos endpoint uses 'caption' instead of 'message'
                payload.caption = message;
                delete payload.message;
            } else if (link) {
                payload.link = link;
            }

            const response = await axios.post(`${BASE_URL}${endpoint}`, payload);

            return {
                success: true,
                data: {
                    id: response.data.id,
                    platform: 'Facebook'
                }
            };
        } catch (error: any) {
            console.error('[Meta] Facebook Post Error:', error?.response?.data || error);
            return {
                success: false,
                error: extractMetaError(error)
            };
        }
    },

    async postVideoToFacebook(
        pageId: string,
        message: string,
        videoPath: string,
        accessToken: string
    ): Promise<MetaPostResult> {
        try {
            const fileBuffer = await fs.readFile(videoPath);
            const formData = new FormData();
            formData.append('description', message);
            formData.append('access_token', accessToken);
            formData.append(
                'source',
                new Blob([fileBuffer], { type: getMimeType(videoPath) }),
                path.basename(videoPath)
            );

            const response = await fetch(`${GRAPH_VIDEO_BASE_URL}/${pageId}/videos`, {
                method: 'POST',
                body: formData,
            });

            const data: any = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    data?.error?.message
                    || data?.message
                    || `Facebook video upload failed (${response.status})`
                );
            }

            return {
                success: true,
                data: {
                    id: data.id,
                    platform: 'Facebook',
                },
            };
        } catch (error: any) {
            console.error('[Meta] Facebook Video Post Error:', error?.response?.data || error);
            return {
                success: false,
                error: extractMetaError(error),
            };
        }
    },

    /**
     * Exchange short-lived User Access Token for long-lived (60 days)
     */
    async exchangeForLongLivedToken(shortToken: string) {
        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;

        if (!appId || !appSecret) throw new Error('Meta App credentials missing');

        const response = await axios.get(`${BASE_URL}/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: shortToken
            }
        });

        return response.data; // { access_token, token_type, expires_in }
    },

    /**
     * Exchange short-lived Threads User Access Token for long-lived (~60 days)
     */
    async exchangeThreadsForLongLivedToken(shortToken: string) {
        const appSecret = process.env.THREADS_APP_SECRET;

        if (!appSecret) throw new Error('Threads App credentials missing');

        const response = await axios.get('https://graph.threads.net/access_token', {
            params: {
                grant_type: 'th_exchange_token',
                client_secret: appSecret,
                access_token: shortToken
            }
        });

        return response.data; // { access_token, token_type, expires_in }
    },

    /**
     * Refresh long-lived Threads User Access Token
     */
    async refreshThreadsLongLivedToken(accessToken: string) {
        const response = await axios.get('https://graph.threads.net/refresh_access_token', {
            params: {
                grant_type: 'th_refresh_token',
                access_token: accessToken
            }
        });

        return response.data; // { access_token, token_type, expires_in }
    },

    /**
     * Get list of Facebook Pages managed by the user
     */
    async getPages(userAccessToken: string) {
        const response = await axios.get(`${BASE_URL}/me/accounts`, {
            params: {
                access_token: userAccessToken,
                fields: 'id,name,access_token,category,tasks'
            }
        });

        return response.data.data; // Array of { name, id, access_token (Page token), category, tasks[] }
    },

    /**
     * Get Instagram Business Account ID connected to a Facebook Page
     */
    async getInstagramBusinessId(pageId: string, pageAccessToken: string) {
        const response = await axios.get(`${BASE_URL}/${pageId}`, {
            params: {
                fields: 'instagram_business_account',
                access_token: pageAccessToken
            }
        });

        return response.data.instagram_business_account?.id;
    },

    /**
     * Get Threads Profile connected to the User
     */
    async getThreadsProfile(userAccessToken: string) {
        const response = await axios.get(`${THREADS_BASE_URL}/me`, {
            params: {
                fields: 'id,username,name,threads_profile_picture_url,threads_biography,is_verified',
                access_token: userAccessToken
            }
        });

        return response.data; // { id, username, name, threads_profile_picture_url, threads_biography, is_verified }
    },

    /**
     * Post image/carousel to Instagram Business Account
     */
    async postToInstagram(
        igUserId: string,
        caption: string,
        imageUrl: string,
        accessToken: string
    ) {
        try {
            // Step 1: Create Container
            const containerRes = await axios.post(`${BASE_URL}/${igUserId}/media`, {
                image_url: imageUrl,
                caption: caption,
                access_token: accessToken,
            });

            if (!containerRes.data.id) {
                throw new Error('Failed to create Instagram media container');
            }

            const creationId = containerRes.data.id;

            // Step 2: Publish Container
            const publishRes = await axios.post(`${BASE_URL}/${igUserId}/media_publish`, {
                creation_id: creationId,
                access_token: accessToken,
            });

            return {
                success: true,
                data: {
                    id: publishRes.data.id,
                    platform: 'Instagram'
                }
            };
        } catch (error: any) {
            console.error('[Meta] Instagram Post Error:', error?.response?.data || error);
            return {
                success: false,
                error: extractMetaError(error)
            };
        }
    },

    async postVideoToInstagramReel(
        igUserId: string,
        caption: string,
        videoUrl: string,
        accessToken: string
    ): Promise<MetaPostResult> {
        try {
            const containerParams = new URLSearchParams({
                media_type: 'REELS',
                video_url: videoUrl,
                caption,
                share_to_feed: 'true',
                access_token: accessToken,
            });

            const containerRes = await axios.post(
                `${BASE_URL}/${igUserId}/media`,
                containerParams.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            if (!containerRes.data.id) {
                throw new Error('Failed to create Instagram reel media container');
            }

            const creationId = containerRes.data.id;
            await waitForInstagramMediaReady(creationId, accessToken);

            const publishParams = new URLSearchParams({
                creation_id: creationId,
                access_token: accessToken,
            });

            const publishRes = await axios.post(
                `${BASE_URL}/${igUserId}/media_publish`,
                publishParams.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            return {
                success: true,
                data: {
                    id: publishRes.data.id,
                    platform: 'Instagram',
                },
            };
        } catch (error: any) {
            console.error('[Meta] Instagram Reel Post Error:', error?.response?.data || error);
            return {
                success: false,
                error: extractMetaError(error),
            };
        }
    },

    /**
     * Post to Threads
     */
    async postToThreads(
        userId: string,
        text: string,
        imageUrl: string | null,
        accessToken: string
    ) {
        try {
            // Step 1: Create a Threads media container
            const payload = new URLSearchParams({
                media_type: imageUrl ? 'IMAGE' : 'TEXT',
                text: text,
                access_token: accessToken
            });
            if (imageUrl) payload.append('image_url', imageUrl);

            const containerRes = await axios.post(`${THREADS_BASE_URL}/${userId}/threads`, payload.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (!containerRes.data.id) {
                throw new Error('Failed to create Threads media container');
            }
            const creationId = containerRes.data.id;

            // Step 2: Publish the container
            const publishPayload = new URLSearchParams({
                creation_id: creationId,
                access_token: accessToken
            });
            const publishRes = await axios.post(`${THREADS_BASE_URL}/${userId}/threads_publish`, publishPayload.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return {
                success: true,
                data: {
                    id: publishRes.data.id,
                    platform: 'Threads'
                }
            };

        } catch (error: any) {
            console.error('[Meta] Threads Post Error:', error?.response?.data || error);
            return {
                success: false,
                error: extractMetaError(error)
            };
        }
    },

    async postVideoToThreads(
        userId: string,
        text: string,
        videoUrl: string,
        accessToken: string
    ): Promise<MetaPostResult> {
        try {
            const payload = new URLSearchParams({
                media_type: 'VIDEO',
                video_url: videoUrl,
                text,
                access_token: accessToken,
            });

            const containerRes = await axios.post(
                `${THREADS_BASE_URL}/${userId}/threads`,
                payload.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            if (!containerRes.data.id) {
                throw new Error('Failed to create Threads video container');
            }

            const creationId = containerRes.data.id;
            await waitForThreadsMediaReady(creationId, accessToken);

            const publishPayload = new URLSearchParams({
                creation_id: creationId,
                access_token: accessToken,
            });

            const publishRes = await axios.post(
                `${THREADS_BASE_URL}/${userId}/threads_publish`,
                publishPayload.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            return {
                success: true,
                data: {
                    id: publishRes.data.id,
                    platform: 'Threads',
                },
            };
        } catch (error: any) {
            console.error('[Meta] Threads Video Post Error:', error?.response?.data || error);
            return {
                success: false,
                error: extractMetaError(error),
            };
        }
    }
};
