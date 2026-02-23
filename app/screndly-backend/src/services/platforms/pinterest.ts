// Pinterest Platform Service
// Requires: PINTEREST_APP_ID, PINTEREST_APP_SECRET

interface PinterestPostResult {
    success: boolean;
    pinId?: string;
    pinUrl?: string;
    error?: string;
}

export class PinterestService {
    private appId: string;
    private appSecret: string;
    private baseUrl = 'https://api.pinterest.com/v5';

    constructor() {
        this.appId = process.env.PINTEREST_APP_ID || '';
        this.appSecret = process.env.PINTEREST_APP_SECRET || '';
    }

    // Create a Pin
    async createPin(
        boardId: string,
        title: string,
        description: string,
        imageUrl: string,
        accessToken: string,
        options?: {
            link?: string;
            altText?: string;
        }
    ): Promise<PinterestPostResult> {
        if (!accessToken) {
            return { success: false, error: 'Pinterest access token required' };
        }

        try {
            const response = await fetch(`${this.baseUrl}/pins`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    board_id: boardId,
                    title: title.slice(0, 100),
                    description: description.slice(0, 500),
                    media_source: {
                        source_type: 'image_url',
                        url: imageUrl,
                    },
                    link: options?.link,
                    alt_text: options?.altText || title,
                }),
            });

            const data: any = await response.json();

            if (data.code) {
                return { success: false, error: data.message };
            }

            return {
                success: true,
                pinId: data.id,
                pinUrl: `https://pinterest.com/pin/${data.id}`,
            };
        } catch (error) {
            return { success: false, error: `Pinterest API error: ${error}` };
        }
    }

    // Get user's boards
    async getBoards(accessToken: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/boards`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            return await response.json();
        } catch (error) {
            return { items: [] };
        }
    }

    // Create a board
    async createBoard(name: string, description: string, accessToken: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/boards`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name.slice(0, 50),
                    description: description.slice(0, 500),
                    privacy: 'PUBLIC',
                }),
            });

            return await response.json();
        } catch (error) {
            return { error: `Failed to create board: ${error}` };
        }
    }

    // Get user info
    async getUserInfo(accessToken: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/user_account`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            return await response.json();
        } catch (error) {
            return null;
        }
    }
}

export const pinterestService = new PinterestService();
