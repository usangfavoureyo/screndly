/**
 * RSS Feed Image Enrichment
 *
 * Resolve entertainment-news images with a strict preference order:
 * 1. TMDb project art for the title being discussed
 * 2. Smart web image search
 * 3. RSS hero image fallback only when there is no strong project signal
 */

import { extractSubjectMatter, type SubjectMatterAnalysis } from '../ai/subject-extraction';
import { selectSmartImages } from '../ai/image-selection';
import { apiClient } from '../api/client';
import { searchSerperImagesWithRetry, type SerperImageResult } from '../api/serper';
import { filterByQuality } from '../../utils/image-scoring';
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
  strategy?:
    | 'project-led'
    | 'casting-pair'
    | 'company-led-fallback'
    | 'tmdb-exact-quoted-title-match'
    | 'smart-images'
    | 'rss-fallback'
    | 'safe-title-fallback'
    | 'no-safe-fallback';
  confidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  analysis?: {
    primarySubject: string;
    contextType: string;
  };
  debug?: {
    titleLed: boolean;
    exactQuotedTitleMatch?: boolean;
    winnerReasons: string[];
    usedRssFallback: boolean;
  };
  error?: string;
}

interface ArticleInput {
  title: string;
  description?: string;
  link?: string;
  images?: Array<{ url: string }>;
}

interface TMDbSearchImageResult {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  backdrop: string | null;
  poster: string | null;
  releaseDate: string | null;
}

interface ProjectCandidate {
  name: string;
  source: 'quoted' | 'pattern' | 'analysis_primary' | 'analysis_secondary';
  order: number;
}

interface EntityPriorityProfile {
  preferProject: boolean;
  preferPerson: boolean;
  allowCompany: boolean;
  companyPrimary: boolean;
}

const CORPORATE_MARKERS = [
  'productions',
  'production',
  'pictures',
  'studios',
  'studio',
  'entertainment',
  'media',
  'global',
  'group',
  'company',
  'corp',
  'corporation',
  'films',
];

const STUDIO_NETWORK_MARKERS = [
  'netflix',
  'hbo',
  'max',
  'hulu',
  'disney+',
  'disney plus',
  'paramount',
  'paramount+',
  'apple tv+',
  'apple tv plus',
  'amazon',
  'prime video',
  'universal',
  'warner bros',
  'warner bros.',
  'sony',
  'marvel',
  'lucasfilm',
  'peacock',
];

const MIN_TITLE_LED_CONFIDENCE_FOR_ARTICLE_HERO = 78;
const GENERIC_TITLE_TOKENS = new Set([
  'time',
  'out',
  'inside',
  'after',
  'before',
  'home',
  'away',
  'next',
  'last',
  'first',
  'second',
  'one',
  'day',
  'night',
  'summer',
  'winter',
  'fall',
  'spring',
  'life',
  'love',
  'dark',
  'light',
  'run',
  'ride',
  'dead',
  'alive',
]);

