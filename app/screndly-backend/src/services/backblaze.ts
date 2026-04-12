import fs from 'fs/promises';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import { getSecretSetting, getStringSetting } from '../lib/settings';

export type BackblazeBucketType = 'general' | 'videos' | 'design';

interface BackblazeBucketConfig {
  keyId: string;
  applicationKey: string;
  bucketName: string;
  endpoint: string;
}

interface BackblazeBucketRuntime extends BackblazeBucketConfig {
  accountId: string;
  apiUrl: string;
  downloadUrl: string;
  authorizationToken: string;
  bucketId: string;
  expiresAt: number;
}

interface UploadOptions {
  bucketTypes?: BackblazeBucketType[];
  prefix?: string;
  contentType?: string;
}

interface ListOptions {
  prefix?: string;
  maxFileCount?: number;
}

export interface BackblazeFileRecord {
  fileId: string;
  fileName: string;
  contentType: string;
  contentLength: number;
  uploadTimestamp: number;
  lastModified: Date;
  url: string;
}

interface AuthorizeAccountResponse {
  accountId: string;
  apiInfo?: {
    storageApi?: {
      apiUrl?: string;
      downloadUrl?: string;
      authorizationToken?: string;
    };
  };
  apiUrl?: string;
  authorizationToken?: string;
  downloadUrl?: string;
}

interface ListBucketsResponse {
  buckets: Array<{
    bucketId: string;
    bucketName: string;
  }>;
}

interface GetUploadUrlResponse {
  authorizationToken: string;
  uploadUrl: string;
}

interface GetDownloadAuthorizationResponse {
  authorizationToken: string;
}

interface BackblazeAuthorizedDownloadRequest {
  url: string;
  headers?: Record<string, string>;
}

interface ListFileNamesResponse {
  files: Array<{
    action?: string;
    contentLength?: number;
    contentType?: string;
    fileId: string;
    fileName: string;
    size?: number;
    uploadTimestamp?: number;
  }>;
  nextFileName?: string | null;
}

class BackblazeApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'BackblazeApiError';
    this.status = status;
    this.details = details;
  }
}

const DEFAULT_ENDPOINT = 's3.us-west-004.backblazeb2.com';
const AUTH_CACHE_TTL_MS = 23 * 60 * 60 * 1000;

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

const authCache = new Map<string, BackblazeBucketRuntime>();

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

function encodeFileName(fileName: string): string {
  return fileName
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

function buildPublicUrl(downloadUrl: string, bucketName: string, fileName: string): string {
  return `${downloadUrl}/file/${encodeURIComponent(bucketName)}/${encodeFileName(fileName)}`;
}

function buildAuthorizedUrl(downloadUrl: string, bucketName: string, fileName: string, authorizationToken: string): string {
  return `${buildPublicUrl(downloadUrl, bucketName, fileName)}?Authorization=${encodeURIComponent(authorizationToken)}`;
}

function buildCacheKey(bucketType: BackblazeBucketType, config: BackblazeBucketConfig): string {
  return `${bucketType}:${config.keyId}:${config.bucketName}:${config.endpoint}`;
}

function parseBackblazeFileUrl(value: string): { bucketName: string; fileName: string } | null {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const fileMarkerIndex = segments.indexOf('file');
    if (fileMarkerIndex === -1 || segments.length < fileMarkerIndex + 3) {
      return null;
    }

    const bucketName = decodeURIComponent(segments[fileMarkerIndex + 1] || '');
    const fileName = segments
      .slice(fileMarkerIndex + 2)
      .map(segment => decodeURIComponent(segment))
      .join('/');

    if (!bucketName || !fileName) {
      return null;
    }

    return { bucketName, fileName };
  } catch {
    return null;
  }
}

async function parseErrorResponse(response: Response): Promise<{ message: string; details: unknown }> {
  const text = await response.text();

  if (!text) {
    return {
      message: response.statusText || 'Backblaze request failed',
      details: null,
    };
  }

  try {
    const data = JSON.parse(text);
    return {
      message: data.message || data.code || response.statusText || 'Backblaze request failed',
      details: data,
    };
  } catch {
    return {
      message: text,
      details: text,
    };
  }
}

