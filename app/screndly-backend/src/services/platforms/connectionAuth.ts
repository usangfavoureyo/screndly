import { PlatformConnection, Prisma } from '@prisma/client';
import axios from 'axios';
import { env } from '../../lib/env';
import { findPlatformConnection, updatePlatformConnection } from '../../lib/platformConnections';
import { getTikTokClientKey, getTikTokClientSecret } from '../../lib/tiktokOAuth';
import { getPinterestAppId, getPinterestAppSecret } from '../../lib/pinterestOAuth';
import { buildXTokenRequest, getXOAuthClientId } from '../../lib/xOAuth';
import { metaService } from './meta';

const REFRESH_WINDOW_MS = 5 * 60 * 1000;
const PLACEHOLDER_ACCESS_TOKEN_PREFIXES = ['test-', 'mock-', 'placeholder-', 'fake-', 'demo-'];

function getJsonObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
        return {};
    }

    return { ...(value as Prisma.JsonObject) };
}

function getJsonString(value: Prisma.JsonObject, key: string): string | undefined {
    const candidate = value[key];
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : undefined;
}

export function isPlaceholderAccessToken(accessToken?: string | null): boolean {
    if (!accessToken) {
        return false;
    }

    const normalized = accessToken.trim().toLowerCase();
    return PLACEHOLDER_ACCESS_TOKEN_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function hasUsablePlatformAccessToken(
    connection: Pick<PlatformConnection, 'platform' | 'accessToken'> | null | undefined
): boolean {
    return !!connection?.accessToken && !isPlaceholderAccessToken(connection.accessToken);
}

function needsRefresh(connection: PlatformConnection): boolean {
    if (!connection.accessToken || !connection.expiresAt) {
        return false;
    }

    return connection.expiresAt.getTime() <= Date.now() + REFRESH_WINDOW_MS;
}

async function persistConnectionUpdate(
    connection: PlatformConnection,
    data: {
        accessToken: string;
        refreshToken?: string | null;
        expiresAt?: Date | null;
        metadataPatch?: Prisma.JsonObject;
    }
): Promise<PlatformConnection> {
    return updatePlatformConnection(connection.platform, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken === undefined ? connection.refreshToken : data.refreshToken,
        expiresAt: data.expiresAt === undefined ? connection.expiresAt : data.expiresAt,
        username: connection.username,
        userId: connection.userId,
        metadata: {
            ...getJsonObject(connection.metadata),
            ...(data.metadataPatch || {}),
        },
    });
}

async function refreshXConnection(connection: PlatformConnection): Promise<PlatformConnection> {
    const xClientId = getXOAuthClientId();
    if (!connection.refreshToken || !xClientId) {
        return connection;
    }

    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refreshToken,
    });
    const { params: tokenParams, headers: tokenHeaders } = buildXTokenRequest(params);

    const response = await axios.post('https://api.x.com/2/oauth2/token', tokenParams.toString(), {
        headers: tokenHeaders,
    });

    const tokenData = response.data as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
    };

    return persistConnectionUpdate(connection, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || connection.refreshToken,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : connection.expiresAt,
        metadataPatch: {
            scope: tokenData.scope || undefined,
            tokenType: tokenData.token_type || undefined,
        },
    });
}

async function refreshYouTubeConnection(connection: PlatformConnection): Promise<PlatformConnection> {
    if (!connection.refreshToken || !env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) {
        return connection;
    }

    const params = new URLSearchParams({
        client_id: env.YOUTUBE_CLIENT_ID,
        client_secret: env.YOUTUBE_CLIENT_SECRET,
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
    });

    const response = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const tokenData = response.data as {
        access_token: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
    };

    return persistConnectionUpdate(connection, {
        accessToken: tokenData.access_token,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : connection.expiresAt,
        metadataPatch: {
            scope: tokenData.scope || undefined,
            tokenType: tokenData.token_type || undefined,
        },
    });
}

async function refreshTikTokConnection(connection: PlatformConnection): Promise<PlatformConnection> {
    const tiktokClientKey = getTikTokClientKey();
    const tiktokClientSecret = getTikTokClientSecret();
    if (!connection.refreshToken || !tiktokClientKey || !tiktokClientSecret) {
        return connection;
    }

    const params = new URLSearchParams({
        client_key: tiktokClientKey,
        client_secret: tiktokClientSecret,
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
    });

    const response = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', params.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cache-Control': 'no-cache',
        },
    });

    const tokenData = (response.data?.data || response.data) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        refresh_expires_in?: number;
        scope?: string;
        token_type?: string;
    };

    return persistConnectionUpdate(connection, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || connection.refreshToken,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : connection.expiresAt,
        metadataPatch: {
            refreshExpiresAt: tokenData.refresh_expires_in
                ? new Date(Date.now() + tokenData.refresh_expires_in * 1000).toISOString()
                : undefined,
            scope: tokenData.scope || undefined,
            tokenType: tokenData.token_type || undefined,
        },
    });
}

