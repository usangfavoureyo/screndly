/**
 * TikTok Video Processing and Validation
 * 
 * Handles video validation against TikTok specifications
 */

import { TIKTOK_VIDEO_REQUIREMENTS } from '../adapters/tiktokAdapter';

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

class TikTokVideoProcessor {
  /**
   * Validate video against TikTok requirements
   */
  async validateVideo(video: string | File | Blob): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      const metadata = await this.getVideoMetadata(video);
      const req = TIKTOK_VIDEO_REQUIREMENTS;

      // Check duration
      if (metadata.duration < req.minDuration) {
        errors.push(
          `Video too short. Minimum: ${req.minDuration}s, actual: ${metadata.duration}s`
        );
      }

      if (metadata.duration > req.maxDuration) {
        errors.push(
          `Video too long. Maximum: ${req.maxDuration}s (10 minutes), actual: ${metadata.duration}s`
        );
        recommendations.push('Trim video to 10 minutes or less');
      }

      // Check file size
      if (metadata.fileSize > req.maxSize) {
        errors.push(
          `File too large. Maximum: ${this.formatBytes(req.maxSize)}, actual: ${this.formatBytes(metadata.fileSize)}`
        );
        recommendations.push('Compress video or reduce quality');
      }

      // Check aspect ratio
      if (!req.aspectRatios.includes(metadata.aspectRatio)) {
        warnings.push(
          `Aspect ratio ${metadata.aspectRatio} may not display optimally. Recommended: ${req.aspectRatios.join(', ')}`
        );
        recommendations.push('Use 9:16 (vertical) for best mobile experience');
      }

      // Check resolution
      if (
        metadata.width < req.minResolution.width ||
        metadata.height < req.minResolution.height
      ) {
        errors.push(
          `Resolution too low. Minimum: ${req.minResolution.width}x${req.minResolution.height}`
        );
      }

      if (
        metadata.width > req.maxResolution.width ||
        metadata.height > req.maxResolution.height
      ) {
        warnings.push(
          `Resolution exceeds maximum. Maximum: ${req.maxResolution.width}x${req.maxResolution.height}`
        );
      }

      // Check format
      if (!req.formats.includes(metadata.format.toUpperCase())) {
        errors.push(
          `Format ${metadata.format} not supported. Supported formats: ${req.formats.join(', ')}`
        );
        recommendations.push('Convert to MP4 format');
      }

      // Check codec
      if (!req.codecs.includes(metadata.codec)) {
        warnings.push(
          `Codec ${metadata.codec} may not be optimal. Recommended: ${req.codecs.join(', ')}`
        );
        recommendations.push('Re-encode with H.264 codec');
      }

      // Check frame rate
      if (metadata.frameRate < req.frameRate.min) {
        warnings.push(
          `Frame rate ${metadata.frameRate} fps is below minimum of ${req.frameRate.min} fps`
        );
      }

      if (metadata.frameRate > req.frameRate.max) {
        warnings.push(
          `Frame rate ${metadata.frameRate} fps exceeds maximum of ${req.frameRate.max} fps`
        );
        recommendations.push(`Reduce frame rate to ${req.frameRate.max} fps`);
      }

      // Check bitrate
      if (metadata.bitrate > req.bitrate.max) {
        warnings.push(
          `Bitrate ${this.formatBitrate(metadata.bitrate)} exceeds maximum of ${this.formatBitrate(req.bitrate.max)}`
        );
        recommendations.push(`Reduce bitrate to ${this.formatBitrate(req.bitrate.max)}`);
      }

      // TikTok-specific recommendations
      if (metadata.aspectRatio !== '9:16') {
        recommendations.push('TikTok videos perform best in 9:16 vertical format (1080x1920)');
      }

      if (metadata.duration > 60) {
        recommendations.push('Videos under 60 seconds typically get better engagement');
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
      fileSize = 50 * 1024 * 1024; // 50 MB estimate
    } else {
      fileSize = video.size;
    }

    return {
      duration: 30, // 30 seconds
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      fileSize,
      format: 'MP4',
      codec: 'H.264',
      frameRate: 30,
      bitrate: 8000000, // 8 Mbps
    };
  }

  /**
   * Get optimal settings for TikTok
   */
  getOptimalSettings(): any {
    return {
      format: 'MP4',
      codec: 'H.264',
      resolution: '1080x1920', // 9:16 vertical
      frameRate: 30,
      bitrate: '8M',
      audioBitrate: '128k',
      audioCodec: 'AAC',
      duration: '15-60 seconds recommended',
      aspectRatio: '9:16',
    };
  }

  /**
   * Generate transcode command for ffmpeg
   */
  generateTranscodeCommand(targetDuration?: number): string {
    const req = TIKTOK_VIDEO_REQUIREMENTS;
    const duration = targetDuration || 60;
    
    return [
      'ffmpeg',
      '-i input.mp4',
      `-t ${duration}`, // Trim to duration
      '-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"',
      '-c:v libx264',
      '-profile:v high',
      '-level 4.2',
      '-preset slow',
      '-crf 23',
      '-maxrate 8M',
      '-bufsize 2M',
      '-r 30', // 30 fps
      '-c:a aac',
      '-b:a 128k',
      '-ar 44100',
      '-movflags +faststart',
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

export const tiktokVideoProcessor = new TikTokVideoProcessor();

/**
 * OPTIMAL TIKTOK VIDEO SETTINGS:
 * 
 * Resolution: 1080x1920 (9:16 vertical)
 * Frame Rate: 30 fps
 * Codec: H.264 (High Profile)
 * Audio: AAC, 128 kbps, 44.1 kHz
 * Bitrate: 8-10 Mbps
 * Duration: 15-60 seconds (recommended)
 * Max: 10 minutes
 * 
 * ffmpeg Example:
 * ```bash
 * ffmpeg -i input.mp4 \
 *   -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
 *   -c:v libx264 -profile:v high -level 4.2 \
 *   -preset slow -crf 23 \
 *   -maxrate 8M -bufsize 2M \
 *   -r 30 \
 *   -c:a aac -b:a 128k -ar 44100 \
 *   -movflags +faststart \
 *   output.mp4
 * ```
 */
