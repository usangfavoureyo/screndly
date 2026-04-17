export type RssAuditEntityType = 'movie' | 'tv' | 'person' | 'company' | 'franchise' | 'other';
export type RssAuditScope = 'screenrender_core' | 'entertainment_adjacent' | 'not_screenrender_core';

export type RssAuditFailureCode =
  | 'ENTITY_NOT_RESOLVED'
  | 'ENTITY_WRONG_PROJECT'
  | 'ENTITY_WRONG_PERSON'
  | 'ENTITY_WRONG_COMPANY'
  | 'ENTITY_PROJECT_PERSON_PRIORITY_ERROR'
  | 'IMAGE_NOT_FOUND'
  | 'IMAGE_CANONICAL_ENTITY_MISMATCH'
  | 'IMAGE_LOGO_OVERUSE'
  | 'IMAGE_SECONDARY_SLOT_CONTAMINATED'
  | 'IMAGE_TMBD_CANDIDATE_ZERO_TOKEN_OVERLAP'
  | 'IMAGE_FOUND_BUT_REJECTED_BY_POLICY'
  | 'IMAGE_COMPANY_LOGO_MISUSED'
  | 'CAPTION_BROKEN_QUOTE'
  | 'CAPTION_HTML_ENTITY_LEAK'
  | 'CAPTION_ARTICLE_COPY_LEAK'
  | 'CAPTION_CANONICAL_ENTITY_MISMATCH'
  | 'CAPTION_MALFORMED_HEADLINE'
  | 'CAPTION_PACKAGE_LABEL_LEAK'
  | 'PUBLISH_SHOULD_HAVE_BLOCKED'
  | 'PUBLISH_SHOULD_HAVE_PASSED'
  | 'PUBLISH_GATE_LEAK'
  | 'DUPLICATE_EVENT_NOT_DETECTED'
  | 'DUPLICATE_FALSE_POSITIVE'
  | string;

export type RssAuditFeedConfig = {
  name: string;
  url: string;
};

export type RssAuditCase = {
  sourceName: string;
  feedUrl: string;
  articleUrl: string;
  articleTitle: string;
  articleDescription?: string;
  articleBody?: string;
  publishedAt?: string;
};

export type RssAuditTmdbCandidate = {
  title: string;
  mediaType?: string;
  score?: number;
  accepted: boolean;
  rejectionReasons: string[];
};

export type RssAuditImageDecision = {
  mode?: 'single' | 'dual' | 'ensemble' | 'none';
  primarySubject?: string;
  secondarySubject?: string;
  selectedSource?: string;
  tmdbTitleResolved?: string;
  assetsFound?: {
    backdrops?: number;
    posters?: number;
    logos?: number;
    profiles?: number;
  };
  assetsAccepted?: number;
  fallbackStageReached?: string;
  finalFailureStage?: string;
  selectedImages: Array<{
    role: 'primary' | 'secondary';
    label?: string;
    source?: string;
    subject?: string;
    accepted: boolean;
    rejectionReasons: string[];
  }>;
  tmdbQueries: string[];
  tmdbCandidates: RssAuditTmdbCandidate[];
  failureCodes: RssAuditFailureCode[];
};

export type RssAuditCaptionDecision = {
  generatedCaption?: string;
  normalizedCaption?: string;
  failureCodes: RssAuditFailureCode[];
  hardInvalidReasons: string[];
  rebuildUsed: boolean;
};

export type RssAuditEntityDecision = {
  canonicalEntity?: string;
  canonicalEntityType?: RssAuditEntityType;
  eventType?: string;
  confidence?: number;
  ambiguityFlags: string[];
};

export type RssAuditEditorialBrainDecision = {
  lane: string;
  primaryEntity?: string;
  storyFamily?: string;
  event?: string;
  imageStrategy?: string;
  captionStrategy?: string;
  confidence?: number;
  contentHash?: string;
  usedFallback?: boolean;
  disagreements?: string[];
};

export type RssAuditResult = {
  caseId: string;
  input: RssAuditCase;
  scope: RssAuditScope;
  normalizedTitle: string;
  normalizedDescription?: string;
  entity: RssAuditEntityDecision;
  editorialBrain?: RssAuditEditorialBrainDecision;
  image: RssAuditImageDecision;
  caption: RssAuditCaptionDecision;
  publishBlocked: boolean;
  publishFailureCodes: RssAuditFailureCode[];
  diagnosis: string[];
  recommendedFixes: string[];
};

export type RssAuditDuplicateGroup = {
  signature: string;
  duplicateEventKey: string;
  count: number;
  sources: string[];
  winningSource?: string;
  suppressedSources: string[];
  articles: Array<{
    caseId: string;
    sourceName: string;
    articleTitle: string;
    articleUrl: string;
    canonicalEntity?: string;
    eventType?: string;
  }>;
};

export type RssAuditReport = {
  generatedAt: string;
  totalArticles: number;
  publishPasses: number;
  publishBlocks: number;
  topFailureCodes: Array<{ code: string; count: number }>;
  failureCodesBySource: Record<string, Array<{ code: string; count: number }>>;
  failureCodesByEventType: Record<string, Array<{ code: string; count: number }>>;
  scopeCounts: Array<{ scope: RssAuditScope; count: number }>;
  failureCodesByScope: Record<RssAuditScope, Array<{ code: string; count: number }>>;
  repeatedBadTmdbMatches: Array<{ title: string; count: number; sources: string[] }>;
  duplicateGroups: RssAuditDuplicateGroup[];
  recommendedPatches: Array<{
    recommendation: string;
    count: number;
    failureCodes: string[];
    likelyFiles: string[];
    exampleCaseIds: string[];
  }>;
};
