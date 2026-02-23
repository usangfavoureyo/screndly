/**
 * Autoframing - Intelligent video cropping for aspect ratio conversion
 * Uses AI to detect important subjects (faces, action, text) and center them when cropping
 */

import { TrailerAnalysis, VideoMoment } from './googleVideoIntelligence';

export interface AutoframingResult {
  position: 'top' | 'center' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  offset?: {
    x?: number;  // -1.0 to 1.0
    y?: number;  // -1.0 to 1.0
  };
  crop?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

export interface AutoframingSettings {
  enabled: boolean;
  priorityMode: 'faces' | 'action' | 'center' | 'balanced';
  dynamicTracking: boolean; // Track subjects throughout clip
}

/**
 * Calculate optimal framing for a video clip based on content analysis
 * This is a simplified version - in production, you would integrate with:
 * - AWS Rekognition Video (face detection, celebrity recognition)
 * - Google Cloud Video Intelligence (object tracking, shot change detection)
 * - Azure Video Analyzer (face detection, people tracking)
 */
export function calculateAutoframing(
  videoMoment: VideoMoment,
  sourceAspectRatio: '16:9',
  targetAspectRatio: '9:16' | '1:1',
  settings: AutoframingSettings
): AutoframingResult {
  // Default to center position
  let result: AutoframingResult = {
    position: 'center',
    offset: { x: 0, y: 0 }
  };

  // If autoframing is disabled, return center position
  if (!settings.enabled) {
    return result;
  }

  // Analyze video moment type to determine optimal framing
  switch (videoMoment.type) {
    case 'dramatic_dialogue':
    case 'character_moment':
      // Faces are usually in the center-top third
      result = {
        position: 'center',
        offset: { x: 0, y: 0.15 } // Slightly up to favor faces
      };
      break;

    case 'action_sequence':
    case 'suspense_moment':
      // Action often happens in center or lower-center
      if (settings.priorityMode === 'action') {
        result = {
          position: 'center',
          offset: { x: 0, y: -0.1 } // Slightly down to capture ground action
        };
      }
      break;

    case 'establishing_shot':
    case 'location':
      // Wide shots - try to capture the most interesting part
      // Usually center works best
      result = {
        position: 'center',
        offset: { x: 0, y: 0 }
      };
      break;

    case 'close_up':
      // Close-ups typically frame faces well
      result = {
        position: 'center',
        offset: { x: 0, y: 0.2 } // Favor upper portion for faces
      };
      break;

    case 'reaction_shot':
      // Reactions are usually face-focused
      result = {
        position: 'center',
        offset: { x: 0, y: 0.15 }
      };
      break;

    default:
      result = {
        position: 'center',
        offset: { x: 0, y: 0 }
      };
  }

  // Apply priority mode adjustments
  if (settings.priorityMode === 'faces') {
    // Bias toward upper-center for face detection
    result.offset = {
      x: 0,
      y: Math.max((result.offset?.y || 0) + 0.1, -0.3)
    };
  } else if (settings.priorityMode === 'center') {
    // Force center framing
    result.offset = { x: 0, y: 0 };
  }

  return result;
}

/**
 * Get autoframing recommendations for different scene types
 */
export function getAutoframingStrategy(
  trailerAnalysis: TrailerAnalysis,
  targetAspectRatio: '9:16' | '1:1'
): { [sceneType: string]: AutoframingResult } {
  const strategies: { [key: string]: AutoframingResult } = {
    opening_hook: {
      position: 'center',
      offset: { x: 0, y: 0 }
    },
    mid_hook: {
      position: 'center',
      offset: { x: 0, y: 0 }
    },
    ending_hook: {
      position: 'center',
      offset: { x: 0, y: -0.05 }
    },
    b_roll_general: {
      position: 'center',
      offset: { x: 0, y: 0.1 }
    },
    b_roll_character: {
      position: 'center',
      offset: { x: 0, y: 0.15 } // Favor faces
    }
  };

  return strategies;
}

/**
 * Apply autoframing to a video clip configuration
 */
export function applyAutoframing(
  clipConfig: any,
  autoframing: AutoframingResult
): any {
  return {
    ...clipConfig,
    position: autoframing.position,
    offset: autoframing.offset,
    crop: autoframing.crop
  };
}

/**
 * Validate autoframing offset values
 */
export function validateOffset(offset?: { x?: number; y?: number }): { x: number; y: number } {
  return {
    x: Math.max(-1, Math.min(1, offset?.x || 0)),
    y: Math.max(-1, Math.min(1, offset?.y || 0))
  };
}
