import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getSecretSetting, getStringSetting } from '../lib/settings';
import { env } from '../lib/env';
import { trackApiUsage } from '../services/api-usage.service';

const router = Router();

router.use(authenticate);

function getErrorMessage(data: any, fallback: string): string {
    return data?.error?.message
        || data?.error?.errors?.[0]?.message
        || data?.message
        || fallback;
}

async function proxyJsonRequest<T>({
    service,
    endpoint,
    url,
    method = 'GET',
    headers = {},
    body,
}: {
    service: Parameters<typeof trackApiUsage>[0]['service'];
    endpoint: string;
    url: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: unknown;
}): Promise<{ ok: true; data: T } | { ok: false; status: number; errorMessage: string; details: any }> {
    let tracked = false;

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        const data = await response.json();
        await trackApiUsage({
            service,
            endpoint,
            success: response.ok,
        });
        tracked = true;

        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                errorMessage: getErrorMessage(data, `${service} request failed`),
                details: data,
            };
        }

        return { ok: true, data: data as T };
    } catch (error) {
        if (!tracked) {
            await trackApiUsage({
                service,
                endpoint,
                success: false,
            });
        }

        throw error;
    }
}

router.post('/serper/search', async (req, res) => {
    const apiKey = await getSecretSetting('serperKey');
    if (!apiKey) {
        return res.status(400).json({ success: false, error: { message: 'Serper API key not configured' } });
    }

    try {
        const result = await proxyJsonRequest<any>({
            service: 'serper',
            endpoint: '/search',
            url: 'https://google.serper.dev/search',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey,
            },
            body: req.body,
        });

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: { message: result.errorMessage, details: result.details } });
        }

        return res.json({ success: true, data: result.data });
    } catch (error) {
        console.error('[Serper] Search proxy failed:', error);
        return res.status(500).json({ success: false, error: { message: 'Serper API call failed' } });
    }
});

router.post('/serper/images', async (req, res) => {
    const apiKey = await getSecretSetting('serperKey');
    if (!apiKey) {
        return res.status(400).json({ success: false, error: { message: 'Serper API key not configured' } });
    }

    try {
        const result = await proxyJsonRequest<any>({
            service: 'serper',
            endpoint: '/images',
            url: 'https://google.serper.dev/images',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey,
            },
            body: req.body,
        });

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: { message: result.errorMessage, details: result.details } });
        }

        return res.json({ success: true, data: result.data });
    } catch (error) {
        console.error('[Serper] Image proxy failed:', error);
        return res.status(500).json({ success: false, error: { message: 'Serper image search failed' } });
    }
});

router.get('/google-search', async (req, res) => {
    const apiKey = await getSecretSetting('videoGoogleSearchApiKey') || env.GOOGLE_API_KEY || null;
    const cx = await getStringSetting('videoGoogleSearchCx');

    if (!apiKey) {
        return res.status(400).json({ success: false, error: { message: 'Google Search API key not configured' } });
    }

    if (!cx) {
        return res.status(400).json({ success: false, error: { message: 'Google Search CX not configured' } });
    }

    const query = typeof req.query.q === 'string'
        ? req.query.q
        : typeof req.headers['x-query'] === 'string'
            ? req.headers['x-query']
            : '';
    const requestedNum = typeof req.query.num === 'string'
        ? Number.parseInt(req.query.num, 10)
        : typeof req.headers['x-max-results'] === 'string'
            ? Number.parseInt(req.headers['x-max-results'], 10)
            : 10;
    const num = Number.isFinite(requestedNum) ? Math.min(Math.max(requestedNum, 1), 10) : 10;

    if (!query) {
        return res.status(400).json({ success: false, error: { message: 'Missing search query' } });
    }

    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);
    url.searchParams.set('num', String(num));

    try {
        const result = await proxyJsonRequest<any>({
            service: 'googleSearch',
            endpoint: '/customsearch/v1',
            url: url.toString(),
        });

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: { message: result.errorMessage, details: result.details } });
        }

        return res.json({ success: true, data: result.data });
    } catch (error) {
        console.error('[Google Search] Proxy failed:', error);
        return res.status(500).json({ success: false, error: { message: 'Google Search API call failed' } });
    }
});

router.post('/google-video-intelligence/annotate', async (req, res) => {
    const apiKey = await getSecretSetting('googleVideoIntelligenceKey') || env.GOOGLE_API_KEY || null;
    if (!apiKey) {
        return res.status(400).json({ success: false, error: { message: 'Google Video Intelligence API key not configured' } });
    }

    try {
        const result = await proxyJsonRequest<any>({
            service: 'googleVideo',
            endpoint: '/videos:annotate',
            url: `https://videointelligence.googleapis.com/v1/videos:annotate?key=${encodeURIComponent(apiKey)}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: req.body,
        });

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: { message: result.errorMessage, details: result.details } });
        }

        return res.json({ success: true, data: result.data });
    } catch (error) {
        console.error('[Google Video Intelligence] Proxy failed:', error);
        return res.status(500).json({ success: false, error: { message: 'Google Video Intelligence API call failed' } });
    }
});

router.post('/shotstack/render', async (req, res) => {
    const apiKey = await getSecretSetting('shotstackKey') || env.SHOTSTACK_API_KEY || null;
    if (!apiKey) {
        return res.status(400).json({ success: false, error: { message: 'Shotstack API key not configured' } });
    }

    try {
        const result = await proxyJsonRequest<any>({
            service: 'shotstack',
            endpoint: '/render',
            url: 'https://api.shotstack.io/v1/render',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: req.body,
        });

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: { message: result.errorMessage, details: result.details } });
        }

        return res.json({ success: true, data: result.data });
    } catch (error) {
        console.error('[Shotstack] Render proxy failed:', error);
        return res.status(500).json({ success: false, error: { message: 'Shotstack API call failed' } });
    }
});

router.get('/shotstack/render/:id', async (req, res) => {
    const apiKey = await getSecretSetting('shotstackKey') || env.SHOTSTACK_API_KEY || null;
    if (!apiKey) {
        return res.status(400).json({ success: false, error: { message: 'Shotstack API key not configured' } });
    }

    try {
        const result = await proxyJsonRequest<any>({
            service: 'shotstack',
            endpoint: `/render/${req.params.id}`,
            url: `https://api.shotstack.io/v1/render/${encodeURIComponent(req.params.id)}`,
            headers: {
                'x-api-key': apiKey,
            },
        });

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: { message: result.errorMessage, details: result.details } });
        }

        return res.json({ success: true, data: result.data });
    } catch (error) {
        console.error('[Shotstack] Status proxy failed:', error);
        return res.status(500).json({ success: false, error: { message: 'Shotstack status check failed' } });
    }
});

export default router;
