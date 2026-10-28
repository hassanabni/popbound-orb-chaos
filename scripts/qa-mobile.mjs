import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5173';
const SHOTS = '/tmp/popbound-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const issues = [];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function makePage(viewport) {
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') issues.push(`console ${viewport.width}x${viewport.height}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => issues.push(`pageerror ${viewport.width}x${viewport.height}: ${err.message}`));
  return { context, page };
}

try {
  // Landscape phone
  const landscape = await makePage({ width: 844, height: 390 });
  const page = landscape.page;
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/70-mobile-menu-landscape.png` });
  await page.getByRole('button', { name: /PLAY CAMPAIGN/i }).first().click();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PLAYING');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/71-mobile-game-landscape.png` });

  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const stage = document.querySelector('.stage');
    const hud = document.querySelector('.hud');
    const r = (el) => {
      const b = el?.getBoundingClientRect();
      return b ? { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } : null;
    };
    return {
      inner: { w: innerWidth, h: innerHeight },
      hud: r(hud),
      stage: r(stage),
      canvas: r(canvas),
      touchVisible: !!document.querySelector('.touch-controls.is-visible'),
      scrollWidth: document.documentElement.scrollWidth,
      bodyOverflow: getComputedStyle(document.body).overflow,
      controls: [...document.querySelectorAll('.touch-controls.is-visible .touch-btn')].map((el) => ({
        label: el.getAttribute('aria-label'),
        box: r(el),
      })),
    };
  });
  console.log('LANDSCAPE_LAYOUT', JSON.stringify(layout, null, 2));
  if (layout.scrollWidth > layout.inner.w + 1) issues.push('LANDSCAPE_HORIZONTAL_SCROLL');
  if (!layout.touchVisible) issues.push('LANDSCAPE_TOUCH_NOT_VISIBLE');
  for (const control of layout.controls) {
    if (!control.box) continue;
    const overlaps =
      control.box.x < layout.canvas.x + layout.canvas.w &&
      control.box.x + control.box.w > layout.canvas.x &&
      control.box.y < layout.canvas.y + layout.canvas.h &&
      control.box.y + control.box.h > layout.canvas.y;
    if (overlaps) issues.push(`TOUCH_CONTROL_OVERLAPS_CANVAS:${control.label}`);
  }

  const startX = await page.evaluate(() => window.__popboundEngine.players[0].x);
  const right = page.getByRole('button', { name: 'Move right' });
  await right.dispatchEvent('pointerdown', { pointerId: 11, pointerType: 'touch', isPrimary: true, bubbles: true });
  await page.waitForTimeout(450);
  const movingX = await page.evaluate(() => window.__popboundEngine.players[0].x);
  await right.dispatchEvent('pointerup', { pointerId: 11, pointerType: 'touch', isPrimary: true, bubbles: true });
  await page.waitForTimeout(300);
  const stoppedX = await page.evaluate(() => window.__popboundEngine.players[0].x);
  console.log('TOUCH_MOVE', { startX, movingX, stoppedX });
  if (!(movingX > startX + 10)) issues.push('TOUCH_MOVE_FAILED');

  const fire = page.getByRole('button', { name: 'Fire weapon' });
  await fire.dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch', isPrimary: true, bubbles: true });
  await page.waitForTimeout(400);
  const fireState = await page.evaluate(() => ({
    cooldown: window.__popboundEngine.players[0].cooldowns.pulse,
    effects: window.__popboundEngine.effects.length,
  }));
  await fire.dispatchEvent('pointerup', { pointerId: 12, pointerType: 'touch', isPrimary: true, bubbles: true });
  console.log('TOUCH_FIRE', fireState);
  if (fireState.cooldown <= 0) issues.push('TOUCH_FIRE_FAILED');

  const weaponBefore = await page.evaluate(() => window.__popboundEngine.players[0].weapon);
  await page.getByRole('button', { name: /Cycle weapon/i }).click();
  const weaponAfter = await page.evaluate(() => window.__popboundEngine.players[0].weapon);
  console.log('TOUCH_WEAPON_CYCLE', { weaponBefore, weaponAfter });
  if (weaponBefore === weaponAfter) issues.push('TOUCH_WEAPON_CYCLE_FAILED');

  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PAUSED');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/72-mobile-pause-landscape.png` });
  await page.getByRole('button', { name: /Resume/i }).click();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PLAYING');

  // Portrait phone
  const portrait = await makePage({ width: 390, height: 844 });
  const ppage = portrait.page;
  await ppage.goto(BASE, { waitUntil: 'networkidle' });
  await ppage.waitForTimeout(400);
  await ppage.screenshot({ path: `${SHOTS}/73-mobile-menu-portrait.png` });
  await ppage.getByRole('button', { name: /PLAY CAMPAIGN/i }).first().click();
  await ppage.waitForFunction(() => window.__popboundEngine?.state === 'PLAYING');
  await ppage.waitForTimeout(400);
  const portraitState = await ppage.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const hud = document.querySelector('.hud');
    const b = canvas?.getBoundingClientRect();
    const h = hud?.getBoundingClientRect();
    return {
      inner: { w: innerWidth, h: innerHeight },
      canvas: b ? { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } : null,
      hudBottom: h ? +(h.y + h.height).toFixed(1) : null,
      rotateHint: document.querySelector('.rotate-hint')?.textContent?.trim() ?? null,
      touchVisible: !!document.querySelector('.touch-controls.is-visible'),
    };
  });
  console.log('PORTRAIT_LAYOUT', JSON.stringify(portraitState, null, 2));
  if (!portraitState.rotateHint) issues.push('PORTRAIT_ROTATE_HINT_MISSING');
  await ppage.screenshot({ path: `${SHOTS}/74-mobile-portrait-game.png` });

  await ppage.getByRole('button', { name: 'Pause game' }).click();
  await ppage.waitForFunction(() => window.__popboundEngine?.state === 'PAUSED');
  await ppage.getByRole('button', { name: 'Settings' }).click();
  await ppage.waitForTimeout(300);
  await ppage.screenshot({ path: `${SHOTS}/75-mobile-settings.png` });
  await ppage.getByRole('button', { name: 'Go back' }).click();
  await ppage.waitForTimeout(200);

  console.log('ISSUES', JSON.stringify(issues, null, 2));
  fs.writeFileSync(`${SHOTS}/qa-mobile.json`, JSON.stringify({ issues, layout, fireState, portraitState }, null, 2));
} catch (error) {
  issues.push(`SCRIPT_ERROR: ${error?.stack || error}`);
  console.error('MOBILE QA ERROR', error);
  console.log('ISSUES', JSON.stringify(issues, null, 2));
} finally {
  await browser.close();
}
