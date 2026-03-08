import { getSecretSetting } from '../lib/settings';
import aiService, { DEFAULT_OPENAI_MODEL, type AIModel, normalizeAIModel } from './ai.service';
import { trackApiUsage } from './api-usage.service';

export interface RSSImageSelectionArticle {
  title: string;
  description?: string;
  author?: string;
  fallbackImages?: string[];
}

export interface RSSResolvedImage {
  url: string;
  reason: string;
  source: 'serper' | 'feed';
  score?: number;
}

type SubjectType =
  | 'movie'
  | 'tv_show'
  | 'franchise'
  | 'actor'
  | 'character'
  | 'director'
  | 'producer'
  | 'studio'
  | 'streaming_service'
  | 'general';

type ContextType =
  | 'release'
  | 'trailer'
  | 'casting'
  | 'interview'
  | 'boxoffice'
  | 'poster_announcement'
  | 'industry'
  | 'general';

type ImageIntent =
  | 'poster'
  | 'backdrop'
  | 'still'
  | 'character_still'
  | 'person_portrait'
  | 'logo'
  | 'brand_backdrop';

interface SerperImageResult {
  title?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  source?: string;
  domain?: string;
  link?: string;
  position?: number;
}

interface SerperImagesResponse {
  images?: SerperImageResult[];
}

interface RSSSubjectAnalysis {
  editorialPrimary: string;
  primarySubject: {
    name: string;
    type: SubjectType;
  };
  visualSubject: string;
  imageIntent: ImageIntent;
  secondarySubjects: string[];
  relevantStudios: string[];
  contextType: ContextType;
  allowLogoOnly: boolean;
  queries: string[];
}

interface ScoredImage {
  image: SerperImageResult;
  score: number;
  reason: string;
}

const MIN_IMAGE_WIDTH = 600;
const MIN_IMAGE_HEIGHT = 400;
const BLOCKED_DOMAINS = [
  'pinterest.com',
  'tumblr.com',
  'deviantart.com',
  'fanart.tv',
  'wallpapercave.com',
  'imgur.com',
  'reddit.com',
  'wikia.com',
  'fandom.com',
  '9gag.com',
  'knowyourmeme.com',
];
const STOCK_IMAGE_DOMAINS = [
  'gettyimages.com',
  'alamy.com',
  'shutterstock.com',
  'istockphoto.com',
  'dreamstime.com',
  'depositphotos.com',
  '123rf.com',
  'bigstockphoto.com',
  'vectorstock.com',
];
const TRUSTED_DOMAINS = [
  'imdb.com',
  'themoviedb.org',
  'rottentomatoes.com',
  'metacritic.com',
  'fandango.com',
  'variety.com',
  'hollywoodreporter.com',
  'deadline.com',
  'indiewire.com',
  'collider.com',
  'empireonline.com',
  'ew.com',
  'netflix.com',
  'disney.com',
  'pixar.com',
  'marvel.com',
  '20thcenturystudios.com',
  'lucasfilm.com',
  'warnerbros.com',
  'paramount.com',
  'universalpictures.com',
  'sonypictures.com',
  'primevideo.com',
  'hbomax.com',
  'max.com',
  'tv.apple.com',
  'apple.com',
  'a24films.com',
  'searchlightpictures.com',
  'amc.com',
  'fxnetworks.com',
  'hulu.com',
  'peacocktv.com',
];
const GOOD_DOMAINS = [
  'screenrant.com',
  'comicbook.com',
  'comingsoon.net',
  'cinemablend.com',
  'gamesradar.com',
  'digitalspy.com',
  'theplaylist.net',
];
const WATERMARK_KEYWORDS = [
  'getty',
  'alamy',
  'shutterstock',
  'dreamstime',
  'depositphotos',
  'istock',
  'stock photo',
  'watermark',
  'editorial use only',
];
const BLOCKED_KEYWORDS = [
  'fan art',
  'fanart',
  'wallpaper',
  'concept art',
  'parody',
  'cosplay',
  'meme',
  'mockup',
  'fake poster',
  'ai generated',
  'midjourney',
];
const LOGO_KEYWORDS = [
  'logo',
  'wordmark',
  'title card',
  'title treatment',
  'branding',
];
const POSTER_KEYWORDS = [
  'poster',
  'one sheet',
  'key art',
  'official art',
  'promo art',
  'character poster',
];
const STILL_KEYWORDS = [
  'still',
  'scene',
  'screenshot',
  'screen grab',
  'trailer still',
  'first look',
  'production still',
];
const PORTRAIT_KEYWORDS = [
  'portrait',
  'headshot',
  'photo',
  'cast photo',
  'press photo',
  'official photo',
];
const BACKDROP_KEYWORDS = [
  'backdrop',
  'banner',
  'landscape',
  'wide shot',
  'production still',
  'press still',
];
const OFFICIAL_MARKERS = [
  'official',
  'studio',
  'press',
  'promotional',
  'promo',
  'network',
];
const OFFICIAL_STUDIO_TERMS = [
  'pixar',
  'marvel',
  'marvel studios',
  '20th century studios',
  '20th century fox',
  'netflix',
  'disney',
  'disney+',
  'lucasfilm',
  'warner bros',
  'warner bros.',
  'paramount',
  'universal pictures',
  'sony pictures',
  'prime video',
  'apple tv+',
  'apple tv',
  'hbo',
  'max',
  'amc',
  'fx',
  'hulu',
  'peacock',
  'a24',
  'searchlight pictures',
  'focus features',
  'mgm',
  'amazon mgm studios',
];

