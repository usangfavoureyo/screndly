import fs from 'fs';
import http, { type Server } from 'http';
import { chromium, type Browser, type Page } from 'playwright-core';
import sharp from 'sharp';

interface RenderTemplateInput {
  psdUrl: string;
  headerText: string;
  subtext?: string;
  backgroundBytes?: Buffer;
  backgroundFileName?: string;
  width: number;
  height: number;
  hasSubtext: boolean;
  overlayDirection?: 'top' | 'bottom' | 'left' | 'right';
  overlayStrength?: number;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  zoomLevel?: number;
  headerTextColor?: string;
  subtextColor?: string;
}

interface PhotopeaBridgePage extends Page {
  __photopeaBridgeInitialized?: boolean;
}

function resolveBrowserExecutable(): string | null {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.EDGE_EXECUTABLE_PATH,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function hexToRgb(hex: string) {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

function generateFindLayerScript(namePatterns: string[]): string {
  return `
function findLayerByPattern(patterns) {
  var doc = app.activeDocument;
  function searchLayers(layers) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var layerNameLower = layer.name.toLowerCase();
      for (var j = 0; j < patterns.length; j++) {
        if (layerNameLower.indexOf(patterns[j].toLowerCase()) !== -1) {
          return layer;
        }
      }
      if (layer.typename === "LayerSet") {
        var found = searchLayers(layer.layers);
        if (found) return found;
      }
    }
    return null;
  }
  return searchLayers(doc.layers);
}
var targetLayer = findLayerByPattern(${JSON.stringify(namePatterns)});
`;
}

function generateTextUpdateScript(layerNamePatterns: string[], newText: string, color?: string): string {
  const rgb = color ? hexToRgb(color) : null;
  return `
${generateFindLayerScript(layerNamePatterns)}
if (targetLayer && targetLayer.kind === LayerKind.TEXT) {
  targetLayer.textItem.contents = ${JSON.stringify(newText)};
  ${rgb ? `
  var textColor = new SolidColor();
  textColor.rgb.red = ${rgb.r};
  textColor.rgb.green = ${rgb.g};
  textColor.rgb.blue = ${rgb.b};
  targetLayer.textItem.color = textColor;
  ` : ''}
}
`;
}

function generateGradientUpdateScript(
  enabled: boolean,
  color: string,
  opacity: number,
  position: 'top' | 'bottom' | 'left' | 'right',
): string {
  const rgb = hexToRgb(color);
  return `
function findOverlayVariants() {
  var doc = app.activeDocument;
  var overlays = { top: null, bottom: null, left: null, right: null, generic: null };
  function searchLayers(layers) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var nameLower = layer.name.toLowerCase();
      if (nameLower.match(/overlay.*top/)) overlays.top = layer;
      else if (nameLower.match(/overlay.*bottom/)) overlays.bottom = layer;
      else if (nameLower.match(/overlay.*left/)) overlays.left = layer;
      else if (nameLower.match(/overlay.*right/)) overlays.right = layer;
      else if (!overlays.generic && nameLower.match(/overlay|gradient/)) overlays.generic = layer;
      if (layer.typename === "LayerSet") searchLayers(layer.layers);
    }
  }
  searchLayers(doc.layers);
  return overlays;
}
var overlays = findOverlayVariants();
if (overlays.top) overlays.top.visible = false;
if (overlays.bottom) overlays.bottom.visible = false;
if (overlays.left) overlays.left.visible = false;
if (overlays.right) overlays.right.visible = false;
if (overlays.generic) overlays.generic.visible = false;
${enabled ? `
var activeOverlay = overlays["${position}"] || overlays.generic;
if (activeOverlay) {
  activeOverlay.visible = true;
  activeOverlay.opacity = ${opacity};
  try {
    if (activeOverlay.kind === LayerKind.SOLIDFILL) {
      var solidColor = new SolidColor();
      solidColor.rgb.red = ${rgb.r};
      solidColor.rgb.green = ${rgb.g};
      solidColor.rgb.blue = ${rgb.b};
      activeOverlay.fillColor = solidColor;
    }
  } catch (e) {}
}
` : ''}
`;
}

function generateBackgroundReplaceScript(
  imageBytes: Buffer,
  imageFileName: string,
  width: number,
  height: number,
  focalX: number,
  focalY: number,
  zoomLevel: number,
): string {
  const byteArrayLiteral = `[${Array.from(imageBytes.values()).join(',')}]`;
  return `
${generateFindLayerScript(['background', 'image', 'photo', 'artwork', 'bg'])}
try {
  var originalDoc = app.activeDocument;
  var layerName = targetLayer ? targetLayer.name : "background";
  var arr = ${byteArrayLiteral};
  var imageFile = new File(arr, ${JSON.stringify(imageFileName)});
  app.open(imageFile);
  var imageDoc = app.activeDocument;
  imageDoc.selection.selectAll();
  imageDoc.selection.copy();
  imageDoc.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = originalDoc;
  if (targetLayer) {
    originalDoc.activeLayer = targetLayer;
    targetLayer.remove();
  }
  originalDoc.paste();
  var pastedLayer = originalDoc.activeLayer;
  pastedLayer.name = layerName;
  var bounds = pastedLayer.bounds;
  var currentWidth = bounds[2].value - bounds[0].value;
  var currentHeight = bounds[3].value - bounds[1].value;
  var scale = Math.max(${width} / currentWidth, ${height} / currentHeight) * ${zoomLevel};
  pastedLayer.resize(scale * 100, scale * 100, AnchorPosition.MIDDLECENTER);
  var scaledBounds = pastedLayer.bounds;
  var scaledWidth = scaledBounds[2].value - scaledBounds[0].value;
  var scaledHeight = scaledBounds[3].value - scaledBounds[1].value;
  var translateX = (${width} / 2) - ((scaledWidth * ${focalX}) / 100) - scaledBounds[0].value;
  var translateY = (${height} / 2) - ((scaledHeight * ${focalY}) / 100) - scaledBounds[1].value;
  pastedLayer.translate(translateX, translateY);
} catch (e) {}
`;
}

function generateRenderScript(input: RenderTemplateInput): string {
  const scripts: string[] = [];
  if (input.headerText) {
    scripts.push(generateTextUpdateScript(['header', 'title', 'headline', 'main'], input.headerText, input.headerTextColor));
  }
  if (input.hasSubtext && input.subtext) {
    scripts.push(generateTextUpdateScript(['subtext', 'subtitle', 'description', 'caption', 'body'], input.subtext, input.subtextColor));
  }
  if (input.backgroundBytes && input.backgroundFileName) {
    scripts.push(
      generateBackgroundReplaceScript(
        input.backgroundBytes,
        input.backgroundFileName,
        input.width,
        input.height,
        input.backgroundOffsetX ?? 50,
        input.backgroundOffsetY ?? 50,
        input.zoomLevel ?? 1,
      ),
    );
  }
  scripts.push(
    generateGradientUpdateScript(
      true,
      '#000000',
      input.overlayStrength ?? 75,
      input.overlayDirection ?? 'top',
    ),
  );
  return scripts.join('\n\n');
}

function normalizePhotopeaPayload(data: unknown): string | null {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('base64');
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('base64');
  }

  return null;
}

class ServerPhotopeaRenderer {
  private browser: Browser | null = null;
  private page: PhotopeaBridgePage | null = null;
  private bridgeServer: Server | null = null;
  private bridgeUrl: string | null = null;

  private async ensureBridgeServer(): Promise<string> {
    if (this.bridgeServer && this.bridgeUrl) {
      return this.bridgeUrl;
    }

    const html = `<!doctype html>
      <html>
        <body style="margin:0;background:#111;">
          <iframe id="photopea" src="https://www.photopea.com/#" style="width:1600px;height:1900px;border:0;display:block;"></iframe>
          <script>
            (function () {
              const iframe = document.getElementById('photopea');
              window.photopeaBridge = {
                ready: new Promise((resolve, reject) => {
                  const timeout = setTimeout(() => reject(new Error('Photopea load timed out')), 30000);
                  function onMessage(event) {
                    if (event.source !== iframe.contentWindow) return;
                    if (event.data === 'done') {
                      clearTimeout(timeout);
                      window.removeEventListener('message', onMessage);
                      resolve();
                    }
                  }
                  window.addEventListener('message', onMessage);
                }),
                run: async function (script) {
                  await this.ready;
                  return await new Promise((resolve, reject) => {
                    let payload = null;
                    const timeout = setTimeout(() => {
                      window.removeEventListener('message', onMessage);
                      reject(new Error('Photopea script timed out'));
                    }, 120000);
                    function onMessage(event) {
                      if (event.source !== iframe.contentWindow) return;
                      const message = event.data;
                      if (message === 'done') {
                        clearTimeout(timeout);
                        window.removeEventListener('message', onMessage);
                        resolve(payload);
                      } else if (message && typeof message === 'object' && message.error) {
                        clearTimeout(timeout);
                        window.removeEventListener('message', onMessage);
                        reject(new Error(message.error));
                      } else if (message !== undefined && message !== null) {
                        payload = message;
                      }
                    }
                    window.addEventListener('message', onMessage);
                    iframe.contentWindow.postMessage(script, '*');
                  });
                },
              };
            })();
          </script>
        </body>
      </html>`;

    await new Promise<void>((resolve, reject) => {
      const server = http.createServer((_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(html);
      });
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Failed to determine Photopea bridge server address.'));
          return;
        }
        this.bridgeServer = server;
        this.bridgeUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    return this.bridgeUrl!;
  }

  private async ensureBridge(): Promise<PhotopeaBridgePage> {
    if (this.page && !this.page.isClosed() && this.page.__photopeaBridgeInitialized) {
      return this.page;
    }

    if (!this.browser) {
      const executablePath = resolveBrowserExecutable();
      if (!executablePath) {
        throw new Error('No Chromium/Edge executable found for backend Photopea rendering.');
      }
      this.browser = await chromium.launch({
        executablePath,
        headless: true,
        args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
      });
    }

    const page = await this.browser.newPage() as PhotopeaBridgePage;
    await page.setViewportSize({ width: 1650, height: 1950 });
    const bridgeUrl = await this.ensureBridgeServer();
    await page.goto(bridgeUrl, { waitUntil: 'load', timeout: 35000 });
    await page.waitForFunction('Boolean(window.photopeaBridge)', { timeout: 35000 });
    page.__photopeaBridgeInitialized = true;
    this.page = page;
    return page;
  }

  private async runPayload(payload: string | ArrayBuffer): Promise<string | null> {
    const page = await this.ensureBridge();
    const result = await page.evaluate(async (value) => {
      return (globalThis as any).photopeaBridge.run(value);
    }, payload);
    return normalizePhotopeaPayload(result);
  }

  private async runBinaryBuffer(buffer: Buffer): Promise<string | null> {
    const page = await this.ensureBridge();
    const base64 = buffer.toString('base64');
    const result = await page.evaluate(async (encoded) => {
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return (globalThis as any).photopeaBridge.run(bytes.buffer);
    }, base64);
    return normalizePhotopeaPayload(result);
  }

  private async execute(script: string): Promise<string | null> {
    return this.runPayload(script);
  }

  private async loadPsdFromUrl(psdUrl: string): Promise<void> {
    const response = await fetch(psdUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PSD: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await this.runBinaryBuffer(buffer);
  }

  private async exportImageBase64(format: 'jpg' | 'png'): Promise<string> {
    const result = await this.execute(`
      app.activeDocument.saveToOE(${JSON.stringify(format)});
    `);
    if (!result) {
      throw new Error(`Failed to export Photopea render as ${format.toUpperCase()}`);
    }
    return result;
  }

  private async captureCanvasRenderBuffer(): Promise<Buffer> {
    const page = await this.ensureBridge();
    const frame = page.frames().find((item) => item.url().startsWith('https://www.photopea.com'));
    if (!frame) {
      throw new Error('Photopea frame was not available for canvas capture.');
    }

    await frame.waitForFunction(
      () => {
        const doc = (globalThis as { document?: { querySelectorAll: (selector: string) => { length: number } } }).document;
        return doc ? doc.querySelectorAll('canvas').length > 0 : false;
      },
      undefined,
      { timeout: 90000 },
    );
    const largestCanvasIndex = await frame.evaluate(() => {
      const doc = (globalThis as { document?: { querySelectorAll: (selector: string) => unknown[] } }).document;
      const canvases = Array.from((doc?.querySelectorAll('canvas') ?? []) as ArrayLike<{
        getBoundingClientRect: () => { width: number; height: number };
      }>);
      let bestIndex = -1;
      let bestArea = 0;

      canvases.forEach((canvas, index) => {
        const rect = canvas.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (rect.width > 100 && rect.height > 100 && area > bestArea) {
          bestArea = area;
          bestIndex = index;
        }
      });

      return bestIndex;
    });

    if (largestCanvasIndex < 0) {
      throw new Error('No renderable Photopea canvas was found.');
    }

    const pngBuffer = await frame.locator('canvas').nth(largestCanvasIndex).screenshot({
      animations: 'disabled',
      type: 'png',
    });

    return sharp(pngBuffer).jpeg({ quality: 95 }).toBuffer();
  }

  private async closeDocument(): Promise<void> {
    try {
      await this.execute(`
        if (app.documents.length > 0) {
          app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
        }
      `);
    } catch {
      // ignore close errors
    }
  }

  async renderTemplate(input: RenderTemplateInput): Promise<Buffer> {
    await this.loadPsdFromUrl(input.psdUrl);

    try {
      await this.execute(generateRenderScript(input));
      try {
        const base64 = await this.exportImageBase64('jpg');
        return Buffer.from(base64, 'base64');
      } catch {
        try {
          const pngBase64 = await this.exportImageBase64('png');
          const pngBuffer = Buffer.from(pngBase64, 'base64');
          return sharp(pngBuffer).jpeg({ quality: 95 }).toBuffer();
        } catch {
          return this.captureCanvasRenderBuffer();
        }
      }
    } finally {
      await this.closeDocument();
    }
  }

  async destroy(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      await this.page.close().catch(() => undefined);
    }
    this.page = null;
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
    }
    this.browser = null;
    if (this.bridgeServer) {
      await new Promise<void>((resolve) => {
        this.bridgeServer?.close(() => resolve());
      });
    }
    this.bridgeServer = null;
    this.bridgeUrl = null;
  }
}

export const serverPhotopeaRenderer = new ServerPhotopeaRenderer();
