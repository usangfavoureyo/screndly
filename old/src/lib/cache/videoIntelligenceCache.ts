/**
 * Google Video Intelligence Cache
 * Caches expensive analysis results for reuse
 */

import { TrailerAnalysis } from '../api/googleVideoIntelligence';

interface CachedAnalysis {
  analysis: TrailerAnalysis;
  timestamp: number;
  fileHash: string;
  fileName: string;
  fileSize: number;
}

const CACHE_KEY_PREFIX = 'screndly_video_analysis_';
const CACHE_EXPIRY_DAYS = 30; // Cache for 30 days

/**
 * Generate a simple hash for a file
 */
async function generateFileHash(file: File): Promise<string> {
  // Use file metadata as a fingerprint
  const metadata = `${file.name}_${file.size}_${file.lastModified}`;

  // Simple hash using string
  let hash = 0;
  for (let i = 0; i < metadata.length; i++) {
    const char = metadata.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `${Math.abs(hash).toString(36)}_${file.size}`;
}

/**
 * Check if cache entry is expired
 */
function isCacheExpired(timestamp: number): boolean {
  const now = Date.now();
  const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return (now - timestamp) > expiryMs;
}

/**
 * Save analysis to cache
 */
export async function cacheAnalysis(file: File, analysis: TrailerAnalysis): Promise<void> {
  try {
    const fileHash = await generateFileHash(file);
    const cacheKey = `${CACHE_KEY_PREFIX}${fileHash}`;

    const cached: CachedAnalysis = {
      analysis,
      timestamp: Date.now(),
      fileHash,
      fileName: file.name,
      fileSize: file.size
    };

    localStorage.setItem(cacheKey, JSON.stringify(cached));

    console.log(`✅ Cached analysis for: ${file.name} (${fileHash})`);
  } catch (error) {
    console.error('Failed to cache analysis:', error);
  }
}

/**
 * Get cached analysis if available
 */
export async function getCachedAnalysis(file: File): Promise<TrailerAnalysis | null> {
  try {
    const fileHash = await generateFileHash(file);
    const cacheKey = `${CACHE_KEY_PREFIX}${fileHash}`;

    const cachedStr = localStorage.getItem(cacheKey);
    if (!cachedStr) {
      return null;
    }

    const cached: CachedAnalysis = JSON.parse(cachedStr);

    // Check if expired
    if (isCacheExpired(cached.timestamp)) {
      console.log(`⏰ Cache expired for: ${file.name}`);
      localStorage.removeItem(cacheKey);
      return null;
    }

    console.log(`✅ Using cached analysis for: ${file.name} (saved ${Math.round((Date.now() - cached.timestamp) / 1000 / 60)} minutes ago)`);
    return cached.analysis;
  } catch (error) {
    console.error('Failed to get cached analysis:', error);
    return null;
  }
}

/**
 * Clear all cached analyses
 */
export function clearAnalysisCache(): void {
  const keys = Object.keys(localStorage);
  let cleared = 0;

  keys.forEach(key => {
    if (key.startsWith(CACHE_KEY_PREFIX)) {
      localStorage.removeItem(key);
      cleared++;
    }
  });

  console.log(`🗑️ Cleared ${cleared} cached analyses`);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  count: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const keys = Object.keys(localStorage);
  let count = 0;
  let totalSize = 0;
  let oldestEntry: number | null = null;
  let newestEntry: number | null = null;

  keys.forEach(key => {
    if (key.startsWith(CACHE_KEY_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) {
        count++;
        totalSize += value.length;

        try {
          const cached: CachedAnalysis = JSON.parse(value);
          if (oldestEntry === null || cached.timestamp < oldestEntry) {
            oldestEntry = cached.timestamp;
          }
          if (newestEntry === null || cached.timestamp > newestEntry) {
            newestEntry = cached.timestamp;
          }
        } catch (_e) {
          // Skip invalid entries
        }
      }
    }
  });

  return {
    count,
    totalSize,
    oldestEntry,
    newestEntry
  };
}

/**
 * List all cached analyses
 */
export function listCachedAnalyses(): Array<{
  fileName: string;
  fileSize: number;
  timestamp: number;
  age: string;
}> {
  const keys = Object.keys(localStorage);
  const analyses: Array<{
    fileName: string;
    fileSize: number;
    timestamp: number;
    age: string;
  }> = [];

  keys.forEach(key => {
    if (key.startsWith(CACHE_KEY_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          const cached: CachedAnalysis = JSON.parse(value);
          const ageMs = Date.now() - cached.timestamp;
          const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
          const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

          analyses.push({
            fileName: cached.fileName,
            fileSize: cached.fileSize,
            timestamp: cached.timestamp,
            age: ageDays > 0 ? `${ageDays}d ${ageHours}h` : `${ageHours}h`
          });
        } catch (_e) {
          // Skip invalid entries
        }
      }
    }
  });

  return analyses.sort((a, b) => b.timestamp - a.timestamp);
}