async function backblazeJsonRequest<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<T> {
  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const parsedError = await parseErrorResponse(response);
    throw new BackblazeApiError(parsedError.message, response.status, parsedError.details);
  }

  return response.json() as Promise<T>;
}

async function backblazeUploadRequest(
  url: string,
  buffer: Buffer,
  headers: Record<string, string>
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: buffer,
  });

  if (!response.ok) {
    const parsedError = await parseErrorResponse(response);
    throw new BackblazeApiError(parsedError.message, response.status, parsedError.details);
  }
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

async function resolveBucketRuntime(bucketType: BackblazeBucketType): Promise<BackblazeBucketRuntime> {
  const config = await getBucketConfig(bucketType);
  if (!config) {
    throw new Error(`Backblaze ${bucketType} bucket is not configured`);
  }

  const cacheKey = buildCacheKey(bucketType, config);
  const cached = authCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached;
  }

  const basicAuth = Buffer.from(`${config.keyId}:${config.applicationKey}`).toString('base64');
  const auth = await backblazeJsonRequest<AuthorizeAccountResponse>(
    'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    }
  );

  const storageApi = auth.apiInfo?.storageApi;
  const apiUrl = storageApi?.apiUrl || auth.apiUrl;
  const downloadUrl = storageApi?.downloadUrl || auth.downloadUrl;
  const authorizationToken = storageApi?.authorizationToken || auth.authorizationToken;

  if (!auth.accountId || !apiUrl || !downloadUrl || !authorizationToken) {
    throw new Error('Backblaze authorization response was incomplete');
  }

  const buckets = await backblazeJsonRequest<ListBucketsResponse>(
    `${apiUrl}/b2api/v2/b2_list_buckets`,
    {
      headers: {
        Authorization: authorizationToken,
      },
      body: {
        accountId: auth.accountId,
        bucketName: config.bucketName,
      },
    }
  );

  const bucket = buckets.buckets.find(item => item.bucketName === config.bucketName);
  if (!bucket) {
    throw new Error(`Backblaze bucket "${config.bucketName}" was not found for ${bucketType}`);
  }

  const runtime: BackblazeBucketRuntime = {
    ...config,
    accountId: auth.accountId,
    apiUrl,
    downloadUrl,
    authorizationToken,
    bucketId: bucket.bucketId,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  };

  authCache.set(cacheKey, runtime);
  return runtime;
}

async function resolveBucketRuntimeByBucketName(bucketName: string): Promise<BackblazeBucketRuntime | null> {
  const bucketTypes: BackblazeBucketType[] = ['general', 'videos', 'design'];
  const normalizedBucketName = bucketName.trim().toLowerCase();

  for (const bucketType of bucketTypes) {
    const config = await getBucketConfig(bucketType);
    if (!config || config.bucketName.trim().toLowerCase() !== normalizedBucketName) {
      continue;
    }

    return resolveBucketRuntime(bucketType);
  }

  return null;
}

function normalizeFileRecord(runtime: BackblazeBucketRuntime, file: ListFileNamesResponse['files'][number]): BackblazeFileRecord {
  const uploadTimestamp = typeof file.uploadTimestamp === 'number' ? file.uploadTimestamp : Date.now();
  const contentLength = typeof file.contentLength === 'number'
    ? file.contentLength
    : typeof file.size === 'number'
      ? file.size
      : 0;

  return {
    fileId: file.fileId,
    fileName: file.fileName,
    contentType: file.contentType || 'application/octet-stream',
    contentLength,
    uploadTimestamp,
    lastModified: new Date(uploadTimestamp),
    url: buildPublicUrl(runtime.downloadUrl, runtime.bucketName, file.fileName),
  };
}

export async function listBackblazeFiles(
  bucketType: BackblazeBucketType,
  options: ListOptions = {}
): Promise<BackblazeFileRecord[]> {
  const runtime = await resolveBucketRuntime(bucketType);
  const maxFileCount = Math.max(1, Math.min(options.maxFileCount || 1000, 1000));
  let startFileName: string | undefined;
  const results: BackblazeFileRecord[] = [];

  while (results.length < maxFileCount) {
    const response = await backblazeJsonRequest<ListFileNamesResponse>(
      `${runtime.apiUrl}/b2api/v2/b2_list_file_names`,
      {
        headers: {
          Authorization: runtime.authorizationToken,
        },
        body: {
          bucketId: runtime.bucketId,
          prefix: options.prefix || undefined,
          maxFileCount: Math.min(1000, maxFileCount - results.length),
          startFileName,
        },
      }
    );

    const visibleFiles = response.files
      .filter(file => file.action !== 'hide')
      .map(file => normalizeFileRecord(runtime, file));

    results.push(...visibleFiles);

    if (!response.nextFileName || response.files.length === 0) {
      break;
    }

    startFileName = response.nextFileName;
  }

  return results;
}

