import { getTmdbApiKey } from './tmdb.service';
import { trackApiUsage } from './api-usage.service';
import { type RSSCanonicalEntity } from './ai.service';
import { renderTMDbLogoCard, shouldRenderTMDbLogoCard } from './rss-logo-render.service';
import { uploadBufferToBackblaze } from './backblaze';
import sharp from 'sharp';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w1280';
const MIN_TMDB_TITLE_SCORE = 180;
const MIN_TMDB_PERSON_SCORE = 170;
const MIN_TMDB_COMPANY_SCORE = 150;
const PERSON_CROP_WIDTH = 1080;
const PERSON_CROP_HEIGHT = 1350;
const MIN_TMDB_BACKDROP_WIDTH = 800;
const MIN_TMDB_BACKDROP_HEIGHT = 450;

type RSSImageIntent =
  | 'poster'
  | 'backdrop'
  | 'still'
  | 'character_still'
  | 'person_portrait'
  | 'logo'
  | 'brand_backdrop';

type RSSSubjectType =
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

export type StructuredTMDbImageRole =
  | 'logo'
  | 'brand_backdrop'
  | 'person'
  | 'character'
  | 'still'
  | 'poster';

export interface StructuredRSSTMDbSelectionInput {
  primarySubject: {
    name: string;
    type: RSSSubjectType;
  };
  canonicalEntity?: RSSCanonicalEntity;
  visualSubject: string;
  secondarySubjects?: string[];
  imageIntent: RSSImageIntent;
  targetFormat?: 'movie' | 'series' | 'general';
  contextProject?: string | null;
  requiredContextTerms: string[];
  relevantStudios: string[];
  queries: string[];
  limit: number;
  excludeUrls?: string[];
}

export interface ResolvedStructuredTMDbImage {
  url: string;
  reason: string;
  score: number;
  role: StructuredTMDbImageRole;
}

interface TMDbSearchResult {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  profile_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
}

interface TMDbImageAsset {
  file_path?: string | null;
  iso_639_1?: string | null;
  vote_average?: number;
  vote_count?: number;
  width?: number;
  height?: number;
  aspect_ratio?: number;
  file_type?: string | null;
}

interface TMDbPersonDetails {
  id: number;
  name?: string;
  profile_path?: string | null;
  known_for_department?: string;
  images?: {
    profiles?: TMDbImageAsset[];
  };
}

interface TMDbProductionEntity {
  id?: number;
  name?: string;
  logo_path?: string | null;
}

interface TMDbMovieDetails {
  id: number;
  title?: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  images?: {
    logos?: TMDbImageAsset[];
    posters?: TMDbImageAsset[];
    backdrops?: TMDbImageAsset[];
  };
  production_companies?: TMDbProductionEntity[];
  credits?: {
    cast?: Array<{ name?: string }>;
    crew?: Array<{ name?: string; job?: string; department?: string }>;
  };
}

interface TMDbTVDetails {
  id: number;
  name?: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  images?: {
    logos?: TMDbImageAsset[];
    posters?: TMDbImageAsset[];
    backdrops?: TMDbImageAsset[];
  };
  production_companies?: TMDbProductionEntity[];
  networks?: TMDbProductionEntity[];
  aggregate_credits?: {
    cast?: Array<{ name?: string }>;
    crew?: Array<{ name?: string; job?: string; department?: string }>;
  };
}

interface TMDbCompanySearchResult {
  id: number;
  name?: string;
  logo_path?: string | null;
}

interface ResolvedTMDbTitleCandidate {
  entityKey: string;
  title: string;
  score: number;
  backdropUrl?: string;
  backdropUrls: string[];
  posterUrl?: string;
  logoUrl?: string;
  projectContextOnly?: boolean;
}

interface CanonicalTMDbEntity {
  name: string;
  specificTitle: string;
  mediaType: 'movie' | 'tv' | 'franchise' | 'person' | 'company' | 'unknown';
  franchise?: string;
  tmdbType: 'movie' | 'tv' | 'multi';
  tmdbQuery: string;
  alternateQueries: string[];
  confidence: number;
  ambiguityFlags: string[];
}

interface BackdropRotationState {
  poolKey: string;
  orderedUrls: string[];
  nextIndex: number;
  lastUsedUrl?: string;
}

const backdropRotationStateByEntity = new Map<string, BackdropRotationState>();
const TITLE_ANCHOR_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);
const GENERIC_DEMOGRAPHIC_TERMS = new Set([
  'gen z',
  'gen alpha',
  'gen x',
  'millennial',
  'millennials',
  'baby boomer',
  'baby boomers',
  'young audiences',
  'young people',
  'audiences',
  'moviegoers',
  'viewers',
  'consumers',
]);
const GENERIC_DEMOGRAPHIC_PROJECT_CUES = /\b(series|show|season|episode|cast|starring|stars|creator|showrunner|director|trailer|teaser|premiere|renewed|canceled|cancelled|production|filming|hbo|max|netflix|disney\+|prime video|paramount\+|apple tv\+)\b/i;
const CONTEXT_SENSITIVE_ENTITY_TERMS = new Set([
  ...GENERIC_DEMOGRAPHIC_TERMS,
  'avatar',
  'foundation',
  'ghosts',
  'bridgerton',
  'you',
  'her',
  'them',
  'shogun',
  'the bear',
  'bear',
]);
const HIGH_AMBIGUITY_CONTEXT_TERMS = new Set([
  'you',
  'her',
  'them',
]);
const CONTEXT_SENSITIVE_PROJECT_CUES = /\b(series|show|season|episode|cast|starring|stars|creator|showrunner|director|directed|trailer|teaser|premiere|renewed|canceled|cancelled|production|filming|hbo|max|netflix|disney\+|prime video|paramount\+|apple tv\+|movie|film|feature|box office|streaming|first look|poster|logo|adaptation|remake|reboot|spinoff|spin-off|character|villain|hero|role|plays|returning|returns as|in theaters|tv)\b/i;
const CONTEXT_SENSITIVE_GENERIC_CUES = /\b(study|survey|report|demographic|demographics|audience|audiences|consumer|consumers|trend|trends|research|analysis|data|statistics|market|behavior|behaviour|habits|generation|young people|moviegoing|merger|acquisition|shareholder|proxy advisor|board|ceo|chief executive|executive|payout|earnings|financial|lawsuit)\b/i;

