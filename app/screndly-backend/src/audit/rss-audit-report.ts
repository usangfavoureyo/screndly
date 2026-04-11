import { __rssAuditTestUtils } from '../services/rss.service';
import type { RssAuditDuplicateGroup, RssAuditReport, RssAuditResult } from './rss-audit-types';
import { RSS_AUDIT_FIX_RULES } from './rss-fix-suggester';

type Counter = Map<string, number>;

function increment(counter: Counter, key: string, amount = 1): void {
  counter.set(key, (counter.get(key) || 0) + amount);
}

function sortedCounts(counter: Counter): Array<{ code: string; count: number }> {
  return [...counter.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([code, count]) => ({ code, count }));
}

function allFailureCodes(result: RssAuditResult): string[] {
  return Array.from(new Set([
    ...result.image.failureCodes,
    ...result.caption.failureCodes,
    ...result.publishFailureCodes,
  ]));
}

function duplicateFingerprint(result: RssAuditResult): any {
  const canonicalEntityType = result.entity.canonicalEntityType === 'other'
    ? 'unknown'
    : result.entity.canonicalEntityType;
  return __rssAuditTestUtils.buildRSSNewsEventFingerprint({
    title: result.input.articleTitle,
    description: result.input.articleDescription || '',
    contentHtml: result.input.articleBody || '',
    link: result.input.articleUrl,
    pubDate: result.input.publishedAt ? new Date(result.input.publishedAt) : new Date(),
    imageUrls: [],
    canonicalEntity: {
      primarySubject: result.entity.canonicalEntity,
      mediaTitle: result.entity.canonicalEntity,
      entityType: canonicalEntityType,
      eventType: result.entity.eventType,
    },
  });
}

function duplicateSignature(result: RssAuditResult, fingerprint: any): string {
  return fingerprint.signature || [
    result.entity.canonicalEntity,
    result.entity.eventType,
    result.normalizedTitle,
  ].filter(Boolean).join('|').toLowerCase();
}

export function buildDuplicateGroups(results: RssAuditResult[]): RssAuditDuplicateGroup[] {
  const seededGroups: Array<{ fingerprint: any; group: RssAuditDuplicateGroup }> = [];

  for (const result of results) {
    const fingerprint = duplicateFingerprint(result);
    const signature = duplicateSignature(result, fingerprint);
    if (!signature) {
      continue;
    }
    const matched = seededGroups.find((entry) =>
      entry.group.signature === signature || __rssAuditTestUtils.areRSSNewsEventsSimilar(fingerprint, entry.fingerprint)
    );
    const existing = matched?.group || {
      signature,
      duplicateEventKey: signature,
      count: 0,
      sources: [],
      winningSource: undefined,
      suppressedSources: [],
      articles: [],
    };
    existing.count += 1;
    existing.sources = Array.from(new Set([...existing.sources, result.input.sourceName]));
    existing.articles.push({
      caseId: result.caseId,
      sourceName: result.input.sourceName,
      articleTitle: result.input.articleTitle,
      articleUrl: result.input.articleUrl,
      canonicalEntity: result.entity.canonicalEntity,
      eventType: result.entity.eventType,
    });
    if (!matched) {
      seededGroups.push({ fingerprint, group: existing });
    }
  }

  return seededGroups.map((entry) => entry.group)
    .filter((group) => group.count > 1 && group.sources.length > 1)
    .map((group) => {
      const rankedArticles = [...group.articles].sort((left, right) =>
        __rssAuditTestUtils.getRSSSourcePriority(left.sourceName) - __rssAuditTestUtils.getRSSSourcePriority(right.sourceName)
        || left.sourceName.localeCompare(right.sourceName)
        || left.articleTitle.localeCompare(right.articleTitle)
      );
      const winningSource = rankedArticles[0]?.sourceName;
      return {
        ...group,
        winningSource,
        suppressedSources: Array.from(new Set(
          rankedArticles
            .slice(winningSource ? 1 : 0)
            .map((article) => article.sourceName)
        )),
      };
    })
    .sort((left, right) => right.count - left.count || left.signature.localeCompare(right.signature));
}

