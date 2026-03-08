import { apiClient } from './client';
import {
  ShotstackJobRequest,
  ShotstackJobResponse,
  ShotstackJobStatus,
  ApiResponse,
} from './types';
import {
  ShotstackClip,
  ShotstackConfig,
  ShotstackOutput,
  validateShotstackConfig,
  sanitizeShotstackConfig,
} from '../validation/shotstackSchema';

interface RenderApiData {
  response?: {
    id?: string;
    status?: string;
    url?: string;
  };
  id?: string;
  status?: string;
  url?: string;
}

interface ReviewRenderData {
  movieTitle: string;
  trailerVideoUrl: string;
  voiceoverUrl?: string;
  voiceoverDuration?: number;
  backgroundMusicUrl?: string;
  aspectRatio: ShotstackOutput['aspectRatio'];
  removeLetterbox?: boolean;
  enableAutoframing?: boolean;
  selectedScenes?: Array<{
    startTime: number;
    duration?: number;
  }>;
}

export type { ShotstackClip, ShotstackConfig } from '../validation/shotstackSchema';

function normalizeRenderResponse(data: RenderApiData | undefined): { id: string; status: string; url?: string } {
  const response = data?.response ?? data;
  const id = response?.id;
  const status = response?.status || 'queued';

  if (!id) {
    throw new Error('Shotstack did not return a render id');
  }

  return {
    id,
    status,
    url: response?.url,
  };
}

function statusToProgress(status: string): number {
  switch (status) {
    case 'done':
    case 'completed':
      return 100;
    case 'rendering':
    case 'processing':
      return 70;
    case 'queued':
    case 'submitted':
      return 25;
    case 'fetching':
      return 50;
    case 'failed':
      return 100;
    default:
      return 15;
  }
}

export class ShotstackApi {
  async createJob(request: ShotstackJobRequest): Promise<ApiResponse<ShotstackJobResponse>> {
    const response = await apiClient.post<RenderApiData>('/api/shotstack/render', request);

    if (!response.success) {
      return {
        success: false,
        error: response.error,
      };
    }

    const render = normalizeRenderResponse(response.data);
    return {
      success: true,
      data: {
        jobId: render.id,
        status: render.status as ShotstackJobResponse['status'],
        createdAt: new Date().toISOString(),
      },
    };
  }

  async getJobStatus(jobId: string): Promise<ApiResponse<ShotstackJobStatus>> {
    const response = await apiClient.get<RenderApiData>(`/api/shotstack/render/${jobId}`);

    if (!response.success) {
      return {
        success: false,
        error: response.error,
      };
    }

    const render = normalizeRenderResponse(response.data);
    return {
      success: true,
      data: {
        jobId: render.id,
        status: render.status as ShotstackJobStatus['status'],
        progress: statusToProgress(render.status),
        outputUrl: render.url,
      },
    };
  }

  async createPreviewJob(request: ShotstackJobRequest): Promise<ApiResponse<ShotstackJobResponse>> {
    return this.createJob(request);
  }

  async cancelJob(_jobId: string): Promise<ApiResponse<void>> {
    return {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Shotstack cancel is not implemented',
        statusCode: 501,
      },
    };
  }

  async pollJobStatus(
    jobId: string,
    onProgress?: (status: ShotstackJobStatus) => void,
    intervalMs: number = 5000,
    maxAttempts: number = 60
  ): Promise<ApiResponse<ShotstackJobStatus>> {
    let attempts = 0;

    const poll = async (): Promise<ApiResponse<ShotstackJobStatus>> => {
      const response = await this.getJobStatus(jobId);
      if (!response.success || !response.data) {
        return response;
      }

      onProgress?.(response.data);

      if (['completed', 'done', 'failed'].includes(response.data.status)) {
        return response;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Shotstack render timed out',
            statusCode: 408,
          },
        };
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
      return poll();
    };

    return poll();
  }

  validateJobRequest(request: ShotstackJobRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.prompt?.trim()) {
      errors.push('Prompt is required');
    }

    if (!request.aspectRatio) {
      errors.push('Aspect ratio is required');
    }

    if (!request.duration || request.duration <= 0) {
      errors.push('Duration must be greater than 0');
    }

    if (!request.segments?.length) {
      errors.push('At least one segment is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  estimateCost(request: ShotstackJobRequest): {
    estimatedCost: number;
    currency: string;
    breakdown: {
      baseCost: number;
      durationCost: number;
      qualityCost: number;
    };
  } {
    const baseCost = 0.5;
    const costPerSecond = 0.05;
    const qualityMultiplier = request.aspectRatio === '16:9' ? 1 : 1.2;
    const durationCost = request.duration * costPerSecond;
    const qualityCost = durationCost * (qualityMultiplier - 1);
    const estimatedCost = Math.round((baseCost + durationCost + qualityCost) * 100) / 100;

    return {
      estimatedCost,
      currency: 'USD',
      breakdown: {
        baseCost,
        durationCost,
        qualityCost,
      },
    };
  }
}

