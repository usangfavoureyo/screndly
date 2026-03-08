import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { getSecretSetting, getStringSetting } from '../lib/settings';

export type BackblazeBucketType = 'general' | 'videos' | 'design';

interface BackblazeBucketConfig {
  keyId: string;
  applicationKey: string;
  bucketName: string;
  endpoint: string;
}

interface UploadOptions {
  bucketTypes?: BackblazeBucketType[];
  prefix?: string;
  contentType?: string;
}

const DEFAULT_ENDPOINT = 's3.us-west-004.backblazeb2.com';

const BUCKET_SETTING_KEYS: Record<BackblazeBucketType, { keyId: string; applicationKey: string; bucketName: string }> = {
  general: {
    keyId: 'backblazeKeyId',
    applicationKey: 'backblazeApplicationKey',
    bucketName: 'backblazeBucketName',
  },
  videos: {
    keyId: 'backblazeVideosKeyId',
    applicationKey: 'backblazeVideosApplicationKey',
    bucketName: 'backblazeVideosBucketName',
  },
  design: {
    keyId: 'backblazeDesignKeyId',
    applicationKey: 'backblazeDesignApplicationKey',
    bucketName: 'backblazeDesignBucketName',
  },
};

const BUCKET_ENV_KEYS: Record<BackblazeBucketType, { keyId: string[]; applicationKey: string[]; bucketName: string[] }> = {
  general: {
    keyId: ['BACKBLAZE_GENERAL_KEY_ID', 'BACKBLAZE_KEY_ID'],
    applicationKey: ['BACKBLAZE_GENERAL_APPLICATION_KEY', 'BACKBLAZE_APPLICATION_KEY'],
    bucketName: ['BACKBLAZE_GENERAL_BUCKET_NAME', 'BACKBLAZE_BUCKET_NAME'],
  },
  videos: {
    keyId: ['BACKBLAZE_VIDEOS_KEY_ID'],
    applicationKey: ['BACKBLAZE_VIDEOS_APPLICATION_KEY'],
    bucketName: ['BACKBLAZE_VIDEOS_BUCKET_NAME'],
  },
  design: {
    keyId: ['BACKBLAZE_DESIGN_KEY_ID'],
    applicationKey: ['BACKBLAZE_DESIGN_APPLICATION_KEY'],
    bucketName: ['BACKBLAZE_DESIGN_BUCKET_NAME'],
  },
};

function readEnvValue(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';
}

function buildFileName(originalName: string, prefix?: string): string {
  const extension = path.extname(originalName) || '';
  const baseName = sanitizePathSegment(path.basename(originalName, extension));
  const randomSuffix = randomBytes(4).toString('hex');
  const safePrefix = prefix
    ? prefix
        .split('/')
        .filter(Boolean)
        .map(sanitizePathSegment)
        .join('/')
    : '';

  const fileName = `${baseName}-${Date.now()}-${randomSuffix}${extension}`;
  return safePrefix ? `${safePrefix}/${fileName}` : fileName;
}

async function getBucketConfig(bucketType: BackblazeBucketType): Promise<BackblazeBucketConfig | null> {
  const bucketSettings = BUCKET_SETTING_KEYS[bucketType];
  const bucketEnvKeys = BUCKET_ENV_KEYS[bucketType];
  const [settingKeyId, settingApplicationKey, settingBucketName, settingEndpoint] = await Promise.all([
    getSecretSetting(bucketSettings.keyId),
    getSecretSetting(bucketSettings.applicationKey),
    getStringSetting(bucketSettings.bucketName),
    getStringSetting('backblazeEndpoint'),
  ]);

  const keyId = settingKeyId || readEnvValue(bucketEnvKeys.keyId);
  const applicationKey = settingApplicationKey || readEnvValue(bucketEnvKeys.applicationKey);
  const bucketName = settingBucketName || readEnvValue(bucketEnvKeys.bucketName);
  const endpoint = settingEndpoint || process.env.BACKBLAZE_ENDPOINT?.trim() || DEFAULT_ENDPOINT;

  if (!keyId || !applicationKey || !bucketName) {
    return null;
  }

  return {
    keyId,
    applicationKey,
    bucketName,
    endpoint: endpoint || DEFAULT_ENDPOINT,
  };
}

async function uploadBufferWithBucket(
  buffer: Buffer,
  originalName: string,
  bucketType: BackblazeBucketType,
  options: UploadOptions
): Promise<{ url: string; fileName: string }> {
  const config = await getBucketConfig(bucketType);
  if (!config) {
    throw new Error(`Backblaze ${bucketType} bucket is not configured`);
  }

  const fileName = buildFileName(originalName, options.prefix);
  const uploadUrl = `https://${config.endpoint}/${config.bucketName}/${fileName}`;
  const auth = Buffer.from(`${config.keyId}:${config.applicationKey}`).toString('base64');

  await axios.put(uploadUrl, buffer, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': options.contentType || 'application/octet-stream',
      'Content-Length': buffer.length,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return {
    url: `https://${config.bucketName}.${config.endpoint}/${fileName}`,
    fileName,
  };
}

export async function uploadBufferToBackblaze(
  buffer: Buffer,
  originalName: string,
  options: UploadOptions = {}
): Promise<{ url: string; fileName: string }> {
  const bucketTypes: BackblazeBucketType[] = options.bucketTypes && options.bucketTypes.length > 0
    ? options.bucketTypes
    : ['general'];
  let lastError: Error | null = null;

  for (const bucketType of bucketTypes) {
    try {
      return await uploadBufferWithBucket(buffer, originalName, bucketType, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('Failed to upload file to Backblaze');
}

export async function uploadLocalFileToBackblaze(
  filePath: string,
  originalName: string,
  options: UploadOptions = {}
): Promise<{ url: string; fileName: string }> {
  const buffer = await fs.readFile(filePath);
  return uploadBufferToBackblaze(buffer, originalName, options);
}
