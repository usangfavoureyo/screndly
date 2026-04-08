import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { __designStudioRenderTestUtils } from '../services/design-studio.service';

async function buildAsymmetricBackgroundDataUri() {
  const width = 1600;
  const height = 900;
  const stripeWidth = Math.round(width / 4);

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 18, g: 18, b: 18 },
    },
  })
    .composite([
      {
        input: {
          create: {
            width: stripeWidth,
            height,
            channels: 3,
            background: { r: 220, g: 32, b: 32 },
          },
        },
        left: 0,
        top: 0,
      },
      {
        input: {
          create: {
            width: stripeWidth,
            height,
            channels: 3,
            background: { r: 32, g: 180, b: 80 },
          },
        },
        left: stripeWidth,
        top: 0,
      },
      {
        input: {
          create: {
            width: stripeWidth,
            height,
            channels: 3,
            background: { r: 48, g: 96, b: 220 },
          },
        },
        left: stripeWidth * 2,
        top: 0,
      },
      {
        input: {
          create: {
            width: width - (stripeWidth * 3),
            height,
            channels: 3,
            background: { r: 240, g: 220, b: 90 },
          },
        },
        left: stripeWidth * 3,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  return `data:image/png;base64,${buffer.toString('base64')}`;
}

test('background focal point overrides variant anchor bias for rendered exports', async () => {
  const source = await buildAsymmetricBackgroundDataUri();
  const variants = ['top_left', 'top_right', 'bottom_left', 'bottom_right', 'bottom'] as const;

  const outputs = await Promise.all(
    variants.map((backgroundAnchor) =>
      __designStudioRenderTestUtils.buildBackgroundLayer({
        width: 1080,
        height: 1350,
        source,
        cropMode: 'cover',
        backgroundAnchor,
        focalPoint: { x: 82, y: 42 },
        zoom: 1,
      })),
  );

  const normalized = await Promise.all(outputs.map((buffer) => sharp(buffer).png().toBuffer()));
  const first = normalized[0];

  for (const [index, output] of normalized.entries()) {
    assert.deepEqual(
      output,
      first,
      `expected ${variants[index]} crop to match the same focal-point render`,
    );
  }
});
