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
  title: string;
  score: number;
  backdropUrl?: string;
  posterUrl?: string;
  logoUrl?: string;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
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

function buildTitleSearchAnchor(input: StructuredRSSTMDbSelectionInput): string | null {
  if (
    input.primarySubject.type === 'movie' ||
    input.primarySubject.type === 'tv_show' ||
    input.primarySubject.type === 'franchise'
  ) {
    return input.primarySubject.name;
  }

  const contextProject = input.contextProject?.trim();
  if (contextProject) {
    const normalizedContextProject = normalizeText(contextProject);
    const contextMatchesStudio = input.relevantStudios.some(
      (studio) => normalizeText(studio) === normalizedContextProject
    );

    if (!contextMatchesStudio) {
      return contextProject;
    }
  }

  const visualSubject = input.visualSubject.trim();
  if (visualSubject && normalizeText(visualSubject) !== normalizeText(input.primarySubject.name)) {
    return visualSubject;
  }

  return null;
}

async function resolveTitleCandidate(input: StructuredRSSTMDbSelectionInput): Promise<ResolvedTMDbTitleCandidate | null> {
  const anchor = buildTitleSearchAnchor(input);
  if (!anchor) {
    return null;
  }

  const preferredFormat = input.targetFormat ?? 'general';

  const queries = uniqueStrings([
    anchor,
    ...input.queries,
  ]).slice(0, 4);

  if (queries.length === 0) {
    return null;
  }

  const yearTokens = extractYearTokens([
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
          ])
            + scoreTargetFormatMatch(preferredFormat, candidateMediaType)
            + scoreContextTerms(
              [candidate.overview, candidate.title, candidate.name].filter(Boolean).join(' '),
              input.requiredContextTerms,
              yearTokens
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
        + scoreAliasMatch(anchor, [title]);

      if (enrichedScore < MIN_TMDB_TITLE_SCORE) {
        continue;
      }

      return {
        title,
        score: enrichedScore,
        backdropUrl: selectBestImageAsset(details.backdrop_path, details.images?.backdrops, [null, 'en']),
        posterUrl: selectBestImageAsset(details.poster_path, details.images?.posters, ['en', null]),
        logoUrl: selectBestImageAsset(undefined, details.images?.logos, ['en', null]),
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
      candidates.push(personProfile);
    }
  }

  const titleCandidate = await resolveTitleCandidate(input);
  if (titleCandidate) {
    const titleRole = input.imageIntent === 'poster'
      ? 'poster'
      : input.imageIntent === 'logo' || input.imageIntent === 'brand_backdrop'
        ? (input.imageIntent === 'brand_backdrop' ? 'brand_backdrop' : 'logo')
        : input.imageIntent === 'character_still'
          ? 'character'
          : 'still';

    const preferredUrl = titleRole === 'poster'
      ? titleCandidate.posterUrl
      : titleRole === 'logo' || titleRole === 'brand_backdrop'
        ? titleCandidate.logoUrl
        : titleCandidate.backdropUrl || titleCandidate.posterUrl;

    if (preferredUrl) {
      candidates.push({
        url: preferredUrl,
        score: titleCandidate.score,
        role: titleRole,
        reason: `TMDb ${titleRole === 'poster' ? 'poster' : titleRole === 'logo' || titleRole === 'brand_backdrop' ? 'logo' : 'backdrop'} for ${titleCandidate.title}`,
      });
    }

    if (input.limit > 1 && titleCandidate.logoUrl && preferredUrl !== titleCandidate.logoUrl) {
      candidates.push({
        url: titleCandidate.logoUrl,
        score: titleCandidate.score - 10,
        role: input.imageIntent === 'brand_backdrop' ? 'brand_backdrop' : 'logo',
        reason: `TMDb logo for ${titleCandidate.title}`,
      });
    }
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
