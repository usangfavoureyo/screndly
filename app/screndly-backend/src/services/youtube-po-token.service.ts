import { BG } from 'bgutils-js';
import { JSDOM } from 'jsdom';
import { ProxyAgent, type Dispatcher } from 'undici';
import {
    DEFAULT_YT_DLP_USER_AGENT,
    type YouTubeNetworkContext,
} from '../lib/yt-dlp';

const YOUTUBE_PO_TOKEN_REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';
const YOUTUBE_PO_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const YOUTUBE_PO_TOKEN_FALLBACK_TTL_MS = 6 * 60 * 60 * 1000;
const YOUTUBE_PO_TOKEN_SOURCE_URL = 'https://www.youtube.com/';
const YOUTUBE_ACCEPT_LANGUAGE = 'en-US,en;q=0.9';
const YOUTUBE_VISITOR_DATA_PATTERN = /"visitorData":"([^"]+)/;

type GlobalDomKey = 'window' | 'document' | 'location' | 'origin' | 'navigator';

interface YouTubePoTokenSession {
    visitorData: string;
    poToken: string;
    expiresAt: number;
    playerTokens: Map<string, Promise<string> | string>;
}

interface ResolvedYouTubeNetworkContext {
    proxyUrl: string | null;
    userAgent: string;
    cacheKey: string;
    dispatcher?: Dispatcher;
}

class YouTubePoTokenService {
    private cachedSessions = new Map<string, YouTubePoTokenSession>();
    private pendingSessions = new Map<string, Promise<YouTubePoTokenSession>>();
    private proxyDispatchers = new Map<string, Dispatcher>();

    async getExtractorArgs(videoId?: string, networkContext?: YouTubeNetworkContext): Promise<string[]> {
        const resolvedContext = this.resolveNetworkContext(networkContext);
        const session = await this.getSession(resolvedContext);
        const poTokens = [`mweb.gvs+${session.poToken}`];
        if (videoId) {
            poTokens.push(`mweb.player+${await this.getPlayerToken(session, videoId, resolvedContext)}`);
        }

        return [
            `youtube:player-client=default,mweb;po_token=${poTokens.join(',')};visitor_data=${session.visitorData};player_skip=webpage,configs`,
        ];
    }

    private resolveNetworkContext(networkContext?: YouTubeNetworkContext): ResolvedYouTubeNetworkContext {
        const proxyUrl = networkContext?.proxyUrl?.trim() || null;
        const userAgent = networkContext?.userAgent?.trim() || DEFAULT_YT_DLP_USER_AGENT;
        const cacheKey = networkContext?.cacheKey || `${proxyUrl || 'direct'}|${userAgent}`;

        return {
            proxyUrl,
            userAgent,
            cacheKey,
            ...(proxyUrl ? { dispatcher: this.getProxyDispatcher(proxyUrl) } : {}),
        };
    }

    private getProxyDispatcher(proxyUrl: string): Dispatcher {
        const cached = this.proxyDispatchers.get(proxyUrl);
        if (cached) {
            return cached;
        }

        const dispatcher = new ProxyAgent(proxyUrl);
        this.proxyDispatchers.set(proxyUrl, dispatcher);
        return dispatcher;
    }

    private async getSession(networkContext: ResolvedYouTubeNetworkContext): Promise<YouTubePoTokenSession> {
        const cachedSession = this.cachedSessions.get(networkContext.cacheKey) || null;
        if (this.isSessionValid(cachedSession)) {
            return cachedSession;
        }

        const pendingSession = this.pendingSessions.get(networkContext.cacheKey);
        if (!pendingSession) {
            const nextPendingSession = this.mintSession(networkContext)
                .then((session) => {
                    this.cachedSessions.set(networkContext.cacheKey, session);
                    return session;
                })
                .finally(() => {
                    this.pendingSessions.delete(networkContext.cacheKey);
                });

            this.pendingSessions.set(networkContext.cacheKey, nextPendingSession);
            return nextPendingSession;
        }

        return pendingSession;
    }

    private isSessionValid(session: YouTubePoTokenSession | null): session is YouTubePoTokenSession {
        return Boolean(
            session
            && session.visitorData
            && session.poToken
            && session.expiresAt - YOUTUBE_PO_TOKEN_REFRESH_BUFFER_MS > Date.now()
        );
    }

    private async getPlayerToken(
        session: YouTubePoTokenSession,
        videoId: string,
        networkContext: ResolvedYouTubeNetworkContext
    ): Promise<string> {
        const cached = session.playerTokens.get(videoId);
        if (typeof cached === 'string') {
            return cached;
        }

        if (cached) {
            return cached;
        }

        const pendingToken = this.mintPoToken(videoId, networkContext)
            .then((result) => {
                session.playerTokens.set(videoId, result.poToken);
                return result.poToken;
            })
            .catch((error) => {
                session.playerTokens.delete(videoId);
                throw error;
            });

        session.playerTokens.set(videoId, pendingToken);
        return pendingToken;
    }

