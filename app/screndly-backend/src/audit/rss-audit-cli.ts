import path from 'node:path';
import { buildRssAuditReport, renderCsvReport, renderMarkdownReport } from './rss-audit-report';
import { runRssAudit } from './rss-audit-runner';
import {
  readAuditResults,
  readFeedConfig,
  writeAuditReportJson,
  writeCsvReport,
  writeMarkdownReport,
} from './rss-audit-storage';
import type { RssAuditScope } from './rss-audit-types';

type CliArgs = Record<string, string | boolean>;

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function stringArg(args: CliArgs, key: string, fallback: string): string {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberArg(args: CliArgs, key: string, fallback?: number): number | undefined {
  const value = args[key];
  if (typeof value !== 'string') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanArg(args: CliArgs, key: string, fallback = false): boolean {
  const value = args[key];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return fallback;
}

function sourcesArg(args: CliArgs): string[] | undefined {
  const value = args.sources;
  return typeof value === 'string' && value.trim()
    ? value.split(',').map((source) => source.trim()).filter(Boolean)
    : undefined;
}

function captionModeArg(args: CliArgs): 'live' | 'deterministic' {
  return args['caption-mode'] === 'deterministic' ? 'deterministic' : 'live';
}

function editorialBrainModeArg(args: CliArgs): 'off' | 'shadow' {
  return args['editorial-brain-mode'] === 'shadow' ? 'shadow' : 'off';
}

function scopeArg(args: CliArgs): RssAuditScope | undefined {
  const value = args.scope;
  if (
    value === 'screenrender_core' ||
    value === 'entertainment_adjacent' ||
    value === 'not_screenrender_core'
  ) {
    return value;
  }
  return undefined;
}

function siblingPath(filePath: string, suffix: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir || '.', `${parsed.name}${suffix}`);
}

async function runAuditCommand(args: CliArgs): Promise<void> {
  const feedsPath = stringArg(args, 'feeds', './audit-feeds.json');
  const out = stringArg(args, 'out', './tmp/rss-audit-results.json');
  const feeds = await readFeedConfig(feedsPath);
  const selectedSources = sourcesArg(args);

  console.log(`[RSS Audit] Loaded ${feeds.length} feed config entries from ${feedsPath}`);
  if (selectedSources?.length) {
    console.log(`[RSS Audit] Source filter: ${selectedSources.join(', ')}`);
  }

  await runRssAudit(feeds, {
    perSource: numberArg(args, 'per-source', 200),
    maxTotal: numberArg(args, 'max-total'),
    sources: selectedSources,
    out,
    casesOut: stringArg(args, 'cases-out', './tmp/rss-audit-cases.json'),
    bodyFetch: booleanArg(args, 'body-fetch', false),
    imageLimit: numberArg(args, 'image-limit', 2),
    casesInput: typeof args['cases-input'] === 'string' ? args['cases-input'] : undefined,
    captionMode: captionModeArg(args),
    editorialBrainMode: editorialBrainModeArg(args),
  });

  console.log(`[RSS Audit] Results saved to ${out}`);
}

async function runReportCommand(args: CliArgs): Promise<void> {
  const input = stringArg(args, 'input', './tmp/rss-audit-results.json');
  const output = stringArg(args, 'output', './tmp/rss-audit-report.md');
  const jsonOutput = stringArg(args, 'json-output', siblingPath(output, '.json'));
  const csvOutput = stringArg(args, 'csv-output', siblingPath(output, '.csv'));
  const selectedScope = scopeArg(args);
  const allResults = await readAuditResults(input);
  const results = selectedScope
    ? allResults.filter((result) => result.scope === selectedScope)
    : allResults;
  const report = buildRssAuditReport(results);

  await writeMarkdownReport(output, renderMarkdownReport(report));
  await writeAuditReportJson(jsonOutput, report);
  await writeCsvReport(csvOutput, renderCsvReport(results));

  console.log(`[RSS Audit] Read ${allResults.length} audit results from ${input}`);
  if (selectedScope) {
    console.log(`[RSS Audit] Scope filter: ${selectedScope} (${results.length} results)`);
  }
  console.log(`[RSS Audit] Markdown report saved to ${output}`);
  console.log(`[RSS Audit] JSON report saved to ${jsonOutput}`);
  console.log(`[RSS Audit] CSV report saved to ${csvOutput}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = process.env.RSS_AUDIT_CLI_MODE || stringArg(args, 'mode', 'run');

  if (command === 'report') {
    await runReportCommand(args);
    return;
  }

  await runAuditCommand(args);
}

main().catch((error) => {
  console.error('[RSS Audit] Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
