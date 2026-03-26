export interface CollaboratorMetadata {
    primaryChannelId?: string;
    primaryChannelName?: string;
    collaboratorChannelIds: string[];
    collaboratorChannelNames: string[];
    isCollaborativePost: boolean;
}

function normalizeName(value?: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function collectCreatorEntries(raw: any): Array<{ name?: string; url?: string; id?: string }> {
    const creators = Array.isArray(raw?.creators) ? raw.creators : [];

    return creators.flatMap((entry: unknown) => {
        if (typeof entry === 'string') {
            return [{ name: entry }];
        }

        if (entry && typeof entry === 'object') {
            const record = entry as { name?: unknown; url?: unknown; id?: unknown };
            return [{
                name: typeof record.name === 'string' ? record.name : undefined,
                url: typeof record.url === 'string' ? record.url : undefined,
                id: typeof record.id === 'string' ? record.id : undefined,
            }];
        }

        return [];
    });
}

export function extractCollaboratorMetadata(raw: any): CollaboratorMetadata {
    const creatorEntries = collectCreatorEntries(raw);
    const collaboratorNames = creatorEntries
        .map((entry) => entry.name)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    const collaboratorIds = creatorEntries
        .map((entry) => entry.id || entry.url)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return {
        primaryChannelId: typeof raw?.channel_id === 'string' ? raw.channel_id : undefined,
        primaryChannelName: typeof raw?.channel === 'string' ? raw.channel : (typeof raw?.uploader === 'string' ? raw.uploader : undefined),
        collaboratorChannelIds: collaboratorIds,
        collaboratorChannelNames: collaboratorNames,
        isCollaborativePost: collaboratorNames.length > 0 || collaboratorIds.length > 0,
    };
}

export function isExplicitCollaboratorForTrackedChannel(
    trackedChannel: { channelId: string; name: string },
    raw: any
): boolean {
    const metadata = extractCollaboratorMetadata(raw);
    if (!metadata.isCollaborativePost) {
        return false;
    }

    if (metadata.primaryChannelId === trackedChannel.channelId) {
        return false;
    }

    const trackedName = normalizeName(trackedChannel.name);
    const collaboratorNameMatch = metadata.collaboratorChannelNames.some((name) => normalizeName(name) === trackedName);
    const collaboratorIdMatch = metadata.collaboratorChannelIds.some((value) => value.includes(trackedChannel.channelId));

    return collaboratorNameMatch || collaboratorIdMatch;
}
