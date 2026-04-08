import { getSecretSetting } from '../lib/settings';
import aiService, { DEFAULT_OPENAI_MODEL, type AIModel, normalizeAIModel } from './ai.service';
import { trackApiUsage } from './api-usage.service';
import {
  resolveStructuredTMDbImages,
  type ResolvedStructuredTMDbImage,
  type StructuredTMDbImageRole,
} from './rss-tmdb-image-selection.service';
import sharp from 'sharp';

export interface RSSImageSelectionArticle {
  title: string;
  description?: string;
  contentHtml?: string;
  author?: string;
  generatedCaption?: string;
  fallbackImages?: string[];
}

export interface RSSResolvedImage {
  url: string;
  reason: string;
  source: 'tmdb' | 'serper' | 'openai_web_search' | 'feed';
  score?: number;
}

type ImageRole =
  | 'logo'
  | 'brand_backdrop'
  | 'person'
  | 'character'
  | 'still'
  | 'poster';

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

type TargetFormat = 'movie' | 'series' | 'general';

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

interface OpenAIWebSearchImageCandidate {
  imageUrl?: string;
  sourcePage?: string;
  title?: string;
  domain?: string;
  rationale?: string;
}

interface OpenAIWebSearchImageResponse {
  images?: OpenAIWebSearchImageCandidate[];
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
  targetFormat: TargetFormat;
  animatedSubject: boolean;
  contextProject: string | null;
  requiredContextTerms: string[];
  referenceOnlySubjects: string[];
  allowLogoOnly: boolean;
  queries: string[];
}

interface ScoredImage {
  image: SerperImageResult;
  score: number;
  reason: string;
}

interface ImageValidationResult {
  approved: boolean;
  reason?: string;
}

interface ImageSlotPlan {
  subject: string;
  type: SubjectType;
  intent: ImageIntent;
  allowLogoOnly: boolean;
  requiredContextTerms: string[];
  queries: string[];
}

interface FranchiseValidationRule {
  matchAny: string[];
  requiredTerms: string[];
  blockedTerms?: string[];
}

