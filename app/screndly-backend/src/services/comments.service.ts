
import prisma from '../lib/prisma';
import aiService from './ai.service';
import { notificationService } from './notification.service';

interface CommentSettings {
    commentReplyFrequency: string;
    commentThrottle: 'low' | 'medium' | 'high';
    commentReplyModel: string;
    xCommentBlacklist?: PlatformBlacklist;
    threadsCommentBlacklist?: PlatformBlacklist;
    facebookCommentBlacklist?: PlatformBlacklist;
    instagramCommentBlacklist?: PlatformBlacklist;
    youtubeCommentBlacklist?: PlatformBlacklist;
    tiktokCommentBlacklist?: PlatformBlacklist;
    pinterestCommentBlacklist?: PlatformBlacklist;
}

interface PlatformBlacklist {
    active: boolean;
    usernames: string;
    keywords: string;
    noEmojiOnly: boolean;
    noLinks: boolean;
    pauseOldPosts: boolean;
    pauseAfterHours: string | number;
}

export class CommentsService {

    /**
     * Main entry point called by Cron
     */
    async processUnrepliedComments() {
        console.log('[CommentsService] Starting processing cycle...');
        console.warn('[CommentsService] Automated platform reply publishing is not configured yet. Skipping reply cycle.');
        return;
    }

    private async processSingleComment(comment: any, settings: CommentSettings) {
        const platform = comment.platform.toLowerCase(); // x, threads, etc.
        const blacklist = this.getBlacklistForPlatform(platform, settings);

        // --- FILTERING LOGIC ---

        // 1. Blacklist Active?
        if (blacklist && blacklist.active) {
            // Username Check
            if (blacklist.usernames) {
                const blockedUsers = blacklist.usernames.split(',').map(u => u.trim().toLowerCase());
                if (blockedUsers.includes(comment.username.toLowerCase())) {
                    await this.markBlacklisted(comment.id, 'Blocked User');
                    return;
                }
            }

            // Keyword Check
            if (blacklist.keywords) {
                const blockedKeywords = blacklist.keywords.split(',').map(k => k.trim().toLowerCase());
                const contentLower = comment.content.toLowerCase();
                if (blockedKeywords.some(k => contentLower.includes(k))) {
                    await this.markBlacklisted(comment.id, 'Blocked Keyword');
                    return;
                }
            }

            // Emoji Only Check
            if (blacklist.noEmojiOnly) {
                // Regex matches string that is ONLY emojis and whitespace
                const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\s]+$/u;
                if (emojiRegex.test(comment.content)) {
                    await this.markProcessed(comment.id, false, 'Emoji only skipped');
                    return;
                }
            }

            // Link Check
            if (blacklist.noLinks) {
                const linkRegex = /(https?:\/\/[^\s]+)/g;
                if (linkRegex.test(comment.content)) {
                    await this.markProcessed(comment.id, false, 'Link skipped');
                    return;
                }
            }

            // Old Post Check
            if (blacklist.pauseOldPosts) {
                // Here we would check the Post's age. 
                // Since we don't strictly have the post record joined here, we assume 'createdAt' of comment 
                // implies recent activity, OR we fetch the post. For now, we assume if comment is old, we skip?
                // Actually user settings says "Pause replies for posts older than X".
                // We'll skip this check if we don't have post date, but for now let's check comment age as proxy or strict logic if we had Post model.
                // Assuming we want to skip replying to *old comments* that we just ingested?
                const ageHours = (Date.now() - new Date(comment.createdAt).getTime()) / (1000 * 60 * 60);
                const limit = Number(blacklist.pauseAfterHours) || 24;
                if (ageHours > limit) {
                    await this.markProcessed(comment.id, false, 'Old comment skipped');
                    return;
                }
            }
        }

        // --- GENERATION LOGIC ---

        try {
            console.log(`[CommentsService] Generating reply for ${comment.id} (${comment.platform})...`);

            const reply = await aiService.generateCommentReply(
                {
                    originalComment: comment.content,
                    platform: comment.platform as any,
                    description: `Reply to ${comment.username}`
                },
                settings.commentReplyModel as any
            );

            // --- PUBLISHING LOGIC ---
            // TODO: Call actual platform API here
            // await platformService.postReply(platform, comment.commentId, reply);

            // Save Success
            await prisma.comment.update({
                where: { id: comment.id },
                data: {
                    reply: reply,
                    repliedAt: new Date(),
                    processed: true
                }
            });

            console.log(`[CommentsService] Replied to ${comment.id}`);

        } catch (error) {
            console.error(`[CommentsService] Failed to reply to ${comment.id}:`, error);
            // Don't mark processed so we retry? Or mark processed with error?
            // Let's mark processed to avoid loop, but log error
            // Actually, better to leave unprocessed for retry, but maybe add retry count?
            // For simplicity/safety, we skip for now.
        }
    }

    /**
     * Poll platforms for new comments (Stub)
     */
    async pollComments() {
        console.warn('[CommentsService] Comment polling is not configured yet. Skipping poll cycle.');
    }

    // --- HELPERS ---

    private getThrottleLimit(level: string): number {
        switch (level) {
            case 'low': return 5;
            case 'medium': return 20;
            case 'high': return 50;
            default: return 50;
        }
    }

    private async getRepliesLastHour(): Promise<number> {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return await prisma.comment.count({
            where: {
                repliedAt: {
                    gte: oneHourAgo
                }
            }
        });
    }

    private async markBlacklisted(id: string, reason: string) {
        console.log(`[CommentsService] Blacklisting comment ${id}: ${reason}`);
        await prisma.comment.update({
            where: { id },
            data: { blacklisted: true, processed: true }
        });
    }

    private async markProcessed(id: string, replied: boolean, reason: string) {
        console.log(`[CommentsService] Skipping comment ${id}: ${reason}`);
        await prisma.comment.update({
            where: { id },
            data: { processed: true } // No reply date
        });
    }

    private getBlacklistForPlatform(platform: string, settings: CommentSettings): PlatformBlacklist | undefined {
        const p = platform.toLowerCase();
        if (p.includes('x') || p.includes('twitter')) return settings.xCommentBlacklist;
        if (p.includes('thread')) return settings.threadsCommentBlacklist;
        if (p.includes('facebook')) return settings.facebookCommentBlacklist;
        if (p.includes('insta')) return settings.instagramCommentBlacklist;
        if (p.includes('youtu')) return settings.youtubeCommentBlacklist;
        if (p.includes('tiktok')) return settings.tiktokCommentBlacklist;
        if (p.includes('pinterest')) return settings.pinterestCommentBlacklist;
        return undefined;
    }

    private async getSettings(): Promise<CommentSettings | null> {
        const keys = [
            'commentReplyFrequency', 'commentThrottle', 'commentReplyModel',
            'xCommentBlacklist', 'threadsCommentBlacklist', 'facebookCommentBlacklist',
            'instagramCommentBlacklist', 'youtubeCommentBlacklist', 'tiktokCommentBlacklist',
            'pinterestCommentBlacklist', 'commentRetention'
        ];

        const settings = await prisma.setting.findMany({
            where: { key: { in: keys } }
        });

        if (settings.length === 0) return null;

        const result: any = {};
        settings.forEach(s => {
            result[s.key] = s.value;
        });

        return result as CommentSettings;
    }
}

export const commentsService = new CommentsService();
