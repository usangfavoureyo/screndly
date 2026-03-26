import { Comment, PlatformConnection, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { findPlatformConnection } from '../lib/platformConnections';
import { AIModel, DEFAULT_OPENAI_MODEL, generateCommentReply, normalizeAIModel } from './ai.service';
import { ensureFreshPlatformConnection, hasUsablePlatformAccessToken } from './platforms/connectionAuth';
import { MetaCommentItem, metaService } from './platforms/meta';
import { XMentionComment, xService } from './platforms/x';

type SupportedCommentPlatform = 'X' | 'Instagram' | 'Facebook' | 'Threads';
type ReplyFrequency = 'instant' | '5min' | '15min' | '30min' | '1hr';
type ReplyThrottle = 'low' | 'medium' | 'high';

type PlatformBlacklist = {
    active: boolean;
    usernames: string;
    keywords: string;
    noEmojiOnly: boolean;
    noLinks: boolean;
    pauseOldPosts: boolean;
    pauseAfterHours: string;
};

type CommentAutomationSettings = {
    commentRepliesActive: boolean;
    commentReplyFrequency: ReplyFrequency;
    commentThrottle: ReplyThrottle;
    commentReplyModel: AIModel;
    commentReplyTemperature: number;
    commentReplyTone: string;
    commentReplyMaxLength: number;
    commentReplyPrompt: string;
    xCommentBlacklist: PlatformBlacklist;
    instagramCommentBlacklist: PlatformBlacklist;
    facebookCommentBlacklist: PlatformBlacklist;
    threadsCommentBlacklist: PlatformBlacklist;
};

type PolledComment = {
    platform: SupportedCommentPlatform;
    commentId: string;
    postId: string;
    username: string;
    userId?: string;
    content: string;
    createdAt: Date;
    parentPostCreatedAt?: Date;
    postText?: string;
};

type PlatformReadiness = {
    platform: SupportedCommentPlatform;
    enabled: boolean;
    connected: boolean;
    ready: boolean;
    username?: string;
    reasons: string[];
};

const COMMENT_SETTINGS_KEYS = [
    'commentRepliesActive',
    'commentReplyFrequency',
    'commentThrottle',
    'commentReplyModel',
    'commentReplyTemperature',
    'commentReplyTone',
    'commentReplyMaxLength',
    'commentReplyPrompt',
    'xCommentBlacklist',
    'instagramCommentBlacklist',
    'facebookCommentBlacklist',
    'threadsCommentBlacklist',
] as const;

const DEFAULT_PLATFORM_BLACKLIST: PlatformBlacklist = {
    active: false,
    usernames: '',
    keywords: '',
    noEmojiOnly: false,
    noLinks: false,
    pauseOldPosts: false,
    pauseAfterHours: '24',
};

const POLL_TIMESTAMP_KEY = 'commentAutomationLastPollAt';
const PROCESS_TIMESTAMP_KEY = 'commentAutomationLastProcessAt';
const THREADS_UNSUPPORTED_REASON = 'Threads comment polling/reply publishing is not supported by the current API scopes in this build.';
const TEST_REPLY_MESSAGE = 'Screndly test reply: comment automation connection confirmed.';
const LEGACY_COMMENT_PROMPT = `You are a social media comment writer for Screen Render, a movie and TV trailer news platform. Create engaging, platform-optimized comments for video content.

INPUT: Video title, description, and content
OUTPUT: Engaging social media comment with emojis, hashtags, and hook

Guidelines:
- Hook in first line (7-10 words max)
- Include 3 relevant emoji and hashtags
- Add 2-3 strategically placed emojis
- Keep total under {maxLength} characters for platform compatibility
- Match the tone of the video content
- No generic "Check this out" openers
- Focus on the key news or reveal from the video
- Make it shareable and clickable`;
const DEFAULT_COMMENT_PROMPT = `Write replies for Screen Render like a real person running the account.

Goal:
- reply to the actual comment
- sound natural, specific, and human
- stay grounded in the post or trailer context

Rules:
- no hashtags
- no promo language
- no generic filler like "Thanks for your comment" or "Stay tuned"
- no forced hooks
- no emoji spam; use at most one emoji only when it feels natural
- match the mood of the commenter
- if they are excited, meet the energy
- if they are skeptical, stay calm and conversational
- if they ask a question, answer briefly using only the provided context
- keep it short, clear, and platform-native`;
const PLATFORM_BLACKLIST_KEYS: Record<SupportedCommentPlatform, keyof CommentAutomationSettings> = {
    X: 'xCommentBlacklist',
    Instagram: 'instagramCommentBlacklist',
    Facebook: 'facebookCommentBlacklist',
    Threads: 'threadsCommentBlacklist',
};

function parseJsonObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            return {};
        }
    }

    return {};
}

