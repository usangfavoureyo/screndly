
import { getSecretSetting } from '../lib/settings';
import { env } from '../lib/env';

interface VideoGenerationOptions {
    script: string;
    mediaAssets?: string[]; // URLs or paths
    resolution?: 'sd' | 'hd' | '1080';
}

export class VideoService {

    private getKey = async () => {
        if (env.SHOTSTACK_API_KEY) {
            return env.SHOTSTACK_API_KEY;
        }

        return getSecretSetting('shotstackKey');
    }

    /**
     * Generate a video using Shotstack
     */
    async generateVideo(options: VideoGenerationOptions) {
        const apiKey = await this.getKey();
        if (!apiKey) {
            throw new Error('Shotstack API key not configured');
        }

        console.log('[VideoService] Generating video with options:', options);
        throw new Error('Shotstack video generation is not implemented yet');
    }

    /**
     * Check Render Status
     */
    async getRenderStatus(renderId: string) {
        const apiKey = await this.getKey();
        if (!apiKey) throw new Error('Shotstack API key missing');
        throw new Error(`Shotstack render status lookup is not implemented yet for render ${renderId}`);
    }
}

export const videoService = new VideoService();
