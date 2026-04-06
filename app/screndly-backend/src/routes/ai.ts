/**
 * AI Routes - Model Inference and Validation
 */

import fs from 'fs/promises';
import { Router, Request, Response } from 'express';
import aiService, {
    AIModel,
    LEGACY_OPENAI_MODELS,
    SUPPORTED_OPENAI_MODELS,
    generateComposeContent,
    normalizeAIModel,
    resolveComposeSourceTitle,
} from '../services/ai.service';
import { authenticate } from '../middleware/auth';
import {
    enrichYouTubeVideoMetadata,
    generateLandscapeThumbnail,
    generateSocialPosterThumbnail,
    getYouTubeRuntimeSettings,
} from '../services/video-enrichment.service';
import { getBackblazeAuthorizedDownloadUrl } from '../services/backblaze';

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
        const {
            originalComment,
            platform,
            description,
            tone,
            maxLength,
            username,
            postTitle,
            postText,
            model,
            customSystemPrompt,
            customTemperature,
        } = req.body;

        if (!originalComment || !platform) {
            return res.status(400).json({ success: false, error: { message: 'Comment and platform required' } });
        }

        const reply = await aiService.generateCommentReply({
            originalComment,
            platform,
            description,
            tone,
            maxLength,
            username,
            postTitle,
            postText,
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

        if (!title || !mediaType || !temporalTag || typeof daysUntil !== 'number') {
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

router.post('/generate/compose-metadata', async (req: Request, res: Response) => {
    try {
        const {
            metadataText,
            selectedPlatforms,
            availablePlaylists,
            sharedCaptionPrompt,
            youtubeTitlePrompt,
            youtubeDescriptionPrompt,
            youtubePlaylistPrompt,
            mediaContext,
            model,
        } = req.body ?? {};

        if (typeof metadataText !== 'string' || metadataText.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: 'Metadata text is required' },
            });
        }

        const result = await aiService.generateComposeMetadataDraft(
            {
                metadataText,
                selectedPlatforms: Array.isArray(selectedPlatforms) ? selectedPlatforms : [],
                availablePlaylists: Array.isArray(availablePlaylists) ? availablePlaylists : [],
                sharedCaptionPrompt: typeof sharedCaptionPrompt === 'string' ? sharedCaptionPrompt : undefined,
                youtubeTitlePrompt: typeof youtubeTitlePrompt === 'string' ? youtubeTitlePrompt : undefined,
                youtubeDescriptionPrompt: typeof youtubeDescriptionPrompt === 'string' ? youtubeDescriptionPrompt : undefined,
                youtubePlaylistPrompt: typeof youtubePlaylistPrompt === 'string' ? youtubePlaylistPrompt : undefined,
                mediaContext:
                    mediaContext && typeof mediaContext === 'object'
                        ? {
                            fileName: typeof mediaContext.fileName === 'string' ? mediaContext.fileName : undefined,
                            mimeType: typeof mediaContext.mimeType === 'string' ? mediaContext.mimeType : undefined,
                            mediaKind:
                                mediaContext.mediaKind === 'image' || mediaContext.mediaKind === 'video'
                                    ? mediaContext.mediaKind
                                    : undefined,
                        }
                        : undefined,
            },
            normalizeAIModel(typeof model === 'string' ? model : undefined),
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[AI Route] Compose metadata generation error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error instanceof Error ? error.message : 'Failed to generate compose metadata',
            },
        });
    }
});

router.post('/generate/compose-content', async (req: Request, res: Response) => {
    try {
        const {
            requestText,
            selectedPlatforms,
            availablePlaylists,
            sharedCaptionPrompt,
            youtubeTitlePrompt,
            youtubeDescriptionPrompt,
            youtubePlaylistPrompt,
            reviewPrompt,
            summaryPrompt,
            mediaContext,
            model,
        } = req.body ?? {};

        if (typeof requestText !== 'string' || requestText.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: 'Source or prompt input is required' },
            });
        }

        const result = await generateComposeContent(
            {
                requestText,
                metadataText: requestText,
                selectedPlatforms: Array.isArray(selectedPlatforms) ? selectedPlatforms : [],
                availablePlaylists: Array.isArray(availablePlaylists) ? availablePlaylists : [],
                sharedCaptionPrompt: typeof sharedCaptionPrompt === 'string' ? sharedCaptionPrompt : undefined,
                youtubeTitlePrompt: typeof youtubeTitlePrompt === 'string' ? youtubeTitlePrompt : undefined,
                youtubeDescriptionPrompt: typeof youtubeDescriptionPrompt === 'string' ? youtubeDescriptionPrompt : undefined,
                youtubePlaylistPrompt: typeof youtubePlaylistPrompt === 'string' ? youtubePlaylistPrompt : undefined,
                reviewPrompt: typeof reviewPrompt === 'string' ? reviewPrompt : undefined,
                summaryPrompt: typeof summaryPrompt === 'string' ? summaryPrompt : undefined,
                mediaContext:
                    mediaContext && typeof mediaContext === 'object'
                        ? {
                            fileName: typeof mediaContext.fileName === 'string' ? mediaContext.fileName : undefined,
                            mimeType: typeof mediaContext.mimeType === 'string' ? mediaContext.mimeType : undefined,
                            mediaKind:
                                mediaContext.mediaKind === 'image' || mediaContext.mediaKind === 'video'
                                    ? mediaContext.mediaKind
                                    : undefined,
                        }
                        : undefined,
            },
            normalizeAIModel(typeof model === 'string' ? model : undefined),
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[AI Route] Compose content generation error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error instanceof Error ? error.message : 'Failed to generate compose content',
            },
        });
    }
});

