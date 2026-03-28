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
import {
    type TMDbImageAsset,
} from '../services/tmdb-image-selection.service';
import { getBackblazeAuthorizedDownloadUrl } from '../services/backblaze';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const TMDB_POSTER_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';
const TMDB_BACKDROP_IMAGE_BASE = 'https://image.tmdb.org/t/p/w1280';
const UI_MEDIA_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

function isHttpUrl(value: unknown): value is string {
    return typeof value === 'string' && /^https?:\/\//i.test(value);
}

async function resolveUiMediaUrlMap(urls: string[]): Promise<Map<string, string>> {
    const uniqueUrls = [...new Set(urls.filter(isHttpUrl))];
    const resolvedEntries = await Promise.all(
        uniqueUrls.map(async (url) => {
            const resolved = await getBackblazeAuthorizedDownloadUrl(url, UI_MEDIA_URL_TTL_SECONDS);
            return [url, resolved] as const;
        })
    );

    return new Map<string, string>(resolvedEntries);
}

async function resolvePostUiMediaUrls<T extends { imageUrl?: string | null; imageUrls?: string[] | null }>(post: T): Promise<T> {
    const rawImageUrls = Array.isArray(post.imageUrls) ? post.imageUrls.filter(isHttpUrl) : [];
    const uniqueRawUrls = [
        ...(isHttpUrl(post.imageUrl) ? [post.imageUrl] : []),
        ...rawImageUrls,
    ];

    if (uniqueRawUrls.length === 0) {
        return post;
    }

    const resolvedUrlMap = await resolveUiMediaUrlMap(uniqueRawUrls);

    return {
        ...post,
        imageUrl: isHttpUrl(post.imageUrl)
            ? (resolvedUrlMap.get(post.imageUrl) || post.imageUrl)
            : post.imageUrl,
        imageUrls: Array.isArray(post.imageUrls)
            ? post.imageUrls.map((url) => resolvedUrlMap.get(url) || url)
            : post.imageUrls,
    };
}

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
        const resolvedPosts = await Promise.all(posts.map((post) => resolvePostUiMediaUrls(post)));

        res.json({ success: true, data: resolvedPosts });
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

// GET /api/tmdb/images/:mediaType/:tmdbId - Fetch TMDb image pools for style selection
router.get('/images/:mediaType/:tmdbId', async (req, res) => {
    try {
        const { mediaType, tmdbId } = req.params;

        if (mediaType !== 'movie' && mediaType !== 'tv') {
            return res.status(400).json({
                success: false,
                error: { message: 'Invalid media type. Must be "movie" or "tv".' }
            });
        }

        const TMDB_API_KEY = await getTmdbApiKey();
        if (!TMDB_API_KEY) {
            return res.status(400).json({
                success: false,
                error: { message: 'TMDb API key not configured. Add it in Settings > Integrations.' }
            });
        }

        const response = await fetch(
            `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch images from TMDb');
        }

        type TMDbImage = TMDbImageAsset;

        interface TMDbImagesResponse {
            posters?: TMDbImage[];
            backdrops?: TMDbImage[];
            logos?: TMDbImage[];
        }

        const data = await response.json() as TMDbImagesResponse;
        const scoreImage = (image: TMDbImage, kind: 'poster' | 'backdrop' | 'logo') => {
            const width = image.width || 0;
            const height = image.height || 0;
            const resolutionScore = (width * height) / 1_000_000;
            const voteScore = image.vote_average || 0;
            const languageScore = kind === 'logo'
                ? (image.iso_639_1 === 'en' ? 2 : image.iso_639_1 === null ? 1 : 0)
                : 0;

            return (languageScore * 10) + voteScore + resolutionScore;
        };

        const buildAssets = (images: TMDbImage[] | undefined, kind: 'poster' | 'backdrop' | 'logo') => {
            if (!images || images.length === 0) {
                return [];
            }

            const baseUrl = kind === 'backdrop' ? TMDB_BACKDROP_IMAGE_BASE : TMDB_POSTER_IMAGE_BASE;

            return [...images]
                .filter((image) => typeof image.file_path === 'string' && image.file_path.length > 0)
                .sort((left, right) => scoreImage(right, kind) - scoreImage(left, kind))
                .map((image) => ({
                    path: image.file_path || null,
                    url: `${baseUrl}${image.file_path}`,
                }));
        };

        res.json({
            success: true,
            data: {
                posters: buildAssets(data.posters, 'poster'),
                backdrops: buildAssets(data.backdrops, 'backdrop'),
                logos: buildAssets(data.logos, 'logo'),
            }
        });
    } catch (error) {
        console.error('Error fetching TMDb images:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch images' } });
    }
});

export default router;

