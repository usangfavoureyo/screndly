import { Router } from 'express';
import prisma from '../lib/prisma';
import {
    fetchTrendingMovies,
    fetchTrendingTV,
    fetchUpcomingMovies,
    refreshTMDbContent,
    isTMDbConfigured,
    clearAllPosts,
    getTmdbApiKey,
    updateTMDbPost,
} from '../services/tmdb.service';
import { authenticate } from '../middleware/auth';
import { renderTMDbLogoCard } from '../services/rss-logo-render.service';

const router = Router();
router.use(authenticate);

const TMDB_POSTER_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';
const TMDB_BACKDROP_IMAGE_BASE = 'https://image.tmdb.org/t/p/w1280';

// GET /api/tmdb/status - Check if TMDb is configured
router.get('/status', async (req, res) => {
    try {
        const configured = await isTMDbConfigured();
        res.json({
            success: true,
            data: {
                configured,
                message: configured ? 'TMDb API is configured' : 'TMDb API key not set'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to check status' } });
    }
});

// GET /api/tmdb/trending - Fetch trending from TMDb API
router.get('/trending', async (req, res) => {
    try {
        const configured = await isTMDbConfigured();
        if (!configured) {
            return res.status(400).json({
                success: false,
                error: { message: 'TMDb API key not configured' }
            });
        }

        const movies = await fetchTrendingMovies('day');
        const tv = await fetchTrendingTV('day');

        res.json({
            success: true,
            data: { movies, tv }
        });
    } catch (error) {
        console.error('Error fetching trending:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch trending' } });
    }
});

// GET /api/tmdb/upcoming - Fetch upcoming movies
router.get('/upcoming', async (req, res) => {
    try {
        const configured = await isTMDbConfigured();
        if (!configured) {
            return res.status(400).json({
                success: false,
                error: { message: 'TMDb API key not configured' }
            });
        }

        const movies = await fetchUpcomingMovies();
        res.json({ success: true, data: movies });
    } catch (error) {
        console.error('Error fetching upcoming:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch upcoming' } });
    }
});

// GET /api/tmdb/search - Search TMDb titles for Design Studio and related pickers
router.get('/search', async (req, res) => {
    try {
        const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
        if (!query) {
            return res.status(400).json({
                success: false,
                error: { message: 'Search query is required' }
            });
        }

        const configured = await isTMDbConfigured();
        if (!configured) {
            return res.status(400).json({
                success: false,
                error: { message: 'TMDb API key not configured' }
            });
        }

        const apiKey = await getTmdbApiKey();
        const response = await fetch(
            `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`
        );

        if (!response.ok) {
            throw new Error('Failed to search TMDb');
        }

        const data = await response.json() as {
            results?: Array<{
                id: number;
                media_type?: string;
                title?: string;
                name?: string;
                backdrop_path?: string | null;
                poster_path?: string | null;
                release_date?: string;
                first_air_date?: string;
            }>;
        };

        const results = (data.results || [])
            .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
            .filter((item) => item.backdrop_path || item.poster_path)
            .slice(0, 12)
            .map((item) => ({
                id: item.id,
                mediaType: item.media_type,
                title: item.title || item.name || 'Untitled',
                backdrop: item.backdrop_path ? `${TMDB_BACKDROP_IMAGE_BASE}${item.backdrop_path}` : null,
                poster: item.poster_path ? `${TMDB_POSTER_IMAGE_BASE}${item.poster_path}` : null,
                releaseDate: item.release_date || item.first_air_date || null,
            }));

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error searching TMDb:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to search TMDb' } });
    }
});

// POST /api/tmdb/refresh - Manually trigger TMDb refresh
// Accepts settings from frontend to enforce user configuration
router.post('/refresh', async (req, res) => {
    try {
        const configured = await isTMDbConfigured();
        if (!configured) {
            return res.status(400).json({
                success: false,
                error: { message: 'TMDb API key not configured' }
            });
        }

        // Extract settings from request body (sent by frontend)
        const { settings } = req.body || {};

        console.log('[TMDb] Refresh triggered with settings:', settings ? 'provided' : 'defaults');

        const result = await refreshTMDbContent(settings);
        res.json({
            success: true,
            data: {
                added: result.added,
                errors: result.errors,
                runId: result.runId,
                message: `Added ${result.added} new posts`
            }
        });
    } catch (error) {
        console.error('Error refreshing TMDb:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to refresh' } });
    }
});

