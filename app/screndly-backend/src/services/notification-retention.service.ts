import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export const READ_NOTIFICATION_RETENTION_HOURS = 24;
export const UNREAD_NOTIFICATION_RETENTION_HOURS = 48;
const CLEANUP_SETTINGS_KEYS = ['cleanupEnabled', 'recentActivityRetention'] as const;

function hoursAgo(hours: number, now: Date): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

async function loadNotificationRetentionConfig() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [...CLEANUP_SETTINGS_KEYS],
      },
    },
    select: {
      key: true,
      value: true,
    },
  });

  const cleanupEnabledValue = settings.find((setting) => setting.key === 'cleanupEnabled')?.value;
  const cleanupEnabled = cleanupEnabledValue === null || cleanupEnabledValue === undefined
    ? true
    : String(cleanupEnabledValue).toLowerCase() !== 'false';

  const recentActivityHours = Number.parseInt(
    String(settings.find((setting) => setting.key === 'recentActivityRetention')?.value ?? ''),
    10
  );

  const retentionHours = Number.isFinite(recentActivityHours) && recentActivityHours > 0
    ? recentActivityHours
    : READ_NOTIFICATION_RETENTION_HOURS;

  return {
    cleanupEnabled,
    readRetentionHours: retentionHours,
    unreadRetentionHours: retentionHours,
  };
}

export async function getActiveNotificationWhere(now: Date = new Date()): Promise<Prisma.NotificationWhereInput> {
  const config = await loadNotificationRetentionConfig();

  if (!config.cleanupEnabled) {
    return {};
  }

  return {
    OR: [
      {
        read: true,
        createdAt: {
          gte: hoursAgo(config.readRetentionHours, now),
        },
      },
      {
        read: false,
        createdAt: {
          gte: hoursAgo(config.unreadRetentionHours, now),
        },
      },
    ],
  };
}

export async function getExpiredNotificationWhere(now: Date = new Date()): Promise<Prisma.NotificationWhereInput | null> {
  const config = await loadNotificationRetentionConfig();

  if (!config.cleanupEnabled) {
    return null;
  }

  return {
    OR: [
      {
        read: true,
        createdAt: {
          lt: hoursAgo(config.readRetentionHours, now),
        },
      },
      {
        read: false,
        createdAt: {
          lt: hoursAgo(config.unreadRetentionHours, now),
        },
      },
    ],
  };
}

export async function purgeExpiredNotifications(now: Date = new Date()): Promise<number> {
  const where = await getExpiredNotificationWhere(now);
  if (!where) {
    return 0;
  }

  const result = await prisma.notification.deleteMany({
    where,
  });

  return result.count;
}
