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

export interface MetaCommentItem {
    commentId: string;
    postId: string;
    username: string;
    userId?: string;
    content: string;
    createdAt: Date;
    parentPostCreatedAt?: Date;
}

const THREADS_COMMENT_FIELDS = 'id,text,timestamp,username,root_post,replied_to,is_reply,is_reply_owned_by_me';
const THREADS_POST_FIELDS = 'id,text,timestamp,username,media_type,permalink,has_replies';

const FORM_URL_ENCODED_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
};

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

function buildInstagramProfileUrl(username?: string | null): string | undefined {
    if (!username) return undefined;
    return `https://www.instagram.com/${String(username).replace(/^@/, '')}`;
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

function getImageMimeType(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.gif':
            return 'image/gif';
        default:
            return 'image/jpeg';
    }
}

function normalizeImageSources(imageSources?: string | string[] | null): string[] {
    if (!imageSources) {
        return [];
    }

    const sources = Array.isArray(imageSources) ? imageSources : [imageSources];
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const source of sources) {
        if (typeof source !== 'string') continue;
        const trimmed = source.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        normalized.push(trimmed);
    }

    return normalized;
}

async function createThreadsContainer(userId: string, payload: URLSearchParams): Promise<string> {
    const containerRes = await axios.post(
        `${THREADS_BASE_URL}/${userId}/threads`,
        payload.toString(),
        {
            headers: FORM_URL_ENCODED_HEADERS,
        }
    );

    if (!containerRes.data.id) {
        throw new Error('Failed to create Threads media container');
    }

    return String(containerRes.data.id);
}

async function publishThreadsContainer(
    userId: string,
    creationId: string,
    accessToken: string
): Promise<string> {
    const publishPayload = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken,
    });

    const publishRes = await axios.post(
        `${THREADS_BASE_URL}/${userId}/threads_publish`,
        publishPayload.toString(),
        {
            headers: FORM_URL_ENCODED_HEADERS,
        }
    );

    if (!publishRes.data.id) {
        throw new Error('Failed to publish Threads media container');
    }

    return String(publishRes.data.id);
}

