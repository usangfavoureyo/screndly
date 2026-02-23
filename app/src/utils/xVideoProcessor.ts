/**
 * X (Twitter) Video Processing and Validation
 * 
 * Handles video validation against X specifications
 */

import { X_VIDEO_REQUIREMENTS, AccountTier } from '../adapters/xAdapter';

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
  aspectRatio: number;
  fileSize: number;
  format: string;
  codec: string;
  frameRate: number;
  bitrate: number;
}

class XVideoProcessor {
  /**
   * Validate video against X requirements for account tier
   */
  async validateVideo(
    video: string | File | Blob,
    tier: AccountTier
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      const metadata = await this.getVideoMetadata(video);
      const requirements = X_VIDEO_REQUIREMENTS[tier];

      // Check duration
      if (metadata.duration > requirements.maxDuration) {
        errors.push(
          `Video too long for ${tier} tier. Maximum: ${requirements.maxDuration}s, actual: ${metadata.duration}s`
        );
        recommendations.push(`Trim video to ${requirements.maxDuration} seconds or upgrade to higher tier`);
      }

      // Check file size
      if (metadata.fileSize > requirements.maxSize) {
        errors.push(
          `File too large. Maximum: ${this.formatBytes(requirements.maxSize)}, actual: ${this.formatBytes(metadata.fileSize)}`
        );
        recommendations.push('Compress video or reduce resolution');
      }

      // Check aspect ratio
      const { min, max } = requirements.aspectRatio;
      if (metadata.aspectRatio < min || metadata.aspectRatio > max) {
        errors.push(
          `Aspect ratio ${metadata.aspectRatio.toFixed(2)} not supported. Range: ${min.toFixed(2)} - ${max.toFixed(2)}`
        );
        recommendations.push('Crop or pad video to supported aspect ratio');
      }

      // Check resolution
      if (
        metadata.width < requirements.minResolution.width ||
        metadata.height < requirements.minResolution.height
      ) {
        errors.push(
          `Resolution too low. Minimum: ${requirements.minResolution.width}x${requirements.minResolution.height}`
        );
      }

      if (
        metadata.width > requirements.maxResolution.width ||
        metadata.height > requirements.maxResolution.height
      ) {
        warnings.push(
          `Resolution exceeds recommended. Maximum: ${requirements.maxResolution.width}x${requirements.maxResolution.height}`
        );
        recommendations.push(`Scale video to ${requirements.maxResolution.width}x${requirements.maxResolution.height}`);
      }

      // Check format
      if (!requirements.formats.includes(metadata.format.toUpperCase())) {
        errors.push(
          `Format ${metadata.format} not supported. Supported formats: ${requirements.formats.join(', ')}`
        );
        recommendations.push(`Convert to ${requirements.formats[0]}`);
      }

      // Check codec
      if (!requirements.codecs.includes(metadata.codec)) {
        warnings.push(
          `Codec ${metadata.codec} may not be optimal. Recommended: ${requirements.codecs.join(', ')}`
        );
        recommendations.push(`Re-encode with ${requirements.codecs[0]} codec`);
      }

      // Check frame rate
      if (metadata.frameRate > requirements.frameRate.max) {
        warnings.push(
          `Frame rate ${metadata.frameRate} fps exceeds maximum of ${requirements.frameRate.max} fps`
        );
        recommendations.push(`Reduce frame rate to ${requirements.frameRate.max} fps`);
      }

      // Check bitrate
      if (metadata.bitrate > requirements.bitrate.max) {
        warnings.push(
          `Bitrate ${this.formatBitrate(metadata.bitrate)} exceeds maximum of ${this.formatBitrate(requirements.bitrate.max)}`
        );
        recommendations.push(`Reduce bitrate to ${this.formatBitrate(requirements.bitrate.max)}`);
      }

      // Tier-specific recommendations
      if (tier === 'free' || tier === 'basic') {
        if (metadata.duration > 60) {
          recommendations.push('Consider upgrading to Pro for videos up to 10 minutes');
        }
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
   * In production, use ffprobe
   */
  private async getVideoMetadata(video: string | File | Blob): Promise<VideoMetadata> {
    // Mock metadata for testing
    // In production, extract actual metadata using ffprobe
    
    let fileSize: number;
    
    if (typeof video === 'string') {
      // For URL, estimate or fetch
      fileSize = 50 * 1024 * 1024; // 50 MB estimate
    } else {
      fileSize = video.size;
    }

    return {
      duration: 120, // 2 minutes
      width: 1920,
      height: 1080,
      aspectRatio: 1920 / 1080, // 16:9
      fileSize,
      format: 'MP4',
      codec: 'H.264',
      frameRate: 30,
      bitrate: 8000000, // 8 Mbps
    };
  }

  /**
   * Get requirements for tier
   */
  getRequirements(tier: AccountTier): any {
    return X_VIDEO_REQUIREMENTS[tier];
  }

  /**
   * Check if video needs transcoding
   */
  async needsTranscoding(
    video: string | File | Blob,
    tier: AccountTier
  ): Promise<boolean> {
    const validation = await this.validateVideo(video, tier);
    return validation.errors.length > 0 || (validation.recommendations?.length ?? 0) > 0;
  }

  /**
   * Generate transcode command for ffmpeg
   */
  generateTranscodeCommand(tier: AccountTier, targetDuration?: number): string {
    const req = X_VIDEO_REQUIREMENTS[tier];
    const duration = targetDuration || req.maxDuration;
    
    return [
      'ffmpeg',
      '-i input.mp4',
      `-t ${duration}`, // Trim to duration
      `-vf "scale=${req.maxResolution.width}:${req.maxResolution.height}:force_original_aspect_ratio=decrease"`,
      '-c:v libx264',
      '-preset slow',
      '-crf 23',
      `-maxrate ${this.formatBitrate(req.bitrate.max)}`,
      '-bufsize 2M',
      `-r ${req.frameRate.max}`, // Frame rate
      '-c:a aac',
      '-b:a 128k',
      '-movflags +faststart', // Web optimization
      'output.mp4',
    ].join(' \\\n  ');
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

  /**
   * Format bitrate
   */
  private formatBitrate(bps: number): string {
    const mbps = bps / 1000000;
    return `${mbps.toFixed(1)} Mbps`;
  }
}

export const xVideoProcessor = new XVideoProcessor();

/**
 * PRODUCTION IMPLEMENTATION NOTES:
 * 
 * Video Metadata Extraction with ffprobe:
 * ```bash
 * ffprobe -v quiet -print_format json -show_format -show_streams video.mp4
 * ```
 * 
 * Transcoding Examples:
 * 
 * 1. Free/Basic Tier (2:20 max):
 * ```bash
 * ffmpeg -i input.mp4 \
 *   -t 140 \
 *   -vf "scale=1920:1200:force_original_aspect_ratio=decrease" \
 *   -c:v libx264 -preset slow -crf 23 \
 *   -maxrate 25M -bufsize 2M \
 *   -r 40 \
 *   -c:a aac -b:a 128k \
 *   -movflags +faststart \
 *   output.mp4
 * ```
 * 
 * 2. Pro/Enterprise Tier (10 min max):
 * ```bash
 * ffmpeg -i input.mp4 \
 *   -t 600 \
 *   -vf "scale=1920:1200:force_original_aspect_ratio=decrease" \
 *   -c:v libx264 -preset slow -crf 23 \
 *   -maxrate 25M -bufsize 2M \
 *   -r 60 \
 *   -c:a aac -b:a 128k \
 *   -movflags +faststart \
 *   output.mp4
 * ```
 * 
 * 3. Optimal Twitter Video Settings:
 * - Aspect ratio: 16:9 or 1:1
 * - Resolution: 1280x720 (720p) or 1920x1080 (1080p)
 * - Frame rate: 30 fps (standard) or 60 fps (Pro+)
 * - Codec: H.264 (High Profile, Level 4.2)
 * - Audio: AAC-LC, 128 kbps
 * - Container: MP4 with faststart flag
 */
