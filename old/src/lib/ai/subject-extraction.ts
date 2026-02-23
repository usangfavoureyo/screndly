/**
 * AI Subject Matter Extraction
 * 
 * Uses GPT-4 to analyze entertainment news articles and extract
 * primary/secondary subjects for intelligent image search
 * All requests are proxied through backend for secure API key handling
 */

import { openaiApi } from '../api/openai';
import { apiClient } from '../api/client';

export interface SubjectEntity {
  name: string;
  type: 'movie' | 'tv_show' | 'actor' | 'director' | 'studio' | 'franchise';
  relevance: 'high' | 'medium' | 'low';
}

export interface SubjectMatterAnalysis {
  primarySubject: {
    name: string;
    type: 'movie' | 'tv_show' | 'franchise';
    status: 'released' | 'production' | 'development' | 'rumored';
  };
  secondarySubjects: SubjectEntity[];
  contextType: 'trailer' | 'announcement' | 'interview' | 'review' | 'boxoffice' | 'bts' | 'casting' | 'quote' | 'general';
  imagePreferences: string[];
}

const EXTRACTION_PROMPT = `You are an expert at analyzing entertainment news articles and extracting key entities for image search.

Analyze this article and extract:
1. Primary subject (the main movie/TV show/project being discussed)
2. Secondary subjects (actors, directors, franchises, studios, etc.)
3. Context type (what kind of news is this?)
4. Production status (where is the project in development?)
5. Image search query suggestions (prioritized list)

Rules:
- The PRIMARY subject should ALWAYS be the movie/TV show/project, NOT the person
- For interviews about a movie, the movie is primary, the person is secondary
- For casting news, the movie is primary, the actor is secondary
- For sequels without images, include the previous movie in secondary subjects
- Context type helps determine what kind of images to search for

Respond in JSON format:
{
  "primarySubject": {
    "name": "Movie or TV show name (exact title)",
    "type": "movie|tv_show|franchise",
    "status": "released|production|development|rumored"
  },
  "secondarySubjects": [
    {
      "name": "Person or entity name",
      "type": "actor|director|studio|franchise|movie",
      "relevance": "high|medium|low"
    }
  ],
  "contextType": "trailer|announcement|interview|review|boxoffice|bts|casting|quote|general",
  "imagePreferences": [
    "Query suggestion 1 (most specific)",
    "Query suggestion 2 (fallback)",
    "Query suggestion 3 (broader fallback)",
    "Query suggestion 4 (final fallback)"
  ]
}`;

/**
 * Extract subject matter from article using GPT-4 (Backend Proxy)
 */
export async function extractSubjectMatter(
  article: {
    title: string;
    description?: string;
  }
): Promise<SubjectMatterAnalysis> {
  // Check if backend is available
  if (!apiClient.isBackendAvailable()) {
    // Silently use fallback when backend is not configured
    return getFallbackAnalysis(article);
  }

  const userMessage = `Article Title: "${article.title}"${article.description ? `\nArticle Description: "${article.description}"` : ''
    }`;

  try {
    // Call backend proxy (backend handles OpenAI key from database)
    const response = await openaiApi.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: EXTRACTION_PROMPT
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to extract subject matter');
    }

    const analysisText = response.data.choices[0].message.content;
    const analysis: SubjectMatterAnalysis = JSON.parse(analysisText);

    // Validate response
    if (!analysis.primarySubject || !analysis.imagePreferences || analysis.imagePreferences.length === 0) {
      throw new Error('Invalid analysis response from AI');
    }

    return analysis;
  } catch (_error) {
    // Use fallback silently
    return getFallbackAnalysis(article);
  }
}

/**
 * Get fallback analysis when backend is unavailable
 */
function getFallbackAnalysis(article: { title: string; description?: string }): SubjectMatterAnalysis {
  return {
    primarySubject: {
      name: article.title.split(' ').slice(0, 5).join(' '),
      type: 'movie',
      status: 'development'
    },
    secondarySubjects: [],
    contextType: 'general',
    imagePreferences: [
      article.title,
      article.title.split(' ').slice(0, 3).join(' ') + ' movie',
      article.title.split(' ')[0] + ' movie poster',
      'movie poster'
    ]
  };
}

/**
 * Find a previous movie/show in a series for image fallback
 */
export function findPreviousInSeries(
  analysis: SubjectMatterAnalysis
): string | null {
  // Look for sequels/prequels/spin-offs in secondary subjects
  const previousEntry = analysis.secondarySubjects.find(
    subject => subject.type === 'movie' || subject.type === 'franchise'
  );

  return previousEntry?.name || null;
}

/**
 * Determine if this is likely a sequel/prequel based on title
 */
export function isLikelySequelOrPrequel(title: string): boolean {
  const sequelPatterns = [
    /\b(2|3|4|5|II|III|IV|V)\b/i,
    /\b(sequel|prequel|trilogy|saga|part|chapter)\b/i,
    /\b(returns|rises|strikes back|revenge|awakens)\b/i
  ];

  return sequelPatterns.some(pattern => pattern.test(title));
}

/**
 * Extract year from article title if present
 */
export function extractYearFromTitle(title: string): number | null {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? parseInt(yearMatch[0], 10) : null;
}