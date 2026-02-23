/**
 * YouTube Video Processing and Validation
 * 
 * Handles video validation against YouTube specifications
 */

import { YOUTUBE_VIDEO_REQUIREMENTS } from '../adapters/youtubeAdapter';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations?: string[];
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  fileSize: number;
  format: string;
  codec: string;
  frameRate: number;
  bitrate: number;
}

class YouTubeVideoProcessor {
  /**
   * Validate video against YouTube requirements
   */
  async validateVideo(video: string | File | Blob): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      const metadata = await this.getVideoMetadata(video);
      const req = YOUTUBE_VIDEO_REQUIREMENTS;

      // Check duration
      if (metadata.duration < req.minDuration) {
        errors.push(
          `Video too short. Minimum: ${req.minDuration}s, actual: ${metadata.duration}s`
        );
      }

      if (metadata.duration > req.maxDuration) {
        errors.push(
          `Video too long. Maximum: ${req.maxDuration / 3600} hours, actual: ${metadata.duration / 3600} hours`
        );
        recommendations.push('Trim video to 12 hours or less (verified accounts only)');
      }

      // Check file size
      if (metadata.fileSize > req.maxSize) {
        errors.push(
          `File too large. Maximum: ${this.formatBytes(req.maxSize)}, actual: ${this.formatBytes(metadata.fileSize)}`
        );
        recommendations.push('Compress video or reduce quality');
      }

      // Check format
      if (!req.formats.includes(metadata.format.toUpperCase())) {
        warnings.push(
          `Format ${metadata.format} may not be optimal. Recommended: ${req.formats.slice(0, 3).join(', ')}`
        );
        recommendations.push('Use MP4, MOV, or WEBM for best compatibility');
      }

      // Check codec
      if (!req.codecs.includes(metadata.codec)) {
        warnings.push(
          `Codec ${metadata.codec} may not be optimal. Recommended: ${req.codecs.join(', ')}`
        );
        recommendations.push('Use H.264 codec for best compatibility');
      }

      // Check resolution
      if (metadata.width > req.maxResolution.width || metadata.height > req.maxResolution.height) {
        warnings.push(
          `Resolution ${metadata.width}x${metadata.height} exceeds maximum ${req.maxResolution.width}x${req.maxResolution.height}`
        );
      }

      // Check frame rate
      if (metadata.frameRate < req.frameRate.min) {
        warnings.push(
          `Frame rate ${metadata.frameRate} fps is below recommended minimum of ${req.frameRate.min} fps`
        );
      }

      if (metadata.frameRate > req.frameRate.max) {
        warnings.push(
          `Frame rate ${metadata.frameRate} fps exceeds maximum of ${req.frameRate.max} fps`
        );
        recommendations.push(`Reduce frame rate to ${req.frameRate.max} fps or less`);
      }

      // YouTube-specific recommendations
      if (metadata.width < req.recommendedResolution.width || metadata.height < req.recommendedResolution.height) {
        recommendations.push('Upload in 1080p (1920x1080) or higher for better quality');
      }

