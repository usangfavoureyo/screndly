import { BG } from 'bgutils-js';
import { JSDOM } from 'jsdom';
import { Innertube } from 'youtubei.js';

const YOUTUBE_PO_TOKEN_REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';
const YOUTUBE_PO_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const YOUTUBE_PO_TOKEN_FALLBACK_TTL_MS = 6 * 60 * 60 * 1000;
const YOUTUBE_PO_TOKEN_SOURCE_URL = 'https://www.youtube.com/';

type GlobalDomKey = 'window' | 'document' | 'location' | 'origin' | 'navigator';

interface YouTubePoTokenSession {
    visitorData: string;
    poToken: string;
    expiresAt: number;
}

class YouTubePoTokenService {
    private cachedSession: YouTubePoTokenSession | null = null;
    private pendingSession: Promise<YouTubePoTokenSession> | null = null;

    async getExtractorArgs(): Promise<string[]> {
        const session = await this.getSession();
        return [
            `youtube:player-client=default,mweb;po_token=mweb.gvs+${session.poToken};visitor_data=${session.visitorData};player_skip=webpage,configs`,
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

    private async mintSession(): Promise<YouTubePoTokenSession> {
        console.log('[YouTubePoToken] Minting a new session token for yt-dlp fallback');

        const innertube = await Innertube.create({
            retrieve_player: false,
            enable_session_cache: false,
        });
        const visitorData = innertube.session.context.client.visitorData;
        if (!visitorData) {
            throw new Error('YouTube visitor data is unavailable');
        }

        const poTokenResult = await this.withYouTubeDomGlobals(async () => {
            const bgConfig = {
                fetch: globalThis.fetch.bind(globalThis),
                globalObj: globalThis,
                identifier: visitorData,
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

        const ttlMs = Math.max(
            60 * 1000,
            Number(poTokenResult.integrityTokenData?.estimatedTtlSecs || 0) * 1000 || YOUTUBE_PO_TOKEN_FALLBACK_TTL_MS
        );

        return {
            visitorData,
            poToken: poTokenResult.poToken,
            expiresAt: Date.now() + ttlMs,
        };
    }

    private async withYouTubeDomGlobals<T>(operation: () => Promise<T>): Promise<T> {
        const dom = new JSDOM('', { url: YOUTUBE_PO_TOKEN_SOURCE_URL });
        const keys: GlobalDomKey[] = ['window', 'document', 'location', 'origin', 'navigator'];
        const originalDescriptors = new Map<GlobalDomKey, PropertyDescriptor | undefined>();

        for (const key of keys) {
            originalDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        }

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
