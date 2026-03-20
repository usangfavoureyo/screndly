/**
 * AI Routes - Model Inference and Validation
 */

import { Router, Request, Response } from 'express';
import aiService, { AIModel, LEGACY_OPENAI_MODELS, SUPPORTED_OPENAI_MODELS } from '../services/ai.service';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ============================================
// GENERATE COMPLETION
// ============================================

/**
 * POST /api/ai/generate
 * Generate AI completion using specified model (Generic)
 */
router.post('/generate', async (req: Request, res: Response) => {
    try {
        const { model, prompt, systemPrompt, maxTokens, temperature, jsonMode } = req.body;

        if (!model || !prompt) {
            return res.status(400).json({
                success: false,
                error: { message: 'Model and prompt are required' }
            });
        }

        const result = await aiService.generateCompletion({
            model: model as AIModel,
            prompt,
            systemPrompt,
            maxTokens,
            temperature,
            jsonMode
        });

        res.json({
            success: result.success,
            data: {
                content: result.content,
                model: result.model,
                tokens: result.tokens
            },
            error: result.error ? { message: result.error } : undefined
        });
    } catch (error) {
        console.error('[AI Route] Generate error:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to generate completion' }
        });
    }
});

/**
 * POST /api/ai/generate/comment-reply
 * Strict "Community Manager" Reply Generator
 */
/**
 * POST /api/ai/generate/comment-reply
 * Strict "Community Manager" Reply Generator
 */
router.post('/generate/comment-reply', async (req: Request, res: Response) => {
    try {
        const { originalComment, platform, description, tone, model, customSystemPrompt, customTemperature } = req.body;

        if (!originalComment || !platform) {
            return res.status(400).json({ success: false, error: { message: 'Comment and platform required' } });
        }

        const reply = await aiService.generateCommentReply({
            originalComment,
            platform,
            description,
            tone
        }, model, customSystemPrompt, customTemperature);

        res.json({ success: true, data: { content: reply } });
    } catch (e) {
        res.status(500).json({ success: false, error: { message: 'Failed to generate reply' } });
    }
});

/**
 * POST /api/ai/generate/tmdb-caption
 * Strict TMDb caption generator
 */
router.post('/generate/tmdb-caption', async (req: Request, res: Response) => {
    try {
        const {
            title,
            mediaType,
            temporalTag,
            daysUntil,
            releaseDate,
            anniversaryYears,
            cast,
            genres,
            platform,
            model,
            customSystemPrompt,
            customTemperature
        } = req.body;

        if (!title || !mediaType || !temporalTag || typeof daysUntil !== 'number' || !platform) {
            return res.status(400).json({ success: false, error: { message: 'TMDb caption context is incomplete' } });
        }

        const caption = await aiService.generateTMDbCaption(
            {
                title,
                mediaType,
                temporalTag,
                daysUntil,
                releaseDate,
                anniversaryYears,
                cast: Array.isArray(cast) ? cast : [],
                genres: Array.isArray(genres) ? genres : [],
                platform
            },
            model,
            customSystemPrompt,
            customTemperature
        );

        res.json({ success: true, data: { content: caption } });
    } catch (e) {
        res.status(500).json({ success: false, error: { message: 'Failed to generate TMDb caption' } });
    }
});

/**
 * POST /api/ai/generate/studio-caption
 * Strict "Creative Director" Caption Generator
 */
router.post('/generate/studio-caption', async (req: Request, res: Response) => {
    try {
        const {
            fileName,
            fileDescription,
            detectedObjects,
            platform,
            tone,
            model,
            customSystemPrompt,
            customTemperature,
            customMaxTokens
        } = req.body;

        if (!fileName) {
            return res.status(400).json({ success: false, error: { message: 'FileName required' } });
        }

        const caption = await aiService.generateStudioCaption({
            fileName,
            fileDescription,
            detectedObjects,
            platform,
            tone
        }, model, customSystemPrompt, customTemperature, customMaxTokens);

        res.json({ success: true, data: { content: caption } });
    } catch (e) {
        res.status(500).json({ success: false, error: { message: 'Failed to generate caption' } });
    }
});

/**
 * POST /api/ai/generate/rss-caption
 * Strict RSS Caption Generator
 */
router.post('/generate/rss-caption', async (req: Request, res: Response) => {
    try {
        const { articleTitle, feedName, summary, platform, model, customSystemPrompt, customTemperature } = req.body;
        const caption = await aiService.generateRSSCaption(
            { articleTitle, feedName, summary, platform },
            model,
            customSystemPrompt,
            customTemperature
        );
        res.json({ success: true, data: { content: caption } });
    } catch (e) {
        res.status(500).json({ success: false, error: { message: 'Failed to generate RSS caption' } });
    }
});

/**
 * POST /api/ai/generate/youtube-caption
 * Strict YouTube Caption Generator
 */
router.post('/generate/youtube-caption', async (req: Request, res: Response) => {
    try {
        const { videoTitle, channelName, description, platform, model, customSystemPrompt, customTemperature } = req.body;
        const caption = await aiService.generateYouTubeCaption(
            { videoTitle, channelName, description, platform },
            model,
            customSystemPrompt,
            customTemperature
        );
        res.json({ success: true, data: { content: caption } });
    } catch (e) {
        res.status(500).json({ success: false, error: { message: 'Failed to generate YouTube caption' } });
    }
});


// ============================================
// TMDB VALIDATION
// ============================================

/**
 * POST /api/ai/validate/tmdb
 * Validate TMDB content using AI cross-check
 */
router.post('/validate/tmdb', async (req: Request, res: Response) => {
    try {
        const { title, overview, genres, originalLanguage, productionCountries, model } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                error: { message: 'Title is required' }
            });
        }

        const result = await aiService.validateTMDbContent(
            title,
            overview || '',
            genres || [],
            originalLanguage || '',
            productionCountries || [],
            model as AIModel || 'flash-3'
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[AI Route] TMDB validation error:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to validate content' }
        });
    }
});

// ============================================
// YOUTUBE VALIDATION
// ============================================

/**
 * POST /api/ai/validate/youtube
 * Validate YouTube trailer using AI
 */
router.post('/validate/youtube', async (req: Request, res: Response) => {
    try {
        const { title, channelName, description, model } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                error: { message: 'Title is required' }
            });
        }

        const result = await aiService.validateYouTubeTrailer(
            title,
            channelName || '',
            description || '',
            model as AIModel || 'flash-3'
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[AI Route] YouTube validation error:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to validate trailer' }
        });
    }
});

// ============================================
// MODEL STATUS
// ============================================

/**
 * GET /api/ai/status
 * Check which models are available
 */
router.get('/status', async (_req: Request, res: Response) => {
    try {
        const openaiKey = await aiService.getOpenAIKey();
        const flash3Key = await aiService.getFlash3Key();

        res.json({
            success: true,
            data: {
                openai: !!openaiKey,
                flash3: !!flash3Key,
                availableModels: [
                    ...(openaiKey ? [...SUPPORTED_OPENAI_MODELS, ...LEGACY_OPENAI_MODELS] : []),
                    ...(flash3Key || openaiKey ? ['flash-3'] : [])
                ]
            }
        });
    } catch (error) {
        console.error('[AI Route] Status error:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to check model status' }
        });
    }
});

export default router;
