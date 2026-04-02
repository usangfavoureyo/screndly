import fs from 'fs';
import { chromium, type Browser, type Page } from 'playwright-core';

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
  var overlays = { top: null, bottom: null, left: null, right: null };
  function searchLayers(layers) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var nameLower = layer.name.toLowerCase();
      if (nameLower.match(/overlay.*top/)) overlays.top = layer;
      else if (nameLower.match(/overlay.*bottom/)) overlays.bottom = layer;
      else if (nameLower.match(/overlay.*left/)) overlays.left = layer;
      else if (nameLower.match(/overlay.*right/)) overlays.right = layer;
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
${enabled ? `
var activeOverlay = overlays["${position}"];
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

class ServerPhotopeaRenderer {
  private browser: Browser | null = null;
  private page: PhotopeaBridgePage | null = null;

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
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.setContent(`
      <!doctype html>
      <html>
        <body style="margin:0;background:#000;">
          <iframe id="photopea" src="https://www.photopea.com" style="position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;"></iframe>
          <script>
            (function () {
              const iframe = document.getElementById('photopea');
              window.photopeaBridge = {
                ready: new Promise((resolve, reject) => {
                  const timeout = setTimeout(() => reject(new Error('Photopea load timed out')), 30000);
                  iframe.addEventListener('load', () => {
                    setTimeout(() => {
                      clearTimeout(timeout);
                      resolve();
                    }, 3000);
                  }, { once: true });
                }),
                run: async function (script) {
                  await this.ready;
                  return await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                      window.removeEventListener('message', onMessage);
                      reject(new Error('Photopea script timed out'));
                    }, 120000);
                    function onMessage(event) {
                      if (event.source !== iframe.contentWindow) return;
                      const message = event.data || {};
                      if (message.done) {
                        clearTimeout(timeout);
                        window.removeEventListener('message', onMessage);
                        resolve(message.result || null);
                      } else if (message.error) {
                        clearTimeout(timeout);
                        window.removeEventListener('message', onMessage);
                        reject(new Error(message.error));
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
      </html>
    `, { waitUntil: 'load' });
    await page.waitForFunction('Boolean(window.photopeaBridge)', { timeout: 35000 });
    page.__photopeaBridgeInitialized = true;
    this.page = page;
    return page;
  }

  private async execute(script: string): Promise<string | null> {
    const page = await this.ensureBridge();
    return page.evaluate(async (payload) => {
      return (globalThis as any).photopeaBridge.run(payload);
    }, script);
  }

  private async loadPsdFromUrl(psdUrl: string): Promise<void> {
    const response = await fetch(psdUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PSD: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const byteArrayLiteral = `[${Array.from(buffer.values()).join(',')}]`;
    await this.execute(`
      var arr = ${byteArrayLiteral};
      var file = new File(arr, "template.psd");
      app.open(file);
    `);
  }

  private async exportJpegBase64(): Promise<string> {
    const result = await this.execute(`
      var jpegOptions = new JPEGSaveOptions();
      jpegOptions.quality = 12;
      jpegOptions.embedColorProfile = true;
      var tempFile = new File(Folder.temp + "/screndly-server-output.jpg");
      app.activeDocument.saveAs(tempFile, jpegOptions, true);
      tempFile.encoding = "BINARY";
      tempFile.open("r");
      var content = tempFile.read();
      tempFile.close();
      btoa(content);
    `);
    if (!result) {
      throw new Error('Failed to export Photopea render');
    }
    return result;
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
      const base64 = await this.exportJpegBase64();
      return Buffer.from(base64, 'base64');
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
  }
}

export const serverPhotopeaRenderer = new ServerPhotopeaRenderer();
