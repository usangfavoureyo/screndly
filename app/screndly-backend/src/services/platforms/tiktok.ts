import axios from 'axios';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export const tiktokService = {
    /**
     * Post a video to TikTok (Direct Post or server-side init)
     */
    async postVideo(videoUrl: string, title: string, accessToken: string) {
        try {
            // Note: TikTok Direct Post API is complex and often requires compliant file uploads
            // This implementation uses the /post/publish/video/init/ endpoint pattern for reference
            // but usually requires a specific flow.

            // Step 1: Initialize Upload
            const initRes = await axios.post(
                `${TIKTOK_API_BASE}/post/publish/video/init/`,
                {
                    post_info: {
                        title: title,
                        privacy_level: 'PUBLIC_TO_EVERYONE',
                        disable_duet: false,
                        disable_comment: false,
                        disable_stitch: false,
                        video_cover_timestamp_ms: 1000
                    },
                    source_info: {
                        source: 'PULL_FROM_URL',
                        video_url: videoUrl
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Depending on account type, this might be asynchronous or return an ID
            return {
                success: true,
                data: {
                    id: initRes.data.data?.publish_id,
                    platform: 'TikTok',
                    status: 'processing'
                }
            };

        } catch (error: any) {
            console.error('[TikTok] Post Error:', error?.response?.data || error.message);
            return {
                success: false,
                error: error?.response?.data?.error?.message || error.message
            };
        }
    },

    /**
     * Get User Info
     */
    async getUserInfo(accessToken: string) {
        try {
            const response = await axios.get(
                `${TIKTOK_API_BASE}/user/info/`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    },
                    params: {
                        fields: 'open_id,union_id,avatar_url,display_name'
                    }
                }
            );

            return response.data.data;
        } catch (error) {
            console.error('[TikTok] User Info Error:', error);
            return null;
        }
    }
};
