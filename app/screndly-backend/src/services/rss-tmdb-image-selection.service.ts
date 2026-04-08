import { getTmdbApiKey } from './tmdb.service';
import { trackApiUsage } from './api-usage.service';
import { renderTMDbLogoCard } from './rss-logo-render.service';
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
  visualSubject: string;
  imageIntent: RSSImageIntent;
  targetFormat?: 'movie' | 'series' | 'general';
  contextProject?: string | null;
  requiredContextTerms: string[];
  relevantStudios: string[];
  queries: string[];
  limit: number;
  excludeUrls?: string[];
}

export type TmdbLookupCandidate = {
  media_type_hint?: 'movie' | 'tv' | 'person';
  primary_title?: string;
  alternate_titles?: string[];
  franchise?: string;
  character_name?: string;
  actor_names?: string[];
  director_names?: string[];
  writer_names?: string[];
  release_year?: number;
  season_number?: number;
  episode_number?: number;
  studio_or_platform?: string;
  event_type?:
    | 'reveal'
    | 'casting'
    | 'renewal'
    | 'cancellation'
    | 'development'
    | 'in_production'
    | 'trailer'
    | 'release_date'
    | 'box_office'
    | 'interview_quote'
    | 'first_look'
    | 'platform_move'
    | 'director_attachment'
    | 'writer_attachment'
    | 'return'
    | 'reflection'
    | 'other';
  extraction_confidence?: number;
  ambiguity_flags?: string[];
};

export type TMDbMissReasonCode =
  | 'TMDB_NO_ENTITY_EXTRACTED'
  | 'TMDB_TITLE_TOO_NOISY'
  | 'TMDB_AMBIGUOUS_MULTI_MATCH'
  | 'TMDB_WRONG_MEDIA_TYPE'
  | 'TMDB_YEAR_MISMATCH'
  | 'TMDB_LOW_CONFIDENCE_MATCH'
  | 'TMDB_NO_USABLE_ASSETS'
  | 'TMDB_ONLY_PERSON_MATCHED'
  | 'TMDB_ASSET_TYPE_MISSING'
  | 'TMDB_FELL_BACK_TO_BRANDED'
  | 'TMDB_FELL_BACK_TO_ARTICLE_IMAGE'
  | 'TMDB_FELL_BACK_TO_FEED_IMAGE';

export interface ResolvedStructuredTMDbImage {
  url: string;
  reason: string;
  score: number;
  role: StructuredTMDbImageRole;
  confidenceBand?: 'high' | 'medium' | 'low';
  lookupCandidate?: TmdbLookupCandidate;
  missReason?: TMDbMissReasonCode;
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
  confidenceScore?: number;
  confidenceBand?: 'high' | 'medium' | 'low';
  lookupCandidate?: TmdbLookupCandidate;
}

interface TMDbTitleSearchPass {
  label: string;
  query: string;
  mediaTypes: Array<'movie' | 'tv' | 'multi'>;
}

