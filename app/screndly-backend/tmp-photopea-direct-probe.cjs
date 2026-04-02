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
  await page.goto('https://www.photopea.com', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(30000);
  const result = await page.evaluate(() => ({
    href: location.href,
    title: document.title,
    typeofApp: typeof window.app,
    keys: Object.keys(window).filter((k) => k.toLowerCase().includes('app')).slice(0, 20),
  }));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