const SUBJECT_EXTRACTION_PROMPT = `You analyze entertainment-news articles for image selection.

Return strict JSON with this shape:
{
  "editorialPrimary": "the main editorial subject",
  "primarySubject": {
    "name": "exact subject name",
    "type": "movie|tv_show|franchise|actor|character|director|producer|studio|streaming_service|general"
  },
  "visualSubject": "the best visual subject for the image",
  "imageIntent": "poster|backdrop|still|character_still|person_portrait|logo|brand_backdrop",
  "secondarySubjects": ["name"],
  "relevantStudios": ["studio or streaming service"],
  "contextType": "release|trailer|casting|interview|boxoffice|poster_announcement|industry|general",
  "allowLogoOnly": true
}

Rules:
- If the article is about a movie, TV show, or franchise, that title is the primary subject, not the person.
- If the article is mainly about a studio or streaming service, use that company as the primary subject.
- If the article is mainly about a person and no title is clearly primary, use the person.
- Visual subject can differ from editorial subject. Example: "Michael Bay producing new Transformers movie" => editorialPrimary "Michael Bay", visualSubject "Transformers".
- Poster is conditional, never default. Use poster only when the story is explicitly about a poster, key art, first look poster, character poster, or official image asset.
- For movie/show/franchise stories, default imageIntent to backdrop or still.
- For title-linked actor stories, prefer still.
- For actor/director/producer stories without a clear title, prefer person_portrait.
- For studio/platform stories without a dominant title, prefer logo or brand_backdrop.
- Do not suggest fan art, wallpapers, memes, mockups, or stock-photo style results.
- Logo-only images are allowed only for the exact movie/show logo or a clearly relevant official studio/platform logo.`;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = normalizeText(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(trimmed);
  }

  return items;
}

function dedupeUrls(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    urls.push(trimmed);
  }

  return urls;
}

function getSerperImageText(image: SerperImageResult): string {
  return normalizeText([
    image.title,
    image.source,
    image.domain,
    image.imageUrl,
    image.link,
  ].filter(Boolean).join(' '));
}

function containsKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function entityMatches(text: string, entity: string): boolean {
  const normalizedEntity = normalizeText(entity);
  if (!normalizedEntity) return false;

  if (text.includes(normalizedEntity)) {
    return true;
  }

  const slugVariant = normalizedEntity.replace(/\s+/g, '-');
  return slugVariant.length > 2 && text.includes(slugVariant);
}

