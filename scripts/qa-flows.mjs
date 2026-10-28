import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5173';
const SHOTS = '/tmp/popbound-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const SAVE_KEY = 'popbound.orbchaos.save.v1';
const issues = [];
const warnings = [];
const log = (...args) => console.log(...args);

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') issues.push(`console: ${msg.text()}`);
  if (msg.type() === 'warning') warnings.push(msg.text());
});
page.on('pageerror', (err) => issues.push(`pageerror: ${err.message}`));
page.on('response', (res) => {
  if (res.status() >= 400) issues.push(`http ${res.status()}: ${res.url()}`);
});

const sleep = (ms) => page.waitForTimeout(ms);
const gameState = () => page.evaluate(() => {
  const e = window.__popboundEngine;
  if (!e) return null;
  return {
    state: e.state,
    level: e.level.number,
    title: e.level.title,
    theme: e.level.theme,
    wave: e.wave,
    bubbles: e.bubbles.length,
    lives: e.players.map((p) => p.lives),
    scores: e.players.map((p) => p.score),
    time: e.time,
    weapon: e.players[0]?.weapon,
  };
});
const readSave = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), SAVE_KEY);
const back = async () => {
  await page.getByRole('button', { name: 'Go back' }).first().click();
  await page.waitForTimeout(220);
};
const waitMenu = async () => {
  await page.waitForSelector('.menu-screen');
  await page.waitForTimeout(250);
};
const forceClearCurrentLevel = async () => {
  await page.evaluate(() => {
    const e = window.__popboundEngine;
    if (e.state === 'READY') e.debugStart();
    e.debugClearBubbles();
    e.debugAdvance(0.04);
  });
};

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await sleep(500);
  await page.screenshot({ path: `${SHOTS}/40-menu.png` });
  log('TITLE', await page.title());

  // Utility screens
  await page.getByRole('button', { name: /How to Play/i }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/41-howto.png`, fullPage: true });
  await back();
  await page.getByRole('button', { name: /High Scores/i }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/42-scores-empty.png` });
  await back();
  await page.getByRole('button', { name: /Level Select/i }).click();
  await page.waitForTimeout(350);
  const enabledBefore = await page.locator('.level-card:not([disabled])').count();
  const lockedBefore = await page.locator('.level-card[disabled]').count();
  log('LEVELS_AT_START', { enabledBefore, lockedBefore });
  await page.screenshot({ path: `${SHOTS}/43-level-select.png` });
  await back();

  // Campaign: real input first, then force the state-flow for QA speed.
  await page.getByRole('button', { name: /PLAY CAMPAIGN/i }).first().click();
  await page.waitForSelector('canvas.game-canvas');
  await page.waitForFunction(() => window.__popboundEngine?.state === 'READY');
  await sleep(250);
  await page.screenshot({ path: `${SHOTS}/44-ready.png` });
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PLAYING');
  const start = await gameState();
  log('GAME_START', start);

  await page.keyboard.down('ArrowRight');
  await sleep(300);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Digit2');
  await page.keyboard.down('Space');
  await sleep(900);
  await page.keyboard.up('Space');
  const afterInput = await gameState();
  const inputDetails = await page.evaluate(() => {
    const e = window.__popboundEngine;
    return {
      x: e.players[0].x,
      weapon: e.players[0].weapon,
      cooldown: e.players[0].cooldowns.web,
      effects: e.effects.length,
      arenaBox: (() => {
        const r = e.canvas.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height) };
      })(),
    };
  });
  log('REAL_INPUT', { afterInput, inputDetails });
  if (afterInput.weapon !== 'web') issues.push('WEAPON_SWITCH_FAILED');
  if (inputDetails.cooldown <= 0) issues.push('FIRE_FAILED');

  // Visual arrangement for renderer inspection.
  await page.evaluate(() => {
    const e = window.__popboundEngine;
    e.debugClearBubbles();
    e.debugSpawnBubble(0, 350, 250, 110, -80, 0.2);
    e.debugSpawnBubble(1, 640, 300, -160, -120, 0.2);
    e.debugSpawnBubble(2, 900, 230, 130, -220, 0.2);
    e.debugSpawnBubble(3, 760, 400, -240, -180, 0.2);
    e.debugSpawnPickup('dual', 500, 470);
    e.debugSpawnPickup('shield', 820, 490);
    e.players[0].dualTimer = 8;
    e.players[0].shield = 1;
    e.debugSetTime(46);
  });
  await sleep(550);
  await page.screenshot({ path: `${SHOTS}/45-gameplay-showcase.png` });

  // Pause freeze check, settings overlay from pause.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PAUSED');
  const frozenA = await gameState();
  await sleep(600);
  const frozenB = await gameState();
  if (frozenA.time !== frozenB.time) issues.push('PAUSE_DID_NOT_FREEZE');
  await page.screenshot({ path: `${SHOTS}/46-paused.png` });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/47-settings-in-game.png` });
  await page.keyboard.press('Escape');
  await sleep(250);
  if ((await page.evaluate(() => window.__popboundEngine?.state)) !== 'PAUSED') {
    issues.push('SETTINGS_ESCAPE_RESUMED_GAME');
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PLAYING');

  // Force level one clear and exercise every campaign transition to the ending.
  await forceClearCurrentLevel();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'LEVEL_COMPLETE');
  await page.waitForTimeout(300);
  log('LEVEL_CLEAR', await gameState());
  await page.screenshot({ path: `${SHOTS}/48-level-clear.png` });
  await page.getByRole('button', { name: /NEXT LEVEL/i }).click();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'READY');

  const levelsSeen = [{ level: 1, title: 'First Contact', theme: 'training' }];
  for (let level = 2; level <= 24; level += 1) {
    const info = await page.evaluate(() => ({
      level: window.__popboundEngine.level.number,
      title: window.__popboundEngine.level.title,
      theme: window.__popboundEngine.level.theme,
    }));
    levelsSeen.push(info);
    if (level === 24) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${SHOTS}/49b-final-arena.png` });
    }
    await forceClearCurrentLevel();
    await page.waitForFunction(
      () => ['LEVEL_COMPLETE', 'CAMPAIGN_COMPLETE'].includes(window.__popboundEngine?.state),
      null,
      { timeout: 4000 },
    );
    if (level === 12) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${SHOTS}/49-level-12-clear.png` });
    }
    if (level < 24) {
      await page.getByRole('button', { name: /NEXT LEVEL/i }).click();
      await page.waitForFunction(() => window.__popboundEngine?.state === 'READY');
      await page.waitForTimeout(80);
    }
  }
  await page.waitForSelector('.victory-title');
  await page.waitForTimeout(350);
  log('CAMPAIGN_END', await gameState());
  log('CAMPAIGN_LEVEL_TITLES', new Set(levelsSeen.map((l) => l.title)).size, new Set(levelsSeen.map((l) => l.theme)).size);
  await page.screenshot({ path: `${SHOTS}/50-campaign-complete.png` });
  const campaignSave = await readSave();
  log('CAMPAIGN_SAVE', {
    completed: campaignSave?.completedLevels?.length,
    unlocked: campaignSave?.highestUnlocked,
    campaignCompleted: campaignSave?.campaignCompleted,
    best: campaignSave?.bestCampaignScore,
  });
  if (campaignSave?.completedLevels?.length !== 24) issues.push('CAMPAIGN_SAVE_INCOMPLETE');

  // Reload to verify persistence and open the progressed menu.
  await page.getByRole('button', { name: /Main Menu/i }).click();
  await waitMenu();
  await page.reload({ waitUntil: 'networkidle' });
  await waitMenu();
  await page.screenshot({ path: `${SHOTS}/51-menu-progress.png` });
  await page.getByRole('button', { name: /High Scores/i }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/51b-high-scores-filled.png` });
  await back();
  await page.getByRole('button', { name: /Level Select/i }).click();
  await page.waitForTimeout(300);
  const enabledAfter = await page.locator('.level-card:not([disabled])').count();
  log('LEVELS_AFTER_CAMPAIGN', enabledAfter);
  if (enabledAfter !== 24) issues.push('LEVEL_SELECT_NOT_FULLY_UNLOCKED');
  await page.screenshot({ path: `${SHOTS}/51c-level-select-progress.png` });
  await back();
  await page.getByRole('button', { name: /REPLAY CAMPAIGN/i }).first().click();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'READY');

  // Three time-outs = all lives lost.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.evaluate(() => {
      const e = window.__popboundEngine;
      if (e.state === 'READY') e.debugStart();
      e.debugSetTime(0.01);
      e.debugAdvance(0.02);
    });
    await page.waitForFunction(() => window.__popboundEngine?.state === 'TIME_UP');
    if (attempt === 1) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${SHOTS}/52-time-up.png` });
    }
    await page.waitForFunction(
      () => ['READY', 'GAME_OVER'].includes(window.__popboundEngine?.state),
      null,
      { timeout: 6000 },
    );
    log('TIMEOUT', attempt, await gameState());
    if (attempt < 3) {
      await page.evaluate(() => {
        const e = window.__popboundEngine;
        if (e.state === 'READY') e.debugStart();
      });
    }
  }
  await page.waitForFunction(() => window.__popboundEngine?.state === 'GAME_OVER', null, { timeout: 6000 });
  await page.waitForTimeout(300);
  log('GAME_OVER', await gameState());
  await page.screenshot({ path: `${SHOTS}/53-game-over.png` });
  await page.getByRole('button', { name: /RETRY LEVEL/i }).click();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'READY');

  // Restart-from-pause confirmation and reset.
  await page.evaluate(() => window.__popboundEngine.debugStart());
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PAUSED');
  await page.getByRole('button', { name: /Restart Level/i }).click();
  await page.waitForSelector('.dialog-confirm');
  await page.getByRole('button', { name: /^RESTART$/i }).click();
  await page.waitForFunction(() => ['READY', 'PLAYING'].includes(window.__popboundEngine?.state));
  log('RESTART_FROM_PAUSE', await gameState());

  // Abandon confirmation.
  await page.evaluate(() => {
    const e = window.__popboundEngine;
    if (e.state === 'READY') e.debugStart();
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PAUSED');
  await page.getByRole('button', { name: /Return to Main Menu/i }).click();
  await page.waitForSelector('.dialog-confirm');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/54-abandon-confirm.png` });
  await page.getByRole('button', { name: /ABANDON RUN/i }).click();
  await waitMenu();

  // Endless
  await page.getByRole('button', { name: /ENDLESS SURGE/i }).click();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PLAYING');
  await sleep(300);
  await page.screenshot({ path: `${SHOTS}/55-endless.png` });
  log('ENDLESS_START', await gameState());
  await page.evaluate(() => {
    const e = window.__popboundEngine;
    e.debugClearBubbles();
    e.debugAdvance(0.04);
  });
  await page.waitForFunction(() => window.__popboundEngine?.state === 'WAVE_COMPLETE');
  await page.waitForTimeout(220);
  await page.screenshot({ path: `${SHOTS}/56-wave-clear.png` });
  const waveSave = await readSave();
  log('ENDLESS_WAVE_SAVE', { best: waveSave?.bestEndlessScore, wave: waveSave?.bestEndlessWave });
  if ((waveSave?.bestEndlessWave ?? 0) < 1) issues.push('ENDLESS_WAVE_NOT_SAVED');
  await page.waitForFunction(() => window.__popboundEngine?.wave === 2, null, { timeout: 6000 });
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PLAYING', null, { timeout: 5000 });
  log('ENDLESS_WAVE_TWO', await gameState());
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PAUSED');
  await page.getByRole('button', { name: /Return to Main Menu/i }).click();
  await page.getByRole('button', { name: /ABANDON RUN/i }).click();
  await waitMenu();

  // Co-op
  await page.getByRole('button', { name: /CO-OP RUN/i }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/57-coop-intro.png` });
  await page.getByRole('button', { name: /START CO-OP RUN/i }).click();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PLAYING');
  await page.waitForTimeout(200);
  const coopBefore = await page.evaluate(() => window.__popboundEngine.players.map((p) => p.x));
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyQ');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyQ');
  const coopAfter = await page.evaluate(() => {
    const e = window.__popboundEngine;
    return {
      x: e.players.map((p) => p.x),
      cooldown: e.players.map((p) => p.cooldowns.pulse),
      state: e.state,
    };
  });
  log('COOP', { coopBefore, coopAfter });
  if (!(coopAfter.x[0] > coopBefore[0] && coopAfter.x[1] > coopBefore[1])) issues.push('COOP_MOVEMENT_FAILED');
  if (!(coopAfter.cooldown[0] > 0 && coopAfter.cooldown[1] > 0)) issues.push('COOP_FIRE_FAILED');
  await page.screenshot({ path: `${SHOTS}/58-coop.png` });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PAUSED');
  await page.getByRole('button', { name: /Return to Main Menu/i }).click();
  await page.getByRole('button', { name: /ABANDON RUN/i }).click();
  await waitMenu();

  // Settings: difficulty persistence, live key rebinding, reset-progress dialog.
  await page.getByRole('button', { name: /Settings/i }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Hard', exact: true }).click();
  await page.waitForTimeout(200);
  const hardSave = await readSave();
  log('DIFFICULTY_SAVED', hardSave?.settings?.difficulty);
  await page.getByRole('button', { name: /Reset progress/i }).click();
  await page.waitForSelector('.dialog-confirm');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/59-reset-confirm.png` });
  await page.getByRole('button', { name: /Cancel/i }).click();
  await back();
  await page.reload({ waitUntil: 'networkidle' });
  await waitMenu();
  const persisted = await readSave();
  log('PERSISTED_DIFFICULTY', persisted?.settings?.difficulty);

  // Start a run, open pause→settings, rebind live, and prove Space stops firing.
  await page.getByRole('button', { name: /PLAY CAMPAIGN/i }).first().click();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'READY');
  await page.evaluate(() => window.__popboundEngine.debugStart());
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PAUSED');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /Rebind Fire for player 1/i }).click();
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Go back' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Resume/i }).click();
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PLAYING');
  await page.evaluate(() => { window.__popboundEngine.players[0].cooldowns.pulse = 0; });
  await page.keyboard.down('Space');
  await sleep(400);
  await page.keyboard.up('Space');
  const cooldownAfterSpace = await page.evaluate(() => window.__popboundEngine.players[0].cooldowns.pulse);
  await page.keyboard.down('KeyF');
  await sleep(250);
  await page.keyboard.up('KeyF');
  const cooldownAfterF = await page.evaluate(() => window.__popboundEngine.players[0].cooldowns.pulse);
  const liveBinding = await page.evaluate(() => window.__popboundEngine.bindings.p1.fire);
  log('LIVE_REBIND', { cooldownAfterSpace, cooldownAfterF, liveBinding });
  if (cooldownAfterSpace !== 0) issues.push('OLD_FIRE_KEY_STILL_FIRES');
  if (cooldownAfterF <= 0) issues.push('REBOUND_FIRE_KEY_DID_NOT_FIRE');
  if (liveBinding !== 'KeyF') issues.push('ENGINE_BINDING_NOT_UPDATED');

  // Restore bindings and leave the game safely.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__popboundEngine?.state === 'PAUSED');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /Reset keys/i }).click();
  await page.waitForTimeout(200);
  await back();
  await page.getByRole('button', { name: /Return to Main Menu/i }).click();
  await page.getByRole('button', { name: /ABANDON RUN/i }).click();
  await waitMenu();
  await page.reload({ waitUntil: 'networkidle' });
  await waitMenu();
  const finalSave = await readSave();
  log('FINAL_SAVE', {
    difficulty: finalSave?.settings?.difficulty,
    fire: finalSave?.bindings?.p1?.fire,
    completed: finalSave?.completedLevels?.length,
    bestCampaign: finalSave?.bestCampaignScore,
  });
  await page.screenshot({ path: `${SHOTS}/60-menu-final.png` });

  log('WARNINGS', JSON.stringify(warnings.slice(0, 20), null, 2));
  log('ISSUES', JSON.stringify(issues, null, 2));
  fs.writeFileSync(
    `${SHOTS}/qa-desktop.json`,
    JSON.stringify({ issues, warnings, levelsSeen, finalSave, campaignSave }, null, 2),
  );
} catch (error) {
  issues.push(`SCRIPT_ERROR: ${error?.stack || error}`);
  console.error('QA SCRIPT ERROR', error);
  try {
    await page.screenshot({ path: `${SHOTS}/99-error.png` });
  } catch {}
  log('ISSUES', JSON.stringify(issues, null, 2));
} finally {
  await browser.close();
}
