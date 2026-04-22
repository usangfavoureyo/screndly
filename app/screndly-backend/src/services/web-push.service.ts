import webpush from 'web-push';
import prisma from '../lib/prisma';
import { env } from '../lib/env';
import { encrypt } from '../lib/encryption';
import { getSecretSetting, getStringSetting } from '../lib/settings';

const VAPID_PUBLIC_KEY_SETTING = 'webPushVapidPublicKey';
const VAPID_PRIVATE_KEY_SETTING = 'webPushVapidPrivateKey';
const VAPID_SUBJECT_SETTING = 'webPushVapidSubject';
const DEFAULT_VAPID_SUBJECT = 'mailto:notifications@screndly.app';

interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh?: string;
    auth?: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  badgeCount?: number;
  tag?: string;
  requireInteraction?: boolean;
  source?: string;
  type?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeVapidKey(value: string | null | undefined): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) {
    return null;
  }

  // Accept keys pasted in standard base64 form and normalize them to URL-safe base64 without padding.
  return trimmed
    .replace(/\s+/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sanitizeVapidSubject(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim().replace(/^['"]|['"]$/g, '') : '';
  return trimmed || DEFAULT_VAPID_SUBJECT;
}

function tryValidateVapidConfig(config: VapidConfig): VapidConfig | null {
  try {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    return config;
  } catch (error) {
    console.warn('[WebPush] Invalid VAPID config detected:', error);
    return null;
  }
}

function normalizeSubscription(payload: PushSubscriptionPayload) {
  if (!isNonEmptyString(payload?.endpoint)) {
    throw new Error('Push subscription endpoint is required');
  }

  if (!isNonEmptyString(payload?.keys?.p256dh) || !isNonEmptyString(payload?.keys?.auth)) {
    throw new Error('Push subscription keys are incomplete');
  }

  return {
    endpoint: payload.endpoint.trim(),
    p256dh: payload.keys.p256dh.trim(),
    auth: payload.keys.auth.trim(),
    expirationTime: typeof payload.expirationTime === 'number' && Number.isFinite(payload.expirationTime)
      ? new Date(payload.expirationTime)
      : null,
  };
}

function getConfiguredVapidSubject(): string {
  const configured = process.env.WEB_PUSH_VAPID_SUBJECT?.trim().replace(/^['"]|['"]$/g, '');
  if (configured) {
    return configured;
  }

  const frontendUrl = env.FRONTEND_URL?.trim();
  if (frontendUrl?.startsWith('http://') || frontendUrl?.startsWith('https://')) {
    return frontendUrl;
  }

  return DEFAULT_VAPID_SUBJECT;
}

class WebPushService {
  private cachedConfig: VapidConfig | null = null;
  private configPromise: Promise<VapidConfig> | null = null;

  private async persistGeneratedKeys(config: VapidConfig): Promise<void> {
    await Promise.all([
      prisma.setting.upsert({
        where: { key: VAPID_PUBLIC_KEY_SETTING },
        update: { value: config.publicKey },
        create: { key: VAPID_PUBLIC_KEY_SETTING, value: config.publicKey },
      }),
      prisma.setting.upsert({
        where: { key: VAPID_PRIVATE_KEY_SETTING },
        update: { value: encrypt(config.privateKey) },
        create: { key: VAPID_PRIVATE_KEY_SETTING, value: encrypt(config.privateKey) },
      }),
      prisma.setting.upsert({
        where: { key: VAPID_SUBJECT_SETTING },
        update: { value: config.subject },
        create: { key: VAPID_SUBJECT_SETTING, value: config.subject },
      }),
    ]);
  }

  private async loadOrCreateConfig(): Promise<VapidConfig> {
    const envPublicKey = sanitizeVapidKey(process.env.WEB_PUSH_VAPID_PUBLIC_KEY);
    const envPrivateKey = sanitizeVapidKey(process.env.WEB_PUSH_VAPID_PRIVATE_KEY);
    const envSubject = sanitizeVapidSubject(getConfiguredVapidSubject());

    const envConfig = envPublicKey && envPrivateKey
      ? tryValidateVapidConfig({
          publicKey: envPublicKey,
          privateKey: envPrivateKey,
          subject: envSubject,
        })
      : null;

    if (envConfig) {
      return envConfig;
    }

    const [storedPublicKey, storedPrivateKey, storedSubject] = await Promise.all([
      getStringSetting(VAPID_PUBLIC_KEY_SETTING),
      getSecretSetting(VAPID_PRIVATE_KEY_SETTING),
      getStringSetting(VAPID_SUBJECT_SETTING),
    ]);

    const storedConfig = sanitizeVapidKey(storedPublicKey) && sanitizeVapidKey(storedPrivateKey)
      ? tryValidateVapidConfig({
          publicKey: sanitizeVapidKey(storedPublicKey)!,
          privateKey: sanitizeVapidKey(storedPrivateKey)!,
          subject: sanitizeVapidSubject(storedSubject || envSubject),
        })
      : null;

    if (storedConfig) {
      return storedConfig;
    }

    const generated = webpush.generateVAPIDKeys();
    const config: VapidConfig = {
      publicKey: sanitizeVapidKey(generated.publicKey) || generated.publicKey,
      privateKey: sanitizeVapidKey(generated.privateKey) || generated.privateKey,
      subject: envSubject,
    };

    await this.persistGeneratedKeys(config);
    return config;
  }

  private async getConfig(): Promise<VapidConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    if (!this.configPromise) {
      this.configPromise = this.loadOrCreateConfig()
        .then((config) => {
          this.cachedConfig = config;
          return config;
        })
        .finally(() => {
          this.configPromise = null;
        });
    }

    return this.configPromise;
  }

  async getPublicKey(): Promise<string> {
    const config = await this.getConfig();
    return config.publicKey;
  }

  async saveSubscription(payload: PushSubscriptionPayload, userAgent?: string | null): Promise<void> {
    const normalized = normalizeSubscription(payload);

    await prisma.pushSubscription.upsert({
      where: {
        endpoint: normalized.endpoint,
      },
      update: {
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        expirationTime: normalized.expirationTime,
        userAgent: userAgent || null,
        failureCount: 0,
        lastFailureAt: null,
      },
      create: {
        endpoint: normalized.endpoint,
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        expirationTime: normalized.expirationTime,
        userAgent: userAgent || null,
      },
    });
  }

  async removeSubscription(endpoint: string): Promise<number> {
    if (!isNonEmptyString(endpoint)) {
      return 0;
    }

    const result = await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: endpoint.trim(),
      },
    });

    return result.count;
  }

  async sendNotification(
    payload: PushNotificationPayload,
    options: { endpoint?: string } = {}
  ): Promise<{ sent: number; removed: number }> {
    await this.getConfig();

    const subscriptions = await prisma.pushSubscription.findMany({
      where: options.endpoint
        ? {
            endpoint: options.endpoint,
          }
        : undefined,
    });

    if (subscriptions.length === 0) {
      return { sent: 0, removed: 0 };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-72x72.png',
      badgeCount: typeof payload.badgeCount === 'number' ? payload.badgeCount : 0,
      tag: payload.tag || 'screndly-notification',
      requireInteraction: Boolean(payload.requireInteraction),
      source: payload.source || 'system',
      type: payload.type || 'info',
      timestamp: new Date().toISOString(),
    });

    let sent = 0;
    let removed = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime?.getTime() ?? null,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          notificationPayload
        );

        sent += 1;
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            lastSuccessAt: new Date(),
            lastFailureAt: null,
            failureCount: 0,
          },
        }).catch(() => undefined);
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || error?.status || 0);

        if (statusCode === 404 || statusCode === 410) {
          removed += await this.removeSubscription(subscription.endpoint);
          continue;
        }

        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            lastFailureAt: new Date(),
            failureCount: {
              increment: 1,
            },
          },
        }).catch(() => undefined);

        console.error(`[WebPush] Failed to send push notification to ${subscription.endpoint}:`, error);
      }
    }

    return { sent, removed };
  }
}

export const webPushService = new WebPushService();