function hasRelevantEntityMatch(text: string, entities: string[]): boolean {
  return entities.some((entity) => entityMatches(text, entity));
}

function extractRelevantStudios(articleText: string): string[] {
  const normalized = normalizeText(articleText);
  return OFFICIAL_STUDIO_TERMS.filter((term) => normalized.includes(normalizeText(term)));
}

function classifyContextType(articleText: string): ContextType {
  const normalized = normalizeText(articleText);

  if (/\bposter|character poster|new poster|key art|official image|official poster|first look poster\b/.test(normalized)) return 'poster_announcement';
  if (/\btrailer|teaser|clip|first look\b/.test(normalized)) return 'trailer';
  if (/\bcasting|joins|cast as|starring\b/.test(normalized)) return 'casting';
  if (/\binterview|talks about|speaks on|explains\b/.test(normalized)) return 'interview';
  if (/\bbox office|boxoffice|opens to|debuts at\b/.test(normalized)) return 'boxoffice';
  if (/\bstudio|network|streaming|service|platform|merger|ceo\b/.test(normalized)) return 'industry';
  if (/\brelease|premiere|coming to|set for|arrives\b/.test(normalized)) return 'release';
  return 'general';
}

function resolveImageIntent(
  primaryType: SubjectType,
  contextType: ContextType,
  primaryName: string,
  secondarySubjects: string[],
  relevantStudios: string[]
): { visualSubject: string; imageIntent: ImageIntent; allowLogoOnly: boolean } {
  if (contextType === 'poster_announcement') {
    return {
      visualSubject: primaryName,
      imageIntent: 'poster',
      allowLogoOnly: false,
    };
  }

  if (primaryType === 'studio' || primaryType === 'streaming_service') {
    return {
      visualSubject: primaryName,
      imageIntent: 'logo',
      allowLogoOnly: true,
    };
  }

  if (primaryType === 'actor' || primaryType === 'director' || primaryType === 'producer') {
    const linkedTitle = secondarySubjects.find((subject) => !relevantStudios.includes(subject));
    if (linkedTitle) {
      return {
        visualSubject: linkedTitle,
        imageIntent: 'still',
        allowLogoOnly: false,
      };
    }

    return {
      visualSubject: primaryName,
      imageIntent: 'person_portrait',
      allowLogoOnly: false,
    };
  }

  if (primaryType === 'character') {
    return {
      visualSubject: primaryName,
      imageIntent: 'character_still',
      allowLogoOnly: false,
    };
  }

  return {
    visualSubject: primaryName,
    imageIntent: contextType === 'trailer' ? 'still' : 'backdrop',
    allowLogoOnly: false,
  };
}

function guessPrimarySubject(article: RSSImageSelectionArticle): RSSSubjectAnalysis {
  const articleText = [article.title, article.description, article.author].filter(Boolean).join(' ');
  const studios = extractRelevantStudios(articleText);
  const normalizedTitle = article.title.trim();
  const quotedMatches = Array.from(normalizedTitle.matchAll(/["“']([^"”']{2,80})["”']/g))
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];

  let primaryName = quotedMatches[0] || normalizedTitle;
  let primaryType: SubjectType = 'movie';

  if (studios.length > 0 && /\b(studio|streaming|network|service|platform|disney\+|netflix|max|prime video|apple tv)\b/i.test(articleText)) {
    primaryName = studios[0];
    primaryType = /\b(disney\+|netflix|max|prime video|apple tv|hulu|peacock)\b/i.test(primaryName)
      ? 'streaming_service'
      : 'studio';
  } else if (/\bseason|series|episode|showrunner|tv\b/i.test(articleText)) {
    primaryType = 'tv_show';
  }

  const secondarySubjects = uniqueStrings(
    studios.filter((studio) => normalizeText(studio) !== normalizeText(primaryName))
  );

  const contextType = classifyContextType(articleText);
  const visual = resolveImageIntent(primaryType, contextType, primaryName, secondarySubjects, studios);
  const queries = buildFallbackQueries(visual.visualSubject, primaryType, secondarySubjects, contextType, visual.imageIntent);

  return {
    editorialPrimary: primaryName,
    primarySubject: {
      name: primaryName,
      type: primaryType,
    },
    visualSubject: visual.visualSubject,
    imageIntent: visual.imageIntent,
    secondarySubjects,
    relevantStudios: studios,
    contextType,
    allowLogoOnly: visual.allowLogoOnly,
    queries,
  };
}

