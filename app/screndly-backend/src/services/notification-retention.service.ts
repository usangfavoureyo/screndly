import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export const READ_NOTIFICATION_RETENTION_HOURS = 24;
export const UNREAD_NOTIFICATION_RETENTION_HOURS = 48;

function hoursAgo(hours: number, now: Date): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export function getActiveNotificationWhere(now: Date = new Date()): Prisma.NotificationWhereInput {
  return {
    OR: [
      {
        read: true,
        createdAt: {
          gte: hoursAgo(READ_NOTIFICATION_RETENTION_HOURS, now),
        },
      },
      {
        read: false,
        createdAt: {
          gte: hoursAgo(UNREAD_NOTIFICATION_RETENTION_HOURS, now),
        },
      },
    ],
  };
}

export function getExpiredNotificationWhere(now: Date = new Date()): Prisma.NotificationWhereInput {
  return {
    OR: [
      {
        read: true,
        createdAt: {
          lt: hoursAgo(READ_NOTIFICATION_RETENTION_HOURS, now),
        },
      },
      {
        read: false,
        createdAt: {
          lt: hoursAgo(UNREAD_NOTIFICATION_RETENTION_HOURS, now),
        },
      },
    ],
  };
}

export async function purgeExpiredNotifications(now: Date = new Date()): Promise<number> {
  const result = await prisma.notification.deleteMany({
    where: getExpiredNotificationWhere(now),
  });

  return result.count;
}

