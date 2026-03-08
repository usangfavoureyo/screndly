/**
 * Google Video Intelligence Integration
 * Hybrid approach: Real shot detection + text filtering + client-side audio analysis
 */

import { getCachedAnalysis, cacheAnalysis } from '../cache/videoIntelligenceCache';
import { analyzeAllShots, isMusicOnlyTrailer, hasVoiceoverNarration } from '../audio/clientAudioAnalysis';
import { classifyShot, classifyMusicOnlyShot, classifyVoiceoverShot, ClassifiedShot } from '../analysis/sceneClassification';
import { apiClient } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface VideoMoment {
  type: string;
  startTime: number;
  endTime: number;
  duration?: number;
  description: string;
  confidence: number;
  intensityScore?: number;
  labels?: string[];
  hasDialogue?: boolean;
  hasText?: boolean;
  reason?: string;
  index?: number;
  audioFeatures?: {
    avgVolume: number;
    dynamicRange: number;
    speechProbability: number;
  };
  scores?: {
    action: number;
    dialogue: number;
    suspense: number;
    establishing: number;
    climax: number;
    character_moment: number;
  };
}

export interface TrailerAnalysis {
  moments: VideoMoment[];
  suggestedHooks: {
    opening: VideoMoment;
    midVideo: VideoMoment;
    ending: VideoMoment;
  };
  metadata: {
    duration: number;
    frameRate: number;
    resolution: string;
  };
  totalDuration: number;
  isMusicOnly?: boolean;
  hasVoiceover?: boolean;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export async function analyzeTrailer(videoFile: File): Promise<TrailerAnalysis> {
  // Check if analysis is already cached
  const cachedAnalysis = await getCachedAnalysis(videoFile);
  if (cachedAnalysis) {
    console.log('✅ Using cached trailer analysis');
    return cachedAnalysis;
  }
  
  console.log('🎬 Starting hybrid trailer analysis...');
  
  // Step 1: Shot detection + text detection (Google Video Intelligence)
  console.log('  📹 Detecting shots and text overlays...');
  const rawShots = await detectShotsAndText(videoFile);
  
  // Step 2: Client-side audio analysis (Web Audio API)
  console.log('  🎵 Analyzing audio features...');
  const audioFeatures = await analyzeAllShots(videoFile, rawShots);
  
  // Step 3: Detect special cases
  const musicOnly = isMusicOnlyTrailer(audioFeatures);
  const voiceover = hasVoiceoverNarration(audioFeatures);
  
  if (musicOnly) {
    console.log('  🎼 Detected music-only trailer');
  }
  if (voiceover) {
    console.log('  🎤 Detected voiceover narration');
  }
  
  // Step 4: Classify shots using weighted scoring
  console.log('  🤖 Classifying scenes...');
  const totalDuration = rawShots[rawShots.length - 1]?.endTime || 150;
  
  const classifiedShots: ClassifiedShot[] = audioFeatures.map((audio, index) => {
    if (musicOnly) {
      return classifyMusicOnlyShot(audio.startTime, audio.endTime, audio, totalDuration);
    } else if (voiceover) {
      return classifyVoiceoverShot(audio.startTime, audio.endTime, audio, totalDuration);
    } else {
      return classifyShot(audio.startTime, audio.endTime, audio, totalDuration);
    }
  });
  
  // Step 5: Convert to VideoMoment format
  const moments: VideoMoment[] = classifiedShots.map((shot, index) => ({
    type: shot.type,
    startTime: shot.startTime,
    endTime: shot.endTime,
    duration: shot.duration,
    description: `${shot.type} scene at ${shot.startTime.toFixed(1)}s`,
    confidence: shot.confidence,
    intensityScore: shot.audioFeatures.avgVolume,
    labels: [shot.type],
    hasDialogue: shot.audioFeatures.speechProbability > 0.6,
    hasText: false, // Already filtered out
    index,
    audioFeatures: shot.audioFeatures,
    scores: shot.scores
  }));
  
  // Step 6: Select hooks with diversity rule
  console.log('  🎯 Selecting optimal hooks...');
  const hooks = selectDiverseHooks(moments, totalDuration);
  
  const analysis: TrailerAnalysis = {
    moments,
    suggestedHooks: hooks,
    metadata: {
      duration: totalDuration,
      frameRate: 24,
      resolution: '1920x1080'
    },
    totalDuration,
    isMusicOnly: musicOnly,
    hasVoiceover: voiceover
  };
  
  // Cache the analysis for future use
  await cacheAnalysis(videoFile, analysis);
  
  console.log(`✅ Analysis complete: ${moments.length} scenes classified`);
  
  return analysis;
}

// ============================================================================
// B-ROLL MOMENT SELECTION
// ============================================================================

/**
 * Selects an appropriate B-roll moment from the trailer analysis
 * @param analysis - The trailer analysis containing all detected moments
 * @param preferredType - Preferred moment type (e.g., 'general', 'character_moment', 'action_peak')
 * @param afterTime - Find moments that occur after this timestamp
 * @returns Start time of the selected B-roll moment
 */
export function getBRollMoment(
  analysis: TrailerAnalysis,
  preferredType: string,
  afterTime: number = 0
): number {
  // Find moments of the preferred type that occur after the specified time
  const matchingMoments = analysis.moments.filter(moment => 
    moment.type === preferredType && moment.startTime > afterTime
  );
  
  // If we found matching moments, return the first one
  if (matchingMoments.length > 0) {
    return matchingMoments[0].startTime;
  }
  
  // Fallback: find any moment after the specified time
  const anyMomentsAfter = analysis.moments.filter(moment => 
    moment.startTime > afterTime
  );
  
  if (anyMomentsAfter.length > 0) {
    return anyMomentsAfter[0].startTime;
  }
  
  // Last resort: return a time slightly after the afterTime parameter
  return afterTime + 1.0;
}

// ============================================================================
// SHOT DETECTION & TEXT FILTERING
// ============================================================================

/**
 * Run Google Video Intelligence shot detection + text detection through the backend.
 */
async function detectShotsAndText(videoFile: File): Promise<Array<{ startTime: number; endTime: number }>> {
  const response = await apiClient.uploadFile<{
    shots: Array<{ startTime: number; endTime: number }>;
    filteredShots?: Array<{ startTime: number; endTime: number }>;
  }>('/api/video-studio/analyze-trailer', videoFile);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Google Video Intelligence analysis failed');
  }

