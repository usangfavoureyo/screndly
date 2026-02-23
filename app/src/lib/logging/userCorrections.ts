/**
 * User Correction Logging System
 * Tracks when users override AI scene selections
 * Data used for future model training and weight tuning
 */

export interface UserCorrection {
  id: string;
  timestamp: number;
  videoHash: string;
  videoName: string;
  shotIndex: number;
  shotStartTime: number;
  shotEndTime: number;
  aiLabel: string;
  userLabel: string;
  aiConfidence: number;
  audioFeatures: {
    avgVolume: number;
    dynamicRange: number;
    speechProbability: number;
  };
  scores: {
    action: number;
    dialogue: number;
    suspense: number;
    establishing: number;
    climax: number;
    character_moment: number;
  };
}

const CORRECTION_KEY_PREFIX = 'screndly_user_correction_';

/**
 * Log a user correction
 */
export function logUserCorrection(correction: Omit<UserCorrection, 'id' | 'timestamp'>): void {
  try {
    const fullCorrection: UserCorrection = {
      ...correction,
      id: generateCorrectionId(),
      timestamp: Date.now()
    };

    const key = `${CORRECTION_KEY_PREFIX}${fullCorrection.id}`;
    localStorage.setItem(key, JSON.stringify(fullCorrection));

    console.log('📝 Logged user correction:', {
      video: fullCorrection.videoName,
      ai: fullCorrection.aiLabel,
      user: fullCorrection.userLabel
    });
  } catch (error) {
    console.error('Failed to log user correction:', error);
  }
}

/**
 * Get all user corrections
 */
export function getAllCorrections(): UserCorrection[] {
  const keys = Object.keys(localStorage);
  const corrections: UserCorrection[] = [];

  keys.forEach(key => {
    if (key.startsWith(CORRECTION_KEY_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          const correction: UserCorrection = JSON.parse(value);
          corrections.push(correction);
        } catch (_e) {
          // Skip invalid entries
        }
      }
    }
  });

  return corrections.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get correction statistics
 */
export function getCorrectionStats(): {
  totalCorrections: number;
  correctionsByType: Record<string, number>;
  mostCorrectedAiLabel: string | null;
  mostSelectedUserLabel: string | null;
  averageAiConfidenceWhenCorrected: number;
} {
  const corrections = getAllCorrections();

  const correctionsByType: Record<string, number> = {};
  const aiLabelCounts: Record<string, number> = {};
  const userLabelCounts: Record<string, number> = {};
  let totalConfidence = 0;

  corrections.forEach(c => {
    const key = `${c.aiLabel} → ${c.userLabel}`;
    correctionsByType[key] = (correctionsByType[key] || 0) + 1;

    aiLabelCounts[c.aiLabel] = (aiLabelCounts[c.aiLabel] || 0) + 1;
    userLabelCounts[c.userLabel] = (userLabelCounts[c.userLabel] || 0) + 1;

    totalConfidence += c.aiConfidence;
  });

  const mostCorrectedAiLabel = Object.entries(aiLabelCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const mostSelectedUserLabel = Object.entries(userLabelCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const averageAiConfidenceWhenCorrected = corrections.length > 0
    ? totalConfidence / corrections.length
    : 0;

  return {
    totalCorrections: corrections.length,
    correctionsByType,
    mostCorrectedAiLabel,
    mostSelectedUserLabel,
    averageAiConfidenceWhenCorrected
  };
}

/**
 * Export corrections as JSON for external training
 */
export function exportCorrections(): string {
  const corrections = getAllCorrections();
  return JSON.stringify(corrections, null, 2);
}

/**
 * Clear all corrections
 */
export function clearCorrections(): void {
  const keys = Object.keys(localStorage);
  let cleared = 0;

  keys.forEach(key => {
    if (key.startsWith(CORRECTION_KEY_PREFIX)) {
      localStorage.removeItem(key);
      cleared++;
    }
  });

  console.log(`🗑️ Cleared ${cleared} user corrections`);
}

/**
 * Generate unique correction ID
 */
function generateCorrectionId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if we have enough data for model training
 */
export function canTrainModel(): { ready: boolean; count: number; threshold: number } {
  const corrections = getAllCorrections();
  const threshold = 500; // Need 500+ corrections for reliable training

  return {
    ready: corrections.length >= threshold,
    count: corrections.length,
    threshold
  };
}

/**
 * Get training-ready dataset
 * Format: features (X) and labels (y) for ML training
 */
export function getTrainingDataset(): {
  features: number[][];
  labels: string[];
} {
  const corrections = getAllCorrections();

  const features: number[][] = [];
  const labels: string[] = [];

  corrections.forEach(c => {
    // Feature vector: [avgVolume, dynamicRange, speechProb, position (normalized)]
    const position = c.shotStartTime / 150; // Assume 150s trailer

    features.push([
      c.audioFeatures.avgVolume,
      c.audioFeatures.dynamicRange,
      c.audioFeatures.speechProbability,
      position,
      c.shotEndTime - c.shotStartTime // duration
    ]);

    labels.push(c.userLabel);
  });

  return { features, labels };
}
