import crypto from 'node:crypto';
import aiService, { __rssCaptionTestUtils, type RSSCanonicalEntity, type RSSContext } from '../services/ai.service';
import { resolveRelevantRSSImages, type RSSResolvedImage } from '../services/rss-image-selection.service';
import { fetchRSSFeed, parseRSSFeed, __rssAuditTestUtils } from '../services/rss.service';
import type {
  RssAuditCaptionDecision,
  RssAuditCase,
  RssAuditEntityDecision,
  RssAuditEntityType,
  RssAuditFailureCode,
  RssAuditFeedConfig,
  RssAuditImageDecision,
  RssAuditResult,
  RssAuditScope,
  RssAuditTmdbCandidate,
} from './rss-audit-types';
import { readJsonFile, writeAuditCases, writeAuditResults } from './rss-audit-storage';
import { findRssAuditFixRules } from './rss-fix-suggester';

const {
  normalizeRSSHeadlineInput,
  enforceRSSCaptionPunctuation,
  getRSSCaptionHardInvalidReasonCodes,
  buildDeterministicRssCaption,
  buildHeuristicRssCaptionExtraction,
} = __rssCaptionTestUtils;

export type RssAuditRunnerOptions = {
  perSource?: number;
  maxTotal?: number;
  sources?: string[];
  out?: string;
  casesOut?: string;
  bodyFetch?: boolean;
  imageLimit?: number;
  casesInput?: string;
  captionMode?: 'live' | 'deterministic';
};

export function getRssAuditImageResolverOptions(imageLimit = 2) {
  return {
    tmdbEnabled: true,
    serperEnabled: false,
    openaiWebSearchEnabled: false,
    imageSourcePriority: 'tmdb_first' as const,
    smartCount: true,
    limit: imageLimit,
    skipAiSubjectAnalysis: true,
  };
}

function caseIdFor(input: RssAuditCase): string {
  return crypto
    .createHash('sha1')
    .update(`${input.sourceName}\n${input.articleUrl}\n${input.articleTitle}`)
    .digest('hex')
    .slice(0, 16);
}

function mapEntityType(value?: RSSCanonicalEntity['entityType']): RssAuditEntityType | undefined {
  if (!value || value === 'unknown' || value === 'character' || value === 'platform') {
    return value ? 'other' : undefined;
  }
  return value;
}

function unique(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

export function canonicalTokens(value?: string): string[] {
  return unique(
    String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2)
      .filter((token) => !['the', 'and', 'for', 'with', 'from', 'season', 'movie', 'series', 'game', 'games'].includes(token))
  );
}

export function hasCanonicalTokenOverlap(canonicalEntity: string | undefined, candidateTitle: string | undefined): boolean {
  const canonical = canonicalTokens(canonicalEntity);
  const candidate = new Set(canonicalTokens(candidateTitle));
  return canonical.length > 0 && canonical.some((token) => candidate.has(token));
}

function classifyUnresolvedEntity(input: RssAuditCase, canonical: RSSCanonicalEntity): RssAuditFailureCode {
  const text = `${input.articleTitle} ${input.articleDescription || ''} ${input.articleBody || ''}`;
  const flags = new Set(canonical.ambiguityFlags || []);
  if (flags.has('quote_led_headline_junk')) {
    return 'QUOTE_LED_HEADLINE_JUNK';
  }
  if (flags.has('canonical_project_weak')) {
    return 'CANONICAL_PROJECT_WEAK';
  }
  if (flags.has('canonical_person_weak')) {
    return 'CANONICAL_PERSON_WEAK';
  }
  if (
    canonical.ambiguityFlags?.includes('unsafe_canonical_entity_removed') ||
    /\b(review|recap|quiz|ranked|what to watch|where to watch|explained|best .*movies?|best .*shows?|forgotten|underrated)\b/i.test(text)
  ) {
    return 'ENTITY_NOT_RESOLVED_SAFE_BLOCK';
  }

  if (/[“”"'‘’][^“”"'‘’]{2,120}[“”"'‘’]/.test(text) || /\b(season \d+|renewed|trailer|casts?|joins?|adaptation|first look)\b/i.test(text)) {
    return 'ENTITY_NOT_RESOLVED_SHOULD_HAVE_RESOLVED';
  }

  return 'ENTITY_NOT_RESOLVED_SAFE_BLOCK';
}

