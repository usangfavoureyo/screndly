import crypto from 'node:crypto';
import { z } from 'zod';
import { generateCompletion, normalizeAIModel, type AIModel } from './ai.service';

export const RSS_EDITORIAL_BRAIN_VERSION = 'rss-editorial-brain-2026-04-18-v2';
export const RSS_EDITORIAL_BRAIN_PROMPT_VERSION = '2026-04-18-gated-v1';
export const RSS_EDITORIAL_BRAIN_SCHEMA_VERSION = '2026-04-17-schema-v1';
export const DEFAULT_RSS_EDITORIAL_BRAIN_MODEL: AIModel = 'gpt-5.4-mini';

const laneSchema = z.enum([
  'core_auto_publish',
  'core_manual_review_spoiler',
  'entertainment_adjacent',
  'blocked_non_core',
  'ignore_completely',
]);

const storyFamilySchema = z.enum([
  'project_news',
  'casting',
  'renewal',
  'trailer',
  'first_look',
  'project_announcement',
  'tribute',
  'obituary',
  'person_commentary_on_project',
  'spoiler_sensitive',
  'review',
  'recap',
  'editorial_feature',
  'retrospective',
  'comics_only',
  'non_target_media_business',
]);

const primaryEntityTypeSchema = z.enum(['project', 'person', 'franchise', 'none']);
const formatSchema = z.enum(['movie', 'tv', 'game', 'anime', 'comics', 'unknown']);
const headlineTrustSchema = z.enum(['high', 'medium', 'low']);
const spoilerRiskSchema = z.enum(['none', 'low', 'medium', 'high']);
const imageModeSchema = z.enum([
  'project_first',
  'person_first',
  'article_image_first',
  'dual_person',
  'dual_person_project',
  'spoiler_safe_neutral',
]);
const captionModeSchema = z.enum([
  'headline_news',
  'person_commentary',
  'tribute',
  'obituary',
  'first_look',
  'trailer',
  'spoiler_safe',
  'project_announcement',
]);

const rssEditorialBrainDecisionSchema = z.object({
  lane: laneSchema,
  story_family: storyFamilySchema,
  primary_entity_type: primaryEntityTypeSchema,
  primary_entity: z.string(),
  secondary_entities: z.array(z.string()),
  canonical_aliases: z.array(z.string()),
  current_title_over_development_title: z.boolean(),
  development_title_aliases: z.array(z.string()),
  format: formatSchema,
  event: z.string(),
  headline_trust: headlineTrustSchema,
  body_recovery_required: z.boolean(),
  spoiler_risk: spoilerRiskSchema,
  manual_review_reason: z.string(),
  image_strategy: z.object({
    mode: imageModeSchema,
    primary_preference: z.array(z.string()),
    secondary_preference: z.array(z.string()),
    avoid: z.array(z.string()),
  }),
  caption_strategy: z.object({
    mode: captionModeSchema,
    lead_subject: z.string(),
    must_name: z.array(z.string()),
    must_not_use: z.array(z.string()),
    must_not_spoil: z.boolean(),
  }),
  caption_facts: z.object({
    headline_fact: z.string(),
    supporting_fact: z.string(),
    quote: z.string(),
    bullets: z.array(z.string()),
  }),
  evidence: z.object({
    body_titles: z.array(z.string()),
    people: z.array(z.string()),
    projects: z.array(z.string()),
    networks_platforms: z.array(z.string()),
    years: z.array(z.string()),
    quotes: z.array(z.string()),
  }),
  confidence: z.number(),
  notes: z.string(),
});

export type RssEditorialBrainDecision = z.infer<typeof rssEditorialBrainDecisionSchema>;

export interface RssEditorialBrainInput {
  source: string;
  url: string;
  headline: string;
  summary?: string;
  bodyText?: string;
  extractedQuotes: string[];
  articleImages: string[];
  imageEvidence?: string[];
  sourceTrustTier: string;
  tmdbCandidates?: Array<{ title: string; mediaType?: string; score?: number }>;
  currentDateTime: string;
}

