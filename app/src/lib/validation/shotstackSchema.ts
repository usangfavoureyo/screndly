/**
 * Shotstack JSON Schema Validation
 * Enforces proper structure before sending to Shotstack API
 */

export interface ShotstackAsset {
  type: 'video' | 'audio' | 'image' | 'html' | 'luma';
  src: string;
  trim?: number;
  volume?: number;
  html?: string;
  css?: string;
}

export interface ShotstackTransition {
  in?: 'fade' | 'fadeIn' | 'fadeOut' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' | 'carouselLeft' | 'carouselRight' | 'carouselUp' | 'carouselDown' | 'zoom';
  out?: 'fade' | 'fadeIn' | 'fadeOut' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' | 'carouselLeft' | 'carouselRight' | 'carouselUp' | 'carouselDown' | 'zoom';
  duration?: number;
}

export interface ShotstackOffset {
  x?: number;
  y?: number;
}

export interface ShotstackClip {
  asset: ShotstackAsset;
  start: number;
  length: number;
  fit?: 'cover' | 'contain' | 'crop' | 'none';
  scale?: number;
  position?: 'top' | 'topRight' | 'right' | 'bottomRight' | 'bottom' | 'bottomLeft' | 'left' | 'topLeft' | 'center';
  offset?: ShotstackOffset;
  transition?: ShotstackTransition;
  effect?: 'zoomIn' | 'zoomOut' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown';
  opacity?: number;
}

export interface ShotstackTrack {
  clips: ShotstackClip[];
}

export interface ShotstackSoundtrack {
  src: string;
  effect?: 'fadeIn' | 'fadeOut' | 'fadeInFadeOut';
  volume?: number;
}

export interface ShotstackTimeline {
  tracks: ShotstackTrack[];
  soundtrack?: ShotstackSoundtrack;
  background?: string;
  cache?: boolean;
}

export interface ShotstackOutput {
  format: 'mp4' | 'gif' | 'mp3';
  resolution?: 'preview' | 'mobile' | 'sd' | 'hd' | '1080' | '4k';
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '4:3';
  fps?: 24 | 25 | 30;
  quality?: 'low' | 'medium' | 'high';
}

export interface ShotstackConfig {
  timeline: ShotstackTimeline;
  output: ShotstackOutput;
  merge?: Array<{
    find: string;
    replace: string;
  }>;
}

/**
 * Validate Shotstack configuration
 */
export function validateShotstackConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check top-level structure
  if (!config) {
    errors.push('Config is null or undefined');
    return { valid: false, errors };
  }

  if (!config.timeline) {
    errors.push('Missing required field: timeline');
  }

  if (!config.output) {
    errors.push('Missing required field: output');
  }

  // Validate timeline
  if (config.timeline) {
    if (!Array.isArray(config.timeline.tracks)) {
      errors.push('timeline.tracks must be an array');
    } else if (config.timeline.tracks.length === 0) {
      errors.push('timeline.tracks cannot be empty');
    } else {
      // Validate each track
      config.timeline.tracks.forEach((track: any, trackIndex: number) => {
        if (!Array.isArray(track.clips)) {
          errors.push(`Track ${trackIndex}: clips must be an array`);
        } else {
          // Validate each clip
          track.clips.forEach((clip: any, clipIndex: number) => {
            if (!clip.asset) {
              errors.push(`Track ${trackIndex}, Clip ${clipIndex}: missing asset`);
            } else {
              if (!clip.asset.type) {
                errors.push(`Track ${trackIndex}, Clip ${clipIndex}: asset.type is required`);
              }
              if (!clip.asset.src && clip.asset.type !== 'html') {
                errors.push(`Track ${trackIndex}, Clip ${clipIndex}: asset.src is required`);
              }
            }

            if (typeof clip.start !== 'number') {
              errors.push(`Track ${trackIndex}, Clip ${clipIndex}: start must be a number`);
            }

            if (typeof clip.length !== 'number' || clip.length <= 0) {
              errors.push(`Track ${trackIndex}, Clip ${clipIndex}: length must be a positive number`);
            }

            // Validate fit mode
            if (clip.fit && !['cover', 'contain', 'crop', 'none'].includes(clip.fit)) {
              errors.push(`Track ${trackIndex}, Clip ${clipIndex}: invalid fit mode "${clip.fit}"`);
            }

            // Validate position
            if (clip.position && !['top', 'topRight', 'right', 'bottomRight', 'bottom', 'bottomLeft', 'left', 'topLeft', 'center'].includes(clip.position)) {
              errors.push(`Track ${trackIndex}, Clip ${clipIndex}: invalid position "${clip.position}"`);
            }

            // Validate offset
            if (clip.offset) {
              if (clip.offset.x !== undefined && (typeof clip.offset.x !== 'number' || clip.offset.x < -1 || clip.offset.x > 1)) {
                errors.push(`Track ${trackIndex}, Clip ${clipIndex}: offset.x must be between -1 and 1`);
              }
              if (clip.offset.y !== undefined && (typeof clip.offset.y !== 'number' || clip.offset.y < -1 || clip.offset.y > 1)) {
                errors.push(`Track ${trackIndex}, Clip ${clipIndex}: offset.y must be between -1 and 1`);
              }
            }
          });
        }
      });
    }
  }

  // Validate output
  if (config.output) {
    if (!config.output.format) {
      errors.push('output.format is required');
    } else if (!['mp4', 'gif', 'mp3'].includes(config.output.format)) {
      errors.push(`Invalid output.format: "${config.output.format}"`);
    }

    if (!config.output.aspectRatio) {
      errors.push('output.aspectRatio is required');
    } else if (!['16:9', '9:16', '1:1', '4:5', '4:3'].includes(config.output.aspectRatio)) {
      errors.push(`Invalid output.aspectRatio: "${config.output.aspectRatio}"`);
    }

    if (config.output.resolution && !['preview', 'mobile', 'sd', 'hd', '1080', '4k'].includes(config.output.resolution)) {
      errors.push(`Invalid output.resolution: "${config.output.resolution}"`);
    }

    if (config.output.quality && !['low', 'medium', 'high'].includes(config.output.quality)) {
      errors.push(`Invalid output.quality: "${config.output.quality}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize and fix common issues in Shotstack config
 */
export function sanitizeShotstackConfig(config: ShotstackConfig): ShotstackConfig {
  const sanitized = JSON.parse(JSON.stringify(config));

  // Ensure all clip times are valid numbers
  sanitized.timeline.tracks.forEach((track: ShotstackTrack) => {
    track.clips.forEach((clip: ShotstackClip) => {
      // Round to 3 decimal places
      clip.start = Math.max(0, Number(clip.start.toFixed(3)));
      clip.length = Math.max(0.1, Number(clip.length.toFixed(3)));

      // Ensure volume is in range
      if (clip.asset.volume !== undefined) {
        clip.asset.volume = Math.max(0, Math.min(1, clip.asset.volume));
      }

      // Ensure offset is in range
      if (clip.offset) {
        if (clip.offset.x !== undefined) {
          clip.offset.x = Math.max(-1, Math.min(1, clip.offset.x));
        }
        if (clip.offset.y !== undefined) {
          clip.offset.y = Math.max(-1, Math.min(1, clip.offset.y));
        }
      }
    });
  });

  // Ensure soundtrack volume is in range
  if (sanitized.timeline.soundtrack?.volume !== undefined) {
    sanitized.timeline.soundtrack.volume = Math.max(0, Math.min(1, sanitized.timeline.soundtrack.volume));
  }

  return sanitized;
}
