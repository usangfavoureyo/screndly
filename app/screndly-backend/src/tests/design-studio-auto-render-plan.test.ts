import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  __designStudioAutoTestUtils,
  type DesignStudioTemplateRecord,
} from '../services/design-studio.service';
import {
  REFERENCE_CANVAS_HEIGHT,
  REFERENCE_CANVAS_WIDTH,
  REFERENCE_VARIANTS,
} from '../design-studio/reference-layouts';

function buildTemplate(): DesignStudioTemplateRecord {
  return {
    id: 'template-auto-render-plan-test',
    name: 'Auto Render Plan Test',
    width: REFERENCE_CANVAS_WIDTH,
    height: REFERENCE_CANVAS_HEIGHT,
    aspectRatio: '4:5',
    source: 'upload',
    hasSubtext: false,
    hasHeader: true,
    hasBackground: true,
    hasOverlay: true,
    layoutVariant: 'bottom_center',
    baseVariant: 'bottom_center',
    fontFamily: 'PFDinTextCompPro',
    fontColor: '#ffffff',
    lineHeightMultiplier: 0.93,
    tracking: 0,
    safeMargin: REFERENCE_VARIANTS.bottom_center.safeMargin,
    variants: [REFERENCE_VARIANTS.bottom_center],
  };
}

async function buildRightSideNegativeSpaceDataUri() {
  const width = REFERENCE_CANVAS_WIDTH;
  const height = REFERENCE_CANVAS_HEIGHT;
  const leftWidth = Math.round(width * 0.54);

  const noisyLeft = await sharp({
    create: {
      width: leftWidth,
      height,
      channels: 3,
      background: { r: 38, g: 44, b: 72 },
    },
  })
    .composite([
      {
        input: {
          create: {
            width: Math.round(leftWidth * 0.38),
            height,
            channels: 3,
            background: { r: 228, g: 214, b: 118 },
          },
        },
        left: 0,
        top: 0,
      },
      {
        input: {
          create: {
            width: Math.round(leftWidth * 0.16),
            height,
            channels: 3,
            background: { r: 12, g: 16, b: 24 },
          },
        },
        left: Math.round(leftWidth * 0.24),
        top: 0,
      },
      {
        input: {
          create: {
            width: Math.round(leftWidth * 0.22),
            height: Math.round(height * 0.58),
            channels: 3,
            background: { r: 126, g: 88, b: 68 },
          },
        },
        left: Math.round(leftWidth * 0.58),
        top: Math.round(height * 0.16),
      },
    ])
    .png()
    .toBuffer();

  const rightWidth = width - leftWidth;
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([
      { input: noisyLeft, left: 0, top: 0 },
      {
        input: {
          create: {
            width: rightWidth,
            height,
            channels: 3,
            background: { r: 18, g: 28, b: 42 },
          },
        },
        left: leftWidth,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function buildBrightBackdropDataUri() {
  const buffer = await sharp({
    create: {
      width: REFERENCE_CANVAS_WIDTH,
      height: REFERENCE_CANVAS_HEIGHT,
      channels: 3,
      background: { r: 236, g: 238, b: 242 },
    },
  })
    .png()
    .toBuffer();

  return `data:image/png;base64,${buffer.toString('base64')}`;
}

test('auto render plan prefers right-side variants when the backdrop leaves usable negative space on the right', async () => {
  const plan = await __designStudioAutoTestUtils.resolveAutoEditorialRenderPlan({
    template: buildTemplate(),
    backgroundImage: await buildRightSideNegativeSpaceDataUri(),
    cropMode: 'cover',
  });

  assert.match(plan.variant, /_right$/, `expected a right-side variant, received ${plan.variant}`);
  assert.equal(plan.overlayDirection, 'right');
  assert.equal(plan.headerTextColor, '#FFFFFF');
  assert.equal(plan.brandBlockMode, 'white');
});

test('auto render plan chooses dark text and dark brand block on bright backdrops', async () => {
  const plan = await __designStudioAutoTestUtils.resolveAutoEditorialRenderPlan({
    template: buildTemplate(),
    backgroundImage: await buildBrightBackdropDataUri(),
    cropMode: 'cover',
  });

  assert.equal(plan.variant, 'bottom_center');
  assert.equal(plan.overlayDirection, 'bottom');
  assert.equal(plan.headerTextColor, '#000000');
  assert.equal(plan.brandBlockMode, 'black');
});
