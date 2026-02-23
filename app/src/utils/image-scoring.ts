/**
 * Image Scoring and Filtering Utilities
 * 
 * Advanced algorithms for scoring and filtering images based on
 * quality, relevance, and subject matter matching
 */

import type { SerperImageResult } from '../lib/api/serper';
import type { SubjectMatterAnalysis } from '../lib/ai/subject-extraction';

export interface ScoredImage extends SerperImageResult {
  score: number;
  relevanceScore: number;
  isRelevant: boolean;
  reason: string;
}

// Configuration
export const IMAGE_SCORING_CONFIG = {
  // Minimum requirements
  minWidth: 800,
  minHeight: 600,
  minRelevanceScore: 60,
  
  // Scoring weights
  weights: {
    resolution: 100,
    aspectRatio: 50,
    domain: 30,
    relevance: 40,
    position: 10,
    contextBonus: 20
  },
  
  // Trusted domains (high quality, official sources)
  trustedDomains: [
    'imdb.com',
    'themoviedb.org',
    'rottentomatoes.com',
    'metacritic.com',
    'fandango.com'
  ],
  
  // Good domains (entertainment news sites)
  goodDomains: [
    'variety.com',
    'hollywoodreporter.com',
    'deadline.com',
    'indiewire.com',
    'collider.com',
    'empireonline.com',
    'entertainment.com',
    'ew.com'
  ],
  
  // Blocked domains (fan sites, random image hosts)
  blockedDomains: [
    'pinterest.com',
    'tumblr.com',
    'deviantart.com',
    'fanart.tv',
    'wallpapercave.com',
    'imgur.com',
    'reddit.com',
    'wikia.com',
    'fandom.com'
  ],
  
  // Generic/unrelated keywords to avoid
  blockedKeywords: [
    'fan art',
    'fanart',
    'meme',
    'wallpaper',
    'concept art',
    'redesign',
    'alternate',
    'cosplay',
    'halloween',
    'costume',
    'parody'
  ],
  
  // Logo/branding indicators (for fallback images)
  logoIndicators: [
    'logo',
    'title card',
    'theatrical poster',
    'coming soon',
    'now playing',
    'in theaters'
  ]
};

/**
 * Filter images by minimum quality requirements
 */
export function filterByQuality(images: SerperImageResult[]): SerperImageResult[] {
  return images.filter(img => {
    // Minimum resolution
    if (img.imageWidth < IMAGE_SCORING_CONFIG.minWidth || 
        img.imageHeight < IMAGE_SCORING_CONFIG.minHeight) {
      return false;
    }

    // Blocked domains
    if (IMAGE_SCORING_CONFIG.blockedDomains.some(d => img.domain.includes(d))) {
      return false;
    }

    return true;
  });
}

/**
 * Check if image should be rejected based on subject matter
 */
export function shouldRejectImage(
  image: SerperImageResult,
  expectedSubjects: string[]
): boolean {
  const title = image.title.toLowerCase();
  const url = image.imageUrl.toLowerCase();
  
  // Must mention at least one expected subject
  const mentionsSubject = expectedSubjects.some(subject =>
    title.includes(subject.toLowerCase()) ||
    url.includes(subject.toLowerCase().replace(/\s+/g, '-'))
  );
  
  if (!mentionsSubject) {
    return true; // Reject: No subject match
  }
  
  // Check for blocked keywords
  const hasBlockedKeyword = IMAGE_SCORING_CONFIG.blockedKeywords.some(kw =>
    title.includes(kw)
  );
  
  if (hasBlockedKeyword) {
    return true; // Reject: Generic/fan content
  }
  
  return false;
}

/**
 * Calculate resolution score (0-100)
 */
function calculateResolutionScore(width: number, height: number): number {
  const pixels = width * height;
  
  if (pixels >= 6000000) return 100;      // 6MP+ (e.g., 2000x3000)
  if (pixels >= 2000000) return 85;       // 2MP+ (e.g., 1920x1080)
  if (pixels >= 1000000) return 60;       // 1MP+ (e.g., 1280x720)
  return 30;                              // Below 1MP
}

/**
 * Calculate aspect ratio score (0-50)
 */
function calculateAspectRatioScore(width: number, height: number): number {
  const ratio = width / height;
  
  // 16:9 landscape (ideal for social media)
  if (ratio >= 1.5 && ratio <= 1.8) return 50;
  
  // 2:3 portrait (movie posters)
  if (ratio >= 0.6 && ratio <= 0.7) return 40;
  
  // 4:3 landscape
  if (ratio >= 1.3 && ratio <= 1.4) return 35;
  
  // 3:2 landscape
  if (ratio >= 1.4 && ratio <= 1.6) return 40;
  
  // Other ratios
  return 10;
}

/**
 * Calculate domain trust score (0-30)
 */
function calculateDomainScore(domain: string): number {
  if (IMAGE_SCORING_CONFIG.trustedDomains.some(d => domain.includes(d))) {
    return 30;
  }
  
  if (IMAGE_SCORING_CONFIG.goodDomains.some(d => domain.includes(d))) {
    return 20;
  }
  
  return 10;
}

/**
 * Calculate subject relevance score (0-100)
 */