function classifyImageNotFound(input: RssAuditCase, canonical: RSSCanonicalEntity): RssAuditFailureCode {
  const text = `${input.articleTitle} ${input.articleDescription || ''} ${input.articleBody || ''}`;
  if (
    canonical.mediaTitle ||
    canonical.primarySubject ||
    /[“”"'‘’][^“”"'‘’]{2,120}[“”"'‘’]/.test(text) ||
    /\b(season \d+|renewed|trailer|casts?|joins?|adaptation|first look|premiere|release date)\b/i.test(text)
  ) {
    return 'IMAGE_NOT_FOUND_FALSE_BLOCK';
  }

  return 'IMAGE_NOT_FOUND_SAFE_BLOCK';
}

function inferTmdbTitleFromReason(reason?: string): string | undefined {
  return reason?.match(/\bTMDb\s+(?:backdrop|poster|logo|profile|still|image)\s+for\s+(.+?)(?:\.|$)/i)?.[1]?.trim()
    || reason?.match(/\bTMDb\s+(.+?)\s+for\s+(.+?)(?:\.|$)/i)?.[2]?.trim();
}

function mapProductionCaptionCode(code: string): RssAuditFailureCode {
  if (code === 'CAPTION_CONTAINS_HTML_ENTITY') {
    return 'CAPTION_HTML_ENTITY_LEAK';
  }
  if (code === 'CAPTION_HEADLINE_JUNK') {
    return 'CAPTION_MALFORMED_HEADLINE';
  }
  if (code === 'CAPTION_ARTICLE_PACKAGE_LABEL') {
    return 'CAPTION_PACKAGE_LABEL_LEAK';
  }
  if (code === 'CAPTION_RAW_SNIPPET_LEAK' || code === 'CAPTION_CONTAINS_ELLIPSIS_PLACEHOLDER') {
    return 'CAPTION_ARTICLE_COPY_LEAK';
  }
  return code;
}

function mapProductionImageCode(code: string): RssAuditFailureCode {
  if (code === 'IMAGE_INVALID_DUAL_SLOT' || code === 'IMAGE_EMPTY_SECONDARY_SLOT') {
    return 'IMAGE_SECONDARY_SLOT_CONTAMINATED';
  }
  return code;
}

function buildEntityDecision(canonical: RSSCanonicalEntity): RssAuditEntityDecision {
  const canonicalEntity = canonical.mediaTitle || canonical.primarySubject || canonical.franchise;
  const failureFlags = [...(canonical.ambiguityFlags || [])];
  if (!canonicalEntity) {
    failureFlags.push('audit_entity_empty');
  }

  return {
    canonicalEntity,
    canonicalEntityType: mapEntityType(canonical.entityType),
    eventType: canonical.eventType,
    confidence: canonical.confidence,
    ambiguityFlags: failureFlags,
  };
}

function classifyAuditScope(canonical: RSSCanonicalEntity): RssAuditScope {
  const flags = canonical.ambiguityFlags || [];
  if (
    flags.includes('article_family_shopping_or_product') ||
    flags.includes('article_family_political_or_non_entertainment')
  ) {
    return 'not_screenrender_core';
  }
  if (
    flags.includes('article_family_event_or_festival') ||
    flags.includes('article_family_business_or_platform') ||
    flags.includes('article_family_gaming_collab_or_licensing') ||
    flags.includes('article_family_editorial_listicle')
  ) {
    return 'entertainment_adjacent';
  }
  if (
    canonical.entityType === 'movie' ||
    canonical.entityType === 'tv' ||
    canonical.entityType === 'person' ||
    canonical.entityType === 'character' ||
    canonical.entityType === 'franchise'
  ) {
    return 'screenrender_core';
  }
  return 'entertainment_adjacent';
}

function buildTmdbQueries(input: RssAuditCase, canonical: RSSCanonicalEntity): string[] {
  return unique([
    canonical.mediaTitle,
    canonical.primarySubject,
    canonical.franchise,
    `${canonical.mediaTitle || canonical.primarySubject || input.articleTitle} ${canonical.eventType || ''}`,
    input.articleTitle,
  ]);
}

