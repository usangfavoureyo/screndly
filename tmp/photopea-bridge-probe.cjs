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
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-gpu','--disable-dev-shm-usage','--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  page.on('close', () => console.log('PAGE: closed'));
  await page.setContent(`<!doctype html><html><body><iframe id="photopea" src="https://www.photopea.com" style="position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;"></iframe><script>(function(){const iframe=document.getElementById('photopea');window.photopeaBridge={ready:new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('timeout')),30000);iframe.addEventListener('load',()=>{setTimeout(()=>{clearTimeout(timeout);resolve();},5000)},{once:true});}),run:async function(script){await this.ready;return await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{window.removeEventListener('message',onMessage);reject(new Error('script timeout'));},30000);function onMessage(event){if(event.source!==iframe.contentWindow)return;const message=event.data||{};console.log('bridge message', JSON.stringify(message));if(message.done){clearTimeout(timeout);window.removeEventListener('message',onMessage);resolve(message.result||null);}else if(message.error){clearTimeout(timeout);window.removeEventListener('message',onMessage);reject(new Error(message.error));}}window.addEventListener('message',onMessage);iframe.contentWindow.postMessage(script,'*');});}};})();</script></body></html>`, {waitUntil:'load'});
  await page.waitForFunction('Boolean(window.photopeaBridge)', { timeout: 35000 });
  const result = await page.evaluate(async () => {
    return window.photopeaBridge.run('app.echoToOE("hello")');
  });
  console.log(JSON.stringify({ ok: true, result }, null, 2));
  await browser.close();
})().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
