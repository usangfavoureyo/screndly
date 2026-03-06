import { PlatformConnection, Prisma } from '@prisma/client';
import axios from 'axios';
import prisma from '../../lib/prisma';
import { env } from '../../lib/env';
import { metaService } from './meta';

const REFRESH_WINDOW_MS = 5 * 60 * 1000;

function getJsonObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
        return {};
    }

    return { ...(value as Prisma.JsonObject) };
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
    return prisma.platformConnection.update({
        where: { platform: connection.platform },
        data: {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken === undefined ? connection.refreshToken : data.refreshToken,
            expiresAt: data.expiresAt === undefined ? connection.expiresAt : data.expiresAt,
            metadata: {
                ...getJsonObject(connection.metadata),
                ...(data.metadataPatch || {}),
            },
        },
    });
}

async function refreshXConnection(connection: PlatformConnection): Promise<PlatformConnection> {
    if (!connection.refreshToken || !env.X_CLIENT_ID) {
        return connection;
    }

    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refreshToken,
        client_id: env.X_CLIENT_ID,
    });

    if (env.X_CLIENT_SECRET) {
        params.append('client_secret', env.X_CLIENT_SECRET);
    }

    const response = await axios.post('https://api.x.com/2/oauth2/token', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    if (!connection.refreshToken || !env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
        return connection;
    }

    const params = new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY,
        client_secret: env.TIKTOK_CLIENT_SECRET,
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
    if (!connection.refreshToken || !env.PINTEREST_APP_ID || !env.PINTEREST_APP_SECRET) {
        return connection;
    }

    const basicAuth = Buffer.from(`${env.PINTEREST_APP_ID}:${env.PINTEREST_APP_SECRET}`).toString('base64');
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

export async function ensureFreshPlatformConnection(connection: PlatformConnection | null): Promise<PlatformConnection | null> {
    if (!connection || !needsRefresh(connection)) {
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