function parseJsonBoolean(value: unknown): boolean {
    return value === true;
}

function parseJsonStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeBlacklist(value: unknown): PlatformBlacklist {
    const raw = parseJsonObject(value);
    return {
        active: Boolean(raw.active),
        usernames: typeof raw.usernames === 'string' ? raw.usernames : '',
        keywords: typeof raw.keywords === 'string' ? raw.keywords : '',
        noEmojiOnly: Boolean(raw.noEmojiOnly),
        noLinks: Boolean(raw.noLinks),
        pauseOldPosts: Boolean(raw.pauseOldPosts),
        pauseAfterHours: typeof raw.pauseAfterHours === 'string' && raw.pauseAfterHours.trim()
            ? raw.pauseAfterHours
            : DEFAULT_PLATFORM_BLACKLIST.pauseAfterHours,
    };
}

function normalizeReplyFrequency(value: unknown): ReplyFrequency {
    switch (value) {
        case 'instant':
        case '5min':
        case '15min':
        case '30min':
        case '1hr':
            return value;
        default:
            return 'instant';
    }
}

function normalizeThrottle(value: unknown): ReplyThrottle {
    switch (value) {
        case 'low':
        case 'medium':
        case 'high':
            return value;
        default:
            return 'low';
    }
}

function parseBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
    }

    return fallback;
}

function parseNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
}

function normalizeCommentPrompt(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
        return DEFAULT_COMMENT_PROMPT;
    }

    const trimmed = value.trim();
    if (trimmed === LEGACY_COMMENT_PROMPT.trim()) {
        return DEFAULT_COMMENT_PROMPT;
    }

    return trimmed;
}