  const shots = response.data.shots || [];
  const filteredShots = response.data.filteredShots && response.data.filteredShots.length > 0
    ? response.data.filteredShots
    : shots;
  
  if (filteredShots.length === 0) {
    throw new Error('Google Video Intelligence returned no usable shots');
  }
  
  const mergedShots = mergeShortShots(filteredShots, 0.4);
  const totalDuration = mergedShots[mergedShots.length - 1]?.endTime
    ?? filteredShots[filteredShots.length - 1]?.endTime
    ?? 0;
  const finalShots = totalDuration > 10
    ? mergedShots.filter(shot => shot.startTime < totalDuration - 10)
    : mergedShots;
  
  console.log(`  📊 Detected ${shots.length} shots → ${filteredShots.length} after text filter → ${finalShots.length} after merging`);
  
  return finalShots.length > 0 ? finalShots : mergedShots;
}

/**
 * Merge shots shorter than threshold with nearest neighbor
 */
function mergeShortShots(
  shots: Array<{ startTime: number; endTime: number }>,
  threshold: number
): Array<{ startTime: number; endTime: number }> {
  if (shots.length === 0) return [];
  
  const merged: Array<{ startTime: number; endTime: number }> = [];
  let i = 0;
  
  while (i < shots.length) {
    const shot = shots[i];
    const duration = shot.endTime - shot.startTime;
    
    if (duration < threshold && i < shots.length - 1) {
      // Merge with next shot
      const nextShot = shots[i + 1];
      merged.push({
        startTime: shot.startTime,
        endTime: nextShot.endTime
      });
      i += 2; // Skip both shots
    } else if (duration < threshold && i > 0 && merged.length > 0) {
      // Merge with previous shot
      const prevShot = merged[merged.length - 1];
      prevShot.endTime = shot.endTime;
      i++;
    } else {
      // Keep as is
      merged.push({ ...shot });
      i++;
    }
  }
  
  return merged;
}