// DELETE /api/tmdb/posts/clear - Clear all TMDb posts
// Use this to regenerate feeds with new settings
router.delete('/posts/clear', async (req, res) => {
    try {
        const result = await clearAllPosts();
        res.json({
            success: true,
            data: {
                deleted: result.deleted,
                message: `Cleared ${result.deleted} posts. Run refresh to regenerate with new settings.`
            }
        });
    } catch (error) {
        console.error('Error clearing posts:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to clear posts' } });
    }
});

// GET /api/tmdb/posts - Get scheduled TMDb posts from database
router.get('/posts', async (req, res) => {
    try {
        const status = req.query.status as string;
        const whereClause = status ? { status } : {};

        const posts = await prisma.tMDbPost.findMany({
            where: whereClause,
            orderBy: { scheduledTime: 'asc' }
        });

        res.json({ success: true, data: posts });
    } catch (error) {
        console.error('Error fetching TMDb posts:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch posts' } });
    }
});

// POST /api/tmdb/posts - Create a new TMDb post
router.post('/posts', async (req, res) => {
    try {
        const data = req.body;
        const post = await prisma.tMDbPost.create({
            data: {
                tmdbId: data.tmdbId,
                mediaType: data.mediaType,
                title: data.title,
                year: data.year,
                releaseDate: new Date(data.releaseDate),
                caption: data.caption,
                imageUrl: data.imageUrl,
                imageType: data.imageType,
                imageUrls: Array.isArray(data.imageUrls) && data.imageUrls.length > 0 ? data.imageUrls : [data.imageUrl],
                imageTypes: Array.isArray(data.imageTypes) && data.imageTypes.length > 0 ? data.imageTypes : [data.imageType],
                scheduledTime: new Date(data.scheduledTime),
                source: data.source,
                cast: data.cast,
                popularity: data.popularity,
                platforms: data.platforms || [],
                status: 'scheduled'
            }
        });
        res.json({ success: true, data: post });
    } catch (error) {
        console.error('Error creating TMDb post:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to create post' } });
    }
});

// PUT /api/tmdb/posts/:id - Update a TMDb post
router.put('/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const updateData: Record<string, any> = {
            ...data
        };

        if (Object.prototype.hasOwnProperty.call(data, 'scheduledTime')) {
            updateData.scheduledTime = data.scheduledTime ? new Date(data.scheduledTime) : null;
        }

        if (Object.prototype.hasOwnProperty.call(data, 'publishedTime')) {
            updateData.publishedTime = data.publishedTime ? new Date(data.publishedTime) : null;
        }

        if (Object.prototype.hasOwnProperty.call(data, 'errorMessage')) {
            updateData.errorMessage = data.errorMessage ?? null;
        }

        if (Object.prototype.hasOwnProperty.call(data, 'imageUrls')) {
            updateData.imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0) : [];
        }

        if (Object.prototype.hasOwnProperty.call(data, 'imageTypes')) {
            updateData.imageTypes = Array.isArray(data.imageTypes) ? data.imageTypes.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0) : [];
        }

        const post = await updateTMDbPost(id, updateData);

        res.json({ success: true, data: post });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to update post' } });
    }
});

// DELETE /api/tmdb/posts/:id - Delete a TMDb post
router.delete('/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.tMDbPost.delete({ where: { id } });
        res.json({ success: true, data: { message: 'Post deleted' } });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to delete post' } });
    }
});

