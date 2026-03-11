import { BG } from 'bgutils-js';
import { JSDOM } from 'jsdom';

const YOUTUBE_PO_TOKEN_REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';
const YOUTUBE_PO_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const YOUTUBE_PO_TOKEN_FALLBACK_TTL_MS = 6 * 60 * 60 * 1000;
const YOUTUBE_PO_TOKEN_SOURCE_URL = 'https://www.youtube.com/';
const YOUTUBE_BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
const YOUTUBE_ACCEPT_LANGUAGE = 'en-US,en;q=0.9';
const YOUTUBE_VISITOR_DATA_PATTERN = /"visitorData":"([^"]+)/;

type GlobalDomKey = 'window' | 'document' | 'location' | 'origin' | 'navigator';

interface YouTubePoTokenSession {
    visitorData: string;
    poToken: string;
    expiresAt: number;
    playerTokens: Map<string, Promise<string> | string>;
}

class YouTubePoTokenService {
    private cachedSession: YouTubePoTokenSession | null = null;
    private pendingSession: Promise<YouTubePoTokenSession> | null = null;

    async getExtractorArgs(videoId?: string): Promise<string[]> {
        const session = await this.getSession();
        const poTokens = [`mweb.gvs+${session.poToken}`];
        if (videoId) {
            poTokens.push(`mweb.player+${await this.getPlayerToken(session, videoId)}`);
        }

        return [
            `youtube:player-client=default,mweb;po_token=${poTokens.join(',')};visitor_data=${session.visitorData};player_skip=webpage,configs`,
        ];
    }

    private async getSession(): Promise<YouTubePoTokenSession> {
        if (this.isSessionValid(this.cachedSession)) {
            return this.cachedSession;
        }

        if (!this.pendingSession) {
            this.pendingSession = this.mintSession()
                .then((session) => {
                    this.cachedSession = session;
                    return session;
                })
                .finally(() => {
                    this.pendingSession = null;
                });
        }

        return this.pendingSession;
    }

    private isSessionValid(session: YouTubePoTokenSession | null): session is YouTubePoTokenSession {
        return Boolean(
            session
            && session.visitorData
            && session.poToken
            && session.expiresAt - YOUTUBE_PO_TOKEN_REFRESH_BUFFER_MS > Date.now()
        );
    }

    private async getPlayerToken(session: YouTubePoTokenSession, videoId: string): Promise<string> {
        const cached = session.playerTokens.get(videoId);
        if (typeof cached === 'string') {
            return cached;
        }

        if (cached) {
            return cached;
        }

        const pendingToken = this.mintPoToken(videoId)
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

    private async mintSession(): Promise<YouTubePoTokenSession> {
        console.log('[YouTubePoToken] Minting a new session token for yt-dlp fallback');

        const visitorData = await this.fetchVisitorData();
        if (!visitorData) {
            throw new Error('YouTube visitor data is unavailable');
        }

        const poTokenResult = await this.mintPoToken(visitorData);

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

    private async mintPoToken(identifier: string): Promise<{ poToken: string; ttlMs: number }> {
        const poTokenResult = await this.withYouTubeDomGlobals(async () => {
            const bgConfig = {
                fetch: globalThis.fetch.bind(globalThis),
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

    private async fetchVisitorData(): Promise<string> {
        const response = await fetch(YOUTUBE_PO_TOKEN_SOURCE_URL, {
            headers: {
                'user-agent': YOUTUBE_BROWSER_USER_AGENT,
                'accept-language': YOUTUBE_ACCEPT_LANGUAGE,
            },
        });

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

    private async withYouTubeDomGlobals<T>(operation: () => Promise<T>): Promise<T> {
        const dom = new JSDOM('', { url: YOUTUBE_PO_TOKEN_SOURCE_URL });
        const keys: GlobalDomKey[] = ['window', 'document', 'location', 'origin', 'navigator'];
        const originalDescriptors = new Map<GlobalDomKey, PropertyDescriptor | undefined>();

        for (const key of keys) {
            originalDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        }

        Object.defineProperty(dom.window.navigator, 'userAgent', {
            configurable: true,
            value: YOUTUBE_BROWSER_USER_AGENT,
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