async function refreshPinterestConnection(connection: PlatformConnection): Promise<PlatformConnection> {
    const pinterestAppId = getPinterestAppId();
    const pinterestAppSecret = getPinterestAppSecret();

    if (!connection.refreshToken || !pinterestAppId || !pinterestAppSecret) {
        return connection;
    }

    const basicAuth = Buffer.from(`${pinterestAppId}:${pinterestAppSecret}`).toString('base64');
    const params = new URLSearchParams({
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
    });

    const response = await axios.post('https://api.pinterest.com/v5/oauth/token', params.toString(), {
        headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    const tokenData = response.data as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
    };

    return persistConnectionUpdate(connection, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || connection.refreshToken,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : connection.expiresAt,
        metadataPatch: {
            scope: tokenData.scope || undefined,
            tokenType: tokenData.token_type || undefined,
        },
    });
}

async function refreshThreadsConnection(connection: PlatformConnection): Promise<PlatformConnection> {
    if (!connection.accessToken) {
        return connection;
    }

    const tokenData = await metaService.refreshThreadsLongLivedToken(connection.accessToken);

    return persistConnectionUpdate(connection, {
        accessToken: tokenData.access_token,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : connection.expiresAt,
        metadataPatch: {
            tokenType: tokenData.token_type || undefined,
        },
    });
}

async function repairInstagramConnection(connection: PlatformConnection): Promise<PlatformConnection> {
    const metadata = getJsonObject(connection.metadata);
    const storedUserToken = getJsonString(metadata, 'userToken');
    const storedPageId = getJsonString(metadata, 'pageId');
    const needsRepair =
        !hasUsablePlatformAccessToken(connection)
        || !storedUserToken
        || !storedPageId;

    if (!needsRepair) {
        return connection;
    }

    const facebookConnection = await findPlatformConnection('Facebook');

    if (!facebookConnection) {
        return connection;
    }

    const facebookMetadata = getJsonObject(facebookConnection.metadata);
    const facebookUserToken = getJsonString(facebookMetadata, 'userToken');

    if (!facebookUserToken) {
        return connection;
    }

    const pages = await metaService.getPages(facebookUserToken);
    if (!Array.isArray(pages) || pages.length === 0) {
        return connection;
    }

    let matchedPage: any = null;
    let instagramBusinessId: string | null = null;

    for (const page of pages) {
        const candidateInstagramId =
            typeof page?.instagram_business_account?.id === 'string'
                ? page.instagram_business_account.id
                : await metaService.getInstagramBusinessId(page.id, page.access_token);

        if (!candidateInstagramId) {
            continue;
        }

        if (storedPageId && page.id === storedPageId) {
            matchedPage = page;
            instagramBusinessId = candidateInstagramId;
            break;
        }

        if (connection.userId && candidateInstagramId === connection.userId) {
            matchedPage = page;
            instagramBusinessId = candidateInstagramId;
            break;
        }

        if (!matchedPage) {
            matchedPage = page;
            instagramBusinessId = candidateInstagramId;
        }
    }

    if (!matchedPage || !instagramBusinessId) {
        return connection;
    }

    const profile = await metaService.getInstagramProfile(instagramBusinessId, facebookUserToken);
    const nextMetadata: Prisma.JsonObject = {
        ...metadata,
        userToken: facebookUserToken,
        pageId: String(matchedPage.id),
        pageName: typeof matchedPage.name === 'string' ? matchedPage.name : undefined,
        profileUrl: profile.profileUrl || getJsonString(metadata, 'profileUrl'),
    };

    return updatePlatformConnection(connection.platform, {
        accessToken: facebookUserToken,
        refreshToken: connection.refreshToken,
        userId: instagramBusinessId,
        username: profile.username || connection.username || instagramBusinessId,
        expiresAt: facebookConnection.expiresAt ?? connection.expiresAt,
        metadata: nextMetadata,
    });
}

export async function ensureFreshPlatformConnection(connection: PlatformConnection | null): Promise<PlatformConnection | null> {
    if (!connection) {
        return connection;
    }

    if (connection.platform === 'Instagram') {
        connection = await repairInstagramConnection(connection);
    }

    if (!needsRefresh(connection)) {
        return connection;
    }

    switch (connection.platform) {
        case 'X':
            return refreshXConnection(connection);
        case 'YouTube':
            return refreshYouTubeConnection(connection);
        case 'TikTok':
            return refreshTikTokConnection(connection);
        case 'Pinterest':
            return refreshPinterestConnection(connection);
        case 'Threads':
            return refreshThreadsConnection(connection);
        default:
            return connection;
    }
}