export interface RssEditorialBrainResult {
  decision: RssEditorialBrainDecision;
  rawResponse?: string;
  usedFallback: boolean;
  normalizationNotes: string[];
  error?: string;
  editorialBrainVersion: string;
  promptVersion: string;
  schemaVersion: string;
  contentHash: string;
  agentModel: AIModel;
  decisionHash: string;
}

function normalizeList(values: unknown, limit = 12): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(
    values
      .map((value) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')
      .filter(Boolean)
      .slice(0, limit)
  ));
}

function normalizeString(value: unknown, maxLength = 400): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function normalizeRssEditorialBrainEvent(value: unknown): string {
  const normalized = normalizeString(value, 120).toLowerCase();
  if (!normalized) {
    return 'other';
  }
  if (/\brenew/.test(normalized)) return 'renewal';
  if (/\bfirst look\b|\bexclusive (?:look|images?)\b|\bnew images?\b/.test(normalized)) return 'first_look';
  if (/\bofficial title\b|\btitle reveal\b|\bofficially titled\b/.test(normalized)) return 'official_title_reveal';
  if (/\bordered to series\b|\bseries order\b/.test(normalized)) return 'series_order';
  if (/\btrailer\b|\bteaser\b/.test(normalized)) return 'trailer';
  if (/\bobit|dies?|death|passed away\b/.test(normalized)) return 'obituary';
  if (/\btribute|memorial|honor(?:s|ed)?\b/.test(normalized)) return 'tribute';
  if (/\bcommentary\b|\binterview\b|\bquote\b|\bjoke\b/.test(normalized)) return 'interview_quote';
  if (/\bspoiler\b|\bspotted\b|\breveal\b/.test(normalized)) return 'spoiler_sensitive';
  if (/\bcast|joins?|boards?|returns?\b/.test(normalized)) return 'casting';
  if (/\bdevelopment\b|\bannouncement\b|\bnew project\b|\bin development\b/.test(normalized)) return 'project_announcement';
  if (/\bin production\b|\bfilming\b|\bstarts? production\b/.test(normalized)) return 'in_production';
  return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'other';
}

function normalizeDecision(decision: RssEditorialBrainDecision): RssEditorialBrainDecision {
  const normalized: RssEditorialBrainDecision = {
    ...decision,
    primary_entity: normalizeString(decision.primary_entity, 160),
    secondary_entities: normalizeList(decision.secondary_entities),
    canonical_aliases: normalizeList(decision.canonical_aliases),
    development_title_aliases: normalizeList(decision.development_title_aliases),
    event: normalizeRssEditorialBrainEvent(decision.event),
    manual_review_reason: normalizeString(decision.manual_review_reason, 200),
    image_strategy: {
      mode: decision.image_strategy.mode,
      primary_preference: normalizeList(decision.image_strategy.primary_preference),
      secondary_preference: normalizeList(decision.image_strategy.secondary_preference),
      avoid: normalizeList(decision.image_strategy.avoid),
    },
    caption_strategy: {
      mode: decision.caption_strategy.mode,
      lead_subject: normalizeString(decision.caption_strategy.lead_subject, 160),
      must_name: normalizeList(decision.caption_strategy.must_name),
      must_not_use: normalizeList(decision.caption_strategy.must_not_use),
      must_not_spoil: Boolean(decision.caption_strategy.must_not_spoil),
    },
    caption_facts: {
      headline_fact: normalizeString(decision.caption_facts.headline_fact, 220),
      supporting_fact: normalizeString(decision.caption_facts.supporting_fact, 220),
      quote: normalizeString(decision.caption_facts.quote, 280),
      bullets: normalizeList(decision.caption_facts.bullets, 4),
    },
    evidence: {
      body_titles: normalizeList(decision.evidence.body_titles),
      people: normalizeList(decision.evidence.people),
      projects: normalizeList(decision.evidence.projects),
      networks_platforms: normalizeList(decision.evidence.networks_platforms),
      years: normalizeList(decision.evidence.years),
      quotes: normalizeList(decision.evidence.quotes, 8),
    },
    confidence: Math.max(0, Math.min(1, Number.isFinite(decision.confidence) ? decision.confidence : 0)),
    notes: normalizeString(decision.notes, 400),
  };

  if (!normalized.primary_entity && normalized.primary_entity_type !== 'none') {
    normalized.primary_entity_type = 'none';
  }

  return normalized;
}

