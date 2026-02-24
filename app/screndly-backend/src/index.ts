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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));
app.use((req, res, next) => {
    // Log host headers for debugging "Host validation failed"
    if (process.env.NODE_ENV === 'production') {
        console.log(`[Host Debug] Host: ${req.headers.host}, X-Forwarded-Host: ${req.headers['x-forwarded-host']}, Origin: ${req.headers.origin}`);
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
