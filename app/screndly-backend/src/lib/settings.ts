import prisma from './prisma';
import { decrypt } from './encryption';

export function readStringSettingValue(value: unknown): string | null {
    if (typeof value === 'string') {
        return value;
    }

    if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
        const nestedValue = (value as Record<string, unknown>).value;
        return typeof nestedValue === 'string' ? nestedValue : null;
    }

    return null;
}

export function readSecretSettingValue(value: unknown): string | null {
    const settingValue = readStringSettingValue(value);
    return settingValue ? decrypt(settingValue) : null;
}

export async function getStringSetting(key: string): Promise<string | null> {
    try {
        const setting = await prisma.setting.findUnique({ where: { key } });
        return readStringSettingValue(setting?.value);
    } catch (error) {
        console.error(`[Settings] Failed to read setting "${key}":`, error);
        return null;
    }
}

export async function getSecretSetting(key: string): Promise<string | null> {
    try {
        const setting = await prisma.setting.findUnique({ where: { key } });
        return readSecretSettingValue(setting?.value);
    } catch (error) {
        console.error(`[Settings] Failed to read secret setting "${key}":`, error);
        return null;
    }
}