router.post('/generate/compose-thumbnail', async (req: Request, res: Response) => {
    try {
        const {
            metadataText,
            thumbnailType,
            titleHint,
            sharedCaption,
            youtubeTitle,
            model,
            thumbnailConfig,
        } = req.body ?? {};

        if (typeof metadataText !== 'string' || metadataText.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: 'Metadata text is required' },
            });
        }

        if (thumbnailType !== 'shared' && thumbnailType !== 'youtube' && thumbnailType !== 'x') {
            return res.status(400).json({
                success: false,
                error: { message: 'A valid thumbnail type is required' },
            });
        }

        const settings = await getYouTubeRuntimeSettings();
        const thumbnailConfigOverride = (() => {
            if (thumbnailType !== 'youtube' && thumbnailType !== 'x') {
                return null;
            }

            if (!thumbnailConfig) {
                return null;
            }

            if (typeof thumbnailConfig === 'string') {
                try {
                    return JSON.parse(thumbnailConfig) as Record<string, unknown>;
                } catch {
                    return null;
                }
            }

            return typeof thumbnailConfig === 'object' ? thumbnailConfig as Record<string, unknown> : null;
        })();

        const effectiveSettings = thumbnailConfigOverride
            ? {
                ...settings,
                ...(thumbnailType === 'youtube'
                    ? {
                        thumbnailConfigYoutube: {
                            ...settings.thumbnailConfigYoutube,
                            ...thumbnailConfigOverride,
                            platform: 'youtube' as const,
                        },
                    }
                    : {
                        thumbnailConfigX: {
                            ...settings.thumbnailConfigX,
                            ...thumbnailConfigOverride,
                            platform: 'x' as const,
                        },
                    }),
            }
            : settings;
        const resolvedModel = normalizeAIModel(
            typeof model === 'string' ? model : effectiveSettings.videoOpenaiModel || undefined,
        );

        const resolvedTitle =
            (typeof titleHint === 'string' && titleHint.trim())
            || (typeof youtubeTitle === 'string' && youtubeTitle.trim())
            || (typeof sharedCaption === 'string' && sharedCaption.trim())
            || await resolveComposeSourceTitle(metadataText, resolvedModel)
            || metadataText.split(/\r?\n/).find((line: string) => line.trim().length > 0)
            || 'Untitled';

        const enrichedMetadata = await enrichYouTubeVideoMetadata(
            `compose-thumbnail-${thumbnailType}`,
            resolvedTitle,
            metadataText,
            effectiveSettings,
        );

        const generatedAsset = thumbnailType === 'shared'
            ? await generateSocialPosterThumbnail(
                resolvedTitle,
                enrichedMetadata,
                undefined,
                effectiveSettings,
            )
            : await generateLandscapeThumbnail(
                thumbnailType === 'x' ? 'x' : 'youtube',
                resolvedTitle,
                enrichedMetadata,
                undefined,
                effectiveSettings,
            );

        if (!generatedAsset?.publicUrl) {
            return res.status(422).json({
                success: false,
                error: {
                    message:
                        thumbnailType === 'shared'
                            ? 'Unable to generate a shared thumbnail from this metadata right now.'
                            : 'Unable to generate a platform thumbnail from this metadata right now.',
                },
            });
        }

        let size = 0;
        if (generatedAsset.localPath) {
            try {
                const stats = await fs.stat(generatedAsset.localPath);
                size = stats.size;
            } catch {
                size = 0;
            }
        }

        const previewUrl = await getBackblazeAuthorizedDownloadUrl(generatedAsset.publicUrl, 7 * 24 * 60 * 60);

        res.json({
            success: true,
            data: {
                fileName: `${resolvedTitle.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'thumbnail'}-${thumbnailType}.jpg`,
                mimeType: 'image/jpeg',
                size,
                previewUrl,
                storageUrl: generatedAsset.publicUrl,
                uploadStatus: 'uploaded',
                strategy: generatedAsset.strategy,
                resolvedTitle,
            },
        });
    } catch (error) {
        console.error('[AI Route] Compose thumbnail generation error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error instanceof Error ? error.message : 'Failed to generate compose thumbnail',
            },
        });
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