export function calculateRelevanceScore(
  image: SerperImageResult,
  expectedSubject: string
): number {
  const title = image.title.toLowerCase();
  const url = image.imageUrl.toLowerCase();
  const subject = expectedSubject.toLowerCase();
  
  let score = 0;
  
  // Title match (40 points)
  if (title.includes(subject)) {
    score += 40;
    
    // Bonus for exact match
    if (title === subject) {
      score += 10;
    }
  }
  
  // URL match (30 points)
  const subjectSlug = subject.replace(/\s+/g, '-');
  if (url.includes(subjectSlug)) {
    score += 30;
  }
  
  // Domain trust (20 points)
  if (IMAGE_SCORING_CONFIG.trustedDomains.some(d => image.domain.includes(d))) {
    score += 20;
  } else if (IMAGE_SCORING_CONFIG.goodDomains.some(d => image.domain.includes(d))) {
    score += 10;
  }
  
  // Google ranking bonus (10 points)
  if (image.position <= 3) {
    score += 10;
  } else if (image.position <= 5) {
    score += 5;
  }
  
  return Math.min(score, 100);
}

/**
 * Calculate context-specific bonus (0-20)
 */
function calculateContextBonus(
  image: SerperImageResult,
  analysis: SubjectMatterAnalysis
): number {
  const title = image.title.toLowerCase();
  
  switch (analysis.contextType) {
    case 'trailer':
      if (title.includes('trailer') || title.includes('screenshot')) {
        return 20;
      }
      break;
      
    case 'bts':
      if (title.includes('behind the scenes') || title.includes('set photo') || title.includes('production')) {
        return 20;
      }
      break;
      
    case 'casting':
      if (title.includes('cast') || title.includes('character')) {
        return 15;
      }
      break;
      
    case 'boxoffice':
      if (title.includes('poster') || title.includes('official')) {
        return 15;
      }
      break;
  }
  
  return 0;
}

/**
 * Calculate advanced score for image (0-230 points)
 */
export function calculateAdvancedScore(
  image: SerperImageResult,
  analysis: SubjectMatterAnalysis,
  relevanceScore: number
): number {
  let score = 0;
  
  // Resolution (0-100)
  score += calculateResolutionScore(image.imageWidth, image.imageHeight);
  
  // Aspect Ratio (0-50)
  score += calculateAspectRatioScore(image.imageWidth, image.imageHeight);
  
  // Domain Trust (0-30)
  score += calculateDomainScore(image.domain);
  
  // Subject Relevance (0-40)
  score += (relevanceScore / 100) * IMAGE_SCORING_CONFIG.weights.relevance;
  
  // Google Position (0-10)
  score += Math.max(0, 11 - image.position);
  
  // Context Bonus (0-20)
  score += calculateContextBonus(image, analysis);
  
  return Math.round(score);
}

/**
 * Check if image has prominent logo/branding
 * (useful for selecting clean images for sequel fallbacks)
 */
export function hasLogoOrBranding(image: SerperImageResult): boolean {
  const title = image.title.toLowerCase();
  const url = image.imageUrl.toLowerCase();
  
  return IMAGE_SCORING_CONFIG.logoIndicators.some(indicator =>
    title.includes(indicator) || url.includes(indicator)
  );
}

/**
 * Score image for fallback use (prefers clean images without text)
 */
export function scoreImageForFallback(
  image: SerperImageResult,
  baseScore: number
): number {
  let score = baseScore;
  
  // Penalty for logos/branding
  if (hasLogoOrBranding(image)) {
    score -= 50;
  }
  
  // Bonus for character/cast photos
  const title = image.title.toLowerCase();
  if (title.includes('cast') || title.includes('character')) {
    score += 30;
  }
  
  // Bonus for 'still' or 'scene'
  if (title.includes('still') || title.includes('scene')) {
    score += 20;
  }
  
  // Avoid images with text overlays
  if (title.includes('poster with text') || title.includes('title treatment')) {
    score -= 30;
  }
  
  return score;
}

/**
 * Determine reason/context for image selection
 */
export function determineImageReason(
  image: SerperImageResult,
  analysis: SubjectMatterAnalysis
): string {
  const title = image.title.toLowerCase();
  
  if (title.includes('poster') && title.includes('official')) {
    return 'Official poster match';
  }
  
  if (title.includes('promotional')) {
    return 'Promotional image';
  }
  
  if (title.includes('scene') || title.includes('still')) {
    return 'Scene imagery';
  }
  
  if (title.includes('cast') || title.includes('photo')) {
    return 'Cast photo';
  }
  
  if (title.includes('behind the scenes') || title.includes('bts')) {
    return 'Behind the scenes';
  }
  
  if (title.includes('character')) {
    return 'Character poster';
  }
  
  if (title.includes('trailer')) {
    return 'Trailer still';
  }
  
  if (title.includes('logo')) {
    return 'Movie logo';
  }
  
  // Default based on context
  switch (analysis.contextType) {
    case 'trailer': return 'Trailer-related imagery';
    case 'bts': return 'Production photo';
    case 'casting': return 'Cast-related image';
    default: return 'Relevant imagery';
  }
}

/**
 * Calculate overall confidence score for selected images
 */
export function calculateOverallConfidence(images: ScoredImage[]): number {
  if (images.length === 0) return 0;
  
  const avgScore = images.reduce((sum, img) => sum + img.score, 0) / images.length;
  const avgRelevance = images.reduce((sum, img) => sum + img.relevanceScore, 0) / images.length;
  
  // Confidence is weighted average of score and relevance
  const confidence = (avgScore / 230) * 0.6 + (avgRelevance / 100) * 0.4;
  
  return Math.round(confidence * 100);
}

/**
 * Get confidence level description
 */
export function getConfidenceLevel(confidence: number): {
  level: 'high' | 'medium' | 'low';
  description: string;
} {
  if (confidence >= 90) {
    return {
      level: 'high',
      description: 'Perfect match - use images directly'
    };
  }
  
  if (confidence >= 70) {
    return {
      level: 'medium',
      description: 'Good match - review recommended'
    };
  }
  
  return {
    level: 'low',
    description: 'Low confidence - consider fallback options'
  };
}
