import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RssAuditCase, RssAuditFeedConfig, RssAuditReport, RssAuditResult } from './rss-audit-types';

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readFeedConfig(filePath: string): Promise<RssAuditFeedConfig[]> {
  const feeds = await readJsonFile<RssAuditFeedConfig[]>(filePath);
  return feeds.filter((feed) => feed.name?.trim() && feed.url?.trim());
}

export async function writeAuditCases(filePath: string, cases: RssAuditCase[]): Promise<void> {
  await writeJsonFile(filePath, cases);
}

export async function writeAuditResults(filePath: string, results: RssAuditResult[]): Promise<void> {
  await writeJsonFile(filePath, results);
}

export async function readAuditResults(filePath: string): Promise<RssAuditResult[]> {
  return readJsonFile<RssAuditResult[]>(filePath);
}

export async function writeMarkdownReport(filePath: string, markdown: string): Promise<void> {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
}

export async function writeCsvReport(filePath: string, rows: string): Promise<void> {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, rows.endsWith('\n') ? rows : `${rows}\n`, 'utf8');
}

export async function writeAuditReportJson(filePath: string, report: RssAuditReport): Promise<void> {
  await writeJsonFile(filePath, report);
}
