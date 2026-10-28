import { describe, expect, it, vi, afterEach } from 'vitest';
import { GameEngine } from '../src/game/GameEngine';
import { DEFAULT_BINDINGS, DEFAULT_SETTINGS } from '../src/game/constants';
import type { EngineEvent } from '../src/game/types';

/**
 * Headless "courier AI" integration run.
 *
 * It plays with the real engine, input bindings, cooldowns, collisions and
 * timers. It never removes bubbles, grants lives or manipulates scores. The
 * only non-player conveniences are debugStart (skip intro) and debugAdvance
 * (run simulation faster than wall clock). If it can reach the campaign
 * ending, the campaign is mechanically completable.
 */
describe('campaign completion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('can be played from level 1 to the ending under normal combat rules', () => {
    // Deterministic RNG makes the bot's execution, split trajectories and
    // pickup drops repeatable. It does not alter gameplay rules.
    let seed = 0x51f15e;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    });
    const events: EngineEvent[] = [];
    const engine = new GameEngine({
      mode: 'campaign',
      startLevelIndex: 0,
      settings: { ...DEFAULT_SETTINGS, screenShake: false, reducedMotion: true },
      bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)),
      onEvent: (event) => events.push(event),
    });
    engine.debugStart();
    engine.setWeapon(0, 'web');

    const held = { left: false, right: false, fire: false };
    const setKey = (action: 'left' | 'right' | 'fire', down: boolean) => {
      if (held[action] === down) return;
      held[action] = down;
      const code =
        action === 'left'
          ? engine.bindings.p1.left
          : action === 'right'
            ? engine.bindings.p1.right
            : engine.bindings.p1.fire;
      engine.input.setHeld(code, down);
    };
    const releaseAll = () => {
      engine.input.setHeld(engine.bindings.p1.left, false);
      engine.input.setHeld(engine.bindings.p1.right, false);
      engine.input.setHeld(engine.bindings.p1.fire, false);
      held.left = false;
      held.right = false;
      held.fire = false;
    };

    const completed: Array<{ level: number; title: string; lives: number; time: number }> = [];
    const retries = new Map<number, number>();
    let lastLevel = -1;
    let steps = 0;
    let lastLog = '';
    const MAX_STEPS = 260000;

    while (engine.state !== 'CAMPAIGN_COMPLETE' && steps < MAX_STEPS) {
      steps += 1;
      if (engine.state === 'READY') {
        engine.debugStart();
        engine.setWeapon(0, 'web');
        continue;
      }
      if (engine.state === 'LEVEL_COMPLETE') {
        releaseAll();
        completed.push({
          level: engine.level.number,
          title: engine.level.title,
          lives: engine.players[0].lives,
          time: engine.time,
        });
        lastLog = `cleared L${engine.level.number} ${engine.level.title} lives=${engine.players[0].lives} time=${engine.time.toFixed(1)}`;
        console.log(lastLog, `score=${engine.players[0].score} pops=${engine.stats.pops}`);
        engine.nextLevel();
        continue;
      }
      if (engine.state === 'GAME_OVER') {
        releaseAll();
        const n = (retries.get(engine.level.number) ?? 0) + 1;
        retries.set(engine.level.number, n);
        console.log(`RETRY L${engine.level.number} attempt ${n} reason=${engine.runResult?.reason} time=${engine.time.toFixed(1)} score=${engine.players[0].score} bubbles=${engine.bubbles.length}`);
        if (n > 6) break;
        engine.retry();
        continue;
      }
      if (engine.state !== 'PLAYING') {
        engine.debugAdvance(0.05);
        continue;
      }
      if (engine.level.number !== lastLevel) {
        lastLevel = engine.level.number;
        engine.setWeapon(0, 'web');
      }
      engine.setWeapon(0, 'web');

      const player = engine.players[0];
      const px = player.x;
      const py = player.y;
      let nearestThreat: { x: number; y: number; r: number; d: number } | null = null;
      for (const bubble of engine.bubbles) {
        const dx = bubble.x - px;
        const dy = bubble.y - (py - 38);
        if (Math.abs(dx) < bubble.r + 76 && bubble.y > py - 350) {
          const d = Math.hypot(dx, dy);
          if (!nearestThreat || d < nearestThreat.d) {
            nearestThreat = { x: bubble.x, y: bubble.y, r: bubble.r, d };
          }
        }
      }

      let direction: -1 | 0 | 1 = 0;
      let retreating = false;
      if (nearestThreat) {
        // Run away from the most immediate orb, but do not get pinned on a wall.
        direction = nearestThreat.x >= px ? -1 : 1;
        if (direction === -1 && px < engine.arena.left + 90) direction = 1;
        if (direction === 1 && px > engine.arena.right - 90) direction = -1;
        retreating = true;
      } else {
        const shootable = engine.bubbles
          .filter((bubble) => bubble.y < py - 100)
          .sort((a, b) => b.y - a.y);
        const target = shootable[0];
        if (target) {
          const lead = target.x + target.vx * 0.08;
          const dx = lead - px;
          if (Math.abs(dx) > 12) direction = dx > 0 ? 1 : -1;
          retreating = Math.abs(dx) <= target.r + 5;
        } else if (engine.bubbles.length > 0) {
          // Keep a little distance from an orb below firing height.
          const low = engine.bubbles.reduce((a, b) => (a.y > b.y ? a : b));
          if (Math.abs(low.x - px) < 130) direction = low.x > px ? -1 : 1;
        }
      }

      setKey('left', direction === -1);
      setKey('right', direction === 1);
      // The web persists after casting, so it is safe to fire while retreating.
      setKey('fire', true);
      engine.debugAdvance(0.04);
      void retreating;
    }

    releaseAll();
    if (
      engine.state === 'CAMPAIGN_COMPLETE' &&
      !completed.some((entry) => entry.level === 24)
    ) {
      completed.push({
        level: engine.level.number,
        title: engine.level.title,
        lives: engine.players[0].lives,
        time: engine.time,
      });
    }

    const shortfall = completed.length < 24 ? ` only cleared ${completed.length}/24` : '';
    console.log('CAMPAIGN_BOT_RESULT', engine.state, `steps=${steps}`, `retries=${JSON.stringify([...retries])}`);
    console.log('FINAL SCORE', engine.players[0]?.score ?? 0);
    expect(engine.state, `Bot did not reach campaign complete;${shortfall}`).toBe('CAMPAIGN_COMPLETE');
    expect(completed).toHaveLength(24);
    expect(new Set(completed.map((entry) => entry.level)).size).toBe(24);
    expect(completed.map((entry) => entry.title)).toContain('The Orb Chaos Core');
    expect(events.some((event) => event.type === 'campaign-complete')).toBe(true);
  }, 180_000);
});
