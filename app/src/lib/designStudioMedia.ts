export function buildDesignStudioMediaStreamUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) {
    return url;
  }

  return `/api/design-studio/media-stream?url=${encodeURIComponent(url)}`;
}
