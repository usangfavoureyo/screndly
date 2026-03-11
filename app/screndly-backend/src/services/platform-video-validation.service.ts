import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface ProbedVideoStream {
    codec_name?: string;
    width?: number;
    height?: number;
    pix_fmt?: string;
    avg_frame_rate?: string;
}

interface ProbedAudioStream {
    codec_name?: string;
    sample_rate?: string;
    channels?: number;
}

interface ProbedContainerFormat {
    format_name?: string;
    duration?: string;
    size?: string;
}

export interface VideoValidationResult {
    ok: boolean;
    issues: string[];
    durationSec?: number;
    width?: number;
    height?: number;
    codec?: string;
    audioCodec?: string;
    fps?: number;
    unavailable?: boolean;
}

function parseFrameRate(value?: string): number | undefined {
    if (!value) {
        return undefined;
    }

    const [numeratorRaw, denominatorRaw] = value.split('/');
    const numerator = Number.parseFloat(numeratorRaw || '');
    const denominator = Number.parseFloat(denominatorRaw || '');
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
        const direct = Number.parseFloat(value);
        return Number.isFinite(direct) ? direct : undefined;
    }

    return numerator / denominator;
}

async function probeVideo(filePath: string): Promise<{
    video?: ProbedVideoStream;
    audio?: ProbedAudioStream;
    format?: ProbedContainerFormat;
}> {
    const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate,sample_rate,channels',
        '-show_entries',
        'format=format_name,duration,size',
        '-of',
        'json',
        filePath,
    ]);

    const parsed = JSON.parse(stdout) as {
        streams?: Array<Record<string, unknown> & { codec_type?: string }>;
        format?: ProbedContainerFormat;
    };

    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
    const video = streams.find((stream) => stream.codec_type === 'video') as ProbedVideoStream | undefined;
    const audio = streams.find((stream) => stream.codec_type === 'audio') as ProbedAudioStream | undefined;

    return {
        video,
        audio,
        format: parsed.format,
    };
}

function buildUnavailableResult(): VideoValidationResult {
    return {
        ok: true,
        issues: [],
        unavailable: true,
    };
}

export async function validateVideoForX(filePath: string): Promise<VideoValidationResult> {
    try {
        const probe = await probeVideo(filePath);
        const durationSec = Number.parseFloat(probe.format?.duration || '0') || undefined;
        const sizeBytes = Number.parseInt(probe.format?.size || '0', 10) || undefined;
        const width = Number(probe.video?.width || 0) || undefined;
        const height = Number(probe.video?.height || 0) || undefined;
        const fps = parseFrameRate(probe.video?.avg_frame_rate);
        const codec = probe.video?.codec_name;
        const audioCodec = probe.audio?.codec_name;
        const issues: string[] = [];

        if (sizeBytes && sizeBytes > 512 * 1024 * 1024) {
            issues.push('X videos must be 512 MB or smaller.');
        }

        if (durationSec && (durationSec < 0.5 || durationSec > 140)) {
            issues.push('X standard video uploads must be between 0.5 and 140 seconds.');
        }

        if (fps && fps > 40) {
            issues.push('X videos must be 40 FPS or lower.');
        }

        if (width && height) {
            const maxWidth = width >= height ? 1920 : 1200;
            const maxHeight = width >= height ? 1200 : 1900;
            if (width < 32 || height < 32) {
                issues.push('X videos must be at least 32x32.');
            }
            if (width > maxWidth || height > maxHeight) {
                issues.push('X videos exceed the supported maximum frame size.');
            }

            const aspectRatio = width / height;
            if (aspectRatio > 2.39 || aspectRatio < (1 / 2.39)) {
                issues.push('X videos must stay within the supported aspect-ratio range.');
            }
        }

        if (codec !== 'h264') {
            issues.push('X videos should use H.264 video.');
        }

        if (probe.video?.pix_fmt && probe.video.pix_fmt !== 'yuv420p') {
            issues.push('X videos should use yuv420p pixel format.');
        }

        if (audioCodec && audioCodec !== 'aac') {
            issues.push('X videos should use AAC audio.');
        }

        return {
            ok: issues.length === 0,
            issues,
            durationSec,
            width,
            height,
            codec,
            audioCodec,
            fps,
        };
    } catch {
        return buildUnavailableResult();
    }
}

export async function validateVideoForTikTok(
    filePath: string,
    maxDurationSec = 180
): Promise<VideoValidationResult> {
    try {
        const probe = await probeVideo(filePath);
        const durationSec = Number.parseFloat(probe.format?.duration || '0') || undefined;
        const sizeBytes = Number.parseInt(probe.format?.size || '0', 10) || undefined;
        const width = Number(probe.video?.width || 0) || undefined;
        const height = Number(probe.video?.height || 0) || undefined;
        const fps = parseFrameRate(probe.video?.avg_frame_rate);
        const codec = probe.video?.codec_name;
        const audioCodec = probe.audio?.codec_name;
        const formatNames = (probe.format?.format_name || '').split(',').map((value) => value.trim().toLowerCase());
        const issues: string[] = [];

        if (sizeBytes && sizeBytes > 4 * 1024 * 1024 * 1024) {
            issues.push('TikTok videos must be 4 GB or smaller.');
        }

        if (durationSec && durationSec > maxDurationSec) {
            issues.push(`TikTok creator settings currently allow videos up to ${maxDurationSec} seconds.`);
        }

        if (fps && (fps < 23 || fps > 60)) {
            issues.push('TikTok videos must be between 23 and 60 FPS.');
        }

        if (width && height) {
            if (width < 360 || height < 360) {
                issues.push('TikTok videos must be at least 360x360.');
            }
            if (width > 4096 || height > 4096) {
                issues.push('TikTok videos must not exceed 4096x4096.');
            }
        }

        if (!['h264', 'hevc', 'vp8', 'vp9'].includes((codec || '').toLowerCase())) {
            issues.push('TikTok videos must use H.264, H.265, VP8, or VP9.');
        }

        if (formatNames.length > 0 && !formatNames.some((value) => ['mov', 'mp4', 'matroska,webm', 'webm'].includes(value) || value.includes('mp4') || value.includes('mov') || value.includes('webm'))) {
            issues.push('TikTok videos must be MP4, MOV, or WebM.');
        }

        return {
            ok: issues.length === 0,
            issues,
            durationSec,
            width,
            height,
            codec,
            audioCodec,
            fps,
        };
    } catch {
        return buildUnavailableResult();
    }
}
