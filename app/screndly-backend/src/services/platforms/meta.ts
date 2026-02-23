import axios from 'axios';

const FACEBOOK_API_VERSION = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;

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
            console.error('[Meta] Facebook Post Error:', error?.response?.data || error.message);
            return {
                success: false,
                error: error?.response?.data?.error?.message || error.message
            };
        }
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
            console.error('[Meta] Instagram Post Error:', error?.response?.data || error.message);
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
            // Threads API is similar to Instagram
            // Step 1: Create Media Container
            const payload: any = {
                media_type: imageUrl ? 'IMAGE' : 'TEXT',
                text: text,
                access_token: accessToken
            };

            if (imageUrl) {
                payload.image_url = imageUrl;
            }

            const containerRes = await axios.post(`${BASE_URL}/${userId}/threads`, payload);

            if (!containerRes.data.id) {
                throw new Error('Failed to create Threads media container');
            }
            const creationId = containerRes.data.id;

            // Step 2: Publish
            const publishRes = await axios.post(`${BASE_URL}/${userId}/threads_publish`, {
                creation_id: creationId,
                access_token: accessToken
            });

            return {
                success: true,
                data: {
                    id: publishRes.data.id,
                    platform: 'Threads'
                }
            };

        } catch (error: any) {
            console.error('[Meta] Threads Post Error:', error?.response?.data || error.message);
            return {
                success: false,
                error: error?.response?.data?.error?.message || error.message
            };
        }
    }
};