const DISAMBIGUATION_RULES: Array<{
  match: RegExp;
  resolve: (combinedText: string, input: StructuredRSSTMDbSelectionInput) => Partial<CanonicalTMDbEntity> | null;
}> = [
  {
    match: /\bharry potter\b/i,
    resolve: (combinedText, input) => {
      if (/\b(hbo|max|series|season|episode|showrunner|tv)\b/i.test(combinedText)) {
        return {
          specificTitle: 'Harry Potter',
          mediaType: 'tv',
          tmdbType: 'tv',
          tmdbQuery: 'Harry Potter HBO series',
          alternateQueries: ['Harry Potter TV series', 'Harry Potter HBO'],
          franchise: 'Harry Potter',
          confidence: 0.93,
          ambiguityFlags: ['franchise_disambiguated_to_tv'],
        };
      }
      if (/\b(book|novel|author|publishing)\b/i.test(combinedText)) {
        return {
          specificTitle: 'Harry Potter',
          mediaType: 'franchise',
          tmdbType: 'multi',
          tmdbQuery: 'Harry Potter franchise',
          alternateQueries: ['Harry Potter film series'],
          franchise: 'Harry Potter',
          confidence: 0.58,
          ambiguityFlags: ['book_context_fallback_to_franchise'],
        };
      }
      return {
        specificTitle: 'Harry Potter',
        mediaType: input.targetFormat === 'series' ? 'tv' : 'franchise',
        tmdbType: input.targetFormat === 'series' ? 'tv' : 'multi',
        tmdbQuery: input.targetFormat === 'series' ? 'Harry Potter HBO series' : 'Harry Potter franchise',
        alternateQueries: ['Harry Potter film series'],
        franchise: 'Harry Potter',
        confidence: input.targetFormat === 'series' ? 0.82 : 0.62,
        ambiguityFlags: ['franchise_ambiguous'],
      };
    },
  },
  {
    match: /\bdaredevil\b/i,
    resolve: (combinedText) => {
      if (/\b(born again|mcu|disney\+|disney plus)\b/i.test(combinedText)) {
        return {
          specificTitle: 'Daredevil: Born Again',
          mediaType: 'tv',
          tmdbType: 'tv',
          tmdbQuery: 'Daredevil Born Again',
          alternateQueries: ['Daredevil: Born Again Disney+', 'Daredevil Born Again Marvel'],
          franchise: 'Daredevil',
          confidence: 0.95,
          ambiguityFlags: ['franchise_disambiguated_to_born_again'],
        };
      }
      if (/\b(netflix)\b/i.test(combinedText)) {
        return {
          specificTitle: 'Daredevil',
          mediaType: 'tv',
          tmdbType: 'tv',
          tmdbQuery: 'Daredevil Netflix series',
          alternateQueries: ['Marvel Daredevil Netflix'],
          franchise: 'Daredevil',
          confidence: 0.91,
          ambiguityFlags: ['franchise_disambiguated_to_netflix_series'],
        };
      }
      if (/\b2003\b/i.test(combinedText) || /\bben affleck\b/i.test(combinedText)) {
        return {
          specificTitle: 'Daredevil',
          mediaType: 'movie',
          tmdbType: 'movie',
          tmdbQuery: 'Daredevil 2003',
          alternateQueries: ['Daredevil Ben Affleck'],
          franchise: 'Daredevil',
          confidence: 0.92,
          ambiguityFlags: ['franchise_disambiguated_to_2003_film'],
        };
      }
      return null;
    },
  },
  {
    match: /\bmatrix\b/i,
    resolve: (combinedText) => {
      if (/\b(resurrections|lana wachowski|2021|recent film)\b/i.test(combinedText)) {
        return {
          specificTitle: 'The Matrix Resurrections',
          mediaType: 'movie',
          tmdbType: 'movie',
          tmdbQuery: 'The Matrix Resurrections',
          alternateQueries: ['Matrix Resurrections', 'The Matrix Resurrections 2021'],
          franchise: 'The Matrix',
          confidence: 0.94,
          ambiguityFlags: ['franchise_disambiguated_to_resurrections'],
        };
      }
      return {
        specificTitle: 'The Matrix',
        mediaType: 'franchise',
        tmdbType: 'multi',
        tmdbQuery: 'The Matrix franchise',
        alternateQueries: ['The Matrix', 'Matrix series'],
        franchise: 'The Matrix',
        confidence: 0.68,
        ambiguityFlags: ['franchise_level_fallback'],
      };
    },
  },
  {
    match: /\bwolverine\b/i,
    resolve: (combinedText) => {
      if (/\b(deadpool and wolverine|deadpool & wolverine|2024|ryan reynolds)\b/i.test(combinedText)) {
        return {
          specificTitle: 'Deadpool & Wolverine',
          mediaType: 'movie',
          tmdbType: 'movie',
          tmdbQuery: 'Deadpool & Wolverine',
          alternateQueries: ['Deadpool and Wolverine', 'Deadpool & Wolverine 2024'],
          franchise: 'X-Men',
          confidence: 0.95,
          ambiguityFlags: ['character_disambiguated_to_specific_project'],
        };
      }
      if (/\b(logan|2017|james mangold)\b/i.test(combinedText)) {
        return {
          specificTitle: 'Logan',
          mediaType: 'movie',
          tmdbType: 'movie',
          tmdbQuery: 'Logan 2017',
          alternateQueries: ['Logan Wolverine', 'Logan Hugh Jackman'],
          franchise: 'X-Men',
          confidence: 0.93,
          ambiguityFlags: ['character_disambiguated_to_logan'],
        };
      }
      return null;
    },
  },
  {
    match: /\bspider man\b|\bspider-man\b/i,
    resolve: (combinedText) => {
      if (/\bbrand new day\b/i.test(combinedText)) {
        return {
          specificTitle: 'Spider-Man: Brand New Day',
          mediaType: 'movie',
          tmdbType: 'movie',
          tmdbQuery: 'Spider-Man Brand New Day',
          alternateQueries: ['Spider-Man: Brand New Day'],
          franchise: 'Spider-Man',
          confidence: 0.95,
          ambiguityFlags: ['franchise_disambiguated_to_specific_project'],
        };
      }
      return null;
    },
  },
  {
    match: /\bman of tomorrow\b/i,
    resolve: (combinedText) => {
      if (/\b(superman|james gunn|david corenswet|nicholas hoult|brainiac|john stewart|aaron pierre)\b/i.test(combinedText)) {
        return {
          specificTitle: 'Superman',
          mediaType: 'movie',
          tmdbType: 'movie',
          tmdbQuery: 'Superman 2025',
          alternateQueries: ['Superman', 'James Gunn Superman', 'Superman David Corenswet'],
          franchise: 'Superman',
          confidence: 0.89,
          ambiguityFlags: ['upcoming_sequel_fallback_to_prior_installment'],
        };
      }
      return null;
    },
  },
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const normalized = normalizeText(trimmed);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(trimmed);
  }

  return items;
}

function extractYearTokens(value: string): string[] {
  return Array.from(value.matchAll(/\b(19|20)\d{2}\b/g)).map((match) => match[0]);
}

function buildImageUrl(path?: string | null): string | undefined {
  return path ? `${TMDB_IMAGE_BASE_URL}${path}` : undefined;
}

function getMeaningfulTitleTokens(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token && !TITLE_ANCHOR_STOPWORDS.has(token) && token.length > 2);
}

function slugifyTmdbImageName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'tmdb-person';
}

function getImageIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.toLowerCase()}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function selectBestImageAsset(
  primaryPath: string | null | undefined,
  assets: TMDbImageAsset[] | undefined,
  preferredLanguages: Array<string | null>
): string | undefined {
  if (primaryPath) {
    return buildImageUrl(primaryPath);
  }

  if (!Array.isArray(assets) || assets.length === 0) {
    return undefined;
  }

  const ranked = [...assets]
    .filter((asset) => asset.file_path)
    .sort((left, right) => {
      const leftLanguageRank = preferredLanguages.indexOf(left.iso_639_1 ?? null);
      const rightLanguageRank = preferredLanguages.indexOf(right.iso_639_1 ?? null);
      const leftScore = (leftLanguageRank === -1 ? 0 : 200 - leftLanguageRank * 50)
        + (left.vote_average || 0) * 10
        + (left.vote_count || 0)
        + ((left.width || 0) * (left.height || 0)) / 100000;
      const rightScore = (rightLanguageRank === -1 ? 0 : 200 - rightLanguageRank * 50)
        + (right.vote_average || 0) * 10
        + (right.vote_count || 0)
        + ((right.width || 0) * (right.height || 0)) / 100000;
      return rightScore - leftScore;
    });

  return buildImageUrl(ranked[0]?.file_path);
}

function scoreImageAsset(
  asset: TMDbImageAsset,
  preferredLanguages: Array<string | null>
): number {
  const languageRank = preferredLanguages.indexOf(asset.iso_639_1 ?? null);
  return (languageRank === -1 ? 0 : 200 - languageRank * 50)
    + (asset.vote_average || 0) * 10
    + (asset.vote_count || 0)
    + ((asset.width || 0) * (asset.height || 0)) / 100000;
}

function shuffleBackdropUrls(urls: string[]): string[] {
  const shuffled = [...urls];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function collectBackdropCandidates(
  primaryPath: string | null | undefined,
  assets: TMDbImageAsset[] | undefined,
  preferredLanguages: Array<string | null>
): string[] {
  const ranked = new Map<string, { url: string; score: number }>();

  if (primaryPath) {
    const primaryUrl = buildImageUrl(primaryPath);
    if (primaryUrl) {
      ranked.set(primaryPath, {
        url: primaryUrl,
        score: 1000000,
      });
    }
  }

  for (const asset of assets || []) {
    const filePath = asset.file_path?.trim();
    if (!filePath) {
      continue;
    }

    if (
      (typeof asset.width === 'number' && asset.width < MIN_TMDB_BACKDROP_WIDTH)
      || (typeof asset.height === 'number' && asset.height < MIN_TMDB_BACKDROP_HEIGHT)
    ) {
      continue;
    }

    const url = buildImageUrl(filePath);
    if (!url) {
      continue;
    }

    const nextScore = scoreImageAsset(asset, preferredLanguages);
    const existing = ranked.get(filePath);
    if (!existing || nextScore > existing.score) {
      ranked.set(filePath, { url, score: nextScore });
    }
  }

  return [...ranked.values()]
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.url);
}