function buildFallbackQueries(
  primaryName: string,
  primaryType: SubjectType,
  secondarySubjects: string[],
  contextType: ContextType,
  imageIntent: ImageIntent
): string[] {
  const secondary = secondarySubjects[0];

  switch (imageIntent) {
    case 'logo':
      return uniqueStrings([
        `${primaryName} official logo`,
        `${primaryName} logo dark background`,
        `${primaryName} brand backdrop`,
        primaryName,
      ]);
    case 'brand_backdrop':
      return uniqueStrings([
        `${primaryName} brand backdrop`,
        `${primaryName} official press image`,
        `${primaryName} official logo`,
        primaryName,
      ]);
    case 'person_portrait':
      return uniqueStrings([
        `${primaryName} portrait`,
        `${primaryName} press photo`,
        `${primaryName} headshot`,
        primaryName,
      ]);
    case 'character_still':
      return uniqueStrings([
        `${primaryName} character still`,
        `${primaryName} official still`,
        `${primaryName} scene still`,
        primaryName,
      ]);
    case 'still':
      return uniqueStrings([
        secondary ? `${primaryName} ${secondary} still` : `${primaryName} still`,
        `${primaryName} scene still`,
        `${primaryName} production still`,
        `${primaryName} backdrop`,
      ]);
    case 'backdrop':
      return uniqueStrings([
        `${primaryName} backdrop`,
        `${primaryName} scene still`,
        `${primaryName} production still`,
        `${primaryName} official still`,
        contextType === 'poster_announcement' ? `${primaryName} official poster` : null,
      ]);
    case 'poster':
      return uniqueStrings([
        `${primaryName} official poster`,
        `${primaryName} new poster`,
        `${primaryName} key art`,
        `${primaryName} character poster`,
      ]);
    default:
      return uniqueStrings([
        `${primaryName} still`,
        `${primaryName} backdrop`,
        `${primaryName} production still`,
        primaryName,
      ]);
  }
}

function normalizeSubjectAnalysis(value: any, article: RSSImageSelectionArticle): RSSSubjectAnalysis {
  const fallback = guessPrimarySubject(article);
  const editorialPrimary = typeof value?.editorialPrimary === 'string'
    ? value.editorialPrimary.trim()
    : fallback.editorialPrimary;
  const primaryName = typeof value?.primarySubject?.name === 'string'
    ? value.primarySubject.name.trim()
    : fallback.primarySubject.name;
  const primaryType = typeof value?.primarySubject?.type === 'string'
    ? value.primarySubject.type as SubjectType
    : fallback.primarySubject.type;
  const articleText = [article.title, article.description, article.author].filter(Boolean).join(' ');
  const heuristicStudios = extractRelevantStudios(articleText);
  const relevantStudios = uniqueStrings([
    ...(Array.isArray(value?.relevantStudios) ? value.relevantStudios : []),
    ...heuristicStudios,
  ]);
  const secondarySubjects = uniqueStrings([
    ...(Array.isArray(value?.secondarySubjects) ? value.secondarySubjects : []),
    ...relevantStudios.filter((studio) => normalizeText(studio) !== normalizeText(primaryName)),
  ]).filter((subject) => normalizeText(subject) !== normalizeText(primaryName));
  const contextType = typeof value?.contextType === 'string'
    ? value.contextType as ContextType
    : fallback.contextType;
  const visual = resolveImageIntent(primaryType, contextType, primaryName, secondarySubjects, relevantStudios);
  const visualSubject = typeof value?.visualSubject === 'string'
    ? value.visualSubject.trim()
    : visual.visualSubject;
  const imageIntent = typeof value?.imageIntent === 'string'
    ? value.imageIntent as ImageIntent
    : visual.imageIntent;
  const queries = uniqueStrings(
    Array.isArray(value?.queries)
      ? value.queries
      : buildFallbackQueries(visualSubject, primaryType, secondarySubjects, contextType, imageIntent)
  );

  return {
    editorialPrimary,
    primarySubject: {
      name: primaryName,
      type: primaryType,
    },
    visualSubject,
    imageIntent,
    secondarySubjects,
    relevantStudios,
    contextType,
    allowLogoOnly: value?.allowLogoOnly !== false && (visual.allowLogoOnly || imageIntent === 'logo'),
    queries: queries.length > 0
      ? queries
      : buildFallbackQueries(visualSubject, primaryType, secondarySubjects, contextType, imageIntent),
  };
}

