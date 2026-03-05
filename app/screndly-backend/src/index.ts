import dotenv from 'dotenv';
// Load environment variables immediately before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import prisma from './lib/prisma';
import { env } from './lib/env';

const app = express();
const PORT = env.PORT;

// Middleware
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
    origin: [
        'https://screndly.vercel.app',
        'https://screndly-production.up.railway.app',
        'http://localhost:5173',
        'http://localhost:3000',
        env.FRONTEND_URL
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Screndly-Version', 'x-screndly-version'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));
app.use((req, res, next) => {
    // Definitive logger for raw Auth header and Client Version
    const auth = req.headers.authorization;
    const version = req.headers['x-screndly-version'] || 'legacy';

    if (auth) {
        console.log(`[Raw Header Decode] [v:${version}] ${req.method} ${req.originalUrl} | Auth: ${auth.substring(0, 20)}... (Len: ${auth.length})`);
    } else {
        console.log(`[Raw Header Decode] [v:${version}] ${req.method} ${req.originalUrl} | Auth: MISSING`);
    }
    next();
});

app.use(express.json());

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

// // import thumbnailRoutes from './routes/thumbnail'; // Placeholder for future
import videoStudioRoutes from './routes/video-studio';
import designStudioRoutes from './routes/design-studio';

// Token Echo (Safe preview)
app.get('/api/diag/echo-token', (req, res) => {
    const auth = req.headers.authorization || '';
    const hasBearer = auth.startsWith('Bearer ');
    const token = hasBearer ? auth.slice(7) : auth;
    console.log(`[Diag] Echo request from ${req.ip}. Header: ${auth.substring(0, 15)}... (Total Len: ${auth.length})`);
    res.json({
        hasHeader: !!auth,
        hasBearer,
        tokenLength: token.length,
        tokenPreview: token.length > 5 ? `${token.substring(0, 3)}...${token.substring(token.length - 2)}` : token,
        tokenType: token.includes('.') ? 'JWT' : 'Other',
        headersReceived: Object.keys(req.headers)
    });
});

// Diagnostic Route (Safe)
import { createHash } from 'crypto';
app.get('/api/diag/secret-check', (req, res) => {
    const jwtHash = createHash('sha256').update(process.env.JWT_SECRET || '').digest('hex');
    const adminHash = createHash('sha256').update(process.env.ADMIN_SECRET || '').digest('hex');
    console.log(`[Diag] Secret check: JWT_SECRET=${process.env.JWT_SECRET?.length || 0} chars (Hash: ${jwtHash.substring(0, 8)}...), ADMIN_SECRET=${process.env.ADMIN_SECRET?.length || 0} chars (Hash: ${adminHash.substring(0, 8)}...)`);
    res.json({
        success: true,
        message: 'Secret diagnostic logged to backend console',
        details: {
            jwtSet: !!process.env.JWT_SECRET,
            adminSet: !!process.env.ADMIN_SECRET,
            nodeEnv: process.env.NODE_ENV
        }
    });
});

// OAuth config diagnostic (safe values only)
app.get('/api/diag/oauth-config', (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || env.FRONTEND_URL || '';
    const normalizedFrontend = frontendUrl.replace(/\/+$/, '');
    const redirectUri = `${normalizedFrontend}/platforms/callback`;

    res.json({
        success: true,
        data: {
            nodeEnv: process.env.NODE_ENV || env.NODE_ENV,
            frontendUrl,
            redirectUri,
            hasMetaAppId: !!process.env.META_APP_ID,
            hasMetaAppSecret: !!process.env.META_APP_SECRET
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
                cron: 'running' // Placeholder until cron service is fully integrated
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
        initCronJobs();
    });
}

export default app;
