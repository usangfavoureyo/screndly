import type { ComposePlatformKey } from '../types/compose';
import type { PadTemplate } from '../types/pad';

export const CREATE_TAB_STORAGE_KEY = 'screndlyCreateActiveTab';

export const CREATE_TABS = [
  { id: 'pad', label: 'PAD' },
  { id: 'compose', label: 'Compose' },
] as const;

export type CreateTabId = (typeof CREATE_TABS)[number]['id'];

export const COMPOSE_PLATFORM_OPTIONS: Array<{
  id: ComposePlatformKey;
  label: string;
  connectionKey: 'Instagram' | 'Facebook' | 'TikTok' | 'Threads' | 'X' | 'YouTube' | 'Pinterest';
  helper: string;
}> = [
  { id: 'instagram', label: 'Instagram', connectionKey: 'Instagram', helper: 'Photo and carousel publishing' },
  { id: 'facebook', label: 'Facebook', connectionKey: 'Facebook', helper: 'Feed post and page publishing' },
  { id: 'tiktok', label: 'TikTok', connectionKey: 'TikTok', helper: 'Video-first publishing' },
  { id: 'threads', label: 'Threads', connectionKey: 'Threads', helper: 'Short-form text publishing' },
  { id: 'x', label: 'X', connectionKey: 'X', helper: 'Short updates and links' },
  { id: 'youtube', label: 'YouTube', connectionKey: 'YouTube', helper: 'Video publishing with playlist metadata' },
  { id: 'pinterest', label: 'Pinterest', connectionKey: 'Pinterest', helper: 'Pin publishing with board selection' },
];

export const PAD_TEMPLATES: PadTemplate[] = [
  {
    id: 'movie-review',
    name: 'Movie Review',
    description: 'Structured review copy for a film release or trailer.',
    promptHint: 'Paste the title, tone, key observations, and the audience you are writing for.',
    emptyState: 'No movie review sessions yet.',
  },
  {
    id: 'tv-review',
    name: 'TV Review',
    description: 'Episode, season, or show review draft with a sharp critical angle.',
    promptHint: 'Describe the series, episode focus, standout moments, and spoiler preference.',
    emptyState: 'No TV review sessions yet.',
  },
  {
    id: 'upcoming-releases',
    name: 'Upcoming Releases',
    description: 'Preview copy for release calendars, watchlists, and roundups.',
    promptHint: 'List the titles, release window, and the tone for the roundup.',
    emptyState: 'No upcoming releases sessions yet.',
  },
  {
    id: 'caption-writer',
    name: 'Caption Writer',
    description: 'Social caption drafting with a clear hook and CTA.',
    promptHint: 'Describe the post, target platform, and the tone you want to hit.',
    emptyState: 'No caption writing sessions yet.',
  },
  {
    id: 'cta-writer',
    name: 'CTA Writer',
    description: 'Focused calls-to-action for campaigns and content pushes.',
    promptHint: 'Explain the desired action, urgency, and audience.',
    emptyState: 'No CTA writing sessions yet.',
  },
  {
    id: 'rewrite-expand-shorten',
    name: 'Rewrite / Expand / Shorten',
    description: 'Refine existing copy without losing the original intent.',
    promptHint: 'Paste the original text and explain whether to rewrite, expand, or shorten it.',
    emptyState: 'No rewrite sessions yet.',
  },
];
