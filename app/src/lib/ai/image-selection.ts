/**
 * Smart Image Selection System
 * 
 * AI-powered image search and selection that understands article context
 * and selects the most relevant, high-quality images
 */

import { searchSerperImagesWithRetry, type SerperImageResult } from '../api/serper';
import { extractSubjectMatter, type SubjectMatterAnalysis } from './subject-extraction';
import {
  filterByQuality,
  shouldRejectImage,
  calculateRelevanceScore,
  calculateAdvancedScore,
  scoreImageForFallback,
  determineImageReason,
  calculateOverallConfidence,
  type ScoredImage
} from '../../utils/image-scoring';

export interface SmartImageSelectionOptions {
  imageCount: number;
  enableFallback?: boolean;
  enableGPT4Vision?: boolean;
}

export interface SmartImageResult {
  images: Array<{
    url: string;
    width: number;
    height: number;
    source: string;
    reason: string;
    relevanceScore: number;
    totalScore: number;
  }>;
  analysis: SubjectMatterAnalysis;
  queries: string[];
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  analysisMetadata?: Record<string, unknown> | null;
}

/**
 * Main smart image selection function
 * 
 * This is the entry point that orchestrates the entire pipeline:
 * 1. Extract subject matter with GPT-4
 * 2. Generate smart queries
 * 3. Search Serper API
 * 4. Filter and score images
 * 5. Select best matches
 */
export async function selectSmartImages(
  article: {
    title: string;
    description?: string;
    images?: Array<{ url: string }>;
  },
  options: SmartImageSelectionOptions
): Promise<SmartImageResult> {
  
  // Step 1: Extract subject matter with AI (backend handles OpenAI key)
  console.log('🧠 Extracting subject matter...');
  const analysisResult = await extractSubjectMatter(
    {
      title: article.title,
      description: article.description
    }
  );
  const analysis = analysisResult.analysis;
  
  console.log('✅ Subject matter:', {
    primary: analysis.primarySubject.name,
    type: analysis.contextType,
    status: analysis.primarySubject.status
  });
  
  // Step 2: Use AI-generated image preferences as queries
  const queries = analysis.imagePreferences;
  console.log('🔍 Generated queries:', queries);
  
  // Step 3: Try queries in priority order
  let allImages: SerperImageResult[] = [];
  let usedQuery = '';
  
  for (const query of queries) {
    console.log(`🔎 Trying query: "${query}"`);
    
    try {
      // Backend handles Serper API key
      const results = await searchSerperImagesWithRetry(
        query,
        { num: 10 }
      );
      
      if (results.length > 0) {
        allImages = results;
        usedQuery = query;
        console.log(`✅ Query succeeded: ${results.length} results`);
        break;
      } else {
        console.log(`⚠️ Query returned no results, trying next...`);
      }
    } catch (error) {
      console.error(`❌ Query failed:`, error);
      // Continue to next query
    }
  }
  
  // If no images found, try fallback
  if (allImages.length === 0) {
    console.log('⚠️ No images from Serper, trying fallback...');
    
    if (options.enableFallback && article.images && article.images.length > 0) {
      // Use RSS feed images as fallback
      return createFallbackResult(article.images, analysis, queries);
    }
    
    // Return empty result instead of throwing error when backend is unavailable
    console.warn('⚠️ No images found - returning empty result');
    return {
      selectedImages: [],
      metadata: {
        totalImages: 0,
        usedQuery: queries[0] || article.title,
        fallbackUsed: true,
        rssImagesAvailable: article.images?.length || 0,
        primarySubject: analysis.primarySubject.name,
        contextType: analysis.contextType
      }
    };
  }
  
  // Step 4: Filter by quality
  console.log('🔍 Filtering by quality...');
  const qualityFiltered = filterByQuality(allImages);
  console.log(`✅ Quality filter: ${allImages.length} → ${qualityFiltered.length}`);
  
  // Step 5: Filter by subject relevance
  console.log('🔍 Filtering by subject relevance...');
  const expectedSubjects = [
    analysis.primarySubject.name,
    ...analysis.secondarySubjects.map(s => s.name)
  ];
  
  const relevantImages = qualityFiltered.filter(img => 
    !shouldRejectImage(img, expectedSubjects)
  );
  console.log(`✅ Relevance filter: ${qualityFiltered.length} → ${relevantImages.length}`);
  
  if (relevantImages.length === 0) {
    throw new Error('No relevant images found after filtering');
  }
  
  // Step 6: Calculate relevance scores
  console.log('📊 Calculating relevance scores...');
  const scoredRelevance = relevantImages.map(img => ({
    ...img,
    relevanceScore: calculateRelevanceScore(img, analysis.primarySubject.name)
  }));
  
  // Filter by minimum relevance
  const highRelevance = scoredRelevance.filter(img => img.relevanceScore >= 60);
  console.log(`✅ High relevance filter: ${scoredRelevance.length} → ${highRelevance.length}`);
  
  const imagesToScore = highRelevance.length > 0 ? highRelevance : scoredRelevance;
  
  // Step 7: Advanced scoring
  console.log('🎯 Calculating advanced scores...');
  const scored: ScoredImage[] = imagesToScore.map(img => {
    const totalScore = calculateAdvancedScore(img, analysis, img.relevanceScore);
    
    // Apply fallback scoring if this is a rumored/development project
    const finalScore = (analysis.primarySubject.status === 'rumored' || 
                       analysis.primarySubject.status === 'development')
      ? scoreImageForFallback(img, totalScore)
      : totalScore;
    
    return {
      ...img,
      score: finalScore,
      isRelevant: img.relevanceScore >= 60,
      reason: determineImageReason(img, analysis)
    };
  });
  
  // Step 8: Sort by score and select top N
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, options.imageCount);
  
  console.log('✅ Selected images:', selected.map(img => ({
    title: img.title,
    score: img.score,
    relevance: img.relevanceScore,
    reason: img.reason
  })));
  
  // Step 9: Calculate confidence
  const confidence = calculateOverallConfidence(selected);
  const confidenceLevel = confidence >= 90 ? 'high' : confidence >= 70 ? 'medium' : 'low';
  
  console.log(`🎯 Overall confidence: ${confidence}% (${confidenceLevel})`);
  
  return {
    images: selected.map(img => ({
      url: img.imageUrl,
      width: img.imageWidth,
      height: img.imageHeight,
      source: img.domain,
      reason: img.reason,
      relevanceScore: img.relevanceScore,
      totalScore: img.score
    })),
    analysis,
    queries: [usedQuery, ...queries.filter(q => q !== usedQuery)],
    confidence,
    confidenceLevel,
    analysisMetadata: analysisResult.metadata,
  };
}