function splitCsvValues(input: string): string[] {
    return input
        .split(/[\n,]/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
}

function isEmojiOnlyComment(text: string): boolean {
    const stripped = text
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .trim();
    return stripped.length === 0;
}

function containsLink(text: string): boolean {
    return /(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(text);
}

function minutesForFrequency(frequency: ReplyFrequency): number {
    switch (frequency) {
        case '5min':
            return 5;
        case '15min':
            return 15;
        case '30min':
            return 30;
        case '1hr':
            return 60;
        case 'instant':
        default:
            return 0;
    }
}

function throttleLimitPerHour(throttle: ReplyThrottle): number {
    switch (throttle) {
        case 'medium':
            return 15;
        case 'high':
            return 30;
        case 'low':
        default:
            return 5;
    }
}

function parseDateSetting(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isOlderThanHours(date: Date | undefined, hours: number): boolean {
    if (!date || Number.isNaN(date.getTime())) {
        return false;
    }

    return Date.now() - date.getTime() > hours * 60 * 60 * 1000;
}

async function upsertJsonSetting(key: string, value: unknown): Promise<void> {
    await prisma.setting.upsert({
        where: { key },
        update: { value: value as Prisma.InputJsonValue },
        create: { key, value: value as Prisma.InputJsonValue },
    });
}

class CommentsService {
    private async getSettings(): Promise<CommentAutomationSettings> {
        const settings = await prisma.setting.findMany({
            where: {
                key: {
                    in: [...COMMENT_SETTINGS_KEYS, POLL_TIMESTAMP_KEY, PROCESS_TIMESTAMP_KEY],
                },
            },
        });

        const map = new Map(settings.map((setting) => [setting.key, setting.value]));

        return {
            commentRepliesActive: parseBoolean(map.get('commentRepliesActive'), true),
            commentReplyFrequency: normalizeReplyFrequency(map.get('commentReplyFrequency')),
            commentThrottle: normalizeThrottle(map.get('commentThrottle')),
            commentReplyModel: normalizeAIModel(
                typeof map.get('commentReplyModel') === 'string' ? String(map.get('commentReplyModel')) : null,
                DEFAULT_OPENAI_MODEL,
            ),
            commentReplyTemperature: Math.min(Math.max(parseNumber(map.get('commentReplyTemperature'), 0.9), 0), 1.5),
            commentReplyTone: typeof map.get('commentReplyTone') === 'string' && String(map.get('commentReplyTone')).trim()
                ? String(map.get('commentReplyTone')).trim()
                : 'Natural and conversational',
            commentReplyMaxLength: Math.min(Math.max(Math.round(parseNumber(map.get('commentReplyMaxLength'), 220)), 40), 280),
            commentReplyPrompt: normalizeCommentPrompt(map.get('commentReplyPrompt')),
            xCommentBlacklist: normalizeBlacklist(map.get('xCommentBlacklist')),
            instagramCommentBlacklist: normalizeBlacklist(map.get('instagramCommentBlacklist')),
            facebookCommentBlacklist: normalizeBlacklist(map.get('facebookCommentBlacklist')),
            threadsCommentBlacklist: normalizeBlacklist(map.get('threadsCommentBlacklist')),
        };
    }

    private async getRunTimestamp(key: string): Promise<Date | null> {
        const setting = await prisma.setting.findUnique({ where: { key } });
        return parseDateSetting(setting?.value);
    }

    private async shouldRun(key: string, frequency: ReplyFrequency): Promise<boolean> {
        const minutes = minutesForFrequency(frequency);
        if (minutes <= 0) {
            return true;
        }

        const lastRun = await this.getRunTimestamp(key);
        if (!lastRun) {
            return true;
        }

        return Date.now() - lastRun.getTime() >= minutes * 60 * 1000;
    }

    private async touchRunTimestamp(key: string): Promise<void> {
        await upsertJsonSetting(key, new Date().toISOString());
    }

    private getBlacklistForPlatform(
        settings: CommentAutomationSettings,
        platform: SupportedCommentPlatform
    ): PlatformBlacklist {
        switch (platform) {
            case 'X':
                return settings.xCommentBlacklist;
            case 'Instagram':
                return settings.instagramCommentBlacklist;
            case 'Facebook':
                return settings.facebookCommentBlacklist;
            case 'Threads':
                return settings.threadsCommentBlacklist;
        }
    }

    private async getEnabledConnections(
        settings: CommentAutomationSettings
    ): Promise<Array<{ platform: SupportedCommentPlatform; connection: PlatformConnection | null }>> {
        const platforms: SupportedCommentPlatform[] = ['X', 'Instagram', 'Facebook', 'Threads'];
        const results: Array<{ platform: SupportedCommentPlatform; connection: PlatformConnection | null }> = [];

        for (const platform of platforms) {
            const blacklist = this.getBlacklistForPlatform(settings, platform);
            if (!blacklist.active) {
                results.push({ platform, connection: null });
                continue;
            }

            const baseConnection = await findPlatformConnection(platform);
            const connection = await ensureFreshPlatformConnection(baseConnection);
            results.push({ platform, connection });
        }

        return results;
    }

    async getAutomationReadiness(): Promise<PlatformReadiness[]> {
        const settings = await this.getSettings();
        const connections = await this.getEnabledConnections(settings);

        return connections.map(({ platform, connection }) => {
            const blacklist = this.getBlacklistForPlatform(settings, platform);
            const enabled = blacklist.active;
            const connected = hasUsablePlatformAccessToken(connection);
            const reasons: string[] = [];
            const metadata = parseJsonObject(connection?.metadata);
            const threadsScopesGranted = parseJsonBoolean(metadata.automationReplyScopesGranted);
            const requiredAutomationScopes = parseJsonStringArray(metadata.requiredAutomationScopes);
            const automationReplyScopesGranted = parseJsonBoolean(metadata.automationReplyScopesGranted);

            if (!enabled) {
                reasons.push('Disabled in Comment Automation settings');
            }

            if (!connected) {
                reasons.push('Platform is not connected in Platforms');
            }

            if (platform === 'Threads' && connected && !threadsScopesGranted) {
                reasons.push('Reconnect Threads to grant threads_read_replies and threads_manage_replies.');
            }

            if (platform === 'Instagram' && connected && !automationReplyScopesGranted) {
                reasons.push(
                    requiredAutomationScopes.length > 0
                        ? `Reconnect Instagram to grant ${requiredAutomationScopes.join(', ')}.`
                        : 'Reconnect Instagram to grant comment-management access.'
                );
            }

            if (platform === 'Facebook' && connected && !automationReplyScopesGranted) {
                reasons.push(
                    requiredAutomationScopes.length > 0
                        ? `Reconnect Facebook to grant ${requiredAutomationScopes.join(', ')}.`
                        : 'Reconnect Facebook to grant comment-management access.'
                );
            }

            const ready =
                enabled
                && connected
                && (platform !== 'Threads' || threadsScopesGranted)
                && (platform !== 'Instagram' || automationReplyScopesGranted)
                && (platform !== 'Facebook' || automationReplyScopesGranted);

            return {
                platform,
                enabled,
                connected,
                ready,
                username: connection?.username || undefined,
                reasons,
            };
        });
    }

    async pollComments(): Promise<void> {
        const settings = await this.getSettings();
        if (!settings.commentRepliesActive) {
            return;
        }

        if (!(await this.shouldRun(POLL_TIMESTAMP_KEY, settings.commentReplyFrequency))) {
            return;
        }

        const readiness = await this.getAutomationReadiness();
        const since = await this.getRunTimestamp(POLL_TIMESTAMP_KEY);

        for (const platformState of readiness) {
            if (!platformState.ready) {
                continue;
            }

            try {
                switch (platformState.platform) {
                    case 'X':
                        await this.pollXComments(since);
                        break;
                    case 'Facebook':
                        await this.pollFacebookComments(since);
                        break;
                    case 'Instagram':
                        await this.pollInstagramComments(since);
                        break;
                    case 'Threads':
                        await this.pollThreadsComments(since);
                        break;
                }
            } catch (error) {
                console.error(`[Comments] Failed polling ${platformState.platform}:`, error);
            }
        }

        await this.touchRunTimestamp(POLL_TIMESTAMP_KEY);
    }

    async processUnrepliedComments(): Promise<void> {
        const settings = await this.getSettings();
        if (!settings.commentRepliesActive) {
            return;
        }

        if (!(await this.shouldRun(PROCESS_TIMESTAMP_KEY, settings.commentReplyFrequency))) {
            return;
        }

        const readiness = await this.getAutomationReadiness();
        const readyPlatforms = readiness.filter((item) => item.ready).map((item) => item.platform);
        if (readyPlatforms.length === 0) {
            return;
        }

        const pendingComments = await prisma.comment.findMany({
            where: {
                processed: false,
                blacklisted: false,
                platform: { in: readyPlatforms },
            },
            orderBy: { createdAt: 'asc' },
            take: 100,
        });

        for (const comment of pendingComments) {
            const hourlyReplies = await this.getRepliesLastHour(comment.platform);
            if (hourlyReplies >= throttleLimitPerHour(settings.commentThrottle)) {
                break;
            }

            try {
                await this.processSingleComment(comment, settings);
            } catch (error) {
                console.error(`[Comments] Failed processing ${comment.platform} comment ${comment.commentId}:`, error);
            }
        }

        await this.touchRunTimestamp(PROCESS_TIMESTAMP_KEY);
    }

    async sendTestReply(platform: SupportedCommentPlatform): Promise<{
        platform: SupportedCommentPlatform;
        commentId: string;
        username: string;
        reply: string;
    }> {
        const readiness = await this.getAutomationReadiness();
        const platformState = readiness.find((item) => item.platform === platform);

        if (!platformState?.ready) {
            throw new Error(platformState?.reasons[0] || `${platform} is not ready for comment automation.`);
        }

        const recentComments = await this.fetchRecentCommentsForPlatform(platform);
        if (recentComments.length === 0) {
            throw new Error(`No recent ${platform} comments were found to test against.`);
        }

        await this.persistPolledComments(platform, recentComments);

        const candidate = await prisma.comment.findFirst({
            where: {
                platform,
                processed: false,
                blacklisted: false,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!candidate) {
            throw new Error(`No eligible recent ${platform} comments were available for a test reply.`);
        }

        await this.replyToComment(platform, candidate.commentId, TEST_REPLY_MESSAGE);
        await this.markProcessed(candidate.id, TEST_REPLY_MESSAGE);

        return {
            platform,
            commentId: candidate.commentId,
            username: candidate.username,
            reply: TEST_REPLY_MESSAGE,
        };
    }

    private async pollXComments(since: Date | null): Promise<void> {
        const connection = await ensureFreshPlatformConnection(await findPlatformConnection('X'));
        if (!connection || !hasUsablePlatformAccessToken(connection)) {
            return;
        }

        const mentions = await xService.getRecentMentions(connection, since || undefined);
        await this.persistPolledComments('X', mentions);
    }

    private async pollFacebookComments(since: Date | null): Promise<void> {
        const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Facebook'));
        if (!connection || !hasUsablePlatformAccessToken(connection) || !connection.userId) {
            return;
        }

        const comments = await metaService.getRecentFacebookComments(
            connection.userId,
            connection.accessToken || '',
            since || undefined
        );
        await this.persistPolledComments('Facebook', comments);
    }

    private async pollInstagramComments(since: Date | null): Promise<void> {
        const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Instagram'));
        if (!connection || !hasUsablePlatformAccessToken(connection) || !connection.userId) {
            return;
        }

        const comments = await metaService.getRecentInstagramComments(
            connection.userId,
            connection.accessToken || '',
            since || undefined
        );
        await this.persistPolledComments('Instagram', comments);
    }

    private async pollThreadsComments(since: Date | null): Promise<void> {
        const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Threads'));
        if (!connection || !hasUsablePlatformAccessToken(connection) || !connection.userId) {
            return;
        }

        const metadata = parseJsonObject(connection.metadata);
        if (!parseJsonBoolean(metadata.automationReplyScopesGranted)) {
            return;
        }

        const comments = await metaService.getRecentThreadsReplies(
            connection.userId,
            connection.accessToken || '',
            since || undefined
        );
        await this.persistPolledComments('Threads', comments);
    }

    private async persistPolledComments(
        platform: SupportedCommentPlatform,
        comments: Array<XMentionComment | MetaCommentItem>
    ): Promise<void> {
        const settings = await this.getSettings();
        const blacklist = this.getBlacklistForPlatform(settings, platform);

        for (const item of comments) {
            const isBlacklisted = this.shouldBlacklist(item, blacklist);
            await prisma.comment.upsert({
                where: {
                    platform_commentId: {
                        platform,
                        commentId: item.commentId,
                    },
                },
                update: {
                    username: item.username,
                    content: item.content,
                    blacklisted: isBlacklisted,
                    postId: item.postId,
                    createdAt: item.createdAt,
                },
                create: {
                    platform,
                    commentId: item.commentId,
                    postId: item.postId,
                    username: item.username,
                    content: item.content,
                    blacklisted: isBlacklisted,
                    createdAt: item.createdAt,
                },
            });
        }
    }

    private summarizePostContext(text?: string): string {
        if (typeof text !== 'string') {
            return '';
        }

        return text
            .replace(/\s+/g, ' ')
            .replace(/https?:\/\/\S+/gi, '')
            .trim()
            .slice(0, 320);
    }

    private async getPostContext(
        platform: SupportedCommentPlatform,
        postId: string
    ): Promise<{ text?: string; title?: string; createdAt?: Date }> {
        try {
            switch (platform) {
                case 'X': {
                    const connection = await ensureFreshPlatformConnection(await findPlatformConnection('X'));
                    if (!connection || !hasUsablePlatformAccessToken(connection)) {
                        return {};
                    }
                    return xService.getTweetContext(postId, connection);
                }
                case 'Facebook': {
                    const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Facebook'));
                    if (!connection || !hasUsablePlatformAccessToken(connection)) {
                        return {};
                    }
                    return metaService.getFacebookPostContext(postId, connection.accessToken || '');
                }
                case 'Instagram': {
                    const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Instagram'));
                    if (!connection || !hasUsablePlatformAccessToken(connection)) {
                        return {};
                    }
                    return metaService.getInstagramPostContext(postId, connection.accessToken || '');
                }
                case 'Threads': {
                    const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Threads'));
                    if (!connection || !hasUsablePlatformAccessToken(connection)) {
                        return {};
                    }
                    return metaService.getThreadsPostContext(postId, connection.accessToken || '');
                }
            }
        } catch (error) {
            console.warn(`[Comments] Failed to fetch ${platform} post context for ${postId}:`, error);
        }

        return {};
    }

    private async fetchRecentCommentsForPlatform(
        platform: SupportedCommentPlatform
    ): Promise<Array<XMentionComment | MetaCommentItem>> {
        switch (platform) {
            case 'X': {
                const connection = await ensureFreshPlatformConnection(await findPlatformConnection('X'));
                if (!connection || !hasUsablePlatformAccessToken(connection)) {
                    throw new Error('X is not connected');
                }
                return xService.getRecentMentions(connection);
            }
            case 'Facebook': {
                const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Facebook'));
                if (!connection || !hasUsablePlatformAccessToken(connection) || !connection.userId) {
                    throw new Error('Facebook is not connected');
                }
                return metaService.getRecentFacebookComments(connection.userId, connection.accessToken || '');
            }
            case 'Instagram': {
                const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Instagram'));
                if (!connection || !hasUsablePlatformAccessToken(connection) || !connection.userId) {
                    throw new Error('Instagram is not connected');
                }
                return metaService.getRecentInstagramComments(connection.userId, connection.accessToken || '');
            }
            case 'Threads': {
                const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Threads'));
                if (!connection || !hasUsablePlatformAccessToken(connection) || !connection.userId) {
                    throw new Error('Threads is not connected');
                }
                const metadata = parseJsonObject(connection.metadata);
                if (!parseJsonBoolean(metadata.automationReplyScopesGranted)) {
                    throw new Error('Reconnect Threads to grant threads_read_replies and threads_manage_replies.');
                }
                return metaService.getRecentThreadsReplies(connection.userId, connection.accessToken || '');
            }
        }
    }

    private async replyToComment(
        platform: SupportedCommentPlatform,
        commentId: string,
        reply: string
    ): Promise<void> {
        let result: { success: boolean; error?: string } = { success: false, error: 'Unsupported comment platform' };

        switch (platform) {
            case 'X': {
                const connection = await ensureFreshPlatformConnection(await findPlatformConnection('X'));
                if (!connection || !hasUsablePlatformAccessToken(connection)) {
                    throw new Error('X is not connected');
                }
                result = await xService.replyToTweet(commentId, reply, connection);
                break;
            }
            case 'Facebook': {
                const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Facebook'));
                if (!connection || !hasUsablePlatformAccessToken(connection)) {
                    throw new Error('Facebook is not connected');
                }
                result = await metaService.replyToFacebookComment(commentId, reply, connection.accessToken || '');
                break;
            }
            case 'Instagram': {
                const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Instagram'));
                if (!connection || !hasUsablePlatformAccessToken(connection)) {
                    throw new Error('Instagram is not connected');
                }
                result = await metaService.replyToInstagramComment(commentId, reply, connection.accessToken || '');
                break;
            }
            case 'Threads': {
                const connection = await ensureFreshPlatformConnection(await findPlatformConnection('Threads'));
                if (!connection || !hasUsablePlatformAccessToken(connection) || !connection.userId) {
                    throw new Error('Threads is not connected');
                }
                const metadata = parseJsonObject(connection.metadata);
                if (!parseJsonBoolean(metadata.automationReplyScopesGranted)) {
                    throw new Error('Reconnect Threads to grant threads_read_replies and threads_manage_replies.');
                }
                result = await metaService.replyToThreadsReply(
                    connection.userId,
                    commentId,
                    reply,
                    connection.accessToken || '',
                );
                break;
            }
        }

        if (!result.success) {
            throw new Error(result.error || `Failed to reply on ${platform}`);
        }
    }

    private shouldBlacklist(item: PolledComment | XMentionComment | MetaCommentItem, blacklist: PlatformBlacklist): boolean {
        if (!blacklist.active) {
            return false;
        }

        const username = item.username.trim().toLowerCase();
        if (username && splitCsvValues(blacklist.usernames).includes(username)) {
            return true;
        }

        const content = item.content.trim();
        const loweredContent = content.toLowerCase();

        if (splitCsvValues(blacklist.keywords).some((keyword) => loweredContent.includes(keyword))) {
            return true;
        }

        if (blacklist.noEmojiOnly && isEmojiOnlyComment(content)) {
            return true;
        }

        if (blacklist.noLinks && containsLink(content)) {
            return true;
        }

        if (blacklist.pauseOldPosts) {
            const pauseHours = Number.parseInt(blacklist.pauseAfterHours || '24', 10);
            if (Number.isFinite(pauseHours) && pauseHours > 0 && isOlderThanHours(item.parentPostCreatedAt, pauseHours)) {
                return true;
            }
        }

        return false;
    }

    private async processSingleComment(comment: Comment, settings: CommentAutomationSettings): Promise<void> {
        const platform = comment.platform as SupportedCommentPlatform;
        const blacklist = this.getBlacklistForPlatform(settings, platform);

        const derivedItem: PolledComment = {
            platform,
            commentId: comment.commentId,
            postId: comment.postId,
            username: comment.username,
            content: comment.content,
            createdAt: comment.createdAt,
        };

        if (this.shouldBlacklist(derivedItem, blacklist)) {
            await this.markBlacklisted(comment.id);
            return;
        }

        const postContext = await this.getPostContext(platform, comment.postId);
        const postSummary = this.summarizePostContext(postContext.text);
        const description = postSummary || postContext.title || 'Social post about film and TV news';
        const tone = settings.commentReplyTone;
        const customPrompt = settings.commentReplyPrompt
            ? `${settings.commentReplyPrompt}\n\nExtra runtime rules:\n- Reply naturally to the actual comment.\n- Use the supplied post context when relevant.\n- Avoid generic brand-template phrasing.\n- Keep it under ${settings.commentReplyMaxLength} characters.`
            : undefined;

        const reply = await generateCommentReply(
            {
                originalComment: comment.content,
                platform,
                description,
                tone,
                maxLength: settings.commentReplyMaxLength,
                username: comment.username,
                postTitle: postContext.title,
                postText: postSummary,
            },
            settings.commentReplyModel,
            customPrompt,
            settings.commentReplyTemperature,
        );

        await this.replyToComment(platform, comment.commentId, reply);
        await this.markProcessed(comment.id, reply);
    }

    private async getRepliesLastHour(platform?: string): Promise<number> {
        const where = {
            repliedAt: {
                gte: new Date(Date.now() - 60 * 60 * 1000),
            },
            ...(platform ? { platform } : {}),
        };

        return prisma.comment.count({ where });
    }

    private async markBlacklisted(commentId: string): Promise<void> {
        await prisma.comment.update({
            where: { id: commentId },
            data: {
                blacklisted: true,
                processed: true,
            },
        });
    }

    private async markProcessed(commentId: string, reply: string): Promise<void> {
        await prisma.comment.update({
            where: { id: commentId },
            data: {
                processed: true,
                reply,
                repliedAt: new Date(),
            },
        });
    }
}

export const commentsService = new CommentsService();