export function buildRssAuditReport(results: RssAuditResult[]): RssAuditReport {
  const topFailureCounter: Counter = new Map();
  const sourceCounters = new Map<string, Counter>();
  const eventCounters = new Map<string, Counter>();
  const scopeCounter: Counter = new Map();
  const scopeCounters = new Map<string, Counter>();
  const badTmdbMatches = new Map<string, { count: number; sources: Set<string> }>();
  const fixCounters = new Map<string, { count: number; codes: Set<string>; files: Set<string>; examples: string[] }>();

  for (const result of results) {
    const codes = allFailureCodes(result);
    const sourceCounter = sourceCounters.get(result.input.sourceName) || new Map();
    const eventType = result.entity.eventType || 'unknown';
    const eventCounter = eventCounters.get(eventType) || new Map();
    const scope = result.scope || 'entertainment_adjacent';
    const perScopeCounter = scopeCounters.get(scope) || new Map();
    increment(scopeCounter, scope);

    for (const code of codes) {
      increment(topFailureCounter, code);
      increment(sourceCounter, code);
      increment(eventCounter, code);
      increment(perScopeCounter, code);
    }
    sourceCounters.set(result.input.sourceName, sourceCounter);
    eventCounters.set(eventType, eventCounter);
    scopeCounters.set(scope, perScopeCounter);

    for (const candidate of result.image.tmdbCandidates) {
      if (candidate.accepted || candidate.rejectionReasons.length === 0) {
        continue;
      }
      const entry = badTmdbMatches.get(candidate.title) || { count: 0, sources: new Set<string>() };
      entry.count += 1;
      entry.sources.add(result.input.sourceName);
      badTmdbMatches.set(candidate.title, entry);
    }

    for (const rule of RSS_AUDIT_FIX_RULES) {
      const matched = rule.codes.filter((code) => codes.includes(code));
      if (matched.length === 0) {
        continue;
      }
      const entry = fixCounters.get(rule.recommendation) || {
        count: 0,
        codes: new Set<string>(),
        files: new Set<string>(),
        examples: [],
      };
      entry.count += 1;
      matched.forEach((code) => entry.codes.add(code));
      rule.likelyFiles.forEach((file) => entry.files.add(file));
      if (entry.examples.length < 5) {
        entry.examples.push(result.caseId);
      }
      fixCounters.set(rule.recommendation, entry);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalArticles: results.length,
    publishPasses: results.filter((result) => !result.publishBlocked).length,
    publishBlocks: results.filter((result) => result.publishBlocked).length,
    topFailureCodes: sortedCounts(topFailureCounter),
    failureCodesBySource: Object.fromEntries(
      [...sourceCounters.entries()].map(([source, counter]) => [source, sortedCounts(counter)])
    ),
    failureCodesByEventType: Object.fromEntries(
      [...eventCounters.entries()].map(([eventType, counter]) => [eventType, sortedCounts(counter)])
    ),
    scopeCounts: [...scopeCounter.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([scope, count]) => ({ scope: scope as any, count })),
    failureCodesByScope: Object.fromEntries(
      [...scopeCounters.entries()].map(([scope, counter]) => [scope, sortedCounts(counter)])
    ) as any,
    repeatedBadTmdbMatches: [...badTmdbMatches.entries()]
      .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
      .map(([title, value]) => ({
        title,
        count: value.count,
        sources: [...value.sources].sort(),
      })),
    duplicateGroups: buildDuplicateGroups(results),
    recommendedPatches: [...fixCounters.entries()]
      .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
      .map(([recommendation, value]) => ({
        recommendation,
        count: value.count,
        failureCodes: [...value.codes].sort(),
        likelyFiles: [...value.files].sort(),
        exampleCaseIds: value.examples,
      })),
  };
}

export function renderMarkdownReport(report: RssAuditReport): string {
  const lines: string[] = [
    '# RSS Audit Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Total articles scanned: ${report.totalArticles}`,
    `Publish passes: ${report.publishPasses}`,
    `Publish blocks: ${report.publishBlocks}`,
    '',
    '## Top Failure Codes',
    '',
    ...renderCountList(report.topFailureCodes),
    '',
    '## Failure Codes By Source',
    '',
  ];

  for (const [source, counts] of Object.entries(report.failureCodesBySource)) {
    lines.push(`### ${source}`, ...renderCountList(counts), '');
  }

  lines.push('## Failure Codes By Event Type', '');
  for (const [eventType, counts] of Object.entries(report.failureCodesByEventType)) {
    lines.push(`### ${eventType}`, ...renderCountList(counts), '');
  }

  lines.push('## Screen Render Scope Split', '', ...report.scopeCounts.map((entry) => `- ${entry.scope}: ${entry.count}`), '');
  lines.push('## Failure Codes By Scope', '');
  for (const [scope, counts] of Object.entries(report.failureCodesByScope)) {
    lines.push(`### ${scope}`, ...renderCountList(counts), '');
  }

  lines.push('## Repeated Bad TMDb Matches', '', ...renderBadTmdbMatches(report), '');
  lines.push('## Duplicate Story Candidates', '', ...renderDuplicateGroups(report), '');
  lines.push('## Ranked Patch Recommendations', '', ...renderPatchRecommendations(report), '');

  return lines.join('\n');
}

function renderCountList(counts: Array<{ code: string; count: number }>): string[] {
  if (counts.length === 0) {
    return ['- None'];
  }
  return counts.map((entry) => `- ${entry.code}: ${entry.count}`);
}

function renderBadTmdbMatches(report: RssAuditReport): string[] {
  if (report.repeatedBadTmdbMatches.length === 0) {
    return ['- None'];
  }
  return report.repeatedBadTmdbMatches
    .slice(0, 25)
    .map((entry) => `- ${entry.title}: ${entry.count} (${entry.sources.join(', ')})`);
}

function renderDuplicateGroups(report: RssAuditReport): string[] {
  if (report.duplicateGroups.length === 0) {
    return ['- None'];
  }
  return report.duplicateGroups.slice(0, 25).map((group) => {
    const titles = group.articles.slice(0, 3).map((article) => `${article.sourceName}: ${article.articleTitle}`).join(' | ');
    const winner = group.winningSource ? ` Winner: ${group.winningSource}.` : '';
    const suppressed = group.suppressedSources.length > 0
      ? ` Suppressed: ${group.suppressedSources.join(', ')}.`
      : '';
    return `- ${group.duplicateEventKey} -> ${group.count} articles across ${group.sources.join(', ')}.${winner}${suppressed} ${titles}`;
  });
}

function renderPatchRecommendations(report: RssAuditReport): string[] {
  if (report.recommendedPatches.length === 0) {
    return ['- None'];
  }
  return report.recommendedPatches.map((patch) =>
    `- ${patch.recommendation} Occurrences: ${patch.count}. Codes: ${patch.failureCodes.join(', ')}. Files: ${patch.likelyFiles.join(', ')}. Examples: ${patch.exampleCaseIds.join(', ')}.`
  );
}

export function renderCsvReport(results: RssAuditResult[]): string {
  const rows = [
    [
      'caseId',
      'sourceName',
      'articleTitle',
      'articleUrl',
      'scope',
      'canonicalEntity',
      'entityType',
      'eventType',
      'publishBlocked',
      'failureCodes',
      'recommendedFixes',
    ],
    ...results.map((result) => [
      result.caseId,
      result.input.sourceName,
      result.input.articleTitle,
      result.input.articleUrl,
      result.scope,
      result.entity.canonicalEntity || '',
      result.entity.canonicalEntityType || '',
      result.entity.eventType || '',
      String(result.publishBlocked),
      allFailureCodes(result).join('|'),
      result.recommendedFixes.join('|'),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
