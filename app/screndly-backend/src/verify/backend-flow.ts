process.env.NODE_ENV = 'test';
export {};

type JsonValue = Record<string, any>;

async function fetchJson(url: string, options: RequestInit = {}, timeoutMs = 15000) {
    const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await response.text();
    let json: JsonValue;
    try {
        json = JSON.parse(text);
    } catch {
        json = { raw: text };
    }

    return {
        status: response.status,
        json,
    };
}

async function main() {
    const { default: app } = await import('../index');
    const prismaModule = await import('../lib/prisma');
    const prisma = prismaModule.default;

    const port = Number(process.env.VERIFY_PORT || 3002);
    const host = '127.0.0.1';
    const baseUrl = `http://${host}:${port}`;
    const server = app.listen(port, host);

    await new Promise<void>((resolve) => server.once('listening', resolve));

    const results: JsonValue = {};

    try {
        const login = await fetchJson(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: process.env.APP_PASSWORD || 'missing-password' }),
        });

        results.login = {
            status: login.status,
            success: !!login.json?.success || !!login.json?.token,
        };

        const token = login.json?.token as string | undefined;
        if (!token) {
            throw new Error('Login failed');
        }

        const authHeaders = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        };

        const aiStatus = await fetchJson(`${baseUrl}/api/ai/status`, { headers: authHeaders });
        results.aiStatus = {
            status: aiStatus.status,
            data: aiStatus.json?.data ?? aiStatus.json,
        };

        const aiGenerate = await fetchJson(`${baseUrl}/api/ai/generate`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                model: 'gpt-5-mini',
                jsonMode: true,
                temperature: 0.2,
                maxTokens: 400,
                prompt: 'Return JSON with startTime, endTime, and sceneDescription for a dramatic action sequence around 01:10:00 to 01:17:30.',
            }),
        }, 25000);
        results.aiGenerate = {
            status: aiGenerate.status,
            success: !!aiGenerate.json?.success,
            content: aiGenerate.json?.data?.content ?? null,
            error: aiGenerate.json?.error ?? null,
        };

        const authStart = await fetchJson(`${baseUrl}/api/platforms/auth/X?redirectUri=http://127.0.0.1:5173/platforms/callback`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const authUrl = authStart.json?.data?.url || authStart.json?.url || authStart.json?.authUrl;
        results.authStart = {
            status: authStart.status,
            hasAuthUrl: !!authUrl,
            hasState: typeof authUrl === 'string' && authUrl.includes('state='),
            hasPkce: typeof authUrl === 'string' && authUrl.includes('code_challenge='),
        };

        const stateMatch = typeof authUrl === 'string' ? authUrl.match(/[?&]state=([^&]+)/) : null;
        const state = stateMatch ? decodeURIComponent(stateMatch[1]) : null;
        const callback = await fetchJson(`${baseUrl}/api/platforms/callback`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                platform: 'X',
                code: 'fake-code',
                state,
                redirectUri: 'http://127.0.0.1:5173/platforms/callback',
            }),
        });

        const callbackError = callback.json?.error ?? callback.json?.message ?? callback.json;
        const callbackMessage = typeof callbackError === 'string'
            ? callbackError
            : callbackError?.message || JSON.stringify(callbackError);

        results.callback = {
            status: callback.status,
            error: callbackError,
            reachedProviderExchange: typeof callbackMessage === 'string' &&
                !callbackMessage.toLowerCase().includes('missing pkce verifier'),
        };

        const apiUsage = await fetchJson(`${baseUrl}/api/dashboard/api-usage`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        results.apiUsage = {
            status: apiUsage.status,
            success: !!apiUsage.json?.success,
            total: apiUsage.json?.data?.cards?.total ?? null,
        };

        console.log(JSON.stringify(results, null, 2));
    } finally {
        server.close();
        await prisma.$disconnect().catch(() => undefined);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
