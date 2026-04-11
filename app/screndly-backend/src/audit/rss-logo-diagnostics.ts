import sharp from 'sharp';
import { getTMDbLogoCardDiagnosticsFromBuffer } from '../services/rss-logo-render.service';

type SyntheticLogoCase = {
  name: string;
  fill: string;
  width: number;
  height: number;
};

const CASES: SyntheticLogoCase[] = [
  { name: 'white-wide', fill: '#FFFFFF', width: 1200, height: 260 },
  { name: 'black-wide', fill: '#111111', width: 1200, height: 260 },
  { name: 'netflix-red', fill: '#E50914', width: 1200, height: 300 },
  { name: 'prime-blue', fill: '#00A8E1', width: 1100, height: 300 },
  { name: 'yellow-wide', fill: '#F5C518', width: 1200, height: 280 },
  { name: 'gray-wide', fill: '#8E8E93', width: 1200, height: 280 },
  { name: 'square-magenta', fill: '#D81B60', width: 700, height: 700 },
];

function buildSyntheticLogoSvg({ fill, width, height }: SyntheticLogoCase): Buffer {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="transparent" />
      <rect
        x="${Math.round(width * 0.08)}"
        y="${Math.round(height * 0.22)}"
        width="${Math.round(width * 0.84)}"
        height="${Math.round(height * 0.56)}"
        rx="${Math.round(Math.min(width, height) * 0.08)}"
        fill="${fill}"
      />
    </svg>
  `;

  return Buffer.from(svg);
}

async function run(): Promise<void> {
  const rows: Array<Record<string, string | number>> = [];

  for (const entry of CASES) {
    const pngBuffer = await sharp(buildSyntheticLogoSvg(entry)).png().toBuffer();
    const diagnostics = await getTMDbLogoCardDiagnosticsFromBuffer(pngBuffer, 'logo');

    rows.push({
      case: entry.name,
      accent: diagnostics.accentHex,
      contrast: diagnostics.contrastRatio.toFixed(2),
      canvas: diagnostics.chosenCanvas,
      logoAspect: diagnostics.logoAspectRatio.toFixed(2),
      backgroundStart: diagnostics.background.startHex,
      backgroundEnd: diagnostics.background.endHex,
      size: `${diagnostics.dimensions.width}x${diagnostics.dimensions.height}`,
    });
  }

  console.table(rows);
}

void run().catch((error) => {
  console.error('[RSS][Logo Diagnostics] Failed to run diagnostics.', error);
  process.exitCode = 1;
});
