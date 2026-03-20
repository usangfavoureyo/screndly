import { PlatformConnection, Prisma } from '@prisma/client';
import prisma from './prisma';
import { decrypt, encrypt } from './encryption';

const SENSITIVE_METADATA_KEYS = new Set(['userToken']);

function getJsonObject(value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined): Prisma.JsonObject {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
        return {};
    }

    return { ...(value as Prisma.JsonObject) };
}

function maybeEncryptToken(value: string | null | undefined): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return value ?? null;
    }

    return encrypt(value);
}

function maybeDecryptToken(value: string | null | undefined): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return value ?? null;
    }

    return decrypt(value);
}

function encryptMetadata(metadata: Prisma.InputJsonValue | Prisma.JsonValue | null | undefined): Prisma.JsonObject | null {
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
        return metadata == null ? null : getJsonObject(metadata);
    }

    const next = getJsonObject(metadata);
    for (const key of SENSITIVE_METADATA_KEYS) {
        const value = next[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            next[key] = encrypt(value);
        }
    }

    return next;
}

function decryptMetadata(metadata: Prisma.JsonValue | null | undefined): Prisma.JsonObject | null {
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
        return metadata == null ? null : getJsonObject(metadata);
    }

    const next = getJsonObject(metadata);
    for (const key of SENSITIVE_METADATA_KEYS) {
        const value = next[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            next[key] = decrypt(value);
        }
    }

    return next;
}

export function decryptPlatformConnection(connection: PlatformConnection | null): PlatformConnection | null {
    if (!connection) {
        return null;
    }

    return {
        ...connection,
        accessToken: maybeDecryptToken(connection.accessToken),
        refreshToken: maybeDecryptToken(connection.refreshToken),
        metadata: decryptMetadata(connection.metadata),
    };
}

type PlatformConnectionPayload = {
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: Date | null;
    username?: string | null;
    userId?: string | null;
    metadata?: Prisma.InputJsonValue | Prisma.JsonValue | null;
};

function encryptPlatformConnectionUpdateData(data: PlatformConnectionPayload): Prisma.PlatformConnectionUncheckedUpdateInput {
    return {
        accessToken: maybeEncryptToken(data.accessToken),
        refreshToken: maybeEncryptToken(data.refreshToken),
        expiresAt: data.expiresAt ?? null,
        username: data.username ?? null,
        userId: data.userId ?? null,
        metadata: encryptMetadata(data.metadata) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined,
    };
}

function encryptPlatformConnectionCreateData(platform: string, data: PlatformConnectionPayload): Prisma.PlatformConnectionUncheckedCreateInput {
    return {
        platform,
        accessToken: maybeEncryptToken(data.accessToken),
        refreshToken: maybeEncryptToken(data.refreshToken),
        expiresAt: data.expiresAt ?? null,
        username: data.username ?? null,
        userId: data.userId ?? null,
        metadata: encryptMetadata(data.metadata) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined,
    };
}

export async function findPlatformConnection(platform: string): Promise<PlatformConnection | null> {
    const connection = await prisma.platformConnection.findUnique({
        where: { platform },
    });

    return decryptPlatformConnection(connection);
}

export async function findPlatformConnections(): Promise<PlatformConnection[]> {
    const connections = await prisma.platformConnection.findMany();
    return connections
        .map((connection) => decryptPlatformConnection(connection))
        .filter((connection): connection is PlatformConnection => connection !== null);
}

export async function updatePlatformConnection(
    platform: string,
    data: PlatformConnectionPayload
): Promise<PlatformConnection> {
    const connection = await prisma.platformConnection.update({
        where: { platform },
        data: encryptPlatformConnectionUpdateData(data),
    });

    return decryptPlatformConnection(connection)!;
}

export async function upsertPlatformConnection(
    platform: string,
    data: PlatformConnectionPayload
): Promise<PlatformConnection> {
    const connection = await prisma.platformConnection.upsert({
        where: { platform },
        update: encryptPlatformConnectionUpdateData(data),
        create: encryptPlatformConnectionCreateData(platform, data),
    });

    return decryptPlatformConnection(connection)!;
}
