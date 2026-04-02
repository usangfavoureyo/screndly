import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { serverPhotopeaRenderer } from '../app/screndly-backend/src/services/server-photopea-renderer';

const psdPath = String.raw`C:\Users\Favour\Desktop\Screen Render\[Designs] Screen Render\Photoshop\Screen Render News\PSD\[Bottom Center] Screen Render Movie News [1080x1350].psd`;
const outputPath = String.raw`C:\Users\Favour\Desktop\Projects\screndly\tmp\design-studio-render-test.jpg`;

const psdBytes = fs.readFileSync(psdPath);
const server = http.createServer((req, res) => {
  if (req.url === '/template.psd') {
    res.writeHead(200, {
      'Content-Type': 'application/vnd.adobe.photoshop',
      'Content-Length': psdBytes.length,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(psdBytes);
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(43123, '127.0.0.1', async () => {
  try {
    const buffer = await serverPhotopeaRenderer.renderTemplate({
      psdUrl: 'http://127.0.0.1:43123/template.psd',
      headerText: 'NETFLIX RENEWS SCREEN RENDER FOR SEASON 2',
      width: 1080,
      height: 1350,
      hasSubtext: false,
      overlayDirection: 'bottom',
      overlayStrength: 70,
      headerTextColor: '#FFFFFF',
    });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    console.log(JSON.stringify({ ok: true, outputPath, size: buffer.length }));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : '' }, null, 2));
    process.exitCode = 1;
  } finally {
    server.close();
    await serverPhotopeaRenderer.destroy();
  }
});