async function uploadUnpublishedFacebookPhoto(
    pageId: string,
    imageUrl: string,
    accessToken: string
): Promise<string> {
    const payload = new URLSearchParams({
        url: imageUrl,
        published: 'false',
        access_token: accessToken,
    });

    const response = await axios.post(
        `${BASE_URL}/${pageId}/photos`,
        payload.toString(),
        {
            headers: FORM_URL_ENCODED_HEADERS,
        }
    );

    if (!response.data?.id) {
        throw new Error('Failed to upload Facebook photo');
    }

    return String(response.data.id);
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
        imageSources: string | string[] | null,
        accessToken: string,
        link?: string
    ) {
        try {
            const imageUrls = normalizeImageSources(imageSources);

            if (imageUrls.length > 1) {
                const photoIds = await Promise.all(
                    imageUrls.map((imageUrl) => uploadUnpublishedFacebookPhoto(pageId, imageUrl, accessToken))
                );

                const feedPayload = new URLSearchParams({
                    message,
                    access_token: accessToken,
                });

                photoIds.forEach((photoId, index) => {
                    feedPayload.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: photoId }));
                });

                const response = await axios.post(
                    `${BASE_URL}/${pageId}/feed`,
                    feedPayload.toString(),
                    {
                        headers: FORM_URL_ENCODED_HEADERS,
                    }
                );

                return {
                    success: true,
                    data: {
                        id: response.data.id,
                        platform: 'Facebook'
                    }
                };
            }

            let endpoint = `/${pageId}/feed`;
            const payload = new URLSearchParams({
                message,
                access_token: accessToken,
            });

            if (imageUrls[0]) {
                endpoint = `/${pageId}/photos`;
                payload.append('url', imageUrls[0]);
                payload.append('caption', message);
                payload.delete('message');
            } else if (link) {
                payload.append('link', link);
            }

            const response = await axios.post(`${BASE_URL}${endpoint}`, payload.toString(), {
                headers: FORM_URL_ENCODED_HEADERS,
            });

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

    async setFacebookVideoThumbnail(
        videoId: string,
        thumbnailPath: string,
        accessToken: string,
        isPreferred = true
    ): Promise<MetaPostResult> {
        try {
            const fileBuffer = await fs.readFile(thumbnailPath);
            const formData = new FormData();
            formData.append('access_token', accessToken);
            formData.append('is_preferred', isPreferred ? 'true' : 'false');
            formData.append(
                'source',
                new Blob([fileBuffer], { type: getImageMimeType(thumbnailPath) }),
                path.basename(thumbnailPath)
            );

            const response = await fetch(`${BASE_URL}/${videoId}/thumbnails`, {
                method: 'POST',
                body: formData,
            });

            const data: any = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    data?.error?.message
                    || data?.message
                    || `Facebook thumbnail upload failed (${response.status})`
                );
            }

            return {
                success: true,
                data: {
                    id: videoId,
                    platform: 'Facebook',
                },
            };
        } catch (error: any) {
            console.error('[Meta] Facebook Video Thumbnail Error:', error?.response?.data || error);
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
                fields: 'id,name,access_token,category,tasks,instagram_business_account'
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

    async getInstagramProfile(igUserId: string, accessToken: string) {
        const response = await axios.get(`${BASE_URL}/${igUserId}`, {
            params: {
                fields: 'username',
                access_token: accessToken
            }
        });

        const username = typeof response.data?.username === 'string' ? response.data.username : undefined;
        return {
            id: typeof response.data?.id === 'string' ? response.data.id : igUserId,
            username,
            profileUrl: buildInstagramProfileUrl(username),
        };
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
        accessToken: string,
        coverUrl?: string
    ): Promise<MetaPostResult> {
        try {
            const containerParams = new URLSearchParams({
                media_type: 'REELS',
                video_url: videoUrl,
                caption,
                share_to_feed: 'true',
                access_token: accessToken,
            });
            if (coverUrl) {
                containerParams.append('cover_url', coverUrl);
            }

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

    async postToInstagramStory(
        igUserId: string,
        mediaUrl: string,
        accessToken: string,
        mediaKind: 'image' | 'video'
    ): Promise<MetaPostResult> {
        try {
            const containerParams = new URLSearchParams({
                media_type: 'STORIES',
                access_token: accessToken,
            });

            if (mediaKind === 'video') {
                containerParams.append('video_url', mediaUrl);
            } else {
                containerParams.append('image_url', mediaUrl);
            }

            const containerRes = await axios.post(
                `${BASE_URL}/${igUserId}/media`,
                containerParams.toString(),
                {
                    headers: FORM_URL_ENCODED_HEADERS,
                }
            );

            if (!containerRes.data.id) {
                throw new Error('Failed to create Instagram story media container');
            }

            const creationId = containerRes.data.id;
            if (mediaKind === 'video') {
                await waitForInstagramMediaReady(creationId, accessToken);
            }

            const publishRes = await axios.post(
                `${BASE_URL}/${igUserId}/media_publish`,
                new URLSearchParams({
                    creation_id: creationId,
                    access_token: accessToken,
                }).toString(),
                {
                    headers: FORM_URL_ENCODED_HEADERS,
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
            console.error('[Meta] Instagram Story Post Error:', error?.response?.data || error);
            return {
                success: false,
                error: extractMetaError(error),
            };
        }
    },

    async postToFacebookStory(
        pageId: string,
        mediaUrl: string,
        accessToken: string,
        mediaKind: 'image' | 'video'
    ): Promise<MetaPostResult> {
        try {
            if (mediaKind === 'video') {
                const startPayload = new URLSearchParams({
                    access_token: accessToken,
                    upload_phase: 'start',
                });

                const startResponse = await axios.post(
                    `${BASE_URL}/${pageId}/video_stories`,
                    startPayload.toString(),
                    {
                        headers: FORM_URL_ENCODED_HEADERS,
                    }
                );

                const videoId = String(startResponse.data?.video_id || '');
                const uploadUrl = String(startResponse.data?.upload_url || '');

                if (!videoId || !uploadUrl) {
                    throw new Error('Failed to initialize Facebook Story video upload');
                }

                const uploadResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `OAuth ${accessToken}`,
                        file_url: mediaUrl,
                    },
                });

                const uploadData: any = await uploadResponse.json().catch(() => ({}));
                if (!uploadResponse.ok) {
                    throw new Error(
                        uploadData?.error?.message
                        || uploadData?.message
                        || `Facebook Story video upload failed (${uploadResponse.status})`
                    );
                }

                const finishPayload = new URLSearchParams({
                    access_token: accessToken,
                    upload_phase: 'finish',
                    video_id: videoId,
                });

                const finishResponse = await axios.post(
                    `${BASE_URL}/${pageId}/video_stories`,
                    finishPayload.toString(),
                    {
                        headers: FORM_URL_ENCODED_HEADERS,
                    }
                );

                return {
                    success: true,
                    data: {
                        id: finishResponse.data.post_id || finishResponse.data.id || videoId,
                        platform: 'Facebook',
                    },
                };
            } else {
                const photoId = await uploadUnpublishedFacebookPhoto(pageId, mediaUrl, accessToken);

                const payload = new URLSearchParams({
                    access_token: accessToken,
                    photo_id: photoId,
                });

                const response = await axios.post(
                    `${BASE_URL}/${pageId}/photo_stories`,
                    payload.toString(),
                    {
                        headers: FORM_URL_ENCODED_HEADERS,
                    }
                );

                return {
                    success: true,
                    data: {
                        id: response.data.post_id || response.data.id || photoId,
                        platform: 'Facebook',
                    },
                };
            }
        } catch (error: any) {
            console.error('[Meta] Facebook Story Post Error:', error?.response?.data || error);
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
        imageSources: string | string[] | null,
        accessToken: string
    ) {
        try {
            const imageUrls = normalizeImageSources(imageSources);

            if (imageUrls.length > 1) {
                const childIds: string[] = [];

                for (const imageUrl of imageUrls) {
                    const childPayload = new URLSearchParams({
                        media_type: 'IMAGE',
                        image_url: imageUrl,
                        is_carousel_item: 'true',
                        access_token: accessToken,
                    });
                    const childId = await createThreadsContainer(userId, childPayload);
                    await waitForThreadsMediaReady(childId, accessToken);
                    childIds.push(childId);
                }

                const carouselPayload = new URLSearchParams({
                    media_type: 'CAROUSEL',
                    children: childIds.join(','),
                    text,
                    access_token: accessToken,
                });

                const carouselCreationId = await createThreadsContainer(userId, carouselPayload);
                await waitForThreadsMediaReady(carouselCreationId, accessToken);
                const publishId = await publishThreadsContainer(userId, carouselCreationId, accessToken);

                return {
                    success: true,
                    data: {
                        id: publishId,
                        platform: 'Threads'
                    }
                };
            }

            const payload = new URLSearchParams({
                media_type: imageUrls[0] ? 'IMAGE' : 'TEXT',
                text,
                access_token: accessToken
            });
            if (imageUrls[0]) payload.append('image_url', imageUrls[0]);

            const creationId = await createThreadsContainer(userId, payload);
            if (imageUrls[0]) {
                await waitForThreadsMediaReady(creationId, accessToken);
            }
            const publishId = await publishThreadsContainer(userId, creationId, accessToken);

            return {
                success: true,
                data: {
                    id: publishId,
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
                    headers: FORM_URL_ENCODED_HEADERS,
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
                    headers: FORM_URL_ENCODED_HEADERS,
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
    },

    async getRecentFacebookComments(
        pageId: string,
        accessToken: string,
        since?: Date
    ): Promise<MetaCommentItem[]> {
        const response = await axios.get(`${BASE_URL}/${pageId}/posts`, {
            params: {
                fields: 'id,message,created_time,comments.limit(50){id,message,created_time,from,parent}',
                limit: 10,
                access_token: accessToken,
            },
        });

        const posts = Array.isArray(response.data?.data) ? response.data.data : [];
        const results: MetaCommentItem[] = [];

        for (const post of posts) {
            const postCreatedAt = post?.created_time ? new Date(post.created_time) : undefined;
            const comments = Array.isArray(post?.comments?.data) ? post.comments.data : [];

            for (const comment of comments) {
                if (comment?.parent?.id) {
                    continue;
                }

                const createdAt = comment?.created_time ? new Date(comment.created_time) : new Date();
                if (since && createdAt < since) {
                    continue;
                }

                if (String(comment?.from?.id || '') === pageId) {
                    continue;
                }

                const content = String(comment?.message || '').trim();
                if (!content) {
                    continue;
                }

                results.push({
                    commentId: String(comment.id),
                    postId: String(post.id),
                    username: String(comment?.from?.name || comment?.from?.id || 'facebook-user'),
                    userId: typeof comment?.from?.id === 'string' ? comment.from.id : undefined,
                    content,
                    createdAt,
                    parentPostCreatedAt: postCreatedAt,
                });
            }
        }

        return results;
    },

    async replyToFacebookComment(
        commentId: string,
        message: string,
        accessToken: string
    ): Promise<MetaPostResult> {
        try {
            const payload = new URLSearchParams({
                message,
                access_token: accessToken,
            });

            const response = await axios.post(
                `${BASE_URL}/${commentId}/comments`,
                payload.toString(),
                {
                    headers: FORM_URL_ENCODED_HEADERS,
                }
            );

            return {
                success: true,
                data: {
                    id: String(response.data?.id || commentId),
                    platform: 'Facebook',
                },
            };
        } catch (error: any) {
            console.error('[Meta] Facebook Comment Reply Error:', error?.response?.data || error);
            return {
                success: false,
                error: extractMetaError(error),
            };
        }
    },

    async getRecentInstagramComments(
        igUserId: string,
        accessToken: string,
        since?: Date
    ): Promise<MetaCommentItem[]> {
        const mediaResponse = await axios.get(`${BASE_URL}/${igUserId}/media`, {
            params: {
                fields: 'id,caption,timestamp',
                limit: 10,
                access_token: accessToken,
            },
        });

        const mediaItems = Array.isArray(mediaResponse.data?.data) ? mediaResponse.data.data : [];
        const comments: MetaCommentItem[] = [];

        for (const media of mediaItems) {
            const postCreatedAt = media?.timestamp ? new Date(media.timestamp) : undefined;
            const commentResponse = await axios.get(`${BASE_URL}/${media.id}/comments`, {
                params: {
                    fields: 'id,text,username,timestamp,parent_id',
                    limit: 50,
                    access_token: accessToken,
                },
            });

            const commentItems = Array.isArray(commentResponse.data?.data) ? commentResponse.data.data : [];
            for (const comment of commentItems) {
                if (comment?.parent_id) {
                    continue;
                }

                const createdAt = comment?.timestamp ? new Date(comment.timestamp) : new Date();
                if (since && createdAt < since) {
                    continue;
                }

                const content = String(comment?.text || '').trim();
                if (!content) {
                    continue;
                }

                comments.push({
                    commentId: String(comment.id),
                    postId: String(media.id),
                    username: String(comment?.username || 'instagram-user'),
                    content,
                    createdAt,
                    parentPostCreatedAt: postCreatedAt,
                });
            }
        }

        return comments;
    },

    async replyToInstagramComment(
        commentId: string,
        message: string,
        accessToken: string
    ): Promise<MetaPostResult> {
        try {
            const payload = new URLSearchParams({
                message,
                access_token: accessToken,
            });

            const response = await axios.post(
                `${BASE_URL}/${commentId}/replies`,
                payload.toString(),
                {
                    headers: FORM_URL_ENCODED_HEADERS,
                }
            );

            return {
                success: true,
                data: {
                    id: String(response.data?.id || commentId),
                    platform: 'Instagram',
                },
            };
        } catch (error: any) {
            console.error('[Meta] Instagram Comment Reply Error:', error?.response?.data || error);
            return {
                success: false,
                error: extractMetaError(error),
            };
        }
    },

    async getRecentThreadsReplies(
        userId: string,
        accessToken: string,
        since?: Date
    ): Promise<MetaCommentItem[]> {
        const postsResponse = await axios.get(`${THREADS_BASE_URL}/${userId}/threads`, {
            params: {
                fields: THREADS_POST_FIELDS,
                limit: 20,
                access_token: accessToken,
            },
        });

        const posts = Array.isArray(postsResponse.data?.data) ? postsResponse.data.data : [];
        const replies: MetaCommentItem[] = [];

        for (const post of posts) {
            const postId = String(post?.id || '');
            if (!postId) {
                continue;
            }

            const postCreatedAt = post?.timestamp ? new Date(post.timestamp) : undefined;

            const repliesResponse = await axios.get(`${THREADS_BASE_URL}/${postId}/replies`, {
                params: {
                    fields: THREADS_COMMENT_FIELDS,
                    reverse: false,
                    access_token: accessToken,
                },
            });

            const items = Array.isArray(repliesResponse.data?.data) ? repliesResponse.data.data : [];
            for (const item of items) {
                const createdAt = item?.timestamp ? new Date(item.timestamp) : new Date();
                if (since && createdAt < since) {
                    continue;
                }

                const content = String(item?.text || '').trim();
                if (!content) {
                    continue;
                }

                if (item?.is_reply_owned_by_me) {
                    continue;
                }

                replies.push({
                    commentId: String(item.id),
                    postId,
                    username: String(item?.username || 'threads-user'),
                    content,
                    createdAt,
                    parentPostCreatedAt: postCreatedAt,
                });
            }
        }

        return replies;
    },

    async replyToThreadsReply(
        userId: string,
        replyThreadId: string,
        text: string,
        accessToken: string
    ): Promise<MetaPostResult> {
        try {
            const payload = new URLSearchParams({
                media_type: 'TEXT',
                text,
                reply_to_id: replyThreadId,
                access_token: accessToken,
            });

            const creationId = await createThreadsContainer(userId, payload);
            const publishId = await publishThreadsContainer(userId, creationId, accessToken);

            return {
                success: true,
                data: {
                    id: publishId,
                    platform: 'Threads',
                },
            };
        } catch (error: any) {
            console.error('[Meta] Threads Reply Error:', error?.response?.data || error);
            return {
                success: false,
                error: extractMetaError(error),
            };
        }
    }
};