interface TMDbResolvedTitleLookup {
  candidate: ResolvedTMDbTitleCandidate | null;
  missReason?: TMDbMissReasonCode;
  lookupCandidate: TmdbLookupCandidate;
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

const TMDB_TITLE_NOISE_PATTERNS = [
  /\bexclusive\b/gi,
  /\breview\b/gi,
  /\bending explained\b/gi,
  /\bfirst look\b/gi,
  /\bmajor update\b/gi,
  /\bfinally confirms?\b/gi,
  /\breport\b/gi,
  /\btrailer\b/gi,
  /\bteaser\b/gi,
  /\bin development\b/gi,
  /\bbegins production\b/gi,
  /\bjoins cast\b/gi,
  /\brelease date\b/gi,
  /\brenewed\b/gi,
  /\bcancel(?:ed|led)\b/gi,
  /\bupdate\b/gi,
  /\bexplained\b/gi,
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRomanNumeralSequel(value: string): string {
  return value
    .replace(/\bpart\s+ii\b/gi, 'Part 2')
    .replace(/\bpart\s+iii\b/gi, 'Part 3')
    .replace(/\bpart\s+iv\b/gi, 'Part 4');
}

function normalizeSeasonNumbering(value: string): string {
  return value
    .replace(/\bseason\s+one\b/gi, 'Season 1')
    .replace(/\bseason\s+two\b/gi, 'Season 2')
    .replace(/\bseason\s+three\b/gi, 'Season 3')
    .replace(/\bseason\s+four\b/gi, 'Season 4')
    .replace(/\bseason\s+five\b/gi, 'Season 5')
    .replace(/\bseason\s+six\b/gi, 'Season 6');
}

export function normalizeTMDbLookupTitle(value: string): string {
  let cleaned = value
    .replace(/[“”"]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  cleaned = normalizeRomanNumeralSequel(cleaned);
  cleaned = normalizeSeasonNumbering(cleaned);

  for (const pattern of TMDB_TITLE_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  cleaned = cleaned
    .replace(/\b(live-action|animated)\b/gi, ' ')
    .replace(/\s*[:\-]\s*(major|big|huge|latest)\s+(update|look|news)\b/gi, ' ')
    .replace(/^\s*[:\-]\s*/g, '')
    .replace(/^\s*for\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

function stripTMDbSubtitleNoise(value: string): string {
  const normalized = normalizeTMDbLookupTitle(value);
  const colonIndex = normalized.indexOf(':');
  if (colonIndex <= 0) {
    return normalized;
  }

  const stripped = normalized.slice(0, colonIndex).trim();
  return stripped.length >= 4 ? stripped : normalized;
}

function extractSeasonNumber(value: string): number | undefined {
  const match = value.match(/\bseason\s+(\d+)\b/i);
  return match ? Number(match[1]) : undefined;
}

function inferMediaTypeHint(input: StructuredRSSTMDbSelectionInput): 'movie' | 'tv' | 'person' | undefined {
  if (input.primarySubject.type === 'actor' || input.primarySubject.type === 'director' || input.primarySubject.type === 'producer') {
    return 'person';
  }

  if (input.targetFormat === 'movie') {
    return 'movie';
  }

  if (input.targetFormat === 'series') {
    return 'tv';
  }

  if (input.primarySubject.type === 'movie') {
    return 'movie';
  }

  if (input.primarySubject.type === 'tv_show') {
    return 'tv';
  }

  return undefined;
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

export function buildTmdbLookupCandidateFromInput(
  input: StructuredRSSTMDbSelectionInput
): TmdbLookupCandidate {
  const primaryName = input.primarySubject.name.trim();
  const rankedTitleCandidates = uniqueStrings([
    input.visualSubject,
    input.contextProject || null,
    ...input.queries,
    (input.primarySubject.type === 'movie' || input.primarySubject.type === 'tv_show' || input.primarySubject.type === 'franchise')
      ? primaryName
      : null,
  ])
    .map((title, index) => {
      const normalized = normalizeTMDbLookupTitle(title);
      const score = scoreTitleAnchorCandidate(normalized, index === 0)
        - (normalizeText(normalized).includes('what happened') ? 120 : 0)
        - (normalizeText(normalized).includes('missing character') ? 120 : 0)
        - (normalizeText(normalized).includes('major actor') ? 80 : 0)
        + (normalized.includes(':') ? 16 : 0)
        + (/^'.+'$/.test(normalized) ? 12 : 0);

      return { original: title, normalized, score };
    })
    .filter((candidate) => candidate.normalized.length >= 2)
    .sort((left, right) => right.score - left.score);
  const primaryTitle = rankedTitleCandidates[0]?.normalized;
  const alternateTitles = rankedTitleCandidates
    .slice(1)
    .map((candidate) => candidate.normalized);
  const franchise = input.primarySubject.type === 'franchise'
    ? primaryName
    : uniqueStrings(input.requiredContextTerms)
      .find((term) => {
        const normalized = normalizeText(term);
        return normalized.includes('marvel')
          || normalized.includes('dc')
          || normalized.includes('star wars')
          || normalized.includes('mcu')
          || normalized.includes('franchise');
      });
  const personNames = isPersonLedInput(input) ? [primaryName] : [];
  const combinedText = [
    primaryName,
    input.visualSubject,
    input.contextProject,
    ...input.requiredContextTerms,
    ...input.queries,
  ].filter(Boolean).join(' ');
  const years = extractYearTokens(combinedText);
  const ambiguityFlags: string[] = [];

  if (alternateTitles.length > 3) {
    ambiguityFlags.push('multiple_title_candidates');
  }

  if (!primaryTitle && alternateTitles.length === 0) {
    ambiguityFlags.push('no_clean_title_candidate');
  }

  return {
    media_type_hint: inferMediaTypeHint(input),
    primary_title: primaryTitle,
    alternate_titles: uniqueStrings(alternateTitles.filter((title) => normalizeText(title) !== normalizeText(primaryTitle || ''))),
    franchise,
    character_name: input.primarySubject.type === 'character' ? primaryName : undefined,
    actor_names: input.primarySubject.type === 'actor' ? [primaryName] : personNames,
    director_names: input.primarySubject.type === 'director' ? [primaryName] : [],
    writer_names: [],
    release_year: years[0] ? Number(years[0]) : undefined,
    season_number: extractSeasonNumber(combinedText),
    studio_or_platform: uniqueStrings(input.relevantStudios)[0],
    extraction_confidence: primaryTitle ? 0.86 : alternateTitles.length > 0 ? 0.62 : 0.28,
    ambiguity_flags: ambiguityFlags.length > 0 ? ambiguityFlags : undefined,
  };
}

function scoreTitleAnchorCandidate(value: string, preferPrimary = false): number {
  const tokens = getMeaningfulTitleTokens(value);
  return (preferPrimary ? 60 : 0)
    + tokens.length * 40
    + value.trim().length
    + Math.min(tokens.join(' ').length, 60);
}

function buildTitleSearchAnchor(input: StructuredRSSTMDbSelectionInput): string | null {
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

export function buildTMDbSearchPasses(lookupCandidate: TmdbLookupCandidate): TMDbSearchPass[] {
  const passes: TMDbSearchPass[] = [];
  const primaryTitle = lookupCandidate.primary_title?.trim();
  const alternateTitles = lookupCandidate.alternate_titles || [];
  const mediaTypeHint = lookupCandidate.media_type_hint;
  const hintedMediaTypes = mediaTypeHint === 'movie'
    ? ['movie', 'multi'] as Array<'movie' | 'tv' | 'multi'>
    : mediaTypeHint === 'tv'
      ? ['tv', 'multi']
      : ['multi'];
  const crossCheckTypes = mediaTypeHint === 'movie'
    ? ['movie', 'tv']
    : mediaTypeHint === 'tv'
      ? ['tv', 'movie']
      : ['movie', 'tv'];

  if (primaryTitle) {
    passes.push({
      label: 'exact_title',
      query: primaryTitle,
      mediaTypes: hintedMediaTypes,
    });

    if (lookupCandidate.release_year) {
      passes.push({
        label: 'title_with_year',
        query: `${primaryTitle} ${lookupCandidate.release_year}`,
        mediaTypes: hintedMediaTypes,
      });
    }

    const strippedTitle = stripTMDbSubtitleNoise(primaryTitle);
    if (strippedTitle && normalizeText(strippedTitle) !== normalizeText(primaryTitle)) {
      passes.push({
        label: 'stripped_title',
        query: strippedTitle,
        mediaTypes: hintedMediaTypes,
      });
    }

    passes.push({
      label: 'media_type_cross_check',
      query: primaryTitle,
      mediaTypes: crossCheckTypes,
    });
  }

  for (const alternateTitle of alternateTitles) {
    passes.push({
      label: 'alternate_title',
      query: alternateTitle,
      mediaTypes: hintedMediaTypes,
    });
  }

  return passes.filter((pass, index, allPasses) =>
    pass.query.trim().length >= 2 &&
    allPasses.findIndex((candidate) =>
      normalizeText(candidate.query) === normalizeText(pass.query) &&
      candidate.mediaTypes.join(',') === pass.mediaTypes.join(',')
    ) === index
  );
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

async function resolveTitleCandidate(input: StructuredRSSTMDbSelectionInput): Promise<TMDbResolvedTitleLookup> {
  const lookupCandidate = buildTmdbLookupCandidateFromInput(input);
  const anchor = lookupCandidate.primary_title || buildTitleSearchAnchor(input);
  if (!anchor) {
    return {
      candidate: null,
      missReason: 'TMDB_NO_ENTITY_EXTRACTED',
      lookupCandidate,
    };
  }

  const normalizedAnchor = normalizeTMDbLookupTitle(anchor);
  if (getMeaningfulTitleTokens(normalizedAnchor).length === 0) {
    return {
      candidate: null,
      missReason: 'TMDB_TITLE_TOO_NOISY',
      lookupCandidate,
    };
  }

  const preferredFormat = input.targetFormat ?? 'general';
  const searchPasses = buildTMDbSearchPasses(lookupCandidate).slice(0, 7);
  if (searchPasses.length === 0) {
    return {
      candidate: null,
      missReason: 'TMDB_NO_ENTITY_EXTRACTED',
      lookupCandidate,
    };
  }

  const supportingContextTerms = buildTitleSupportingContextTerms(input, anchor);

  const yearTokens = extractYearTokens([
    input.primarySubject.name,
    input.visualSubject,
    input.contextProject,
    ...input.requiredContextTerms,
    lookupCandidate.release_year ? String(lookupCandidate.release_year) : null,
  ].filter(Boolean).join(' '));
  let sawTypedMismatch = false;
  let sawYearMismatch = false;
  let sawAnyResults = false;
  let sawAssetlessMatch = false;
  let rankedCandidateCount = 0;

  try {
    const searchResponses = await Promise.all(
      searchPasses.flatMap((pass) =>
        pass.mediaTypes.map((mediaType) => {
          const endpoint = mediaType === 'movie'
            ? '/search/movie'
            : mediaType === 'tv'
              ? '/search/tv'
              : '/search/multi';

          return tmdbFetch<{ results?: TMDbSearchResult[] }>(endpoint, {
            query: pass.query,
            language: 'en-US',
            include_adult: 'false',
            page: '1',
          })
            .then((response) => ({
              pass,
              mediaType,
              results: (response.results || []).map((candidate) => ({
                ...candidate,
                media_type: candidate.media_type || (mediaType === 'multi' ? candidate.media_type : mediaType),
              })),
            }))
            .catch(() => ({
              pass,
              mediaType,
              results: [],
            }));
        })
      )
    );

    const candidates = new Map<string, { candidate: TMDbSearchResult; passLabels: Set<string> }>();
    for (const response of searchResponses) {
      for (const candidate of response.results || []) {
        sawAnyResults = true;
        if (candidate.media_type !== 'movie' && candidate.media_type !== 'tv') {
          continue;
        }

        const key = `${candidate.media_type}:${candidate.id}`;
        if (!candidates.has(key)) {
          candidates.set(key, {
            candidate,
            passLabels: new Set([`${response.pass.label}:${response.mediaType}`]),
          });
        } else {
          candidates.get(key)?.passLabels.add(`${response.pass.label}:${response.mediaType}`);
        }
      }
    }

    const ranked = [...candidates.values()]
      .map(({ candidate, passLabels }) => {
        const candidateMediaType =
          candidate.media_type === 'movie' || candidate.media_type === 'tv'
            ? candidate.media_type
            : undefined;
        const candidateTitle = candidate.title || candidate.name || candidate.original_title || candidate.original_name || '';
        const normalizedCandidateTitle = normalizeTMDbLookupTitle(candidateTitle);
        const normalizedPassBonus = [...passLabels].some((label) => label.startsWith('exact_title')) ? 14 : 0;
        const strippedPassBonus = [...passLabels].some((label) => label.startsWith('stripped_title')) ? 8 : 0;
        const alternatePassBonus = [...passLabels].some((label) => label.startsWith('alternate_title')) ? 6 : 0;
        const yearMatchBonus = lookupCandidate.release_year &&
          [candidate.release_date, candidate.first_air_date].some((value) => value?.startsWith(String(lookupCandidate.release_year)))
          ? 15
          : 0;
        const studioSupportBonus = lookupCandidate.studio_or_platform
          ? scoreContextTerms(
              [candidate.overview, candidate.title, candidate.name].filter(Boolean).join(' '),
              [lookupCandidate.studio_or_platform],
              []
            ) / 5
          : 0;

        return {
          candidate,
          score: scoreAliasMatch(normalizedAnchor, [
            normalizedCandidateTitle,
            candidate.title,
            candidate.name,
            candidate.original_title,
            candidate.original_name,
          ])
            + normalizedPassBonus
            + strippedPassBonus
            + alternatePassBonus
            + yearMatchBonus
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
            + studioSupportBonus
            + Math.min(candidate.popularity || 0, 80) / 2,
          passLabels,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);
    rankedCandidateCount = ranked.length;

    for (const { candidate, score } of ranked) {
      if (score < MIN_TMDB_TITLE_SCORE) {
        continue;
      }

      if (
        preferredFormat !== 'general' &&
        ((preferredFormat === 'movie' && candidate.media_type === 'tv') ||
          (preferredFormat === 'series' && candidate.media_type === 'movie'))
      ) {
        sawTypedMismatch = true;
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
      const resolvedTitleYear = details.release_date || details.first_air_date || '';
      const yearMatchBonus = lookupCandidate.release_year && resolvedTitleYear.startsWith(String(lookupCandidate.release_year))
        ? 15
        : 0;
      const confidenceScore = Math.min(
        100,
        (scoreAliasMatch(normalizedAnchor, [title]) >= 250 ? 40 : scoreAliasMatch(normalizedAnchor, [title]) >= 210 ? 25 : 10)
          + yearMatchBonus
          + (scoreTargetFormatMatch(preferredFormat, candidate.media_type) > 0 ? 15 : 0)
          + Math.min(scoreContextTerms([title, overview].join(' '), supportingContextTerms, []), 20)
          + Math.min(scoreContextTerms([...castNames, ...crewNames, ...productionNames].join(' '), input.requiredContextTerms, []), 15)
      );

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
        + scoreAliasMatch(normalizedAnchor, [title])
        + yearMatchBonus;

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
      const posterUrl = selectBestImageAsset(details.poster_path, details.images?.posters, ['en', null]);
      const logoUrl = selectBestImageAsset(undefined, details.images?.logos, ['en', null]);
      const confidenceBand = confidenceScore >= 75 ? 'high' : confidenceScore >= 55 ? 'medium' : 'low';
      if (lookupCandidate.release_year && !resolvedTitleYear.startsWith(String(lookupCandidate.release_year))) {
        sawYearMismatch = true;
      }

      if (!backdropUrls[0] && !posterUrl && !logoUrl) {
        sawAssetlessMatch = true;
        continue;
      }

      return {
        candidate: {
          entityKey,
          title,
          score: enrichedScore,
          backdropUrls,
          backdropUrl: backdropUrls[0],
          posterUrl,
          logoUrl,
          projectContextOnly,
          confidenceScore,
          confidenceBand,
          lookupCandidate,
        },
        lookupCandidate,
      };
    }
  } catch (error) {
    console.error('[RSS][TMDb] Failed to resolve title asset:', error);
  }

  return {
    candidate: null,
    missReason: !sawAnyResults
      ? 'TMDB_NO_ENTITY_EXTRACTED'
      : sawAssetlessMatch
        ? 'TMDB_NO_USABLE_ASSETS'
        : sawTypedMismatch
          ? 'TMDB_WRONG_MEDIA_TYPE'
          : sawYearMismatch
            ? 'TMDB_YEAR_MISMATCH'
            : rankedCandidateCount > 1
              ? 'TMDB_AMBIGUOUS_MULTI_MATCH'
              : 'TMDB_LOW_CONFIDENCE_MATCH',
    lookupCandidate,
  };
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

async function finalizeResolvedImage(image: ResolvedStructuredTMDbImage): Promise<ResolvedStructuredTMDbImage> {
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

  const companyFirst =
    input.primarySubject.type === 'studio' ||
    input.primarySubject.type === 'streaming_service' ||
    input.imageIntent === 'logo' ||
    input.imageIntent === 'brand_backdrop';

  if (companyFirst) {
    const companyLogo = await resolveCompanyLogo(input);
    if (companyLogo) {
      candidates.push(companyLogo);
    }
  }

  if (
    input.imageIntent === 'person_portrait' ||
    input.primarySubject.type === 'actor' ||
    input.primarySubject.type === 'director' ||
    input.primarySubject.type === 'producer'
  ) {
    const personProfile = await resolvePersonProfile(input);
    if (personProfile) {
      personProfile.score += 24;
      candidates.push(personProfile);
    }
  }

  const titleLookup = await resolveTitleCandidate(input);
  const titleCandidate = titleLookup.candidate;
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
        score: titleCandidate.score,
        role: preferredRole,
        reason: `TMDb ${preferredRole === 'poster' ? 'poster' : preferredRole === 'logo' || preferredRole === 'brand_backdrop' ? 'logo' : 'backdrop'} for ${titleCandidate.title}`,
        confidenceBand: titleCandidate.confidenceBand,
        lookupCandidate: titleCandidate.lookupCandidate,
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
          score: titleCandidate.score - (index * 2 + 1),
          role: titleRole,
          reason: `TMDb backdrop variant for ${titleCandidate.title}`,
          confidenceBand: titleCandidate.confidenceBand,
          lookupCandidate: titleCandidate.lookupCandidate,
        });
      }
    }

    if (input.limit > 1 && titleCandidate.logoUrl && preferredUrl !== titleCandidate.logoUrl) {
      candidates.push({
        url: titleCandidate.logoUrl,
        score: titleCandidate.score - 10,
        role: input.imageIntent === 'brand_backdrop' ? 'brand_backdrop' : 'logo',
        reason: `TMDb logo for ${titleCandidate.title}`,
        confidenceBand: titleCandidate.confidenceBand,
        lookupCandidate: titleCandidate.lookupCandidate,
      });
    }
  } else if (titleLookup.missReason) {
    console.info('[RSS][TMDb] Title resolution miss:', {
      missReason: titleLookup.missReason,
      lookupCandidate: titleLookup.lookupCandidate,
      primarySubject: input.primarySubject.name,
      visualSubject: input.visualSubject,
    });
  }

  const deduped = dedupeResolvedImages(
    candidates.sort((left, right) => right.score - left.score),
    input.excludeUrls || []
  ).slice(0, Math.max(input.limit, 1));

  const finalized: ResolvedStructuredTMDbImage[] = [];
  for (const image of deduped) {
    finalized.push(await finalizeResolvedImage(image));
  }

  return finalized;
}