function normalizeCandidate(value: string): string {
  return value.replace(/[“”"'`‘’]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeForComparison(value: string): string {
  return normalizeCandidate(value)
    .toLowerCase()
    .replace(/[:\-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeName(value: string): string[] {
  return normalizeForComparison(value).split(' ').filter((part) => part.length >= 2);
}

function getTitleSpecificity(tokens: string[]): 'generic' | 'medium' | 'specific' {
  if (tokens.length === 0) return 'generic';
  const genericTokenCount = tokens.filter((token) => GENERIC_TITLE_TOKENS.has(token) || token.length <= 3).length;

  if (tokens.length === 1) {
    return tokens[0].length <= 5 ? 'generic' : 'medium';
  }

  if (tokens.length <= 2 && genericTokenCount >= 1) {
    return 'generic';
  }

  if (tokens.length >= 3 || genericTokenCount === 0) {
    return 'specific';
  }

  return 'medium';
}

function hasExactTitleMatch(candidate: string, resultTitle: string): boolean {
  return normalizeForComparison(candidate) === normalizeForComparison(resultTitle);
}

function countSharedTokens(left: string, right: string): number {
  const leftTokens = tokenizeName(left);
  const rightTokens = new Set(tokenizeName(right));
  return leftTokens.filter((token) => rightTokens.has(token)).length;
}

function hasDisqualifyingExtraTokens(candidate: string, resultTitle: string): boolean {
  const candidateTokens = tokenizeName(candidate);
  const resultTokens = tokenizeName(resultTitle);
  if (candidateTokens.length === 0 || resultTokens.length === 0) {
    return false;
  }

  const candidateSet = new Set(candidateTokens);
  const extraTokens = resultTokens.filter((token) => !candidateSet.has(token));
  const candidateSpecificity = getTitleSpecificity(candidateTokens);

  if (candidateSpecificity === 'generic') {
    return extraTokens.length > 0;
  }

  if (candidateTokens.length <= 2) {
    return extraTokens.length >= 1;
  }

  return extraTokens.length >= 2;
}

function shouldRequireStrictExactMatch(candidate: ProjectCandidate): boolean {
  return getTitleSpecificity(tokenizeName(candidate.name)) === 'generic';
}

function shouldBlockProjectArtForAmbiguousTitle(
  candidate: ProjectCandidate,
  analysis: SubjectMatterAnalysis,
): boolean {
  const specificity = getTitleSpecificity(tokenizeName(candidate.name));
  return specificity === 'generic' && ['announcement', 'casting', 'general', 'quote'].includes(analysis.contextType);
}

interface CastingContext {
  personName: string;
  projectTitle?: string;
  characterName?: string;
}

function looksCorporateEntity(value?: string): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return CORPORATE_MARKERS.some((marker) => normalized.includes(marker));
}

function extractCompanyMentions(article: Pick<ArticleInput, 'title' | 'description'>, analysis: SubjectMatterAnalysis): string[] {
  const text = `${article.title} ${article.description || ''}`.toLowerCase();
  const companies = new Set<string>();

  STUDIO_NETWORK_MARKERS.forEach((marker) => {
    if (text.includes(marker)) {
      companies.add(marker);
    }
  });

  analysis.secondarySubjects
    .filter((subject) => subject.type === 'studio')
    .forEach((subject) => companies.add(normalizeCandidate(subject.name)));

  if (analysis.primarySubject?.name && looksCorporateEntity(analysis.primarySubject.name)) {
    companies.add(normalizeCandidate(analysis.primarySubject.name));
  }

  return Array.from(companies);
}

function extractQuotedTitles(text: string): string[] {
  return Array.from(text.matchAll(/[“"'`‘’]([^"'`“”‘’]{2,120})[“"'`‘’]/g))
    .map((match) => normalizeCandidate(match[1] || ''))
    .filter(Boolean);
}

function buildProjectCandidates(
  article: Pick<ArticleInput, 'title' | 'description'>,
  analysis: SubjectMatterAnalysis,
): ProjectCandidate[] {
  const text = `${article.title} ${article.description || ''}`;
  const candidates = new Map<string, ProjectCandidate>();

  const addCandidate = (name: string, source: ProjectCandidate['source']) => {
    const normalizedName = normalizeCandidate(name);
    if (!normalizedName || normalizedName.length < 2 || looksCorporateEntity(normalizedName)) {
      return;
    }

    if (!candidates.has(normalizedName)) {
      candidates.set(normalizedName, {
        name: normalizedName,
        source,
        order: candidates.size,
      });
    }
  };

  extractQuotedTitles(text).forEach((candidate) => addCandidate(candidate, 'quoted'));

  Array.from(text.matchAll(/\b(?:remake|reboot|adaptation|sequel|prequel|spinoff|spin-off)\s+of\s+[“"'`]?([^"'`“”‘’.,:;!?]{2,120})/gi))
    .forEach((match) => {
      addCandidate(match[1] || '', 'pattern');
    });

  if (analysis.primarySubject?.name) {
    addCandidate(analysis.primarySubject.name, 'analysis_primary');
  }

  analysis.secondarySubjects
    .filter((subject) => ['movie', 'tv_show', 'franchise'].includes(subject.type))
    .forEach((subject) => {
      addCandidate(subject.name, 'analysis_secondary');
    });

  return Array.from(candidates.values());
}

export function extractProjectCandidates(
  article: Pick<ArticleInput, 'title' | 'description'>,
  analysis: SubjectMatterAnalysis,
): string[] {
  return buildProjectCandidates(article, analysis).map((candidate) => candidate.name);
}

function hasStrongProjectSignal(article: Pick<ArticleInput, 'title' | 'description'>, analysis: SubjectMatterAnalysis): boolean {
  return extractProjectCandidates(article, analysis).length > 0;
}

function buildEntityPriorityProfile(
  article: Pick<ArticleInput, 'title' | 'description'>,
  analysis: SubjectMatterAnalysis,
): EntityPriorityProfile {
  const hasProject = hasStrongProjectSignal(article, analysis);
  const hasActor = Boolean(
    analysis.secondarySubjects.some((subject) => subject.type === 'actor' && subject.relevance !== 'low'),
  );
  const hasCompany = extractCompanyMentions(article, analysis).length > 0;

  switch (analysis.contextType) {
    case 'casting':
      return {
        preferProject: hasProject,
        preferPerson: hasActor,
        allowCompany: false,
        companyPrimary: false,
      };
    case 'trailer':
    case 'boxoffice':
    case 'review':
    case 'bts':
      return {
        preferProject: hasProject,
        preferPerson: false,
        allowCompany: false,
        companyPrimary: false,
      };
    case 'announcement':
    case 'general':
    default: {
      const title = `${article.title} ${article.description || ''}`.toLowerCase();
      const businessSignals = ['deal', 'rights', 'acquisition', 'jv', 'merger', 'partnership', 'greenlit by', 'picked up by'];
      const isCompanyLed = hasCompany && !hasProject && businessSignals.some((signal) => title.includes(signal));

      return {
        preferProject: hasProject,
        preferPerson: hasActor && !hasProject,
        allowCompany: hasCompany,
        companyPrimary: isCompanyLed,
      };
    }
  }
}

function extractCastingContext(
  article: Pick<ArticleInput, 'title' | 'description'>,
  analysis: SubjectMatterAnalysis,
): CastingContext | null {
  const title = article.title;
  const castPattern = title.match(/^(.+?)\s+has\s+been\s+cast\b/i);
  const characterPattern = title.match(/\bcast\s+as\s+([^.,;]+?)\s+in\b/i);

  if (castPattern?.[1]) {
    return {
      personName: normalizeCandidate(castPattern[1]),
      projectTitle: analysis.primarySubject?.name ? normalizeCandidate(analysis.primarySubject.name) : undefined,
      characterName: characterPattern?.[1] ? normalizeCandidate(characterPattern[1]) : undefined,
    };
  }

  const actorSubject = analysis.secondarySubjects.find((subject) => subject.type === 'actor' && subject.relevance !== 'low');
  if (!actorSubject?.name) {
    return null;
  }

  return {
    personName: normalizeCandidate(actorSubject.name),
    projectTitle: analysis.primarySubject?.name ? normalizeCandidate(analysis.primarySubject.name) : undefined,
    characterName: characterPattern?.[1] ? normalizeCandidate(characterPattern[1]) : undefined,
  };
}

function scoreCastingImage(result: SerperImageResult, context: CastingContext): number {
  const title = normalizeForComparison(result.title);
  const url = normalizeForComparison(result.imageUrl);
  const personTokens = tokenizeName(context.personName);
  const projectTokens = context.projectTitle ? tokenizeName(context.projectTitle) : [];
  const characterTokens = context.characterName ? tokenizeName(context.characterName) : [];

  let score = 0;
  if (personTokens.every((token) => title.includes(token) || url.includes(token))) {
    score += 80;
  }

  if (projectTokens.some((token) => title.includes(token) || url.includes(token))) {
    score += 35;
  }

  if (characterTokens.some((token) => title.includes(token) || url.includes(token))) {
    score += 25;
  }

  if (title.includes('character') || title.includes('still') || title.includes('scene') || title.includes('on set')) {
    score += 30;
  }

  if (title.includes('cast') || title.includes('photo')) {
    score += 15;
  }

  if (title.includes('headshot') || title.includes('portrait')) {
    score += 20;
  }

  if (title.includes('logo') || title.includes('poster')) {
    score -= 40;
  }

  // Prefer in-project images over generic portraits when a project is known.
  if (context.projectTitle && projectTokens.length > 0 && !(projectTokens.some((token) => title.includes(token) || url.includes(token)))) {
    if (title.includes('headshot') || title.includes('portrait')) {
      score -= 15;
    }
  }

  score += Math.max(0, 10 - result.position);
  return score;
}

function scoreProjectLogoImage(result: SerperImageResult, projectTitle: string): number {
  const title = normalizeForComparison(result.title);
  const url = normalizeForComparison(result.imageUrl);
  const projectTokens = tokenizeName(projectTitle);
  const exactMatch = hasExactTitleMatch(projectTitle, result.title);
  const hasBadExtraTokens = hasDisqualifyingExtraTokens(projectTitle, result.title);

  let score = 0;
  if (exactMatch) {
    score += 95;
  } else if (projectTokens.some((token) => title.includes(token) || url.includes(token))) {
    score += 60;
  }

  if (title.includes('logo') || title.includes('title') || title.includes('wordmark')) {
    score += 40;
  }

  if (title.includes('poster') || title.includes('backdrop') || title.includes('still')) {
    score -= 20;
  }

  if (hasBadExtraTokens) {
    score -= 120;
  }

  score += Math.max(0, 10 - result.position);
  return score;
}

async function searchProjectLogoImage(
  projectTitle: string,
  options?: {
    requireExactTitle?: boolean;
  },
): Promise<EnrichmentResult['images'][number] | null> {
  const queries = [
    `${projectTitle} official logo`,
    `${projectTitle} title logo`,
    `${projectTitle} logo`,
    `${projectTitle} title card`,
  ];

  for (const query of queries) {
    try {
      const results = filterByQuality(await searchSerperImagesWithRetry(query, { num: 10 }));
      const scored = results
        .map((result) => ({
          result,
          score: scoreProjectLogoImage(result, projectTitle),
        }))
        .filter((entry) => !options?.requireExactTitle || hasExactTitleMatch(projectTitle, entry.result.title))
        .filter((entry) => entry.score >= 70)
        .sort((a, b) => b.score - a.score);

      const best = scored[0]?.result;
      if (best) {
        return {
          url: best.imageUrl,
          width: best.imageWidth,
          height: best.imageHeight,
          source: best.domain,
          reason: `Project logo for ${projectTitle}`,
        };
      }
    } catch {
      // Ignore query failure and continue.
    }
  }

  return null;
}

async function searchCastingLeadImage(
  context: CastingContext,
): Promise<EnrichmentResult['images'][number] | null> {
  const queries = [
    context.projectTitle && context.characterName ? `${context.personName} ${context.projectTitle} ${context.characterName}` : '',
    context.projectTitle ? `${context.personName} ${context.projectTitle} character still` : '',
    context.projectTitle ? `${context.personName} ${context.projectTitle} still` : '',
    context.projectTitle ? `${context.personName} ${context.projectTitle} cast` : '',
    `${context.personName} actor portrait`,
    `${context.personName} headshot`,
  ].filter(Boolean);

  for (const query of queries) {
    try {
      const results = filterByQuality(await searchSerperImagesWithRetry(query, { num: 10 }));
      const scored = results
        .map((result) => ({
          result,
          score: scoreCastingImage(result, context),
        }))
        .filter((entry) => entry.score >= 70)
        .sort((a, b) => b.score - a.score);

      const best = scored[0]?.result;
      if (best) {
        return {
          url: best.imageUrl,
          width: best.imageWidth,
          height: best.imageHeight,
          source: best.domain,
          reason: context.projectTitle
            ? `Lead cast image for ${context.personName} in ${context.projectTitle}`
            : `Lead cast image for ${context.personName}`,
        };
      }
    } catch {
      // Ignore query failure and continue.
    }
  }

  return null;
}

function expandCandidateVariants(candidate: string): string[] {
  const variants = new Set<string>();
  const normalized = normalizeCandidate(candidate);
  variants.add(normalized);

  const colonSplit = normalized.split(':').map((part) => part.trim()).filter(Boolean);
  if (colonSplit.length > 1) {
    variants.add(colonSplit[0]);
  }

  const dashSplit = normalized.split(/\s[-–—]\s/).map((part) => part.trim()).filter(Boolean);
  if (dashSplit.length > 1) {
    variants.add(dashSplit[0]);
  }

  return Array.from(variants);
}

function scoreTMDbMatch(candidate: ProjectCandidate, result: TMDbSearchImageResult, imageCount: number): number {
  const candidateVariants = expandCandidateVariants(candidate.name).map(normalizeForComparison);
  const normalizedTitle = normalizeForComparison(result.title);
  const exactMatch = hasExactTitleMatch(candidate.name, result.title);
  const sharedTokenCount = countSharedTokens(candidate.name, result.title);
  const hasBadExtraTokens = hasDisqualifyingExtraTokens(candidate.name, result.title);

  let score = 0;
  if (candidate.source === 'quoted') score += 30;
  if (candidate.source === 'pattern') score += 20;
  score += Math.max(0, 12 - candidate.order * 3);

  for (const variant of candidateVariants) {
    if (!variant) continue;
    if (normalizedTitle === variant) {
      score += 120;
      break;
    }
    if (normalizedTitle.includes(variant) || variant.includes(normalizedTitle)) {
      score += 45;
    }
  }

  if (result.backdrop) score += 20;
  if (result.poster) score += 15;
  if (result.releaseDate) score += 5;
  if (imageCount === 1 && result.backdrop) score += 25;
  if (exactMatch) score += 180;
  if (sharedTokenCount === 1 && tokenizeName(candidate.name).length === 1 && !exactMatch) {
    score -= 90;
  }
  if (hasBadExtraTokens) {
    score -= 120;
  }
  if (shouldRequireStrictExactMatch(candidate) && !exactMatch) {
    score -= 160;
  }
  return score;
}

async function searchTMDbProjectImages(query: string): Promise<TMDbSearchImageResult[]> {
  const response = await apiClient.get<TMDbSearchImageResult[]>(`/api/tmdb/search?query=${encodeURIComponent(query)}`);
  if (!response.success || !Array.isArray(response.data)) {
    throw new Error(response.error?.message || 'Failed to search TMDb');
  }
  return response.data;
}

async function resolveTMDbImages(
  article: Pick<ArticleInput, 'title' | 'description'>,
  analysis: SubjectMatterAnalysis,
  imageCount: number,
): Promise<EnrichmentResult | null> {
  const candidates = buildProjectCandidates(article, analysis);
  if (candidates.length === 0) {
    return null;
  }

  let bestMatch: { candidate: ProjectCandidate; result: TMDbSearchImageResult; score: number } | null = null;

  for (const candidate of candidates) {
    for (const variant of expandCandidateVariants(candidate.name)) {
      try {
        const results = await searchTMDbProjectImages(variant);
        for (const result of results) {
          if (shouldBlockProjectArtForAmbiguousTitle(candidate, analysis) && !hasExactTitleMatch(candidate.name, result.title)) {
            continue;
          }

          const score = scoreTMDbMatch(candidate, result, imageCount);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { candidate, result, score };
          }
        }
      } catch {
        // Ignore individual lookup failures and keep searching.
      }
    }
  }

  let exactQuotedTitleMatch = false;

  if (imageCount === 1) {
    const firstQuotedCandidate = candidates.find((candidate) => candidate.source === 'quoted');
    if (firstQuotedCandidate) {
      for (const variant of expandCandidateVariants(firstQuotedCandidate.name)) {
        try {
          const results = await searchTMDbProjectImages(variant);
          const exactQuotedMatch = results.find((result) => normalizeForComparison(result.title) === normalizeForComparison(firstQuotedCandidate.name) && result.backdrop);
          if (exactQuotedMatch) {
            exactQuotedTitleMatch = true;
            bestMatch = {
              candidate: firstQuotedCandidate,
              result: exactQuotedMatch,
              score: 999,
            };
            break;
          }
        } catch {
          // Ignore and continue.
        }
      }
    }
  }

  if (!bestMatch || bestMatch.score < 70) {
    return null;
  }

  if (shouldBlockProjectArtForAmbiguousTitle(bestMatch.candidate, analysis)) {
    return null;
  }

  const images: EnrichmentResult['images'] = [];
  const { candidate, result } = bestMatch;

  if (result.backdrop) {
    images.push({
      url: result.backdrop,
      width: 1920,
      height: 1080,
      source: 'TMDb',
      reason: `Official backdrop for ${result.title}`,
    });
  }

  if (result.poster && images.length < imageCount) {
    images.push({
      url: result.poster,
      width: 1000,
      height: 1500,
      source: 'TMDb',
      reason: `Official poster for ${result.title}`,
    });
  }

  if (images.length === 0) {
    return null;
  }

  return {
    success: true,
    images,
    strategy: exactQuotedTitleMatch ? 'tmdb-exact-quoted-title-match' : 'project-led',
    confidence: imageCount === 1 && result.backdrop ? 97 : result.backdrop && result.poster ? 96 : 88,
    confidenceLevel: result.backdrop ? 'high' : 'medium',
    analysis: {
      primarySubject: candidate.name,
      contextType: analysis.contextType,
    },
    debug: {
      titleLed: true,
      exactQuotedTitleMatch,
      winnerReasons: exactQuotedTitleMatch ? ['tmdb-exact-quoted-title-match', 'project-led'] : ['project-led'],
      usedRssFallback: false,
    },
  };
}

async function resolveCastingImageSet(
  article: Pick<ArticleInput, 'title' | 'description'>,
  analysis: SubjectMatterAnalysis,
  imageCount: number,
): Promise<EnrichmentResult | null> {
  const profile = buildEntityPriorityProfile(article, analysis);
  if (analysis.contextType !== 'casting' || imageCount < 2 || !profile.preferProject || !profile.preferPerson) {
    return null;
  }

  const projectResult = await resolveTMDbImages(article, analysis, 2);
  if (!projectResult?.images.length) {
    return null;
  }

  const castingContext = extractCastingContext(article, analysis);
  if (!castingContext) {
    return projectResult;
  }

  const personImage = await searchCastingLeadImage({
    ...castingContext,
    projectTitle: projectResult.analysis?.primarySubject || castingContext.projectTitle,
  });
  if (!personImage) {
    return projectResult;
  }

  const logoImage = await searchProjectLogoImage(
    projectResult.analysis?.primarySubject || castingContext.projectTitle || analysis.primarySubject.name,
    {
      requireExactTitle: shouldRequireStrictExactMatch({
        name: projectResult.analysis?.primarySubject || castingContext.projectTitle || analysis.primarySubject.name,
        source: 'analysis_primary',
        order: 0,
      }),
    },
  );
  const projectImage =
    logoImage ||
    projectResult.images.find((image) => image.reason.toLowerCase().includes('poster')) ||
    projectResult.images[0];

  return {
    success: true,
    images: [personImage, projectImage].slice(0, imageCount),
    strategy: 'casting-pair',
    confidence: 92,
    confidenceLevel: 'high',
    analysis: {
      primarySubject: projectResult.analysis?.primarySubject || analysis.primarySubject.name,
      contextType: analysis.contextType,
    },
    debug: {
      titleLed: true,
      winnerReasons: ['casting-pair', 'project-led'],
      usedRssFallback: false,
    },
  };
}

async function resolveProjectLogoPair(
  article: Pick<ArticleInput, 'title' | 'description'>,
  analysis: SubjectMatterAnalysis,
  imageCount: number,
): Promise<EnrichmentResult | null> {
  const profile = buildEntityPriorityProfile(article, analysis);
  if (imageCount < 2) {
    return null;
  }

  if (!profile.preferProject || profile.companyPrimary) {
    return null;
  }

  const projectResult = await resolveTMDbImages(article, analysis, 1);
  if (!projectResult?.images.length) {
    return null;
  }

  const projectTitle = projectResult.analysis?.primarySubject || analysis.primarySubject.name;
  const logoImage = await searchProjectLogoImage(projectTitle, {
    requireExactTitle: shouldRequireStrictExactMatch({
      name: projectTitle,
      source: 'analysis_primary',
      order: 0,
    }),
  });
  if (!logoImage) {
    return null;
  }

  return {
    success: true,
    images: [projectResult.images[0], logoImage].slice(0, imageCount),
    strategy: 'project-led',
    confidence: 93,
    confidenceLevel: 'high',
    analysis: {
      primarySubject: projectTitle,
      contextType: analysis.contextType,
    },
    debug: {
      titleLed: true,
      winnerReasons: ['project-led'],
      usedRssFallback: false,
    },
  };
}

function formatCompanyLabel(company: string): string {
  return company
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function resolveCompanyLedImages(
  article: Pick<ArticleInput, 'title' | 'description'>,
  analysis: SubjectMatterAnalysis,
  imageCount: number,
): Promise<EnrichmentResult | null> {
  const profile = buildEntityPriorityProfile(article, analysis);
  if (!profile.companyPrimary) {
    return null;
  }

  const company = extractCompanyMentions(article, analysis)[0];
  if (!company) {
    return null;
  }

  const logoImage = await searchProjectLogoImage(company);
  if (!logoImage) {
    return null;
  }

  return {
    success: true,
    images: [logoImage].slice(0, imageCount),
    strategy: 'company-led-fallback',
    confidence: 85,
    confidenceLevel: 'medium',
    analysis: {
      primarySubject: formatCompanyLabel(company),
      contextType: analysis.contextType,
    },
    debug: {
      titleLed: false,
      winnerReasons: ['company-led-fallback'],
      usedRssFallback: false,
    },
  };
}

function buildRssFallback(article: ArticleInput, imageCount: number): EnrichmentResult {
  return {
    success: true,
    images: (article.images || []).slice(0, imageCount).map((img) => ({
      url: img.url,
      width: 1200,
      height: 800,
      source: 'RSS Feed (Fallback)',
      reason: 'Fallback image from RSS feed',
    })),
    strategy: 'rss-fallback',
    confidence: 50,
    confidenceLevel: 'low',
    debug: {
      titleLed: false,
      winnerReasons: ['rss-fallback'],
      usedRssFallback: true,
    },
  };
}

async function resolveSafeTitleFallback(
  article: Pick<ArticleInput, 'title' | 'description'>,
  analysis: SubjectMatterAnalysis,
  imageCount: number,
): Promise<EnrichmentResult | null> {
  const primaryProject = buildProjectCandidates(article, analysis)[0]?.name;
  if (!primaryProject) {
    return null;
  }

  if (shouldBlockProjectArtForAmbiguousTitle({ name: primaryProject, source: 'analysis_primary', order: 0 }, analysis)) {
    return null;
  }

  const logoImage = await searchProjectLogoImage(primaryProject, {
    requireExactTitle: shouldRequireStrictExactMatch({
      name: primaryProject,
      source: 'analysis_primary',
      order: 0,
    }),
  });
  if (!logoImage) {
    return null;
  }

  return {
    success: true,
    images: [logoImage].slice(0, imageCount),
    strategy: 'safe-title-fallback',
    confidence: 66,
    confidenceLevel: 'low',
    analysis: {
      primarySubject: primaryProject,
      contextType: analysis.contextType,
    },
    debug: {
      titleLed: true,
      winnerReasons: ['safe-title-fallback'],
      usedRssFallback: false,
    },
  };
}

function finalizeEnrichmentResult(
  article: Pick<ArticleInput, 'title' | 'description'>,
  analysis: SubjectMatterAnalysis,
  result: EnrichmentResult,
): EnrichmentResult {
  const titleLed = hasStrongProjectSignal(article, analysis) && !buildEntityPriorityProfile(article, analysis).companyPrimary;
  const winnerReasons = result.debug?.winnerReasons?.length
    ? result.debug.winnerReasons
    : result.strategy
      ? [result.strategy]
      : [];

  const finalized: EnrichmentResult = {
    ...result,
    debug: {
      titleLed,
      exactQuotedTitleMatch: result.debug?.exactQuotedTitleMatch,
      winnerReasons,
      usedRssFallback: result.strategy === 'rss-fallback' || result.debug?.usedRssFallback === true,
    },
  };

  console.log('[RSSImageEnrichment] Winner', {
    title: article.title,
    strategy: finalized.strategy || 'unknown',
    confidence: finalized.confidence,
    titleLed,
    reasons: winnerReasons,
    images: finalized.images.map((image) => ({
      url: image.url,
      reason: image.reason,
      source: image.source,
    })),
  });

  return finalized;
}

/**
 * Enrich RSS article with TMDb-first image selection.
 */
export async function enrichArticleWithImages(
  article: ArticleInput,
  _settings?: Settings | null,
  imageCount: number = 2,
): Promise<EnrichmentResult> {
  try {
    const analysisResult = await extractSubjectMatter({
      title: article.title,
      description: article.description,
    });
    const analysis = analysisResult.analysis;
    const profile = buildEntityPriorityProfile(article, analysis);
    const titleLed = hasStrongProjectSignal(article, analysis) && !profile.companyPrimary;

    const companyLedResult = await resolveCompanyLedImages(article, analysis, imageCount);
    if (companyLedResult) {
      return finalizeEnrichmentResult(article, analysis, companyLedResult);
    }

    const castingResult = await resolveCastingImageSet(article, analysis, imageCount);
    if (castingResult) {
      return finalizeEnrichmentResult(article, analysis, castingResult);
    }

    const logoPairResult = await resolveProjectLogoPair(article, analysis, imageCount);
    if (logoPairResult) {
      return finalizeEnrichmentResult(article, analysis, logoPairResult);
    }

    const tmdbResult = await resolveTMDbImages(article, analysis, imageCount);
    if (tmdbResult) {
      return finalizeEnrichmentResult(article, analysis, tmdbResult);
    }

    const allowRssFallback = !titleLed;
    const result = await selectSmartImages(
      {
        title: article.title,
        description: article.description,
        images: article.images,
      },
      {
        imageCount,
        enableFallback: allowRssFallback,
      },
    );

    if (titleLed && (result.confidence ?? 0) < MIN_TITLE_LED_CONFIDENCE_FOR_ARTICLE_HERO) {
      const safeFallback = await resolveSafeTitleFallback(article, analysis, imageCount);
      if (safeFallback) {
        return finalizeEnrichmentResult(article, analysis, safeFallback);
      }

      return finalizeEnrichmentResult(article, analysis, {
        success: true,
        images: [],
        strategy: 'no-safe-fallback',
        confidence: result.confidence,
        confidenceLevel: result.confidenceLevel,
        analysis: {
          primarySubject: result.analysis.primarySubject.name,
          contextType: result.analysis.contextType,
        },
        debug: {
          titleLed: true,
          winnerReasons: ['no-safe-fallback'],
          usedRssFallback: false,
        },
      });
    }

    return finalizeEnrichmentResult(article, analysis, {
      success: true,
      images: result.images.map((img) => ({
        url: img.url,
        width: img.width,
        height: img.height,
        source: img.source,
        reason: img.reason,
      })),
      strategy: 'smart-images',
      confidence: result.confidence,
      confidenceLevel: result.confidenceLevel,
      analysis: {
        primarySubject: result.analysis.primarySubject.name,
        contextType: result.analysis.contextType,
      },
      debug: {
        titleLed,
        winnerReasons: ['smart-images'],
        usedRssFallback: false,
      },
    });
  } catch (error) {
    const analysisResult = await extractSubjectMatter({
      title: article.title,
      description: article.description,
    }).catch(() => null);
    const analysis = analysisResult?.analysis;

    if (analysis && hasStrongProjectSignal(article, analysis)) {
      const safeFallback = await resolveSafeTitleFallback(article, analysis, imageCount).catch(() => null);
      if (safeFallback) {
        return finalizeEnrichmentResult(article, analysis, safeFallback);
      }
    }

    if (article.images && article.images.length > 0) {
      if (analysis) {
        return finalizeEnrichmentResult(article, analysis, buildRssFallback(article, imageCount));
      }

      return buildRssFallback(article, imageCount);
    }

    return {
      success: false,
      images: [],
      error: error instanceof Error ? error.message : 'Unknown error during image enrichment',
    };
  }
}

/**
 * Preview image enrichment results (for Feed Editor testing)
 */
export async function previewImageEnrichment(
  articleTitle: string,
  _settings?: Settings | null,
  imageCount: number = 2,
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
    const analysisResult = await extractSubjectMatter({
      title: articleTitle,
      description: '',
    });

    const companyLedResult = await resolveCompanyLedImages({ title: articleTitle, description: '' }, analysisResult.analysis, imageCount);
    if (companyLedResult) {
      return {
        success: true,
        preview: {
          primarySubject: companyLedResult.analysis?.primarySubject || analysisResult.analysis.primarySubject.name,
          contextType: companyLedResult.analysis?.contextType || analysisResult.analysis.contextType,
          queries: ['Company-led branding strategy'],
          images: companyLedResult.images.map((img) => ({
            url: img.url,
            reason: img.reason,
            score: companyLedResult.confidence || 80,
          })),
          confidence: companyLedResult.confidence || 80,
        },
      };
    }

    const castingResult = await resolveCastingImageSet({ title: articleTitle, description: '' }, analysisResult.analysis, imageCount);
    if (castingResult) {
      return {
        success: true,
        preview: {
          primarySubject: castingResult.analysis?.primarySubject || analysisResult.analysis.primarySubject.name,
          contextType: castingResult.analysis?.contextType || analysisResult.analysis.contextType,
          queries: ['Casting pair strategy'],
          images: castingResult.images.map((img) => ({
            url: img.url,
            reason: img.reason,
            score: castingResult.confidence || 90,
          })),
          confidence: castingResult.confidence || 90,
        },
      };
    }

    const logoPairResult = await resolveProjectLogoPair({ title: articleTitle, description: '' }, analysisResult.analysis, imageCount);
    if (logoPairResult) {
      return {
        success: true,
        preview: {
          primarySubject: logoPairResult.analysis?.primarySubject || analysisResult.analysis.primarySubject.name,
          contextType: logoPairResult.analysis?.contextType || analysisResult.analysis.contextType,
          queries: ['Project backdrop + logo pair'],
          images: logoPairResult.images.map((img) => ({
            url: img.url,
            reason: img.reason,
            score: logoPairResult.confidence || 90,
          })),
          confidence: logoPairResult.confidence || 90,
        },
      };
    }

    const tmdbResult = await resolveTMDbImages({ title: articleTitle, description: '' }, analysisResult.analysis, imageCount);
    if (tmdbResult) {
      return {
        success: true,
        preview: {
          primarySubject: tmdbResult.analysis?.primarySubject || analysisResult.analysis.primarySubject.name,
          contextType: tmdbResult.analysis?.contextType || analysisResult.analysis.contextType,
          queries: ['TMDb exact title resolution'],
          images: tmdbResult.images.map((img) => ({
            url: img.url,
            reason: img.reason,
            score: tmdbResult.confidence || 90,
          })),
          confidence: tmdbResult.confidence || 90,
        },
      };
    }

    const result = await selectSmartImages(
      {
        title: articleTitle,
        description: '',
      },
      {
        imageCount,
        enableFallback: false,
      },
    );

    return {
      success: true,
      preview: {
        primarySubject: result.analysis.primarySubject.name,
        contextType: result.analysis.contextType,
        queries: result.queries,
        images: result.images.map((img) => ({
          url: img.url,
          reason: img.reason,
          score: img.totalScore,
        })),
        confidence: result.confidence,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Preview failed',
    };
  }
}

export function validateSmartImageConfig(_settings: Settings): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  return {
    isValid: true,
    errors: [],
    warnings: [],
  };
}