export function extractRssEditorialBrainSignals(articleHtml?: string): {
  extractedQuotes: string[];
  articleImages: string[];
} {
  if (!articleHtml) {
    return { extractedQuotes: [], articleImages: [] };
  }

  const extractedQuotes = Array.from(articleHtml.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi))
    .map((match) => String(match[1] || '').replace(/<[^>]+>/g, ' '))
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 6);

  const articleImages = Array.from(articleHtml.matchAll(/<img[^>]*src=["']([^"']+)["']/gi))
    .map((match) => String(match[1] || '').trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .slice(0, 12);

  return {
    extractedQuotes: Array.from(new Set(extractedQuotes)),
    articleImages: Array.from(new Set(articleImages)),
  };
}

export function buildRssEditorialBrainContentHash(input: RssEditorialBrainInput): string {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({
      source: normalizeString(input.source, 120).toLowerCase(),
      url: normalizeString(input.url, 500),
      headline: normalizeString(input.headline, 500),
      summary: normalizeString(input.summary, 1500),
      bodyText: normalizeString(input.bodyText, 6000),
      extractedQuotes: normalizeList(input.extractedQuotes, 8),
      articleImages: normalizeList(input.articleImages, 12),
      imageEvidence: normalizeList(input.imageEvidence, 8),
    }))
    .digest('hex');
}

function buildDecisionHash(decision: RssEditorialBrainDecision): string {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(decision))
    .digest('hex');
}

function buildSystemPrompt(): string {
  return `You are RssEditorialBrain.

Your job is to interpret entertainment RSS articles for an automated publishing system.

You do not publish posts.
You do not write freeform explanations.
You return strict JSON only.

Your task is to read the full article payload and determine:
- the true subject of the article
- whether it belongs in the core publishing lane
- the correct canonical project or person
- the correct story family and event type
- whether the article is spoiler-sensitive
- what image strategy should be used
- what caption strategy should be used

Core rules:
1. Full-body understanding is required.
2. Reject wrapper canonicals.
3. Prefer the current project title over an older development title.
4. Route correctly using only the allowed lanes.
5. Route reviews, recaps, rankings, quizzes, what-to-watch, evergreen retrospectives, ratings reports, comics-only coverage, and non-target media-business coverage out of core.
6. Keep supported casting, renewals, trailers, first look, project announcements, tribute stories, person commentary on real projects, and early-stage cast-led project stories in core when warranted by evidence.
7. Spoiler-sensitive stories should be core_manual_review_spoiler, not auto-blocked if otherwise valid.
8. Image strategy must use one of the allowed modes.
9. Caption strategy must use one of the allowed modes and must reflect the real news.
10. Return only strict JSON matching the requested schema.`;
}