// GET /api/tmdb/images/:mediaType/:tmdbId - Fetch specific image type from TMDb
router.get('/images/:mediaType/:tmdbId', async (req, res) => {
    try {
        const { mediaType, tmdbId } = req.params;
        const { type } = req.query; // 'poster' | 'backdrop' | 'poster_backdrop' | 'backdrop_logo'
        const exclude = typeof req.query.exclude === 'string' ? req.query.exclude : '';

        if (!type || !['poster', 'backdrop', 'poster_backdrop', 'backdrop_logo'].includes(type as string)) {
            return res.status(400).json({
                success: false,
                error: { message: 'Invalid image type. Must be "poster", "backdrop", "poster_backdrop", or "backdrop_logo".' }
            });
        }

        // Get API key from settings or env
        const TMDB_API_KEY = await getTmdbApiKey();
        if (!TMDB_API_KEY) {
            return res.status(400).json({
                success: false,
                error: { message: 'TMDb API key not configured. Add it in Settings > Integrations.' }
            });
        }

        const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
        const response = await fetch(
            `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/images?api_key=${TMDB_API_KEY}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch images from TMDb');
        }

        interface TMDbImage {
            file_path: string;
            aspect_ratio: number;
            vote_average: number;
            iso_639_1?: string | null;
        }

        interface TMDbImagesResponse {
            posters?: TMDbImage[];
            backdrops?: TMDbImage[];
            logos?: TMDbImage[];
        }

        const data = await response.json() as TMDbImagesResponse;
        const selectImageUrl = (images: TMDbImage[] | undefined, kind: 'poster' | 'backdrop') => {
            if (!images || images.length === 0) {
                return '';
            }

            const imageBase = kind === 'poster' ? TMDB_POSTER_IMAGE_BASE : TMDB_BACKDROP_IMAGE_BASE;
            const imageUrls = images.map((image) => `${imageBase}${image.file_path}`);
            const filteredImageUrls = exclude
                ? imageUrls.filter((candidate) => candidate !== exclude)
                : imageUrls;
            const candidates = filteredImageUrls.length > 0 ? filteredImageUrls : imageUrls;
            const randomIndex = Math.floor(Math.random() * candidates.length);
            return candidates[randomIndex];
        };

        const selectLogoUrl = (images: TMDbImage[] | undefined) => {
            if (!images || images.length === 0) {
                return '';
            }

            const sorted = [...images]
                .filter((image) => typeof image.file_path === 'string' && image.file_path.length > 0)
                .sort((left, right) => {
                    const leftLanguageScore = left.iso_639_1 === 'en' ? 1 : left.iso_639_1 === null ? 0.5 : 0;
                    const rightLanguageScore = right.iso_639_1 === 'en' ? 1 : right.iso_639_1 === null ? 0.5 : 0;

                    if (leftLanguageScore !== rightLanguageScore) {
                        return rightLanguageScore - leftLanguageScore;
                    }

                    return (right.vote_average || 0) - (left.vote_average || 0);
                });

            return sorted[0] ? `${TMDB_POSTER_IMAGE_BASE}${sorted[0].file_path}` : '';
        };

        let imageUrl = '';
        let imageType: 'poster' | 'backdrop' | 'logo' = 'poster';
        let imageUrls: string[] = [];
        let imageTypes: Array<'poster' | 'backdrop' | 'logo'> = [];

        if (type === 'poster') {
            imageUrl = selectImageUrl(data.posters, 'poster');
            imageType = 'poster';
            imageUrls = imageUrl ? [imageUrl] : [];
            imageTypes = imageUrl ? ['poster'] : [];
        } else if (type === 'backdrop') {
            imageUrl = selectImageUrl(data.backdrops, 'backdrop');
            imageType = 'backdrop';
            imageUrls = imageUrl ? [imageUrl] : [];
            imageTypes = imageUrl ? ['backdrop'] : [];
        } else if (type === 'poster_backdrop') {
            const posterUrl = selectImageUrl(data.posters, 'poster');
            const backdropUrl = selectImageUrl(data.backdrops, 'backdrop');

            imageUrls = [posterUrl, backdropUrl].filter((value): value is string => Boolean(value));
            imageTypes = [
                ...(posterUrl ? ['poster' as const] : []),
                ...(backdropUrl ? ['backdrop' as const] : []),
            ];
            imageUrl = imageUrls[0] || '';
            imageType = (imageTypes[0] || 'poster') as 'poster' | 'backdrop';
        } else {
            const backdropUrl = selectImageUrl(data.backdrops, 'backdrop');
            const logoUrl = selectLogoUrl(data.logos);
            let renderedLogoUrl = '';

            if (logoUrl) {
                try {
                    renderedLogoUrl = await renderTMDbLogoCard(logoUrl, 'brand_backdrop');
                } catch (error) {
                    console.warn('[TMDb] Failed to render logo card for change-image flow:', error);
                }
            }

            imageUrls = [backdropUrl, renderedLogoUrl].filter((value): value is string => Boolean(value));
            imageTypes = [
                ...(backdropUrl ? ['backdrop' as const] : []),
                ...(renderedLogoUrl ? ['logo' as const] : []),
            ];
            imageUrl = imageUrls[0] || '';
            imageType = (imageTypes[0] || 'backdrop') as 'backdrop' | 'logo';
        }

        if (!imageUrl) {
            return res.status(404).json({
                success: false,
                error: { message: `No ${type} image available for this title` }
            });
        }

        res.json({
            success: true,
            data: {
                imageUrl,
                imageType,
                imageUrls,
                imageTypes,
                availablePosters: data.posters?.length || 0,
                availableBackdrops: data.backdrops?.length || 0,
                availableLogos: data.logos?.length || 0,
            }
        });
    } catch (error) {
        console.error('Error fetching TMDb images:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch images' } });
    }
});

export default router;

