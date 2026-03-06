import axios from 'axios';

const FACEBOOK_API_VERSION = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;
const THREADS_API_VERSION = 'v1.0';
const THREADS_BASE_URL = `https://graph.threads.net/${THREADS_API_VERSION}`;

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
                error: error?.response?.data?.error?.message || error.message
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
            params: { access_token: userAccessToken }
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
                error: error?.response?.data?.error?.message || error.message
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
                error: error?.response?.data?.error?.message || error.message
            };
        }
    }
};
