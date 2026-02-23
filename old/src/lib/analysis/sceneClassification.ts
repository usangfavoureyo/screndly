/**
 * Scene Classification System
 * Uses weighted scoring to classify trailer shots into scene types
 */

import { AudioFeatures } from '../audio/clientAudioAnalysis';

export type SceneType = 
  | 'action'
  | 'dialogue' 
  | 'suspense'
  | 'establishing'
  | 'climax'
  | 'character_moment';

export interface SceneScores {
  action: number;
  dialogue: number;
  suspense: number;
  establishing: number;
  climax: number;
  character_moment: number;
}

export interface ClassifiedShot {
  startTime: number;
  endTime: number;
  duration: number;
  type: SceneType;
  confidence: number;
  scores: SceneScores;
  audioFeatures: AudioFeatures;
}

/**
 * Classification weights (tunable based on user corrections)
 */
export const DEFAULT_WEIGHTS = {
  // Action weights
  action_volume: 0.4,
  action_dynamicRange: 0.4,
  action_antiSpeech: 0.2,
  
  // Dialogue weights
  dialogue_speech: 0.7,
  dialogue_lowDynamicRange: 0.3,
  
  // Suspense weights
  suspense_lowVolume: 0.5,
  suspense_antiSpeech: 0.5,
  
  // Establishing weights
  establishing_position: 0.6,
  establishing_lowDynamicRange: 0.4,
  
  // Climax weights
  climax_volume: 0.5,
  climax_dynamicRange: 0.3,
  climax_position: 0.2,
  
  // Character moment weights
  character_speech: 0.5,
  character_midVolume: 0.3,
  character_position: 0.2
};

/**
 * Classify a shot based on audio features and position in trailer
 */
export function classifyShot(
  startTime: number,
  endTime: number,
  audioFeatures: AudioFeatures,
  totalDuration: number,
  weights = DEFAULT_WEIGHTS
): ClassifiedShot {
  const duration = endTime - startTime;
  const position = startTime / totalDuration; // 0-1
  
  // Compute scores for each scene type
  const scores: SceneScores = {
    action: computeActionScore(audioFeatures, position, weights),
    dialogue: computeDialogueScore(audioFeatures, position, weights),
    suspense: computeSuspenseScore(audioFeatures, position, weights),
    establishing: computeEstablishingScore(audioFeatures, position, weights),
    climax: computeClimaxScore(audioFeatures, position, weights),
    character_moment: computeCharacterScore(audioFeatures, position, weights)
  };
  
  // Find highest scoring type
  const entries = Object.entries(scores) as [SceneType, number][];
  const [type, confidence] = entries.reduce((max, entry) => 
    entry[1] > max[1] ? entry : max
  );
  
  return {
    startTime,
    endTime,
    duration,
    type,
    confidence,
    scores,
    audioFeatures
  };
}

/**
 * Compute action scene score
 * High volume + high dynamic range + low speech
 */
