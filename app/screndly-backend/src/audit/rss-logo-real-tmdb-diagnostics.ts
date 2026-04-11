import { getSecretSetting } from '../lib/settings';
import { getTMDbLogoCardDiagnosticsFromSource } from '../services/rss-logo-render.service';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

type Target =
  | { kind: 'company'; query: string; label: string }
  | { kind: 'tv'; query: string; label: string }
  | { kind: 'movie'; query: string; label: string };

type SearchResult = {
  id: number;
  name?: string;
  title?: string;
};

type LogoImage = {
  file_path: string;
  iso_639_1?: string | null;
  vote_average?: number;
  width?: number;
  height?: number;
};

const TARGETS: Target[] = [
  { kind: 'company', query: 'Netflix', label: 'Netflix' },
  { kind: 'company', query: 'Prime Video', label: 'Prime Video' },
  { kind: 'company', query: 'The Walt Disney Company', label: 'Disney' },
  { kind: 'tv', query: 'Wednesday', label: 'Wednesday' },
  { kind: 'tv', query: 'The Boys', label: 'The Boys' },
  { kind: 'movie', query: 'Superman', label: 'Superman' },
];

async function getTmdbApiKey(): Promise<string> {
  const key = process.env.TMDB_API_KEY || await getSecretSetting('tmdbKey') || await getSecretSetting('tmdbApiKey');
  if (!key) {
    throw new Error('TMDb API key not configured');
  }
  return key;
}

async function tmdbFetch<T>(apiKey: string, endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_API_BASE}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDb API error for ${endpoint}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function resolveTargetId(apiKey: string, target: Target): Promise<number | null> {
  const endpoint = target.kind === 'company'
    ? '/search/company'
    : target.kind === 'tv'
      ? '/search/tv'
      : '/search/movie';

  const payload = await tmdbFetch<{ results: SearchResult[] }>(apiKey, endpoint, { query: target.query });
  return payload.results[0]?.id ?? null;
}

function pickBestLogo(logos: LogoImage[]): LogoImage | null {
  if (logos.length === 0) {
    return null;
  }

  const preferredLanguage = logos.find((logo) => logo.iso_639_1 === 'en');
  if (preferredLanguage) {
    return preferredLanguage;
  }

  return [...logos].sort((left, right) => (right.vote_average ?? 0) - (left.vote_average ?? 0))[0] ?? null;
}

async function resolveLogoUrl(apiKey: string, target: Target): Promise<string | null> {
  const id = await resolveTargetId(apiKey, target);
  if (!id) {
    return null;
  }

  const endpoint = target.kind === 'company'
    ? `/company/${id}/images`
    : target.kind === 'tv'
      ? `/tv/${id}/images`
      : `/movie/${id}/images`;

  const payload = await tmdbFetch<{ logos?: LogoImage[] }>(apiKey, endpoint);
  const logo = pickBestLogo(payload.logos || []);
  return logo?.file_path ? `${TMDB_IMAGE_BASE}${logo.file_path}` : null;
}

async function run(): Promise<void> {
  const apiKey = await getTmdbApiKey();
  const rows: Array<Record<string, string>> = [];

  for (const target of TARGETS) {
    try {
      const logoUrl = await resolveLogoUrl(apiKey, target);
      if (!logoUrl) {
        rows.push({
          target: target.label,
          type: target.kind,
          status: 'no_logo_found',
          canvas: '-',
          accent: '-',
          contrast: '-',
          backgroundStart: '-',
          backgroundEnd: '-',
        });
        continue;
      }

      const diagnostics = await getTMDbLogoCardDiagnosticsFromSource(logoUrl, 'logo');
      rows.push({
        target: target.label,
        type: target.kind,
        status: 'ok',
        canvas: diagnostics.chosenCanvas,
        accent: diagnostics.accentHex,
        contrast: diagnostics.contrastRatio.toFixed(2),
        backgroundStart: diagnostics.background.startHex,
        backgroundEnd: diagnostics.background.endHex,
      });
    } catch (error) {
      rows.push({
        target: target.label,
        type: target.kind,
        status: error instanceof Error ? error.message : 'unknown_error',
        canvas: '-',
        accent: '-',
        contrast: '-',
        backgroundStart: '-',
        backgroundEnd: '-',
      });
    }
  }

  console.table(rows);
}

void run().catch((error) => {
  console.error('[RSS][Logo Diagnostics] Failed to run real TMDb diagnostics.', error);
  process.exitCode = 1;
});