function inferAssetKind(reason?: string): 'backdrops' | 'posters' | 'logos' | 'profiles' | undefined {
  const normalized = String(reason || '').toLowerCase();
  if (/\b(profile|portrait|person)\b/.test(normalized)) return 'profiles';
  if (/\b(poster)\b/.test(normalized)) return 'posters';
  if (/\b(logo|brand)\b/.test(normalized)) return 'logos';
  if (/\b(backdrop|still|image|tmdb)\b/.test(normalized)) return 'backdrops';
  return undefined;
}

function buildAssetCountSummary(images: RSSResolvedImage[]): RssAuditImageDecision['assetsFound'] {
  const summary: NonNullable<RssAuditImageDecision['assetsFound']> = {};
  for (const image of images) {
    const kind = inferAssetKind(image.reason);
    if (kind) {
      summary[kind] = (summary[kind] || 0) + 1;
    }
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
}

function inferFallbackStage(images: RSSResolvedImage[], canonical: RSSCanonicalEntity): string {
  if (images.length === 0) {
    return 'none';
  }

  const first = images[0];
  const reason = String(first.reason || '').toLowerCase();
  if (first.source !== 'tmdb') {
    return `${first.source}_fallback`;
  }
  if (/\b(profile|portrait|person)\b/.test(reason) && canonical.entityType !== 'person') {
    return 'person_portrait_fallback';
  }
  if (/\bposter\b/.test(reason)) {
    return 'poster_fallback';
  }
  if (/\b(logo|brand)\b/.test(reason)) {
    return 'exact_title_logo_fallback';
  }
  return 'project_still_or_backdrop';
}

function inferNoImageFailureStage(
  input: RssAuditCase,
  canonical: RSSCanonicalEntity,
  tmdbCandidates: RssAuditTmdbCandidate[],
  publishImageCodes: string[]
): string {
  const articleText = `${input.articleTitle} ${input.articleDescription || ''} ${input.articleBody || ''}`;
  const flags = new Set(canonical.ambiguityFlags || []);
  const strippedMediaTitle = canonical.mediaTitle
    ? canonical.mediaTitle.replace(/\bseason\s+\d+\b.*$/i, '').replace(/\bpremiere\b.*$/i, '').trim()
    : '';
  if (flags.has('quote_led_headline_junk') || flags.has('canonical_project_weak')) {
    return 'PERSON_FALLBACK_BLOCKED_WEAK_PROJECT';
  }
  if (flags.has('canonical_person_weak')) {
    return 'PERSON_FALLBACK_BLOCKED_WEAK_PERSON';
  }
  if (!canonical.mediaTitle && !canonical.primarySubject && !canonical.franchise) {
    return 'TMDB_TITLE_NOT_RESOLVED';
  }
  if (
    canonical.namedPeople?.length &&
    /\b(casts?|casting|joins?|boards?|creator|director|showrunner|comments?|says)\b/i.test(articleText)
  ) {
    if (flags.has('canonical_project_weak')) {
      return 'PERSON_FALLBACK_BLOCKED_WEAK_PROJECT';
    }
    if (flags.has('canonical_person_weak')) {
      return 'PERSON_FALLBACK_BLOCKED_WEAK_PERSON';
    }
    if (!flags.has('article_family_person_interview_or_reaction') && canonical.eventType !== 'casting') {
      return 'PERSON_FALLBACK_BLOCKED_NON_PERSON_LED';
    }
    return 'PERSON_FALLBACK_NOT_ALLOWED_TRUE';
  }
  if (canonical.franchise && canonical.mediaTitle && canonical.franchise.toLowerCase() !== canonical.mediaTitle.toLowerCase()) {
    return 'FRANCHISE_FALLBACK_UNAVAILABLE';
  }
  if (canonical.mediaTitle && strippedMediaTitle && strippedMediaTitle.toLowerCase() !== canonical.mediaTitle.toLowerCase()) {
    return 'EXACT_TITLE_SEARCH_FAILED';
  }
  if (
    canonical.mediaTitle &&
    /\b(season \d+|premiere|release date|renewed|renewal|adaptation|reboot|revival)\b/i.test(articleText)
  ) {
    return 'POSTER_FALLBACK_FAILED';
  }
  if (publishImageCodes.some((code) => /logo/i.test(code))) {
    return 'LOGO_ONLY_REJECTED';
  }
  if (canonical.entityType === 'person') {
    return flags.has('canonical_person_weak')
      ? 'PERSON_FALLBACK_BLOCKED_WEAK_PERSON'
      : 'PERSON_FALLBACK_NOT_ALLOWED_TRUE';
  }
  if (tmdbCandidates.length > 0) {
    return 'TMDB_RESOLVED_NO_ACCEPTED_ASSETS';
  }
  return 'PROJECT_FALLBACK_EMPTY';
}

function buildImageDecision(
  input: RssAuditCase,
  canonical: RSSCanonicalEntity,
  images: RSSResolvedImage[],
  publishImageCodes: string[]
): RssAuditImageDecision {
  const canonicalEntity = canonical.mediaTitle || canonical.primarySubject || canonical.franchise;
  const selectedImages = images.map((image, index) => ({
    role: index === 0 ? 'primary' as const : 'secondary' as const,
    label: image.reason,
    source: image.source,
    subject: inferTmdbTitleFromReason(image.reason) || canonicalEntity,
    accepted: true,
    rejectionReasons: [] as string[],
  }));
  const tmdbCandidates: RssAuditTmdbCandidate[] = images
    .filter((image) => image.source === 'tmdb')
    .map((image) => {
      const title = inferTmdbTitleFromReason(image.reason) || canonicalEntity || image.reason || 'Unknown TMDb candidate';
      const rejectionReasons = hasCanonicalTokenOverlap(canonicalEntity, title)
        ? []
        : ['zero canonical token overlap'];
      return {
        title,
        mediaType: canonical.entityType === 'tv' ? 'tv' : canonical.entityType === 'movie' ? 'movie' : undefined,
        score: image.score,
        accepted: rejectionReasons.length === 0,
        rejectionReasons,
      };
    });

  const failureCodes = new Set<RssAuditFailureCode>(publishImageCodes.map(mapProductionImageCode));
  if (images.length === 0) {
    failureCodes.add('IMAGE_NOT_FOUND');
    failureCodes.add(classifyImageNotFound(input, canonical));
  }
  if (tmdbCandidates.some((candidate) => candidate.rejectionReasons.includes('zero canonical token overlap'))) {
    failureCodes.add('IMAGE_TMBD_CANDIDATE_ZERO_TOKEN_OVERLAP');
  }
  if (
    /\blogo\b/i.test(images[0]?.reason || '') &&
    canonical.entityType !== 'company' &&
    canonical.entityType !== 'platform' &&
    canonical.entityType !== 'unknown'
  ) {
    failureCodes.add('IMAGE_COMPANY_LOGO_MISUSED');
  }
  const finalFailureStage = images.length === 0
    ? inferNoImageFailureStage(input, canonical, tmdbCandidates, publishImageCodes)
    : undefined;
  if (finalFailureStage) {
    failureCodes.add(finalFailureStage);
  }

  return {
    mode: images.length === 0 ? 'none' : images.length > 1 ? 'dual' : 'single',
    primarySubject: canonicalEntity,
    secondarySubject: canonical.secondarySubject,
    selectedSource: images[0]?.source,
    tmdbTitleResolved: tmdbCandidates[0]?.title,
    assetsFound: buildAssetCountSummary(images),
    assetsAccepted: images.length,
    fallbackStageReached: inferFallbackStage(images, canonical),
    finalFailureStage,
    selectedImages,
    tmdbQueries: buildTmdbQueries(input, canonical),
    tmdbCandidates,
    failureCodes: [...failureCodes],
  };
}

function buildCaptionDecision(generatedCaption: string, context: RSSContext): RssAuditCaptionDecision {
  const normalizedCaption = enforceRSSCaptionPunctuation(generatedCaption || '');
  const productionCodes = getRSSCaptionHardInvalidReasonCodes(normalizedCaption, context);
  const failureCodes = productionCodes.map(mapProductionCaptionCode);
  const deterministic = buildDeterministicRssCaption(buildHeuristicRssCaptionExtraction(context), context);

  return {
    generatedCaption,
    normalizedCaption,
    failureCodes,
    hardInvalidReasons: productionCodes,
    rebuildUsed: normalizedCaption.trim() === deterministic.trim(),
  };
}

export function buildDiagnosisAndFixes(result: Pick<RssAuditResult, 'entity' | 'image' | 'caption' | 'publishFailureCodes'>): {
  diagnosis: string[];
  recommendedFixes: string[];
} {
  const diagnosis: string[] = [];
  const recommendedFixes: string[] = [];
  const codes = new Set([
    ...result.image.failureCodes,
    ...result.caption.failureCodes,
    ...result.publishFailureCodes,
  ]);

  if (!result.entity.canonicalEntity) {
    diagnosis.push('No reliable canonical entity was resolved from the article.');
    recommendedFixes.push('Tighten canonical entity extraction before image or caption generation.');
  }

  for (const rule of findRssAuditFixRules(codes)) {
    if (rule.diagnosis) {
      diagnosis.push(rule.diagnosis);
    }
    recommendedFixes.push(rule.recommendation);
  }

  return {
    diagnosis: unique(diagnosis),
    recommendedFixes: unique(recommendedFixes),
  };
}

export async function analyzeRssAuditCase(
  input: RssAuditCase,
  options: { imageLimit?: number; captionMode?: 'live' | 'deterministic' } = {}
): Promise<RssAuditResult> {
  const normalizedTitle = normalizeRSSHeadlineInput(input.articleTitle);
  const normalizedDescription = __rssAuditTestUtils.sanitizeRSSPlainText(input.articleDescription || '');
  const item = {
    title: input.articleTitle,
    link: input.articleUrl,
    description: input.articleDescription || '',
    contentHtml: input.articleBody || '',
    pubDate: input.publishedAt ? new Date(input.publishedAt) : new Date(),
    imageUrls: [],
  };
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity(item);
  const entity = buildEntityDecision(canonical);

  const images = await resolveRelevantRSSImages(
    {
      title: input.articleTitle,
      description: input.articleDescription,
      contentHtml: input.articleBody,
      canonicalEntity: canonical,
    },
    getRssAuditImageResolverOptions(options.imageLimit || 2)
  );

  const selectedVisuals = __rssAuditTestUtils.buildRSSCaptionVisualContext(item, images);
  const allowedEntities = __rssAuditTestUtils.buildRSSCaptionAllowedEntities(item, images);
  const captionContext: RSSContext = {
    articleTitle: input.articleTitle,
    feedName: input.sourceName,
    summary: normalizedDescription,
    articleBody: __rssAuditTestUtils.sanitizeRSSPlainText(input.articleBody || ''),
    articleContentHtml: input.articleBody,
    platform: 'X',
    selectedVisuals,
    allowedEntities,
    canonicalEntity: canonical,
  };
  const generatedCaption = options.captionMode === 'deterministic'
    ? buildDeterministicRssCaption(buildHeuristicRssCaptionExtraction(captionContext), captionContext)
    : await aiService.generateRSSCaption(captionContext);
  const normalizedCaption = __rssAuditTestUtils.sanitizeRSSCaptionText(generatedCaption, 280);
  const publishValidation = __rssAuditTestUtils.validateRSSFinalPublishState(normalizedCaption, images, canonical, {
    articleTitle: input.articleTitle,
    feedName: input.sourceName,
    summary: normalizedDescription,
    articleBody: __rssAuditTestUtils.sanitizeRSSPlainText(input.articleBody || ''),
    articleContentHtml: input.articleBody,
    allowedEntities,
  });

  const image = buildImageDecision(input, canonical, publishValidation.resolvedImages, publishValidation.reasonCodes);
  const caption = buildCaptionDecision(normalizedCaption, captionContext);
  const publishFailureCodes = publishValidation.reasonCodes.map((code) => {
    if (code.startsWith('CAPTION_')) {
      return mapProductionCaptionCode(code);
    }
    if (code.startsWith('IMAGE_')) {
      return mapProductionImageCode(code);
    }
    return code;
  });
  if (!entity.canonicalEntity) {
    publishFailureCodes.push('ENTITY_NOT_RESOLVED');
    publishFailureCodes.push(classifyUnresolvedEntity(input, canonical));
  }

  const baseResult: RssAuditResult = {
    caseId: caseIdFor(input),
    input,
    scope: classifyAuditScope(canonical),
    normalizedTitle,
    normalizedDescription,
    entity,
    image,
    caption,
    publishBlocked: publishFailureCodes.length > 0 || image.failureCodes.length > 0 || caption.failureCodes.length > 0,
    publishFailureCodes: unique(publishFailureCodes),
    diagnosis: [],
    recommendedFixes: [],
  };
  const diagnostics = buildDiagnosisAndFixes(baseResult);
  return {
    ...baseResult,
    diagnosis: diagnostics.diagnosis,
    recommendedFixes: diagnostics.recommendedFixes,
  };
}

async function fetchArticleBody(articleUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(articleUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Screndly RSS Audit/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) {
      return undefined;
    }
    const html = await response.text();
    return html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html.match(/<main[\s\S]*?<\/main>/i)?.[0] || undefined;
  } catch {
    return undefined;
  }
}

