import prisma from '../lib/prisma';
import Parser from 'rss-parser';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import { publisherService, PublishContent } from './publisher.service';
import aiService from './ai.service';
import { notificationService } from './notification.service';
import { resolveYouTubeChannel } from './youtube-channel-resolver';
import {
    enrichYouTubeVideoMetadata,
    generateLandscapeThumbnail,
    generateSocialPosterThumbnail,
    generateYouTubePublishMetadata,
    getYouTubeRuntimeSettings,
    type LoadedVideoSettings,
    type PlatformThumbnailAsset,
} from './video-enrichment.service';

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

interface PlatformAutomationSettings {
    autoPost?: boolean;
    autoThumbnail?: boolean;
    autoCaption?: boolean;
    autoHashtag?: boolean;
}

interface GeneratedCaptions {
    generated?: string;
    fallback: string;
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

export class YouTubePollerService {
    private isPolling = false;

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
                        results.push({
                            channelId: channel.channelId,
                            channelName: channel.name,
                            checked: false,
                            skipped: true,
                            newVideoDetected: false,
                            published: false,
                            failed: false,
                            message: 'Skipped until next polling window'
                        });
                        continue;
                    }
                }

                results.push(await this.processChannel(channel, settings));
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

    private async processChannel(channel: any, settings: LoadedVideoSettings): Promise<ChannelPollResult> {
        let activeChannel = channel;

        try {
            activeChannel = await this.ensureCanonicalChannel(channel);

            const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${activeChannel.channelId}`);
            if (!feed.items || feed.items.length === 0) {
                await prisma.channel.update({
                    where: { id: activeChannel.id },
                    data: { lastCheck: new Date() }
                });

                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: false,
                    published: false,
                    failed: false,
                    message: 'No videos found in feed'
                };
            }

            const latestVideos = feed.items.sort((a, b) => {
                return new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime();
            });

            const video = latestVideos[0];
            const videoId = this.extractVideoId(video.link || '', video.id || '');

            if (!videoId) {
                await prisma.channel.update({
                    where: { id: activeChannel.id },
                    data: { lastCheck: new Date() }
                });

                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: false,
                    published: false,
                    failed: false,
                    message: 'Latest feed item did not include a usable video ID'
                };
            }

            const existing = await prisma.feedItem.findUnique({ where: { videoId } });
            if (existing) {
                await prisma.channel.update({
                    where: { id: activeChannel.id },
                    data: { lastCheck: new Date() }
                });

                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: false,
                    published: false,
                    failed: false,
                    message: 'Latest video already processed'
                };
            }

            const pubDate = new Date(video.pubDate || Date.now());
            const hoursSince = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
            if (hoursSince > 24) {
                await this.markAsProcessed(videoId, activeChannel.channelId, video.title || '', pubDate);
                await prisma.channel.update({
                    where: { id: activeChannel.id },
                    data: { lastCheck: new Date(), videoCount: { increment: 1 } }
                });

                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: false,
                    published: false,
                    failed: false,
                    message: 'Skipped older video outside polling freshness window'
                };
            }

            const titleLower = (video.title || '').toLowerCase();
            if (settings.advancedFilters) {
                const keywords = settings.advancedFilters
                    .split(',')
                    .map((keyword: string) => keyword.trim().toLowerCase())
                    .filter(Boolean);
                const isTrailer = keywords.some((keyword: string) => titleLower.includes(keyword));

                if (!isTrailer) {
                    await this.markAsProcessed(videoId, activeChannel.channelId, video.title || '', pubDate);
                    await prisma.channel.update({
                        where: { id: activeChannel.id },
                        data: { lastCheck: new Date(), videoCount: { increment: 1 } }
                    });

                    return {
                        channelId: activeChannel.channelId,
                        channelName: activeChannel.name,
                        checked: true,
                        skipped: true,
                        newVideoDetected: false,
                        published: false,
                        failed: false,
                        message: 'Skipped because title did not match trailer filters'
                    };
                }
            }

            let videoInfo;
            try {
                videoInfo = await ytdl.getInfo(video.link || `https://www.youtube.com/watch?v=${videoId}`);
            } catch (error) {
                console.error(`[YouTubePoller] Failed to fetch metadata for ${videoId}:`, error);
                await prisma.channel.update({
                    where: { id: activeChannel.id },
                    data: { lastCheck: new Date() }
                });

                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: false,
                    newVideoDetected: true,
                    published: false,
                    failed: true,
                    message: 'Failed to fetch video metadata'
                };
            }

            const details = videoInfo.videoDetails;
            if (settings.excludeShorts) {
                const isShort =
                    (details.lengthSeconds && parseInt(details.lengthSeconds, 10) < 60) ||
                    titleLower.includes('#shorts');

                if (isShort) {
                    await this.markAsProcessed(videoId, activeChannel.channelId, video.title || '', pubDate);
                    await prisma.channel.update({
                        where: { id: activeChannel.id },
                        data: { lastCheck: new Date(), videoCount: { increment: 1 } }
                    });

                    return {
                        channelId: activeChannel.channelId,
                        channelName: activeChannel.name,
                        checked: true,
                        skipped: true,
                        newVideoDetected: false,
                        published: false,
                        failed: false,
                        message: 'Skipped because video is a Short'
                    };
                }
            }

            const thumbnailUrl = this.getThumbnailUrl(details);
            const enrichedMetadata = await enrichYouTubeVideoMetadata(
                videoId,
                video.title || '',
                details.description || video.contentSnippet || '',
                settings
            );

            if (settings.regionFilter && !enrichedMetadata.regionAllowed) {
                await prisma.channel.update({
                    where: { id: activeChannel.id },
                    data: { lastCheck: new Date() }
                });

                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: false,
                    published: false,
                    failed: false,
                    message: enrichedMetadata.regionReason || 'Skipped by region filter'
                };
            }

            if (settings.videoFilterPrompt) {
                const aiResult = await aiService.generateCompletion({
                    model: settings.videoOpenaiModel,
                    prompt: `Validate this video against rules:
Title: ${video.title}
Channel: ${activeChannel.name}
Duration: ${details.lengthSeconds}s
Description: ${details.description}
Keywords: ${details.keywords?.join(', ')}

Validation Rules:
${settings.videoFilterPrompt}

Respond ONLY "YES" or "NO".`,
                    maxTokens: 10
                });

                if (aiResult.success && aiResult.content.trim().toUpperCase().includes('NO')) {
                    await this.markAsProcessed(videoId, activeChannel.channelId, video.title || '', pubDate);
                    await prisma.channel.update({
                        where: { id: activeChannel.id },
                        data: { lastCheck: new Date(), videoCount: { increment: 1 } }
                    });

                    return {
                        channelId: activeChannel.channelId,
                        channelName: activeChannel.name,
                        checked: true,
                        skipped: true,
                        newVideoDetected: false,
                        published: false,
                        failed: false,
                        message: 'Skipped by AI validation filter'
                    };
                }
            }

            const targetPlatforms = this.getTargetPlatforms(settings);
            if (targetPlatforms.length === 0) {
                await prisma.channel.update({
                    where: { id: activeChannel.id },
                    data: { lastCheck: new Date() }
                });

                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: true,
                    published: false,
                    failed: false,
                    message: 'No connected auto-post platforms were enabled'
                };
            }

            const recentPublishBlock = await this.getRecentPublishBlock(settings.postInterval);
            if (recentPublishBlock) {
                await prisma.channel.update({
                    where: { id: activeChannel.id },
                    data: { lastCheck: new Date() }
                });

                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: true,
                    newVideoDetected: true,
                    published: false,
                    failed: false,
                    message: recentPublishBlock
                };
            }

            console.log(`[YouTubePoller] Downloading ${videoId}...`);
            const downloadPath = await this.downloadVideoWithInfo(videoInfo);
            if (!downloadPath) {
                await prisma.channel.update({
                    where: { id: activeChannel.id },
                    data: { lastCheck: new Date() }
                });

                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: false,
                    newVideoDetected: true,
                    published: false,
                    failed: true,
                    message: 'Failed to download video for publishing'
                };
            }

            const captions = await this.generateCaptions(video, details, settings, enrichedMetadata, targetPlatforms);
            const playlists = await this.detectPlaylists(video, details, settings);
            const youtubeMetadata =
                targetPlatforms.includes('YouTube') && this.isAutoCaptionEnabled('YouTube', settings)
                    ? await generateYouTubePublishMetadata(
                        video.title || '',
                        details.description || video.contentSnippet || '',
                        enrichedMetadata,
                        settings
                    )
                    : this.buildDefaultYouTubeMetadata(video, details, enrichedMetadata);
            const youtubeThumbnail = targetPlatforms.includes('YouTube') && this.isAutoThumbnailEnabled('YouTube', settings)
                ? await generateLandscapeThumbnail('youtube', video.title || '', enrichedMetadata, thumbnailUrl, settings)
                : null;
            const xThumbnail = targetPlatforms.includes('X') && this.isAutoThumbnailEnabled('X', settings)
                ? await generateLandscapeThumbnail('x', video.title || '', enrichedMetadata, thumbnailUrl, settings)
                : null;
            const socialPoster = targetPlatforms.some((platform) => SOCIAL_THUMBNAIL_PLATFORMS.has(platform) && this.isAutoThumbnailEnabled(platform, settings))
                ? await generateSocialPosterThumbnail(video.title || '', enrichedMetadata, thumbnailUrl, settings)
                : null;

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

            if (fs.existsSync(downloadPath)) {
                fs.unlinkSync(downloadPath);
            }
            for (const asset of [youtubeThumbnail, xThumbnail, socialPoster]) {
                if (asset?.localPath && fs.existsSync(asset.localPath)) {
                    fs.unlinkSync(asset.localPath);
                }
            }

            await this.markAsProcessed(videoId, activeChannel.channelId, video.title || '', pubDate);
            await prisma.channel.update({
                where: { id: activeChannel.id },
                data: { lastCheck: new Date(), videoCount: { increment: 1 } }
            });

            if (publishResult.publishedPlatforms.length > 0) {
                await notificationService.notifyUser({
                    title: 'New Trailer Published',
                    message: `${video.title} was posted to ${publishResult.publishedPlatforms.join(', ')}.`,
                    type: 'success',
                    source: 'youtube',
                    actionPage: '/channels'
                });

                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: false,
                    newVideoDetected: true,
                    published: true,
                    failed: false,
                    message: `Published to ${publishResult.publishedPlatforms.join(', ')}`
                };
            }

            if (publishResult.failedPlatforms.length > 0) {
                return {
                    channelId: activeChannel.channelId,
                    channelName: activeChannel.name,
                    checked: true,
                    skipped: false,
                    newVideoDetected: true,
                    published: false,
                    failed: true,
                    message: `Publish failed for ${publishResult.failedPlatforms.join(', ')}`
                };
            }

            return {
                channelId: activeChannel.channelId,
                channelName: activeChannel.name,
                checked: true,
                skipped: true,
                newVideoDetected: true,
                published: false,
                failed: false,
                message: 'No platforms accepted the publish request'
            };
        } catch (error: any) {
            console.error(`[YouTubePoller] Error processing channel ${activeChannel.name}:`, error);
            await prisma.channel.update({
                where: { id: activeChannel.id },
                data: { lastCheck: new Date() }
            }).catch(() => undefined);

            return {
                channelId: activeChannel.channelId,
                channelName: activeChannel.name,
                checked: true,
                skipped: false,
                newVideoDetected: false,
                published: false,
                failed: true,
                message: error.message || 'Unknown channel processing error'
            };
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
        const normalizedCaption = this.buildPlatformCaptionBase(platform, captions, settings);

        return [normalizedCaption, video.link].filter(Boolean).join('\n\n');
    }

    private buildPlatformTitle(
        platform: string,
        captions: GeneratedCaptions,
        video: any,
        settings: LoadedVideoSettings
    ): string {
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

    private async detectPlaylists(video: any, details: any, settings: any): Promise<string[]> {
        if (!settings.videoYoutubePlaylists || !settings.videoYoutubePlaylistPrompt) {
            return [];
        }

        const available = settings.videoYoutubePlaylists
            .split(',')
            .map((value: string) => value.trim())
            .filter(Boolean);

        if (available.length === 0) {
            return [];
        }

        try {
            return await aiService.detectYouTubePlaylists(
                video.title || '',
                details.description || '',
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

    private async downloadVideoWithInfo(info: any): Promise<string | null> {
        try {
            const format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });
            if (!format) {
                return null;
            }

            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir);
            }

            const filePath = path.join(tempDir, `${info.videoDetails.videoId}.mp4`);

            return await new Promise((resolve, reject) => {
                ytdl.downloadFromInfo(info, { format })
                    .pipe(fs.createWriteStream(filePath))
                    .on('finish', () => resolve(filePath))
                    .on('error', (err) => reject(err));
            });
        } catch (error) {
            console.error('[YouTubePoller] Download error:', error);
            return null;
        }
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

    private async markAsProcessed(videoId: string, channelId: string, title: string, publishedAt: Date) {
        await prisma.feedItem.upsert({
            where: { videoId },
            update: {
                title,
                publishedAt
            },
            create: {
                videoId,
                channelId,
                title,
                publishedAt
            }
        });
    }

    private async generateCaptions(
        video: any,
        details: any,
        settings: LoadedVideoSettings,
        metadata: { cleanedTitle: string; tmdbMatch?: { title: string; overview: string } },
        targetPlatforms: string[]
    ): Promise<GeneratedCaptions> {
        const fallback = this.buildFallbackCaption(video, metadata);
        const needsGeneratedCaption = targetPlatforms.some((platform) => this.isAutoCaptionEnabled(platform, settings));

        if (!needsGeneratedCaption) {
            return { fallback };
        }

        const context = {
            videoTitle: metadata.tmdbMatch?.title || metadata.cleanedTitle || video.title,
            channelName: video.author || 'YouTube Channel',
            description: metadata.tmdbMatch?.overview || details.description || video.contentSnippet || '',
            platform: 'X' as const
        };

        const model = settings.videoOpenaiModel || 'gpt-5-mini';
        const customPrompt = settings.videoUniversalCaptionPrompt;

        try {
            const caption = await aiService.generateYouTubeCaption(context, model, customPrompt);
            return { generated: caption, fallback };
        } catch (error) {
            console.error('[YouTubePoller] AI caption generation failed', error);
            return { fallback };
        }
    }
}

export const youtubePollerService = new YouTubePollerService();