function buildUserPrompt(input: RssEditorialBrainInput): string {
  return `Interpret this entertainment RSS article and return ONLY valid JSON.

Current date/time: ${input.currentDateTime}
Source: ${input.source}
Source trust tier: ${input.sourceTrustTier}
URL: ${input.url}
Headline: ${input.headline}
Summary: ${input.summary || ''}
Evidence packet:
${(input.bodyText || '').slice(0, 6000)}

Extracted quotes:
${input.extractedQuotes.length > 0 ? input.extractedQuotes.map((quote) => `- ${quote}`).join('\n') : '- None'}

Article images:
${input.articleImages.length > 0 ? input.articleImages.map((image) => `- ${image}`).join('\n') : '- None'}

Image captions / alt text:
${input.imageEvidence && input.imageEvidence.length > 0 ? input.imageEvidence.map((entry) => `- ${entry}`).join('\n') : '- None'}

TMDb candidates:
${input.tmdbCandidates && input.tmdbCandidates.length > 0
    ? input.tmdbCandidates.map((candidate) => `- ${candidate.title} (${candidate.mediaType || 'unknown'})`).join('\n')
    : '- None'}

Return this exact JSON shape:
{
  "lane": "core_auto_publish | core_manual_review_spoiler | entertainment_adjacent | blocked_non_core | ignore_completely",
  "story_family": "project_news | casting | renewal | trailer | first_look | project_announcement | tribute | obituary | person_commentary_on_project | spoiler_sensitive | review | recap | editorial_feature | retrospective | comics_only | non_target_media_business",
  "primary_entity_type": "project | person | franchise | none",
  "primary_entity": "",
  "secondary_entities": [],
  "canonical_aliases": [],
  "current_title_over_development_title": true,
  "development_title_aliases": [],
  "format": "movie | tv | game | anime | comics | unknown",
  "event": "",
  "headline_trust": "high | medium | low",
  "body_recovery_required": true,
  "spoiler_risk": "none | low | medium | high",
  "manual_review_reason": "",
  "image_strategy": {
    "mode": "project_first | person_first | article_image_first | dual_person | dual_person_project | spoiler_safe_neutral",
    "primary_preference": [],
    "secondary_preference": [],
    "avoid": []
  },
  "caption_strategy": {
    "mode": "headline_news | person_commentary | tribute | obituary | first_look | trailer | spoiler_safe | project_announcement",
    "lead_subject": "",
    "must_name": [],
    "must_not_use": [],
    "must_not_spoil": true
  },
  "caption_facts": {
    "headline_fact": "",
    "supporting_fact": "",
    "quote": "",
    "bullets": []
  },
  "evidence": {
    "body_titles": [],
    "people": [],
    "projects": [],
    "networks_platforms": [],
    "years": [],
    "quotes": []
  },
  "confidence": 0.0,
  "notes": ""
}`;
}

export function computeRssEditorialBrainDisagreements(
  current: {
    lane: string;
    primary_entity: string;
    event: string;
    spoiler_risk: string;
    image_strategy: { mode: string };
    caption_strategy: { mode: string };
  },
  candidate: {
    lane: string;
    primary_entity: string;
    event: string;
    spoiler_risk: string;
    image_strategy: { mode: string };
    caption_strategy: { mode: string };
  },
): string[] {
  const disagreements: string[] = [];

  if (current.lane !== candidate.lane) disagreements.push('lane_disagreement');
  if (normalizeString(current.primary_entity, 160).toLowerCase() !== normalizeString(candidate.primary_entity, 160).toLowerCase()) disagreements.push('canonical_disagreement');
  if (normalizeString(current.event, 120).toLowerCase() !== normalizeString(candidate.event, 120).toLowerCase()) disagreements.push('event_disagreement');
  if (current.image_strategy.mode !== candidate.image_strategy.mode) disagreements.push('image_strategy_disagreement');
  if (current.caption_strategy.mode !== candidate.caption_strategy.mode) disagreements.push('caption_strategy_disagreement');
  if (current.spoiler_risk !== candidate.spoiler_risk) disagreements.push('spoiler_risk_disagreement');

  return disagreements;
}

export function normalizeRssEditorialBrainDecision(
  rawDecision: unknown,
  fallbackDecision: RssEditorialBrainDecision,
): { decision: RssEditorialBrainDecision; usedFallback: boolean; normalizationNotes: string[] } {
  const parsed = rssEditorialBrainDecisionSchema.safeParse(rawDecision);
  if (!parsed.success) {
    return {
      decision: normalizeDecision(fallbackDecision),
      usedFallback: true,
      normalizationNotes: [`schema_validation_failed:${parsed.error.issues.map((issue) => issue.path.join('.') || issue.code).join(',')}`],
    };
  }

  return {
    decision: normalizeDecision(parsed.data),
    usedFallback: false,
    normalizationNotes: [],
  };
}

