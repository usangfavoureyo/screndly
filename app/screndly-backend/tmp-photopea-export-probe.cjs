const { chromium } = require('playwright-core');
const fs = require('fs');
const http = require('http');
function resolveBrowserExecutable() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ];
  return candidates.find((p) => fs.existsSync(p));
}
const html = `<!doctype html><html><body><iframe id="pp" src="https://www.photopea.com/#" style="width:800px;height:600px"></iframe><script>
const iframe = document.getElementById('pp');
window.addEventListener('message', (e) => {
  const data = e.data;
  let desc = '';
  if (data === 'done') desc = 'done';
  else if (data instanceof ArrayBuffer) desc = 'arraybuffer:'+data.byteLength;
  else if (data && data.constructor && data.constructor.name) desc = data.constructor.name;
  else desc = typeof data + ':' + JSON.stringify(data);
  console.log('outer message', desc);
});
iframe.addEventListener('load', () => console.log('iframe load fired'));
</script></body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, {'Content-Type':'text/html'}); res.end(html); });
server.listen(43126, '127.0.0.1', async () => {
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(), headless: true, args: ['--disable-gpu','--disable-dev-shm-usage','--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('console:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('pageerror:', err.message));
  await page.goto('http://127.0.0.1:43126', { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(15000);
  await page.evaluate(() => {
    const iframe = document.getElementById('pp');
    iframe.contentWindow.postMessage('app.newDocument(100,100);', '*');
  });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const iframe = document.getElementById('pp');
    iframe.contentWindow.postMessage('app.activeDocument.saveToOE("png");', '*');
  });
  await page.waitForTimeout(15000);
  await browser.close();
  server.close();
});