/**
 * Create fallback result using RSS images
 */
function createFallbackResult(
  rssImages: Array<{ url: string }>,
  analysis: SubjectMatterAnalysis,
  queries: string[]
): SmartImageResult {
  return {
    images: rssImages.slice(0, 2).map((img, index) => ({
      url: img.url,
      width: 1200,
      height: 800,
      source: 'RSS Feed',
      reason: 'Fallback RSS image',
      relevanceScore: 50,
      totalScore: 100 - (index * 10)
    })),
    analysis,
    queries,
    confidence: 50,
    confidenceLevel: 'low',
    analysisMetadata: null,
  };
}

/**
 * Quick image search without AI analysis (for testing/preview)
 */
export async function quickImageSearch(
  query: string,
  imageCount: number = 2
): Promise<Array<{
  url: string;
  width: number;
  height: number;
  source: string;
}>> {
  // Backend handles Serper API key
  const results = await searchSerperImagesWithRetry(query, { num: 10 });
  
  const filtered = filterByQuality(results);
  
  return filtered.slice(0, imageCount).map(img => ({
    url: img.imageUrl,
    width: img.imageWidth,
    height: img.imageHeight,
    source: img.domain
  }));
}

/**
 * Batch process multiple articles
 */
export async function selectSmartImagesBatch(
  articles: Array<{
    title: string;
    description?: string;
    images?: Array<{ url: string }>;
  }>,
  options: SmartImageSelectionOptions
): Promise<SmartImageResult[]> {
  const results: SmartImageResult[] = [];
  
  for (const article of articles) {
    try {
      const result = await selectSmartImages(article, options);
      results.push(result);
      
      // Rate limiting: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Failed to process article:', article.title, error);
      // Continue with next article
    }
  }
  
  return results;
}
