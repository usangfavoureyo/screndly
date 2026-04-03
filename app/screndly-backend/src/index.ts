import dotenv from 'dotenv';
// Load environment variables immediately before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import prisma from './lib/prisma';
import { env } from './lib/env';
import { getTikTokClientKey, getTikTokClientSecret, hasTikTokCredentialWhitespace } from './lib/tiktokOAuth';
import { getPinterestAppId, getPinterestAppSecret } from './lib/pinterestOAuth';
import { getXOAuthClientId, getXOAuthClientSecret } from './lib/xOAuth';

const app = express();
const PORT = env.PORT;

// Middleware
app.set('trust proxy', 1);
app.set('etag', 'strong');
app.use(helmet());
app.use(cors({
    origin: [
        'https://screndly.vercel.app',
        'https://screndly-production.up.railway.app',
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4173',
        env.FRONTEND_URL
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Screndly-Version', 'x-screndly-version', 'X-Query', 'X-Max-Results'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.use(express.json());

// Cache headers: keep API responses non-cacheable by default, and explicitly opt-in a small public allowlist.
// This prevents accidental caching of user-specific data by browsers, CDNs, or service workers.
const PUBLIC_CACHEABLE_API_PATHS = new Set<string>([
    '/api/diag/oauth-config',
]);

app.use((req, res, next) => {
    const path = req.path;

    // Never cache health checks.
    if (path === '/health') {
        res.setHeader('Cache-Control', 'no-store');
        return next();
    }

    if (path.startsWith('/api/')) {
        res.vary('Authorization');

        const hasAuthHeader = typeof req.header('Authorization') === 'string' && req.header('Authorization')!.trim() !== '';
        const isPublicCacheable =
            req.method === 'GET' &&
            !hasAuthHeader &&
            PUBLIC_CACHEABLE_API_PATHS.has(path);

        if (isPublicCacheable) {
            res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        } else {
            res.setHeader('Cache-Control', 'no-store');
        }
    }

    return next();
});

// Routes
import settingsRoutes from './routes/settings';
import tmdbRoutes from './routes/tmdb';
import rssRoutes from './routes/rss';
import commentsRoutes from './routes/comments';
import channelsRoutes from './routes/channels';
import jobsRoutes from './routes/jobs';
import logsRoutes from './routes/logs';
import notificationsRoutes from './routes/notifications';
import platformsRoutes from './routes/platforms';
import aiRoutes from './routes/ai';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import externalApiRoutes from './routes/external-apis';
import createRoutes from './routes/create';

// // import thumbnailRoutes from './routes/thumbnail'; // Placeholder for future
import videoStudioRoutes from './routes/video-studio';
import designStudioRoutes from './routes/design-studio';

// OAuth config diagnostic (safe values only)
app.get('/api/diag/oauth-config', (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || env.FRONTEND_URL || '';
    const normalizedFrontend = frontendUrl.replace(/\/+$/, '');
    const redirectUri = `${normalizedFrontend}/platforms/callback`;
    const xClientId = getXOAuthClientId();
    const xClientSecret = getXOAuthClientSecret();
    const tiktokClientKey = getTikTokClientKey();
    const tiktokClientSecret = getTikTokClientSecret();
    const pinterestAppId = getPinterestAppId();
    const pinterestAppSecret = getPinterestAppSecret();

    res.json({
        success: true,
        data: {
            nodeEnv: process.env.NODE_ENV || env.NODE_ENV,
            frontendUrl,
            redirectUri,
            providers: {
                meta: {
                    hasAppId: !!process.env.META_APP_ID,
                    hasAppSecret: !!process.env.META_APP_SECRET,
                },
                threads: {
                    hasAppId: !!process.env.THREADS_APP_ID,
                    hasAppSecret: !!process.env.THREADS_APP_SECRET,
                },
                x: {
                    hasClientId: !!xClientId,
                    hasClientSecret: !!xClientSecret,
                    usingLegacyKeyNames: !process.env.X_CLIENT_ID && !!process.env.X_API_KEY,
                },
                youtube: {
                    hasClientId: !!process.env.YOUTUBE_CLIENT_ID,
                    hasClientSecret: !!process.env.YOUTUBE_CLIENT_SECRET,
                },
                tiktok: {
                    hasClientKey: !!tiktokClientKey,
                    hasClientSecret: !!tiktokClientSecret,
                    hasCredentialWhitespace: hasTikTokCredentialWhitespace(),
                },
                pinterest: {
                    hasAppId: !!pinterestAppId,
                    hasAppSecret: !!pinterestAppSecret,
                    usingClientKeyNames: !process.env.PINTEREST_APP_ID && !!process.env.PINTEREST_CLIENT_ID,
                }
            }
        }
    });
});

app.use('/api/settings', settingsRoutes);
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/rss', rssRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/platforms', platformsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', externalApiRoutes);
app.use('/api/create', createRoutes);
app.use('/api/video-studio', videoStudioRoutes);
app.use('/api/design-studio', designStudioRoutes);

// Health Check
app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'connected',
                cron: 'enabled'
            }
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'disconnected',
                cron: 'unknown'
            },
            error: 'Database connection failed'
        });
    }
});

// Start Server
import { initCronJobs } from './services/cron';

if (require.main === module || process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        if (process.env.DISABLE_CRON === '1') {
            console.log('Cron jobs disabled via DISABLE_CRON=1');
        } else {
            initCronJobs();
        }
    });
}

export default app;
