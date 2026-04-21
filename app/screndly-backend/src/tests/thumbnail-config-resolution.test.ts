import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveThumbnailConfigForPlatform } from '../services/video-enrichment.service';

test('resolves branded style from canonical logoDisplayMode', () => {
    const config = resolveThumbnailConfigForPlatform('youtube', {
        logoDisplayMode: 'branded',
        maxLogoSize: 48,
    });

    assert.equal(config.platform, 'youtube');
    assert.equal(config.logoDisplayMode, 'branded');
    assert.equal(config.maxLogoSize, 48);
});

test('resolves branded style from legacy thumbnailStyle field', () => {
    const config = resolveThumbnailConfigForPlatform('youtube', {
        thumbnailStyle: 'branded_logo',
    });

    assert.equal(config.logoDisplayMode, 'branded');
});

test('resolves boxed style from style alias field', () => {
    const config = resolveThumbnailConfigForPlatform('youtube', {
        style: 'boxed',
    });

    assert.equal(config.logoDisplayMode, 'boxed');
});

test('falls back to deterministic defaults when persisted config is missing', () => {
    const config = resolveThumbnailConfigForPlatform('youtube', undefined);

    assert.equal(config.platform, 'youtube');
    assert.equal(config.logoDisplayMode, 'boxed');
    assert.equal(config.logoPosition, 'bottom-right');
});

test('parses double-encoded json payload and keeps branded mode', () => {
    const encoded = JSON.stringify(JSON.stringify({
        logoDisplayMode: 'branded',
        brandedOverlayAppearanceMode: 'fixed',
        brandedOverlayFixedVariant: 'black',
    }));

    const config = resolveThumbnailConfigForPlatform('youtube', encoded);

    assert.equal(config.logoDisplayMode, 'branded');
    assert.equal(config.brandedOverlayAppearanceMode, 'fixed');
    assert.equal(config.brandedOverlayFixedVariant, 'black');
});

test('normalizes invalid style values to default boxed mode', () => {
    const config = resolveThumbnailConfigForPlatform('youtube', {
        logoDisplayMode: 'unknown-style',
    });

    assert.equal(config.logoDisplayMode, 'boxed');
});

