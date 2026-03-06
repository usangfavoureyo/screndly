import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function formatShortDay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function asObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return {};
}

router.get('/stats', authenticate, async (_req, res) => {
  try {
    const today = startOfToday();
    const sevenDaysAgo = daysAgo(6);
    const thirtyDaysAgo = daysAgo(30);

    const [
      systemErrors,
      dailyFailures,
      dailySuccess,
      comments,
      activeUploads,
      completedUploadsToday,
      activePipelines,
      apiUsageRows,
      activeChannels,
      channelActivity,
      videoTrendItems,
      rssFeeds,
      rssLogs,
      tmdbPosts,
      designStudioActivities,
      videoStudioActivities,
      recentLogs,
      tmdbRecentPosts,
    ] = await Promise.all([
      prisma.log.count({ where: { level: 'error' } }),
      prisma.log.count({
        where: {
          level: 'error',
          timestamp: { gte: today },
        },
      }),
      prisma.log.count({
        where: {
          level: { not: 'error' },
          timestamp: { gte: today },
        },
      }),
      prisma.comment.findMany({
        where: {
          repliedAt: { not: null },
        },
        orderBy: { repliedAt: 'desc' },
        take: 100,
      }),
      prisma.uploadJob.count({
        where: {
          status: { in: ['pending', 'processing'] },
        },
      }),
      prisma.uploadJob.count({
        where: {
          status: 'completed',
          completedAt: { gte: today },
        },
      }),
      prisma.uploadJob.findMany({
        where: {
          status: { in: ['pending', 'processing'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.apiUsage.groupBy({
        by: ['service'],
        _sum: { tokens: true },
        where: { createdAt: { gte: today } },
      }),
      prisma.channel.count({
        where: { status: 'active' },
      }),
      prisma.feedItem.findMany({
        take: 5,
        orderBy: { publishedAt: 'desc' },
        include: {
          channel: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.feedItem.findMany({
        where: {
          publishedAt: { gte: sevenDaysAgo },
        },
        orderBy: { publishedAt: 'asc' },
      }),
      prisma.rSSFeed.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      prisma.log.findMany({
        where: {
          service: 'rss',
          timestamp: { gte: sevenDaysAgo },
        },
        orderBy: { timestamp: 'desc' },
        take: 250,
      }),
      prisma.tMDbPost.findMany({
        orderBy: { scheduledTime: 'asc' },
      }),
      prisma.designStudioActivity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.videoStudioActivity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.log.findMany({
        orderBy: { timestamp: 'desc' },
        take: 5,
      }),
      prisma.tMDbPost.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const commentPlatforms = ['X', 'Instagram', 'TikTok', 'Facebook', 'YouTube', 'Threads', 'Pinterest'];
    const recentReplies = comments
      .slice(0, 5)
      .map((comment) => ({
        id: comment.id,
        comment: comment.content,
        reply: comment.reply || '',
        platform: comment.platform,
        repliedAt: comment.repliedAt?.toISOString() || comment.updatedAt.toISOString(),
      }));
    const repliesToday = comments.filter((comment) => comment.repliedAt && new Date(comment.repliedAt) >= today).length;
    const commentsWithReply = comments.filter((comment) => !!comment.reply).length;
    const commentSuccessRate = comments.length > 0
      ? Math.round((commentsWithReply / comments.length) * 100)
      : 0;

    const apiUsage = apiUsageRows.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.service] = entry._sum.tokens || 0;
      return acc;
    }, {});

    const usage = {
      openai: apiUsage.openai || 0,
      serper: apiUsage.serper || 0,
      tmdb: apiUsage.tmdb || 0,
      shotstack: apiUsage.shotstack || 0,
      googleSearch: apiUsage.googleSearch || 0,
      googleVideo: apiUsage.googleVideo || 0,
    };
    const usageTotal = Object.values(usage).reduce((sum, value) => sum + value, 0);

    const videoDetectionsToday = videoTrendItems.filter((item) => item.publishedAt >= today).length;
    const trendMap = new Map<string, number>();
    for (let index = 6; index >= 0; index -= 1) {
      const date = daysAgo(index);
      trendMap.set(formatShortDay(date), 0);
    }
    videoTrendItems.forEach((item) => {
      const key = formatShortDay(item.publishedAt);
      trendMap.set(key, (trendMap.get(key) || 0) + 1);
    });
    const videoTrends = Array.from(trendMap.entries()).map(([date, videos]) => ({ date, videos }));

    const rssPublishedToday = rssLogs.filter((log) => {
      const metadata = asObject(log.metadata);
      return metadata.category === 'rss_activity' && metadata.status === 'published' && log.timestamp >= today;
    }).length;

    const rssRecentFeeds = rssFeeds.map((feed) => ({
      id: feed.id,
      name: feed.name,
      status: feed.status,
      lastProcessedAt: feed.lastProcessedAt?.toISOString() || null,
      nextRunAt: feed.nextRunAt?.toISOString() || null,
    }));

    const now = new Date();
    const tmdbUpcomingPosts = tmdbPosts
      .filter((post) => ['queued', 'scheduled'].includes(post.status) && post.scheduledTime >= now)
      .slice(0, 3)
      .map((post) => ({
        id: post.id,
        title: post.title,
        source: post.source,
        scheduledTime: post.scheduledTime.toISOString(),
        dateLabel: formatShortDate(post.scheduledTime),
        timeLabel: formatTime(post.scheduledTime),
      }));
    const tmdbReadyCount = tmdbPosts.filter((post) => ['queued', 'scheduled'].includes(post.status)).length;
    const latestScheduledPost = tmdbPosts
      .filter((post) => ['queued', 'scheduled'].includes(post.status))
      .sort((a, b) => b.scheduledTime.getTime() - a.scheduledTime.getTime())[0];
    const coverageDays = latestScheduledPost
      ? Math.max(1, Math.ceil((latestScheduledPost.scheduledTime.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;

    const designGenerated = designStudioActivities.filter((item) => item.type === 'design_rendered').length;
    const designPublished = designStudioActivities.filter((item) => item.type === 'design_published').length;
    const designRecentActivity = designStudioActivities.slice(0, 3).map((item) => {
      const details = asObject(item.details);
      return {
        id: item.id,
        title: String(details.templateName || 'Untitled design'),
        type: item.type,
        createdAt: item.createdAt.toISOString(),
        status: item.type === 'design_published' ? 'Published' : item.type === 'design_rendered' ? 'Rendered' : 'Updated',
      };
    });

    const videosGenerated = videoStudioActivities.filter((item) => item.status === 'completed').length;
    const videosPublished = videoStudioActivities.filter((item) => item.published).length;
    const videoStudioRecentActivity = videoStudioActivities.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    }));

    const recentActivity = recentLogs.map((log) => {
      const metadata = asObject(log.metadata);
      return {
        id: log.id,
        title: String(metadata.videoTitle || log.message || 'Unknown activity'),
        platform: String(metadata.platform || log.service || 'System'),
        status: log.level === 'error' ? 'failed' : 'success',
        type: String(metadata.type || log.service || 'system'),
        timestamp: log.timestamp.toISOString(),
      };
    });

    const tmdbCacheRateTotal = tmdbRecentPosts.length;
    const tmdbCacheHits = tmdbRecentPosts.filter((post) => post.cacheHit).length;
    const cacheHitRate = tmdbCacheRateTotal > 0
      ? Math.round((tmdbCacheHits / tmdbCacheRateTotal) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        system: {
          cacheHitRate,
          systemErrors,
          dailyFailures,
          dailySuccess,
        },
        comments: {
          repliesToday,
          successRate: commentSuccessRate,
          recentReplies,
          activePlatforms: commentPlatforms.length,
        },
        video: {
          activeChannels,
          dailyVideos: videoDetectionsToday,
          trends: videoTrends,
          recentActivity: channelActivity.map((item) => ({
            id: item.id,
            title: item.title,
            channelName: item.channel?.name || 'Unknown channel',
            publishedAt: item.publishedAt.toISOString(),
          })),
        },
        rss: {
          activeFeeds: rssFeeds.filter((feed) => feed.enabled && feed.status === 'active').length,
          dailyPosted: rssPublishedToday,
          recentFeeds: rssRecentFeeds,
        },
        tmdb: {
          readyCount: tmdbReadyCount,
          coverageDays,
          upcoming: tmdbUpcomingPosts,
        },
        designStudio: {
          generated: designGenerated,
          published: designPublished,
          recentActivity: designRecentActivity,
        },
        videoStudio: {
          generated: videosGenerated,
          published: videosPublished,
          recentActivity: videoStudioRecentActivity,
        },
        uploads: {
          activeUploads,
          completedToday: completedUploadsToday,
          pipeline: activePipelines.map((job) => ({
            id: job.id,
            fileName: job.fileName,
            stage: job.stage,
            progress: job.progress,
            status: job.status,
          })),
        },
        usage: {
          ...usage,
          total: usageTotal,
        },
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch dashboard stats' } });
  }
});

router.get('/system-stats', authenticate, async (_req, res) => {
  try {
    const today = startOfToday();
    const errorCount = await prisma.log.count({ where: { level: 'error' } });
    const dailyFailures = await prisma.log.count({
      where: {
        level: 'error',
        timestamp: { gte: today },
      },
    });
    const dailySuccess = await prisma.log.count({
      where: {
        level: { not: 'error' },
        timestamp: { gte: today },
      },
    });
    const recentTmdbPosts = await prisma.tMDbPost.findMany({
      where: {
        createdAt: { gte: daysAgo(30) },
      },
    });
    const cacheHitRate = recentTmdbPosts.length > 0
      ? Math.round((recentTmdbPosts.filter((post) => post.cacheHit).length / recentTmdbPosts.length) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        cacheHitRate,
        systemErrors: errorCount,
        dailyFailures,
        dailySuccess,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch system stats' } });
  }
});

export default router;
