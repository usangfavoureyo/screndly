import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config(); // Load from default .env if exists

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000'),
    DATABASE_URL: z.string(),
    JWT_SECRET: z.string(),
    ADMIN_SECRET: z.string(),
    APP_PASSWORD: z.string().optional(),

    // Platform Keys
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional(),
    THREADS_APP_ID: z.string().optional(),
    THREADS_APP_SECRET: z.string().optional(),
    X_API_KEY: z.string().optional(),
    X_API_SECRET: z.string().optional(),
    X_CLIENT_ID: z.string().optional(),
    X_CLIENT_SECRET: z.string().optional(),
    X_BEARER_TOKEN: z.string().optional(),
    YOUTUBE_CLIENT_ID: z.string().optional(),
    YOUTUBE_CLIENT_SECRET: z.string().optional(),
    TIKTOK_CLIENT_KEY: z.string().optional(),
    TIKTOK_CLIENT_SECRET: z.string().optional(),
    PINTEREST_APP_ID: z.string().optional(),
    PINTEREST_APP_SECRET: z.string().optional(),
    PINTEREST_CLIENT_ID: z.string().optional(),
    PINTEREST_CLIENT_SECRET: z.string().optional(),

    // External APIs
    TMDB_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    SHOTSTACK_API_KEY: z.string().optional(),
    WEB_PUSH_VAPID_PUBLIC_KEY: z.string().optional(),
    WEB_PUSH_VAPID_PRIVATE_KEY: z.string().optional(),
    WEB_PUSH_VAPID_SUBJECT: z.string().optional(),

    // URLs
    FRONTEND_URL: z.string().default('http://localhost:5173'),
    BACKEND_URL: z.string().default('http://localhost:3000'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error('❌ Invalid environment variables:', _env.error.format());
    // Don't throw in development if some keys are missing
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}

export const env = _env.success ? _env.data : process.env as any;
