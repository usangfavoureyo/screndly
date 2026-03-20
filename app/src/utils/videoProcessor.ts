/**
 * Video Processing and Validation Utilities
 * 
 * Handles:
 * - Video format validation
 * - Aspect ratio checking
 * - Duration validation
 * - File size limits
 * - Transcode recommendations
 */

import { META_VIDEO_REQUIREMENTS } from '../adapters/metaAdapter';
import { captureVideoFrame, extractVideoMetadata } from './videoMetadata';

export type PlatformType = 'instagram_feed' | 'instagram_reels' | 'facebook';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations?: string[];
}

interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  aspectRatio: number;
  fileSize: number; // bytes
  format: string;
  codec: string | null;
  frameRate: number | null;
  bitrate: number | null;
}

class VideoProcessor {
  /**
   * Validate video against platform requirements
   */
  async validateVideo(videoUrl: string, platform: PlatformType): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      const metadata = await this.getVideoMetadata(videoUrl);
      const requirements = this.getRequirements(platform);

      // Check duration
      if (metadata.duration < requirements.minDuration) {
        errors.push(`Video too short. Minimum: ${requirements.minDuration}s, actual: ${metadata.duration}s`);
      }
      if (metadata.duration > requirements.maxDuration) {
        errors.push(`Video too long. Maximum: ${requirements.maxDuration}s, actual: ${metadata.duration}s`);
      }

      // Check file size
      if (metadata.fileSize > requirements.maxSize) {
        errors.push(`File too large. Maximum: ${this.formatBytes(requirements.maxSize)}, actual: ${this.formatBytes(metadata.fileSize)}`);
      }

      // Check aspect ratio
      if (requirements.aspectRatio) {
        const { min, max } = requirements.aspectRatio;
        if (metadata.aspectRatio < min || metadata.aspectRatio > max) {
          if (platform === 'instagram_reels') {
            warnings.push(`Aspect ratio ${metadata.aspectRatio.toFixed(2)} is outside recommended range. For Reels, 9:16 (0.56) is optimal.`);
            recommendations.push('Consider cropping video to 9:16 aspect ratio for best Reels performance');
          } else {
            errors.push(`Aspect ratio ${metadata.aspectRatio.toFixed(2)} not supported. Range: ${min.toFixed(2)} - ${max.toFixed(2)}`);
          }
        }
      }

      // Check format
      if (!requirements.formats.includes(metadata.format.toUpperCase())) {
        errors.push(`Format ${metadata.format} not supported. Supported formats: ${requirements.formats.join(', ')}`);
        recommendations.push(`Transcode to ${requirements.formats[0]}`);
      }

      // Check codec
      if (metadata.codec && !requirements.codecs.includes(metadata.codec)) {
        warnings.push(`Codec ${metadata.codec} may not be optimal. Recommended: ${requirements.codecs.join(', ')}`);
        recommendations.push(`Re-encode with ${requirements.codecs[0]} codec`);
      } else if (!metadata.codec) {
        warnings.push(`Codec could not be verified in-browser. Recommended: ${requirements.codecs.join(', ')}`);
      }

      // Check frame rate for Reels
      if (platform === 'instagram_reels' && requirements.frameRate && metadata.frameRate) {
        const { min, max } = requirements.frameRate;
        if (metadata.frameRate < min || metadata.frameRate > max) {
          warnings.push(`Frame rate ${metadata.frameRate} fps is outside recommended range (${min}-${max} fps)`);
        }
      } else if (platform === 'instagram_reels' && requirements.frameRate && !metadata.frameRate) {
        warnings.push(`Frame rate could not be verified in-browser. Recommended range: ${requirements.frameRate.min}-${requirements.frameRate.max} fps`);
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
   * Get video metadata from the actual client-side video asset.
   */
  private async getVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
    const metadata = await extractVideoMetadata(videoUrl);
    return {
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      aspectRatio: metadata.aspectRatioValue,
      fileSize: metadata.fileSize,
      format: metadata.format,
      codec: metadata.codec,
      frameRate: metadata.frameRate,
      bitrate: metadata.bitrate,
    };
  }

  /**
   * Get requirements for platform
   */
  private getRequirements(platform: PlatformType): any {
    switch (platform) {
      case 'instagram_feed':
        return META_VIDEO_REQUIREMENTS.instagram.feed;
      case 'instagram_reels':
        return META_VIDEO_REQUIREMENTS.instagram.reels;
      case 'facebook':
        return META_VIDEO_REQUIREMENTS.facebook;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  /**
   * Generate thumbnail from video at specific timestamp
   * Uses Sharp for image processing
   */
  async generateThumbnail(
    videoUrl: string,
    timestampMs: number = 0
  ): Promise<string> {
    return captureVideoFrame(videoUrl, timestampMs);
  }

  /**
   * Create composite thumbnail with TMDb image overlay
   * This can be used as YouTube thumbnail or Instagram/Facebook cover
   */
  async createCompositeThumbnail(
    tmdbImageUrl: string,
    _options?: {
      width?: number;
      height?: number;
      overlay?: string; // Additional overlay text
      watermark?: string; // Watermark image URL
    }
  ): Promise<string> {
    return tmdbImageUrl;
  }

  /**
   * Transcode video to meet platform requirements
   * In production, use ffmpeg
   */
  async transcodeVideo(
    _videoUrl: string,
    platform: PlatformType,
    options?: {
      targetBitrate?: number;
      targetAspectRatio?: string; // e.g., "9:16"
      targetResolution?: string; // e.g., "1080x1920"
    }
  ): Promise<string> {
    console.log(`[VideoProcessor] Transcoding requested for ${platform}`, options);
    throw new Error('Client-side video transcoding is not implemented. Use the backend media pipeline.');
  }

  /**
   * Check if video needs transcoding
   */
  async needsTranscoding(videoUrl: string, platform: PlatformType): Promise<boolean> {
    const validation = await this.validateVideo(videoUrl, platform);
    return validation.errors.length > 0 || (validation.recommendations?.length ?? 0) > 0;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export const videoProcessor = new VideoProcessor();

/**
 * PRODUCTION IMPLEMENTATION NOTES:
 * 
 * Video Metadata Extraction:
 * - Use ffprobe to get accurate video metadata
 * - Example: ffprobe -v quiet -print_format json -show_format -show_streams video.mp4
 * 
 * Transcoding with ffmpeg:
 * - Instagram Feed (Square): ffmpeg -i input.mp4 -vf "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset slow -crf 22 output.mp4
 * - Instagram Reels (9:16): ffmpeg -i input.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset slow -crf 22 output.mp4
 * - Facebook: ffmpeg -i input.mp4 -c:v libx264 -preset slow -crf 22 -c:a aac -b:a 128k output.mp4
 * 
 * Thumbnail Generation with Sharp:
 * ```javascript
 * import sharp from 'sharp';
 * 
 * const thumbnail = await sharp(tmdbImage)
 *   .resize(1280, 720, { fit: 'cover' })
 *   .composite([{
 *     input: Buffer.from(`<svg>...</svg>`), // Overlay text
 *     top: 50,
 *     left: 50
 *   }])
 *   .jpeg({ quality: 90 })
 *   .toBuffer();
 * ```
 * 
 * CDN Upload:
 * - Upload processed videos/thumbnails to CDN (e.g., AWS S3, Cloudflare R2)
 * - Return CDN URLs for Meta API consumption
 * - Set appropriate cache headers
 */
