import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import prisma from '../lib/prisma';
import {
  renderDesignStudioImage,
  type DesignStudioTemplateRecord,
} from '../services/design-studio.service';
import {
  REFERENCE_CANVAS_HEIGHT,
  REFERENCE_CANVAS_WIDTH,
  REFERENCE_VARIANTS,
} from '../design-studio/reference-layouts';

function buildTemplate(): DesignStudioTemplateRecord {
  return {
    id: 'template-render-output-test',
    name: 'Render Output Test',
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

async function buildBackgroundDataUri() {
  const buffer = await sharp({
    create: {
      width: REFERENCE_CANVAS_WIDTH,
      height: REFERENCE_CANVAS_HEIGHT,
      channels: 3,
      background: { r: 16, g: 18, b: 22 },
    },
  })
    .png()
    .toBuffer();

  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function getRegionMetrics(image: Buffer) {
  const box = REFERENCE_VARIANTS.bottom_center.textBox;
  const extracted = sharp(image)
    .extract({
      left: box.x,
      top: box.y,
      width: box.width,
      height: box.height,
    })
    .removeAlpha();

  const [stats, { data, info }] = await Promise.all([
    extracted.clone().stats(),
    extracted.clone().raw().toBuffer({ resolveWithObject: true }),
  ]);

  let brightPixelCount = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    const average = (data[index] + data[index + 1] + data[index + 2]) / 3;
    if (average >= 230) {
      brightPixelCount += 1;
    }
  }

  return {
    max: Math.max(...stats.channels.slice(0, 3).map((channel) => channel.max)),
    mean: stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / 3,
    brightPixelCount,
  };
}

test('renderDesignStudioImage keeps headline visible in the final exported image', async () => {
  const originalFindMany = prisma.setting.findMany.bind(prisma.setting);
  prisma.setting.findMany = (async () => []) as typeof prisma.setting.findMany;

  try {
    const template = buildTemplate();
    const backgroundImage = await buildBackgroundDataUri();

    const withHeadline = await renderDesignStudioImage(template, {
      template_variant: 'bottom_center',
      headerText: 'VISIBLE HEADLINE',
      headerTextColor: '#ffffff',
      backgroundImage,
      overlayColor: '#000000',
      overlayOpacity: 70,
      gradientPosition: 'bottom',
      fadeEnabled: true,
      fadeOpacity: 90,
      exportFormat: 'png',
    });

    const withoutHeadline = await renderDesignStudioImage(template, {
      template_variant: 'bottom_center',
      headerText: '',
      headerTextColor: '#ffffff',
      backgroundImage,
      overlayColor: '#000000',
      overlayOpacity: 70,
      gradientPosition: 'bottom',
      fadeEnabled: true,
      fadeOpacity: 90,
      exportFormat: 'png',
    });

    const [withMetrics, withoutMetrics] = await Promise.all([
      getRegionMetrics(withHeadline.buffer),
      getRegionMetrics(withoutHeadline.buffer),
    ]);

    assert.equal(withHeadline.format, 'png');
    assert.ok(
      withMetrics.max >= 240,
      `expected bright headline pixels in final export, received max=${withMetrics.max}`,
    );
    assert.ok(
      withMetrics.brightPixelCount > withoutMetrics.brightPixelCount + 100,
      `expected rendered headline region to contain many more bright pixels than control export, received withBright=${withMetrics.brightPixelCount} withoutBright=${withoutMetrics.brightPixelCount}`,
    );
    assert.ok(
      withMetrics.mean > withoutMetrics.mean + 1.5,
      `expected rendered headline region to be brighter than control export, received withMean=${withMetrics.mean} withoutMean=${withoutMetrics.mean}`,
    );
  } finally {
    prisma.setting.findMany = originalFindMany;
  }
});
