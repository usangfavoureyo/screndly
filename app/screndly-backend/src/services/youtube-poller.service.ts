import prisma from '../lib/prisma';
import Parser from 'rss-parser';
import ytdl from '@distube/ytdl-core';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import {
    describeYtDlpAuthConfiguration,
    getYtDlpAuthOptions,
    hasYtDlpAuthConfiguration,
    type YtDlpOptions,
} from '../lib/yt-dlp';
import ytDlp from '../lib/yt-dlp';
import { publisherService, PublishContent } from './publisher.service';
import aiService from './ai.service';
import { shouldEnableReleaseResearch } from './ai.service';
import { notificationService } from './notification.service';
import { hasFeedItemStatusColumn } from '../lib/feedItemStatus';
import { resolveYouTubeChannel } from './youtube-channel-resolver';
import {
    type EnrichedVideoMetadata,
    enrichYouTubeVideoMetadata,
    generateLandscapeThumbnail,
    generateSocialPosterThumbnail,
    generateYouTubePublishMetadata,
    getYouTubeRuntimeSettings,
    type LoadedVideoSettings,
    type PlatformThumbnailAsset,
} from './video-enrichment.service';
import { youtubePoTokenService } from './youtube-po-token.service';
import { decideYouTubeCandidate } from './youtube-detection/decisionEngine';
import { checkPromoDuplicate, recordAcceptedPromoFingerprint, recordDuplicateRelationship } from './youtube-detection/deduplicationEngine';
import { parsePromoAssetType } from './youtube-detection/promoAssetParsing';
import type { PollingCandidate } from './youtube-detection/types';
import { extractCollaboratorMetadata, isExplicitCollaboratorForTrackedChannel } from './youtube-detection/collabDiscovery';

const parser = new Parser();

interface PollOptions {
    force?: boolean;
    channelDbId?: string;
}

interface ChannelPollResult {
    channelId: string;
    channelName: string;
    checked: boolean;
    skipped: boolean;
    newVideoDetected: boolean;
    published: boolean;
    failed: boolean;
    message: string;
}

export interface PollSummary {
    startedAt: string;
    finishedAt: string;
    channelsChecked: number;
    channelsSkipped: number;
    newVideosDetected: number;
    successfulPublishes: number;
    failedPublishes: number;
    results: ChannelPollResult[];
}

export interface ChannelDiscoveryPreviewItem {
    videoId: string;
    title: string;
    publishedAt?: string;
    discoveredVia: 'owned_upload' | 'collab_association';
    detectedViaChannelName?: string;
    primaryChannelName?: string;
    collaboratorChannelNames: string[];
    isCollaborativePost: boolean;
    keywordMatched: boolean;
    decisionPath?: string;
    allow?: boolean;
    reasonSummary?: string;
}

interface PlatformAutomationSettings {
    autoPost?: boolean;
    autoThumbnail?: boolean;
    autoCaption?: boolean;
    autoHashtag?: boolean;
}

interface GeneratedCaptions {
    generated?: string;
    fallback: string;
    pinterestTitle?: string;
    pinterestDescription?: string;
}

interface VideoValidationDecision {
    allow: boolean;
    reason?: string;
    classification?: string;
}

interface NormalizedVideoFormat {
    width?: number;
    height?: number;
    hasVideo?: boolean;
    hasAudio?: boolean;
    vcodec?: string;
    acodec?: string;
}

interface NormalizedVideoDetails {
    videoId: string;
    video_url: string;
    description: string;
    lengthSeconds: string;
    thumbnails: Array<{ url?: string }>;
    keywords?: string[];
}

interface NormalizedVideoInfo {
    source: 'ytdl' | 'yt-dlp';
    raw?: any;
    videoDetails: NormalizedVideoDetails;
    formats: NormalizedVideoFormat[];
}

interface ProbedDownloadedVideo {
    width?: number;
    height?: number;
    durationSeconds?: number;
}

type FeedItemStatus = 'accepted' | 'ignored' | 'failed';

interface FeedVideoProcessingResult {
    kind: 'continue' | 'return';
    reason?: string;
    result?: ChannelPollResult;
    incrementVideoCount?: boolean;
    sawFreshVideo?: boolean;
    stopScanning?: boolean;
}

interface ChannelVideoSourceResult {
    items: any[];
    source: 'rss' | 'yt-dlp' | 'merged';
}

const PLATFORM_SETTING_KEYS: Record<string, string> = {
    X: 'x',
    Facebook: 'facebook',
    Instagram: 'instagram',
    Threads: 'threads',
    TikTok: 'tiktok',
    YouTube: 'youtube',
    Pinterest: 'pinterest',
};

const SOCIAL_THUMBNAIL_PLATFORMS = new Set(['Facebook', 'Instagram', 'Threads', 'Pinterest']);
const MAX_RECENT_FEED_ITEMS = 15;
const MAX_COLLAB_SEARCH_RESULTS_PER_KEYWORD = 3;
const DEBUG_COLLAB_CHANNEL_NAMES = new Set(['hbo max']);
const FEED_FRESHNESS_HOURS = 24;
const MIN_TRAILER_HEIGHT = 1080;
const MIN_TRAILER_WIDTH = 1920;
const DEFAULT_TRAILER_KEYWORDS = ['trailer', 'teaser', 'official', 'first look', 'sneak peek'];
const NON_STANDALONE_TRAILER_KEYWORDS = new Set(['official']);
const YOUTUBE_INFO_OPTIONS = {
    playerClients: ['WEB', 'WEB_EMBEDDED', 'TV', 'IOS', 'ANDROID'] as Array<'WEB' | 'WEB_EMBEDDED' | 'TV' | 'IOS' | 'ANDROID'>,
};
const DOWNLOAD_FAILURE_NOTIFICATION_WINDOW_MINUTES = 180;
const TMDB_POSTER_NOTIFICATION_WINDOW_MINUTES = 180;
const RECENT_MOVIE_RELEASE_WINDOW_DAYS = 540;
const RECENT_SERIES_DEBUT_WINDOW_DAYS = 730;
const execFileAsync = promisify(execFile);
const YT_DLP_ANDROID_SDKLESS_ARGS = ['youtube:player-client=android_sdkless'];
const NON_NARRATIVE_COMEDY_PATTERNS = [
    /\bstand[\s-]?up\b/i,
    /\bcomedy special\b/i,
    /\bone[\s-]?hour special\b/i,
    /\broast special\b/i,
    /\blive special\b/i,
];
const HARD_BLOCKED_VIDEO_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
    { pattern: /\benglish[\s-]?dub(?:bed)?\b/i, reason: 'English-dubbed or dubbed reupload content is out of scope' },
    { pattern: /\b(?:full movie|full film|movie recap|ending explained)\b/i, reason: 'Unofficial full-movie or recap content is out of scope' },
    { pattern: /\b(?:wwe|wrestling|pro wrestling)\b/i, reason: 'Wrestling content is out of scope' },
    { pattern: /\b(?:boxing|weigh[\s-]?in|press conference)\b/i, reason: 'Combat sports content is out of scope' },
    { pattern: /\b(?:ufc|mma)\b/i, reason: 'MMA content is out of scope' },
    { pattern: /\b(?:highlights?|matchday|postgame|pregame)\b/i, reason: 'Sports highlights and coverage are out of scope' },
    { pattern: /\b(?:reality show|reality series|unscripted)\b/i, reason: 'Reality and unscripted content are out of scope' },
    { pattern: /\b(?:the kardashians|keeping up with the kardashians|real housewives|love island|big brother)\b/i, reason: 'Celebrity/family reality content is out of scope' },
    { pattern: /\b(?:talk show|late night|podcast|vodcast)\b/i, reason: 'Talk-show and podcast-style content are out of scope' },
    { pattern: /\b(?:documentary|docuseries|true crime)\b/i, reason: 'Documentary and docuseries content are out of scope' },
    { pattern: /\b(?:music video|lyric video|official audio|concert film|live performance)\b/i, reason: 'Music/performance content is out of scope' },
];
const BLOCKED_TMDB_GENRES = new Set([
    'documentary',
    'reality',
    'talk',
    'news',
    'war & politics',
]);

class YouTubeDownloadBlockedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'YouTubeDownloadBlockedError';
    }
}

