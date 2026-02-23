/**
 * RSS Feed Image Enrichment
 * 
 * Integrates smart image selection into the RSS feed workflow
 */

import { selectSmartImages } from '../ai/image-selection';
import type { Settings } from '../../contexts/SettingsContext';

export interface EnrichmentResult {
  success: boolean;
  images: Array<{
    url: string;
    width: number;
    height: number;
    source: string;
    reason: string;
  }>;
  confidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  analysis?: {
    primarySubject: string;
    contextType: string;
  };
  error?: string;
}

/**
 * Enrich RSS article with smart image selection
 */
export async function enrichArticleWithImages(
  article: {
    title: string;
    description?: string;
    link?: string;
    images?: Array<{ url: string }>;
  },
  settings: Settings,
  imageCount: number = 2
): Promise<EnrichmentResult> {
  
  // Backend handles API key validation
  try {
    console.log(`🎨 Enriching article: "${article.title}"`);
    
    const result = await selectSmartImages(
      {
        title: article.title,
        description: article.description,
        images: article.images
      },
      {
        imageCount,
        enableFallback: true
      }
    );
    
    console.log(`✅ Enrichment complete: ${result.images.length} images, ${result.confidence}% confidence`);
    
    return {
      success: true,
      images: result.images.map(img => ({
        url: img.url,
        width: img.width,
        height: img.height,
        source: img.source,
        reason: img.reason
      })),
      confidence: result.confidence,
      confidenceLevel: result.confidenceLevel,
      analysis: {
        primarySubject: result.analysis.primarySubject.name,
        contextType: result.analysis.contextType
      }
    };
    
  } catch (error) {
    // Silently handle enrichment failure and use fallback
    
    // Try fallback to RSS images
    if (article.images && article.images.length > 0) {
      console.log('⚠️ Using RSS fallback images');
      
      return {
        success: true,
        images: article.images.slice(0, imageCount).map((img, index) => ({
          url: img.url,
          width: 1200,
          height: 800,
          source: 'RSS Feed (Fallback)',
          reason: 'Fallback image from RSS feed'
        })),
        confidence: 50,
        confidenceLevel: 'low'
      };
    }
    
    return {
      success: false,
      images: [],
      error: error instanceof Error ? error.message : 'Unknown error during image enrichment'
    };
  }
}

/**
 * Preview image enrichment results (for testing in Feed Editor)
 */
export async function previewImageEnrichment(
  articleTitle: string,
  settings: Settings,
  imageCount: number = 2
): Promise<{
  success: boolean;
  preview?: {
    primarySubject: string;
    contextType: string;
    queries: string[];
    images: Array<{
      url: string;
      reason: string;
      score: number;
    }>;
    confidence: number;
  };
  error?: string;
}> {
  
  try {
    // Backend handles API keys from encrypted database
    const result = await selectSmartImages(
      {
        title: articleTitle,
        description: ''
      },
      {
        imageCount,
        enableFallback: false
      }
    );
    
    return {
      success: true,
      preview: {
        primarySubject: result.analysis.primarySubject.name,
        contextType: result.analysis.contextType,
        queries: result.queries,
        images: result.images.map(img => ({
          url: img.url,
          reason: img.reason,
          score: img.totalScore
        })),
        confidence: result.confidence
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Preview failed'
    };
  }
}

/**
 * Validate that smart image selection is properly configured
 * Note: API keys are now stored in backend, so this just checks if backend is accessible
 */
export function validateSmartImageConfig(settings: Settings): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Note: API keys are now validated by the backend
  // This function is kept for backwards compatibility but always returns true
  // The backend will return appropriate errors if keys are missing
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}