      if (metadata.aspectRatio !== '16:9') {
        recommendations.push('16:9 aspect ratio is standard for YouTube videos');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Failed to validate video: ${error.message}`],
        warnings: [],
      };
    }
  }

  /**
   * Get video metadata
   */
  private async getVideoMetadata(video: string | File | Blob): Promise<VideoMetadata> {
    // Mock metadata for testing
    // In production, use ffprobe or similar
    
    let fileSize: number;
    
    if (typeof video === 'string') {
      fileSize = 100 * 1024 * 1024; // 100 MB estimate
    } else {
      fileSize = video.size;
    }

    return {
      duration: 120, // 2 minutes
      width: 1920,
      height: 1080,
      aspectRatio: '16:9',
      fileSize,
      format: 'MP4',
      codec: 'H.264',
      frameRate: 30,
      bitrate: 8000000, // 8 Mbps
    };
  }

  /**
   * Get optimal settings for YouTube
   */
  getOptimalSettings(): any {
    return {
      format: 'MP4',
      codec: 'H.264',
      resolution: '1920x1080', // 1080p
      frameRate: 30,
      bitrate: '8M',
      audioBitrate: '384k',
      audioCodec: 'AAC',
      aspectRatio: '16:9',
      containerSettings: {
        moov_atom: 'front', // For faster streaming
        faststart: true,
      },
    };
  }

  /**
   * Generate transcode command for ffmpeg
   */
  generateTranscodeCommand(targetQuality: '720p' | '1080p' | '4K' = '1080p'): string {
    const settings: Record<string, any> = {
      '720p': { width: 1280, height: 720, bitrate: '5M' },
      '1080p': { width: 1920, height: 1080, bitrate: '8M' },
      '4K': { width: 3840, height: 2160, bitrate: '35M' },
    };

    const { width, height, bitrate } = settings[targetQuality];
    
    return [
      'ffmpeg',
      '-i input.mp4',
      `-vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2"`,
      '-c:v libx264',
      '-preset slow',
      '-crf 18', // High quality
      `-maxrate ${bitrate}`,
      `-bufsize ${parseInt(bitrate) * 2}M`,
      '-r 30', // 30 fps
      '-pix_fmt yuv420p', // Required for compatibility
      '-c:a aac',
      '-b:a 384k',
      '-ar 48000', // 48 kHz
      '-movflags +faststart', // Enable streaming
      'output.mp4',
    ].join(' \\\n  ');
  }

  /**
   * Get recommended upload settings
   */
  getRecommendedUploadSettings(): {
    [key: string]: {
      resolution: string;
      videoBitrate: string;
      audioBitrate: string;
      description: string;
    };
  } {
    return {
      '8K': {
        resolution: '7680x4320',
        videoBitrate: '80-160 Mbps',
        audioBitrate: '384 kbps',
        description: 'Ultra high definition',
      },
      '4K': {
        resolution: '3840x2160',
        videoBitrate: '35-45 Mbps',
        audioBitrate: '384 kbps',
        description: 'High definition (recommended for trailers)',
      },
      '1440p': {
        resolution: '2560x1440',
        videoBitrate: '16-24 Mbps',
        audioBitrate: '384 kbps',
        description: 'Quad HD',
      },
      '1080p': {
        resolution: '1920x1080',
        videoBitrate: '8-12 Mbps',
        audioBitrate: '384 kbps',
        description: 'Full HD (standard)',
      },
      '720p': {
        resolution: '1280x720',
        videoBitrate: '5-7.5 Mbps',
        audioBitrate: '192 kbps',
        description: 'HD',
      },
      '480p': {
        resolution: '854x480',
        videoBitrate: '2.5-4 Mbps',
        audioBitrate: '128 kbps',
        description: 'SD',
      },
    };
  }

  /**
   * Format bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export const youtubeVideoProcessor = new YouTubeVideoProcessor();

/**
 * OPTIMAL YOUTUBE VIDEO SETTINGS:
 * 
 * Container: MP4
 * Video Codec: H.264 (High Profile)
 * Audio Codec: AAC-LC
 * 
 * Recommended Settings (16:9):
 * 
 * 4K (2160p):
 * - Resolution: 3840x2160
 * - Frame Rate: 24, 25, 30, 48, 50, or 60 fps
 * - Video Bitrate: 35-45 Mbps (SDR) or 44-56 Mbps (HDR)
 * - Audio Bitrate: 384 kbps
 * 
 * 1080p (Full HD):
 * - Resolution: 1920x1080
 * - Frame Rate: 24, 25, 30, 48, 50, or 60 fps
 * - Video Bitrate: 8 Mbps (SDR) or 10 Mbps (HDR)
 * - Audio Bitrate: 384 kbps
 * 
 * 720p (HD):
 * - Resolution: 1280x720
 * - Frame Rate: 24, 25, 30, 48, 50, or 60 fps
 * - Video Bitrate: 5 Mbps (SDR) or 6.5 Mbps (HDR)
 * - Audio Bitrate: 192 kbps
 * 
 * Audio Settings:
 * - Codec: AAC-LC
 * - Channels: Stereo or Stereo + 5.1
 * - Sample Rate: 48 kHz or 96 kHz
 * 
 * ffmpeg Example (1080p):
 * ```bash
 * ffmpeg -i input.mp4 \
 *   -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
 *   -c:v libx264 -preset slow -crf 18 \
 *   -maxrate 8M -bufsize 16M \
 *   -r 30 -pix_fmt yuv420p \
 *   -c:a aac -b:a 384k -ar 48000 \
 *   -movflags +faststart \
 *   output.mp4
 * ```
 * 
 * Reference: https://support.google.com/youtube/answer/1722171
 */
