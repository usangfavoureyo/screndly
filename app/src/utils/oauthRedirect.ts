function swapLocalhostForLoopback(origin: string): string {
    try {
        const url = new URL(origin);
        if (url.hostname === 'localhost') {
            url.hostname = '127.0.0.1';
        }
        return url.origin;
    } catch {
        return origin;
    }
}

export function getOAuthRedirectUri(platform?: string): string {
    if (typeof window === 'undefined') {
        return '';
    }

    const origin = platform === 'X'
        ? swapLocalhostForLoopback(window.location.origin)
        : window.location.origin;

    return `${origin}/platforms/callback`;
}