async function extractSubjectAnalysis(
  article: RSSImageSelectionArticle,
  model: string | undefined
): Promise<RSSSubjectAnalysis> {
  const articleText = [
    `Title: ${article.title}`,
    article.description ? `Description: ${article.description}` : null,
    article.author ? `Author: ${article.author}` : null,
  ].filter(Boolean).join('\n');

  try {
    const response = await aiService.generateCompletion({
      model: normalizeAIModel(model, DEFAULT_OPENAI_MODEL),
      prompt: articleText,
      systemPrompt: SUBJECT_EXTRACTION_PROMPT,
      maxTokens: 500,
      temperature: 0.2,
      jsonMode: true,
    });

    if (!response.success || !response.content) {
      return guessPrimarySubject(article);
    }

    const parsed = JSON.parse(response.content);
    return normalizeSubjectAnalysis(parsed, article);
  } catch {
    return guessPrimarySubject(article);
  }
}

async function searchSerperImages(query: string, limit: number): Promise<SerperImageResult[]> {
  const apiKey = await getSecretSetting('serperKey');
  if (!apiKey) {
    return [];
  }

  let tracked = false;

  try {
    const response = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: Math.max(limit, 8),
        gl: 'us',
        hl: 'en',
        type: 'images',
        engine: 'google',
      }),
    });

    const data = await response.json().catch(() => null) as SerperImagesResponse | null;
    await trackApiUsage({
      service: 'serper',
      endpoint: '/images',
      success: response.ok,
    });
    tracked = true;

    if (!response.ok || !Array.isArray(data?.images)) {
      return [];
    }

    return data.images.filter((image) => typeof image?.imageUrl === 'string');
  } catch (error) {
    if (!tracked) {
      await trackApiUsage({
        service: 'serper',
        endpoint: '/images',
        success: false,
      });
    }
    console.error('[RSS] Serper image lookup failed:', error);
    return [];
  }
}

function isBlockedResult(image: SerperImageResult): boolean {
  const text = getSerperImageText(image);
  const domain = normalizeText(image.domain || '');

  if ((image.imageWidth || 0) < MIN_IMAGE_WIDTH || (image.imageHeight || 0) < MIN_IMAGE_HEIGHT) {
    return true;
  }

  if (BLOCKED_DOMAINS.some((blocked) => domain.includes(normalizeText(blocked)))) {
    return true;
  }

  if (STOCK_IMAGE_DOMAINS.some((blocked) => domain.includes(normalizeText(blocked)))) {
    return true;
  }

  if (containsKeyword(text, WATERMARK_KEYWORDS) || containsKeyword(text, BLOCKED_KEYWORDS)) {
    return true;
  }

  return false;
}

function isLogoResult(text: string): boolean {
  return containsKeyword(text, LOGO_KEYWORDS);
}

function isPosterResult(text: string): boolean {
  return containsKeyword(text, POSTER_KEYWORDS);
}

function getAspectRatio(image: SerperImageResult): number | null {
  const width = image.imageWidth || 0;
  const height = image.imageHeight || 0;
  if (!width || !height) return null;
  return width / height;
}