export const shotstackApi = new ShotstackApi();

export function generateShotstackJSON(
  reviewData: ReviewRenderData,
  trailerAnalysis: any,
  audioSettings: {
    trailerVolume?: number;
    backgroundMusicVolume?: number;
    crossfadeDuration?: number;
  }
): ShotstackConfig {
  const fallbackScenes = [
    trailerAnalysis?.suggestedHooks?.opening,
    trailerAnalysis?.suggestedHooks?.midVideo,
    trailerAnalysis?.suggestedHooks?.ending,
  ].filter(Boolean);

  const selectedScenes = (reviewData.selectedScenes && reviewData.selectedScenes.length > 0
    ? reviewData.selectedScenes
    : fallbackScenes
  ).slice(0, 3);

  const clipLength = selectedScenes.length > 0 && reviewData.voiceoverDuration
    ? Math.max(2.5, reviewData.voiceoverDuration / selectedScenes.length)
    : 4;

  const fitMode: ShotstackClip['fit'] = reviewData.removeLetterbox && reviewData.aspectRatio !== '16:9'
    ? 'cover'
    : 'contain';

  const videoClips: ShotstackClip[] = selectedScenes.map((scene, index) => ({
    asset: {
      type: 'video',
      src: reviewData.trailerVideoUrl,
      trim: scene.startTime,
      volume: (audioSettings.trailerVolume ?? 100) / 100,
    },
    start: index * clipLength,
    length: Math.max(2, Math.min(scene.duration ?? clipLength, clipLength)),
    fit: fitMode,
    transition: {
      in: index === 0 ? undefined : 'fadeIn',
      out: 'fadeOut',
      duration: audioSettings.crossfadeDuration ?? 0.5,
    },
  }));

  const tracks = [{ clips: videoClips }];

  if (reviewData.voiceoverUrl && reviewData.voiceoverDuration) {
    tracks.push({
      clips: [{
        asset: {
          type: 'audio',
          src: reviewData.voiceoverUrl,
          volume: 1,
        },
        start: 0,
        length: reviewData.voiceoverDuration,
        transition: {
          in: 'fadeIn',
          out: 'fadeOut',
          duration: 1,
        },
      }],
    });
  }

  const config: ShotstackConfig = {
    timeline: {
      tracks,
      soundtrack: reviewData.backgroundMusicUrl ? {
        src: reviewData.backgroundMusicUrl,
        effect: 'fadeInFadeOut',
        volume: (audioSettings.backgroundMusicVolume ?? 85) / 100,
      } : undefined,
      background: '#000000',
      cache: true,
    },
    output: {
      format: 'mp4',
      resolution: 'hd',
      aspectRatio: reviewData.aspectRatio,
      fps: 30,
      quality: 'high',
    },
  };

  const validation = validateShotstackConfig(config);
  return validation.valid ? config : sanitizeShotstackConfig(config);
}

export function generateAudioChoreography(settings: any): any {
  return {
    ducking: {
      enabled: settings.duckingEnabled ?? true,
      reduction: settings.duckingReduction ?? 50,
    },
    transitions: {
      fadeIn: 1,
      fadeOut: 1,
    },
  };
}

export async function renderVideo(config: ShotstackConfig): Promise<{ id: string; status: string; url?: string }> {
  const sanitizedConfig = sanitizeShotstackConfig(config);
  const response = await apiClient.post<RenderApiData>('/api/shotstack/render', sanitizedConfig);

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to start Shotstack render');
  }

  return normalizeRenderResponse(response.data);
}

export async function getRenderStatus(renderId: string): Promise<{ id: string; status: string; progress: number; url?: string }> {
  const response = await apiClient.get<RenderApiData>(`/api/shotstack/render/${renderId}`);

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to fetch Shotstack render status');
  }

  const render = normalizeRenderResponse(response.data);
  return {
    ...render,
    progress: statusToProgress(render.status),
  };
}