// ============================================================================
// HOOK SELECTION WITH DIVERSITY RULE
// ============================================================================

/**
 * Select opening, mid, and ending hooks with diversity rule
 * Prefer different scene types for each position
 */
function selectDiverseHooks(
  moments: VideoMoment[],
  totalDuration: number
): {
  opening: VideoMoment;
  midVideo: VideoMoment;
  ending: VideoMoment;
} {
  // Opening hook: 5-30s, prefer action, 2.5-5s duration, confidence > 0.65
  const openingCandidates = moments.filter(m => 
    m.startTime >= 5 &&
    m.startTime <= 30 &&
    m.duration! >= 2.5 &&
    m.duration! <= 5.5 &&
    m.confidence >= 0.6
  );
  
  const opening = openingCandidates.find(m => m.type === 'action') ||
                  openingCandidates.find(m => m.type === 'establishing') ||
                  openingCandidates[0] ||
                  moments[0];
  
  // Mid-video hook: 60-100s, prefer dialogue/character, avoid same type as opening
  const midCandidates = moments.filter(m =>
    m.startTime >= 60 &&
    m.startTime <= 100 &&
    m.duration! >= 2.5 &&
    m.duration! <= 5.5 &&
    m.confidence >= 0.6 &&
    m.type !== opening.type // Diversity rule
  );
  
  const midVideo = midCandidates.find(m => m.type === 'dialogue') ||
                   midCandidates.find(m => m.type === 'character_moment') ||
                   midCandidates[0] ||
                   moments[Math.floor(moments.length / 2)];
  
  // Ending hook: 120s+, prefer suspense/climax, avoid same types as opening and mid
  const endingCandidates = moments.filter(m =>
    m.startTime >= 120 &&
    m.duration! >= 2.5 &&
    m.duration! <= 5.5 &&
    m.confidence >= 0.6 &&
    m.type !== opening.type &&
    m.type !== midVideo.type // Diversity rule
  );
  
  const ending = endingCandidates.find(m => m.type === 'suspense') ||
                 endingCandidates.find(m => m.type === 'climax') ||
                 endingCandidates[0] ||
                 moments[moments.length - 1];
  
  // Add reasons for selections
  opening.reason = getReasonForHook(opening, 'opening');
  midVideo.reason = getReasonForHook(midVideo, 'mid');
  ending.reason = getReasonForHook(ending, 'ending');
  
  return { opening, midVideo, ending };
}

/**
 * Generate human-readable reason for hook selection
 */
function getReasonForHook(moment: VideoMoment, position: 'opening' | 'mid' | 'ending'): string {
  const reasons: Record<string, Record<string, string>> = {
    opening: {
      action: 'High-intensity action sequence perfect for grabbing attention',
      establishing: 'Cinematic establishing shot that sets the tone',
      climax: 'Explosive opening that hooks viewers immediately',
      default: 'Strong opening moment with good pacing'
    },
    mid: {
      dialogue: 'Compelling dialogue that builds narrative interest',
      character_moment: 'Character-driven scene that creates emotional connection',
      suspense: 'Tension-building moment that maintains engagement',
      default: 'Well-paced mid-section moment'
    },
    ending: {
      suspense: 'Suspenseful scene that creates anticipation',
      climax: 'Climactic moment that leaves viewers wanting more',
      action: 'Explosive finale that generates excitement',
      default: 'Strong closing moment'
    }
  };
  
  return reasons[position][moment.type] || reasons[position].default;
}

