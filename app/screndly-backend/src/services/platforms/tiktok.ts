import axios from 'axios';
import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomBytes } from 'crypto';
import { pipeline } from 'stream/promises';
import { validateVideoForTikTok } from '../platform-video-validation.service';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';
const MAX_SINGLE_CHUNK_BYTES = 64 * 1024 * 1024;
const DEFAULT_CHUNK_BYTES = 32 * 1024 * 1024;
const MAX_TIKTOK_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;

type TikTokPrivacyLevel =
    | 'PUBLIC_TO_EVERYONE'
    | 'MUTUAL_FOLLOW_FRIENDS'
    | 'FOLLOWER_OF_CREATOR'
    | 'SELF_ONLY';

interface TikTokVideoSource {
    filePath?: string;
    fileName?: string;
    mimeType?: string;
    videoUrl?: string;
}

interface TikTokCreatorInfo {
    privacy_level_options?: string[];
    comment_disabled?: boolean;
    duet_disabled?: boolean;
    stitch_disabled?: boolean;
    max_video_post_duration_sec?: number;
}

interface TikTokUploadPlan {
    fileSize: number;
    chunkSize: number;
    totalChunkCount: number;
}

interface TikTokUploadInit {
    publish_id: string;
    upload_url: string;
}

const VIDEO_MIME_TYPES: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
};

const MIME_EXTENSIONS: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'application/octet-stream': '.mp4',
};

function extractTikTokErrorMessage(error: any): string {
    const data = error?.response?.data;
    const code = typeof data?.error?.code === 'string' ? data.error.code : undefined;
    const message = data?.error?.message || data?.message || error.message || 'TikTok request failed';
    const combined = code && message && !String(message).includes(code) ? `${code}: ${message}` : message;
    if (/unaudited_client_can_only_post_to_private_accounts/i.test(combined)) {
        return 'TikTok rejected this post because the app is unaudited. TikTok currently allows this app to post only to private or self-only accounts until the integration is audited. See https://developers.tiktok.com/doc/content-sharing-guidelines/.';
    }
    return combined;
}

function unwrapTikTokData<T>(payload: any, fallbackMessage: string): T {
    const errorCode = payload?.error?.code;
    if (errorCode && errorCode !== 'ok') {
        const errorMessage = payload?.error?.message || fallbackMessage;
        throw new Error(`${errorCode}: ${errorMessage}`);
    }

    if (!payload?.data) {
        throw new Error(fallbackMessage);
    }

    return payload.data as T;
}

function resolveMimeType(filePath: string, mimeType?: string, fileName?: string): string {
    if (mimeType?.startsWith('video/')) {
        return mimeType;
    }

    const extension = path.extname(fileName || filePath).toLowerCase();
    return VIDEO_MIME_TYPES[extension] || 'video/mp4';
}

function getExtensionFromSource(sourceUrl: string, mimeType?: string): string {
    try {
        const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase();
        if (extension) {
            return extension;
        }
    } catch {
        // Fall back to MIME type or default extension below.
    }

    return MIME_EXTENSIONS[mimeType || ''] || '.mp4';
}

async function cleanupFile(filePath: string | null): Promise<void> {
    if (!filePath) {
        return;
    }

    try {
        await fsPromises.unlink(filePath);
    } catch {
        // Best effort cleanup only.
    }
}

async function downloadRemoteVideo(videoUrl: string): Promise<{ filePath: string; mimeType?: string }> {
    let tempFilePath: string | null = null;

    try {
        const response = await axios.get(videoUrl, {
            responseType: 'stream',
            timeout: 120000,
            maxRedirects: 5,
        });

        const mimeType = typeof response.headers['content-type'] === 'string'
            ? response.headers['content-type'].split(';')[0].trim()
            : undefined;

        if (mimeType && !mimeType.startsWith('video/') && mimeType !== 'application/octet-stream') {
            console.error(`[TikTok] Download rejected: unexpected content-type "${mimeType}" from URL: ${videoUrl}`);
            throw new Error(`TikTok could not fetch a video file from the provided URL (received content-type: ${mimeType}). Ensure the URL points directly to a video file.`);
        }

        const extension = getExtensionFromSource(videoUrl, mimeType);
        tempFilePath = path.join(
            os.tmpdir(),
            `screndly-tiktok-${Date.now()}-${randomBytes(6).toString('hex')}${extension}`
        );

        await pipeline(response.data as NodeJS.ReadableStream, fs.createWriteStream(tempFilePath));
        return { filePath: tempFilePath, mimeType };
    } catch (error: any) {
        await cleanupFile(tempFilePath);
        if (error instanceof Error && error.message.includes('TikTok could not fetch a video file')) {
            throw error;
        }

        const statusCode = error?.response?.status;
        const statusText = error?.response?.statusText;
        const errorDetail = statusCode
            ? `HTTP ${statusCode} ${statusText || ''}`
            : (error?.code || error?.message || 'Unknown error');
        console.error(`[TikTok] Video download failed for URL: ${videoUrl} — ${errorDetail}`);

        throw new Error(`TikTok could not download the video (${errorDetail}). Verify the URL is publicly accessible and points to a downloadable video file.`);
    }
}

