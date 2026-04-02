const { chromium } = require('playwright-core');
const fs = require('fs');

function resolveBrowserExecutable() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ];
  return candidates.find((p) => fs.existsSync(p));
}

(async () => {
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(), headless: true, args: ['--disable-gpu','--disable-dev-shm-usage','--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('console:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('pageerror:', err.message));
  page.on('requestfailed', (req) => console.log('requestfailed:', req.url(), req.failure()?.errorText));
  page.on('response', (res) => { if (res.url().includes('photopea')) console.log('response:', res.status(), res.url()); });
  await page.setContent(`<!doctype html><html><body><iframe id="pp" src="https://www.photopea.com" style="width:800px;height:600px"></iframe><script>
window.addEventListener('message', (e) => {
  const data = e.data;
  console.log('outer message type', typeof data, data === 'done' ? 'done' : (data && data.byteLength ? 'arraybuffer:'+data.byteLength : JSON.stringify(data)));
});
</script></body></html>`, { waitUntil: 'load' });
  await page.waitForTimeout(40000);
  await browser.close();
})();