    private async mintSession(networkContext: ResolvedYouTubeNetworkContext): Promise<YouTubePoTokenSession> {
        console.log('[YouTubePoToken] Minting a new session token for yt-dlp fallback', {
            proxyEnabled: Boolean(networkContext.proxyUrl),
            userAgent: networkContext.userAgent,
        });

        const visitorData = await this.fetchVisitorData(networkContext);
        if (!visitorData) {
            throw new Error('YouTube visitor data is unavailable');
        }

        const poTokenResult = await this.mintPoToken(visitorData, networkContext);

        const ttlMs = Math.max(
            60 * 1000,
            poTokenResult.ttlMs || YOUTUBE_PO_TOKEN_FALLBACK_TTL_MS
        );

        return {
            visitorData,
            poToken: poTokenResult.poToken,
            expiresAt: Date.now() + ttlMs,
            playerTokens: new Map(),
        };
    }

    private async mintPoToken(
        identifier: string,
        networkContext: ResolvedYouTubeNetworkContext
    ): Promise<{ poToken: string; ttlMs: number }> {
        const poTokenResult = await this.withYouTubeDomGlobals(networkContext.userAgent, async () => {
            const bgConfig = {
                fetch: this.createFetchWithNetworkContext(networkContext),
                globalObj: globalThis,
                identifier,
                requestKey: YOUTUBE_PO_TOKEN_REQUEST_KEY,
            };

            const challenge = await BG.Challenge.create(bgConfig);
            if (!challenge) {
                throw new Error('Failed to create YouTube attestation challenge');
            }

            const interpreterJavascript = challenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
            if (!interpreterJavascript) {
                throw new Error('YouTube attestation interpreter was empty');
            }

            new Function(interpreterJavascript)();

            return BG.PoToken.generate({
                program: challenge.program,
                globalName: challenge.globalName,
                bgConfig,
            });
        });

        return {
            poToken: poTokenResult.poToken,
            ttlMs: Math.max(
                60 * 1000,
                Number(poTokenResult.integrityTokenData?.estimatedTtlSecs || 0) * 1000 || YOUTUBE_PO_TOKEN_FALLBACK_TTL_MS
            ),
        };
    }

    private createFetchWithNetworkContext(networkContext: ResolvedYouTubeNetworkContext) {
        return async (input: string | URL | Request, init?: RequestInit) => {
            const requestHeaders = new Headers(init?.headers || {});
            if (!requestHeaders.has('user-agent')) {
                requestHeaders.set('user-agent', networkContext.userAgent);
            }
            if (!requestHeaders.has('accept-language')) {
                requestHeaders.set('accept-language', YOUTUBE_ACCEPT_LANGUAGE);
            }

            return fetch(input, {
                ...init,
                headers: requestHeaders,
                ...(networkContext.dispatcher ? { dispatcher: networkContext.dispatcher } : {}),
            } as RequestInit & { dispatcher?: Dispatcher });
        };
    }

    private async fetchVisitorData(networkContext: ResolvedYouTubeNetworkContext): Promise<string> {
        const response = await fetch(YOUTUBE_PO_TOKEN_SOURCE_URL, {
            headers: {
                'user-agent': networkContext.userAgent,
                'accept-language': YOUTUBE_ACCEPT_LANGUAGE,
            },
            ...(networkContext.dispatcher ? { dispatcher: networkContext.dispatcher } : {}),
        } as RequestInit & { dispatcher?: Dispatcher });

        if (!response.ok) {
            throw new Error(`YouTube visitor data request failed: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const visitorData = html.match(YOUTUBE_VISITOR_DATA_PATTERN)?.[1];
        if (!visitorData) {
            throw new Error('YouTube visitor data was not present in the homepage response');
        }

        return visitorData;
    }

    private async withYouTubeDomGlobals<T>(userAgent: string, operation: () => Promise<T>): Promise<T> {
        const dom = new JSDOM('', { url: YOUTUBE_PO_TOKEN_SOURCE_URL });
        const keys: GlobalDomKey[] = ['window', 'document', 'location', 'origin', 'navigator'];
        const originalDescriptors = new Map<GlobalDomKey, PropertyDescriptor | undefined>();

        for (const key of keys) {
            originalDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        }

        Object.defineProperty(dom.window.navigator, 'userAgent', {
            configurable: true,
            value: userAgent,
        });

        Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: dom.window });
        Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: dom.window.document });
        Object.defineProperty(globalThis, 'location', { configurable: true, writable: true, value: dom.window.location });
        Object.defineProperty(globalThis, 'origin', { configurable: true, writable: true, value: dom.window.origin });
        Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: dom.window.navigator });

        try {
            return await operation();
        } finally {
            dom.window.close();

            for (const key of keys) {
                const descriptor = originalDescriptors.get(key);
                if (descriptor) {
                    Object.defineProperty(globalThis, key, descriptor);
                } else {
                    Reflect.deleteProperty(globalThis, key);
                }
            }
        }
    }
}

export const youtubePoTokenService = new YouTubePoTokenService();