function isTallPosterAspect(image: SerperImageResult): boolean {
  const ratio = getAspectRatio(image);
  return ratio !== null && ratio > 0.55 && ratio < 0.85;
}

function isLandscapeAspect(image: SerperImageResult): boolean {
  const ratio = getAspectRatio(image);
  return ratio !== null && ratio >= 1.3;
}

function getDomainScore(domain: string): number {
  const normalizedDomain = normalizeText(domain);

  if (TRUSTED_DOMAINS.some((trusted) => normalizedDomain.includes(normalizeText(trusted)))) {
    return 25;
  }

  if (GOOD_DOMAINS.some((good) => normalizedDomain.includes(normalizeText(good)))) {
    return 15;
  }

  return 5;
}

function getImageTypeScore(text: string, analysis: RSSSubjectAnalysis): { score: number; reason: string } {
  switch (analysis.imageIntent) {
    case 'logo':
      if (isLogoResult(text)) return { score: 38, reason: 'Relevant official logo' };
      if (containsKeyword(text, BACKDROP_KEYWORDS)) return { score: 18, reason: 'Relevant brand backdrop' };
      return { score: 4, reason: 'Weak logo match' };
    case 'brand_backdrop':
      if (containsKeyword(text, BACKDROP_KEYWORDS)) return { score: 34, reason: 'Relevant brand backdrop' };
      if (isLogoResult(text)) return { score: 22, reason: 'Relevant official logo' };
      return { score: 8, reason: 'Weak brand image match' };
    case 'person_portrait':
      if (containsKeyword(text, PORTRAIT_KEYWORDS)) return { score: 34, reason: 'Relevant official person image' };
      if (containsKeyword(text, STILL_KEYWORDS)) return { score: 12, reason: 'Relevant person-in-title still' };
      return { score: 4, reason: 'Weak portrait match' };
    case 'character_still':
      if (containsKeyword(text, STILL_KEYWORDS)) return { score: 34, reason: 'Relevant character still' };
      if (containsKeyword(text, PORTRAIT_KEYWORDS)) return { score: 16, reason: 'Relevant character image' };
      return { score: 6, reason: 'Weak character image match' };
    case 'still':
      if (containsKeyword(text, STILL_KEYWORDS)) return { score: 34, reason: 'Relevant still or scene image' };
      if (containsKeyword(text, BACKDROP_KEYWORDS)) return { score: 24, reason: 'Relevant backdrop image' };
      return { score: 8, reason: 'Relevant image match' };
    case 'backdrop':
      if (containsKeyword(text, BACKDROP_KEYWORDS)) return { score: 34, reason: 'Relevant backdrop image' };
      if (containsKeyword(text, STILL_KEYWORDS)) return { score: 24, reason: 'Relevant still image' };
      return { score: 8, reason: 'Relevant image match' };
    case 'poster':
      if (isPosterResult(text)) return { score: 36, reason: 'Official poster or key art' };
      if (isLogoResult(text)) return { score: 12, reason: 'Relevant title logo' };
      return { score: 6, reason: 'Weak poster match' };
    default:
      return { score: 8, reason: 'Relevant image match' };
  }
}