const MIN_IMAGE_WIDTH = 600;
const MIN_IMAGE_HEIGHT = 400;
const MIN_EDITORIAL_QUALITY_WIDTH = 900;
const MIN_EDITORIAL_QUALITY_HEIGHT = 500;
const HIGH_QUALITY_WIDTH = 1400;
const HIGH_QUALITY_HEIGHT = 780;
const MIN_EDITORIAL_QUALITY_AREA = 700000;
const HIGH_QUALITY_AREA = 1400000;
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
  'etsy.com',
  'ebay.com',
  'walmart.com',
  'aliexpress.com',
  'temu.com',
  'redbubble.com',
  'teepublic.com',
  'tiktok.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'facebook.com',
  'fbcdn.net',
  'fbsbx.com',
  'lookaside.fbsbx.com',
  'instagram.com',
  'cdninstagram.com',
  'threads.net',
  'x.com',
  'twitter.com',
  'twimg.com',
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
  'starwars.com',
  'warnerbros.com',
  'paramount.com',
  'paramountplus.com',
  'universalpictures.com',
  'sonypictures.com',
  'sony.com',
  'primevideo.com',
  'hbo.com',
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
  'cbs.com',
  'abc.com',
  'nbc.com',
  'fox.com',
  'cartoonnetwork.com',
  'adultswim.com',
  'nick.com',
  'nickelodeon.com',
  'dreamworks.com',
  'illumination.com',
  'nintendo.com',
  'pokemon.com',
  'crunchyroll.com',
  'ghibli.jp',
  'studioghibli.com',
];
const GOOD_DOMAINS = [
  'screenrant.com',
  'comicbook.com',
  'comingsoon.net',
  'cinemablend.com',
  'gamesradar.com',
  'digitalspy.com',
  'theplaylist.net',
  'collider.com',
  'bloody-disgusting.com',
  'movieweb.com',
  'cbr.com',
  'looper.com',
  'inverse.com',
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
  'comicbook review',
  'review frame',
  'review screengrab',
  'outlet watermark',
  'network bug',
  'publisher bug',
  'lower third',
  'exclusive banner',
  'exclusive frame',
  'exclusive bug',
  'comicbook exclusive',
  'cb exclusive',
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
  'stable diffusion',
  'ai art',
  'ai image',
  'generated by ai',
  'lookaside',
  'crawler media',
  'api img',
  'photomode video share card',
];
const HARD_REJECT_KEYWORDS = [
  'happy birthday',
  'birthday',
  'party',
  'cake',
  'cupcake',
  'balloons',
  'party decor',
  'party decorations',
  'party supplies',
  'invitation',
  'invites',
  'backdrop stand',
  'printable',
  'wall art',
  'canvas print',
  'poster print',
  'custom banner',
  'cake topper',
  'tablecloth',
  'merchandise',
  'merch',
  'shirt',
  't shirt',
  'mug',
  'toy',
  'figure',
  'funko',
  'clipart',
  'sticker',
  'dvd',
  'blu ray',
  'blu-ray',
  '4k ultra hd',
  'home video',
  'box set',
  'box art',
  'cover art',
  'dvd cover',
  'blu ray cover',
  'etsy',
  'amazon',
  'ebay',
  'walmart',
  'aliexpress',
  'temu',
];
const COMPOSITE_KEYWORDS = [
  'collage',
  'composite',
  'split image',
  'side by side',
  'side-by-side',
  'comparison',
  'compare',
  'versus',
  'vs.',
  ' vs ',
  'then and now',
  'montage',
  'roundup',
];
const FEED_FALLBACK_BLOCKED_DOMAINS: string[] = [];
const FEED_FALLBACK_BLOCKED_URL_KEYWORDS: string[] = [];
const PROJECT_LINKED_FEED_FALLBACK_BLOCKED_DOMAINS: string[] = [
  'comicbook.com',
];
const MIN_FEED_FALLBACK_WIDTH = 200;
const MIN_FEED_FALLBACK_HEIGHT = 200;
const COMIC_ART_KEYWORDS = [
  'comic art',
  'comic book',
  'comic',
  'variant cover',
  'cover art',
  'splash page',
  'comic panel',
  'panel art',
  'illustration',
  'drawn art',
];
const ILLUSTRATION_STYLE_KEYWORDS = [
  'fanart',
  'fan art',
  'illustration',
  'drawn art',
  'digital art',
  'digital painting',
  'painting',
  'concept art',
  'artstation',
  'deviantart',
  'matte painting',
  'fantasy art',
  'rendered art',
  'anime style',
  'stylized art',
];
const UNOFFICIAL_EDIT_KEYWORDS = [
  'youtube thumbnail',
  'thumbnail',
  'reaction thumbnail',
  'text overlay',
  'clickbait',
  'mashup',
  'fan edit',
  'edit',
  'photoshop',
  'mock thumbnail',
  'explained thumbnail',
];
const AI_GENERATION_KEYWORDS = [
  'midjourney',
  'stable diffusion',
  'ai generated',
  'ai image',
  'ai art',
  'generated by ai',
  'neural render',
  'synthetic image',
];
const ANIMATED_SUBJECT_KEYWORDS = [
  'animated',
  'animation',
  'anime',
  'cartoon',
  'pixar',
  'disney animation',
  'dreamworks',
  'illumination',
  'nickelodeon',
  'cartoon network',
  'anime series',
  'animated series',
  'animated film',
  'animated movie',
];
const OFFICIAL_ANIMATION_MARKERS = [
  'official art',
  'promo art',
  'promotional art',
  'official still',
  'production still',
  'character render',
  'official character art',
  'official image',
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
const OUTLET_BRANDED_FRAME_OUTLETS = [
  'comicbook',
  'comicbook.com',
  'screenrant',
  'collider',
  'cbr',
  'movieweb',
  'comingsoon',
  'digitalspy',
  'gamesradar',
  'bloody disgusting',
  'inverse',
  'theplaylist',
];
const OUTLET_BRANDED_FRAME_SIGNALS = [
  'exclusive',
  'review',
  'review frame',
  'review screengrab',
  'preview',
  'watermark',
  'lower third',
  'network bug',
  'publisher bug',
  'banner',
  'bug',
];

type FeedFallbackProbeResult = {
  allowed: boolean;
  width?: number;
  height?: number;
  reason?: string;
};

const feedFallbackProbeCache = new Map<string, Promise<FeedFallbackProbeResult>>();
const openAIWebPageImageCache = new Map<string, Promise<string | null>>();
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
const STREAMING_PLATFORM_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'HBO Max', aliases: ['hbo max'] },
  { canonical: 'Max', aliases: ['max'] },
  { canonical: 'Netflix', aliases: ['netflix'] },
  { canonical: 'Disney+', aliases: ['disney+', 'disney plus'] },
  { canonical: 'Prime Video', aliases: ['prime video', 'amazon prime video'] },
  { canonical: 'Apple TV+', aliases: ['apple tv+', 'apple tv plus'] },
  { canonical: 'Hulu', aliases: ['hulu'] },
  { canonical: 'Peacock', aliases: ['peacock'] },
  { canonical: 'Paramount+', aliases: ['paramount+', 'paramount plus'] },
];
const STREAMING_AVAILABILITY_PATTERNS = [
  /\bnow\s+streaming\s+on\b/i,
  /\bstreaming\s+on\b/i,
  /\bavailable\s+(?:to\s+stream\s+)?on\b/i,
  /\blanded\s+on\b/i,
  /\blands\s+on\b/i,
  /\barrives?\s+on\b/i,
  /\bcoming\s+to\b/i,
  /\bheaded\s+to\b/i,
  /\bjoins?\s+.*\blibrary\b/i,
];
const CONTAINER_STORY_CUES = [
  'live action',
  'adaptation',
  'remake',
  'reboot',
  'spinoff',
  'sequel',
  'prequel',
  'movie',
  'film',
  'feature',
  'series',
  'show',
  'character',
  'franchise',
  'trailer',
  'teaser',
  'poster',
  'first look',
  'release',
  'premiere',
  'coming to',
  'set for',
];
const GENERIC_CONTAINER_SUBJECT_TERMS = [
  'plan',
  'plans',
  'strategy',
  'ceo',
  'service',
  'platform',
  'pricing',
  'subscription',
  'brand',
  'studio',
  'network',
  'business',
  'deal',
  'merger',
  'slate',
];
const PERSON_NAME_STOPWORDS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Netflix',
  'Disney',
  'Prime',
  'Paramount',
  'Warner',
  'Bros',
  'Discovery',
  'Studios',
  'Studio',
  'Movie',
  'Movies',
  'Film',
  'Series',
  'Season',
  'Episode',
  'Show',
  'Story',
  'Immortal',
  'Man',
];
const REFERENCE_ONLY_CUES = [
  'known for',
  'best known for',
  'hits like',
  'films like',
  'movies like',
  'titles like',
  'adaptations like',
  'such as',
  'including',
  'elements of',
  'in the vein of',
  'from films such as',
  'from movies such as',
];
const FRANCHISE_VALIDATION_RULES: FranchiseValidationRule[] = [
  {
    matchAny: ['scream'],
    requiredTerms: ['scream', 'ghostface'],
    blockedTerms: ['saw', 'jigsaw', 'billy the puppet', 'chucky', 'annabelle', 'michael myers', 'freddy krueger'],
  },
  {
    matchAny: ['avatar the last airbender', 'legend of aang', 'the legend of aang'],
    requiredTerms: ['avatar the last airbender', 'legend of aang', 'aang', 'katara', 'sokka', 'zuko', 'toph', 'appa', 'momo'],
  },
  {
    matchAny: ['spider man', 'spiderman'],
    requiredTerms: ['spider man', 'spiderman', 'peter parker', 'tobey maguire', 'andrew garfield', 'tom holland'],
  },
  {
    matchAny: ['captain marvel'],
    requiredTerms: ['captain marvel', 'carol danvers', 'brie larson'],
  },
  {
    matchAny: ['sentry'],
    requiredTerms: ['sentry', 'thunderbolts', 'lewis pullman'],
    blockedTerms: ['variant cover', 'comic panel', 'cover art'],
  },
];
const MIN_CONFIDENT_SERPER_SCORE = 135;
const MIN_CONFIDENT_SERPER_SCORE_WITH_FEED_FALLBACK = 170;
const MIN_ACCEPTABLE_SERPER_SCORE = 90;
const MIN_CONFIDENT_TMDB_SCORE = 105;
const MIN_CONFIDENT_TMDB_SCORE_WITH_FEED_FALLBACK = 125;
const MIN_PRIMARY_CONFIDENCE_GAP = 10;
const MIN_PRIMARY_CONFIDENCE_GAP_WITH_FEED_FALLBACK = 18;
const MIN_BRAND_FALLBACK_SERPER_SCORE = 72;
const MIN_GENERAL_LIST_SERPER_SCORE = 78;
const MIN_TRAILER_STILL_SERPER_SCORE = 82;
const MIN_SMART_PRIMARY_SERPER_SCORE = 100;
const MIN_SMART_SECONDARY_SCORE = 88;
const MIN_SMART_LOGO_SECONDARY_SCORE = 74;
const MAX_SECONDARY_SCORE_GAP = 18;
const HEADLINE_PROJECT_GENERIC_TERMS = new Set([
  'a',
  'an',
  'and',
  'after',
  'announces',
  'best',
  'brighter',
  'confirmed',
  'future',
  'gets',
  'its',
  'latest',
  'looks',
  'major',
  'might',
  'most',
  'new',
  'right',
  'spin',
  'spinoff',
  'show',
  'shows',
  'series',
  'the',
  'theory',
  'tv',
  'update',
  'villain',
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
const CONTEXT_SENSITIVE_GENERIC_CUES = /\b(study|survey|report|demographic|demographics|audience|audiences|consumer|consumers|trend|trends|research|analysis|data|statistics|market|behavior|behaviour|habits|generation|young people|moviegoing)\b/i;

type RSSImageSource = 'tmdb' | 'serper' | 'openai_web_search';

type RevealDrivenArticleMode =
  | 'poster'
  | 'single_image'
  | 'multi_image';

function getRevealDrivenArticleMode(article: RSSImageSelectionArticle): RevealDrivenArticleMode | null {
  const articleText = [article.title, article.description, article.generatedCaption, article.contentHtml]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!articleText) {
    return null;
  }

  if (
    /\b(poster(?:\s+reveals?|\s+revealed|\s+reveal|\s+review|\s+drop|\s+debut|\s+debuts|\s+debuted)?|official poster|character poster|teaser poster|poster art|key art)\b/i
      .test(articleText)
  ) {
    return 'poster';
  }

  if (
    /\b(behind the scenes|behind-the-scenes|exclusive images|new images|gallery|photo gallery|photos)\b/i
      .test(articleText)
  ) {
    return 'multi_image';
  }

  if (
    /\b(exclusive image|new image|new still|first look|reveals?|revealed|unveils?|unveiled|debuts?|debuted|check out .*poster|check out .*image)\b/i
      .test(articleText)
  ) {
    return 'single_image';
  }

  return null;
}

function isMemorialStory(article: RSSImageSelectionArticle): boolean {
  const articleText = buildArticleAnalysisText(article).toLowerCase();

  if (!articleText) {
    return false;
  }

  return /\b(has died|died at|dies at|dead at|passed away|passes away|death of|obituary|remembering|remembered for|mourns?|mourning|tribute to|tributes to|r\.?i\.?p\.?)\b/i
    .test(articleText);
}

function isRevealDrivenArticle(article: RSSImageSelectionArticle): boolean {
  return getRevealDrivenArticleMode(article) !== null;
}

function getRevealDrivenFallbackLimit(article: RSSImageSelectionArticle, limit: number): number {
  const mode = getRevealDrivenArticleMode(article);
  if (mode === 'poster' || mode === 'single_image') {
    return 1;
  }

  return Math.max(1, Math.min(limit, 2));
}

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
  "contextProject": "movie/show/project needed to disambiguate the image or null",
  "requiredContextTerms": ["terms that must appear in a good result"],
  "referenceOnlySubjects": ["subjects mentioned only as comparisons or prior credits"],
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
- If the story is about one specific character, movie, or actor inside a broader franchise milestone, choose the specific character/movie/actor instead of the umbrella franchise.
- If comparison franchises or prior credits appear in phrases like "known for", "hits like", "such as", "including", or "elements of", put them in referenceOnlySubjects. They must not drive the image.
- If the story depends on a specific movie/show context, set contextProject and add requiredContextTerms for that project, studio, actor, or year.
- Do not suggest fan art, wallpapers, memes, mockups, or stock-photo style results.
- Do not suggest party decor, birthday banners, invitations, printables, merchandise, comic panels, or unrelated franchise characters.
- Logo-only images are allowed only for the exact movie/show logo or a clearly relevant official studio/platform logo.`;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildArticleAnalysisText(article: RSSImageSelectionArticle): string {
  return [
    article.title,
    article.description,
    article.generatedCaption,
    article.author,
    article.contentHtml,
  ].filter(Boolean).join(' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function looksLikeNamedPerson(value: string): boolean {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) {
    return false;
  }

  return parts.every((part) => /^[A-Z][A-Za-z'’.-]{1,}$/.test(part));
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

function extractQuotedSubjects(value: string): string[] {
  return uniqueStrings(
    Array.from(value.matchAll(/["“']([^"”']{2,80})["”']/g))
      .map((match) => match[1]?.trim() || '')
  );
}

function splitIntoSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getLeadContextWindow(description?: string): string {
  if (!description) {
    return '';
  }

  const sentences = splitIntoSentences(description);
  if (sentences.length === 0) {
    return description.trim().slice(0, 320);
  }

  return sentences
    .slice(0, 2)
    .join(' ')
    .trim()
    .slice(0, 320);
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

function getImageIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.toLowerCase()}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function isBlockedFeedFallbackUrl(url: string): boolean {
  const normalizedUrl = normalizeText(url);
  if (!normalizedUrl) {
    return true;
  }

  if (isOutletBrandedFrameText(normalizedUrl)) {
    return true;
  }

  if (containsKeyword(normalizedUrl, FEED_FALLBACK_BLOCKED_URL_KEYWORDS)) {
    return true;
  }

  try {
    const domain = normalizeText(new URL(url).hostname);
    if (FEED_FALLBACK_BLOCKED_DOMAINS.some((blocked) => domain.includes(normalizeText(blocked)))) {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}

function isGenericBrandingFeedFallback(
  url: string,
  analysis: RSSSubjectAnalysis,
  article: RSSImageSelectionArticle
): boolean {
  if (analysis.imageIntent === 'logo' || analysis.imageIntent === 'brand_backdrop' || analysis.allowLogoOnly) {
    return false;
  }

  const urlText = normalizeText(url);
  if (!urlText) {
    return true;
  }

  const projectTerms = uniqueStrings([
    analysis.contextProject,
    analysis.visualSubject,
    analysis.primarySubject.name,
    article.title,
  ]);
  const hasProjectSignal = projectTerms.some((term) => entityMatches(urlText, term));
  if (hasProjectSignal) {
    return false;
  }

  const studioMatchCount = analysis.relevantStudios.filter((studio) => entityMatches(urlText, studio)).length;
  const hasBrandingSignal = containsKeyword(urlText, [
    ...LOGO_KEYWORDS,
    ...OFFICIAL_STUDIO_TERMS,
    'studio',
    'network',
    'streaming',
    'service',
    'channel',
    'banner',
  ]);

  return studioMatchCount > 0 && hasBrandingSignal;
}

function filterAllowedFeedFallbackUrls(
  urls: string[],
  analysis?: RSSSubjectAnalysis,
  article?: RSSImageSelectionArticle
): string[] {
  return urls.filter((url) => {
    if (isBlockedFeedFallbackUrl(url)) {
      return false;
    }

    if (analysis && article && isGenericBrandingFeedFallback(url, analysis, article)) {
      return false;
    }

    return true;
  });
}

function filterProjectLinkedFeedFallbackUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    try {
      const domain = normalizeText(new URL(url).hostname);
      return !PROJECT_LINKED_FEED_FALLBACK_BLOCKED_DOMAINS.some((blocked) =>
        domain.includes(normalizeText(blocked))
      );
    } catch {
      return false;
    }
  });
}

async function probeFeedFallbackUrl(url: string): Promise<FeedFallbackProbeResult> {
  const cached = feedFallbackProbeCache.get(url);
  if (cached) {
    return cached;
  }

  const probePromise = (async (): Promise<FeedFallbackProbeResult> => {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          allowed: false,
          reason: `fetch failed (${response.status})`,
        };
      }

      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!contentType.startsWith('image/')) {
        return {
          allowed: false,
          reason: `non-image content (${contentType || 'unknown'})`,
        };
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer, { animated: false }).metadata().catch(() => null);
      if (!metadata?.width || !metadata?.height) {
        return {
          allowed: false,
          reason: 'missing image metadata',
        };
      }

      if (metadata.width < MIN_FEED_FALLBACK_WIDTH || metadata.height < MIN_FEED_FALLBACK_HEIGHT) {
        return {
          allowed: false,
          width: metadata.width,
          height: metadata.height,
          reason: `too small (${metadata.width}x${metadata.height})`,
        };
      }

      return {
        allowed: true,
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : 'probe failed',
      };
    }
  })();

  feedFallbackProbeCache.set(url, probePromise);
  return probePromise;
}

async function filterRenderableFeedFallbackUrls(urls: string[]): Promise<string[]> {
  const results = await Promise.all(
    urls.map(async (url) => ({
      url,
      probe: await probeFeedFallbackUrl(url),
    }))
  );

  return results.flatMap(({ url, probe }) => {
    if (probe.allowed) {
      return [url];
    }

    console.warn('[RSS] Dropping feed fallback image before publish preflight.', {
      url,
      reason: probe.reason,
      width: probe.width,
      height: probe.height,
    });
    return [];
  });
}

function extractCandidateMetaImage(html: string, pageUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?:secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate) {
      continue;
    }

    try {
      return new URL(candidate, pageUrl).toString();
    } catch {
      continue;
    }
  }

  return null;
}

async function extractImageFromSourcePage(sourcePage: string): Promise<string | null> {
  const cached = openAIWebPageImageCache.get(sourcePage);
  if (cached) {
    return cached;
  }

  const pending = (async (): Promise<string | null> => {
    try {
      const response = await fetch(sourcePage, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      return extractCandidateMetaImage(html, sourcePage);
    } catch {
      return null;
    }
  })();

  openAIWebPageImageCache.set(sourcePage, pending);
  return pending;
}

function shouldUseFeedFallbackImages(_article: RSSImageSelectionArticle): boolean {
  return false;
}

function shouldAllowProjectLinkedFeedFallback(
  article: RSSImageSelectionArticle,
  analysis: RSSSubjectAnalysis
): boolean {
  if (isRevealDrivenArticle(article) || isMemorialStory(article)) {
    return false;
  }

  const articleText = buildArticleAnalysisText(article);
  const quotedProject = extractQuotedSubjects(article.title).find((subject) => !looksLikeNamedPerson(subject));
  const leadProject = extractLeadProjectAnchor(article, analysis);
  const projectAnchor = quotedProject || leadProject || analysis.contextProject;

  if (!projectAnchor || looksLikeNamedPerson(projectAnchor)) {
    return false;
  }

  const inferredType = inferSlotType(projectAnchor, articleText, 'franchise', analysis);
  if (!isProjectAnchorType(inferredType)) {
    return false;
  }

  return /\b(casts?|joins?|signed?|set\b|series|season|production|drama|comedy|film|movie|show|return|renewed|begins)\b/i
    .test(articleText);
}

function shouldAllowRawProjectLinkedFeedFallback(article: RSSImageSelectionArticle): boolean {
  if (isRevealDrivenArticle(article) || isMemorialStory(article)) {
    return false;
  }

  const articleText = buildArticleAnalysisText(article);
  const quotedProject = extractQuotedSubjects(article.title).find((subject) => !looksLikeNamedPerson(subject));
  const leadProject = extractLeadProjectAnchor(article, {
    editorialPrimary: '',
    primarySubject: { name: '', type: 'general' },
    visualSubject: '',
    imageIntent: 'still',
    secondarySubjects: [],
    relevantStudios: [],
    contextType: 'general',
    contextProject: null,
    requiredContextTerms: [],
    referenceOnlySubjects: [],
    allowLogoOnly: false,
    targetFormat: 'general',
    animatedSubject: false,
    queries: [],
  });

  return Boolean(quotedProject || leadProject) &&
    /\b(casts?|joins?|signed?|set\b|series|season|production|drama|comedy|film|movie|show|return|renewed|begins)\b/i
      .test(articleText);
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

function isOutletBrandedFrameText(text: string): boolean {
  if (!text) {
    return false;
  }

  return containsKeyword(text, OUTLET_BRANDED_FRAME_OUTLETS) &&
    containsKeyword(text, OUTLET_BRANDED_FRAME_SIGNALS);
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

function extractReferenceOnlySubjects(articleText: string): string[] {
  const matches: string[] = [];

  for (const sentence of splitIntoSentences(articleText)) {
    const normalizedSentence = normalizeText(sentence);
    if (!REFERENCE_ONLY_CUES.some((cue) => normalizedSentence.includes(normalizeText(cue)))) {
      continue;
    }

    matches.push(...extractQuotedSubjects(sentence));
  }

  return uniqueStrings(matches);
}

function extractYearTokens(articleText: string): string[] {
  return uniqueStrings(
    Array.from(articleText.matchAll(/\b(19\d{2}|20\d{2})\b/g))
      .map((match) => match[1] || '')
  );
}

function extractLeadTitleCandidate(title: string): string | null {
  if (!/[:]|(?:\bfranchise\b|\bmovie\b|\bfilm\b|\bseries\b|\bshow\b)/i.test(title)) {
    return null;
  }

  const match = title.match(
    /^(.+?)(?:\s+(?:is|are|was|were|will|can|could|coming|returns|returning|complete|completed|confirmed|delivers|ranking|ranked|reveals|breaks|changed|marks|sets)\b|[!?]$|$)/i
  );
  const candidate = match?.[1]?.trim();

  if (!candidate) {
    return null;
  }

  const cleaned = candidate
    .replace(/\b(sequel movie|sequel film|sequel|movie|film|franchise|series|show|season)\b$/i, '')
    .replace(/[:\-–]+$/g, '')
    .trim();

  return cleaned || candidate;
}

function cleanHeadlineProjectCandidate(candidate: string): string {
  return candidate
    .replace(/['’]s\b/g, '')
    .replace(/^(?:the|a|an|new|latest|upcoming)\s+/i, '')
    .replace(/\b(?:tv|movie|film|series|show|spinoff|spin-off|franchise|sequel|reboot|remake|adaptation|villain|update|future)\b$/i, '')
    .replace(/[,:;!?\-–]+$/g, '')
    .trim();
}

function normalizeHeadlineProjectCandidate(candidate: string): string {
  return cleanHeadlineProjectCandidate(
    candidate
      .replace(/^(?:[A-Z][A-Za-z'â€™.-]+(?:\s+[A-Z][A-Za-z'â€™.-]+){1,3})['â€™]s\s+(?:new|next|upcoming)\s+/i, '')
      .replace(/^(?:[A-Z][A-Za-z0-9'â€™:&.-]+\s+)?(?:announces?|announced|confirms?|confirmed|reveals?|revealed|teases?|teased|orders?|ordered|renews?|renewed|develops?|developing|brings?|bringing|sets?|set|greenlights?|greenlit|previews?|previewed)\s+/i, '')
  );
}

function isGenericHeadlineProjectCandidate(candidate: string): boolean {
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedCandidate) {
    return true;
  }

  if (GENERIC_DEMOGRAPHIC_TERMS.has(normalizedCandidate)) {
    return true;
  }

  const tokens = normalizedCandidate.split(' ').filter(Boolean);
  if (tokens.length === 0 || tokens.length > 6) {
    return true;
  }

  return tokens.every((token) => HEADLINE_PROJECT_GENERIC_TERMS.has(token));
}

function getSubjectContextSnippet(articleText: string, subject: string): string {
  const normalizedArticle = normalizeText(articleText);
  const normalizedSubject = normalizeText(subject);
  if (!normalizedArticle || !normalizedSubject) {
    return normalizedArticle;
  }

  const pattern = new RegExp(`\\b${escapeRegExp(normalizedSubject)}\\b`, 'g');
  const snippets: string[] = [];

  for (const match of normalizedArticle.matchAll(pattern)) {
    const index = match.index ?? -1;
    if (index < 0) {
      continue;
    }

    const start = Math.max(0, index - 120);
    const end = Math.min(normalizedArticle.length, index + normalizedSubject.length + 120);
    snippets.push(normalizedArticle.slice(start, end).trim());
    if (snippets.length >= 3) {
      break;
    }
  }

  return snippets.join(' ');
}

function hasExplicitTitleFormatting(articleText: string, subject: string): boolean {
  if (!articleText || !subject.trim()) {
    return false;
  }

  const escaped = escapeRegExp(subject.trim());
  return new RegExp(`["'â€œâ€]${escaped}["'â€œâ€]`, 'i').test(articleText);
}

function classifyContextSensitiveSubjectUsage(
  articleText: string,
  subject: string
): 'media_entity' | 'generic' | 'ambiguous' {
  const normalizedSubject = normalizeText(subject);
  if (!normalizedSubject || !CONTEXT_SENSITIVE_ENTITY_TERMS.has(normalizedSubject)) {
    return 'media_entity';
  }

  if (hasExplicitTitleFormatting(articleText, subject)) {
    return 'media_entity';
  }

  const contextSnippet = getSubjectContextSnippet(articleText, subject);
  const contextText = `${normalizeText(articleText)} ${contextSnippet}`.trim();
  const hasProjectCue = CONTEXT_SENSITIVE_PROJECT_CUES.test(contextText);
  const hasGenericCue = CONTEXT_SENSITIVE_GENERIC_CUES.test(contextText);

  if (GENERIC_DEMOGRAPHIC_TERMS.has(normalizedSubject)) {
    if (hasProjectCue) {
      return 'media_entity';
    }

    return hasGenericCue ? 'generic' : 'ambiguous';
  }

  if (HIGH_AMBIGUITY_CONTEXT_TERMS.has(normalizedSubject)) {
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

function shouldTreatAsGenericDemographicSubject(articleText: string, subject: string): boolean {
  const normalizedSubject = normalizeText(subject);
  if (!GENERIC_DEMOGRAPHIC_TERMS.has(normalizedSubject)) {
    return false;
  }

  return classifyContextSensitiveSubjectUsage(articleText, subject) !== 'media_entity'
    && !GENERIC_DEMOGRAPHIC_PROJECT_CUES.test(articleText);
}

function extractHeadlineProjectCandidate(
  title: string,
  articleText: string,
  studios: string[]
): string | null {
  const quotedSubjects = extractQuotedSubjects(title);
  const titleMatches = uniqueStrings([
    ...quotedSubjects,
    title.match(/^([A-Z][A-Za-z0-9'’:&-]+(?:\s+[A-Z][A-Za-z0-9'’:&-]+){0,5})['’]s\b/)?.[1],
    ...Array.from(
      title.matchAll(
        /\b([A-Z][A-Za-z0-9'’:&-]+(?:\s+[A-Z][A-Za-z0-9'’:&-]+){0,4})\s+(?:tv\s+show|series|show|movie|film|franchise|spinoff|spin-off|sequel|reboot|remake|adaptation)\b/g
      )
    ).map((match) => match[1]?.trim() || ''),
    ...Array.from(
      title.matchAll(/\b([A-Z][A-Za-z0-9'’:&-]+(?:\s+[A-Z][A-Za-z0-9'’:&-]+){1,4})\b/g)
    ).map((match) => match[1]?.trim() || ''),
  ]);

  const leadWindow = normalizeText(getLeadContextWindow(articleText));
  const ranked = titleMatches
    .map((candidate) => {
      const isQuoted = quotedSubjects.some((quoted) => normalizeText(quoted) === normalizeText(candidate));
      return isQuoted ? candidate.trim() : normalizeHeadlineProjectCandidate(candidate);
    })
    .filter(Boolean)
    .filter((candidate) => {
      const normalizedCandidate = normalizeText(candidate);
      if (!normalizedCandidate) {
        return false;
      }

      if (looksLikeNamedPerson(candidate)) {
        return false;
      }

      if (studios.some((studio) => normalizeText(studio) === normalizedCandidate)) {
        return false;
      }

      if (GENERIC_CONTAINER_SUBJECT_TERMS.includes(normalizedCandidate) || isGenericHeadlineProjectCandidate(candidate)) {
        return false;
      }

      if (classifyContextSensitiveSubjectUsage(articleText, candidate) !== 'media_entity') {
        return false;
      }

      const inferredType = inferContentSubjectType(articleText, candidate);
      return inferredType === 'movie' || inferredType === 'tv_show' || inferredType === 'franchise';
    })
    .map((candidate) => {
      const normalizedCandidate = normalizeText(candidate);
      const tokens = normalizedCandidate.split(' ').filter(Boolean);
      const score =
        (entityMatches(normalizeText(title), candidate) ? 120 : 0)
        + (leadWindow.includes(normalizedCandidate) ? 70 : 0)
        + Math.min(tokens.length * 12, 48)
        + (quotedSubjects.some((quoted) => normalizeText(quoted) === normalizedCandidate) ? 120 : 0)
        - (HEADLINE_PROJECT_GENERIC_TERMS.has(tokens[0] || '') ? 40 : 0);

      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.candidate || null;
}

function extractLeadPersonSubject(title: string): string | null {
  const match = title.match(
    /^([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3})\s+(?:says|said|confirms|confirmed|is|isn't|isnt|will|won't|wont|doesn't|doesnt|returns|returning|addresses|speaks|discusses|talks|joins|joined|teases|reveals|reacts|voices|voicing)\b/
  );

  const candidate = match?.[1]?.trim();
  return candidate && looksLikeNamedPerson(candidate) ? candidate : null;
}

function extractHeadlineCastingPerson(title: string): string | null {
  const match = title.match(
    /^(?:["'â€œâ€][^"'â€œâ€]{2,120}["'â€œâ€]|[A-Z][A-Za-z0-9'â€™:&.-]+(?:\s+[A-Z][A-Za-z0-9'â€™:&.-]+){0,5})\s+(?:adds?|added|casts?|cast|taps?|tapped|boards?|boarded|sets?|set|hires?|hired)\s+([A-Z][A-Za-z'â€™.-]+(?:\s+[A-Z][A-Za-z'â€™.-]+){1,3})\b/
  );

  const candidate = match?.[1]?.trim();
  return candidate && looksLikeNamedPerson(candidate) ? candidate : null;
}

function extractNamedPeople(articleText: string, analysis: RSSSubjectAnalysis): string[] {
  return uniqueStrings(
    Array.from(articleText.matchAll(/\b([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,2})\b/g))
      .map((match) => match[1]?.trim() || '')
      .filter((candidate) => {
        if (!looksLikeNamedPerson(candidate)) {
          return false;
        }

        const parts = candidate.split(/\s+/);
        if (parts.some((part) => PERSON_NAME_STOPWORDS.includes(part))) {
          return false;
        }

        const normalizedCandidate = normalizeText(candidate);
        if (!normalizedCandidate) {
          return false;
        }

        if (normalizedCandidate === normalizeText(analysis.primarySubject.name)) {
          return false;
        }

        if (analysis.contextProject && normalizedCandidate === normalizeText(analysis.contextProject)) {
          return false;
        }

        if (analysis.relevantStudios.some((studio) => normalizeText(studio) === normalizedCandidate)) {
          return false;
        }

        return true;
      })
  );
}

function isContainerSubjectType(type: SubjectType): boolean {
  return type === 'studio' || type === 'streaming_service';
}

function inferContentSubjectType(articleText: string, subject: string): SubjectType {
  const normalizedArticle = normalizeText(articleText);
  const normalizedSubject = normalizeText(subject);
  const contextualUsage = classifyContextSensitiveSubjectUsage(articleText, subject);
  if (
    contextualUsage === 'generic'
    || (contextualUsage === 'ambiguous' && CONTEXT_SENSITIVE_ENTITY_TERMS.has(normalizedSubject))
  ) {
    return 'general';
  }

  if (shouldTreatAsGenericDemographicSubject(articleText, subject)) {
    return 'general';
  }
  const subjectAppears = normalizedSubject &&
    new RegExp(`\\b${escapeRegExp(normalizedSubject)}\\b`).test(normalizedArticle);

  if (
    subjectAppears &&
    (
      new RegExp(`\\b${escapeRegExp(normalizedSubject)}\\s+(?:character|villain|hero|protagonist|antagonist)\\b`).test(normalizedArticle) ||
      new RegExp(`\\b(?:character|villain|hero|protagonist|antagonist)\\s+(?:named\\s+)?${escapeRegExp(normalizedSubject)}\\b`).test(normalizedArticle)
    )
  ) {
    return 'character';
  }

  if (
    subjectAppears &&
    looksLikeNamedPerson(subject) &&
    (
      new RegExp(`\\b(?:actor|actress|star|stars|starring|cast(?: member)?)\\s+${escapeRegExp(normalizedSubject)}\\b`).test(normalizedArticle) ||
      new RegExp(`\\b${escapeRegExp(normalizedSubject)}\\s+(?:actor|actress|star|stars|cast member)\\b`).test(normalizedArticle)
    )
  ) {
    return 'actor';
  }

  if (/\bseries|season|episode|showrunner|tv show|live action series\b/i.test(articleText)) {
    return 'tv_show';
  }

  if (/\bmovie|film|feature film|feature movie|adaptation|remake|reboot|spinoff|sequel\b/i.test(articleText)) {
    return 'franchise';
  }

  return 'franchise';
}

function extractContainerOwnedContentSubject(title: string, studios: string[], articleText = title): string | null {
  if (studios.length === 0) {
    return null;
  }

  const normalizedTitle = normalizeText(title);
  if (!containsKeyword(normalizedTitle, CONTAINER_STORY_CUES)) {
    return null;
  }

  for (const studio of [...studios].sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(
      `^${escapeRegExp(studio)}['’]s\\s+(.+?)(?=\\s+(?:is|are|was|were|will|can|could|set|gets|getting|coming|returns|returning|complete|completed|confirmed|delivers|ranking|ranked|reveals|breaks|changed|marks|sets|joins|joined|heads|headed|lands|live[- ]action|adaptation|movie|film|series|show|sequel|reboot|remake|spinoff|trailer|teaser|poster|release|premiere)\\b|[!?]|$)`,
      'i'
    );
    const match = title.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate) {
      continue;
    }

    const cleaned = candidate
      .replace(/^(?:new|upcoming|beloved)\s+/i, '')
      .replace(/\b(character|franchise|movie|film|series|show)\b$/i, '')
      .replace(/[,:;\-–]+$/g, '')
      .trim();
    const normalizedCandidate = normalizeText(cleaned);

    if (!normalizedCandidate) {
      continue;
    }

    if (normalizedCandidate.split(' ').length > 6) {
      continue;
    }

    if (GENERIC_CONTAINER_SUBJECT_TERMS.includes(normalizedCandidate)) {
      continue;
    }

    if (classifyContextSensitiveSubjectUsage(articleText, cleaned) !== 'media_entity') {
      continue;
    }

    return cleaned;
  }

  return null;
}

function extractRelevantStudios(articleText: string): string[] {
  const normalized = normalizeText(articleText);
  return OFFICIAL_STUDIO_TERMS.filter((term) => normalized.includes(normalizeText(term)));
}

function extractStreamingPlatformMentions(articleText: string): string[] {
  const normalized = normalizeText(articleText);

  return uniqueStrings(
    STREAMING_PLATFORM_ALIASES
      .filter((entry) => entry.aliases.some((alias) => {
        const normalizedAlias = normalizeText(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${normalizedAlias}\\b`, 'i').test(normalized);
      }))
      .map((entry) => entry.canonical)
  );
}

function isStreamingAvailabilityStory(
  article: RSSImageSelectionArticle,
  analysis?: RSSSubjectAnalysis
): boolean {
  const articleText = buildArticleAnalysisText(article);
  if (!STREAMING_AVAILABILITY_PATTERNS.some((pattern) => pattern.test(articleText))) {
    return false;
  }

  if (extractStreamingPlatformMentions(articleText).length === 0) {
    return false;
  }

  if (!analysis) {
    return true;
  }

  return analysis.primarySubject.type === 'movie' ||
    analysis.primarySubject.type === 'tv_show' ||
    analysis.primarySubject.type === 'franchise';
}

function getPrimaryStreamingPlatform(articleText: string): string | null {
  return extractStreamingPlatformMentions(articleText)[0] || null;
}

function buildReferenceOnlyFreeSecondarySubjects(
  secondarySubjects: string[],
  referenceOnlySubjects: string[],
  primaryName: string
): string[] {
  return secondarySubjects.filter((subject) => {
    if (normalizeText(subject) === normalizeText(primaryName)) {
      return false;
    }

    return !referenceOnlySubjects.some((referenceOnly) => normalizeText(referenceOnly) === normalizeText(subject));
  });
}

function extractContextProject(
  articleText: string,
  primaryName: string,
  primaryType: SubjectType,
  secondarySubjects: string[],
  referenceOnlySubjects: string[],
  relevantStudios: string[]
): string | null {
  const filteredQuoted = extractQuotedSubjects(articleText).filter((subject) => {
    const normalizedSubject = normalizeText(subject);
    if (!normalizedSubject || normalizedSubject === normalizeText(primaryName)) {
      return false;
    }

    if (referenceOnlySubjects.some((referenceOnly) => normalizeText(referenceOnly) === normalizedSubject)) {
      return false;
    }

    if (relevantStudios.some((studio) => normalizeText(studio) === normalizedSubject)) {
      return false;
    }

    return true;
  });

  if (
    (primaryType === 'actor' || primaryType === 'director' || primaryType === 'producer' || primaryType === 'character') &&
    filteredQuoted.length > 0
  ) {
    const linkedQuoted = filteredQuoted.find((subject) => entityMatches(normalizeText(subject), primaryName));
    return linkedQuoted || filteredQuoted[0];
  }

  const filteredSecondary = buildReferenceOnlyFreeSecondarySubjects(
    secondarySubjects,
    referenceOnlySubjects,
    primaryName
  );

  if (
    (primaryType === 'actor' || primaryType === 'director' || primaryType === 'producer' || primaryType === 'character') &&
    filteredSecondary.length > 0
  ) {
    return filteredSecondary[0];
  }

  return null;
}

function buildRequiredContextTerms(
  articleTitle: string,
  articleText: string,
  primaryName: string,
  primaryType: SubjectType,
  visualSubject: string,
  contextProject: string | null,
  secondarySubjects: string[],
  referenceOnlySubjects: string[],
  relevantStudios: string[]
): string[] {
  const yearTokens = extractYearTokens(articleText);
  const filteredSecondary = buildReferenceOnlyFreeSecondarySubjects(
    secondarySubjects,
    referenceOnlySubjects,
    primaryName
  );
  const normalizedVisual = normalizeText(visualSubject);
  const normalizedPrimary = normalizeText(primaryName);
  const wantsAnimatedOverLiveAction =
    /\blive action\b/i.test(articleText) &&
    !/\blive action\b/i.test(articleTitle) &&
    /\bmovie|film|feature film|sequel\b/i.test(articleText);

  const terms = uniqueStrings([
    contextProject,
    wantsAnimatedOverLiveAction ? 'animated' : null,
    /\bopening scene\b/i.test(articleText) ? 'opening scene' : null,
    yearTokens[0] || null,
    (primaryType === 'actor' || primaryType === 'director' || primaryType === 'producer' || primaryType === 'character')
      ? filteredSecondary[0] || null
      : null,
  ]);

  return terms.filter((term) => {
    const normalizedTerm = normalizeText(term);
    return normalizedTerm !== normalizedPrimary && normalizedTerm !== normalizedVisual;
  });
}

function getFranchiseValidationRule(analysis: RSSSubjectAnalysis): FranchiseValidationRule | null {
  const candidates = [
    analysis.editorialPrimary,
    analysis.primarySubject.name,
    analysis.visualSubject,
    analysis.contextProject,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => normalizeText(value));

  return FRANCHISE_VALIDATION_RULES.find((rule) =>
    candidates.some((candidate) =>
      rule.matchAny.some((matchTerm) => candidate.includes(normalizeText(matchTerm)))
    )
  ) ?? null;
}

function classifyContextType(articleText: string): ContextType {
  const normalized = normalizeText(articleText);

  if (/\bposter|character poster|new poster|key art|official image|official poster|first look poster\b/.test(normalized)) return 'poster_announcement';
  if (/\btrailer|teaser|clip|first look\b/.test(normalized)) return 'trailer';
  if (/\bcasting|joins?|added?|adds?|cast as|starring|boards?\b/.test(normalized)) return 'casting';
  if (/\binterview|talks about|speaks on|explains\b/.test(normalized)) return 'interview';
  if (/\bbox office|boxoffice|opens to|debuts at\b/.test(normalized)) return 'boxoffice';
  if (/\bstudio|network|streaming|service|platform|merger|ceo\b/.test(normalized)) return 'industry';
  if (/\brelease|premiere|coming to|set for|arrives\b/.test(normalized)) return 'release';
  return 'general';
}

function resolveTargetFormat(articleText: string, primaryType: SubjectType): TargetFormat {
  if (primaryType === 'tv_show' || /\bseries|season|episode|showrunner|tv show|live action series\b/i.test(articleText)) {
    return 'series';
  }

  if (primaryType === 'movie' || /\bmovie|film|feature film|feature movie|sequel\b/i.test(articleText)) {
    return 'movie';
  }

  return 'general';
}

function isUnanchoredGeneralStory(analysis: RSSSubjectAnalysis): boolean {
  return analysis.primarySubject.type === 'general' &&
    !analysis.contextProject &&
    (analysis.contextType === 'industry' || analysis.contextType === 'boxoffice' || analysis.contextType === 'general');
}

function detectAnimatedSubject(articleText: string, primaryName: string, secondarySubjects: string[]): boolean {
  const normalizedText = normalizeText(articleText);
  if (containsKeyword(normalizedText, ANIMATED_SUBJECT_KEYWORDS)) {
    return true;
  }

  return [primaryName, ...secondarySubjects].some((subject) => {
    const normalizedSubject = normalizeText(subject);
    return normalizedSubject.includes('pixar') ||
      normalizedSubject.includes('disney') ||
      normalizedSubject.includes('dreamworks') ||
      normalizedSubject.includes('illumination') ||
      normalizedSubject.includes('nickelodeon') ||
      normalizedSubject.includes('cartoon network') ||
      normalizedSubject.includes('anime');
  });
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
  const articleText = buildArticleAnalysisText(article);
  const studios = extractRelevantStudios(articleText);
  const referenceOnlySubjects = extractReferenceOnlySubjects(articleText);
  const normalizedTitle = article.title.trim();
  const leadTitleCandidate = extractLeadTitleCandidate(normalizedTitle);
  const headlineProjectCandidate = extractHeadlineProjectCandidate(normalizedTitle, articleText, studios);
  const leadPersonCandidate = extractLeadPersonSubject(normalizedTitle);
  const containerOwnedSubject = extractContainerOwnedContentSubject(normalizedTitle, studios, articleText);
  const quotedMatches = Array.from(normalizedTitle.matchAll(/["“']([^"”']{2,80})["”']/g))
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];

  let primaryName = quotedMatches[0] || leadTitleCandidate || headlineProjectCandidate || normalizedTitle;
  let primaryType: SubjectType = 'general';
  const titleLooksLikeStudioStory = /\b(studio|streaming|network|service|platform|ceo|merger|deal|subscriber|pricing|subscription|brand)\b/i.test(normalizedTitle);

  if (containerOwnedSubject) {
    primaryName = containerOwnedSubject;
    primaryType = inferContentSubjectType(articleText, containerOwnedSubject);
  } else if (headlineProjectCandidate) {
    primaryName = headlineProjectCandidate;
    primaryType = inferContentSubjectType(articleText, headlineProjectCandidate);
  } else if (leadPersonCandidate && quotedMatches.length === 0 && !titleLooksLikeStudioStory) {
    primaryName = leadPersonCandidate;
    primaryType = 'actor';
  } else if (studios.length > 0 && titleLooksLikeStudioStory && quotedMatches.length === 0) {
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
  const targetFormat = resolveTargetFormat(articleText, primaryType);
  const animatedSubject = detectAnimatedSubject(articleText, primaryName, secondarySubjects);
  const visual = resolveImageIntent(primaryType, contextType, primaryName, secondarySubjects, studios);
  const contextProject = extractContextProject(
    articleText,
    primaryName,
    primaryType,
    secondarySubjects,
    referenceOnlySubjects,
    studios
  );
  const requiredContextTerms = buildRequiredContextTerms(
    article.title,
    articleText,
    primaryName,
    primaryType,
    visual.visualSubject,
    contextProject,
    secondarySubjects,
    referenceOnlySubjects,
    studios
  );
  const queries = buildFallbackQueries(
    visual.visualSubject,
    primaryType,
    secondarySubjects,
    contextType,
    visual.imageIntent,
    contextProject,
    requiredContextTerms
  );

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
    targetFormat,
    animatedSubject,
    contextProject,
    requiredContextTerms,
    referenceOnlySubjects,
    allowLogoOnly: visual.allowLogoOnly,
    queries,
  };
}

function buildFallbackQueries(
  primaryName: string,
  primaryType: SubjectType,
  secondarySubjects: string[],
  contextType: ContextType,
  imageIntent: ImageIntent,
  contextProject?: string | null,
  requiredContextTerms: string[] = []
): string[] {
  const secondary = secondarySubjects[0];
  const contextTerm = contextProject
    || requiredContextTerms.find((term) => !/^\d{4}$/.test(term))
    || secondary;
  const yearTerm = requiredContextTerms.find((term) => /^\d{4}$/.test(term));

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
        contextTerm ? `${primaryName} ${contextTerm} press photo` : null,
        `${primaryName} portrait`,
        `${primaryName} press photo`,
        `${primaryName} headshot`,
        yearTerm ? `${primaryName} ${yearTerm} photo` : null,
        primaryName,
      ]);
    case 'character_still':
      return uniqueStrings([
        contextTerm ? `${primaryName} ${contextTerm} still` : null,
        `${primaryName} character still`,
        `${primaryName} official still`,
        `${primaryName} scene still`,
        yearTerm ? `${primaryName} ${yearTerm} still` : null,
        primaryName,
      ]);
    case 'still':
      return uniqueStrings([
        contextTerm ? `${primaryName} ${contextTerm} still` : `${primaryName} still`,
        yearTerm ? `${primaryName} ${yearTerm} still` : null,
        `${primaryName} scene still`,
        `${primaryName} production still`,
        contextTerm ? `${primaryName} ${contextTerm} official still` : null,
        `${primaryName} backdrop`,
      ]);
    case 'backdrop':
      return uniqueStrings([
        contextTerm ? `${primaryName} ${contextTerm} backdrop` : `${primaryName} backdrop`,
        yearTerm ? `${primaryName} ${yearTerm} backdrop` : null,
        `${primaryName} scene still`,
        `${primaryName} production still`,
        contextTerm ? `${primaryName} ${contextTerm} official still` : `${primaryName} official still`,
        contextType === 'poster_announcement' ? `${primaryName} official poster` : null,
      ]);
    case 'poster':
      return uniqueStrings([
        contextTerm ? `${primaryName} ${contextTerm} official poster` : null,
        `${primaryName} official poster`,
        `${primaryName} new poster`,
        `${primaryName} key art`,
        yearTerm ? `${primaryName} ${yearTerm} poster` : null,
        `${primaryName} character poster`,
      ]);
    default:
      return uniqueStrings([
        contextTerm ? `${primaryName} ${contextTerm} still` : null,
        `${primaryName} still`,
        `${primaryName} backdrop`,
        `${primaryName} production still`,
        yearTerm ? `${primaryName} ${yearTerm} still` : null,
        primaryName,
      ]);
  }
}

function normalizeSubjectAnalysis(value: any, article: RSSImageSelectionArticle): RSSSubjectAnalysis {
  const fallback = guessPrimarySubject(article);
  const articleText = buildArticleAnalysisText(article);
  const isListArticle = isListLikeArticle(article);
  const heuristicStudios = extractRelevantStudios(articleText);
  const heuristicReferenceOnlySubjects = extractReferenceOnlySubjects(articleText);
  const fallbackProjectCandidate = isProjectAnchorType(fallback.primarySubject.type) &&
    subjectAppearsInTitle(fallback.primarySubject.name, article.title) &&
    normalizeText(fallback.primarySubject.name) !== normalizeText(article.title)
    ? fallback.primarySubject.name
    : null;
  const relevantStudios = uniqueStrings([
    ...(Array.isArray(value?.relevantStudios) ? value.relevantStudios : []),
    ...heuristicStudios,
  ]);
  const secondaryProjectCandidate = uniqueStrings(
    Array.isArray(value?.secondarySubjects) ? value.secondarySubjects : []
  ).find((subject) => {
    const normalizedSubject = normalizeText(subject);
    if (!normalizedSubject) {
      return false;
    }

    if (!subjectAppearsInTitle(subject, article.title)) {
      return false;
    }

    if (relevantStudios.some((studio) => normalizeText(studio) === normalizedSubject)) {
      return false;
    }

    return true;
  }) || null;
  const containerOwnedSubject = extractContainerOwnedContentSubject(article.title, relevantStudios, articleText);
  const headlineProjectCandidate = extractHeadlineProjectCandidate(article.title, articleText, relevantStudios)
    || secondaryProjectCandidate
    || fallbackProjectCandidate;
  const rawEditorialPrimary = typeof value?.editorialPrimary === 'string'
    ? value.editorialPrimary.trim()
    : fallback.editorialPrimary;
  const rawPrimaryName = typeof value?.primarySubject?.name === 'string'
    ? value.primarySubject.name.trim()
    : fallback.primarySubject.name;
  const rawPrimaryType = typeof value?.primarySubject?.type === 'string'
    ? value.primarySubject.type as SubjectType
    : fallback.primarySubject.type;
  const shouldOverrideContainerPrimary = Boolean(
    containerOwnedSubject && (
      isContainerSubjectType(rawPrimaryType)
      || relevantStudios.some((studio) => normalizeText(studio) === normalizeText(rawPrimaryName))
    )
  );
  const shouldOverrideHeadlineProject = Boolean(
    headlineProjectCandidate && (
      rawPrimaryType === 'general' ||
      isContainerSubjectType(rawPrimaryType) ||
      (!subjectAppearsInTitle(rawPrimaryName, article.title) && subjectAppearsInTitle(headlineProjectCandidate, article.title))
    )
  );
  const editorialPrimary = shouldOverrideContainerPrimary
    ? containerOwnedSubject!
    : shouldOverrideHeadlineProject
      ? headlineProjectCandidate!
      : rawEditorialPrimary;
  const primaryName = shouldOverrideContainerPrimary
    ? containerOwnedSubject!
    : shouldOverrideHeadlineProject
      ? headlineProjectCandidate!
      : rawPrimaryName;
  const primaryType = shouldOverrideContainerPrimary
    ? inferContentSubjectType(articleText, containerOwnedSubject!)
    : shouldOverrideHeadlineProject
      ? inferContentSubjectType(articleText, headlineProjectCandidate!)
      : rawPrimaryType;
  const secondarySubjects = uniqueStrings([
    ...(Array.isArray(value?.secondarySubjects) ? value.secondarySubjects : []),
    ...relevantStudios.filter((studio) => normalizeText(studio) !== normalizeText(primaryName)),
  ]).filter((subject) => normalizeText(subject) !== normalizeText(primaryName));
  const referenceOnlySubjects = uniqueStrings([
    ...(Array.isArray(value?.referenceOnlySubjects) ? value.referenceOnlySubjects : []),
    ...heuristicReferenceOnlySubjects,
  ]).filter((subject) => {
    const normalizedSubject = normalizeText(subject);
    return normalizedSubject !== normalizeText(primaryName)
      && !relevantStudios.some((studio) => normalizeText(studio) === normalizedSubject);
  });
  const contextType = typeof value?.contextType === 'string'
    ? value.contextType as ContextType
    : fallback.contextType;
  const targetFormat = typeof value?.targetFormat === 'string'
    ? value.targetFormat as TargetFormat
    : resolveTargetFormat(articleText, primaryType);
  const animatedSubject = typeof value?.animatedSubject === 'boolean'
    ? value.animatedSubject
    : detectAnimatedSubject(articleText, primaryName, secondarySubjects);
  const visual = resolveImageIntent(primaryType, contextType, primaryName, secondarySubjects, relevantStudios);
  const rawVisualSubject = typeof value?.visualSubject === 'string'
    ? value.visualSubject.trim()
    : visual.visualSubject;
  const visualSubject = shouldOverrideContainerPrimary &&
    relevantStudios.some((studio) => normalizeText(studio) === normalizeText(rawVisualSubject))
      ? primaryName
      : shouldOverrideHeadlineProject && !subjectAppearsInTitle(rawVisualSubject, article.title)
        ? primaryName
      : rawVisualSubject;
  const rawImageIntent = typeof value?.imageIntent === 'string'
    ? value.imageIntent as ImageIntent
    : visual.imageIntent;
  const imageIntent = shouldOverrideContainerPrimary && (rawImageIntent === 'logo' || rawImageIntent === 'brand_backdrop')
    ? visual.imageIntent
    : rawImageIntent;
  const allowLogoOnly = isContainerSubjectType(primaryType)
    ? true
    : shouldOverrideContainerPrimary
      ? false
      : value?.allowLogoOnly !== false && (visual.allowLogoOnly || imageIntent === 'logo');
  const contextProjectValue = typeof value?.contextProject === 'string' && value.contextProject.trim()
    ? value.contextProject.trim()
    : extractContextProject(
        articleText,
        primaryName,
        primaryType,
        secondarySubjects,
        referenceOnlySubjects,
        relevantStudios
      );
  const requiredContextTerms = uniqueStrings([
    ...(Array.isArray(value?.requiredContextTerms) ? value.requiredContextTerms : []),
    ...buildRequiredContextTerms(
      article.title,
      articleText,
      primaryName,
      primaryType,
      visualSubject,
      contextProjectValue,
      secondarySubjects,
      referenceOnlySubjects,
      relevantStudios
    ),
  ]);
  const fallbackQueries = buildFallbackQueries(
    visualSubject,
    primaryType,
    secondarySubjects,
    contextType,
    imageIntent,
    contextProjectValue,
    requiredContextTerms
  );
  const leadGeneralSubject = secondarySubjects.find((subject) =>
    normalizeText(subject) !== normalizeText(primaryName) &&
    !relevantStudios.some((studio) => normalizeText(studio) === normalizeText(subject))
  );
  const queries = uniqueStrings([
    ...(shouldOverrideContainerPrimary || !Array.isArray(value?.queries)
      ? fallbackQueries
      : value.queries),
    (isListArticle || primaryType === 'general' || /\bcollage\b/i.test(rawVisualSubject)) ? article.title : null,
    (isListArticle || primaryType === 'general') && leadGeneralSubject ? `${leadGeneralSubject} still` : null,
  ]);

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
    targetFormat,
    animatedSubject,
    contextProject: contextProjectValue,
    requiredContextTerms,
    referenceOnlySubjects,
    allowLogoOnly,
    queries: queries.length > 0
      ? queries
      : fallbackQueries,
  };
}

function inferSlotType(
  subject: string,
  articleText: string,
  fallbackType: SubjectType,
  analysis: RSSSubjectAnalysis
): SubjectType {
  if (analysis.relevantStudios.some((studio) => normalizeText(studio) === normalizeText(subject))) {
    return /\b(disney\+|netflix|max|prime video|apple tv|hulu|peacock)\b/i.test(subject)
      ? 'streaming_service'
      : 'studio';
  }

  if (looksLikeNamedPerson(subject)) {
    return 'actor';
  }

  if (
    analysis.contextProject &&
    normalizeText(analysis.contextProject) === normalizeText(subject)
  ) {
    return analysis.targetFormat === 'series' ? 'tv_show' : 'franchise';
  }

  if (
    analysis.primarySubject.type !== 'actor' &&
    analysis.primarySubject.type !== 'director' &&
    analysis.primarySubject.type !== 'producer' &&
    analysis.primarySubject.type !== 'studio' &&
    analysis.primarySubject.type !== 'streaming_service'
  ) {
    return analysis.primarySubject.type;
  }

  return fallbackType;
}

function buildSlotQueries(
  subject: string,
  type: SubjectType,
  intent: ImageIntent,
  analysis: RSSSubjectAnalysis
): string[] {
  const baseQueries = buildFallbackQueries(
    subject,
    type,
    [],
    analysis.contextType,
    intent,
    analysis.contextProject,
    analysis.requiredContextTerms
  );

  if (intent !== 'logo' || isContainerSubjectType(type)) {
    return baseQueries;
  }

  return uniqueStrings([
    `${subject} official title logo`,
    `${subject} title logo`,
    `${subject} official logo transparent`,
    `${subject} title treatment`,
    `${subject} wordmark`,
    `${subject} logo dark background`,
    ...baseQueries,
  ]);
}

function buildImageSlotPlan(
  subject: string,
  type: SubjectType,
  intent: ImageIntent,
  analysis: RSSSubjectAnalysis,
  allowLogoOnly = intent === 'logo'
): ImageSlotPlan {
  return {
    subject,
    type,
    intent,
    allowLogoOnly,
    requiredContextTerms: analysis.requiredContextTerms,
    queries: buildSlotQueries(subject, type, intent, analysis),
  };
}

function subjectAppearsInTitle(subject: string | null | undefined, title: string): boolean {
  if (!subject) {
    return false;
  }

  return entityMatches(normalizeText(title), subject);
}

function subjectAppearsInLead(subject: string | null | undefined, description?: string): boolean {
  if (!subject) {
    return false;
  }

  const leadWindow = normalizeText(getLeadContextWindow(description));
  if (!leadWindow) {
    return false;
  }

  return entityMatches(leadWindow, subject);
}

function subjectAppearsProminently(
  subject: string | null | undefined,
  article: RSSImageSelectionArticle
): boolean {
  return subjectAppearsInTitle(subject, article.title) || subjectAppearsInLead(subject, article.description);
}

function isLikelyPersonSubject(
  subject: string | null | undefined,
  articleText: string,
  analysis: RSSSubjectAnalysis
): subject is string {
  if (!subject || !looksLikeNamedPerson(subject)) {
    return false;
  }

  if (analysis.relevantStudios.some((studio) => normalizeText(studio) === normalizeText(subject))) {
    return false;
  }

  return inferContentSubjectType(articleText, subject) === 'actor';
}

function isListLikeArticle(article: RSSImageSelectionArticle): boolean {
  const normalizedTitle = normalizeText(article.title);

  return /^(every|all)\b/.test(normalizedTitle) ||
    /^\d+\s+.*\b(movies|films|shows|books|episodes|moments|heroes|villains|characters|reasons|ways)\b/.test(normalizedTitle) ||
    /\branked\b|\branking\b|from best to worst|from worst to best|\btop\s+\d+\b/.test(normalizedTitle) ||
    (/\bonly launched\b/.test(normalizedTitle) && /\bfranchises\b/.test(normalizedTitle)) ||
    (/\b(best|worst)\b/.test(normalizedTitle) && /\b\d+\b/.test(normalizedTitle));
}

function isProjectAnchorType(type: SubjectType): boolean {
  return type === 'movie' || type === 'tv_show' || type === 'franchise';
}

function findProjectContextAnchor(
  subjects: string[],
  articleText: string,
  analysis: RSSSubjectAnalysis
): string | null {
  for (const subject of subjects) {
    if (!subject || looksLikeNamedPerson(subject)) {
      continue;
    }

    const inferredType = inferSlotType(subject, articleText, 'franchise', analysis);
    if (isProjectAnchorType(inferredType)) {
      return subject;
    }
  }

  return null;
}

function extractLeadProjectAnchor(
  article: RSSImageSelectionArticle,
  analysis: RSSSubjectAnalysis
): string | null {
  const leadWindow = getLeadContextWindow(article.description);
  if (!leadWindow) {
    return null;
  }

  const patterns = [
    /\b(?:we(?:'re| are) talking about|talking about)\s+([A-Z][A-Za-z0-9'’:&\-]+(?:\s+[A-Z][A-Za-z0-9'’:&\-]+){0,5})/i,
    /\b(?:the film|the movie|the series|the show)\s+([A-Z][A-Za-z0-9'’:&\-]+(?:\s+[A-Z][A-Za-z0-9'’:&\-]+){0,5})/i,
    /\b([A-Z][A-Za-z0-9'’:&\-]+(?:\s+[A-Z][A-Za-z0-9'’:&\-]+){0,5}),\s+the\s+(?:seminal|iconic|beloved|upcoming|new)\s+(?:film|movie|series|show)\b/i,
  ];

  for (const pattern of patterns) {
    const match = leadWindow.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate || looksLikeNamedPerson(candidate)) {
      continue;
    }

    const normalizedCandidate = normalizeText(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    if (normalizedCandidate === normalizeText(analysis.primarySubject.name)) {
      continue;
    }

    if (analysis.relevantStudios.some((studio) => normalizeText(studio) === normalizedCandidate)) {
      continue;
    }

    const inferredType = inferSlotType(candidate, buildArticleAnalysisText(article), 'franchise', analysis);
    if (isProjectAnchorType(inferredType)) {
      return candidate;
    }
  }

  return null;
}

function extractFranchiseCharacterAnchor(
  article: RSSImageSelectionArticle,
  analysis: RSSSubjectAnalysis
): string | null {
  const franchiseRule = getFranchiseValidationRule(analysis);
  if (!franchiseRule) {
    return null;
  }

  const articleLead = getLeadContextWindow(article.description);

  for (const requiredTerm of franchiseRule.requiredTerms) {
    const normalizedRequired = normalizeText(requiredTerm);
    if (!normalizedRequired) {
      continue;
    }

    if (franchiseRule.matchAny.some((matchTerm) => normalizeText(matchTerm) === normalizedRequired)) {
      continue;
    }

    if (looksLikeNamedPerson(requiredTerm)) {
      continue;
    }

    if (subjectAppearsInTitle(requiredTerm, article.title) || subjectAppearsInLead(requiredTerm, articleLead)) {
      return requiredTerm;
    }
  }

  return null;
}

function determineSmartImagePlan(
  article: RSSImageSelectionArticle,
  analysis: RSSSubjectAnalysis
): { primary: ImageSlotPlan; secondary: ImageSlotPlan | null; useTwoImages: boolean } {
  const articleText = buildArticleAnalysisText(article);
  const nonStudioSecondarySubjects = buildReferenceOnlyFreeSecondarySubjects(
    analysis.secondarySubjects,
    analysis.referenceOnlySubjects,
    analysis.primarySubject.name
  ).filter((subject) =>
    !analysis.relevantStudios.some((studio) => normalizeText(studio) === normalizeText(subject))
  );
  const leadPerson = extractLeadPersonSubject(article.title);
  const headlineCastingPerson = extractHeadlineCastingPerson(article.title);
  const heuristicPeople = extractNamedPeople(articleText, analysis);
  const quotedSubjects = extractQuotedSubjects(articleText).filter((subject) => {
    const normalizedSubject = normalizeText(subject);
    return normalizedSubject &&
      normalizedSubject !== normalizeText(analysis.primarySubject.name) &&
      !analysis.relevantStudios.some((studio) => normalizeText(studio) === normalizedSubject);
  });
  const titleLeadPerson =
    ((analysis.contextType === 'casting' &&
      headlineCastingPerson &&
      normalizeText(headlineCastingPerson) !== normalizeText(analysis.primarySubject.name))
      ? headlineCastingPerson
      : null) ||
    ((leadPerson &&
      normalizeText(leadPerson) !== normalizeText(analysis.primarySubject.name) &&
      isLikelyPersonSubject(leadPerson, articleText, analysis))
      ? leadPerson
      : null);
  const preferredPersonSubject =
    (analysis.contextType === 'casting' ? titleLeadPerson : null) ||
    nonStudioSecondarySubjects.find((subject) => isLikelyPersonSubject(subject, articleText, analysis)) ||
    heuristicPeople.find((subject) => isLikelyPersonSubject(subject, articleText, analysis)) ||
    titleLeadPerson;
  const preferredProjectSubject = findProjectContextAnchor(
    nonStudioSecondarySubjects.filter((subject) => normalizeText(subject) !== normalizeText(preferredPersonSubject || '')),
    articleText,
    analysis
  );
  const inferredLeadProjectSubject = extractLeadProjectAnchor(article, analysis);
  const preferredCharacterSubject = extractFranchiseCharacterAnchor(article, analysis);
  const titleAnchor =
    analysis.contextProject ||
    inferredLeadProjectSubject ||
    findProjectContextAnchor(quotedSubjects, articleText, analysis) ||
    preferredProjectSubject ||
    (analysis.primarySubject.type === 'movie' || analysis.primarySubject.type === 'tv_show' || analysis.primarySubject.type === 'franchise'
      ? analysis.primarySubject.name
      : null);
  const centralContainerPerson = preferredPersonSubject && subjectAppearsProminently(preferredPersonSubject, article)
    ? preferredPersonSubject
    : null;
  const centralTitlePerson = preferredPersonSubject && subjectAppearsProminently(preferredPersonSubject, article)
    ? preferredPersonSubject
    : null;
  const projectAnchorForPersonStory = titleAnchor && !looksLikeNamedPerson(titleAnchor)
    && subjectAppearsProminently(titleAnchor, article)
    ? titleAnchor
    : null;
  const isListArticle = isListLikeArticle(article);
  const memorialStory = isMemorialStory(article);

  let primary = buildImageSlotPlan(
    analysis.visualSubject,
    analysis.primarySubject.type,
    analysis.imageIntent,
    analysis,
    analysis.allowLogoOnly
  );
  let secondary: ImageSlotPlan | null = null;
  let useTwoImages = false;
  const primaryStreamingPlatform = getPrimaryStreamingPlatform(articleText);

  if (
    primaryStreamingPlatform &&
    isStreamingAvailabilityStory(article, analysis) &&
    (analysis.primarySubject.type === 'movie' || analysis.primarySubject.type === 'tv_show' || analysis.primarySubject.type === 'franchise')
  ) {
    const projectSubject = titleAnchor || analysis.primarySubject.name;
    if (projectSubject && normalizeText(projectSubject) !== normalizeText(primary.subject)) {
      secondary = buildImageSlotPlan(
        projectSubject,
        inferSlotType(projectSubject, articleText, analysis.primarySubject.type, analysis),
        'poster',
        analysis,
        false
      );

      return {
        primary,
        secondary,
        useTwoImages: true,
      };
    }
  }

  if (isListArticle) {
    return {
      primary,
      secondary: null,
      useTwoImages: false,
    };
  }

  if (memorialStory) {
    const memorialPersonSubject = (
      analysis.primarySubject.type === 'actor' ||
      analysis.primarySubject.type === 'director' ||
      analysis.primarySubject.type === 'producer'
    )
      ? analysis.primarySubject.name
      : preferredPersonSubject || leadPerson;
    const memorialPersonType: SubjectType = (
      analysis.primarySubject.type === 'actor' ||
      analysis.primarySubject.type === 'director' ||
      analysis.primarySubject.type === 'producer'
    )
      ? analysis.primarySubject.type
      : 'actor';
    const memorialProjectSubject = projectAnchorForPersonStory || inferredLeadProjectSubject || titleAnchor;

    if (
      memorialPersonSubject &&
      memorialProjectSubject &&
      normalizeText(memorialPersonSubject) !== normalizeText(memorialProjectSubject)
    ) {
      return {
        primary: buildImageSlotPlan(memorialPersonSubject, memorialPersonType, 'person_portrait', analysis, false),
        secondary: buildImageSlotPlan(
          memorialProjectSubject,
          inferSlotType(memorialProjectSubject, articleText, 'franchise', analysis),
          'logo',
          analysis,
          true
        ),
        useTwoImages: true,
      };
    }
  }

  if (leadPerson && inferredLeadProjectSubject) {
    primary = buildImageSlotPlan(leadPerson, 'actor', 'person_portrait', analysis, false);
    secondary = buildImageSlotPlan(
      inferredLeadProjectSubject,
      inferSlotType(inferredLeadProjectSubject, articleText, 'franchise', analysis),
      analysis.contextType === 'casting' ? 'logo' : 'poster',
      analysis,
      analysis.contextType === 'casting'
    );
    return {
      primary,
      secondary,
      useTwoImages: true,
    };
  }

  if (isContainerSubjectType(analysis.primarySubject.type)) {
    if (centralContainerPerson) {
      primary = buildImageSlotPlan(centralContainerPerson, 'actor', 'person_portrait', analysis, false);
      secondary = buildImageSlotPlan(
        analysis.primarySubject.name,
        analysis.primarySubject.type,
        'logo',
        analysis,
        true
      );
      useTwoImages = true;
    }
  } else if (
    (analysis.primarySubject.type === 'movie' || analysis.primarySubject.type === 'tv_show' || analysis.primarySubject.type === 'franchise') &&
    preferredCharacterSubject &&
    titleAnchor
  ) {
    primary = buildImageSlotPlan(preferredCharacterSubject, 'character', 'character_still', analysis, false);
    secondary = buildImageSlotPlan(
      titleAnchor,
      inferSlotType(titleAnchor, articleText, analysis.primarySubject.type, analysis),
      'poster',
      analysis,
      false
    );
    useTwoImages = true;
  } else if (
    analysis.primarySubject.type === 'actor' ||
    analysis.primarySubject.type === 'director' ||
    analysis.primarySubject.type === 'producer'
  ) {
    if (projectAnchorForPersonStory) {
      primary = buildImageSlotPlan(analysis.primarySubject.name, analysis.primarySubject.type, 'person_portrait', analysis, false);
      secondary = buildImageSlotPlan(
        projectAnchorForPersonStory,
        inferSlotType(projectAnchorForPersonStory, articleText, 'franchise', analysis),
        'poster',
        analysis,
        false
      );
      useTwoImages = true;
    }
  } else if (analysis.primarySubject.type === 'character') {
    if (projectAnchorForPersonStory) {
      primary = buildImageSlotPlan(analysis.visualSubject, 'character', 'character_still', analysis, false);
      secondary = buildImageSlotPlan(
        projectAnchorForPersonStory,
        inferSlotType(projectAnchorForPersonStory, articleText, 'franchise', analysis),
        'poster',
        analysis,
        false
      );
      useTwoImages = true;
    }
  } else if (
    (analysis.primarySubject.type === 'movie' || analysis.primarySubject.type === 'tv_show' || analysis.primarySubject.type === 'franchise') &&
    centralTitlePerson &&
    titleAnchor
  ) {
    if (analysis.contextType === 'casting') {
      const projectLogoSubject = analysis.primarySubject.name;
      primary = buildImageSlotPlan(centralTitlePerson, 'actor', 'person_portrait', analysis, false);
      secondary = buildImageSlotPlan(
        projectLogoSubject,
        analysis.primarySubject.type,
        'logo',
        analysis,
        true
      );
    } else {
      primary = buildImageSlotPlan(
        titleAnchor,
        inferSlotType(titleAnchor, articleText, analysis.primarySubject.type, analysis),
        'poster',
        analysis,
        false
      );
      secondary = buildImageSlotPlan(centralTitlePerson, 'actor', 'person_portrait', analysis, false);
    }
    useTwoImages = true;
  }

  return {
    primary,
    secondary,
    useTwoImages,
  };
}

function buildAnalysisForSlot(
  base: RSSSubjectAnalysis,
  slot: ImageSlotPlan
): RSSSubjectAnalysis {
  const preserveBaseProjectAnchor = isProjectAnchorType(base.primarySubject.type)
    && slot.intent !== 'person_portrait';

  return {
    ...base,
    editorialPrimary: slot.subject,
    primarySubject: preserveBaseProjectAnchor
      ? base.primarySubject
      : {
          name: slot.subject,
          type: slot.type,
        },
    visualSubject: slot.subject,
    imageIntent: slot.intent,
    allowLogoOnly: slot.allowLogoOnly,
    queries: slot.queries,
    requiredContextTerms: slot.requiredContextTerms,
    secondarySubjects: slot.intent === 'logo'
      ? []
      : base.secondarySubjects.filter((subject) => normalizeText(subject) !== normalizeText(slot.subject)),
  };
}

function buildSingleSlotProjectFallbackAnalysis(
  base: RSSSubjectAnalysis,
  article: RSSImageSelectionArticle
): RSSSubjectAnalysis | null {
  if (base.imageIntent !== 'person_portrait' || !base.contextProject) {
    return null;
  }

  const articleText = buildArticleAnalysisText(article);
  const projectType = inferSlotType(base.contextProject, articleText, 'franchise', base);

  // When a person-led story cannot land a confident portrait, prefer safe project context
  // over returning no image or drifting onto a bad unrelated match.
  return buildAnalysisForSlot(
    base,
    buildImageSlotPlan(base.contextProject, projectType, 'still', base, false)
  );
}

function buildSingleSlotTitleFallbackAnalysis(
  base: RSSSubjectAnalysis,
  article: RSSImageSelectionArticle
): RSSSubjectAnalysis | null {
  if (base.imageIntent === 'logo' || base.imageIntent === 'brand_backdrop') {
    return null;
  }

  const articleText = buildArticleAnalysisText(article);
  const quotedSubjects = extractQuotedSubjects(articleText).filter((subject) => {
    const normalizedSubject = normalizeText(subject);
    return normalizedSubject &&
      normalizedSubject !== normalizeText(base.primarySubject.name) &&
      !base.relevantStudios.some((studio) => normalizeText(studio) === normalizedSubject);
  });

  const projectAnchor =
    base.contextProject ||
    extractLeadProjectAnchor(article, base) ||
    findProjectContextAnchor(quotedSubjects, articleText, base) ||
    (isProjectAnchorType(base.primarySubject.type) ? base.primarySubject.name : null);

  if (!projectAnchor || looksLikeNamedPerson(projectAnchor)) {
    return null;
  }

  const projectType = inferSlotType(projectAnchor, articleText, 'franchise', base);
  if (!isProjectAnchorType(projectType)) {
    return null;
  }

  // This gives single-image stories one last project-led TMDb pass before we give up.
  return buildAnalysisForSlot(
    base,
    buildImageSlotPlan(projectAnchor, projectType, 'still', base, false)
  );
}

async function collectRawTitleTMDbFallbackImages(
  article: RSSImageSelectionArticle,
  base: RSSSubjectAnalysis,
  limit: number
): Promise<Array<RSSResolvedImage & { role: ImageRole }>> {
  const articleText = buildArticleAnalysisText(article);
  const quotedSubjects = extractQuotedSubjects(article.title).filter((subject) => {
    const normalizedSubject = normalizeText(subject);
    return normalizedSubject &&
      !looksLikeNamedPerson(subject) &&
      !base.relevantStudios.some((studio) => normalizeText(studio) === normalizedSubject);
  });
  const projectAnchor =
    quotedSubjects[0] ||
    extractLeadProjectAnchor(article, base) ||
    (isProjectAnchorType(base.primarySubject.type) ? base.primarySubject.name : null);

  if (!projectAnchor || looksLikeNamedPerson(projectAnchor)) {
    return [];
  }

  const projectType = inferSlotType(projectAnchor, articleText, 'franchise', base);
  if (!isProjectAnchorType(projectType)) {
    return [];
  }

  const sharedInput = {
    primarySubject: {
      name: projectAnchor,
      type: projectType,
    },
    visualSubject: projectAnchor,
    targetFormat: resolveTargetFormat(articleText, projectType),
    contextProject: projectAnchor,
    requiredContextTerms: uniqueStrings([
      projectAnchor,
      ...base.relevantStudios,
      ...extractYearTokens(articleText),
    ]),
    relevantStudios: base.relevantStudios,
    queries: uniqueStrings([
      projectAnchor,
      `${projectAnchor} official still`,
      `${projectAnchor} series`,
      `${projectAnchor} movie`,
    ]),
    limit,
  } as const;

  const directFallback = await resolveStructuredTMDbImages({
    ...sharedInput,
    imageIntent: 'still',
  });

  const brandingFallback = directFallback.length === 0
    ? await resolveStructuredTMDbImages({
        ...sharedInput,
        imageIntent: 'brand_backdrop',
      })
    : [];

  // This is an explicit title-derived fallback from the article itself, so accept
  // a strongly anchored TMDb still first, then a TMDb logo/backdrop card if needed.
  return buildResolvedImagesFromTMDb(
    directFallback.length > 0 ? directFallback : brandingFallback
  );
}

function shouldFallbackToFeedImageForSecondary(slot: ImageSlotPlan | null): boolean {
  if (!slot) {
    return true;
  }

  return false;
}

function shouldAppendFeedFallbackImages(
  analysis: RSSSubjectAnalysis,
  resolved: RSSResolvedImage[]
): boolean {
  if (resolved.length === 0) {
    return true;
  }

  if (analysis.imageIntent === 'person_portrait') {
    return false;
  }

  return resolved.every((image) => image.source === 'feed');
}

function isCompositeLikeText(text: string): boolean {
  return containsKeyword(text, COMPOSITE_KEYWORDS);
}

function getImageRole(text: string, analysis: RSSSubjectAnalysis): ImageRole {
  if (isLogoResult(text)) {
    return analysis.imageIntent === 'brand_backdrop' ? 'brand_backdrop' : 'logo';
  }

  if ((analysis.imageIntent === 'logo' || analysis.imageIntent === 'brand_backdrop') && containsKeyword(text, BACKDROP_KEYWORDS)) {
    return 'brand_backdrop';
  }

  if (analysis.imageIntent === 'person_portrait' || containsKeyword(text, PORTRAIT_KEYWORDS)) {
    return 'person';
  }

  if (analysis.imageIntent === 'character_still') {
    return 'character';
  }

  if (isPosterResult(text)) {
    return 'poster';
  }

  return 'still';
}

function areImageRolesComplementary(primaryRole: ImageRole, secondaryRole: ImageRole): boolean {
  if (primaryRole === secondaryRole) {
    return false;
  }

  if (
    (primaryRole === 'still' && secondaryRole === 'poster') ||
    (primaryRole === 'poster' && secondaryRole === 'still')
  ) {
    return false;
  }

  return true;
}

function isLogoLikeRole(role: ImageRole): boolean {
  return role === 'logo' || role === 'brand_backdrop';
}

function isSquareishAspect(image: SerperImageResult): boolean {
  const ratio = getAspectRatio(image);
  return ratio !== null && ratio >= 0.85 && ratio <= 1.2;
}

function isEligibleSmartSecondaryCandidate(
  primaryRole: ImageRole,
  secondaryRole: ImageRole,
  secondaryImage: SerperImageResult,
  score: number,
  secondaryIntent: ImageIntent
): boolean {
  if (secondaryIntent === 'logo') {
    return score >= MIN_SMART_LOGO_SECONDARY_SCORE &&
      isLogoLikeRole(secondaryRole) &&
      !isTallPosterAspect(secondaryImage) &&
      areImageRolesComplementary(primaryRole, secondaryRole);
  }

  return score >= MIN_SMART_SECONDARY_SCORE &&
    areImageRolesComplementary(primaryRole, secondaryRole);
}

function isBrandedEditorialFrame(image: Pick<RSSResolvedImage, 'url' | 'reason' | 'score'>): boolean {
  const text = normalizeText(`${image.reason || ''} ${image.url || ''}`);
  if (!text) {
    return false;
  }

  return isOutletBrandedFrameText(text);
}

function shouldKeepSecondaryCarouselImage(
  primaryImage: Pick<RSSResolvedImage, 'url' | 'reason' | 'score'>,
  secondaryImage: Pick<RSSResolvedImage, 'url' | 'reason' | 'score'>
): boolean {
  if (getImageIdentity(primaryImage.url) === getImageIdentity(secondaryImage.url)) {
    return false;
  }

  if (isBrandedEditorialFrame(secondaryImage)) {
    return false;
  }

  if (isCompositeLikeText(normalizeText(`${secondaryImage.reason || ''} ${secondaryImage.url || ''}`))) {
    return false;
  }

  if (typeof primaryImage.score === 'number' && typeof secondaryImage.score === 'number') {
    if (primaryImage.score - secondaryImage.score > MAX_SECONDARY_SCORE_GAP) {
      return false;
    }
  }

  return true;
}

function isMemorialNeutralProjectRole(role: ImageRole): boolean {
  return role === 'logo' || role === 'brand_backdrop';
}

async function collectScoredImages(
  analysis: RSSSubjectAnalysis,
  limit: number,
  source: Exclude<RSSImageSource, 'tmdb'>,
  openaiWebSearchModel?: AIModel | string
): Promise<ScoredImage[]> {
  const scoredByUrl = new Map<string, ScoredImage>();

  for (const query of analysis.queries.slice(0, 4)) {
    const results = source === 'openai_web_search'
      ? await searchOpenAIWebImages(query, analysis, Math.max(limit * 4, 8), openaiWebSearchModel)
      : await searchSerperImages(query, Math.max(limit * 4, 8));

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

  return Array.from(scoredByUrl.values())
    .sort((left, right) => right.score - left.score);
}

function buildResolvedImagesFromScored(
  scoredSelections: ScoredImage[],
  fallbackImages: string[],
  limit: number,
  allowFeedFallback: boolean,
  source: Exclude<RSSImageSource, 'tmdb'>
): RSSResolvedImage[] {
  const scoreThreshold = fallbackImages.length > 0
    ? MIN_CONFIDENT_SERPER_SCORE_WITH_FEED_FALLBACK
    : MIN_CONFIDENT_SERPER_SCORE;
  const confidenceGapThreshold = fallbackImages.length > 0
    ? MIN_PRIMARY_CONFIDENCE_GAP_WITH_FEED_FALLBACK
    : MIN_PRIMARY_CONFIDENCE_GAP;
  const topScore = scoredSelections[0]?.score;
  const secondScore = scoredSelections[1]?.score;
  const topScoreGap = typeof topScore === 'number'
    ? topScore - (typeof secondScore === 'number' ? secondScore : 0)
    : 0;
  const hasConfidentPrimary = typeof topScore === 'number' &&
    topScore >= scoreThreshold &&
    topScoreGap >= confidenceGapThreshold;
  const primaryScore = typeof topScore === 'number' ? topScore : null;
  const confidentSelections = scoredSelections
    .filter((item) =>
      hasConfidentPrimary &&
      item.score >= scoreThreshold &&
      !isBrandedEditorialFrame({
        url: item.image.imageUrl || '',
        reason: item.reason,
        score: item.score,
      }) &&
      (
        primaryScore === null ||
        item.score === primaryScore ||
        primaryScore - item.score <= MAX_SECONDARY_SCORE_GAP
      )
    )
    .slice(0, limit)
    .map((item) => ({
      url: item.image.imageUrl!,
      reason: item.reason,
      source: 'serper' as const,
      score: item.score,
    }));

  if (confidentSelections.length >= limit) {
    return confidentSelections;
  }

  if (allowFeedFallback) {
    const fallback = buildFeedFallbackImages(
      fallbackImages.filter((url) => !confidentSelections.some((image) => image.url === url)),
      limit - confidentSelections.length
    );

    if (fallback.length > 0) {
      return [...confidentSelections, ...fallback].slice(0, limit);
    }
  }

  if (allowFeedFallback && fallbackImages.length > 0 && !hasConfidentPrimary) {
    return [];
  }

  const acceptableSelections = scoredSelections
    .filter((item) =>
      item.score >= MIN_ACCEPTABLE_SERPER_SCORE &&
      !isBrandedEditorialFrame({
        url: item.image.imageUrl || '',
        reason: item.reason,
        score: item.score,
      }) &&
      (
        primaryScore === null ||
        item.score === primaryScore ||
        primaryScore - item.score <= MAX_SECONDARY_SCORE_GAP
      )
    )
    .slice(0, limit);

  if (acceptableSelections.length === 0) {
    return [];
  }

  return acceptableSelections
    .map((item) => ({
      url: item.image.imageUrl!,
      reason: item.reason,
      source,
      score: item.score,
    }));
}

function getEnabledImageSources(options: {
  serperEnabled?: boolean;
  tmdbEnabled?: boolean;
  openaiWebSearchEnabled?: boolean;
  serperPriority?: boolean;
  imageSourcePriority?: 'tmdb_first' | 'openai_first' | 'serper_first';
}): RSSImageSource[] {
  const serperEnabled = options.serperEnabled !== false;
  const tmdbEnabled = options.tmdbEnabled === true;
  const openaiEnabled = options.openaiWebSearchEnabled === true;
  const enabledSources: RSSImageSource[] = [];

  if (tmdbEnabled) {
    enabledSources.push('tmdb');
  }

  if (openaiEnabled) {
    enabledSources.push('openai_web_search');
  }

  if (serperEnabled) {
    enabledSources.push('serper');
  }

  if (enabledSources.length <= 1) {
    return enabledSources;
  }

  const explicitPriority = options.imageSourcePriority;
  if (explicitPriority) {
    const first: RSSImageSource = explicitPriority === 'openai_first'
      ? 'openai_web_search'
      : explicitPriority === 'serper_first'
        ? 'serper'
        : 'tmdb';
    const remainderOrder: RSSImageSource[] = ['tmdb', 'openai_web_search', 'serper'];
    return [first, ...remainderOrder.filter((source) => source !== first)]
      .filter((source) => enabledSources.includes(source));
  }

  if (serperEnabled && tmdbEnabled && options.serperPriority === true) {
    return ['serper', ...enabledSources.filter((source) => source !== 'serper')];
  }

  return (['tmdb', 'openai_web_search', 'serper'] as RSSImageSource[])
    .filter((source) => enabledSources.includes(source));
}

function mergeResolvedImages(
  baseImages: RSSResolvedImage[],
  nextImages: RSSResolvedImage[],
  limit: number
): RSSResolvedImage[] {
  const seen = new Set(baseImages.map((image) => getImageIdentity(image.url)));
  const merged = [...baseImages];

  for (const image of nextImages) {
    const identity = getImageIdentity(image.url);
    if (seen.has(identity)) {
      continue;
    }

    merged.push(image);
    seen.add(identity);

    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
}

function mapStructuredTMDbRoleToImageRole(role: StructuredTMDbImageRole): ImageRole {
  switch (role) {
    case 'logo':
      return 'logo';
    case 'brand_backdrop':
      return 'brand_backdrop';
    case 'person':
      return 'person';
    case 'character':
      return 'character';
    case 'poster':
      return 'poster';
    case 'still':
    default:
      return 'still';
  }
}

function buildResolvedImagesFromTMDb(
  tmdbSelections: ResolvedStructuredTMDbImage[]
): Array<RSSResolvedImage & { role: ImageRole }> {
  return tmdbSelections.map((item) => ({
    url: item.url,
    reason: item.reason,
    source: 'tmdb' as const,
    score: item.score,
    role: mapStructuredTMDbRoleToImageRole(item.role),
  }));
}

function hasConfidentResolvedPrimary(
  images: Array<RSSResolvedImage & { role?: ImageRole }>,
  source: RSSImageSource,
  fallbackAvailable: boolean
): boolean {
  const topScore = images[0]?.score;
  if (typeof topScore !== 'number') {
    return !fallbackAvailable;
  }

  const secondScore = images[1]?.score;
  const topScoreGap = topScore - (typeof secondScore === 'number' ? secondScore : 0);
  const scoreThreshold = source === 'tmdb'
    ? (fallbackAvailable ? MIN_CONFIDENT_TMDB_SCORE_WITH_FEED_FALLBACK : MIN_CONFIDENT_TMDB_SCORE)
    : (fallbackAvailable ? MIN_CONFIDENT_SERPER_SCORE_WITH_FEED_FALLBACK : MIN_CONFIDENT_SERPER_SCORE);
  const gapThreshold = fallbackAvailable
    ? MIN_PRIMARY_CONFIDENCE_GAP_WITH_FEED_FALLBACK
    : MIN_PRIMARY_CONFIDENCE_GAP;

  return topScore >= scoreThreshold && topScoreGap >= gapThreshold;
}

async function collectStructuredTMDbImages(
  analysis: RSSSubjectAnalysis,
  limit: number,
  excludeUrls: string[] = []
): Promise<Array<RSSResolvedImage & { role: ImageRole }>> {
  const tmdbSelections = await resolveStructuredTMDbImages({
    primarySubject: analysis.primarySubject,
    visualSubject: analysis.visualSubject,
    secondarySubjects: analysis.secondarySubjects,
    imageIntent: analysis.imageIntent,
    targetFormat: analysis.targetFormat,
    contextProject: analysis.contextProject,
    requiredContextTerms: analysis.requiredContextTerms,
    relevantStudios: analysis.relevantStudios,
    queries: analysis.queries,
    limit,
    excludeUrls,
  });

  return buildResolvedImagesFromTMDb(tmdbSelections);
}

async function resolveSingleSlotImages(
  article: RSSImageSelectionArticle,
  analysis: RSSSubjectAnalysis,
  fallbackImages: string[],
  sources: RSSImageSource[],
  limit: number,
  openaiWebSearchModel?: AIModel | string
): Promise<RSSResolvedImage[]> {
  let resolved: RSSResolvedImage[] = [];

  for (const source of sources) {
    if (resolved.length >= limit) {
      break;
    }

    if (source === 'tmdb') {
      const tmdbResolved = await collectStructuredTMDbImages(
        analysis,
        limit - resolved.length,
        resolved.map((image) => image.url)
      );
      const confidentTMDbResolved = hasConfidentResolvedPrimary(tmdbResolved, 'tmdb', fallbackImages.length > 0)
        ? tmdbResolved
        : [];
      const fallbackAnalysis = confidentTMDbResolved.length === 0
        ? buildSingleSlotProjectFallbackAnalysis(analysis, article)
        : null;
      const projectFallbackResolved = fallbackAnalysis
        ? await collectStructuredTMDbImages(
            fallbackAnalysis,
            limit - resolved.length,
            resolved.map((image) => image.url)
          )
        : [];
      const confidentProjectFallbackResolved = projectFallbackResolved.length > 0 &&
        hasConfidentResolvedPrimary(projectFallbackResolved, 'tmdb', fallbackImages.length > 0)
        ? projectFallbackResolved
        : [];
      resolved = mergeResolvedImages(
        resolved,
        confidentTMDbResolved.length > 0 ? confidentTMDbResolved : confidentProjectFallbackResolved,
        limit
      );
      continue;
    }

    const webResolved = buildResolvedImagesFromScored(
      await collectScoredImages(
        analysis,
        limit - resolved.length,
        source,
        openaiWebSearchModel
      ),
      fallbackImages,
      limit - resolved.length,
      fallbackImages.length > 0,
      source
    );
    resolved = mergeResolvedImages(resolved, webResolved, limit);
  }

  if (resolved.length < limit) {
    if (resolved.length === 0 && sources.includes('tmdb')) {
      const titleFallbackAnalysis = buildSingleSlotTitleFallbackAnalysis(analysis, article);
      if (titleFallbackAnalysis) {
        const tmdbTitleFallbackResolved = await collectStructuredTMDbImages(titleFallbackAnalysis, limit);
        // This fallback is already anchored to an explicit project/title from the article,
        // so prefer returning the TMDb result over an empty card when the main path found nothing.
        resolved = mergeResolvedImages(resolved, tmdbTitleFallbackResolved, limit);
      }

      if (resolved.length === 0) {
        resolved = mergeResolvedImages(
          resolved,
          await collectRawTitleTMDbFallbackImages(article, analysis, limit),
          limit
        );
      }
    }

    if (shouldAppendFeedFallbackImages(analysis, resolved)) {
      resolved = mergeResolvedImages(
        resolved,
        buildFeedFallbackImages(
          fallbackImages.filter((url) => !resolved.some((image) => image.url === url)),
          limit - resolved.length
        ),
        limit
      );
    }
  }

  if (resolved[0] && fallbackImages.length > 0 && shouldReplaceBrandingPrimaryWithFeedFallback(analysis, resolved[0])) {
    const fallbackPrimary = buildFeedFallbackImages(
      fallbackImages.filter((url) => getImageIdentity(url) !== getImageIdentity(resolved[0]?.url || '')),
      1
    )[0];

    if (fallbackPrimary) {
      resolved = [
        fallbackPrimary,
        ...resolved.filter((image) =>
          getImageIdentity(image.url) !== getImageIdentity(fallbackPrimary.url) &&
          getImageIdentity(image.url) !== getImageIdentity(resolved[0]?.url || '')
        ),
      ];
    }
  }

  return resolved.slice(0, limit);
}

function shouldReplaceBrandingPrimaryWithFeedFallback(
  analysis: RSSSubjectAnalysis,
  image: RSSResolvedImage,
  role?: ImageRole
): boolean {
  if (analysis.imageIntent === 'logo' || analysis.imageIntent === 'brand_backdrop') {
    return false;
  }

  const normalizedReason = normalizeText(image.reason);
  const brandingByRole = role === 'logo' || role === 'brand_backdrop';
  const brandingByReason =
    normalizedReason.includes('company logo') ||
    normalizedReason.includes('official logo') ||
    normalizedReason.includes('title logo') ||
    normalizedReason.includes('brand backdrop');

  return brandingByRole || brandingByReason;
}

async function resolveSmartPrimaryCandidate(
  article: RSSImageSelectionArticle,
  analysis: RSSSubjectAnalysis,
  sources: RSSImageSource[],
  fallbackImages: string[],
  openaiWebSearchModel?: AIModel | string
): Promise<{ image: RSSResolvedImage; role: ImageRole } | null> {
  for (const source of sources) {
    if (source === 'tmdb') {
      const tmdbResolved = await collectStructuredTMDbImages(analysis, 1);
      if (tmdbResolved[0] && hasConfidentResolvedPrimary(tmdbResolved, 'tmdb', fallbackImages.length > 0)) {
        return {
          image: tmdbResolved[0],
          role: tmdbResolved[0].role,
        };
      }
      continue;
    }

    const primaryScored = await collectScoredImages(analysis, 4, source, openaiWebSearchModel);
    const preferredSmartPrimary = primaryScored.find((item) => item.score >= MIN_SMART_PRIMARY_SERPER_SCORE);
    const rescuedBrandPrimary = (!preferredSmartPrimary &&
      (analysis.imageIntent === 'logo' || analysis.imageIntent === 'brand_backdrop'))
      ? primaryScored.find((item) => item.score >= MIN_BRAND_FALLBACK_SERPER_SCORE)
      : null;
    const rescuedTrailerPrimary = (!preferredSmartPrimary && !rescuedBrandPrimary &&
      (analysis.imageIntent === 'still' || analysis.imageIntent === 'backdrop' || analysis.imageIntent === 'character_still') &&
      analysis.contextType === 'trailer')
      ? primaryScored.find((item) => item.score >= MIN_TRAILER_STILL_SERPER_SCORE)
      : null;
    const rescuedGeneralListPrimary = (!preferredSmartPrimary && !rescuedBrandPrimary && !rescuedTrailerPrimary &&
      (analysis.imageIntent === 'still' || analysis.imageIntent === 'backdrop' || analysis.imageIntent === 'character_still') &&
      isListLikeArticle(article) &&
      analysis.primarySubject.type === 'general')
      ? primaryScored.find((item) => item.score >= MIN_GENERAL_LIST_SERPER_SCORE)
      : null;
    const fallbackPrimary = buildResolvedImagesFromScored(primaryScored, [], 1, false, source)[0];
    const primaryResolvedImage = preferredSmartPrimary?.image.imageUrl
      ? {
          url: preferredSmartPrimary.image.imageUrl,
          reason: preferredSmartPrimary.reason,
          source,
          score: preferredSmartPrimary.score,
        }
      : rescuedBrandPrimary?.image.imageUrl
        ? {
            url: rescuedBrandPrimary.image.imageUrl,
            reason: rescuedBrandPrimary.reason,
            source,
            score: rescuedBrandPrimary.score,
          }
        : rescuedTrailerPrimary?.image.imageUrl
          ? {
              url: rescuedTrailerPrimary.image.imageUrl,
              reason: rescuedTrailerPrimary.reason,
              source,
              score: rescuedTrailerPrimary.score,
            }
          : rescuedGeneralListPrimary?.image.imageUrl
            ? {
                url: rescuedGeneralListPrimary.image.imageUrl,
                reason: rescuedGeneralListPrimary.reason,
                source,
                score: rescuedGeneralListPrimary.score,
              }
            : fallbackPrimary;

    if (!primaryResolvedImage) {
      continue;
    }

    if (
      fallbackImages.length > 0 &&
      !hasConfidentResolvedPrimary(
        [{
          ...primaryResolvedImage,
        }],
        source,
        true
      )
    ) {
      continue;
    }

    const matchedScoredImage = primaryScored.find((item) => item.image.imageUrl === primaryResolvedImage.url);
    return {
      image: primaryResolvedImage,
      role: matchedScoredImage
        ? getImageRole(getSerperImageText(matchedScoredImage.image), analysis)
        : getImageRole(normalizeText(primaryResolvedImage.reason), analysis),
    };
  }

  return null;
}

async function resolveSmartSecondaryCandidate(
  analysis: RSSSubjectAnalysis,
  primaryImage: RSSResolvedImage,
  primaryRole: ImageRole,
  sources: RSSImageSource[],
  openaiWebSearchModel?: AIModel | string
): Promise<{ image: RSSResolvedImage; role: ImageRole } | null> {
  const primaryIdentity = getImageIdentity(primaryImage.url);

  for (const source of sources) {
    if (source === 'tmdb') {
      const tmdbResolved = await collectStructuredTMDbImages(analysis, 4, [primaryImage.url]);
      const candidate = tmdbResolved.find((item) =>
        getImageIdentity(item.url) !== primaryIdentity &&
        areImageRolesComplementary(primaryRole, item.role)
      );
      if (candidate) {
        return {
          image: candidate,
          role: candidate.role,
        };
      }
      continue;
    }

    const secondaryScored = await collectScoredImages(analysis, 6, source, openaiWebSearchModel);
    const candidate = secondaryScored.find((item) => {
      if (!item.image.imageUrl || getImageIdentity(item.image.imageUrl) === primaryIdentity) {
        return false;
      }

      const secondaryRole = getImageRole(getSerperImageText(item.image), analysis);
      return isEligibleSmartSecondaryCandidate(
        primaryRole,
        secondaryRole,
        item.image,
        item.score,
        analysis.imageIntent
      );
    });

    if (candidate?.image.imageUrl) {
      return {
        image: {
          url: candidate.image.imageUrl,
          reason: candidate.reason,
          source,
          score: candidate.score,
        },
        role: getImageRole(getSerperImageText(candidate.image), analysis),
      };
    }
  }

  return null;
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
      maxTokens: 900,
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

    return data.images
      .filter((image) => typeof image?.imageUrl === 'string')
      .map((image) => ({
        ...image,
        source: 'serper' as const,
      }));
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

async function hydrateOpenAIImageCandidate(
  candidate: NonNullable<OpenAIWebSearchImageResponse['images']>[number]
): Promise<SerperImageResult | null> {
  const sourcePage = typeof candidate.sourcePage === 'string' && /^https?:\/\//i.test(candidate.sourcePage.trim())
    ? candidate.sourcePage.trim()
    : undefined;
  let imageUrl = typeof candidate.imageUrl === 'string' ? candidate.imageUrl.trim() : '';
  const imageUrlLooksLikePage = (() => {
    if (!/^https?:\/\//i.test(imageUrl)) {
      return true;
    }

    if (sourcePage && imageUrl === sourcePage) {
      return true;
    }

    try {
      const pathname = new URL(imageUrl).pathname.toLowerCase();
      return !/\.(avif|gif|jpe?g|png|webp|bmp|svg)(?:$|\?)/i.test(pathname);
    } catch {
      return true;
    }
  })();

  if ((imageUrlLooksLikePage || !/^https?:\/\//i.test(imageUrl)) && sourcePage) {
    imageUrl = (await extractImageFromSourcePage(sourcePage)) || '';
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    return null;
  }

  const probe = await probeFeedFallbackUrl(imageUrl);
  if (!probe.allowed) {
    return null;
  }

  const inferredDomain = typeof candidate.domain === 'string' && candidate.domain.trim()
    ? candidate.domain.trim()
    : (() => {
        try {
          return new URL(sourcePage || imageUrl).hostname;
        } catch {
          return undefined;
        }
      })();

  return {
    title: [candidate.title, candidate.rationale].filter(Boolean).join(' ').trim() || undefined,
    imageUrl,
    imageWidth: probe.width,
    imageHeight: probe.height,
    domain: inferredDomain,
    link: sourcePage,
    source: 'openai_web_search',
  };
}

async function searchOpenAIWebImages(
  query: string,
  analysis: RSSSubjectAnalysis,
  limit: number,
  model?: AIModel | string
): Promise<SerperImageResult[]> {
  const intentGuidance = analysis.imageIntent === 'person_portrait'
    ? [
        'This lookup needs a real person portrait or press photo.',
        `Prioritize source pages or direct images that clearly feature ${analysis.visualSubject || analysis.primarySubject.name}.`,
        'Avoid project landing pages, franchise announcement pages, or generic studio pages unless they clearly expose a portrait of the named person.',
      ].join(' ')
    : analysis.imageIntent === 'logo' || analysis.imageIntent === 'brand_backdrop'
      ? [
          'This lookup needs a clean official logo or brand artwork.',
          'Prioritize transparent logos, official press kits, or official studio/network brand assets.',
        ].join(' ')
      : [
          'This lookup needs project artwork.',
          'Prioritize backdrops, posters, production stills, or official title artwork for the project rather than generic outlet article thumbnails.',
        ].join(' ');
  const prompt = [
    'Find candidate entertainment-news image sources for this story.',
    `Primary subject: ${analysis.primarySubject.name}`,
    `Visual subject: ${analysis.visualSubject}`,
    `Image intent: ${analysis.imageIntent}`,
    analysis.contextProject ? `Project context: ${analysis.contextProject}` : null,
    analysis.requiredContextTerms.length > 0 ? `Required context terms: ${analysis.requiredContextTerms.join(', ')}` : null,
    `Search query: ${query}`,
    `Intent guidance: ${intentGuidance}`,
    `Return JSON as {"images":[{"imageUrl":"https://optional-direct-image","sourcePage":"https://source-page","title":"short title","domain":"source domain","rationale":"why it matches"}]}.`,
    `Rules: prefer official studio, network, distributor, press, or trusted entertainment editorial sources. Avoid screenshots of article pages, social UI screenshots, fan art, collages, and low-resolution images. Return up to ${Math.max(4, limit)} candidates.`,
  ].filter(Boolean).join('\n');

  const response = await aiService.generateCompletion({
    model: normalizeAIModel(model, 'gpt-5.4-mini'),
    prompt,
    systemPrompt: 'You discover candidate source pages and image URLs for entertainment-news visuals. Return only valid JSON.',
    jsonMode: false,
    temperature: 0.1,
    maxTokens: 1400,
    enableWebSearch: true,
    cacheKey: `rss:openai-web-image:${normalizeText(query)}:${normalizeText(analysis.visualSubject)}:${analysis.imageIntent}`,
    cacheTTLms: 30 * 60 * 1000,
  });

  if (!response.success || !response.content) {
    return [];
  }

  try {
    const parsed = JSON.parse(response.content) as OpenAIWebSearchImageResponse;
    const hydrated = await Promise.all(
      (parsed.images || [])
        .slice(0, Math.max(4, limit))
        .map((item: OpenAIWebSearchImageCandidate) => hydrateOpenAIImageCandidate(item))
    );
    const results = hydrated.filter((item): item is SerperImageResult => Boolean(item));
    if (results.length === 0) {
      console.warn('[RSS] OpenAI web image search returned no approved candidates.', {
        query,
        visualSubject: analysis.visualSubject,
        imageIntent: analysis.imageIntent,
      });
    }
    return results;
  } catch (error) {
    console.warn('[RSS] OpenAI web image search returned invalid JSON.', error);
    return [];
  }
}

function isBlockedResult(image: SerperImageResult): boolean {
  return isBlockedResultForIntent(image, null);
}

function isBlockedResultForIntent(image: SerperImageResult, intent: ImageIntent | null): boolean {
  const text = getSerperImageText(image);
  const domain = normalizeText(image.domain || '');
  const minWidth = intent === 'logo' || intent === 'brand_backdrop' ? 240 : MIN_IMAGE_WIDTH;
  const minHeight = intent === 'logo' || intent === 'brand_backdrop' ? 100 : MIN_IMAGE_HEIGHT;

  if ((image.imageWidth || 0) < minWidth || (image.imageHeight || 0) < minHeight) {
    return true;
  }

  if (
    (intent === 'still' || intent === 'backdrop' || intent === 'character_still') &&
    (
      (image.imageWidth || 0) < 720 ||
      (image.imageHeight || 0) < 405 ||
      ((image.imageWidth || 0) * (image.imageHeight || 0)) < 350000
    )
  ) {
    return true;
  }

  if (BLOCKED_DOMAINS.some((blocked) => domain.includes(normalizeText(blocked)))) {
    return true;
  }

  if (STOCK_IMAGE_DOMAINS.some((blocked) => domain.includes(normalizeText(blocked)))) {
    return true;
  }

  if (isOutletBrandedFrameText(text)) {
    return true;
  }

  if (containsKeyword(text, WATERMARK_KEYWORDS) || containsKeyword(text, BLOCKED_KEYWORDS)) {
    return true;
  }

  if (containsKeyword(text, HARD_REJECT_KEYWORDS)) {
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

function getImageQualityScore(image: SerperImageResult, intent: ImageIntent): number {
  const width = image.imageWidth || 0;
  const height = image.imageHeight || 0;
  const area = width * height;
  const editorialIntent = intent === 'still' || intent === 'backdrop' || intent === 'character_still';

  if (!width || !height) {
    return editorialIntent ? -12 : 0;
  }

  if (!editorialIntent) {
    if (area >= HIGH_QUALITY_AREA) return 12;
    if (area >= MIN_EDITORIAL_QUALITY_AREA) return 6;
    return 0;
  }

  let score = 0;

  if (width < MIN_EDITORIAL_QUALITY_WIDTH || height < MIN_EDITORIAL_QUALITY_HEIGHT || area < MIN_EDITORIAL_QUALITY_AREA) {
    score -= 28;
  } else if (width >= HIGH_QUALITY_WIDTH && height >= HIGH_QUALITY_HEIGHT && area >= HIGH_QUALITY_AREA) {
    score += 20;
  } else {
    score += 10;
  }

  if (width >= 1800 || height >= 1000) {
    score += 6;
  }

  return score;
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

function isTrustedImageDomain(domain: string): boolean {
  const normalizedDomain = normalizeText(domain);
  if (!normalizedDomain) {
    return false;
  }

  return TRUSTED_DOMAINS.some((trusted) => normalizedDomain.includes(normalizeText(trusted))) ||
    GOOD_DOMAINS.some((good) => normalizedDomain.includes(normalizeText(good)));
}

function hasMinimumImageDimensions(image: SerperImageResult, intent: ImageIntent): boolean {
  const width = image.imageWidth || 0;
  const height = image.imageHeight || 0;

  switch (intent) {
    case 'backdrop':
    case 'still':
    case 'character_still':
    case 'brand_backdrop':
      return width >= 1280 && height >= 720;
    case 'poster':
      return height >= 800 && width >= 500;
    case 'person_portrait':
      return width >= 512 || height >= 512;
    case 'logo':
      return width >= 240 && height >= 100;
    default:
      return width >= MIN_IMAGE_WIDTH && height >= MIN_IMAGE_HEIGHT;
  }
}

function validateImageCandidate(
  image: SerperImageResult,
  analysis: RSSSubjectAnalysis
): ImageValidationResult {
  const text = getSerperImageText(image);
  const domain = image.domain || '';
  const projectTerms = uniqueStrings([
    analysis.visualSubject,
    analysis.primarySubject.name,
    analysis.contextProject,
  ]);
  const secondaryEntityTerms = buildReferenceOnlyFreeSecondarySubjects(
    analysis.secondarySubjects,
    analysis.referenceOnlySubjects,
    analysis.primarySubject.name
  ).filter((subject) =>
    !analysis.relevantStudios.some((studio) => normalizeText(studio) === normalizeText(subject))
  );
  const entityTerms = uniqueStrings([...projectTerms, ...secondaryEntityTerms]);
  const mentionsProject = hasRelevantEntityMatch(text, entityTerms);
  const looksOfficial = containsKeyword(text, OFFICIAL_MARKERS) || isTrustedImageDomain(domain);
  const illustrationLikeResult = containsKeyword(text, ILLUSTRATION_STYLE_KEYWORDS);
  const unofficialEdit = containsKeyword(text, UNOFFICIAL_EDIT_KEYWORDS);
  const aiGenerated = containsKeyword(text, AI_GENERATION_KEYWORDS);
  const animationOfficial = analysis.animatedSubject &&
    (containsKeyword(text, OFFICIAL_ANIMATION_MARKERS) || looksOfficial);

  if (!image.imageUrl) {
    return { approved: false, reason: 'missing image url' };
  }

  if (isUnanchoredGeneralStory(analysis) && analysis.imageIntent !== 'logo' && analysis.imageIntent !== 'brand_backdrop') {
    return { approved: false, reason: 'generic industry story requires a clearly anchored subject before using title art' };
  }

  if (!isTrustedImageDomain(domain)) {
    return { approved: false, reason: 'untrusted image domain' };
  }

  if (!hasMinimumImageDimensions(image, analysis.imageIntent)) {
    return { approved: false, reason: 'image dimensions below editorial threshold' };
  }

  if (aiGenerated) {
    return { approved: false, reason: 'ai-generated image signals detected' };
  }

  if (unofficialEdit) {
    return { approved: false, reason: 'unofficial edited or thumbnail-style asset' };
  }

  if (
    illustrationLikeResult &&
    !(analysis.animatedSubject && animationOfficial) &&
    analysis.primarySubject.type !== 'character'
  ) {
    return { approved: false, reason: 'non-official illustration style detected' };
  }

  if (!mentionsProject) {
    return { approved: false, reason: 'image does not map to resolved article subject' };
  }

  if (analysis.animatedSubject && !animationOfficial && containsKeyword(text, ['live action', 'photo', 'set photo'])) {
    return { approved: false, reason: 'live-action image used for animated subject' };
  }

  return { approved: true };
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
  if (!image.imageUrl || isBlockedResultForIntent(image, analysis.imageIntent)) {
    return null;
  }

  const text = getSerperImageText(image);
  const nonReferenceSecondarySubjects = buildReferenceOnlyFreeSecondarySubjects(
    analysis.secondarySubjects,
    analysis.referenceOnlySubjects,
    analysis.primarySubject.name
  );
  const relevantEntities = uniqueStrings([
    analysis.visualSubject,
    analysis.primarySubject.name,
    ...nonReferenceSecondarySubjects,
  ]);
  const projectAnchorTerms = uniqueStrings([
    analysis.contextProject,
    isProjectAnchorType(analysis.primarySubject.type) ? analysis.primarySubject.name : null,
    isProjectAnchorType(analysis.primarySubject.type) &&
      normalizeText(analysis.editorialPrimary) !== normalizeText(analysis.primarySubject.name)
      ? analysis.editorialPrimary
      : null,
    !looksLikeNamedPerson(analysis.visualSubject) ? analysis.visualSubject : null,
  ]);
  const franchiseRule = getFranchiseValidationRule(analysis);
  const contextMatchCount = analysis.requiredContextTerms.filter((term) => entityMatches(text, term)).length;
  const referenceOnlyMatch = analysis.referenceOnlySubjects.some((subject) => entityMatches(text, subject));

  const mentionsRelevantEntity = hasRelevantEntityMatch(text, relevantEntities);
  const projectAnchorMatch = hasRelevantEntityMatch(text, projectAnchorTerms);
  const relevantStudioMatch = analysis.relevantStudios.some((studio) => entityMatches(text, studio));
  const visualMatch = entityMatches(text, analysis.visualSubject);
  const primaryMatch = entityMatches(text, analysis.primarySubject.name);
  const isLogo = isLogoResult(text);
  const isPoster = isPosterResult(text);
  const looksLikeSeriesResult = containsKeyword(text, ['series', 'season', 'episode', 'tv show', 'streaming series', 'live action series']);
  const looksLikeMovieResult = containsKeyword(text, ['movie', 'film', 'feature film', 'theatrical']);
  const looksOfficial = containsKeyword(text, OFFICIAL_MARKERS) || getDomainScore(image.domain || '') >= 15;
  const suppressStudioOnlyResults = !isContainerSubjectType(analysis.primarySubject.type) && analysis.relevantStudios.length > 0;
  const compositeLikeResult = isCompositeLikeText(text);
  const illustrationLikeResult = containsKeyword(text, ILLUSTRATION_STYLE_KEYWORDS);
  const requiresStrongProjectIdentity =
    isProjectAnchorType(analysis.primarySubject.type) &&
    analysis.imageIntent !== 'person_portrait' &&
    analysis.imageIntent !== 'logo' &&
    analysis.imageIntent !== 'brand_backdrop';

  if (!mentionsRelevantEntity && !projectAnchorMatch && !relevantStudioMatch && contextMatchCount === 0) {
    return null;
  }

  if (suppressStudioOnlyResults && relevantStudioMatch && !mentionsRelevantEntity && !projectAnchorMatch && contextMatchCount === 0) {
    return null;
  }

  if (
    analysis.imageIntent === 'logo' &&
    !isContainerSubjectType(analysis.primarySubject.type) &&
    isLogo &&
    relevantStudioMatch &&
    !primaryMatch &&
    !visualMatch
  ) {
    return null;
  }

  if (isLogo && !analysis.allowLogoOnly) {
    return null;
  }

  if (isLogo && !looksOfficial && !relevantStudioMatch) {
    return null;
  }

  if (compositeLikeResult && analysis.imageIntent !== 'logo' && analysis.imageIntent !== 'brand_backdrop') {
    return null;
  }

  if (illustrationLikeResult && analysis.primarySubject.type !== 'character') {
    return null;
  }

  if (requiresStrongProjectIdentity && !primaryMatch && !projectAnchorMatch && !visualMatch) {
    return null;
  }

  if (
    referenceOnlyMatch &&
    !visualMatch &&
    !entityMatches(text, analysis.primarySubject.name) &&
    contextMatchCount === 0 &&
    !projectAnchorMatch
  ) {
    return null;
  }

  if (franchiseRule?.blockedTerms && containsKeyword(text, franchiseRule.blockedTerms)) {
    return null;
  }

  if (
    franchiseRule &&
    !hasRelevantEntityMatch(text, franchiseRule.requiredTerms) &&
    !visualMatch &&
    contextMatchCount === 0 &&
    !projectAnchorMatch
  ) {
    return null;
  }

  const validation = validateImageCandidate(image, analysis);
  if (!validation.approved) {
    return null;
  }

  let score = 0;

  if (primaryMatch) {
    score += 50;
  } else if (mentionsRelevantEntity) {
    score += 28;
  }

  if (contextMatchCount > 0) {
    score += Math.min(28, contextMatchCount * 14);
  }

  if (projectAnchorMatch) {
    score += (isLogo || isPoster) ? 22 : 12;
  }

  if (relevantStudioMatch) {
    score += isContainerSubjectType(analysis.primarySubject.type) ? 35 : 4;
  }

  if (entityMatches(text, query)) {
    score += 12;
  }

  score += getDomainScore(image.domain || '');
  score += Math.min(20, Math.round(((image.imageWidth || 0) * (image.imageHeight || 0)) / 250000));
  score += getImageQualityScore(image, analysis.imageIntent);
  score += Math.max(0, 10 - ((image.position || 10) - 1));

  const imageType = getImageTypeScore(text, analysis);
  score += imageType.score;

  if (looksOfficial) {
    score += 10;
  }

  if (
    analysis.requiredContextTerms.length > 0 &&
    contextMatchCount === 0 &&
    (analysis.contextProject || analysis.relevantStudios.length > 0)
  ) {
    score -= 55;
  }

  if (referenceOnlyMatch) {
    score -= 45;
  }

  if (suppressStudioOnlyResults && relevantStudioMatch && !mentionsRelevantEntity) {
    score -= 40;
  }

  if (
    containsKeyword(text, COMIC_ART_KEYWORDS) &&
    (analysis.contextProject || analysis.relevantStudios.length > 0 || analysis.primarySubject.type === 'character')
  ) {
    score -= 55;
  }

  if (analysis.targetFormat === 'movie' && looksLikeSeriesResult && !looksLikeMovieResult) {
    score -= 50;
  }

  if (analysis.targetFormat === 'series' && looksLikeMovieResult && !looksLikeSeriesResult) {
    score -= 40;
  }

  if (analysis.imageIntent !== 'poster' && isPoster) {
    score -= 30;
  }

  if ((analysis.imageIntent === 'backdrop' || analysis.imageIntent === 'still' || analysis.imageIntent === 'character_still') && isTallPosterAspect(image)) {
    score -= 35;
  }

  if ((analysis.imageIntent === 'backdrop' || analysis.imageIntent === 'still') && isLandscapeAspect(image)) {
    score += 24;
  }

  if (analysis.imageIntent === 'character_still' && isLandscapeAspect(image)) {
    score += 18;
  }

  if ((analysis.imageIntent === 'backdrop' || analysis.imageIntent === 'still' || analysis.imageIntent === 'character_still') && !isLandscapeAspect(image) && isSquareishAspect(image)) {
    score -= 8;
  }

  if (analysis.imageIntent === 'person_portrait' && isLandscapeAspect(image)) {
    score -= 12;
  }

  if (analysis.imageIntent === 'logo') {
    if (isTallPosterAspect(image)) {
      score -= 60;
    }

    if (isSquareishAspect(image)) {
      score += 16;
    } else if (isLandscapeAspect(image)) {
      score += 12;
    }
  }

  if (analysis.imageIntent === 'brand_backdrop') {
    if (isTallPosterAspect(image)) {
      score -= 50;
    }

    if (isLandscapeAspect(image)) {
      score += 18;
    } else if (isSquareishAspect(image)) {
      score += 10;
    }
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

function buildFeedFallbackImages(
  fallbackImages: string[],
  limit: number,
  reason: string = 'Article body image'
): RSSResolvedImage[] {
  return fallbackImages.slice(0, Math.max(limit, 1)).map((url) => ({
    url,
    reason,
    source: 'feed',
  }));
}

export async function resolveRelevantRSSImages(
  article: RSSImageSelectionArticle,
  options: {
    serperEnabled?: boolean;
    tmdbEnabled?: boolean;
    openaiWebSearchEnabled?: boolean;
    serperPriority?: boolean;
    imageSourcePriority?: 'tmdb_first' | 'openai_first' | 'serper_first';
    limit: number;
    smartCount?: boolean;
    model?: AIModel | string;
    openaiWebSearchModel?: AIModel | string;
  }
): Promise<RSSResolvedImage[]> {
  const limit = Math.max(options.limit, 1);
  const sources = getEnabledImageSources(options);
  const analysis = await extractSubjectAnalysis(article, options.model);
  const rawProjectLinkedFeedFallback = shouldAllowRawProjectLinkedFeedFallback(article);
  const allowProjectLinkedFeedFallback =
    shouldAllowProjectLinkedFeedFallback(article, analysis) ||
    rawProjectLinkedFeedFallback;
  const revealDrivenFeedFallback = shouldUseFeedFallbackImages(article);
  const fallbackImages = (revealDrivenFeedFallback || allowProjectLinkedFeedFallback)
    ? await filterRenderableFeedFallbackUrls(
      (revealDrivenFeedFallback
        ? filterAllowedFeedFallbackUrls(
            dedupeUrls(article.fallbackImages || []),
            analysis,
            article
          )
        : filterProjectLinkedFeedFallbackUrls(
            filterAllowedFeedFallbackUrls(
              dedupeUrls(article.fallbackImages || []),
              analysis,
              article
            )
          ))
    )
    : [];
  if (sources.length === 0) {
    return buildFeedFallbackImages(fallbackImages, limit);
  }

  const shouldUseStructuredPairing = limit >= 2 &&
    (options.smartCount || isStreamingAvailabilityStory(article, analysis) || isMemorialStory(article));

  if (shouldUseStructuredPairing) {
    const plan = determineSmartImagePlan(article, analysis);
    const primaryAnalysis = buildAnalysisForSlot(analysis, plan.primary);
    const primaryResolved = await resolveSmartPrimaryCandidate(
      article,
      primaryAnalysis,
      sources,
      fallbackImages,
      options.openaiWebSearchModel
    );
    const memorialStory = isMemorialStory(article);

    if (!primaryResolved) {
      const projectPrimaryFallbackAnalysis = buildSingleSlotProjectFallbackAnalysis(primaryAnalysis, article);
      if (projectPrimaryFallbackAnalysis) {
        const projectFallbackResolved = await resolveSingleSlotImages(
          article,
          projectPrimaryFallbackAnalysis,
          fallbackImages,
          sources,
          1,
          options.openaiWebSearchModel
        );
        if (projectFallbackResolved[0]) {
          return [projectFallbackResolved[0]];
        }
      }

      return buildFeedFallbackImages(fallbackImages, limit);
    }

    if (memorialStory && plan.primary.intent === 'person_portrait' && primaryResolved.role !== 'person') {
      if (!plan.secondary) {
        return [];
      }

      const memorialSecondaryAnalysis = buildAnalysisForSlot(analysis, plan.secondary);
      const memorialProjectOnly = await collectStructuredTMDbImages(memorialSecondaryAnalysis, 1);
      const neutralProjectImage = memorialProjectOnly.find((item) => isMemorialNeutralProjectRole(item.role));
      return neutralProjectImage ? [neutralProjectImage] : [];
    }

    if (fallbackImages.length > 0 && shouldReplaceBrandingPrimaryWithFeedFallback(primaryAnalysis, primaryResolved.image, primaryResolved.role)) {
      return buildFeedFallbackImages(fallbackImages, limit);
    }

    if (!plan.useTwoImages || !plan.secondary) {
      return [primaryResolved.image];
    }

    const secondaryAnalysis = buildAnalysisForSlot(analysis, plan.secondary);
    const secondaryResolved = await resolveSmartSecondaryCandidate(
      secondaryAnalysis,
      primaryResolved.image,
      primaryResolved.role,
      sources,
      options.openaiWebSearchModel
    );

    if (!secondaryResolved) {
      if (!shouldFallbackToFeedImageForSecondary(plan.secondary)) {
        return [primaryResolved.image];
      }

      const fallbackSecondary = buildFeedFallbackImages(
        fallbackImages.filter((url) => getImageIdentity(url) !== getImageIdentity(primaryResolved.image.url)),
        1
      )[0];

      return fallbackSecondary
        ? [primaryResolved.image, fallbackSecondary]
        : [primaryResolved.image];
    }

    if (memorialStory && !isMemorialNeutralProjectRole(secondaryResolved.role)) {
      return [primaryResolved.image];
    }

    return shouldKeepSecondaryCarouselImage(primaryResolved.image, secondaryResolved.image)
      ? [
          primaryResolved.image,
          secondaryResolved.image,
        ]
      : [primaryResolved.image];
  }

  const resolved = await resolveSingleSlotImages(
    article,
    analysis,
    fallbackImages,
    sources,
    limit,
    options.openaiWebSearchModel
  );
  if (resolved.length === 0 && (allowProjectLinkedFeedFallback || rawProjectLinkedFeedFallback) && fallbackImages.length > 0) {
    return buildFeedFallbackImages(fallbackImages, 1, 'Article project context image');
  }

  return resolved;
}

export const __rssImageSelectionTestUtils = {
  validateImageCandidate,
  guessPrimarySubject,
  normalizeSubjectAnalysis,
  getRevealDrivenArticleMode,
  determineSmartImagePlan,
  shouldUseFeedFallbackImages,
  isUnanchoredGeneralStory,
};