async function getUploadPlan(filePath: string): Promise<TikTokUploadPlan> {
    const { size } = await fsPromises.stat(filePath);

    if (!size) {
        throw new Error('TikTok video file is empty.');
    }

    if (size > MAX_TIKTOK_VIDEO_BYTES) {
        throw new Error('TikTok video exceeds the 4 GB upload limit.');
    }

    if (size <= MAX_SINGLE_CHUNK_BYTES) {
        return {
            fileSize: size,
            chunkSize: size,
            totalChunkCount: 1,
        };
    }

    return {
        fileSize: size,
        chunkSize: DEFAULT_CHUNK_BYTES,
        totalChunkCount: Math.floor(size / DEFAULT_CHUNK_BYTES),
    };
}

async function getCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo | null> {
    try {
        const response = await axios.post(
            `${TIKTOK_API_BASE}/post/publish/creator_info/query/`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        return unwrapTikTokData<TikTokCreatorInfo>(response.data, 'TikTok creator info is unavailable.');
    } catch (error) {
        console.warn('[TikTok] Creator info query failed:', extractTikTokErrorMessage(error));
        return null;
    }
}

function pickPrivacyLevel(options?: string[]): TikTokPrivacyLevel {
    const normalizedOptions = Array.isArray(options)
        ? options.filter((option): option is TikTokPrivacyLevel => typeof option === 'string')
        : [];

    const preferredOrder: TikTokPrivacyLevel[] = [
        'PUBLIC_TO_EVERYONE',
        'MUTUAL_FOLLOW_FRIENDS',
        'FOLLOWER_OF_CREATOR',
        'SELF_ONLY',
    ];

    return preferredOrder.find((option) => normalizedOptions.includes(option))
        || normalizedOptions[0]
        || 'SELF_ONLY';
}

function buildPostInfo(
    title: string,
    creatorInfo: TikTokCreatorInfo | null,
    privacyLevelOverride?: TikTokPrivacyLevel
) {
    return {
        title,
        privacy_level: privacyLevelOverride || pickPrivacyLevel(creatorInfo?.privacy_level_options),
        disable_duet: !!creatorInfo?.duet_disabled,
        disable_comment: !!creatorInfo?.comment_disabled,
        disable_stitch: !!creatorInfo?.stitch_disabled,
        video_cover_timestamp_ms: 1000,
    };
}

async function initializeFileUpload(
    filePath: string,
    fileName: string | undefined,
    mimeType: string | undefined,
    title: string,
    accessToken: string,
    creatorInfo: TikTokCreatorInfo | null,
    privacyLevelOverride?: TikTokPrivacyLevel
): Promise<TikTokUploadInit> {
    const uploadPlan = await getUploadPlan(filePath);
    const effectiveMimeType = resolveMimeType(filePath, mimeType, fileName);

    const response = await axios.post(
        `${TIKTOK_API_BASE}/post/publish/video/init/`,
        {
            post_info: buildPostInfo(title, creatorInfo, privacyLevelOverride),
            source_info: {
                source: 'FILE_UPLOAD',
                video_size: uploadPlan.fileSize,
                chunk_size: uploadPlan.chunkSize,
                total_chunk_count: uploadPlan.totalChunkCount,
                video_type: effectiveMimeType,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            maxBodyLength: Infinity,
        }
    );

    return unwrapTikTokData<TikTokUploadInit>(response.data, 'TikTok did not return an upload URL.');
}

async function uploadVideoChunks(
    uploadUrl: string,
    filePath: string,
    fileName: string | undefined,
    mimeType: string | undefined
): Promise<void> {
    const uploadPlan = await getUploadPlan(filePath);
    const effectiveMimeType = resolveMimeType(filePath, mimeType, fileName);
    const fileHandle = await fsPromises.open(filePath, 'r');

    try {
        for (let chunkIndex = 0; chunkIndex < uploadPlan.totalChunkCount; chunkIndex += 1) {
            const chunkStart = chunkIndex * uploadPlan.chunkSize;
            const isLastChunk = chunkIndex === uploadPlan.totalChunkCount - 1;
            const chunkEndExclusive = isLastChunk
                ? uploadPlan.fileSize
                : chunkStart + uploadPlan.chunkSize;
            const chunkLength = chunkEndExclusive - chunkStart;
            const buffer = Buffer.allocUnsafe(chunkLength);
            const { bytesRead } = await fileHandle.read(buffer, 0, chunkLength, chunkStart);

            if (bytesRead !== chunkLength) {
                throw new Error('TikTok upload failed while reading the local video file.');
            }

            await axios.put(uploadUrl, buffer.subarray(0, bytesRead), {
                headers: {
                    'Content-Type': effectiveMimeType,
                    'Content-Length': String(bytesRead),
                    'Content-Range': `bytes ${chunkStart}-${chunkStart + bytesRead - 1}/${uploadPlan.fileSize}`,
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                validateStatus: (status) => status === 200 || status === 201 || status === 204 || status === 206,
            });
        }
    } finally {
        await fileHandle.close();
    }
}

function normalizeVideoSource(source: string | TikTokVideoSource): TikTokVideoSource {
    if (typeof source !== 'string') {
        return source;
    }

    if (/^https?:\/\//i.test(source)) {
        return { videoUrl: source };
    }

    return { filePath: source };
}

export const tiktokService = {
    /**
     * Post a video to TikTok using FILE_UPLOAD. When a remote URL is provided,
     * Screndly downloads it first and then uploads the video to TikTok so the
     * flow does not depend on TikTok URL ownership verification.
     */
    async postVideo(source: string | TikTokVideoSource, title: string, accessToken: string) {
        const normalizedSource = normalizeVideoSource(source);
        let temporaryFilePath: string | null = null;

        try {
            const creatorInfo = await getCreatorInfo(accessToken);
            let filePath = normalizedSource.filePath;
            let mimeType = normalizedSource.mimeType;

            if (!filePath && normalizedSource.videoUrl) {
                const downloadedVideo = await downloadRemoteVideo(normalizedSource.videoUrl);
                filePath = downloadedVideo.filePath;
                mimeType = downloadedVideo.mimeType;
                temporaryFilePath = downloadedVideo.filePath;
            }

            if (!filePath) {
                throw new Error('TikTok requires a video file or a downloadable video URL.');
            }

            const validation = await validateVideoForTikTok(
                filePath,
                Math.max(30, Number(creatorInfo?.max_video_post_duration_sec || 180))
            );
            if (!validation.ok) {
                throw new Error(validation.issues.join(' '));
            }

            let uploadInit: TikTokUploadInit;
            try {
                uploadInit = await initializeFileUpload(
                    filePath,
                    normalizedSource.fileName,
                    mimeType,
                    title,
                    accessToken,
                    creatorInfo
                );
            } catch (error) {
                const message = extractTikTokErrorMessage(error);
                if (!/unaudited.*private|self-only/i.test(message)) {
                    throw error;
                }

                uploadInit = await initializeFileUpload(
                    filePath,
                    normalizedSource.fileName,
                    mimeType,
                    title,
                    accessToken,
                    creatorInfo,
                    'SELF_ONLY'
                );
            }

            await uploadVideoChunks(uploadInit.upload_url, filePath, normalizedSource.fileName, mimeType);

            return {
                success: true,
                data: {
                    id: uploadInit.publish_id,
                    platform: 'TikTok',
                    status: 'processing',
                },
            };
        } catch (error: any) {
            console.error('[TikTok] Post Error:', error?.response?.data || error.message);
            return {
                success: false,
                error: extractTikTokErrorMessage(error),
            };
        } finally {
            await cleanupFile(temporaryFilePath);
        }
    },

    /**
     * Get User Info
     */
    async getUserInfo(accessToken: string) {
        try {
            const response = await axios.get(
                `${TIKTOK_API_BASE}/user/info/`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    params: {
                        fields: 'open_id,union_id,avatar_url,avatar_url_100,avatar_large_url,display_name,username,profile_deep_link',
                    },
                }
            );

            return response.data?.data?.user || response.data?.data || null;
        } catch (error) {
            console.error('[TikTok] User Info Error:', error);
            return null;
        }
    },
};