export async function deleteBackblazeFile(
  bucketType: BackblazeBucketType,
  file: Pick<BackblazeFileRecord, 'fileId' | 'fileName'>
): Promise<void> {
  const runtime = await resolveBucketRuntime(bucketType);

  await backblazeJsonRequest(
    `${runtime.apiUrl}/b2api/v2/b2_delete_file_version`,
    {
      headers: {
        Authorization: runtime.authorizationToken,
      },
      body: {
        fileId: file.fileId,
        fileName: file.fileName,
      },
    }
  );
}

async function uploadBufferWithBucket(
  buffer: Buffer,
  originalName: string,
  bucketType: BackblazeBucketType,
  options: UploadOptions
): Promise<{ url: string; fileName: string }> {
  const runtime = await resolveBucketRuntime(bucketType);
  const fileName = buildFileName(originalName, options.prefix);
  const sha1 = createHash('sha1').update(buffer).digest('hex');

  const upload = await backblazeJsonRequest<GetUploadUrlResponse>(
    `${runtime.apiUrl}/b2api/v2/b2_get_upload_url`,
    {
      headers: {
        Authorization: runtime.authorizationToken,
      },
      body: {
        bucketId: runtime.bucketId,
      },
    }
  );

  await backblazeUploadRequest(upload.uploadUrl, buffer, {
    Authorization: upload.authorizationToken,
    'Content-Type': options.contentType || 'b2/x-auto',
    'Content-Length': String(buffer.length),
    'X-Bz-Content-Sha1': sha1,
    'X-Bz-File-Name': encodeFileName(fileName),
    'X-Bz-Info-src_last_modified_millis': String(Date.now()),
  });

  return {
    url: buildPublicUrl(runtime.downloadUrl, runtime.bucketName, fileName),
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

export async function getBackblazeAuthorizedDownloadUrl(
  fileUrl: string,
  validDurationInSeconds = 3600
): Promise<string> {
  const request = await getBackblazeAuthorizedDownloadRequest(fileUrl, validDurationInSeconds);
  return request.headers?.Authorization
    ? buildAuthorizedUrl(
        new URL(request.url).origin,
        parseBackblazeFileUrl(fileUrl)?.bucketName || '',
        parseBackblazeFileUrl(fileUrl)?.fileName || '',
        request.headers.Authorization,
      )
    : request.url;
}

export async function getBackblazeAuthorizedDownloadRequest(
  fileUrl: string,
  validDurationInSeconds = 3600
): Promise<BackblazeAuthorizedDownloadRequest> {
  const parsed = parseBackblazeFileUrl(fileUrl);
  if (!parsed) {
    return { url: fileUrl };
  }

  const runtime = await resolveBucketRuntimeByBucketName(parsed.bucketName);
  if (!runtime) {
    return { url: fileUrl };
  }

  const ttl = Math.max(1, Math.min(validDurationInSeconds, 7 * 24 * 60 * 60));
  const downloadAuth = await backblazeJsonRequest<GetDownloadAuthorizationResponse>(
    `${runtime.apiUrl}/b2api/v2/b2_get_download_authorization`,
    {
      headers: {
        Authorization: runtime.authorizationToken,
      },
      body: {
        bucketId: runtime.bucketId,
        fileNamePrefix: parsed.fileName,
        validDurationInSeconds: ttl,
      },
    }
  );

  if (!downloadAuth.authorizationToken) {
    throw new Error('Backblaze download authorization token was not returned');
  }

  return {
    url: buildPublicUrl(runtime.downloadUrl, parsed.bucketName, parsed.fileName),
    headers: {
      Authorization: downloadAuth.authorizationToken,
    },
  };
}
