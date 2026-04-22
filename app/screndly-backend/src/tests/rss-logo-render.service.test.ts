import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { getTMDbLogoCardDiagnosticsFromBuffer, trimTMDbLogoOuterBorderBuffer } from '../services/rss-logo-render.service';

test('trimTMDbLogoOuterBorderBuffer removes outer near-white logo padding conservatively', async () => {
    const logoCore = await sharp({
        create: {
            width: 220,
            height: 80,
            channels: 4,
            background: { r: 220, g: 20, b: 40, alpha: 1 },
        },
    }).png().toBuffer();

    const bordered = await sharp({
        create: {
            width: 320,
            height: 180,
            channels: 4,
            background: { r: 252, g: 250, b: 248, alpha: 1 },
        },
    })
        .composite([{ input: logoCore, left: 50, top: 50 }])
        .png()
        .toBuffer();

    const trimmed = await trimTMDbLogoOuterBorderBuffer(bordered);
    const metadata = await sharp(trimmed).metadata();

    assert.ok((metadata.width ?? 0) < 320);
    assert.ok((metadata.height ?? 0) < 180);
    assert.ok((metadata.width ?? 0) >= 220);
    assert.ok((metadata.height ?? 0) >= 80);
});

function getRelativeLuminance(channel: number): number {
    const normalized = channel / 255;
    return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function getColorLuminance(hex: string): number {
    const normalized = hex.replace('#', '');
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);

    return (
        (0.2126 * getRelativeLuminance(red)) +
        (0.7152 * getRelativeLuminance(green)) +
        (0.0722 * getRelativeLuminance(blue))
    );
}

test('getTMDbLogoCardDiagnosticsFromBuffer keeps light wide logos on a dark surface', async () => {
    const whiteLogo = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="260" viewBox="0 0 1400 260">
            <rect width="1400" height="260" fill="transparent" />
            <rect x="60" y="70" width="1280" height="120" rx="18" fill="#ffffff" />
        </svg>
    `);

    const pngBuffer = await sharp(whiteLogo).png().toBuffer();
    const diagnostics = await getTMDbLogoCardDiagnosticsFromBuffer(pngBuffer, 'logo');

    assert.equal(diagnostics.chosenCanvas, '16:9');
    assert.ok(getColorLuminance(diagnostics.background.startHex) < 0.25);
    assert.ok(getColorLuminance(diagnostics.background.endHex) < 0.4);
});

test('getTMDbLogoCardDiagnosticsFromBuffer scales very wide logos down for 16:9 cards', async () => {
    const wideLogo = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="240" viewBox="0 0 1800 240">
            <rect width="1800" height="240" fill="transparent" />
            <rect x="40" y="60" width="1720" height="120" rx="20" fill="#ffffff" />
        </svg>
    `);

    const pngBuffer = await sharp(wideLogo).png().toBuffer();
    const diagnostics = await getTMDbLogoCardDiagnosticsFromBuffer(pngBuffer, 'logo');

    assert.equal(diagnostics.chosenCanvas, '16:9');
    assert.ok(diagnostics.dimensions.maxWidth <= 820);
    assert.ok(diagnostics.dimensions.maxHeight <= 190);
});

test('getTMDbLogoCardDiagnosticsFromBuffer keeps square-card logo sizing comfortably inset', async () => {
    const mediumLogo = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="900" height="760" viewBox="0 0 900 760">
            <rect width="900" height="760" fill="transparent" />
            <rect x="200" y="235" width="500" height="290" rx="12" fill="#111111" />
        </svg>
    `);

    const pngBuffer = await sharp(mediumLogo).png().toBuffer();
    const diagnostics = await getTMDbLogoCardDiagnosticsFromBuffer(pngBuffer, 'logo');

    assert.equal(diagnostics.chosenCanvas, '1:1');
    assert.ok(diagnostics.dimensions.maxWidth <= 620);
    assert.ok(diagnostics.dimensions.maxHeight <= 300);
});
