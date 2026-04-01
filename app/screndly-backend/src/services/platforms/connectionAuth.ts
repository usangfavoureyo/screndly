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
const META_COMMENT_AUTOMATION_SCOPES = {
    Facebook: ['pages_manage_engagement'],
    Instagram: ['instagram_manage_comments'],
} as const;

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

function getJsonBoolean(value: Prisma.JsonObject, key: string): boolean | undefined {
    const candidate = value[key];
    return typeof candidate === 'boolean' ? candidate : undefined;
}

function getJsonStringArray(value: Prisma.JsonObject, key: string): string[] {
    const candidate = value[key];
    if (!Array.isArray(candidate)) {
        return [];
    }

    return candidate.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
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

export function hasPublishablePlatformConnection(
    connection: Pick<PlatformConnection, 'platform' | 'accessToken' | 'userId'> | null | undefined
): boolean {
    if (!hasUsablePlatformAccessToken(connection)) {
        return false;
    }

    if (!connection) {
        return false;
    }

    switch (connection.platform) {
        case 'Facebook':
        case 'Instagram':
        case 'Threads':
            return typeof connection.userId === 'string' && connection.userId.trim().length > 0;
        default:
            return true;
    }
}

function needsRefresh(connection: PlatformConnection): boolean {
    if (!connection.refreshToken) {
        return false;
    }

    if (!connection.accessToken || !connection.expiresAt) {
        return true;
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

    if (!tokenData.access_token) {
        const errorDescription = typeof response.data?.error_description === 'string'
            ? response.data.error_description
            : 'TikTok did not return a refreshed access token.';
        throw new Error(errorDescription);
    }

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

async function repairFacebookConnection(connection: PlatformConnection): Promise<PlatformConnection> {
    const metadata = getJsonObject(connection.metadata);
    const storedUserToken = getJsonString(metadata, 'userToken') || connection.accessToken || undefined;
    const storedPageId = getJsonString(metadata, 'pageId') || connection.userId || undefined;
    const needsRepair =
        !hasPublishablePlatformConnection(connection)
        || !storedPageId
        || !getJsonString(metadata, 'profileUrl');

    if (!needsRepair || !storedUserToken) {
        return connection;
    }

    try {
        const pages = await metaService.getPages(storedUserToken);
        if (!Array.isArray(pages) || pages.length === 0) {
            return connection;
        }

        const matchedPage =
            pages.find((page) => typeof page?.id === 'string' && page.id === storedPageId)
            || pages[0];

        if (!matchedPage?.id || !matchedPage?.access_token) {
            return connection;
        }

        return updatePlatformConnection(connection.platform, {
            accessToken: matchedPage.access_token,
            refreshToken: connection.refreshToken,
            expiresAt: connection.expiresAt,
            userId: String(matchedPage.id),
            username: typeof matchedPage.name === 'string' ? matchedPage.name : connection.username,
            metadata: {
                ...metadata,
                userToken: storedUserToken,
                pageId: String(matchedPage.id),
                pageName: typeof matchedPage.name === 'string' ? matchedPage.name : undefined,
                profileUrl: `https://www.facebook.com/${matchedPage.id}`,
            },
        });
    } catch {
        return connection;
    }
}

async function repairThreadsConnection(connection: PlatformConnection): Promise<PlatformConnection> {
    const metadata = getJsonObject(connection.metadata);
    const needsRepair =
        !hasPublishablePlatformConnection(connection)
        || !connection.username
        || !getJsonString(metadata, 'profileUrl');

    if (!needsRepair || !hasUsablePlatformAccessToken(connection)) {
        return connection;
    }

    try {
        const profile = await metaService.getThreadsProfile(connection.accessToken as string);
        if (!profile?.id) {
            return connection;
        }

        return updatePlatformConnection(connection.platform, {
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            expiresAt: connection.expiresAt,
            userId: String(profile.id),
            username: profile.username || profile.name || connection.username || String(profile.id),
            metadata: {
                ...metadata,
                profileUrl: profile.username ? `https://www.threads.net/@${profile.username}` : getJsonString(metadata, 'profileUrl'),
                profileImageUrl: profile.threads_profile_picture_url,
                bio: profile.threads_biography,
                isVerified: profile.is_verified,
            },
        });
    } catch {
        return connection;
    }
}

async function syncMetaAutomationPermissions(connection: PlatformConnection): Promise<PlatformConnection> {
    if (connection.platform !== 'Facebook' && connection.platform !== 'Instagram') {
        return connection;
    }

    const metadata = getJsonObject(connection.metadata);
    const requiredScopes = META_COMMENT_AUTOMATION_SCOPES[connection.platform];
    const storedRequiredScopes = getJsonStringArray(metadata, 'requiredAutomationScopes');
    const storedGrantedScopes = getJsonStringArray(metadata, 'grantedScopes');
    const storedPermissionState = getJsonBoolean(metadata, 'automationReplyScopesGranted');

    if (
        storedPermissionState !== undefined
        && storedGrantedScopes.length > 0
        && storedRequiredScopes.length === requiredScopes.length
        && requiredScopes.every((scope) => storedRequiredScopes.includes(scope))
    ) {
        return connection;
    }

    const userToken = getJsonString(metadata, 'userToken') || connection.accessToken;
    if (!userToken) {
        return connection;
    }

    try {
        const scopeInfo = await metaService.getGrantedScopes(userToken);
        const grantedScopeSet = new Set([...scopeInfo.scopes, ...scopeInfo.granularScopes]);
        const grantedScopes = Array.from(grantedScopeSet).sort();
        const automationReplyScopesGranted = requiredScopes.every((scope) => grantedScopeSet.has(scope));

        return updatePlatformConnection(connection.platform, {
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            expiresAt: connection.expiresAt,
            userId: connection.userId,
            username: connection.username,
            metadata: {
                ...metadata,
                grantedScopes,
                requiredAutomationScopes: [...requiredScopes],
                automationReplyScopesGranted,
            },
        });
    } catch {
        return connection;
    }
}

export async function ensureFreshPlatformConnection(connection: PlatformConnection | null): Promise<PlatformConnection | null> {
    if (!connection) {
        return connection;
    }

    if (connection.platform === 'Instagram') {
        connection = await repairInstagramConnection(connection);
    }

    if (connection.platform === 'Facebook') {
        connection = await repairFacebookConnection(connection);
    }

    if (connection.platform === 'Facebook' || connection.platform === 'Instagram') {
        connection = await syncMetaAutomationPermissions(connection);
    }

    if (needsRefresh(connection)) {
        switch (connection.platform) {
            case 'X':
                connection = await refreshXConnection(connection);
                break;
            case 'YouTube':
                connection = await refreshYouTubeConnection(connection);
                break;
            case 'TikTok':
                connection = await refreshTikTokConnection(connection);
                break;
            case 'Pinterest':
                connection = await refreshPinterestConnection(connection);
                break;
            case 'Threads':
                connection = await refreshThreadsConnection(connection);
                break;
            default:
                break;
        }
    }

    if (connection.platform === 'Threads') {
        connection = await repairThreadsConnection(connection);
    }

    return connection;
}
