'use strict';

const fs = require('fs');
const path = require('path');

const binaryDir = path.join(process.cwd(), 'bin');
const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = path.join(binaryDir, binaryName);
const releaseEndpoint = process.env.YOUTUBE_DL_HOST || 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';
const designStudioAssetSourceDir = path.join(process.cwd(), 'src', 'design-studio', 'assets');
const designStudioAssetDistDir = path.join(process.cwd(), 'dist', 'design-studio', 'assets');

async function fetchResponse(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'screndly-build',
            Accept: 'application/vnd.github+json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    return response;
}

async function resolveBinaryBuffer() {
    const response = await fetchResponse(releaseEndpoint);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
        return Buffer.from(await response.arrayBuffer());
    }

    const payload = await response.json();
    const assets = Array.isArray(payload?.assets) ? payload.assets : [];
    const match = assets.find((asset) => asset?.name === binaryName);
    if (!match?.browser_download_url) {
        throw new Error(`Unable to find ${binaryName} in yt-dlp release assets`);
    }

    const binaryResponse = await fetchResponse(match.browser_download_url);
    return Buffer.from(await binaryResponse.arrayBuffer());
}

async function main() {
    if (fs.existsSync(designStudioAssetSourceDir)) {
        fs.mkdirSync(designStudioAssetDistDir, { recursive: true });
        for (const entry of fs.readdirSync(designStudioAssetSourceDir)) {
            const sourcePath = path.join(designStudioAssetSourceDir, entry);
            const destinationPath = path.join(designStudioAssetDistDir, entry);
            if (fs.statSync(sourcePath).isFile()) {
                fs.copyFileSync(sourcePath, destinationPath);
            }
        }
    }

    if (process.env.YOUTUBE_DL_SKIP_DOWNLOAD) {
        return;
    }

    if (fs.existsSync(binaryPath) && fs.statSync(binaryPath).size > 0) {
        return;
    }

    fs.mkdirSync(binaryDir, { recursive: true });
    const buffer = await resolveBinaryBuffer();
    fs.writeFileSync(binaryPath, buffer, { mode: 0o755 });
    fs.chmodSync(binaryPath, 0o755);
}

main().catch((error) => {
    console.error('[prepare-build-artifacts] Failed to prepare yt-dlp binary:', error);
    process.exit(1);
});
