import { apiClient } from '../lib/api/client';
import { fetchSettings } from '../lib/api/settings';
import type { BackblazeBrowserFile } from '../lib/api/backblaze';

export type BucketType = 'general' | 'videos' | 'design';

interface BackblazeConfig {
  bucketName: string;
  endpoint: string;
}

interface UploadOptions {
  file: File;
  fileName?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  onProgress?: (progress: number) => void;
  bucketType?: BucketType;
}

interface UploadResult {
  success: boolean;
  url?: string;
  previewUrl?: string;
  fileId?: string;
  error?: string;
}

const LOCAL_SETTINGS_KEYS = ['screndlySettings', 'screndly_settings'] as const;
const DEFAULT_ENDPOINT = 's3.us-west-004.backblazeb2.com';

function getLocalSettings(): Record<string, unknown> {
  if (typeof window === 'undefined') {
    return {};
  }

  for (const key of LOCAL_SETTINGS_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      continue;
    }

    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  return {};
}

function getBucketNameKey(bucketType: BucketType): string {
  switch (bucketType) {
    case 'videos':
      return 'backblazeVideosBucketName';
    case 'design':
      return 'backblazeDesignBucketName';
    case 'general':
    default:
      return 'backblazeBucketName';
  }
}

function getSensitiveKeyNames(bucketType: BucketType): { keyId: string; applicationKey: string } {
  switch (bucketType) {
    case 'videos':
      return {
        keyId: 'backblazeVideosKeyId',
        applicationKey: 'backblazeVideosApplicationKey',
      };
    case 'design':
      return {
        keyId: 'backblazeDesignKeyId',
        applicationKey: 'backblazeDesignApplicationKey',
      };
    case 'general':
    default:
      return {
        keyId: 'backblazeKeyId',
        applicationKey: 'backblazeApplicationKey',
      };
  }
}

export function getBackblazeConfig(bucketType: BucketType = 'general'): BackblazeConfig | null {
  const settings = getLocalSettings();
  const bucketName = settings[getBucketNameKey(bucketType)];
  const endpoint = settings.backblazeEndpoint;

  if (typeof bucketName !== 'string' || bucketName.trim().length === 0) {
    return null;
  }

  return {
    bucketName,
    endpoint: typeof endpoint === 'string' && endpoint.trim().length > 0 ? endpoint : DEFAULT_ENDPOINT,
  };
}

export async function uploadToBackblaze(options: UploadOptions): Promise<UploadResult> {
  const response = await apiClient.uploadFile<{
    url: string;
    fileId?: string;
    fileName: string;
  }>('/api/create/upload-asset', options.file, options.onProgress);

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error?.message || 'Failed to upload asset',
    };
  }

  return {
    success: true,
    url: response.data.url,
    previewUrl: response.data.previewUrl,
    fileId: response.data.fileId || response.data.fileName,
  };
}

export async function deleteFromBackblaze(_fileName: string, _bucketType: BucketType = 'general'): Promise<boolean> {
  console.warn('[Backblaze] Direct browser delete is disabled. Use an authenticated backend route instead.');
  return false;
}

export function generateFileName(originalName: string, prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');

  const parts = [
    prefix,
    baseName,
    timestamp,
    random,
  ].filter(Boolean);

  return `${parts.join('-')}.${extension}`;
}

export function getPublicUrl(fileName: string, bucketType: BucketType = 'general'): string | null {
  const config = getBackblazeConfig(bucketType);

  if (!config) {
    return null;
  }

  return `https://${config.bucketName}.${config.endpoint}/${fileName}`;
}

export function isBackblazeConfigured(bucketType: BucketType = 'general'): boolean {
  return getBackblazeConfig(bucketType) !== null;
}

export async function validateBackblazeConfig(bucketType: BucketType = 'general'): Promise<{ valid: boolean; error?: string }> {
  const response = await fetchSettings();
  const settings = response.data;

  if (!response.success || !settings) {
    return {
      valid: false,
      error: response.error?.message || 'Unable to verify Backblaze configuration',
    };
  }

  const bucketName = settings[getBucketNameKey(bucketType) as keyof typeof settings];
  const sensitiveKeys = getSensitiveKeyNames(bucketType);
  const keyId = settings[sensitiveKeys.keyId as keyof typeof settings];
  const applicationKey = settings[sensitiveKeys.applicationKey as keyof typeof settings];

  if (
    typeof bucketName === 'string' &&
    bucketName.trim().length > 0 &&
    typeof keyId === 'string' &&
    keyId.trim().length > 0 &&
    typeof applicationKey === 'string' &&
    applicationKey.trim().length > 0
  ) {
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Backblaze bucket is not fully configured',
  };
}

export async function listBackblazeFiles(): Promise<{ success: boolean; files?: BackblazeBrowserFile[]; error?: string }> {
  return {
    success: false,
    error: 'Direct browser file listing is disabled. Use authenticated backend routes instead.',
  };
}

export async function listDesignTemplates(): Promise<{ success: boolean; files?: BackblazeBrowserFile[]; error?: string }> {
  const response = await apiClient.get<BackblazeBrowserFile[]>('/api/design-studio/backblaze/templates');

  if (!response.success) {
    return {
      success: false,
      error: response.error?.message || 'Failed to list templates',
    };
  }

  return {
    success: true,
    files: response.data || [],
  };
}
