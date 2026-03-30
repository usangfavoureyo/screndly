import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { trimTMDbLogoOuterBorderBuffer } from '../services/rss-logo-render.service';

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