function computeActionScore(
  audio: AudioFeatures,
  position: number,
  weights: typeof DEFAULT_WEIGHTS
): number {
  let score = 0;
  
  score += audio.avgVolume * weights.action_volume;
  score += audio.dynamicRange * weights.action_dynamicRange;
  score += (1 - audio.speechProbability) * weights.action_antiSpeech;
  
  // Normalize to 0-1
  const totalWeight = weights.action_volume + weights.action_dynamicRange + weights.action_antiSpeech;
  score = score / totalWeight;
  
  // Position bias: opening prefers action
  if (position < 0.2) {
    score *= 1.3;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Compute dialogue scene score
 * High speech probability + low dynamic range
 */
function computeDialogueScore(
  audio: AudioFeatures,
  position: number,
  weights: typeof DEFAULT_WEIGHTS
): number {
  let score = 0;
  
  score += audio.speechProbability * weights.dialogue_speech;
  score += (1 - audio.dynamicRange) * weights.dialogue_lowDynamicRange;
  
  // Normalize to 0-1
  const totalWeight = weights.dialogue_speech + weights.dialogue_lowDynamicRange;
  score = score / totalWeight;
  
  // Position bias: middle section prefers dialogue
  if (position >= 0.2 && position <= 0.8) {
    score *= 1.2;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Compute suspense scene score
 * Low volume + low speech
 */
function computeSuspenseScore(
  audio: AudioFeatures,
  position: number,
  weights: typeof DEFAULT_WEIGHTS
): number {
  let score = 0;
  
  score += (1 - audio.avgVolume) * weights.suspense_lowVolume;
  score += (1 - audio.speechProbability) * weights.suspense_antiSpeech;
  
  // Normalize to 0-1
  const totalWeight = weights.suspense_lowVolume + weights.suspense_antiSpeech;
  score = score / totalWeight;
  
  // Position bias: ending prefers suspense
  if (position > 0.7) {
    score *= 1.4;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Compute establishing shot score
 * Low dynamic range + early position
 */
function computeEstablishingScore(
  audio: AudioFeatures,
  position: number,
  weights: typeof DEFAULT_WEIGHTS
): number {
  let score = 0;
  
  // Early position strongly indicates establishing shot
  const positionScore = position < 0.15 ? 1.0 : Math.max(0, 1 - (position - 0.15) * 2);
  score += positionScore * weights.establishing_position;
  
  score += (1 - audio.dynamicRange) * weights.establishing_lowDynamicRange;
  
  // Normalize to 0-1
  const totalWeight = weights.establishing_position + weights.establishing_lowDynamicRange;
  score = score / totalWeight;
  
  return Math.min(score, 1.0);
}

/**
 * Compute climax scene score
 * High volume + high dynamic range + late position
 */
function computeClimaxScore(
  audio: AudioFeatures,
  position: number,
  weights: typeof DEFAULT_WEIGHTS
): number {
  let score = 0;
  
  score += audio.avgVolume * weights.climax_volume;
  score += audio.dynamicRange * weights.climax_dynamicRange;
  
  // Late position strongly indicates climax
  const positionScore = position > 0.8 ? 1.0 : Math.max(0, (position - 0.5) * 2);
  score += positionScore * weights.climax_position;
  
  // Normalize to 0-1
  const totalWeight = weights.climax_volume + weights.climax_dynamicRange + weights.climax_position;
  score = score / totalWeight;
  
  return Math.min(score, 1.0);
}

/**
 * Compute character moment score
 * Moderate speech + moderate volume + middle position
 */
function computeCharacterScore(
  audio: AudioFeatures,
  position: number,
  weights: typeof DEFAULT_WEIGHTS
): number {
  let score = 0;
  
  score += audio.speechProbability * weights.character_speech;
  
  // Prefer moderate volume (not too loud, not too quiet)
  const midVolumeScore = 1 - Math.abs(audio.avgVolume - 0.5) * 2;
  score += midVolumeScore * weights.character_midVolume;
  
  // Middle position indicates character development
  const positionScore = position >= 0.3 && position <= 0.7 ? 1.0 : 0.5;
  score += positionScore * weights.character_position;
  
  // Normalize to 0-1
  const totalWeight = weights.character_speech + weights.character_midVolume + weights.character_position;
  score = score / totalWeight;
  
  return Math.min(score, 1.0);
}

/**
 * Adjust classification for music-only trailers
 * Boost visual-motion signals, ignore speech
 */
export function classifyMusicOnlyShot(
  startTime: number,
  endTime: number,
  audioFeatures: AudioFeatures,
  totalDuration: number
): ClassifiedShot {
  const position = startTime / totalDuration;
  
  // For music-only, use simple position-based heuristics
  let type: SceneType;
  let confidence: number;
  
  if (position < 0.3) {
    type = 'establishing';
    confidence = 0.7;
  } else if (position < 0.7) {
    // Use dynamic range to differentiate action vs. character moment
    if (audioFeatures.dynamicRange > 0.5) {
      type = 'action';
      confidence = 0.65;
    } else {
      type = 'character_moment';
      confidence = 0.6;
    }
  } else {
    type = 'climax';
    confidence = 0.75;
  }
  
  // Create dummy scores
  const scores: SceneScores = {
    action: type === 'action' ? confidence : 0,
    dialogue: 0,
    suspense: type === 'suspense' ? confidence : 0,
    establishing: type === 'establishing' ? confidence : 0,
    climax: type === 'climax' ? confidence : 0,
    character_moment: type === 'character_moment' ? confidence : 0
  };
  
  return {
    startTime,
    endTime,
    duration: endTime - startTime,
    type,
    confidence,
    scores,
    audioFeatures
  };
}

/**
 * Adjust classification for voiceover narration
 * Lower speech weight, boost volume and dynamic range
 */
export function classifyVoiceoverShot(
  startTime: number,
  endTime: number,
  audioFeatures: AudioFeatures,
  totalDuration: number
): ClassifiedShot {
  // Create modified weights for voiceover
  const voiceoverWeights = { ...DEFAULT_WEIGHTS };
  voiceoverWeights.dialogue_speech = 0.3; // Lower speech importance
  voiceoverWeights.action_dynamicRange = 0.6; // Boost dynamic range importance
  
  return classifyShot(startTime, endTime, audioFeatures, totalDuration, voiceoverWeights);
}

/**
 * Get user-friendly label for scene type
 */
export function getSceneTypeLabel(type: SceneType): string {
  const labels: Record<SceneType, string> = {
    action: 'Action',
    dialogue: 'Dialogue',
    suspense: 'Suspense',
    establishing: 'Establishing',
    climax: 'Climax',
    character_moment: 'Character'
  };
  return labels[type];
}

/**
 * Get badge color for scene type (Tailwind classes)
 */
export function getSceneTypeBadgeColor(type: SceneType): string {
  // All scene types use brand red background with white text
  return 'bg-[#ec1e24] text-white';
}