function rotateBackdropCandidates(entityKey: string, urls: string[]): string[] {
  if (urls.length <= 1) {
    return urls;
  }

  const poolKey = urls.join('|');
  let state = backdropRotationStateByEntity.get(entityKey);

  // Keep a lightweight per-entity rotation so RSS posts don't pin to one backdrop forever.
  if (
    !state
    || state.poolKey !== poolKey
    || state.orderedUrls.length !== urls.length
    || state.orderedUrls.some((url) => !urls.includes(url))
  ) {
    const orderedUrls = shuffleBackdropUrls(urls);
    if (state?.lastUsedUrl && orderedUrls[0] === state.lastUsedUrl) {
      const alternateIndex = orderedUrls.findIndex((url) => url !== state?.lastUsedUrl);
      if (alternateIndex > 0) {
        [orderedUrls[0], orderedUrls[alternateIndex]] = [orderedUrls[alternateIndex], orderedUrls[0]];
      }
    }

    state = {
      poolKey,
      orderedUrls,
      nextIndex: 0,
      lastUsedUrl: state?.lastUsedUrl,
    };
  }

  let selectedIndex = state.nextIndex % state.orderedUrls.length;
  if (state.lastUsedUrl && state.orderedUrls[selectedIndex] === state.lastUsedUrl) {
    const alternateIndex = state.orderedUrls.findIndex((url) => url !== state?.lastUsedUrl);
    if (alternateIndex >= 0) {
      selectedIndex = alternateIndex;
    }
  }

  const selectedUrl = state.orderedUrls[selectedIndex];
  state.nextIndex = (selectedIndex + 1) % state.orderedUrls.length;
  state.lastUsedUrl = selectedUrl;
  backdropRotationStateByEntity.set(entityKey, state);

  return [
    selectedUrl,
    ...state.orderedUrls.filter((url) => url !== selectedUrl),
  ];
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = await getTmdbApiKey();
  if (!apiKey) {
    throw new Error('TMDb API key not configured');
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  let tracked = false;

  try {
    const response = await fetch(url.toString());
    await trackApiUsage({
      service: 'tmdb',
      endpoint,
      success: response.ok,
    });
    tracked = true;

    if (!response.ok) {
      throw new Error(`TMDb request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (!tracked) {
      await trackApiUsage({
        service: 'tmdb',
        endpoint,
        success: false,
      });
    }

    throw error;
  }
}

function scoreAliasMatch(subject: string, aliases: Array<string | null | undefined>): number {
  const normalizedSubject = normalizeText(subject);
  if (!normalizedSubject) {
    return 0;
  }

  const subjectTokens = normalizedSubject.split(' ').filter(Boolean);
  let bestScore = 0;

  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias || '');
    if (!normalizedAlias) continue;

    if (normalizedAlias === normalizedSubject) {
      bestScore = Math.max(bestScore, 260);
      continue;
    }

    if (normalizedAlias.includes(normalizedSubject) || normalizedSubject.includes(normalizedAlias)) {
      bestScore = Math.max(bestScore, 220);
      continue;
    }

    const aliasTokens = new Set(normalizedAlias.split(' ').filter(Boolean));
    const overlap = subjectTokens.filter((token) => aliasTokens.has(token)).length;
    if (overlap > 0) {
      bestScore = Math.max(bestScore, (overlap / Math.max(subjectTokens.length, 1)) * 180);
    }
  }

  return bestScore;
}

function scoreContextTerms(text: string, requiredContextTerms: string[], yearTokens: string[]): number {
  const haystack = normalizeText(text);
  let score = 0;

  for (const term of requiredContextTerms) {
    const normalizedTerm = normalizeText(term);
    if (normalizedTerm && haystack.includes(normalizedTerm)) {
      score += normalizedTerm.length > 12 ? 35 : 25;
    }
  }

  for (const year of yearTokens) {
    if (haystack.includes(year)) {
      score += 30;
    }
  }

  return Math.min(score, 120);
}

function scoreTargetFormatMatch(
  targetFormat: 'movie' | 'series' | 'general',
  mediaType: 'movie' | 'tv' | undefined
): number {
  if (targetFormat === 'general' || !mediaType) {
    return 0;
  }

  if (targetFormat === 'movie') {
    return mediaType === 'movie' ? 95 : -140;
  }

  if (targetFormat === 'series') {
    return mediaType === 'tv' ? 95 : -120;
  }

  return 0;
}

function collectCrewNames(crew: Array<{ name?: string; job?: string; department?: string }> | undefined): string[] {
  return (crew || [])
    .filter((member) => member.department === 'Directing' || member.department === 'Production' || member.job === 'Director' || member.job === 'Producer')
    .map((member) => member.name)
    .filter((name): name is string => Boolean(name));
}

function isPersonLedInput(input: StructuredRSSTMDbSelectionInput): boolean {
  return input.imageIntent === 'person_portrait'
    || input.primarySubject.type === 'actor'
    || input.primarySubject.type === 'director'
    || input.primarySubject.type === 'producer';
}

function isCorporateCompanyInput(input: StructuredRSSTMDbSelectionInput): boolean {
  const combined = uniqueStrings([
    input.primarySubject.name,
    input.visualSubject,
    input.contextProject || null,
    ...input.secondarySubjects || [],
    ...input.requiredContextTerms,
    ...input.relevantStudios,
    ...input.queries,
  ]).join(' ');

  return (
    input.primarySubject.type === 'studio' ||
    input.primarySubject.type === 'streaming_service' ||
    /\b(?:merger|acquisition|shareholder|proxy advisor|institutional shareholder services|board|ceo|chief executive|executive pay|payout|earnings|financial|lawsuit)\b/i.test(combined)
  ) && input.relevantStudios.length > 0;
}

function hasGenericShortProjectAnchor(anchor: string): boolean {
  const tokens = normalizeText(anchor).split(' ').filter(Boolean);
  if (tokens.length === 0 || tokens.length > 3) {
    return false;
  }

  const genericTokens = new Set([
    'drama',
    'series',
    'movie',
    'film',
    'story',
    'show',
    'project',
    'thriller',
    'comedy',
    'romance',
    'mystery',
  ]);

  return tokens.every((token) => genericTokens.has(token) || token.length <= 4);
}

function scoreTitleAnchorCandidate(value: string, preferPrimary = false): number {
  const tokens = getMeaningfulTitleTokens(value);
  return (preferPrimary ? 60 : 0)
    + tokens.length * 40
    + value.trim().length
    + Math.min(tokens.join(' ').length, 60);
}

function isGenericDemographicTerm(value: string, contextText?: string): boolean {
  if (!GENERIC_DEMOGRAPHIC_TERMS.has(normalizeText(value))) {
    return false;
  }

  return !GENERIC_DEMOGRAPHIC_PROJECT_CUES.test(contextText || '');
}

function getContextualCandidateSnippet(contextText: string, candidate: string): string {
  const normalizedContext = normalizeText(contextText);
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedContext || !normalizedCandidate) {
    return normalizedContext;
  }

  const pattern = new RegExp(`\\b${escapeRegExp(normalizedCandidate)}\\b`, 'g');
  const snippets: string[] = [];

  for (const match of normalizedContext.matchAll(pattern)) {
    const index = match.index ?? -1;
    if (index < 0) {
      continue;
    }

    const start = Math.max(0, index - 120);
    const end = Math.min(normalizedContext.length, index + normalizedCandidate.length + 120);
    snippets.push(normalizedContext.slice(start, end).trim());
    if (snippets.length >= 3) {
      break;
    }
  }

  return snippets.join(' ');
}

function classifyContextSensitiveEntityUsage(
  candidate: string,
  contextText: string
): 'media_entity' | 'generic' | 'ambiguous' {
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedCandidate || !CONTEXT_SENSITIVE_ENTITY_TERMS.has(normalizedCandidate)) {
    return 'media_entity';
  }

  if (new RegExp(`["'â€œâ€]${escapeRegExp(candidate.trim())}["'â€œâ€]`, 'i').test(contextText)) {
    return 'media_entity';
  }

  const snippet = getContextualCandidateSnippet(contextText, candidate);
  const combined = `${normalizeText(contextText)} ${snippet}`.trim();
  const hasProjectCue = CONTEXT_SENSITIVE_PROJECT_CUES.test(combined);
  const hasGenericCue = CONTEXT_SENSITIVE_GENERIC_CUES.test(combined);

  if (GENERIC_DEMOGRAPHIC_TERMS.has(normalizedCandidate)) {
    if (hasProjectCue) {
      return 'media_entity';
    }

    return hasGenericCue ? 'generic' : 'ambiguous';
  }

  if (HIGH_AMBIGUITY_CONTEXT_TERMS.has(normalizedCandidate)) {
    return hasProjectCue ? 'media_entity' : 'generic';
  }

  if (hasProjectCue && !hasGenericCue) {
    return 'media_entity';
  }

  if (hasGenericCue && !hasProjectCue) {
    return 'generic';
  }

  return 'ambiguous';
}

function buildDisambiguationText(input: StructuredRSSTMDbSelectionInput): string {
  return uniqueStrings([
    input.primarySubject.name,
    input.visualSubject,
    input.contextProject || null,
    ...(input.secondarySubjects || []),
    ...input.requiredContextTerms,
    ...input.relevantStudios,
    ...input.queries,
  ]).join(' ');
}

function inferDisambiguationMediaType(input: StructuredRSSTMDbSelectionInput, combinedText: string): CanonicalTMDbEntity['mediaType'] {
  if (input.primarySubject.type === 'actor' || input.primarySubject.type === 'director' || input.primarySubject.type === 'producer') {
    return 'person';
  }
  if (input.primarySubject.type === 'studio' || input.primarySubject.type === 'streaming_service') {
    return 'company';
  }
  if (input.targetFormat === 'movie' || /\b(movie|film|theatrical|box office)\b/i.test(combinedText)) {
    return 'movie';
  }
  if (input.targetFormat === 'series' || /\b(series|season|episode|showrunner|hbo|max|netflix|tv)\b/i.test(combinedText)) {
    return 'tv';
  }
  if (input.primarySubject.type === 'franchise') {
    return 'franchise';
  }
  return 'unknown';
}

function buildEntityCandidates(input: StructuredRSSTMDbSelectionInput): string[] {
  const combinedText = buildDisambiguationText(input);
  return uniqueStrings([
    input.contextProject || null,
    input.primarySubject.name,
    input.visualSubject,
    ...(input.secondarySubjects || []),
    ...input.requiredContextTerms,
    ...input.queries,
  ]).filter((candidate) => classifyContextSensitiveEntityUsage(candidate, combinedText) !== 'generic');
}

function buildInstallmentFallbackQueries(title: string, mediaType: CanonicalTMDbEntity['mediaType']): string[] {
  const trimmed = title.trim();
  if (!trimmed) {
    return [];
  }

  const results: string[] = [];
  const seasonMatch = trimmed.match(/^(.*?)(?:\s+season\s+)(\d+)$/i);
  if (seasonMatch) {
    const baseTitle = seasonMatch[1]?.trim();
    const seasonNumber = Number(seasonMatch[2]);
    if (baseTitle) {
      results.push(baseTitle);
      if (seasonNumber > 1) {
        results.push(`${baseTitle} Season ${seasonNumber - 1}`);
      }
    }
    return uniqueStrings(results);
  }

  const partMatch = trimmed.match(/^(.*?)(?:\s+part\s+)(\d+)$/i);
  if (partMatch) {
    const baseTitle = partMatch[1]?.trim();
    const partNumber = Number(partMatch[2]);
    if (baseTitle && partNumber > 1) {
      results.push(`${baseTitle} Part ${partNumber - 1}`);
    }
    return uniqueStrings(results);
  }

  const numericMatch = trimmed.match(/^(.*?)(?:\s+)(\d+)$/);
  if (numericMatch) {
    const baseTitle = numericMatch[1]?.trim();
    const installmentNumber = Number(numericMatch[2]);
    if (baseTitle && installmentNumber > 1) {
      results.push(`${baseTitle} ${installmentNumber - 1}`);
      if (mediaType === 'tv') {
        results.push(baseTitle);
      }
    }
  }

  return uniqueStrings(results);
}

function resolveCanonicalTMDbEntity(input: StructuredRSSTMDbSelectionInput): CanonicalTMDbEntity {
  const combinedText = buildDisambiguationText(input);
  const candidates = buildEntityCandidates(input);
  const canonicalPrimary = input.canonicalEntity?.primarySubject?.trim();
  const canonicalMediaTitle = input.canonicalEntity?.mediaTitle?.trim();
  const canonicalFranchise = input.canonicalEntity?.franchise?.trim();
  const primaryName = canonicalPrimary || canonicalMediaTitle || input.primarySubject.name.trim() || input.visualSubject.trim() || input.contextProject?.trim() || candidates[0] || '';
  const inferredMediaType = inferDisambiguationMediaType(input, combinedText);
  const primaryUsage = classifyContextSensitiveEntityUsage(primaryName, combinedText);

  if (
    isGenericDemographicTerm(primaryName, combinedText)
    || primaryUsage === 'generic'
    || (candidates.length > 0 && candidates.every((candidate) => classifyContextSensitiveEntityUsage(candidate, combinedText) === 'generic'))
  ) {
    return {
      name: primaryName || 'general topic',
      specificTitle: primaryName || 'general topic',
      mediaType: 'unknown',
      tmdbType: 'multi',
      tmdbQuery: '',
      alternateQueries: [],
      confidence: 0.1,
      ambiguityFlags: primaryUsage === 'generic' && !isGenericDemographicTerm(primaryName, combinedText)
        ? ['context_sensitive_term_not_a_tmdb_entity']
        : ['generic_demographic_not_a_tmdb_entity'],
    };
  }

  for (const rule of DISAMBIGUATION_RULES) {
    if (rule.match.test(combinedText)) {
      const resolved = rule.resolve(combinedText, input);
      if (resolved) {
        return {
          name: primaryName,
          specificTitle: resolved.specificTitle || primaryName,
          mediaType: resolved.mediaType || inferredMediaType,
          franchise: resolved.franchise,
          tmdbType: resolved.tmdbType || (resolved.mediaType === 'tv' ? 'tv' : resolved.mediaType === 'movie' ? 'movie' : 'multi'),
          tmdbQuery: resolved.tmdbQuery || primaryName,
          alternateQueries: resolved.alternateQueries || candidates.filter((candidate) => normalizeText(candidate) !== normalizeText(resolved.tmdbQuery || primaryName)).slice(0, 4),
          confidence: resolved.confidence ?? 0.75,
          ambiguityFlags: resolved.ambiguityFlags || [],
        };
      }
    }
  }

  const specificTitle = canonicalMediaTitle || input.contextProject?.trim() || input.visualSubject.trim() || primaryName;
  const tmdbType = inferredMediaType === 'tv' ? 'tv' : inferredMediaType === 'movie' ? 'movie' : 'multi';
  const installmentFallbackQueries = buildInstallmentFallbackQueries(specificTitle, inferredMediaType);
  return {
    name: primaryName,
    specificTitle,
    mediaType: inferredMediaType,
    franchise: canonicalFranchise || (input.primarySubject.type === 'franchise' ? primaryName : undefined),
    tmdbType,
    tmdbQuery: specificTitle,
    alternateQueries: uniqueStrings([
      ...candidates.filter((candidate) => normalizeText(candidate) !== normalizeText(specificTitle)).slice(0, 4),
      ...installmentFallbackQueries,
    ]).slice(0, 6),
    confidence: input.contextProject ? 0.82 : 0.64,
    ambiguityFlags: input.contextProject ? [] : ['unresolved_specific_project'],
  };
}

function buildTitleSearchAnchor(input: StructuredRSSTMDbSelectionInput): string | null {
  const canonicalEntity = resolveCanonicalTMDbEntity(input);
  if (canonicalEntity.tmdbQuery) {
    return canonicalEntity.tmdbQuery;
  }

  if (isCorporateCompanyInput(input)) {
    return null;
  }

  const candidates: Array<{ value: string; preferPrimary?: boolean }> = [];
  const primaryName = input.primarySubject.name.trim();

  if (
    primaryName &&
    (
      input.primarySubject.type === 'movie' ||
      input.primarySubject.type === 'tv_show' ||
      input.primarySubject.type === 'franchise'
    )
  ) {
    candidates.push({ value: primaryName, preferPrimary: true });
  }

  const contextProject = input.contextProject?.trim();
  if (contextProject) {
    const normalizedContextProject = normalizeText(contextProject);
    const contextMatchesStudio = input.relevantStudios.some(
      (studio) => normalizeText(studio) === normalizedContextProject
    );

    if (!contextMatchesStudio && !(isPersonLedInput(input) && hasGenericShortProjectAnchor(contextProject))) {
      candidates.push({ value: contextProject });
    }
  }

  const visualSubject = input.visualSubject.trim();
  if (visualSubject && normalizeText(visualSubject) !== normalizeText(primaryName)) {
    candidates.push({ value: visualSubject });
  }

  for (const query of input.queries) {
    const trimmed = query.trim();
    if (!trimmed) {
      continue;
    }

    candidates.push({
      value: trimmed,
      preferPrimary: normalizeText(trimmed) === normalizeText(primaryName),
    });
  }

  const ranked = uniqueStrings(candidates.map((candidate) => candidate.value))
    .map((value) => ({
      value,
      score: scoreTitleAnchorCandidate(
        value,
        candidates.some((candidate) => normalizeText(candidate.value) === normalizeText(value) && candidate.preferPrimary)
      ),
    }))
    .filter((candidate) => {
      if (candidate.score <= 0) {
        return false;
      }

      if (!isPersonLedInput(input)) {
        return true;
      }

      return !hasGenericShortProjectAnchor(candidate.value);
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.value || null;
}

function buildTitleSupportingContextTerms(
  input: StructuredRSSTMDbSelectionInput,
  anchor: string
): string[] {
  const normalizedAnchor = normalizeText(anchor);
  return uniqueStrings([
    input.contextProject || null,
    input.visualSubject,
    ...input.requiredContextTerms,
    ...input.queries,
  ]).filter((term) => normalizeText(term) !== normalizedAnchor);
}

function titleMatchesProjectContext(
  input: StructuredRSSTMDbSelectionInput,
  title: string,
  overview: string
): boolean {
  const normalizedContextProject = normalizeText(input.contextProject || '');
  if (normalizedContextProject) {
    const explicitProjectMatch = scoreAliasMatch(input.contextProject || '', [title, overview]);
    if (explicitProjectMatch >= 140) {
      return true;
    }

    if (explicitProjectMatch < 70) {
      return false;
    }
  }

  const contextTerms = uniqueStrings([
    input.contextProject || null,
    input.visualSubject,
    ...input.requiredContextTerms,
  ]);

  if (contextTerms.length === 0) {
    return false;
  }

  const matchScore = scoreContextTerms([title, overview].join(' '), contextTerms, []);
  return matchScore >= 55;
}

function getTitleTokenOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(getMeaningfulTitleTokens(left));
  const rightTokens = new Set(getMeaningfulTitleTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function titleCandidateMatchesResolvedContext(
  candidateTitle: string,
  input: StructuredRSSTMDbSelectionInput
): boolean {
  const normalizedCandidate = normalizeText(candidateTitle);
  if (!normalizedCandidate) {
    return false;
  }

  const projectAnchors = uniqueStrings([
    input.canonicalEntity?.mediaTitle,
    input.contextProject || null,
    isPersonLedInput(input) ? null : input.visualSubject,
  ]).filter(Boolean);

  if (projectAnchors.length === 0) {
    return true;
  }

  const normalizedProjectAnchors = projectAnchors.map((anchor) => normalizeText(anchor));
  if (normalizedProjectAnchors.some((anchor) => anchor === normalizedCandidate || normalizedCandidate.includes(anchor))) {
    return true;
  }

  if (projectAnchors.some((anchor) => getTitleTokenOverlapScore(anchor, candidateTitle) >= 0.4)) {
    return true;
  }

  const articleContext = uniqueStrings([
    input.canonicalEntity?.mediaTitle,
    input.contextProject || null,
    input.visualSubject,
    ...(input.requiredContextTerms || []),
    ...(input.secondarySubjects || []),
  ]).join(' ');
  const normalizedArticleContext = normalizeText(articleContext);

  return normalizedProjectAnchors.some((anchor) =>
    normalizedArticleContext.includes(anchor) && normalizedCandidate.includes(anchor)
  );
}

function isRejectedBrandingTitleCandidate(
  candidateTitle: string,
  input: StructuredRSSTMDbSelectionInput
): boolean {
  const normalizedCandidate = normalizeText(candidateTitle);
  if (!normalizedCandidate) {
    return false;
  }

  if (!/\b(first look|presentation|preview|promo|upfront|network)\b/i.test(candidateTitle)) {
    return false;
  }

  const projectAnchors = uniqueStrings([
    input.canonicalEntity?.mediaTitle,
    input.contextProject || null,
    isPersonLedInput(input) ? null : input.visualSubject,
  ]).map((anchor) => normalizeText(anchor));

  return !projectAnchors.some((anchor) => anchor && normalizedCandidate.includes(anchor));
}

function titleCandidateMatchesPersonContext(
  input: StructuredRSSTMDbSelectionInput,
  title: string,
  overview: string,
  castNames: string[],
  crewNames: string[]
): boolean {
  if (!isPersonLedInput(input)) {
    return true;
  }

  const personName = input.primarySubject.name.trim();
  if (!personName) {
    return true;
  }

  const personMatchScore = scoreAliasMatch(personName, [
    ...castNames,
    ...crewNames,
    title,
    overview,
    input.visualSubject,
  ]);

  if (personMatchScore >= 220) {
    return true;
  }

  const contextTerms = uniqueStrings([
    input.contextProject || null,
    ...input.requiredContextTerms,
  ]);
  const contextMatchScore = scoreContextTerms(
    [title, overview].join(' '),
    contextTerms,
    []
  );

  // For person-led stories, only trust title assets when the title matches context strongly
  // and the primary person is actually tied to that TMDb result.
  return contextMatchScore >= 55 && personMatchScore >= 120;
}

async function resolveTitleCandidate(input: StructuredRSSTMDbSelectionInput): Promise<ResolvedTMDbTitleCandidate | null> {
  const canonicalEntity = resolveCanonicalTMDbEntity(input);
  const anchor = canonicalEntity.tmdbQuery || buildTitleSearchAnchor(input);
  if (!anchor) {
    return null;
  }

  const preferredFormat = canonicalEntity.mediaType === 'movie'
    ? 'movie'
    : canonicalEntity.mediaType === 'tv'
      ? 'series'
      : (input.targetFormat ?? 'general');

  const queries = uniqueStrings([
    anchor,
    ...canonicalEntity.alternateQueries,
    ...input.queries,
  ]).slice(0, 4);

  if (queries.length === 0) {
    return null;
  }

  const supportingContextTerms = buildTitleSupportingContextTerms(input, anchor);

  const yearTokens = extractYearTokens([
    canonicalEntity.specificTitle,
    canonicalEntity.franchise,
    input.primarySubject.name,
    input.visualSubject,
    input.contextProject,
    ...input.requiredContextTerms,
  ].filter(Boolean).join(' '));

  try {
    const searchResponses = await Promise.all(
      queries.map((query) =>
        tmdbFetch<{ results?: TMDbSearchResult[] }>('/search/multi', {
          query,
          language: 'en-US',
          include_adult: 'false',
          page: '1',
        }).catch(() => ({ results: [] }))
      )
    );

    const candidates = new Map<string, TMDbSearchResult>();
    for (const response of searchResponses) {
      for (const candidate of response.results || []) {
        if (candidate.media_type !== 'movie' && candidate.media_type !== 'tv') {
          continue;
        }

        const key = `${candidate.media_type}:${candidate.id}`;
        if (!candidates.has(key)) {
          candidates.set(key, candidate);
        }
      }
    }

    const ranked = [...candidates.values()]
      .map((candidate) => {
        const candidateMediaType =
          candidate.media_type === 'movie' || candidate.media_type === 'tv'
            ? candidate.media_type
            : undefined;

        return {
          candidate,
          score: scoreAliasMatch(anchor, [
            candidate.title,
            candidate.name,
            candidate.original_title,
            candidate.original_name,
            canonicalEntity.specificTitle,
          ])
            + scoreTargetFormatMatch(preferredFormat, candidateMediaType)
            + scoreContextTerms(
              [candidate.overview, candidate.title, candidate.name].filter(Boolean).join(' '),
              input.requiredContextTerms,
              yearTokens
            )
            + scoreContextTerms(
              [candidate.overview, candidate.title, candidate.name].filter(Boolean).join(' '),
              supportingContextTerms,
              []
            )
            + Math.min(candidate.popularity || 0, 80) / 2,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);

    for (const { candidate, score } of ranked) {
      if (score < MIN_TMDB_TITLE_SCORE) {
        continue;
      }

      const details = candidate.media_type === 'movie'
        ? await tmdbFetch<TMDbMovieDetails>(`/movie/${candidate.id}`, {
            append_to_response: 'images,credits',
            include_image_language: 'en,null',
          }).catch(() => null)
        : await tmdbFetch<TMDbTVDetails>(`/tv/${candidate.id}`, {
            append_to_response: 'images,aggregate_credits',
            include_image_language: 'en,null',
          }).catch(() => null);

      if (!details) {
        continue;
      }

      const movieDetails = 'title' in details ? details : null;
      const tvDetails = 'aggregate_credits' in details ? details : null;
      const title = movieDetails
        ? (movieDetails.title || candidate.title || 'Untitled')
        : (tvDetails?.name || candidate.name || 'Untitled');

      if (!titleCandidateMatchesResolvedContext(title, input)) {
        continue;
      }

      if (isRejectedBrandingTitleCandidate(title, input)) {
        continue;
      }

      const overview = normalizeText(details.overview || candidate.overview || '');
      const castNames = movieDetails
        ? (movieDetails.credits?.cast || [])
          .map((person: { name?: string }) => person.name)
          .filter((name): name is string => Boolean(name))
        : (tvDetails?.aggregate_credits?.cast || [])
          .map((person: { name?: string }) => person.name)
          .filter((name): name is string => Boolean(name));
      const crewNames = movieDetails
        ? collectCrewNames(movieDetails.credits?.crew)
        : collectCrewNames(tvDetails?.aggregate_credits?.crew);
      const productionNames = [
        ...(details.production_companies || []).map((entity) => entity.name),
        ...('networks' in details ? (details.networks || []).map((entity) => entity.name) : []),
      ].filter((name): name is string => Boolean(name));

      const enrichedScore = score
        + scoreContextTerms(
          [
            title,
            overview,
            ...castNames,
            ...crewNames,
            ...productionNames,
          ].join(' '),
          input.requiredContextTerms,
          yearTokens
        )
        + scoreContextTerms(
          [
            title,
            overview,
            ...castNames,
            ...crewNames,
            ...productionNames,
          ].join(' '),
          supportingContextTerms,
          []
        )
        + scoreAliasMatch(anchor, [title]);

      if (enrichedScore < MIN_TMDB_TITLE_SCORE) {
        continue;
      }

      const matchesPersonContext = titleCandidateMatchesPersonContext(input, title, overview, castNames, crewNames);
      const projectContextOnly = !matchesPersonContext && titleMatchesProjectContext(input, title, overview);

      if (!matchesPersonContext && !projectContextOnly) {
        continue;
      }

      const entityKey = `${candidate.media_type}:${candidate.id}`;
      const backdropUrls = rotateBackdropCandidates(
        entityKey,
        collectBackdropCandidates(details.backdrop_path, details.images?.backdrops, [null, 'en'])
      );

      return {
        entityKey,
        title,
        score: enrichedScore,
        backdropUrls,
        backdropUrl: backdropUrls[0],
        posterUrl: selectBestImageAsset(details.poster_path, details.images?.posters, ['en', null]),
        logoUrl: selectBestImageAsset(undefined, details.images?.logos, ['en', null]),
        projectContextOnly,
      };
    }
  } catch (error) {
    console.error('[RSS][TMDb] Failed to resolve title asset:', error);
  }

  return null;
}

async function resolvePersonProfile(input: StructuredRSSTMDbSelectionInput): Promise<ResolvedStructuredTMDbImage | null> {
  const personName = input.primarySubject.name.trim();
  if (!personName) {
    return null;
  }

  try {
    const response = await tmdbFetch<{ results?: Array<TMDbSearchResult & { known_for_department?: string }> }>('/search/person', {
      query: personName,
      language: 'en-US',
      include_adult: 'false',
      page: '1',
    }).catch(() => ({ results: [] }));

    const ranked = (response.results || [])
      .map((candidate) => ({
        candidate,
        score: scoreAliasMatch(personName, [candidate.name, candidate.original_name])
          + Math.min(candidate.popularity || 0, 80) / 2,
      }))
      .sort((left, right) => right.score - left.score);

    const best = ranked[0];
    if (!best || best.score < MIN_TMDB_PERSON_SCORE) {
      return null;
    }

    if (normalizeText(best.candidate.name || '') !== normalizeText(personName) && best.score < 260) {
      return null;
    }

    const details = await tmdbFetch<TMDbPersonDetails>(`/person/${best.candidate.id}`, {
      append_to_response: 'images',
      include_image_language: 'en,null',
    }).catch(() => null);

    if (!details) {
      return null;
    }

    const url = selectBestImageAsset(details.profile_path, details.images?.profiles, ['en', null]);
    if (!url) {
      return null;
    }

    return {
      url,
      score: best.score,
      role: 'person',
      reason: `TMDb person profile for ${details.name || personName}`,
    };
  } catch (error) {
    console.error('[RSS][TMDb] Failed to resolve person profile:', error);
    return null;
  }
}

async function resolveCompanyLogo(input: StructuredRSSTMDbSelectionInput): Promise<ResolvedStructuredTMDbImage | null> {
  const candidates = uniqueStrings([
    input.primarySubject.type === 'studio' || input.primarySubject.type === 'streaming_service'
      ? input.primarySubject.name
      : null,
    ...input.relevantStudios,
  ]);

  for (const companyName of candidates) {
    try {
      const response = await tmdbFetch<{ results?: TMDbCompanySearchResult[] }>('/search/company', {
        query: companyName,
        page: '1',
      }).catch(() => ({ results: [] }));

      const ranked = (response.results || [])
        .map((candidate) => ({
          candidate,
          score: scoreAliasMatch(companyName, [candidate.name]),
        }))
        .sort((left, right) => right.score - left.score);

      const best = ranked[0];
      const url = buildImageUrl(best?.candidate.logo_path);
      if (!best || best.score < MIN_TMDB_COMPANY_SCORE || !url) {
        continue;
      }

      return {
        url,
        score: best.score,
        role: input.imageIntent === 'brand_backdrop' ? 'brand_backdrop' : 'logo',
        reason: `TMDb company logo for ${best.candidate.name || companyName}`,
      };
    } catch (error) {
      console.error('[RSS][TMDb] Failed to resolve company logo:', error);
    }
  }

  return null;
}

function dedupeResolvedImages(images: ResolvedStructuredTMDbImage[], excludeUrls: string[]): ResolvedStructuredTMDbImage[] {
  const excluded = new Set(excludeUrls.map((url) => getImageIdentity(url)));
  const seen = new Set<string>();

  return images.filter((image) => {
    const identity = getImageIdentity(image.url);
    if (excluded.has(identity) || seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });
}

async function finalizeResolvedImage(
  image: ResolvedStructuredTMDbImage,
  input: StructuredRSSTMDbSelectionInput
): Promise<ResolvedStructuredTMDbImage> {
  if (image.role === 'person') {
    try {
      const response = await fetch(image.url);
      if (!response.ok) {
        throw new Error(`TMDb person image download failed with status ${response.status}`);
      }

      const sourceBuffer = Buffer.from(await response.arrayBuffer());
      const croppedBuffer = await sharp(sourceBuffer)
        .rotate()
        .resize(PERSON_CROP_WIDTH, PERSON_CROP_HEIGHT, {
          fit: 'cover',
          position: sharp.strategy.attention,
          withoutEnlargement: false,
        })
        .jpeg({
          quality: 92,
          mozjpeg: true,
        })
        .toBuffer();

      const uploadResult = await uploadBufferToBackblaze(
        croppedBuffer,
        `${slugifyTmdbImageName(image.reason)}-portrait-4x5.jpg`,
        {
          prefix: 'rss/tmdb-people',
          contentType: 'image/jpeg',
        },
      );

      return {
        ...image,
        url: uploadResult.url,
        reason: `${image.reason} cropped to 4:5 portrait`,
        score: image.score + 3,
      };
    } catch (error) {
      console.warn('[RSS][TMDb] Failed to crop TMDb person image, using raw portrait.', error);
      return image;
    }
  }

  if (image.role !== 'logo' && image.role !== 'brand_backdrop') {
    return image;
  }

  if (!shouldRenderTMDbLogoCard({
    intent: image.role === 'brand_backdrop' ? 'brand_backdrop' : 'logo',
    canonicalEntityType: input.canonicalEntity?.entityType,
    primarySubjectName: input.canonicalEntity?.primarySubject || input.primarySubject.name,
    visualSubject: input.visualSubject,
    allowAsPrimary: input.imageIntent === 'logo' || input.imageIntent === 'brand_backdrop',
  })) {
    return image;
  }

  try {
    const renderedUrl = await renderTMDbLogoCard(
      image.url,
      image.role === 'brand_backdrop' ? 'brand_backdrop' : 'logo'
    );

    return {
      ...image,
      url: renderedUrl,
      reason: `${image.reason} rendered as logo card`,
      score: image.score + 4,
    };
  } catch (error) {
    console.warn('[RSS][TMDb] Failed to render TMDb logo card, using raw logo asset.', error);
    return image;
  }
}

export async function resolveStructuredTMDbImages(
  input: StructuredRSSTMDbSelectionInput
): Promise<ResolvedStructuredTMDbImage[]> {
  const candidates: ResolvedStructuredTMDbImage[] = [];
  const stronglyPersonLed = isPersonLedInput(input);
  const corporateCompanyInput = isCorporateCompanyInput(input);
  const companyFallbackEligible = Boolean(
    input.contextProject &&
    input.relevantStudios.length > 0 &&
    input.imageIntent !== 'person_portrait'
  );
  let deferredCompanyLogo: ResolvedStructuredTMDbImage | null = null;

  const companyFirst =
    corporateCompanyInput ||
    input.primarySubject.type === 'studio' ||
    input.primarySubject.type === 'streaming_service';

  if (companyFirst) {
    const companyLogo = await resolveCompanyLogo(input);
    if (companyLogo) {
      candidates.push(companyLogo);
    }
  } else if (companyFallbackEligible) {
    deferredCompanyLogo = await resolveCompanyLogo(input);
  }

  if (
    input.imageIntent === 'person_portrait' ||
    input.primarySubject.type === 'actor' ||
    input.primarySubject.type === 'director' ||
    input.primarySubject.type === 'producer'
  ) {
    const personProfile = await resolvePersonProfile(input);
    if (personProfile) {
      personProfile.score += stronglyPersonLed ? 80 : 24;
      candidates.push(personProfile);
    }
  }

  const titleCandidate = corporateCompanyInput ? null : await resolveTitleCandidate(input);
  if (titleCandidate) {
    const projectOnlyTitleFallback =
      titleCandidate.projectContextOnly &&
      isPersonLedInput(input) &&
      input.imageIntent !== 'poster' &&
      input.imageIntent !== 'logo' &&
      input.imageIntent !== 'brand_backdrop';

    const titleRole = input.imageIntent === 'poster'
      ? 'poster'
      : input.imageIntent === 'logo' || input.imageIntent === 'brand_backdrop'
        ? (input.imageIntent === 'brand_backdrop' ? 'brand_backdrop' : 'logo')
        : input.imageIntent === 'character_still'
          ? 'character'
          : 'still';

    const titleScore = projectOnlyTitleFallback && stronglyPersonLed
      ? titleCandidate.score - 36
      : titleCandidate.score;

    const preferredUrl = projectOnlyTitleFallback
      ? titleCandidate.logoUrl || titleCandidate.posterUrl
      : titleRole === 'poster'
      ? titleCandidate.posterUrl
      : titleRole === 'logo' || titleRole === 'brand_backdrop'
        ? titleCandidate.logoUrl
        : titleCandidate.backdropUrls[0] || titleCandidate.posterUrl;

    const preferredRole = projectOnlyTitleFallback
      ? (titleCandidate.logoUrl ? 'logo' : 'poster')
      : titleRole;

    if (preferredUrl) {
      candidates.push({
        url: preferredUrl,
        score: titleScore,
        role: preferredRole,
        reason: `TMDb ${preferredRole === 'poster' ? 'poster' : preferredRole === 'logo' || preferredRole === 'brand_backdrop' ? 'logo' : 'backdrop'} for ${titleCandidate.title}`,
      });
    }

    if (
      !projectOnlyTitleFallback &&
      titleRole !== 'poster' &&
      titleRole !== 'logo' &&
      titleRole !== 'brand_backdrop' &&
      titleCandidate.backdropUrls.length > 1
    ) {
      for (const [index, url] of titleCandidate.backdropUrls.entries()) {
        if (index === 0 || url === preferredUrl) {
          continue;
        }

        candidates.push({
          url,
          score: titleScore - (index * 2 + 1),
          role: titleRole,
          reason: `TMDb backdrop variant for ${titleCandidate.title}`,
        });
      }
    }

    if (input.limit > 1 && titleCandidate.logoUrl && preferredUrl !== titleCandidate.logoUrl) {
      candidates.push({
        url: titleCandidate.logoUrl,
        score: titleScore - 10,
        role: input.imageIntent === 'brand_backdrop' ? 'brand_backdrop' : 'logo',
        reason: `TMDb logo for ${titleCandidate.title}`,
      });
    }

    if (
      !stronglyPersonLed &&
      input.primarySubject.type !== 'character' &&
      Boolean(input.canonicalEntity?.franchise) &&
      titleCandidate.logoUrl &&
      input.imageIntent !== 'poster' &&
      input.imageIntent !== 'person_portrait'
    ) {
      candidates.push({
        url: titleCandidate.logoUrl,
        score: titleScore + 10,
        role: 'logo',
        reason: `TMDb franchise logo fallback for ${titleCandidate.title}`,
      });
    }
  } else if (deferredCompanyLogo) {
    deferredCompanyLogo.score += stronglyPersonLed ? 90 : 70;
    candidates.push(deferredCompanyLogo);
  }

  if (titleCandidate && deferredCompanyLogo && companyFallbackEligible && titleCandidate.projectContextOnly) {
    deferredCompanyLogo.score += stronglyPersonLed ? 24 : 12;
    candidates.push(deferredCompanyLogo);
  }

  const deduped = dedupeResolvedImages(
    candidates.sort((left, right) => right.score - left.score),
    input.excludeUrls || []
  ).slice(0, Math.max(input.limit, 1));

  const finalized: ResolvedStructuredTMDbImage[] = [];
  for (const image of deduped) {
    finalized.push(await finalizeResolvedImage(image, input));
  }

  return finalized;
}

export const __rssTmdbDisambiguationTestUtils = {
  buildInstallmentFallbackQueries,
  resolveCanonicalTMDbEntity,
  titleMatchesProjectContext,
  titleCandidateMatchesResolvedContext,
};