export async function runRssEditorialBrain(
  input: RssEditorialBrainInput,
  options: {
    model?: string;
    enabled?: boolean;
    fallbackDecision: RssEditorialBrainDecision;
    disableReason?: string;
  },
): Promise<RssEditorialBrainResult> {
  const normalizedModel = normalizeAIModel(options.model || DEFAULT_RSS_EDITORIAL_BRAIN_MODEL, DEFAULT_RSS_EDITORIAL_BRAIN_MODEL);
  const contentHash = buildRssEditorialBrainContentHash(input);
  const fallbackDecision = normalizeDecision(options.fallbackDecision);

  if (!options.enabled) {
    return {
      decision: fallbackDecision,
      usedFallback: true,
      normalizationNotes: [options.disableReason || 'editorial_brain_disabled'],
      editorialBrainVersion: RSS_EDITORIAL_BRAIN_VERSION,
      promptVersion: RSS_EDITORIAL_BRAIN_PROMPT_VERSION,
      schemaVersion: RSS_EDITORIAL_BRAIN_SCHEMA_VERSION,
      contentHash,
      agentModel: normalizedModel,
      decisionHash: buildDecisionHash(fallbackDecision),
    };
  }

  const systemPrompt = buildSystemPrompt();
  const basePrompt = buildUserPrompt(input);
  let lastError = '';
  let rawResponse = '';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = attempt === 0
      ? basePrompt
      : `${basePrompt}\n\nPrevious attempt failed validation: ${lastError || 'invalid JSON or schema mismatch'}.\nReturn ONLY valid JSON that matches the schema exactly.`;

    const response = await generateCompletion({
      model: normalizedModel,
      prompt,
      systemPrompt,
      maxTokens: 1200,
      temperature: 0.1,
      jsonMode: true,
      webSearchUsageScope: 'rss',
    });

    if (!response.success) {
      lastError = response.error || 'completion_failed';
      continue;
    }

    rawResponse = response.content;

    try {
      const parsed = JSON.parse(response.content);
      const normalized = normalizeRssEditorialBrainDecision(parsed, fallbackDecision);
      if (!normalized.usedFallback) {
        return {
          decision: normalized.decision,
          rawResponse: response.content,
          usedFallback: false,
          normalizationNotes: normalized.normalizationNotes,
          editorialBrainVersion: RSS_EDITORIAL_BRAIN_VERSION,
          promptVersion: RSS_EDITORIAL_BRAIN_PROMPT_VERSION,
          schemaVersion: RSS_EDITORIAL_BRAIN_SCHEMA_VERSION,
          contentHash,
          agentModel: normalizedModel,
          decisionHash: buildDecisionHash(normalized.decision),
        };
      }
      lastError = normalized.normalizationNotes.join(';') || 'schema_validation_failed';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'json_parse_failed';
    }
  }

  return {
    decision: fallbackDecision,
    rawResponse,
    usedFallback: true,
    normalizationNotes: [lastError || 'editorial_brain_retry_exhausted'],
    error: lastError || 'editorial_brain_retry_exhausted',
    editorialBrainVersion: RSS_EDITORIAL_BRAIN_VERSION,
    promptVersion: RSS_EDITORIAL_BRAIN_PROMPT_VERSION,
    schemaVersion: RSS_EDITORIAL_BRAIN_SCHEMA_VERSION,
    contentHash,
    agentModel: normalizedModel,
    decisionHash: buildDecisionHash(fallbackDecision),
  };
}

export const __rssEditorialBrainTestUtils = {
  rssEditorialBrainDecisionSchema,
  extractRssEditorialBrainSignals,
  buildRssEditorialBrainContentHash,
  computeRssEditorialBrainDisagreements,
  normalizeRssEditorialBrainDecision,
  normalizeRssEditorialBrainEvent,
};