export async function collectRssAuditCases(feeds: RssAuditFeedConfig[], options: RssAuditRunnerOptions = {}): Promise<RssAuditCase[]> {
  const selectedSourceNames = new Set((options.sources || []).map((source) => source.toLowerCase()));
  const selectedFeeds = selectedSourceNames.size > 0
    ? feeds.filter((feed) => selectedSourceNames.has(feed.name.toLowerCase()))
    : feeds;
  const perSource = Math.max(options.perSource || 200, 1);
  const cases: RssAuditCase[] = [];

  for (const feed of selectedFeeds) {
    console.log(`[RSS Audit] Fetching ${feed.name} (${feed.url})`);
    let parsed: any;
    try {
      const xml = await fetchRSSFeed(feed.url);
      parsed = await parseRSSFeed(xml) as any;
    } catch (error) {
      console.warn(
        `[RSS Audit] Skipping ${feed.name}: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }
    const items = (parsed.items || []).slice(0, perSource);
    let sourceCount = 0;

    for (const item of items) {
      if (options.maxTotal && cases.length >= options.maxTotal) {
        break;
      }
      const articleBody = options.bodyFetch && item.link
        ? await fetchArticleBody(item.link) || item.contentHtml
        : item.contentHtml;
      cases.push({
        sourceName: feed.name,
        feedUrl: feed.url,
        articleUrl: item.link,
        articleTitle: item.title,
        articleDescription: item.description,
        articleBody,
        publishedAt: item.pubDate instanceof Date ? item.pubDate.toISOString() : undefined,
      });
      sourceCount += 1;
    }

    console.log(`[RSS Audit] Collected ${sourceCount} articles from ${feed.name}; total ${cases.length}`);
    if (options.maxTotal && cases.length >= options.maxTotal) {
      break;
    }
  }

  return cases;
}

export async function runRssAudit(feeds: RssAuditFeedConfig[], options: RssAuditRunnerOptions = {}): Promise<RssAuditResult[]> {
  const cases = options.casesInput
    ? await readJsonFile<RssAuditCase[]>(options.casesInput)
    : await collectRssAuditCases(feeds, options);
  if (options.casesOut) {
    await writeAuditCases(options.casesOut, cases);
  }

  const results: RssAuditResult[] = [];
  for (const auditCase of cases) {
    console.log(`[RSS Audit] Analyzing ${results.length + 1}/${cases.length}: ${auditCase.sourceName} - ${auditCase.articleTitle}`);
    results.push(await analyzeRssAuditCase(auditCase, {
      imageLimit: options.imageLimit,
      captionMode: options.captionMode,
    }));
    if (options.out) {
      await writeAuditResults(options.out, results);
    }
  }

  if (options.out) {
    await writeAuditResults(options.out, results);
  }
  console.log(`[RSS Audit] Finished ${results.length} articles; blocked ${results.filter((result) => result.publishBlocked).length}`);
  return results;
}