function escapeRegexValue(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class YouTubePollerService {
    private isPolling = false;

    private parseISODate(value?: string): Date | null {
        if (!value) {
            return null;
        }

        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private getDaysSinceDate(value?: string): number | null {
        const parsed = this.parseISODate(value);
        if (!parsed) {
            return null;
        }

        return (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
    }

    async pollChannels(options: PollOptions = {}): Promise<PollSummary> {
        const startedAt = new Date();

        if (this.isPolling) {
            return {
                startedAt: startedAt.toISOString(),
                finishedAt: new Date().toISOString(),
                channelsChecked: 0,
                channelsSkipped: 0,
                newVideosDetected: 0,
                successfulPublishes: 0,
                failedPublishes: 0,
                results: [{
                    channelId: '',
                    channelName: 'Poller',
                    checked: false,
                    skipped: true,
                    newVideoDetected: false,
                    published: false,
                    failed: false,
                    message: 'Polling already in progress'
                }]
            };
        }

        this.isPolling = true;
        console.log('[YouTubePoller] Starting poll...');
        console.log(`[YouTubePoller] yt-dlp auth mode: ${describeYtDlpAuthConfiguration()}`);

        try {
            const settings = await getYouTubeRuntimeSettings();
            const where: Record<string, any> = { status: 'active' };
            if (options.channelDbId) {
                where.id = options.channelDbId;
            }

            const channels = await prisma.channel.findMany({ where });
            console.log(`[YouTubePoller] Found ${channels.length} active channels`);

            const intervalMinutes = settings.fetchInterval && Number(settings.fetchInterval) > 0
                ? Number(settings.fetchInterval)
                : 10;
            const intervalMs = intervalMinutes * 60 * 1000;
            const now = Date.now();

            const results: ChannelPollResult[] = [];

            for (const channel of channels) {
                if (!options.force && channel.lastCheck) {
                    const lastCheckTime = new Date(channel.lastCheck).getTime();
                    if (now - lastCheckTime < intervalMs) {
                        const skippedResult = {
                            channelId: channel.channelId,
                            channelName: channel.name,
                            checked: false,
                            skipped: true,
                            newVideoDetected: false,
                            published: false,
                            failed: false,
                            message: 'Skipped until next polling window'
                        };
                        console.log(`[YouTubePoller] ${channel.name}: ${skippedResult.message}`);
                        results.push(skippedResult);
                        continue;
                    }
                }

                const channelResult = await this.processChannel(channel, settings, options);
                console.log(`[YouTubePoller] ${channelResult.channelName}: ${channelResult.message}`);
                results.push(channelResult);
            }

            return {
                startedAt: startedAt.toISOString(),
                finishedAt: new Date().toISOString(),
                channelsChecked: results.filter(result => result.checked).length,
                channelsSkipped: results.filter(result => result.skipped).length,
                newVideosDetected: results.filter(result => result.newVideoDetected).length,
                successfulPublishes: results.filter(result => result.published).length,
                failedPublishes: results.filter(result => result.failed).length,
                results
            };
        } catch (error) {
            console.error('[YouTubePoller] Error in poll cycle:', error);
            return {
                startedAt: startedAt.toISOString(),
                finishedAt: new Date().toISOString(),
                channelsChecked: 0,
                channelsSkipped: 0,
                newVideosDetected: 0,
                successfulPublishes: 0,
                failedPublishes: 1,
                results: [{
                    channelId: '',
                    channelName: 'Poller',
                    checked: false,
                    skipped: false,
                    newVideoDetected: false,
                    published: false,
                    failed: true,
                    message: error instanceof Error ? error.message : 'Unknown polling error'
                }]
            };
        } finally {
            this.isPolling = false;
            console.log('[YouTubePoller] Poll finished');
        }
    }

    private async processChannel(
        channel: any,
        settings: LoadedVideoSettings,
        options: PollOptions = {}
    ): Promise<ChannelPollResult> {
        let activeChannel = channel;

        try {
            activeChannel = await this.ensureCanonicalChannel(channel);
            const supportsFeedItemStatus = await hasFeedItemStatusColumn();
            const { keywords: trailerKeywords, usingDefault: usingDefaultTrailerKeywords } = this.getTrailerKeywords(settings);
            const { items: ownedVideos, source } = await this.getRecentChannelVideos(activeChannel);
            const collaborativeVideos = await this.fetchCollaborativeVideosForChannel(activeChannel, trailerKeywords);
            const latestVideos = this.mergeDiscoveredCandidates([...ownedVideos, ...collaborativeVideos]);
            if (source === 'yt-dlp') {
                console.warn(`[YouTubePoller] ${activeChannel.name}: using yt-dlp channel fallback because the YouTube RSS feed was unavailable`);
            }

            if (latestVideos.length === 0) {
                return this.completeChannelCheck(activeChannel.id, {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: false,
                    published: false,
                    failed: false,
                    message: 'No videos found in channel source'
                });
            }
            console.log(
                usingDefaultTrailerKeywords
                    ? `[YouTubePoller] ${activeChannel.name}: using default trailer filters (${trailerKeywords.join(', ')}) because advancedFilters is blank`
                    : `[YouTubePoller] ${activeChannel.name}: using trailer filters (${trailerKeywords.join(', ')})`
            );
            console.log(`[YouTubePoller] ${activeChannel.name}: discovered ${ownedVideos.length} owned uploads and ${collaborativeVideos.length} collaborative candidates`);
            const futureOnlySince = this.getFutureOnlySince(settings);
            console.log(
                futureOnlySince
                    ? `[YouTubePoller] ${activeChannel.name}: age gate ${this.describeVideoAgeGate(settings)}; future-only cutoff ${futureOnlySince.toISOString()}`
                    : `[YouTubePoller] ${activeChannel.name}: age gate ${this.describeVideoAgeGate(settings)}; backlog mode ${settings.videoBacklogMode}`
            );
            const targetPlatforms = this.getTargetPlatforms(settings);
            const skippedReasons: string[] = [];
            let sawFreshUnprocessedVideo = false;

            for (const video of latestVideos) {
                const processed = await this.processFeedVideo(
                    video,
                    activeChannel,
                    settings,
                    options,
                    supportsFeedItemStatus,
                    trailerKeywords,
                    targetPlatforms
                );

                if (processed.reason) {
                    skippedReasons.push(processed.reason);
                }

                if (processed.sawFreshVideo) {
                    sawFreshUnprocessedVideo = true;
                }

                if (processed.kind === 'return' && processed.result) {
                    return this.completeChannelCheck(
                        activeChannel.id,
                        processed.result,
                        processed.incrementVideoCount ?? false
                    );
                }

                if (processed.stopScanning) {
                    break;
                }
            }

            return this.completeChannelCheck(activeChannel.id, {
                channelId: activeChannel.channelId,
                channelName: activeChannel.name,
                checked: true,
                skipped: true,
                newVideoDetected: sawFreshUnprocessedVideo,
                published: false,
                failed: false,
                message: this.buildNoEligibleVideoMessage(latestVideos.length, skippedReasons)
            });
        } catch (error: any) {
            console.error(`[YouTubePoller] Error processing channel ${activeChannel.name}:`, error);
            return this.completeChannelCheck(activeChannel.id, {
                channelId: activeChannel.channelId,
                channelName: activeChannel.name,
                checked: true,
                skipped: false,
                newVideoDetected: false,
                published: false,
                failed: true,
                message: error.message || 'Unknown channel processing error'
            });
        }
    }

    private sortRecentChannelVideos(videos: any[]): any[] {
        return [...videos]
            .sort((left, right) => new Date(right?.pubDate || 0).getTime() - new Date(left?.pubDate || 0).getTime())
            .slice(0, MAX_RECENT_FEED_ITEMS);
    }

    async previewChannelDiscovery(channelDbId: string, limit = 10): Promise<ChannelDiscoveryPreviewItem[]> {
        const settings = await getYouTubeRuntimeSettings();
        const channel = await prisma.channel.findUnique({ where: { id: channelDbId } });
        if (!channel) {
            throw new Error('Channel not found');
        }

        const activeChannel = await this.ensureCanonicalChannel(channel);
        const { keywords: trailerKeywords } = this.getTrailerKeywords(settings);
        const { items: ownedVideos } = await this.getRecentChannelVideos(activeChannel);
        const collaborativeVideos = await this.fetchCollaborativeVideosForChannel(activeChannel, trailerKeywords);
        const latestVideos = this.mergeDiscoveredCandidates([...ownedVideos, ...collaborativeVideos]).slice(0, Math.max(1, limit));

        const previews = await Promise.all(latestVideos.map(async (video) => {
            const videoId = this.extractVideoId(video.link || '', video.id || '');
            const title = video.title || 'Untitled YouTube upload';
            const keywordMatched = this.matchesTrailerFilters((title || '').toLowerCase(), trailerKeywords);

            let allow: boolean | undefined;
            let decisionPath: string | undefined;
            let reasonSummary: string | undefined;

            if (videoId && keywordMatched) {
                try {
                    const metadata = await enrichYouTubeVideoMetadata(
                        videoId,
                        title,
                        video.contentSnippet || '',
                        settings
                    );
                    const candidate = this.buildDecisionCandidate(
                        videoId,
                        title,
                        video.contentSnippet || '',
                        activeChannel,
                        new Date(video.pubDate || Date.now()),
                        video
                    );
                    candidate.normalizedTitle = metadata.cleanedTitle || candidate.normalizedTitle;
                    if (metadata.tmdbMatch) {
                        candidate.mediaTypeGuess = metadata.tmdbMatch.mediaType;
                        candidate.extractedYear = metadata.tmdbMatch.year;
                        candidate.seasonNumber = metadata.tmdbMatch.seasonNumber;
                        candidate.trailerType = metadata.trailerType;
                    }
                    const decision = await decideYouTubeCandidate(candidate, metadata, settings);
                    allow = decision.allow;
                    decisionPath = decision.decisionPath;
                    reasonSummary = decision.reasonSummary;
                } catch (error) {
                    reasonSummary = error instanceof Error ? error.message : 'Preview classification failed';
                }
            }

            return {
                videoId,
                title,
                publishedAt: typeof video.pubDate === 'string' ? video.pubDate : undefined,
                discoveredVia: video.discoveredVia === 'collab_association' ? 'collab_association' : 'owned_upload',
                detectedViaChannelName: video.detectedViaChannelName,
                primaryChannelName: video.primaryChannelName,
                collaboratorChannelNames: Array.isArray(video.collaboratorChannelNames) ? video.collaboratorChannelNames : [],
                isCollaborativePost: video.isCollaborativePost === true,
                keywordMatched,
                allow,
                decisionPath,
                reasonSummary,
            } satisfies ChannelDiscoveryPreviewItem;
        }));

        return previews;
    }

    private mergeDiscoveredCandidates(candidates: any[]): any[] {
        const byVideoId = new Map<string, any>();

        for (const candidate of candidates) {
            const videoId = this.extractVideoId(candidate?.link || '', candidate?.id || '');
            if (!videoId) {
                continue;
            }

            const existing = byVideoId.get(videoId);
            if (!existing) {
                byVideoId.set(videoId, candidate);
                continue;
            }

            const existingOrigins = new Set<string>(existing.detectedViaChannels || [existing.detectedViaChannelName].filter(Boolean));
            const nextOrigins = new Set<string>(candidate.detectedViaChannels || [candidate.detectedViaChannelName].filter(Boolean));
            const mergedDetectedViaChannels = Array.from(new Set([...existingOrigins, ...nextOrigins])).filter(Boolean);
            const mergedCollaboratorNames = Array.from(new Set([
                ...((existing.collaboratorChannelNames as string[]) || []),
                ...((candidate.collaboratorChannelNames as string[]) || []),
            ]));
            const mergedCollaboratorIds = Array.from(new Set([
                ...((existing.collaboratorChannelIds as string[]) || []),
                ...((candidate.collaboratorChannelIds as string[]) || []),
            ]));

            byVideoId.set(videoId, {
                ...existing,
                contentSnippet: existing.contentSnippet || candidate.contentSnippet,
                detectedViaChannels: mergedDetectedViaChannels,
                collaboratorChannelNames: mergedCollaboratorNames,
                collaboratorChannelIds: mergedCollaboratorIds,
                isCollaborativePost: existing.isCollaborativePost || candidate.isCollaborativePost,
            });
        }

        return this.sortRecentChannelVideos([...byVideoId.values()]);
    }

    private async getRecentChannelVideos(channel: any): Promise<ChannelVideoSourceResult> {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;

        try {
            const feed = await parser.parseURL(rssUrl);
            const items = Array.isArray(feed.items) ? this.sortRecentChannelVideos(feed.items) : [];
            if (items.length > 0) {
                return {
                    items: items.map((item) => ({
                        ...item,
                        primaryChannelId: channel.channelId,
                        primaryChannelName: channel.name,
                        detectedViaChannelId: channel.channelId,
                        detectedViaChannelName: channel.name,
                        detectedViaChannels: [channel.name],
                        collaboratorChannelIds: [],
                        collaboratorChannelNames: [],
                        isCollaborativePost: false,
                        discoveredVia: 'owned_upload',
                    })),
                    source: 'rss',
                };
            }

            console.warn(`[YouTubePoller] ${channel.name}: RSS feed returned no items; trying yt-dlp channel fallback`);
        } catch (error) {
            console.warn(`[YouTubePoller] ${channel.name}: RSS feed fetch failed; trying yt-dlp channel fallback`, error);
        }

        return {
            items: await this.fetchRecentChannelVideosWithYtDlp(channel.channelId, channel.name),
            source: 'yt-dlp',
        };
    }

    private parseYtDlpPublishedAt(raw: any): string | undefined {
        if (typeof raw?.timestamp === 'number' && Number.isFinite(raw.timestamp)) {
            return new Date(raw.timestamp * 1000).toISOString();
        }

        if (typeof raw?.upload_date === 'string' && /^\d{8}$/.test(raw.upload_date)) {
            const year = raw.upload_date.slice(0, 4);
            const month = raw.upload_date.slice(4, 6);
            const day = raw.upload_date.slice(6, 8);
            return `${year}-${month}-${day}T00:00:00.000Z`;
        }

        return undefined;
    }

    private async fetchRecentChannelVideosWithYtDlp(channelId: string, channelName: string): Promise<any[]> {
        const channelUrl = `https://www.youtube.com/channel/${channelId}/videos`;
        const playlist = await ytDlp(channelUrl, {
            flatPlaylist: true,
            playlistEnd: MAX_RECENT_FEED_ITEMS,
            dumpSingleJson: true,
            skipDownload: true,
            noWarnings: true,
            quiet: true,
        } as any);

        const entries = Array.isArray((playlist as any)?.entries) ? (playlist as any).entries : [];
        const resolvedVideos = await Promise.all(entries.map(async (entry: any) => {
            const videoId = typeof entry?.id === 'string' ? entry.id.trim() : '';
            if (!videoId) {
                return null;
            }

            const videoUrl = typeof entry?.url === 'string' && entry.url.trim().length > 0
                ? entry.url
                : `https://www.youtube.com/watch?v=${videoId}`;

            try {
                const raw = await this.fetchYtDlpVideoInfo(videoUrl, videoId);
                return {
                    id: `yt:video:${videoId}`,
                    link: typeof raw?.webpage_url === 'string' ? raw.webpage_url : videoUrl,
                    title: typeof raw?.title === 'string' && raw.title.trim().length > 0
                        ? raw.title
                        : (typeof entry?.title === 'string' && entry.title.trim().length > 0 ? entry.title : 'Untitled YouTube upload'),
                    pubDate: this.parseYtDlpPublishedAt(raw),
                    contentSnippet: typeof raw?.description === 'string'
                        ? raw.description
                        : (typeof entry?.description === 'string' ? entry.description : ''),
                    primaryChannelId: typeof raw?.channel_id === 'string' ? raw.channel_id : channelId,
                    primaryChannelName: typeof raw?.channel === 'string' ? raw.channel : channelName,
                    detectedViaChannelId: channelId,
                    detectedViaChannelName: channelName,
                    detectedViaChannels: [channelName],
                    collaboratorChannelIds: [],
                    collaboratorChannelNames: [],
                    isCollaborativePost: false,
                    discoveredVia: 'owned_upload',
                };
            } catch (error) {
                console.warn(`[YouTubePoller] ${channelName}: failed to resolve yt-dlp fallback metadata for ${videoId}; skipping entry`, error);
                return null;
            }
        }));

        return this.sortRecentChannelVideos(
            resolvedVideos.filter((video): video is any => Boolean(video?.pubDate))
        );
    }

    private async fetchCollaborativeVideosForChannel(channel: any, trailerKeywords: string[]): Promise<any[]> {
        const keywordQueries = trailerKeywords
            .filter((keyword) => !NON_STANDALONE_TRAILER_KEYWORDS.has(keyword))
            .slice(0, 4);
        const candidateMap = new Map<string, any>();
        const debugCollab = DEBUG_COLLAB_CHANNEL_NAMES.has(String(channel?.name || '').trim().toLowerCase());
        const normalizeSearchName = (value?: string) => String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const trackedChannelName = normalizeSearchName(channel?.name);

        for (const keyword of keywordQueries) {
            const searchQuery = `${channel.name} ${keyword}`.trim();
            const query = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
            try {
                const results = await ytDlp(query, {
                    flatPlaylist: true,
                    dumpSingleJson: true,
                    skipDownload: true,
                    noWarnings: true,
                    quiet: true,
                } as any);
                const entries = Array.isArray((results as any)?.entries)
                    ? (results as any).entries.slice(0, MAX_COLLAB_SEARCH_RESULTS_PER_KEYWORD)
                    : [];

                if (debugCollab) {
                    console.info(`[YouTubePoller] ${channel.name}: collaborative query "${searchQuery}" returned ${entries.length} top entries`, entries.map((entry: any) => ({
                        id: entry?.id,
                        title: entry?.title,
                        channel: entry?.channel,
                        uploader: entry?.uploader,
                        url: entry?.url,
                    })));
                }

                for (const entry of entries) {
                    if (candidateMap.size >= MAX_RECENT_FEED_ITEMS) {
                        break;
                    }

                    const videoId = typeof entry?.id === 'string' ? entry.id.trim() : '';
                    const entryUrl = typeof entry?.url === 'string' ? entry.url : '';
                    const isWatchUrl = entryUrl.includes('/watch?v=') || entryUrl.startsWith('https://www.youtube.com/watch?v=');
                    const looksLikeVideoId = /^[A-Za-z0-9_-]{8,}$/.test(videoId);

                    if (!videoId || candidateMap.has(videoId) || (!isWatchUrl && !looksLikeVideoId)) {
                        continue;
                    }

                    const videoUrl = typeof entry?.url === 'string' && entry.url.trim().length > 0
                        ? entry.url
                        : `https://www.youtube.com/watch?v=${videoId}`;

                    try {
                        const raw = await this.fetchYtDlpVideoInfo(videoUrl, videoId);
                        const collaboratorMetadata = extractCollaboratorMetadata(raw);
                        const explicitCollaboratorMatch = isExplicitCollaboratorForTrackedChannel(channel, raw);
                        const entryChannel = normalizeSearchName(typeof entry?.channel === 'string' ? entry.channel : '');
                        const entryUploader = normalizeSearchName(typeof entry?.uploader === 'string' ? entry.uploader : '');
                        const structuredSearchCollaboratorSignal = [entryChannel, entryUploader].some((value) =>
                            value.includes(trackedChannelName) && /\band\s+\d+\s+more\b/.test(value)
                        );
                        const rawPrimaryChannelName = normalizeSearchName(typeof raw?.channel === 'string' ? raw.channel : raw?.uploader);
                        const regionalFamilyChannelSignal =
                            Boolean(trackedChannelName) &&
                            rawPrimaryChannelName.startsWith(`${trackedChannelName} `) &&
                            raw?.channel_id !== channel.channelId;
                        const collaborativeAssociationMatch =
                            explicitCollaboratorMatch ||
                            structuredSearchCollaboratorSignal ||
                            regionalFamilyChannelSignal;

                        if (debugCollab) {
                            console.info(`[YouTubePoller] ${channel.name}: inspected collaborative candidate ${videoId}`, {
                                searchQuery,
                                entryTitle: entry?.title,
                                entryChannel: entry?.channel,
                                entryUploader: entry?.uploader,
                                rawTitle: raw?.title,
                                rawChannel: raw?.channel,
                                rawChannelId: raw?.channel_id,
                                rawCreators: raw?.creators,
                                collaboratorMetadata,
                                explicitCollaboratorMatch,
                                structuredSearchCollaboratorSignal,
                                regionalFamilyChannelSignal,
                                collaborativeAssociationMatch,
                            });
                        }

                        if (!collaborativeAssociationMatch) {
                            continue;
                        }

                        candidateMap.set(videoId, {
                            id: `yt:video:${videoId}`,
                            link: typeof raw?.webpage_url === 'string' ? raw.webpage_url : videoUrl,
                            title: typeof raw?.title === 'string' && raw.title.trim().length > 0
                                ? raw.title
                                : (typeof entry?.title === 'string' && entry.title.trim().length > 0 ? entry.title : 'Untitled YouTube upload'),
                            pubDate: this.parseYtDlpPublishedAt(raw),
                            contentSnippet: typeof raw?.description === 'string'
                                ? raw.description
                                : (typeof entry?.description === 'string' ? entry.description : ''),
                            primaryChannelId: collaboratorMetadata.primaryChannelId,
                            primaryChannelName: collaboratorMetadata.primaryChannelName,
                            detectedViaChannelId: channel.channelId,
                            detectedViaChannelName: channel.name,
                            detectedViaChannels: [channel.name],
                            collaboratorChannelIds: collaboratorMetadata.collaboratorChannelIds,
                            collaboratorChannelNames: collaboratorMetadata.collaboratorChannelNames,
                            isCollaborativePost: true,
                            discoveredVia: 'collab_association',
                        });
                    } catch (error) {
                        console.warn(`[YouTubePoller] ${channel.name}: failed to inspect collaborative candidate ${videoId}`, error);
                    }
                }
            } catch (error) {
                console.warn(`[YouTubePoller] ${channel.name}: collaborative discovery query failed for "${keyword}"`, error);
            }

            if (candidateMap.size >= MAX_RECENT_FEED_ITEMS) {
                break;
            }
        }

        return this.sortRecentChannelVideos([...candidateMap.values()].filter((video) => Boolean(video?.pubDate)));
    }

    private async completeChannelCheck(
        channelDbId: string,
        result: ChannelPollResult,
        incrementVideoCount = false
    ): Promise<ChannelPollResult> {
        await prisma.channel.update({
            where: { id: channelDbId },
            data: incrementVideoCount
                ? { lastCheck: new Date(), videoCount: { increment: 1 } }
                : { lastCheck: new Date() }
        }).catch(() => undefined);

        return result;
    }

    private buildNoEligibleVideoMessage(scannedCount: number, skippedReasons: string[]): string {
        if (skippedReasons.length === 0) {
            return `Checked ${scannedCount} recent uploads and found no new eligible trailers`;
        }

        const recentReasons = skippedReasons.slice(-3).join(' | ');
        return `Checked ${scannedCount} recent uploads and found no new eligible trailers. Latest outcomes: ${recentReasons}`;
    }

    private isExplicitShort(video: any, titleLower: string, descriptionLower: string): boolean {
        return (
            (typeof video.link === 'string' && video.link.includes('/shorts/')) ||
            titleLower.includes('#shorts') ||
            titleLower.includes('#short') ||
            titleLower.includes('(shorts)') ||
            descriptionLower.includes('#shorts') ||
            descriptionLower.includes('#short')
        );
    }

    private titleMatchesKeyword(titleLower: string, keyword: string): boolean {
        const normalizedKeyword = keyword.trim().toLowerCase();
        if (!normalizedKeyword) {
            return false;
        }

        const keywordPattern = normalizedKeyword
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => escapeRegexValue(part))
            .join('\\s+');

        return new RegExp(`(^|[^a-z0-9])${keywordPattern}($|[^a-z0-9])`, 'i').test(titleLower);
    }

    private matchesTrailerFilters(titleLower: string, trailerKeywords: string[]): boolean {
        const matchedKeywords = trailerKeywords.filter((keyword) => this.titleMatchesKeyword(titleLower, keyword));
        if (matchedKeywords.length === 0) {
            return false;
        }

        return matchedKeywords.some((keyword) => !NON_STANDALONE_TRAILER_KEYWORDS.has(keyword));
    }

    private getTrailerKeywords(settings: LoadedVideoSettings): { keywords: string[]; usingDefault: boolean } {
        const configuredKeywords = settings.advancedFilters
            ? settings.advancedFilters
                .split(',')
                .map((keyword: string) => keyword.trim().toLowerCase())
                .filter(Boolean)
            : [];

        if (configuredKeywords.length > 0) {
            return {
                keywords: configuredKeywords,
                usingDefault: false,
            };
        }

        return {
            keywords: DEFAULT_TRAILER_KEYWORDS,
            usingDefault: true,
        };
    }

    private isStandUpComedySpecialContent(title: string, description: string): boolean {
        const haystack = [title, description].filter(Boolean).join('\n');
        if (!haystack.trim()) {
            return false;
        }

        return NON_NARRATIVE_COMEDY_PATTERNS.some((pattern) => pattern.test(haystack));
    }

    private getHardRejectedContentReason(title: string, description: string): string | null {
        const haystack = [title, description].filter(Boolean).join('\n');
        if (!haystack.trim()) {
            return null;
        }

        if (this.isStandUpComedySpecialContent(title, description)) {
            return 'Stand-up comedy specials are out of scope';
        }

        for (const rule of HARD_BLOCKED_VIDEO_PATTERNS) {
            if (rule.pattern.test(haystack)) {
                return rule.reason;
            }
        }

        return null;
    }

    private getTmdbScopeRejectionReason(metadata: EnrichedVideoMetadata): string | null {
        const match = metadata.tmdbMatch;
        if (!match) {
            return null;
        }

        const genres = (match.genres || []).map((genre) => genre.trim().toLowerCase()).filter(Boolean);
        const blockedGenre = genres.find((genre) => BLOCKED_TMDB_GENRES.has(genre));
        if (blockedGenre) {
            return `TMDb classified this title as ${blockedGenre}, which is out of scope`;
        }

        const titleAndOverview = [match.title, match.overview].filter(Boolean).join('\n');
        const keywordReason = this.getHardRejectedContentReason(titleAndOverview, '');
        if (keywordReason) {
            return keywordReason;
        }

        const daysSinceRelease = this.getDaysSinceDate(match.releaseDate);
        if (typeof daysSinceRelease === 'number' && daysSinceRelease > 0) {
            if (match.mediaType === 'movie' && daysSinceRelease > RECENT_MOVIE_RELEASE_WINDOW_DAYS) {
                return `TMDb matched an older catalog movie release (${match.releaseDate}), not a recent or upcoming film`;
            }

            if (match.mediaType === 'tv' && !match.seasonNumber && daysSinceRelease > RECENT_SERIES_DEBUT_WINDOW_DAYS) {
                return `TMDb matched an older series debut (${match.releaseDate}) without a current season signal`;
            }
        }

        return null;
    }

    private getFutureOnlySince(settings: LoadedVideoSettings): Date | null {
        if (settings.videoBacklogMode !== 'future-only' || !settings.videoFutureOnlySince) {
            return null;
        }

        const parsed = new Date(settings.videoFutureOnlySince);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private describeVideoAgeGate(settings: LoadedVideoSettings): string {
        const ageGate = settings.videoAgeGateHours;
        return ageGate === null ? 'off' : `${ageGate} hour${ageGate === 1 ? '' : 's'}`;
    }

    private extractYearFromText(value: string): number | undefined {
        const match = /\b(19|20)\d{2}\b/.exec(value);
        return match ? Number(match[0]) : undefined;
    }

    private extractSeasonNumber(value: string): number | undefined {
        const match = /\bseason\s+(\d{1,2})\b/i.exec(value);
        return match ? Number(match[1]) : undefined;
    }

    private guessMediaType(value: string): 'movie' | 'tv' | 'unknown' {
        if (/\b(season|series|episode|tv)\b/i.test(value)) {
            return 'tv';
        }

        if (/\b(movie|film|in theaters|in cinemas)\b/i.test(value)) {
            return 'movie';
        }

        return 'unknown';
    }

    private buildDecisionCandidate(videoId: string, videoTitle: string, description: string, activeChannel: any, pubDate: Date, sourceVideo?: any): PollingCandidate {
        const combinedText = `${videoTitle}\n${description}`;
        return {
            youtubeVideoId: videoId,
            rawTitle: videoTitle,
            normalizedTitle: videoTitle,
            description,
            channelId: activeChannel.channelId,
            channelName: activeChannel.name,
            primaryChannelId: sourceVideo?.primaryChannelId || activeChannel.channelId,
            primaryChannelName: sourceVideo?.primaryChannelName || activeChannel.name,
            detectedViaChannelId: sourceVideo?.detectedViaChannelId || activeChannel.channelId,
            detectedViaChannelName: sourceVideo?.detectedViaChannelName || activeChannel.name,
            collaboratorChannelIds: Array.isArray(sourceVideo?.collaboratorChannelIds) ? sourceVideo.collaboratorChannelIds : [],
            collaboratorChannelNames: Array.isArray(sourceVideo?.collaboratorChannelNames) ? sourceVideo.collaboratorChannelNames : [],
            isCollaborativePost: sourceVideo?.isCollaborativePost === true,
            discoveredVia: sourceVideo?.discoveredVia === 'collab_association' ? 'collab_association' : 'owned_upload',
            publishedAt: pubDate,
            mediaTypeGuess: this.guessMediaType(combinedText),
            extractedYear: this.extractYearFromText(combinedText),
            seasonNumber: this.extractSeasonNumber(combinedText),
            trailerType: undefined,
            promoAssetType: parsePromoAssetType(videoTitle),
        };
    }

    private getYouTubeErrorText(error: unknown): string {
        if (error instanceof Error) {
            const maybeRichError = error as Error & {
                shortMessage?: string;
                stderr?: string;
                stdout?: string;
                all?: string;
            };

            return [
                error.message,
                maybeRichError.shortMessage,
                maybeRichError.stderr,
                maybeRichError.stdout,
                maybeRichError.all,
            ]
                .filter((value): value is string => typeof value === 'string' && value.length > 0)
                .join('\n')
                .toLowerCase();
        }

        return String(error || '').toLowerCase();
    }

    private isYouTubeBotChallengeError(error: unknown): boolean {
        const errorText = this.getYouTubeErrorText(error);
        return [
            "not a bot",
            'page needs to be reloaded',
            'precondition check failed',
            'please sign in to continue',
        ].some((fragment) => errorText.includes(fragment));
    }

    private cleanupGeneratedFiles(downloadPath: string | null, assets: Array<PlatformThumbnailAsset | null>) {
        if (downloadPath && fs.existsSync(downloadPath)) {
            fs.unlinkSync(downloadPath);
        }

        for (const asset of assets) {
            if (asset?.localPath && fs.existsSync(asset.localPath)) {
                fs.unlinkSync(asset.localPath);
            }
        }
    }

    private removeYtDlpArtifacts(filePath: string) {
        [filePath, `${filePath}.part`, `${filePath}.ytdl`].forEach((artifactPath) => {
            this.removeFileIfExists(artifactPath);
        });
    }

    private async processFeedVideo(
        video: any,
        activeChannel: any,
        settings: LoadedVideoSettings,
        options: PollOptions,
        supportsFeedItemStatus: boolean,
        trailerKeywords: string[],
        targetPlatforms: string[]
    ): Promise<FeedVideoProcessingResult> {
        const videoTitle = video.title || 'Untitled YouTube upload';
        const videoId = this.extractVideoId(video.link || '', video.id || '');

        if (!videoId) {
            return {
                kind: 'continue',
                reason: `${videoTitle}: missing usable video ID`,
            };
        }

        const existing = await prisma.feedItem.findUnique({ where: { videoId } });
        const canRetryIgnoredVideo = Boolean(
            options.force
            && supportsFeedItemStatus
            && existing?.status === 'ignored'
        );
        const canRetryFailedVideo = Boolean(
            supportsFeedItemStatus
            && existing?.status === 'failed'
        );

        if (existing && !canRetryIgnoredVideo && !canRetryFailedVideo) {
            return {
                kind: 'continue',
                reason: `${videoTitle}: already processed`,
            };
        }

        const pubDate = new Date(video.pubDate || Date.now());
        const futureOnlySince = this.getFutureOnlySince(settings);
        if (futureOnlySince && pubDate < futureOnlySince) {
            return {
                kind: 'continue',
                reason: `${videoTitle}: uploaded before future-only cutoff`,
                stopScanning: true,
            };
        }

        const hoursSince = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
        const ageGateHours = settings.videoAgeGateHours === null
            ? null
            : (settings.videoAgeGateHours ?? FEED_FRESHNESS_HOURS);
        if (ageGateHours !== null && hoursSince > ageGateHours) {
            return {
                kind: 'continue',
                reason: `${videoTitle}: older than ${ageGateHours} hour${ageGateHours === 1 ? '' : 's'}`,
                stopScanning: true,
            };
        }

        const titleLower = (video.title || '').toLowerCase();
        const feedDescriptionLower = (video.contentSnippet || '').toLowerCase();
        if (trailerKeywords.length > 0) {
            const isTrailer = this.matchesTrailerFilters(titleLower, trailerKeywords);
            if (!isTrailer) {
                await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored');
                return {
                    kind: 'continue',
                    reason: `${videoTitle}: did not match trailer filters`,
                    sawFreshVideo: true,
                };
            }
        }

        if (settings.excludeShorts && this.isExplicitShort(video, titleLower, feedDescriptionLower)) {
            await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored');
            return {
                kind: 'continue',
                reason: `${videoTitle}: skipped because video is a Short`,
                sawFreshVideo: true,
            };
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        let videoInfo: NormalizedVideoInfo;
        let metadataFetchFailed = false;
        try {
            videoInfo = await this.getVideoInfo(videoUrl, videoId);
        } catch (error) {
            metadataFetchFailed = true;
            console.warn(`[YouTubePoller] Failed to fetch metadata for ${videoId}; continuing with feed metadata fallback`, error);
            videoInfo = this.buildFallbackVideoInfo(video, videoId, videoUrl);
        }

        let details = videoInfo.videoDetails;
        const descriptionLower = (details.description || video.contentSnippet || '').toLowerCase();
        if (settings.excludeShorts) {
            const isShort = this.isExplicitShort(video, titleLower, descriptionLower);

            if (isShort) {
                await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored');
                return {
                    kind: 'continue',
                    reason: `${videoTitle}: skipped because video is a Short`,
                    sawFreshVideo: true,
                };
            }
        }

        const hasFormatMetadata = Array.isArray(videoInfo.formats) && videoInfo.formats.length > 0;
        const bestLandscapeResolution = hasFormatMetadata
            ? this.getBestAvailableLandscapeResolution(videoInfo.formats || [])
            : null;
        const shouldVerifyResolutionAfterDownload = metadataFetchFailed || !bestLandscapeResolution;
        if (hasFormatMetadata && !bestLandscapeResolution) {
            await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored');
            return {
                kind: 'continue',
                reason: `${videoTitle}: skipped because no 1080p landscape source is available`,
                sawFreshVideo: true,
            };
        }

        const thumbnailUrl = this.getThumbnailUrl(details);
        const enrichedMetadata = await enrichYouTubeVideoMetadata(
            videoId,
            video.title || '',
            details.description || video.contentSnippet || '',
            settings
        );
        const decisionCandidate = this.buildDecisionCandidate(
            videoId,
            video.title || '',
            details.description || video.contentSnippet || '',
            activeChannel,
            pubDate,
            video
        );
        decisionCandidate.normalizedTitle = enrichedMetadata.cleanedTitle || decisionCandidate.normalizedTitle;
        if (enrichedMetadata.tmdbMatch) {
            decisionCandidate.mediaTypeGuess = enrichedMetadata.tmdbMatch.mediaType;
            decisionCandidate.extractedYear = enrichedMetadata.tmdbMatch.year;
            decisionCandidate.seasonNumber = enrichedMetadata.tmdbMatch.seasonNumber;
            decisionCandidate.trailerType = enrichedMetadata.trailerType;
        }

        const hardRejectedReason = this.getHardRejectedContentReason(
            video.title || '',
            details.description || video.contentSnippet || ''
        );
        if (hardRejectedReason) {
            await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored');
            return {
                kind: 'continue',
                reason: `${videoTitle}: ${hardRejectedReason}`,
                sawFreshVideo: true,
            };
        }

        if (settings.regionFilter && !enrichedMetadata.regionAllowed) {
            await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored');
            return {
                kind: 'continue',
                reason: enrichedMetadata.regionReason || `${videoTitle}: skipped by region filter`,
                sawFreshVideo: true,
            };
        }

        const tmdbScopeRejectedReason = this.getTmdbScopeRejectionReason(enrichedMetadata);
        if (tmdbScopeRejectedReason) {
            await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored');
            return {
                kind: 'continue',
                reason: `${videoTitle}: ${tmdbScopeRejectedReason}`,
                sawFreshVideo: true,
            };
        }

        const decisionResult = await decideYouTubeCandidate(decisionCandidate, enrichedMetadata, settings);
        const sourceAttribution = {
            discoveredVia: decisionCandidate.discoveredVia,
            detectedViaChannelId: decisionCandidate.detectedViaChannelId,
            detectedViaChannelName: decisionCandidate.detectedViaChannelName,
            detectedViaChannels: video.detectedViaChannels || [decisionCandidate.detectedViaChannelName].filter(Boolean),
            primaryChannelId: decisionCandidate.primaryChannelId,
            primaryChannelName: decisionCandidate.primaryChannelName,
            collaboratorChannelIds: decisionCandidate.collaboratorChannelIds,
            collaboratorChannelNames: decisionCandidate.collaboratorChannelNames,
            isCollaborativePost: decisionCandidate.isCollaborativePost,
        };
        console.log('[YouTubePoller] decision', JSON.stringify({
            videoId,
            channelName: activeChannel.name,
            rawTitle: videoTitle,
            normalizedTitle: decisionCandidate.normalizedTitle,
            finalDecision: decisionResult.allow ? 'allow' : 'reject',
            decisionPath: decisionResult.decisionPath,
            reasonSummary: decisionResult.reasonSummary,
            sourceAttribution,
            decisionLog: decisionResult.decisionLog,
        }));
        if (!decisionResult.allow) {
            await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored', {
                decisionPath: decisionResult.decisionPath,
                decisionLog: {
                    ...decisionResult.decisionLog,
                    sourceAttribution,
                },
            });
            return {
                kind: 'continue',
                reason: `${videoTitle}: ${decisionResult.reasonSummary}`,
                sawFreshVideo: true,
            };
        }

        if (settings.videoFilterPrompt?.trim()) {
            const aiDecision = await this.passesAiValidation(video, activeChannel, details, settings, enrichedMetadata);
            if (!aiDecision.allow) {
                await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored', {
                    decisionPath: decisionResult.decisionPath,
                    decisionLog: {
                        ...decisionResult.decisionLog,
                        sourceAttribution,
                        legacyCustomFilterDecision: aiDecision,
                    },
                });
                return {
                    kind: 'continue',
                    reason: `${videoTitle}: ${aiDecision.reason || 'rejected by custom AI filter prompt'}`,
                    sawFreshVideo: true,
                };
            }
        }

        const dedupResult = await checkPromoDuplicate(
            decisionCandidate,
            settings.trustedSupportingChannels?.includes(activeChannel.channelId) === true,
            enrichedMetadata.tmdbMatch ? `${enrichedMetadata.tmdbMatch.mediaType}:${enrichedMetadata.tmdbMatch.tmdbId}` : undefined
        );
        console.log('[YouTubePoller] dedup', JSON.stringify({
            videoId,
            duplicateStatus: dedupResult.duplicateStatus,
            dedupFingerprint: dedupResult.dedupFingerprint,
            matchedCanonicalVideoId: dedupResult.matchedCanonicalVideoId,
            reasonSummary: dedupResult.reasonSummary,
        }));
        if (dedupResult.duplicateStatus === 'DUPLICATE_SKIP') {
            await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored', {
                decisionPath: decisionResult.decisionPath,
                promoFingerprint: dedupResult.dedupFingerprint,
                duplicateOfVideoId: dedupResult.matchedCanonicalVideoId,
                decisionLog: {
                    ...decisionResult.decisionLog,
                    sourceAttribution,
                    dedup: dedupResult,
                },
            });
            await recordDuplicateRelationship(dedupResult.dedupFingerprint, videoId);
            return {
                kind: 'continue',
                reason: `${videoTitle}: skipped as duplicate of ${dedupResult.matchedCanonicalVideoId}`,
                sawFreshVideo: true,
            };
        }

        if (targetPlatforms.length === 0) {
            await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'accepted', {
                decisionPath: decisionResult.decisionPath,
                promoFingerprint: dedupResult.dedupFingerprint,
                decisionLog: {
                    ...decisionResult.decisionLog,
                    sourceAttribution,
                    dedup: dedupResult,
                },
            });
            await recordAcceptedPromoFingerprint(
                decisionCandidate,
                dedupResult.dedupFingerprint,
                dedupResult.sourcePriorityScore,
                enrichedMetadata.tmdbMatch ? `${enrichedMetadata.tmdbMatch.mediaType}:${enrichedMetadata.tmdbMatch.tmdbId}` : undefined
            );
            return {
                kind: 'return',
                sawFreshVideo: true,
                incrementVideoCount: true,
                result: {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: true,
                    published: false,
                    failed: false,
                    message: 'No connected auto-post platforms were enabled'
                }
            };
        }

        const recentPublishBlock = await this.getRecentPublishBlock(settings.postInterval);
        if (recentPublishBlock) {
            return {
                kind: 'return',
                sawFreshVideo: true,
                result: {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: true,
                    published: false,
                    failed: false,
                    message: `${recentPublishBlock}. ${videoTitle} will retry on the next polling cycle`
                }
            };
        }

        console.log(`[YouTubePoller] Downloading ${videoId}...`);
        let downloadPath: string | null = null;
        let downloadBlockedByYouTube = false;
        let youtubeThumbnail: PlatformThumbnailAsset | null = null;
        let xThumbnail: PlatformThumbnailAsset | null = null;
        let socialPoster: PlatformThumbnailAsset | null = null;

        try {
            try {
                downloadPath = metadataFetchFailed
                    ? await this.downloadVideoWithoutMetadata(videoId, videoUrl)
                    : await this.downloadVideoWithInfo(videoInfo);
            } catch (error) {
                if (error instanceof YouTubeDownloadBlockedError || this.isYouTubeBotChallengeError(error)) {
                    downloadBlockedByYouTube = true;
                    console.error('[YouTubePoller] YouTube blocked automated trailer download:', error);
                } else {
                    throw error;
                }
            }

            if (!downloadPath) {
                const shouldPauseRetries = downloadBlockedByYouTube && !hasYtDlpAuthConfiguration();
                await this.recordFeedItem(
                    videoId,
                    activeChannel.channelId,
                    videoTitle,
                    pubDate,
                    shouldPauseRetries ? 'ignored' : 'failed'
                );
                await notificationService.notifyUserOnceWithinWindow({
                    title: downloadBlockedByYouTube ? 'YouTube Download Blocked' : 'Trailer Download Failed',
                    message: downloadBlockedByYouTube
                        ? `${videoTitle} matched detection rules but YouTube blocked the production downloader. Configure authenticated yt-dlp access, then force a reprocess for this video.`
                        : `${videoTitle} matched detection rules but could not be downloaded from YouTube.`,
                    type: 'error',
                    source: 'youtube',
                    actionPage: '/channels'
                }, DOWNLOAD_FAILURE_NOTIFICATION_WINDOW_MINUTES);
                return {
                    kind: 'return',
                    sawFreshVideo: true,
                    result: {
                        channelId: activeChannel.channelId,
                        channelName: activeChannel.name,
                        checked: true,
                        skipped: false,
                        newVideoDetected: true,
                        published: false,
                        failed: true,
                        message: downloadBlockedByYouTube && shouldPauseRetries
                            ? `YouTube blocked automated download for ${videoTitle}; retries are paused until authenticated yt-dlp access is configured`
                            : `Failed to download ${videoTitle} for publishing; it will retry on the next polling cycle`
                    }
                };
            }

            if (shouldVerifyResolutionAfterDownload) {
                const probedDownload = await this.probeDownloadedVideo(downloadPath);
                const width = Number(probedDownload.width || 0);
                const height = Number(probedDownload.height || 0);
                if (!width || !height || width < MIN_TRAILER_WIDTH || height < MIN_TRAILER_HEIGHT || width < height) {
                    await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'ignored');
                    return {
                        kind: 'continue',
                        reason: `${videoTitle}: skipped because downloaded video is below the 1080p landscape floor`,
                        sawFreshVideo: true,
                    };
                }

                if (metadataFetchFailed && probedDownload.durationSeconds) {
                    details = {
                        ...details,
                        lengthSeconds: String(Math.max(0, Math.round(probedDownload.durationSeconds))),
                    };
                    videoInfo = {
                        ...videoInfo,
                        videoDetails: details,
                    };
                }
            }

            const captions = await this.generateCaptions(video, details, settings, enrichedMetadata, targetPlatforms);
            const playlists = await this.detectPlaylists(video, details, settings, enrichedMetadata, activeChannel);
            const youtubeMetadata =
                targetPlatforms.includes('YouTube') && this.isAutoCaptionEnabled('YouTube', settings)
                    ? await generateYouTubePublishMetadata(
                        video.title || '',
                        details.description || video.contentSnippet || '',
                        enrichedMetadata,
                        settings
                    )
                    : this.buildDefaultYouTubeMetadata(video, details, enrichedMetadata);
            youtubeThumbnail = targetPlatforms.includes('YouTube') && this.isAutoThumbnailEnabled('YouTube', settings)
                ? await generateLandscapeThumbnail('youtube', video.title || '', enrichedMetadata, thumbnailUrl, settings)
                : null;
            xThumbnail = targetPlatforms.includes('X') && this.isAutoThumbnailEnabled('X', settings)
                ? await generateLandscapeThumbnail('x', video.title || '', enrichedMetadata, thumbnailUrl, settings)
                : null;
            socialPoster = targetPlatforms.some((platform) => SOCIAL_THUMBNAIL_PLATFORMS.has(platform) && this.isAutoThumbnailEnabled(platform, settings))
                ? await generateSocialPosterThumbnail(video.title || '', enrichedMetadata, thumbnailUrl, settings)
                : null;

            const socialPosterTargets = targetPlatforms.filter((platform) => SOCIAL_THUMBNAIL_PLATFORMS.has(platform) && this.isAutoThumbnailEnabled(platform, settings));
            if (socialPosterTargets.length > 0) {
                const tmdbSummary = enrichedMetadata.tmdbDebugSummary || enrichedMetadata.tmdbMatchStatus || 'unknown';
                if (socialPoster?.strategy === 'tmdb_poster') {
                    console.log(`[YouTubePoller] Social poster source for "${videoTitle}": tmdb_poster; ${tmdbSummary}`);
                } else if (socialPoster) {
                    console.warn(`[YouTubePoller] Social poster source for "${videoTitle}": ${socialPoster.strategy}; ${tmdbSummary}`);
                    await notificationService.notifyUserOnceWithinWindow({
                        title: 'TMDb Poster Fallback',
                        message: `${videoTitle} used ${socialPoster.strategy} instead of a TMDb poster for ${socialPosterTargets.join(', ')}. ${tmdbSummary}`,
                        type: 'warning',
                        source: 'youtube',
                        actionPage: '/channels'
                    }, TMDB_POSTER_NOTIFICATION_WINDOW_MINUTES);
                } else {
                    const missingReason = enrichedMetadata.tmdbMatch?.posterUrl
                        ? 'TMDb poster exists but social poster generation returned no asset'
                        : 'No TMDb poster resolved';
                    console.warn(`[YouTubePoller] Social poster missing for "${videoTitle}": ${missingReason}; ${tmdbSummary}`);
                    await notificationService.notifyUserOnceWithinWindow({
                        title: 'TMDb Poster Missing',
                        message: `${videoTitle} has no TMDb poster cover for ${socialPosterTargets.join(', ')}. ${missingReason}. ${tmdbSummary}`,
                        type: 'warning',
                        source: 'youtube',
                        actionPage: '/channels'
                    }, TMDB_POSTER_NOTIFICATION_WINDOW_MINUTES);
                }
            }

            const publishResult = await this.publishVideo(
                video,
                videoId,
                downloadPath,
                captions,
                settings,
                activeChannel,
                targetPlatforms,
                {
                    youtubePlaylistIds: playlists,
                    pinterestBoardId: settings.videoPinterestBoard,
                    pinterestLink: this.resolvePinterestLink(video.link, settings)
                },
                thumbnailUrl,
                {
                    youtube: youtubeThumbnail,
                    x: xThumbnail,
                    social: socialPoster
                },
                youtubeMetadata,
                pubDate
            );

            if (publishResult.publishedPlatforms.length > 0) {
                await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'accepted', {
                    decisionPath: decisionResult.decisionPath,
                    promoFingerprint: dedupResult.dedupFingerprint,
                    decisionLog: {
                        ...decisionResult.decisionLog,
                        sourceAttribution,
                        dedup: dedupResult,
                    },
                });
                await recordAcceptedPromoFingerprint(
                    decisionCandidate,
                    dedupResult.dedupFingerprint,
                    dedupResult.sourcePriorityScore,
                    enrichedMetadata.tmdbMatch ? `${enrichedMetadata.tmdbMatch.mediaType}:${enrichedMetadata.tmdbMatch.tmdbId}` : undefined
                );
                await notificationService.notifyUser({
                    title: 'New Trailer Published',
                    message: `${video.title} was posted to ${publishResult.publishedPlatforms.join(', ')}.`,
                    type: 'success',
                    source: 'youtube',
                    actionPage: '/channels'
                });

                return {
                    kind: 'return',
                    sawFreshVideo: true,
                    incrementVideoCount: true,
                    result: {
                        channelId: activeChannel.channelId,
                        channelName: activeChannel.name,
                        checked: true,
                        skipped: false,
                        newVideoDetected: true,
                        published: true,
                        failed: false,
                        message: `Published to ${publishResult.publishedPlatforms.join(', ')}`
                    }
                };
            }

            if (publishResult.failedPlatforms.length > 0) {
                await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'failed', {
                    decisionPath: decisionResult.decisionPath,
                    promoFingerprint: dedupResult.dedupFingerprint,
                    decisionLog: {
                        ...decisionResult.decisionLog,
                        sourceAttribution,
                        dedup: dedupResult,
                    },
                });
                return {
                    kind: 'return',
                    sawFreshVideo: true,
                    result: {
                        channelId: activeChannel.channelId,
                        channelName: activeChannel.name,
                        checked: true,
                        skipped: false,
                        newVideoDetected: true,
                        published: false,
                        failed: true,
                        message: `Publish failed for ${publishResult.failedPlatforms.join(', ')}; ${videoTitle} will retry on the next polling cycle`
                    }
                };
            }

            await this.recordFeedItem(videoId, activeChannel.channelId, videoTitle, pubDate, 'failed', {
                decisionPath: decisionResult.decisionPath,
                promoFingerprint: dedupResult.dedupFingerprint,
                decisionLog: {
                    ...decisionResult.decisionLog,
                    sourceAttribution,
                    dedup: dedupResult,
                },
            });
            return {
                kind: 'return',
                sawFreshVideo: true,
                result: {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: true,
                    published: false,
                    failed: false,
                    message: `No platforms accepted the publish request for ${videoTitle}; it will retry on the next polling cycle`
                }
            };
        } finally {
            this.cleanupGeneratedFiles(downloadPath, [youtubeThumbnail, xThumbnail, socialPoster]);
        }
    }

    private async ensureCanonicalChannel(channel: any) {
        if (/^UC[a-zA-Z0-9_-]{22}$/.test(channel.channelId)) {
            return channel;
        }

        try {
            const resolved = await resolveYouTubeChannel(channel.channelId, channel.name);

            return await prisma.channel.update({
                where: { id: channel.id },
                data: {
                    channelId: resolved.channelId,
                    name: resolved.name,
                    subscriberCount: resolved.subscriberCount ?? channel.subscriberCount
                }
            });
        } catch {
            return channel;
        }
    }

    private async publishVideo(
        video: any,
        videoId: string,
        downloadPath: string,
        captions: GeneratedCaptions,
        settings: LoadedVideoSettings,
        channel: any,
        targetPlatforms: string[],
        options: any,
        thumbnailUrl: string | undefined,
        thumbnailAssets: {
            youtube: PlatformThumbnailAsset | null;
            x: PlatformThumbnailAsset | null;
            social: PlatformThumbnailAsset | null;
        },
        youtubeMetadata: { title: string; description: string },
        publishedAt: Date
    ) {
        if (targetPlatforms.length === 0) {
            return { publishedPlatforms: [] as string[], failedPlatforms: [] as string[] };
        }

        const generatedSocialImageUrl =
            thumbnailAssets.social?.publicUrl
            || thumbnailAssets.social?.sourceUrl;
        const defaultText = this.buildPlatformPostText('X', captions, video, settings);
        const publishContent: PublishContent = {
            text: defaultText,
            title: video.title,
            description: youtubeMetadata.description,
            link: video.link,
            imageUrl: undefined,
            videoUrl: video.link,
            platformOverrides: {
                X: {
                    text: this.buildPlatformPostText('X', captions, video, settings),
                },
                Facebook: {
                    text: this.buildPlatformPostText('Facebook', captions, video, settings),
                },
                Instagram: {
                    text: this.buildPlatformPostText('Instagram', captions, video, settings),
                    imageUrl: this.isAutoThumbnailEnabled('Instagram', settings) ? generatedSocialImageUrl : undefined,
                },
                Threads: {
                    text: this.buildPlatformPostText('Threads', captions, video, settings),
                },
                TikTok: {
                    text: this.buildPlatformPostText('TikTok', captions, video, settings),
                    title: this.buildPlatformTitle('TikTok', captions, video, settings),
                },
                YouTube: {
                    title: this.isAutoCaptionEnabled('YouTube', settings)
                        ? (youtubeMetadata.title || video.title)
                        : (video.title || youtubeMetadata.title),
                    description: this.isAutoCaptionEnabled('YouTube', settings)
                        ? (youtubeMetadata.description || captions.generated || captions.fallback)
                        : youtubeMetadata.description,
                    imagePath: this.isAutoThumbnailEnabled('YouTube', settings)
                        ? thumbnailAssets.youtube?.localPath
                        : undefined,
                    imageUrl: this.isAutoThumbnailEnabled('YouTube', settings)
                        ? (thumbnailAssets.youtube?.publicUrl || thumbnailAssets.youtube?.sourceUrl)
                        : undefined,
                },
                Pinterest: {
                    text: this.buildPlatformPostText('Pinterest', captions, video, settings),
                    imageUrl: this.isAutoThumbnailEnabled('Pinterest', settings) ? generatedSocialImageUrl : undefined,
                    title: this.buildPlatformTitle('Pinterest', captions, video, settings),
                },
            }
        };

        const results = await publisherService.publish(targetPlatforms as any, publishContent, downloadPath, options);
        console.log('[YouTubePoller] Publish results:', results);

        const publishedPlatforms = results.filter((result) => result.status === 'posted').map((result) => result.platform);
        const failedPlatforms = results.filter((result) => result.status === 'failed').map((result) => result.platform);

        await notificationService.notifyUser({
            title: 'New Trailer Detected',
            message: `${video.title} from ${channel.name} (${publishedAt.toLocaleDateString()})`,
            type: publishedPlatforms.length > 0 ? 'success' : 'info',
            source: 'youtube',
            actionPage: '/channels'
        });

        return { publishedPlatforms, failedPlatforms };
    }

    private getTargetPlatforms(settings: LoadedVideoSettings): string[] {
        const platformMap: Record<string, string> = {
            x: 'X',
            facebook: 'Facebook',
            instagram: 'Instagram',
            threads: 'Threads',
            tiktok: 'TikTok',
            youtube: 'YouTube',
            pinterest: 'Pinterest'
        };

        return Object.entries(platformMap)
            .filter(([key]) => settings.platformSettings[key]?.autoPost === true)
            .map(([, platform]) => platform);
    }

    private async passesAiValidation(
        video: any,
        activeChannel: any,
        details: NormalizedVideoDetails,
        settings: LoadedVideoSettings,
        metadata: EnrichedVideoMetadata
    ): Promise<VideoValidationDecision> {
        const customRules = settings.videoFilterPrompt?.trim();
        if (!customRules && metadata.tmdbMatch) {
            return { allow: true, classification: 'tmdb-matched-narrative' };
        }

        const aiResult = await aiService.generateCompletion({
            model: settings.videoOpenaiModel,
            prompt: `Validate whether this upload is in scope for Screndly's YouTube polling.

Allow ONLY official promotional content for scripted, narrative entertainment:
- narrative movies
- scripted TV/streaming series
- limited series / miniseries
- animated or anime films/series when they are real scripted titles
- official trailers, teasers, clips, first looks, featurettes, TV spots, and title announcements for those titles

Reject ALL of these as out of scope:
- stand-up comedy, comedy specials, roast specials, live comedy specials
- sports, WWE, wrestling, boxing, UFC, MMA, match highlights, weigh-ins, press conferences
- reality TV, unscripted celebrity/family shows, Kardashian-style shows
- talk shows, late-night clips, podcast/vodcast episodes
- documentaries, docuseries, true crime
- music videos, lyric videos, concerts, live performances
- fan edits, recap/explainer uploads, unofficial reuploads
- English-dubbed reuploads or dubbed non-original-language releases

Video:
Title: ${video.title}
Channel: ${activeChannel.name}
Duration: ${details.lengthSeconds}s
Description: ${details.description}
Keywords: ${details.keywords?.join(', ')}
TMDb Title: ${metadata.tmdbMatch?.title || 'N/A'}
TMDb Media Type: ${metadata.tmdbMatch?.mediaType || 'N/A'}
TMDb Genres: ${metadata.tmdbMatch?.genres?.join(', ') || 'N/A'}
TMDb Match Status: ${metadata.tmdbMatchStatus || 'N/A'}

Additional custom rules:
${customRules || 'None'}

Use web search when needed to verify title origin, original language, dub status, region/country fit, distributor/platform, or whether the content is documentary, sports, fan-made, or otherwise out of scope.

Respond ONLY as strict JSON:
{"allow":true,"classification":"scripted_movie|scripted_series|animation|anime|standup_special|sports|reality|talk_show|documentary|music|dubbed_reupload|fan_edit|other","reason":"short reason"}`,
            maxTokens: 120,
            enableWebSearch: true,
        });

        if (!aiResult.success) {
            return { allow: false, reason: 'AI validation failed', classification: 'other' };
        }

        const raw = aiResult.content.trim();
        try {
            const parsed = JSON.parse(raw) as Partial<VideoValidationDecision>;
            return {
                allow: parsed.allow === true,
                reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
                classification: typeof parsed.classification === 'string' ? parsed.classification : undefined,
            };
        } catch {
            const normalized = raw.toUpperCase();
            if (normalized.includes('YES')) {
                return { allow: true };
            }

            if (normalized.includes('NO')) {
                return { allow: false, reason: 'Rejected by AI validation' };
            }

            return { allow: false, reason: 'Unclear AI validation response' };
        }
    }

    private getPlatformAutomationSettings(platform: string, settings: LoadedVideoSettings): PlatformAutomationSettings {
        const key = PLATFORM_SETTING_KEYS[platform] || platform.trim().toLowerCase();
        const value = settings.platformSettings?.[key];

        if (!value || typeof value !== 'object') {
            return {};
        }

        return value as PlatformAutomationSettings;
    }

    private isAutoThumbnailEnabled(platform: string, settings: LoadedVideoSettings): boolean {
        return this.getPlatformAutomationSettings(platform, settings).autoThumbnail !== false;
    }

    private isAutoCaptionEnabled(platform: string, settings: LoadedVideoSettings): boolean {
        return this.getPlatformAutomationSettings(platform, settings).autoCaption !== false;
    }

    private shouldStripHashtags(platform: string, settings: LoadedVideoSettings): boolean {
        return this.getPlatformAutomationSettings(platform, settings).autoHashtag === false;
    }

    private stripHashtags(text: string): string {
        return text.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
    }

    private buildFallbackCaption(video: any, metadata: { cleanedTitle: string; tmdbMatch?: { title: string } }): string {
        const title = metadata.tmdbMatch?.title || metadata.cleanedTitle || video.title || 'New video';
        const channelName = video.author || 'YouTube Channel';
        return `${title} - From ${channelName}`;
    }

    private buildPlatformCaptionBase(
        platform: string,
        captions: GeneratedCaptions,
        settings: LoadedVideoSettings
    ): string {
        const baseCaption =
            this.isAutoCaptionEnabled(platform, settings) && captions.generated
                ? captions.generated
                : captions.fallback;

        return this.shouldStripHashtags(platform, settings)
            ? this.stripHashtags(baseCaption)
            : baseCaption;
    }

    private buildPlatformPostText(
        platform: string,
        captions: GeneratedCaptions,
        video: any,
        settings: LoadedVideoSettings
    ): string {
        if (platform === 'Pinterest' && captions.pinterestDescription?.trim()) {
            return captions.pinterestDescription.trim();
        }

        const normalizedCaption = this.buildPlatformCaptionBase(platform, captions, settings);
        return normalizedCaption;
    }

    private buildPlatformTitle(
        platform: string,
        captions: GeneratedCaptions,
        video: any,
        settings: LoadedVideoSettings
    ): string {
        if (platform === 'Pinterest' && captions.pinterestTitle?.trim()) {
            return captions.pinterestTitle.trim();
        }

        const text = this.buildPlatformCaptionBase(platform, captions, settings);
        return text.slice(0, 100) || video.title || 'Screndly Upload';
    }

    private buildDefaultYouTubeMetadata(
        video: any,
        details: any,
        metadata: { cleanedTitle: string; tmdbMatch?: { title: string; overview: string } }
    ): { title: string; description: string } {
        return {
            title: video.title || metadata.tmdbMatch?.title || metadata.cleanedTitle || 'Untitled Upload',
            description:
                (details.description || video.contentSnippet || metadata.tmdbMatch?.overview || video.title || 'Trailer upload')
                    .trim(),
        };
    }

    private async getRecentPublishBlock(postIntervalMinutes: number): Promise<string | null> {
        if (!postIntervalMinutes || postIntervalMinutes <= 0) {
            return null;
        }

        const recentPublish = await prisma.notification.findFirst({
            where: {
                source: 'youtube',
                title: 'New Trailer Published',
                createdAt: {
                    gte: new Date(Date.now() - postIntervalMinutes * 60 * 1000)
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!recentPublish) {
            return null;
        }

        return `Waiting for the ${postIntervalMinutes}-minute post interval before the next trailer publish`;
    }

    private async detectPlaylists(
        video: any,
        details: any,
        settings: LoadedVideoSettings,
        metadata: EnrichedVideoMetadata,
        channel: { name?: string }
    ): Promise<string[]> {
        const exactPlaylists = Array.isArray(settings.videoYoutubeSelectedPlaylists)
            ? settings.videoYoutubeSelectedPlaylists
                .filter((playlist) => playlist?.id && playlist?.title)
                .map((playlist) => ({
                    id: playlist.id,
                    title: playlist.title,
                    itemCount: playlist.itemCount,
                    privacyStatus: playlist.privacyStatus,
                }))
            : [];

        const fallbackPlaylists = (settings.videoYoutubePlaylists || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
            .map((title) => ({
                id: title,
                title,
            }));

        const available = exactPlaylists.length > 0 ? exactPlaylists : fallbackPlaylists;

        if (available.length === 0) {
            return [];
        }

        try {
            return await aiService.detectYouTubePlaylists(
                {
                    videoTitle: video.title || '',
                    description: details.description || '',
                    channelName: channel.name,
                    cleanedTitle: metadata.cleanedTitle,
                    trailerType: metadata.trailerType,
                    mediaType: metadata.tmdbMatch?.mediaType,
                    releaseDate: metadata.tmdbMatch?.releaseDate,
                    year: metadata.tmdbMatch?.year,
                    tmdbTitle: metadata.tmdbMatch?.title,
                    genres: metadata.tmdbMatch?.genres,
                    cast: metadata.tmdbMatch?.castNames,
                    productionNames: metadata.tmdbMatch?.productionNames,
                },
                available,
                settings.videoOpenaiModel,
                settings.videoYoutubePlaylistPrompt
            );
        } catch (error) {
            console.error('[YouTubePoller] Failed to detect playlists:', error);
            return [];
        }
    }

    private resolvePinterestLink(videoLink: string | undefined, settings: any): string | undefined {
        if (!videoLink) {
            return undefined;
        }

        switch (settings.videoPinterestLinkStrategy) {
            case 'screenrender':
                return settings.videoPinterestDefaultLink || 'https://screenrender.com';
            case 'custom':
                return settings.videoPinterestDefaultLink || videoLink;
            case 'youtube':
            case 'tmdb':
            default:
                return videoLink;
        }
    }

    private getThumbnailUrl(details: any): string | undefined {
        const thumbnails = details?.thumbnails;
        if (!Array.isArray(thumbnails) || thumbnails.length === 0) {
            return undefined;
        }

        return thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url;
    }

    private buildFallbackThumbnails(videoId: string): Array<{ url?: string }> {
        if (!videoId) {
            return [];
        }

        return [
            { url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` },
            { url: `https://i.ytimg.com/vi/${videoId}/sddefault.jpg` },
            { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
            { url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` },
        ];
    }

    private buildFallbackVideoInfo(video: any, videoId: string, videoUrl: string, durationSeconds?: number): NormalizedVideoInfo {
        return {
            source: 'yt-dlp',
            videoDetails: {
                videoId,
                video_url: videoUrl,
                description: typeof video?.contentSnippet === 'string' ? video.contentSnippet : '',
                lengthSeconds: durationSeconds && Number.isFinite(durationSeconds)
                    ? String(Math.max(0, Math.round(durationSeconds)))
                    : '0',
                thumbnails: this.buildFallbackThumbnails(videoId),
                keywords: [],
            },
            formats: [],
        };
    }

    private normalizeYtDlpInfo(raw: any, fallbackVideoId: string, fallbackUrl: string): NormalizedVideoInfo {
        const videoId = String(raw?.id || fallbackVideoId || '').trim();
        const videoUrl = String(
            raw?.webpage_url
            || raw?.original_url
            || fallbackUrl
            || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '')
        ).trim();
        const thumbnails = Array.isArray(raw?.thumbnails)
            ? raw.thumbnails
                .map((thumbnail: any) => ({
                    url: typeof thumbnail?.url === 'string' ? thumbnail.url : undefined,
                }))
                .filter((thumbnail: { url?: string }) => Boolean(thumbnail.url))
            : [];
        const keywords = Array.isArray(raw?.tags)
            ? raw.tags.filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0)
            : [];
        const formats = Array.isArray(raw?.formats)
            ? raw.formats.map((format: any) => ({
                width: Number(format?.width || 0) || undefined,
                height: Number(format?.height || 0) || undefined,
                hasVideo: format?.vcodec !== 'none',
                hasAudio: format?.acodec !== 'none',
                vcodec: typeof format?.vcodec === 'string' ? format.vcodec : undefined,
                acodec: typeof format?.acodec === 'string' ? format.acodec : undefined,
            }))
            : [];

        return {
            source: 'yt-dlp',
            videoDetails: {
                videoId,
                video_url: videoUrl,
                description: typeof raw?.description === 'string' ? raw.description : '',
                lengthSeconds: String(raw?.duration || 0),
                thumbnails,
                keywords,
            },
            formats,
        };
    }

    private getYtDlpPublicOptions(): YtDlpOptions {
        const { cookies: _cookies, ...options } = getYtDlpAuthOptions();
        return options;
    }

    private async fetchYtDlpInfo(videoUrl: string, extractorArgs?: string[], baseOptions: YtDlpOptions = getYtDlpAuthOptions()): Promise<any> {
        return ytDlp(videoUrl, {
            ...baseOptions,
            dumpSingleJson: true,
            skipDownload: true,
            noWarnings: true,
            quiet: true,
            ...(extractorArgs ? { extractorArgs } : {}),
        } as any);
    }

    private async fetchYtDlpVideoInfo(videoUrl: string, videoId?: string): Promise<any> {
        try {
            return await this.fetchYtDlpInfo(videoUrl, YT_DLP_ANDROID_SDKLESS_ARGS, this.getYtDlpPublicOptions());
        } catch (error) {
            console.warn(`[YouTubePoller] yt-dlp android-sdkless metadata fetch failed for ${videoId || videoUrl}; trying default yt-dlp metadata`, error);
        }

        try {
            return await this.fetchYtDlpInfo(videoUrl);
        } catch (error) {
            if (!videoId || !this.isYouTubeBotChallengeError(error)) {
                throw error;
            }

            console.warn(`[YouTubePoller] yt-dlp metadata fetch hit a YouTube challenge for ${videoId}; retrying with PO token support`, error);
        }

        return this.fetchYtDlpInfo(videoUrl, await youtubePoTokenService.getExtractorArgs(videoId));
    }

    private async getVideoInfo(videoUrl: string, videoId: string): Promise<NormalizedVideoInfo> {
        try {
            const info = await ytdl.getInfo(videoUrl, YOUTUBE_INFO_OPTIONS);
            const normalizedInfo: NormalizedVideoInfo = {
                source: 'ytdl',
                raw: info,
                videoDetails: {
                    videoId: info.videoDetails.videoId,
                    video_url: info.videoDetails.video_url,
                    description: info.videoDetails.description || '',
                    lengthSeconds: info.videoDetails.lengthSeconds,
                    thumbnails: Array.isArray(info.videoDetails.thumbnails) ? info.videoDetails.thumbnails : [],
                    keywords: Array.isArray(info.videoDetails.keywords) ? info.videoDetails.keywords : [],
                },
                formats: info.formats || [],
            };

            if (this.getBestAvailableLandscapeResolution(normalizedInfo.formats || [])) {
                return normalizedInfo;
            }

            console.warn(
                `[YouTubePoller] ytdl-core metadata for ${videoId} did not expose a usable 1080p landscape format; trying yt-dlp metadata fallback`
            );
        } catch (error) {
            console.warn(`[YouTubePoller] ytdl-core metadata fetch failed for ${videoId}; trying yt-dlp fallback`, error);
        }

        const raw = await this.fetchYtDlpVideoInfo(videoUrl, videoId);
        return this.normalizeYtDlpInfo(raw, videoId, videoUrl);
    }

    private getLandscape1080Formats(formats: any[]): any[] {
        if (!Array.isArray(formats)) {
            return [];
        }

        return formats.filter((format) => {
            const height = Number(format?.height || 0);
            const width = Number(format?.width || 0);
            const hasVideo = format?.hasVideo !== false && format?.vcodec !== 'none';

            return hasVideo
                && height >= MIN_TRAILER_HEIGHT
                && width >= MIN_TRAILER_WIDTH
                && width >= height;
        });
    }

    private getBestAvailableLandscapeResolution(formats: any[]): { width: number; height: number } | null {
        const eligible = this.getLandscape1080Formats(formats);
        if (eligible.length === 0) {
            return null;
        }

        const best = eligible.sort((left, right) => {
            const leftHeight = Number(left?.height || 0);
            const rightHeight = Number(right?.height || 0);
            if (rightHeight !== leftHeight) {
                return rightHeight - leftHeight;
            }

            return Number(right?.width || 0) - Number(left?.width || 0);
        })[0];

        return {
            width: Number(best?.width || 0),
            height: Number(best?.height || 0),
        };
    }

    private ensureTempDir(): string {
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        return tempDir;
    }

    private removeFileIfExists(filePath: string) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    private hasDownloadContent(filePath: string): boolean {
        try {
            return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
        } catch {
            return false;
        }
    }

    private async meetsDownloadedResolutionFloor(filePath: string): Promise<boolean> {
        if (!this.hasDownloadContent(filePath)) {
            return false;
        }

        try {
            const { stdout } = await execFileAsync('ffprobe', [
                '-v',
                'error',
                '-select_streams',
                'v:0',
                '-show_entries',
                'stream=width,height',
                '-of',
                'json',
                filePath,
            ]);
            const parsed = JSON.parse(stdout) as {
                streams?: Array<{ width?: number; height?: number }>;
            };
            const stream = parsed.streams?.[0];
            const width = Number(stream?.width || 0);
            const height = Number(stream?.height || 0);
            if (!width || !height) {
                return false;
            }

            return width >= MIN_TRAILER_WIDTH && height >= MIN_TRAILER_HEIGHT && width >= height;
        } catch {
            // If ffprobe is unavailable in the runtime, fall back to the selected
            // download format and only verify that the file is non-empty.
            return this.hasDownloadContent(filePath);
        }
    }

    private async probeDownloadedVideo(filePath: string): Promise<ProbedDownloadedVideo> {
        if (!this.hasDownloadContent(filePath)) {
            return {};
        }

        try {
            const { stdout } = await execFileAsync('ffprobe', [
                '-v',
                'error',
                '-select_streams',
                'v:0',
                '-show_entries',
                'stream=width,height',
                '-show_entries',
                'format=duration',
                '-of',
                'json',
                filePath,
            ]);
            const parsed = JSON.parse(stdout) as {
                streams?: Array<{ width?: number; height?: number }>;
                format?: { duration?: string };
            };
            const stream = parsed.streams?.[0];
            const width = Number(stream?.width || 0) || undefined;
            const height = Number(stream?.height || 0) || undefined;
            const durationSeconds = Number.parseFloat(parsed.format?.duration || '') || undefined;

            return {
                width,
                height,
                durationSeconds,
            };
        } catch {
            return {};
        }
    }

    private async downloadWithYtdl(info: any, filePath: string): Promise<boolean> {
        try {
            const progressiveFormats = this.getLandscape1080Formats(info.formats || [])
                .filter((format) => format?.hasAudio && format?.hasVideo)
                .sort((left, right) => {
                    const leftIsPreferredMp4 = String(left?.container || '').toLowerCase() === 'mp4'
                        && String(left?.codecs || left?.vcodec || '').toLowerCase().includes('avc1');
                    const rightIsPreferredMp4 = String(right?.container || '').toLowerCase() === 'mp4'
                        && String(right?.codecs || right?.vcodec || '').toLowerCase().includes('avc1');
                    if (leftIsPreferredMp4 !== rightIsPreferredMp4) {
                        return rightIsPreferredMp4 ? 1 : -1;
                    }

                    const leftHeight = Number(left?.height || 0);
                    const rightHeight = Number(right?.height || 0);
                    if (rightHeight !== leftHeight) {
                        return rightHeight - leftHeight;
                    }

                    return Number(right?.width || 0) - Number(left?.width || 0);
                });
            const format = progressiveFormats.length > 0
                ? ytdl.chooseFormat(progressiveFormats, { quality: 'highest' })
                : null;
            if (!format) {
                return false;
            }

            await new Promise<void>((resolve, reject) => {
                const videoStream = ytdl.downloadFromInfo(info, { format });
                const output = fs.createWriteStream(filePath);

                videoStream.on('error', reject);
                output.on('error', reject);
                output.on('finish', resolve);

                videoStream.pipe(output);
            });

            return this.meetsDownloadedResolutionFloor(filePath);
        } catch (error) {
            console.error('[YouTubePoller] ytdl-core download error:', error);
            return false;
        }
    }

    private async downloadWithYtDlp(videoUrl: string, filePath: string, videoId?: string): Promise<boolean> {
        const authOptions = getYtDlpAuthOptions();
        const publicOptions = this.getYtDlpPublicOptions();

        try {
            await ytDlp(videoUrl, {
                ...publicOptions,
                output: filePath,
                format: 'bv*[vcodec^=avc1][height>=1080][ext=mp4]+ba[acodec^=mp4a]/bv*[vcodec^=avc1][height>=1080]+ba[acodec^=mp4a]/bv*[height>=1080][ext=mp4]+ba[ext=m4a]/bv*[height>=1080]+ba/b[height>=1080]',
                mergeOutputFormat: 'mp4',
                noProgress: true,
                noWarnings: true,
                quiet: true,
                extractorArgs: YT_DLP_ANDROID_SDKLESS_ARGS,
            });

            return this.meetsDownloadedResolutionFloor(filePath);
        } catch (error) {
            console.warn('[YouTubePoller] yt-dlp android-sdkless download failed; trying authenticated yt-dlp fallback', error);
        }

        try {
            this.removeYtDlpArtifacts(filePath);

            await ytDlp(videoUrl, {
                ...authOptions,
                output: filePath,
                format: 'bv*[vcodec^=avc1][height>=1080][ext=mp4]+ba[acodec^=mp4a]/bv*[vcodec^=avc1][height>=1080]+ba[acodec^=mp4a]/bv*[height>=1080][ext=mp4]+ba[ext=m4a]/bv*[height>=1080]+ba/b[height>=1080]',
                mergeOutputFormat: 'mp4',
                noProgress: true,
                noWarnings: true,
                quiet: true,
            } as any);

            return this.meetsDownloadedResolutionFloor(filePath);
        } catch (error) {
            if (!this.isYouTubeBotChallengeError(error)) {
                console.error('[YouTubePoller] yt-dlp fallback download error:', error);
                return false;
            }

            console.warn('[YouTubePoller] yt-dlp download hit a YouTube challenge; retrying with PO token support', error);
        }

        try {
            this.removeYtDlpArtifacts(filePath);

            await ytDlp(videoUrl, {
                ...authOptions,
                output: filePath,
                format: 'bv*[vcodec^=avc1][height>=1080][ext=mp4]+ba[acodec^=mp4a]/bv*[vcodec^=avc1][height>=1080]+ba[acodec^=mp4a]/bv*[height>=1080][ext=mp4]+ba[ext=m4a]/bv*[height>=1080]+ba/b[height>=1080]',
                mergeOutputFormat: 'mp4',
                noProgress: true,
                noWarnings: true,
                quiet: true,
                extractorArgs: await youtubePoTokenService.getExtractorArgs(videoId),
            } as any);

            return this.meetsDownloadedResolutionFloor(filePath);
        } catch (error) {
            if (this.isYouTubeBotChallengeError(error)) {
                throw new YouTubeDownloadBlockedError(
                    `YouTube is rejecting automated downloads for ${videoId || videoUrl}. Configure YT_DLP_PROXY_URL and optionally YT_DLP_COOKIE_FILE_BASE64 or YT_DLP_COOKIE_FILE_PATH.`
                );
            }

            console.error('[YouTubePoller] yt-dlp PO token download error:', error);
            return false;
        }
    }

    private async downloadVideoWithInfo(info: NormalizedVideoInfo): Promise<string | null> {
        const videoId = info?.videoDetails?.videoId;
        const videoUrl = info?.videoDetails?.video_url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');

        if (!videoId || !videoUrl) {
            return null;
        }

        const tempDir = this.ensureTempDir();
        const filePath = path.join(tempDir, `${videoId}.mp4`);
        this.removeFileIfExists(filePath);

        if (info.source === 'ytdl' && info.raw && await this.downloadWithYtdl(info.raw, filePath)) {
            return filePath;
        }

        this.removeFileIfExists(filePath);

        if (await this.downloadWithYtDlp(videoUrl, filePath, videoId)) {
            return filePath;
        }

        this.removeFileIfExists(filePath);
        return null;
    }

    private async downloadVideoWithoutMetadata(videoId: string, videoUrl: string): Promise<string | null> {
        if (!videoId || !videoUrl) {
            return null;
        }

        const tempDir = this.ensureTempDir();
        const filePath = path.join(tempDir, `${videoId}.mp4`);
        this.removeFileIfExists(filePath);

        if (await this.downloadWithYtDlp(videoUrl, filePath, videoId)) {
            return filePath;
        }

        this.removeFileIfExists(filePath);
        return null;
    }

    private extractVideoId(link: string, id: string): string {
        if (id && id.startsWith('yt:video:')) {
            return id.replace('yt:video:', '');
        }

        if (link) {
            try {
                const url = new URL(link);
                return url.searchParams.get('v') || '';
            } catch {
                return '';
            }
        }

        return '';
    }

    private async recordFeedItem(
        videoId: string,
        channelId: string,
        title: string,
        publishedAt: Date,
        status: FeedItemStatus,
        extras?: {
            decisionPath?: string;
            promoFingerprint?: string;
            duplicateOfVideoId?: string;
            decisionLog?: Record<string, unknown>;
        }
    ) {
        const supportsStatus = await hasFeedItemStatusColumn();
        const baseData = {
            title,
            publishedAt,
            ...(extras?.decisionPath ? { decisionPath: extras.decisionPath } : {}),
            ...(extras?.promoFingerprint ? { promoFingerprint: extras.promoFingerprint } : {}),
            ...(extras?.duplicateOfVideoId ? { duplicateOfVideoId: extras.duplicateOfVideoId } : {}),
            ...(extras?.decisionLog ? { decisionLog: extras.decisionLog as any } : {}),
        };

        await prisma.feedItem.upsert({
            where: { videoId },
            update: supportsStatus
                ? {
                    ...baseData,
                    status,
                }
                : baseData,
            create: supportsStatus
                ? {
                    videoId,
                    channelId,
                    ...baseData,
                    status,
                }
                : {
                    videoId,
                    channelId,
                    ...baseData,
                }
        });
    }

    private async generateCaptions(
        video: any,
        details: any,
        settings: LoadedVideoSettings,
        metadata: EnrichedVideoMetadata,
        targetPlatforms: string[]
    ): Promise<GeneratedCaptions> {
        const fallback = this.buildFallbackCaption(video, metadata);
        const needsGeneratedCaption = targetPlatforms.some((platform) => this.isAutoCaptionEnabled(platform, settings));
        const needsPinterestMetadata = targetPlatforms.includes('Pinterest') && this.isAutoCaptionEnabled('Pinterest', settings);

        if (!needsGeneratedCaption && !needsPinterestMetadata) {
            return { fallback };
        }

        const context = {
            videoTitle: metadata.tmdbMatch?.title || metadata.cleanedTitle || video.title,
            channelName: video.author || 'YouTube Channel',
            description: metadata.tmdbMatch?.overview || details.description || video.contentSnippet || '',
            platform: 'X' as const,
            trailerType: metadata.trailerType,
            mediaType: metadata.tmdbMatch?.mediaType,
            releaseDate: metadata.tmdbMatch?.releaseDate,
            year: metadata.tmdbMatch?.year,
            cast: metadata.tmdbMatch?.castNames?.slice(0, 3),
            genres: metadata.tmdbMatch?.genres,
            productionNames: metadata.tmdbMatch?.productionNames?.slice(0, 3),
            tmdbMatchStatus: metadata.tmdbMatchStatus,
            enableReleaseResearch: shouldEnableReleaseResearch({
                videoTitle: metadata.tmdbMatch?.title || metadata.cleanedTitle || video.title,
                description: details.description || video.contentSnippet || '',
                releaseDate: metadata.tmdbMatch?.releaseDate,
                productionNames: metadata.tmdbMatch?.productionNames?.slice(0, 3),
                tmdbMatchStatus: metadata.tmdbMatchStatus,
                mediaType: metadata.tmdbMatch?.mediaType,
            }),
        };

        const model = settings.videoOpenaiModel || 'gpt-5-mini';
        const customPrompt = settings.videoUniversalCaptionPrompt;
        let generatedCaption: string | undefined;
        let pinterestTitle: string | undefined;
        let pinterestDescription: string | undefined;

        try {
            if (needsGeneratedCaption) {
                generatedCaption = await aiService.generateYouTubeCaption(context, model, customPrompt);
            }
        } catch (error) {
            console.error('[YouTubePoller] AI caption generation failed', error);
        }

        try {
            if (needsPinterestMetadata) {
                const pinterestMetadata = await aiService.generatePinterestMetadata(
                    {
                        title: metadata.tmdbMatch?.title || metadata.cleanedTitle || video.title,
                        description: metadata.tmdbMatch?.overview || details.description || video.contentSnippet || '',
                        cast: metadata.tmdbMatch?.castNames?.slice(0, 3),
                        mediaType: metadata.tmdbMatch?.mediaType,
                        releaseDate: metadata.tmdbMatch?.releaseDate,
                        year: metadata.tmdbMatch?.year,
                        productionNames: metadata.tmdbMatch?.productionNames?.slice(0, 3),
                    },
                    model,
                    settings.videoPinterestTitlePrompt,
                    settings.videoPinterestDescriptionPrompt
                );
                pinterestTitle = pinterestMetadata.title;
                pinterestDescription = pinterestMetadata.description;
            }
        } catch (error) {
            console.error('[YouTubePoller] Pinterest metadata generation failed', error);
        }

        return {
            generated: generatedCaption,
            pinterestTitle,
            pinterestDescription,
            fallback,
        };
    }
}

export const youtubePollerService = new YouTubePollerService();
