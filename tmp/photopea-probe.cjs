const { chromium } = require('C:/Users/Favour/Desktop/Projects/screndly/app/screndly-backend/node_modules/playwright-core');
const fs = require('node:fs');

function resolveBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.EDGE_EXECUTABLE_PATH,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

(async () => {
  const executablePath = resolveBrowserExecutable();
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.photopea.com', { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(8000);
  const appType = await page.evaluate(() => typeof app);
  console.log(JSON.stringify({ appType }, null, 2));
  await browser.close();
})().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