function scoreImage(
  image: SerperImageResult,
  analysis: RSSSubjectAnalysis,
  query: string
): ScoredImage | null {
  if (!image.imageUrl || isBlockedResult(image)) {
    return null;
  }

  const text = getSerperImageText(image);
  const relevantEntities = uniqueStrings([
    analysis.visualSubject,
    analysis.primarySubject.name,
    ...analysis.secondarySubjects,
    ...analysis.relevantStudios,
  ]);

  const mentionsRelevantEntity = hasRelevantEntityMatch(text, relevantEntities);
  const relevantStudioMatch = analysis.relevantStudios.some((studio) => entityMatches(text, studio));
  const primaryMatch = entityMatches(text, analysis.visualSubject);
  const isLogo = isLogoResult(text);
  const isPoster = isPosterResult(text);
  const looksOfficial = containsKeyword(text, OFFICIAL_MARKERS) || getDomainScore(image.domain || '') >= 15;

  if (!mentionsRelevantEntity && !relevantStudioMatch) {
    return null;
  }

  if (isLogo && !analysis.allowLogoOnly) {
    return null;
  }

  if (isLogo && !looksOfficial && !relevantStudioMatch) {
    return null;
  }

  let score = 0;

  if (primaryMatch) {
    score += 50;
  } else if (mentionsRelevantEntity) {
    score += 28;
  }

  if (relevantStudioMatch) {
    score += analysis.primarySubject.type === 'studio' || analysis.primarySubject.type === 'streaming_service' ? 35 : 18;
  }

  if (entityMatches(text, query)) {
    score += 12;
  }

  score += getDomainScore(image.domain || '');
  score += Math.min(20, Math.round(((image.imageWidth || 0) * (image.imageHeight || 0)) / 250000));
  score += Math.max(0, 10 - ((image.position || 10) - 1));

  const imageType = getImageTypeScore(text, analysis);
  score += imageType.score;

  if (analysis.imageIntent !== 'poster' && isPoster) {
    score -= 30;
  }

  if ((analysis.imageIntent === 'backdrop' || analysis.imageIntent === 'still' || analysis.imageIntent === 'character_still') && isTallPosterAspect(image)) {
    score -= 25;
  }

  if ((analysis.imageIntent === 'backdrop' || analysis.imageIntent === 'still') && isLandscapeAspect(image)) {
    score += 20;
  }

  if (analysis.imageIntent === 'person_portrait' && isLandscapeAspect(image)) {
    score -= 12;
  }

  if (analysis.contextType === 'trailer' && containsKeyword(text, ['trailer', 'teaser'])) {
    score += 8;
  }

  if ((analysis.contextType === 'release' || analysis.contextType === 'boxoffice' || analysis.contextType === 'poster_announcement') && containsKeyword(text, POSTER_KEYWORDS) && analysis.imageIntent === 'poster') {
    score += 10;
  }

  if ((analysis.contextType === 'interview' || analysis.contextType === 'casting') && containsKeyword(text, PORTRAIT_KEYWORDS)) {
    score += 10;
  }

  return {
    image,
    score,
    reason: imageType.reason,
  };
}

function buildFeedFallbackImages(fallbackImages: string[], limit: number): RSSResolvedImage[] {
  return fallbackImages.slice(0, Math.max(limit, 1)).map((url) => ({
    url,
    reason: 'Feed fallback image',
    source: 'feed',
  }));
}

export async function resolveRelevantRSSImages(
  article: RSSImageSelectionArticle,
  options: {
    serperPriority: boolean;
    limit: number;
    model?: AIModel | string;
  }
): Promise<RSSResolvedImage[]> {
  const fallbackImages = dedupeUrls(article.fallbackImages || []);
  const limit = Math.max(options.limit, 1);

  if (!options.serperPriority) {
    return buildFeedFallbackImages(fallbackImages, limit);
  }

  const analysis = await extractSubjectAnalysis(article, options.model);
  const scoredByUrl = new Map<string, ScoredImage>();

  for (const query of analysis.queries.slice(0, 4)) {
    const results = await searchSerperImages(query, Math.max(limit * 4, 8));

    for (const result of results) {
      if (!result.imageUrl) continue;
      const scored = scoreImage(result, analysis, query);
      if (!scored) continue;

      const current = scoredByUrl.get(result.imageUrl);
      if (!current || scored.score > current.score) {
        scoredByUrl.set(result.imageUrl, scored);
      }
    }

    if (scoredByUrl.size >= limit) {
      break;
    }
  }

  const selected = Array.from(scoredByUrl.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => ({
      url: item.image.imageUrl!,
      reason: item.reason,
      source: 'serper' as const,
      score: item.score,
    }));

  if (selected.length >= limit) {
    return selected;
  }

  const fallback = buildFeedFallbackImages(
    fallbackImages.filter((url) => !selected.some((image) => image.url === url)),
    limit - selected.length
  );

  return [...selected, ...fallback].slice(0, limit);
}
