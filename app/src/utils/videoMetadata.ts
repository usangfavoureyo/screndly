export interface BrowserVideoMetadata {
  duration: number;
  width: number;
  height: number;
  aspectRatioValue: number;
  aspectRatioLabel: string;
  fileSize: number;
  format: string;
  codec: string | null;
  frameRate: number | null;
  bitrate: number | null;
}

function inferFormat(input: string | File | Blob): string {
  if (typeof input !== 'string') {
    const mime = input.type || '';
    if (mime.includes('/')) {
      return mime.split('/')[1].toUpperCase();
    }
    return 'UNKNOWN';
  }

  try {
    const pathname = new URL(input, window.location.origin).pathname;
    const ext = pathname.split('.').pop();
    return ext ? ext.toUpperCase() : 'UNKNOWN';
  } catch {
    const ext = input.split('.').pop();
    return ext ? ext.toUpperCase() : 'UNKNOWN';
  }
}

function formatAspectRatio(width: number, height: number): string {
  if (!width || !height) {
    return 'unknown';
  }

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

async function getRemoteFileSize(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    const parsed = Number(contentLength);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

async function loadVideoElement(input: string | File | Blob): Promise<{
  video: HTMLVideoElement;
  cleanup: () => void;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let objectUrl: string | null = null;
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    const handleLoaded = () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('error', handleError);
      resolve({ video, cleanup });
    };

    const handleError = () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('error', handleError);
      cleanup();
      reject(new Error('Failed to load video metadata in the browser'));
    };

    video.addEventListener('loadedmetadata', handleLoaded);
    video.addEventListener('error', handleError);

    if (typeof input === 'string') {
      video.src = input;
    } else {
      objectUrl = URL.createObjectURL(input);
      video.src = objectUrl;
    }
  });
}

export async function extractVideoMetadata(input: string | File | Blob): Promise<BrowserVideoMetadata> {
  const { video, cleanup } = await loadVideoElement(input);

  try {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    const aspectRatioValue = width > 0 && height > 0 ? width / height : 0;
    const fileSize = typeof input === 'string' ? await getRemoteFileSize(input) : input.size;
    const bitrate = duration > 0 && fileSize > 0 ? Math.round((fileSize * 8) / duration) : null;

    return {
      duration,
      width,
      height,
      aspectRatioValue,
      aspectRatioLabel: formatAspectRatio(width, height),
      fileSize,
      format: inferFormat(input),
      codec: null,
      frameRate: null,
      bitrate,
    };
  } finally {
    cleanup();
  }
}

export async function captureVideoFrame(
  input: string | File | Blob,
  timestampMs: number = 0
): Promise<string> {
  const { video, cleanup } = await loadVideoElement(input);

  try {
    const targetTime = Math.max(0, timestampMs / 1000);

    await new Promise<void>((resolve, reject) => {
      const handleSeeked = () => {
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = () => {
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('error', handleError);
        reject(new Error('Failed to seek video frame'));
      };

      video.addEventListener('seeked', handleSeeked, { once: true });
      video.addEventListener('error', handleError, { once: true });
      video.currentTime = Math.min(targetTime, Math.max(video.duration - 0.1, 0));
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is unavailable');
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    cleanup();
  }
}
