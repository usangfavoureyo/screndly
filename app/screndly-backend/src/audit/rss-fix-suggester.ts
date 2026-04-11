export type RssAuditFixRule = {
  codes: string[];
  recommendation: string;
  diagnosis?: string;
  likelyFiles: string[];
};

export const RSS_AUDIT_FIX_RULES: RssAuditFixRule[] = [
  {
    codes: ['ENTITY_NOT_RESOLVED'],
    diagnosis: 'No reliable canonical entity was resolved from the article.',
    recommendation: 'Tighten canonical entity extraction before image or caption generation.',
    likelyFiles: ['src/services/rss.service.ts', 'src/services/ai.service.ts'],
  },
  {
    codes: ['ENTITY_NOT_RESOLVED_SHOULD_HAVE_RESOLVED'],
    diagnosis: 'A project/person signal was present, but canonical extraction still ended unresolved.',
    recommendation: 'Inspect the unresolved case and add a narrow extractor for the repeated headline/body pattern.',
    likelyFiles: ['src/services/rss.service.ts', 'src/services/ai.service.ts'],
  },
  {
    codes: ['IMAGE_NOT_FOUND_FALSE_BLOCK'],
    diagnosis: 'The article had a likely project/person signal but no image was resolved.',
    recommendation: 'Add a recovery path for valid TMDb assets once canonical extraction is reliable.',
    likelyFiles: ['src/services/rss-image-selection.service.ts', 'src/services/rss-tmdb-image-selection.service.ts'],
  },
  {
    codes: ['IMAGE_TMBD_CANDIDATE_ZERO_TOKEN_OVERLAP'],
    diagnosis: 'TMDb selected title had zero canonical token overlap with the article entity.',
    recommendation: 'Add canonical token overlap gating before accepting TMDb title candidates.',
    likelyFiles: ['src/services/rss-tmdb-image-selection.service.ts', 'src/services/rss-image-selection.service.ts'],
  },
  {
    codes: ['IMAGE_COMPANY_LOGO_MISUSED', 'IMAGE_LOGO_OVERUSE'],
    diagnosis: 'A logo-like asset was selected for a story that should prefer a project or person image.',
    recommendation: 'Block company logos as primary images when a project or person entity exists.',
    likelyFiles: ['src/services/rss-image-selection.service.ts', 'src/services/rss-tmdb-image-selection.service.ts'],
  },
  {
    codes: ['IMAGE_CANONICAL_ENTITY_MISMATCH'],
    diagnosis: 'Selected image context did not match the canonical article entity.',
    recommendation: 'Require selected images to be grounded in canonical allowed entities.',
    likelyFiles: ['src/services/rss.service.ts', 'src/services/rss-image-selection.service.ts'],
  },
  {
    codes: ['IMAGE_NOT_FOUND'],
    diagnosis: 'No publishable image was found by the offline image resolver.',
    recommendation: 'Improve fallback policy for feed images only when they are explicitly project-linked and renderable.',
    likelyFiles: ['src/services/rss-image-selection.service.ts'],
  },
  {
    codes: ['CAPTION_HTML_ENTITY_LEAK'],
    diagnosis: 'Caption leaked an HTML entity into final text.',
    recommendation: 'Normalize HTML entities before quote validation and final caption validation.',
    likelyFiles: ['src/services/ai.service.ts', 'src/services/rss.service.ts'],
  },
  {
    codes: ['CAPTION_BROKEN_QUOTE'],
    diagnosis: 'Caption contained an incomplete or malformed quote fragment.',
    recommendation: 'Reject broken quote fragments before captions can pass final validation.',
    likelyFiles: ['src/services/ai.service.ts'],
  },
  {
    codes: ['CAPTION_ARTICLE_COPY_LEAK'],
    diagnosis: 'Caption leaked raw article copy or truncated snippet markers.',
    recommendation: 'Rebuild failed captions from structured facts only instead of article snippets.',
    likelyFiles: ['src/services/ai.service.ts'],
  },
  {
    codes: ['CAPTION_CANONICAL_ENTITY_MISMATCH'],
    diagnosis: 'Caption headline did not stay anchored to the resolved canonical entity.',
    recommendation: 'Validate caption headline entity against canonical media title and allowed entities.',
    likelyFiles: ['src/services/ai.service.ts', 'src/services/rss.service.ts'],
  },
  {
    codes: ['CAPTION_MALFORMED_HEADLINE', 'CAPTION_PACKAGE_LABEL_LEAK'],
    diagnosis: 'Caption retained malformed headline/package wording.',
    recommendation: 'Strip outlet package labels before deterministic caption generation.',
    likelyFiles: ['src/services/ai.service.ts'],
  },
  {
    codes: ['DUPLICATE_EVENT_NOT_DETECTED'],
    diagnosis: 'Likely duplicate stories were not clustered by the event fingerprint.',
    recommendation: 'Expand duplicate event signatures with project, event type, named people, and platform/studio tokens.',
    likelyFiles: ['src/services/rss.service.ts'],
  },
];

export function findRssAuditFixRules(codes: Iterable<string>): RssAuditFixRule[] {
  const codeSet = new Set(codes);
  return RSS_AUDIT_FIX_RULES.filter((rule) => rule.codes.some((code) => codeSet.has(code)));
}
