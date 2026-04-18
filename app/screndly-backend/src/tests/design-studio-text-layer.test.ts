import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  __designStudioRenderTestUtils,
  buildTextLayer,
  type DesignStudioTemplateRecord,
  type DesignStudioVariantRecord,
} from '../services/design-studio.service';

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

test('fitTextBlock balances headline lines without orphan middle words or tiny font sizes', () => {
  const fit = __designStudioRenderTestUtils.fitTextBlock({
    text: 'TEENAGE MUTANT NINJA TURTLES CLAIM A FAN-FAVORITE CALL OF DUTY MAP IN LATEST UPDATE',
    boxWidth: 500,
    boxHeight: 420,
    minFontSize: 56,
    maxFontSize: 88,
    maxLines: 5,
    lineHeightMultiplier: 0.93,
    tracking: 0,
  });

  const middleLines = fit.lines.slice(1, -1);
  assert.ok(fit.fontSize >= 40, `expected a readable editorial font size, received ${fit.fontSize}`);
  assert.ok(fit.lines.length > 0, 'expected at least one rendered headline line');
  assert.ok(fit.lines.length <= 5, `expected headline to fit within variant max lines, received ${fit.lines.length}`);
  assert.ok(
    fit.lines.length * fit.lineHeight <= 420,
    `expected headline to fit within text-box height, received lines=${fit.lines.length} lineHeight=${fit.lineHeight}`,
  );
  assert.ok(
    middleLines.every((line) => line.split(/\s+/).filter(Boolean).length >= 2),
    `expected no one-word middle lines, received ${fit.lines.join(' / ')}`,
  );
});

test('fitTextBlock constrains oversized template fonts so long headlines stay inside the text box', () => {
  const fit = __designStudioRenderTestUtils.fitTextBlock({
    text: 'DAVID HARBOUR JOINS JOHN RAMBO CAST AS NOAH CENTINEO MENTOR MAJOR TRAUTMAN',
    boxWidth: 560,
    boxHeight: 230,
    minFontSize: 120,
    maxFontSize: 180,
    maxLines: 4,
    lineHeightMultiplier: 1.05,
    tracking: 0,
  });

  assert.ok(fit.lines.length > 0, 'expected at least one rendered headline line');
  assert.ok(
    fit.lines.length * fit.lineHeight <= 230,
    `expected headline to fit within the text box, received lines=${fit.lines.length} lineHeight=${fit.lineHeight}`,
  );
  assert.ok(fit.fontSize < 120, `expected font size to shrink below template minimum when needed, received ${fit.fontSize}`);
});
