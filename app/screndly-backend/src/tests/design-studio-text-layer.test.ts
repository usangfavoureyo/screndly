import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { buildTextLayer, type DesignStudioTemplateRecord, type DesignStudioVariantRecord } from '../services/design-studio.service';

test('buildTextLayer applies the requested header text color to rendered headline pixels', async () => {
  const variant: DesignStudioVariantRecord = {
    variant: 'bottom_center',
    textBox: { x: 40, y: 80, width: 560, height: 220 },
    alignment: 'center',
    brandBox: { x: 200, y: 300, width: 240, height: 72 },
    backgroundAnchor: 'top',
    overlayDirection: 'bottom',
    minFontSize: 42,
    maxFontSize: 88,
    maxLines: 4,
    lineHeightMultiplier: 1.05,
    safeMargin: 40,
  };

  const template: DesignStudioTemplateRecord = {
    id: 'template-test',
    name: 'Template Test',
    width: 640,
    height: 640,
    aspectRatio: '1:1',
    source: 'upload',
    hasSubtext: false,
    fontFamily: 'Arial',
    fontColor: '#ffffff',
    tracking: 0,
    lineHeightMultiplier: 1.05,
  };

  const textLayer = await buildTextLayer({
    width: 640,
    height: 640,
    variant,
    template,
    payload: {
      headerText: 'VISIBLE HEADLINE',
      headerTextColor: '#ffffff',
      fontScale: 1,
      lineHeightMultiplier: 1.05,
    },
  });

  const stats = await sharp(textLayer).stats();

  assert.ok(stats.channels[0]?.max !== undefined && stats.channels[0].max >= 240, 'expected bright red channel values');
  assert.ok(stats.channels[1]?.max !== undefined && stats.channels[1].max >= 240, 'expected bright green channel values');
  assert.ok(stats.channels[2]?.max !== undefined && stats.channels[2].max >= 240, 'expected bright blue channel values');
  assert.ok(stats.channels[3]?.max !== undefined && stats.channels[3].max > 0, 'expected visible non-transparent headline pixels');
});
