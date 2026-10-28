import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const before = await page.evaluate(() => ({
  canFullscreen: typeof document.documentElement.requestFullscreen === 'function',
  enabled: document.fullscreenEnabled,
  active: !!document.fullscreenElement,
}));
await page.getByRole('button', { name: /fullscreen/i }).first().click();
await page.waitForTimeout(1000);
const after = await page.evaluate(() => ({
  active: !!document.fullscreenElement,
  w: innerWidth,
  h: innerHeight,
  toast: document.querySelector('.toast')?.textContent ?? null,
}));
if (await page.evaluate(() => !!document.fullscreenElement)) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}
const ended = await page.evaluate(() => !!document.fullscreenElement);
console.log(JSON.stringify({ before, after, ended, errors }, null, 2));
await browser.close();
