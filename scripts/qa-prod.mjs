import { chromium } from 'playwright';

const BASE = process.env.QA_URL || 'http://127.0.0.1:4173/';
const issues = [];
const warnings = [];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') issues.push(`console: ${msg.text()}`);
  if (msg.type() === 'warning') warnings.push(msg.text());
});
page.on('pageerror', (err) => issues.push(`pageerror: ${err.message}`));
page.on('requestfailed', (req) => issues.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`));
page.on('response', (res) => {
  if (res.status() >= 400) issues.push(`http ${res.status()}: ${res.url()}`);
});
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const heading = await page.locator('#game-title').textContent();
  await page.getByRole('button', { name: /PLAY CAMPAIGN/i }).first().click();
  await page.waitForSelector('canvas.game-canvas');
  await page.waitForFunction(() => document.querySelector('.hud-timer strong')?.textContent?.includes(':'), null, { timeout: 6000 });
  // Wait through the READY phase so the countdown is actually running.
  await page.waitForTimeout(2600);
  const timerBefore = await page.locator('.hud-timer strong').textContent();
  await page.waitForTimeout(1600);
  const timerAfter = await page.locator('.hud-timer strong').textContent();
  const levelTitle = await page.locator('.hud-title-line h2').textContent();
  const devHook = await page.evaluate(() => typeof window.__popboundEngine);
  await page.keyboard.down('Space');
  await page.waitForTimeout(700);
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.waitForSelector('.dialog');
  const pausedText = await page.locator('.dialog-title').textContent();
  await page.waitForTimeout(350);
  await page.screenshot({ path: '/tmp/popbound-shots/90-production-paused.png' });
  console.log(JSON.stringify({ heading, levelTitle, timerBefore, timerAfter, devHook, pausedText, issues, warnings }, null, 2));
  if (!heading?.includes('POPBOUND')) issues.push('TITLE_MISSING');
  if (!levelTitle?.includes('First Contact')) issues.push('LEVEL_HUD_MISSING');
  if (timerBefore === timerAfter) issues.push('TIMER_DID_NOT_TICK');
  if (devHook !== 'undefined') issues.push('DEV_ENGINE_HOOK_IN_PRODUCTION');
  if (pausedText?.trim() !== 'PAUSED') issues.push('PAUSE_OVERLAY_FAILED');
} catch (error) {
  issues.push(`script: ${error?.stack || error}`);
  console.error(error);
} finally {
  console.log('FINAL_ISSUES', JSON.stringify(issues, null, 2));
  await browser.close();
}
