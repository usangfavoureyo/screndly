// ============================================================================
// SHOTSTACK API SERVICE
// ============================================================================
// Handles all Shotstack video generation API interactions

import { apiClient } from './client';
import { 
  ShotstackJobRequest, 
  ShotstackJobResponse, 
  ShotstackJobStatus,
  ApiResponse 
} from './types';

export class ShotstackApi {
  /**
   * Create a new video generation job
   */
  async createJob(request: ShotstackJobRequest): Promise<ApiResponse<ShotstackJobResponse>> {
    // Mock implementation - replace with real Shotstack API
    return new Promise((resolve) => {
      setTimeout(() => {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        resolve({
          success: true,
          data: {
            jobId,
            status: 'queued',
            createdAt: new Date().toISOString(),
            estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
          },
        });
      }, 500);
    });
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ApiResponse<ShotstackJobStatus>> {
    // Mock implementation - simulates job progression
    return new Promise((resolve) => {
      setTimeout(() => {
        const random = Math.random();
        let status: ShotstackJobStatus['status'] = 'processing';
        let progress = Math.floor(random * 100);
        
        if (progress > 95) {
          status = 'completed';
          progress = 100;
        }
        
        resolve({
          success: true,
          data: {
            jobId,
            status,
            progress,
            currentStep: status === 'processing' ? 'Generating video scenes...' : undefined,
            outputUrl: status === 'completed' ? `https://shotstack.io/videos/${jobId}.mp4` : undefined,
            previewUrl: progress > 50 ? `https://shotstack.io/previews/${jobId}.mp4` : undefined,
          },
        });
      }, 500);
    });
  }

  /**
   * Create preview job (15s sample)
   */
  async createPreviewJob(request: ShotstackJobRequest): Promise<ApiResponse<ShotstackJobResponse>> {
    // Create a shortened version for preview
    const previewRequest = {
      ...request,
      duration: Math.min(15, request.duration),
      segments: request.segments.slice(0, 2), // First 2 segments only
    };
    
    return this.createJob(previewRequest);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/shotstack/jobs/${jobId}/cancel`);
  }

  /**
   * Poll job status until completion
   */
  async pollJobStatus(
    jobId: string,
    onProgress?: (status: ShotstackJobStatus) => void,
    intervalMs: number = 5000,
    maxAttempts: number = 60 // 5 minutes with 5s interval
  ): Promise<ApiResponse<ShotstackJobStatus>> {
    let attempts = 0;

    const poll = async (): Promise<ApiResponse<ShotstackJobStatus>> => {
      const response = await this.getJobStatus(jobId);
      
      if (!response.success) {
        return response;
      }

      const status = response.data!;
      
      if (onProgress) {
        onProgress(status);
      }

      // Job completed or failed
      if (status.status === 'completed' || status.status === 'failed') {
        return response;
      }

      // Max attempts reached
      attempts++;
      if (attempts >= maxAttempts) {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Job polling timeout exceeded',
            statusCode: 408,
          },
        };
      }

      // Wait and poll again
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      return poll();
    };

    return poll();
  }

  /**
   * Validate job request
   */
  validateJobRequest(request: ShotstackJobRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate required fields
    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('Prompt is required');
    }

    if (!request.aspectRatio) {
      errors.push('Aspect ratio is required');
    }

    if (!request.duration || request.duration <= 0) {
      errors.push('Duration must be greater than 0');
    }

    if (!request.segments || request.segments.length === 0) {
      errors.push('At least one segment is required');
    }

    // Validate segments
    request.segments?.forEach((segment, index) => {
      if (segment.startTime >= segment.endTime) {
        errors.push(`Segment ${index + 1}: Start time must be before end time`);
      }
      
      if (segment.startTime < 0 || segment.endTime > request.duration) {
        errors.push(`Segment ${index + 1}: Times must be within video duration`);
      }
      
      if (!segment.text || segment.text.trim().length === 0) {
        errors.push(`Segment ${index + 1}: Text is required`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Estimate job cost based on duration and settings
   */
  estimateCost(request: ShotstackJobRequest): {
    estimatedCost: number;
    currency: string;
    breakdown: {
      baseCost: number;
      durationCost: number;
      qualityCost: number;
    };
  } {
    const baseCost = 0.50; // Base cost per job
    const costPerSecond = 0.05; // Cost per second of video
    const qualityMultiplier = request.aspectRatio === '16:9' ? 1.0 : 1.2; // Higher for vertical/square

    const durationCost = request.duration * costPerSecond;
    const qualityCost = durationCost * (qualityMultiplier - 1);
    const totalCost = baseCost + durationCost + qualityCost;

    return {
      estimatedCost: Math.round(totalCost * 100) / 100,
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

// ============================================================================
// SHOTSTACK UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate Shotstack JSON configuration from trailer analysis
 */
export function generateShotstackJSON(reviewData: any, trailerAnalysis: any, audioSettings: any): any {
  // Mock implementation - generates a Shotstack Edit configuration
  return {
    timeline: {
      soundtrack: audioSettings.backgroundMusicUrl ? {
        src: audioSettings.backgroundMusicUrl,
        effect: 'fadeInFadeOut',
        volume: audioSettings.backgroundMusicVolume / 100
      } : undefined,
      tracks: [
        {
          clips: trailerAnalysis.selectedScenes?.map((scene: any, index: number) => ({
            asset: {
              type: 'video',
              src: scene.videoUrl || reviewData.trailerUrl,
              trim: scene.startTime,
              volume: audioSettings.originalAudioVolume / 100
            },
            start: index * 3, // Simple sequential placement
            length: scene.duration || 3,
            transition: {
              in: 'fade',
              out: 'fade'
            }
          })) || []
        }
      ]
    },
    output: {
      format: 'mp4',
      resolution: 'hd'
    }
  };
}

/**
 * Generate audio choreography settings
 */
export function generateAudioChoreography(settings: any): any {
  // Mock implementation
  return {
    ducking: {
      enabled: settings.duckingEnabled || true,
      reduction: settings.duckingReduction || 50
    },
    transitions: {
      fadeIn: 1.0,
      fadeOut: 1.0
    }
  };
}

/**
 * Render video using Shotstack API
 */
export async function renderVideo(config: any): Promise<{ id: string; status: string }> {
  // Mock implementation - simulates API call to Shotstack
  return new Promise((resolve) => {
    setTimeout(() => {
      const renderId = `render_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      resolve({
        id: renderId,
        status: 'queued'
      });
    }, 500);
  });
}