// ============================================================================
// LEGACY MOCK DATA GENERATION (kept for backwards compatibility)
// ============================================================================

function generateMockAnalysis(videoFile: File): TrailerAnalysis {
  // Generate realistic mock moments based on typical trailer structure
  const moments: VideoMoment[] = [];
  const duration = 150; // Assume 2.5 minute trailer
  
  // Generate moments at various timestamps
  // Note: 'title_card' moments contain text overlays and will be filtered out
  const momentTypes = [
    'establishing_shot',
    'action_peak',
    'dramatic_dialogue',
    'character_moment',
    'title_card', // Contains text - will be filtered
    'suspense_moment',
    'general'
  ];
  
  const labelOptions = [
    ['explosion', 'action', 'fire'],
    ['car chase', 'vehicle', 'speed'],
    ['dramatic scene', 'emotion', 'close-up'],
    ['character introduction', 'portrait'],
    ['title reveal', 'text', 'logo'], // Text indicators
    ['dark scene', 'tension', 'mystery'],
    ['wide shot', 'landscape', 'environment']
  ];
  
  // Generate 30-50 moments throughout the trailer
  const numMoments = 35 + Math.floor(Math.random() * 15);
  
  for (let i = 0; i < numMoments; i++) {
    const startTime = (i / numMoments) * duration + Math.random() * 2;
    const momentDuration = 2 + Math.random() * 4;
    const typeIndex = Math.floor(Math.random() * momentTypes.length);
    const momentType = momentTypes[typeIndex];
    
    // Detect if this moment contains text overlays
    const hasText = momentType === 'title_card' || 
                    (labelOptions[typeIndex] && labelOptions[typeIndex].some(label => 
                      label.includes('text') || label.includes('title') || label.includes('logo')
                    ));
    
    moments.push({
      type: momentType,
      startTime,
      endTime: startTime + momentDuration,
      duration: momentDuration,
      description: `${momentType.replace('_', ' ')} at ${startTime.toFixed(1)}s`,
      confidence: 0.7 + Math.random() * 0.3,
      intensityScore: Math.random(),
      labels: labelOptions[typeIndex] || ['general'],
      hasDialogue: Math.random() > 0.5,
      hasText,
      index: i
    });
  }
  
  // Sort by start time
  moments.sort((a, b) => a.startTime - b.startTime);
  
  // Filter out moments with text overlays (title cards, cast names, etc.)
  const momentsWithoutText = moments.filter(m => !m.hasText);
  
  // Select suggested hooks (opening, mid, ending) - excluding text-heavy scenes
  const opening = momentsWithoutText.find(m => m.type === 'action_peak' && m.startTime < 30) || momentsWithoutText[0];
  const midVideo = momentsWithoutText.find(m => m.type === 'dramatic_dialogue' && m.startTime > 60 && m.startTime < 100) || momentsWithoutText[Math.floor(momentsWithoutText.length / 2)];
  const ending = momentsWithoutText.find(m => m.type === 'suspense_moment' && m.startTime > 120) || momentsWithoutText[momentsWithoutText.length - 1];
  
  // Add reasons for AI suggestions
  opening.reason = 'High-intensity action sequence perfect for grabbing attention';
  midVideo.reason = 'Compelling dialogue moment that builds narrative interest';
  ending.reason = 'Suspenseful scene that creates anticipation for the full movie';
  
  // Re-index the filtered moments
  momentsWithoutText.forEach((moment, index) => {
    moment.index = index;
  });
  
  return {
    moments: momentsWithoutText, // Return only moments without text overlays
    suggestedHooks: {
      opening,
      midVideo,
      ending
    },
    metadata: {
      duration,
      frameRate: 24,
      resolution: '1920x1080'
    }
  };
}
