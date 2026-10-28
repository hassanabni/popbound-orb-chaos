import { describe, expect, it } from 'vitest';
import {
  BUBBLE_TIERS,
  PICKUP_PHYSICS,
  TIME_UP_OVERLAY,
  WAVE_TRANSITION_TIME,
} from '../src/game/constants';
import type { PickupType } from '../src/game/types';
import { addDecoyBubble, makeEngine } from './helpers';

describe('bubble splitting', () => {
  for (const tier of [0, 1, 2, 3] as const) {
    it(`tier ${tier} produces the exact split rule and awards points once`, () => {
      const { engine } = makeEngine();
      engine.debugStart();
      engine.debugClearBubbles();
      engine.players[0].x = 640;
      const bubble = engine.debugSpawnBubble(tier, 640, 300, 0, 0, 0);
      const scoreBefore = engine.players[0].score;

      const firstHit = engine.debugHitBubble(bubble.id, 0);
      expect(firstHit).toBe(true);
      expect(engine.players[0].score - scoreBefore).toBe(BUBBLE_TIERS[tier].points);

      if (tier === 3) {
        expect(engine.bubbles).toHaveLength(0);
      } else {
        expect(engine.bubbles).toHaveLength(2);
        for (const child of engine.bubbles) {
          expect(child.tier).toBe(tier + 1);
          expect(child.vy).toBeLessThan(0);
          expect(child.spawnGuard).toBeGreaterThan(0);
        }
        expect(engine.bubbles[0].vx * engine.bubbles[1].vx).toBeLessThan(0);
      }

      const scoreAfterFirst = engine.players[0].score;
      const secondHit = engine.debugHitBubble(bubble.id, 0);
      expect(secondHit).toBe(false);
      expect(engine.players[0].score).toBe(scoreAfterFirst);
      expect(engine.stats.pops).toBe(1);
    });
  }

  it('splits recursively through all four tiers without losing or duplicating children', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    engine.players[0].x = 640;
    const root = engine.debugSpawnBubble(0, 640, 240, 0, 0, 0);
    engine.debugHitBubble(root.id, 0);
    expect(engine.bubbles).toHaveLength(2);
    expect(engine.bubbles.every((b) => b.tier === 1)).toBe(true);

    engine.debugAdvance(0.2);
    engine.debugHitBubble(engine.bubbles[0].id, 0);
    expect(engine.bubbles).toHaveLength(3);
    expect(engine.bubbles.filter((b) => b.tier === 2)).toHaveLength(2);

    engine.debugAdvance(0.2);
    engine.debugHitBubble(engine.bubbles.find((b) => b.tier === 2)!.id, 0);
    expect(engine.bubbles).toHaveLength(4);
    expect(engine.bubbles.filter((b) => b.tier === 3)).toHaveLength(2);

    engine.debugAdvance(0.2);
    engine.debugHitBubble(engine.bubbles.find((b) => b.tier === 3)!.id, 0);
    expect(engine.bubbles).toHaveLength(3);
    expect(engine.bubbles.filter((b) => b.tier === 3)).toHaveLength(1);
    expect(engine.stats.splits).toBe(3);
  });

  it('does not allow a freshly spawned child to be split by the same lingering effect', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    const bubble = engine.debugSpawnBubble(0, 500, 300, 0, 0, 0);
    engine.debugHitBubble(bubble.id, 0);
    const children = engine.bubbles.map((b) => b.id);
    expect(engine.bubbles[0].spawnGuard).toBeGreaterThan(0);
    for (const id of children) {
      expect(engine.debugHitBubble(id, 0)).toBe(false);
    }
    expect(engine.bubbles).toHaveLength(2);
  });
});

describe('weapons', () => {
  it('pulse harpoon detects a fast projectile hit rather than tunnelling', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    engine.players[0].x = 640;
    const bubble = engine.debugSpawnBubble(0, 640, 180, 0, 0, 0);
    const scoreBefore = engine.players[0].score;

    expect(engine.debugFire(0)).toBe(true);
    engine.debugAdvance(0.5);

    expect(engine.players[0].score).toBeGreaterThan(scoreBefore);
    expect(engine.bubbles.some((b) => b.id === bubble.id)).toBe(false);
  });

  it('anchor web splits every orb touching its full-height line', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    engine.players[0].x = 640;
    const a = engine.debugSpawnBubble(3, 640, 260, 0, 0, 0);
    const b = engine.debugSpawnBubble(3, 640, 430, 0, 0, 0);
    const scoreBefore = engine.players[0].score;
    engine.setWeapon(0, 'web');
    engine.debugFire(0);
    engine.debugAdvance(0.05);

    expect(engine.bubbles.some((x) => x.id === a.id)).toBe(false);
    expect(engine.bubbles.some((x) => x.id === b.id)).toBe(false);
    expect(engine.players[0].score - scoreBefore).toBeGreaterThanOrEqual(120);
  });

  it('prism beam splits every orb in the column and leaves the rest untouched', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    engine.players[0].x = 600;
    const a = engine.debugSpawnBubble(3, 600, 300, 0, 0, 0);
    const b = engine.debugSpawnBubble(3, 600, 430, 0, 0, 0);
    const offColumn = engine.debugSpawnBubble(3, 760, 300, 0, 0, 0);
    engine.setWeapon(0, 'prism');
    engine.debugFire(0);

    expect(engine.bubbles.some((x) => x.id === a.id)).toBe(false);
    expect(engine.bubbles.some((x) => x.id === b.id)).toBe(false);
    expect(engine.bubbles.some((x) => x.id === offColumn.id)).toBe(true);
    expect(engine.bubbles).toHaveLength(1);
  });

  it('arc mine arms, detonates and splits orbs in its blast radius', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    engine.players[0].x = 640;
    engine.setWeapon(0, 'mine');
    expect(engine.debugFire(0)).toBe(true);
    expect(engine.mines).toHaveLength(1);
    expect(engine.mines[0].phase).toBe(0);
    // Keep the arena alive with a far-away orb while the mine arms.
    engine.debugSpawnBubble(3, 1080, 180, 0, 0, 0);
    engine.debugAdvance(0.85);
    expect(engine.mines[0]?.phase).toBe(1);
    engine.players[0].x = 220;

    const scoreBefore = engine.players[0].score;
    const victim = engine.debugSpawnBubble(1, 640, 610, 0, 0, 0);
    engine.debugAdvance(0.12);

    expect(engine.players[0].score).toBeGreaterThan(scoreBefore);
    expect(engine.bubbles.some((b) => b.id === victim.id)).toBe(false);
  });

  it('dual shot creates two active tethers from a single firing input', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    engine.players[0].dualTimer = 6;
    engine.debugFire(0);
    expect(engine.effects).toHaveLength(2);
    expect(new Set(engine.effects.map((effect) => effect.owner))).toEqual(new Set([0]));
    expect(engine.effects[0].x).not.toBe(engine.effects[1].x);
  });

  it('switching weapons never pauses the simulation', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    expect(engine.state).toBe('PLAYING');
    engine.setWeapon(0, 'web');
    engine.setWeapon(0, 'prism');
    engine.setWeapon(0, 'mine');
    engine.setWeapon(0, 'pulse');
    expect(engine.state).toBe('PLAYING');
    expect(engine.players[0].weapon).toBe('pulse');
  });
});

describe('player damage and protection', () => {
  it('loses exactly one life from an orb collision, then grants invulnerability', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    const player = engine.players[0];
    engine.debugSpawnBubble(3, player.x, player.y - 40, 0, 0, 0);
    const startingLives = player.lives;

    engine.debugAdvance(0.03);
    expect(player.lives).toBe(startingLives - 1);
    expect(player.invuln).toBeGreaterThan(0);

    player.invuln = 0;
    player.lives = 3;
    engine.debugPlayerHit(0);
    expect(player.lives).toBe(2);
    const livesAfterHit = player.lives;
    expect(engine.debugPlayerHit(0)).toBe(false);
    expect(player.lives).toBe(livesAfterHit);
  });

  it('a shield absorbs one hit without losing a life', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    const player = engine.players[0];
    player.shield = 1;
    engine.debugSpawnBubble(3, player.x, player.y - 40, 0, 0, 0);
    const lives = player.lives;

    engine.debugAdvance(0.03);

    expect(player.lives).toBe(lives);
    expect(player.shield).toBe(0);
    expect(player.invuln).toBeGreaterThan(0);
  });
});

describe('timer, pause and game state', () => {
  it('pause freezes the clock, physics and temporary effect timers', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugSetTime(42);
    const player = engine.players[0];
    player.dualTimer = 5;
    player.invuln = 2;
    player.cooldowns.pulse = 2;
    engine.globalFreeze = 3;
    engine.debugSpawnPickup('crystal', 1080, 200);
    const pickupBefore = { age: engine.pickups[0].age, ttl: engine.pickups[0].ttl };
    const timeBefore = engine.time;
    const bubblesBefore = engine.bubbles.map((b) => `${b.x.toFixed(2)}:${b.y.toFixed(2)}`).join('|');

    expect(engine.pause()).toBe(true);
    expect(engine.state).toBe('PAUSED');
    engine.debugAdvance(2);

    expect(engine.time).toBe(timeBefore);
    expect(player.dualTimer).toBe(5);
    expect(player.invuln).toBe(2);
    expect(player.cooldowns.pulse).toBe(2);
    expect(engine.globalFreeze).toBe(3);
    expect(engine.pickups[0].age).toBe(pickupBefore.age);
    expect(engine.pickups[0].ttl).toBe(pickupBefore.ttl);
    expect(engine.bubbles.map((b) => `${b.x.toFixed(2)}:${b.y.toFixed(2)}`).join('|')).toBe(
      bubblesBefore,
    );

    expect(engine.resume()).toBe(true);
    expect(engine.state).toBe('PLAYING');
    engine.debugAdvance(0.5);
    expect(engine.time).toBeLessThan(timeBefore);
    expect(player.dualTimer).toBeLessThan(5);
  });

  it('clears a level, stops the clock and emits exactly one completion event', () => {
    const { engine, events } = makeEngine();
    engine.debugStart();
    engine.debugSetTime(30);
    engine.debugClearBubbles();
    engine.debugAdvance(0.02);

    expect(engine.state).toBe('LEVEL_COMPLETE');
    const completionEvents = events.filter((e) => e.type === 'level-complete');
    expect(completionEvents).toHaveLength(1);
    if (completionEvents[0]?.type === 'level-complete') {
      expect(completionEvents[0].record.levelNumber).toBe(1);
      expect(completionEvents[0].record.levelTotal).toBeGreaterThan(0);
      expect(completionEvents[0].record.remainingTime).toBeGreaterThan(20);
      expect(completionEvents[0].record.timeBonus).toBe(300);
      expect(completionEvents[0].record.completionBonus).toBe(300);
      expect(completionEvents[0].record.levelTotal).toBe(600);
      expect(completionEvents[0].record.teamScore).toBe(600);
    }
    expect(engine.completion).not.toBeNull();
    const timeAtCompletion = engine.time;
    engine.debugAdvance(2);
    expect(engine.state).toBe('LEVEL_COMPLETE');
    expect(engine.time).toBe(timeAtCompletion);
    expect(events.filter((e) => e.type === 'level-complete')).toHaveLength(1);
  });

  it('next level loads a fresh arena and ready state without auto-spawning it early', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    engine.debugAdvance(0.02);
    expect(engine.state).toBe('LEVEL_COMPLETE');

    engine.nextLevel();
    expect(engine.state).toBe('READY');
    expect(engine.level.number).toBe(2);
    expect(engine.time).toBeGreaterThan(0);
    expect(engine.bubbles.length).toBeGreaterThan(0);
  });

  it('a timeout costs one life and restarts the current level with a fresh clock', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    const lives = engine.players[0].lives;
    engine.debugSetTime(0.005);
    engine.debugAdvance(0.03);

    expect(engine.state).toBe('TIME_UP');
    expect(engine.timeUpLosses).toEqual([0]);
    expect(engine.players[0].lives).toBe(lives - 1);
    expect(engine.time).toBe(0);

    engine.debugAdvance(TIME_UP_OVERLAY + 0.15);
    expect(engine.state === 'READY' || engine.state === 'PLAYING').toBe(true);
    expect(engine.players[0].lives).toBe(lives - 1);
    expect(engine.time).toBe(engine.timeLimit);
    expect(engine.timeUpLosses).toEqual([]);
  });

  it('ends the run when every life is gone and can retry cleanly', () => {
    const { engine, events } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    const player = engine.players[0];
    for (let i = 0; i < 3; i += 1) {
      player.invuln = 0;
      expect(engine.debugPlayerHit(0)).toBe(true);
    }
    expect(player.eliminated).toBe(true);
    engine.debugAdvance(0.02);

    expect(engine.state).toBe('GAME_OVER');
    expect(engine.runResult?.finalScore).toBe(player.score);
    expect(events.some((e) => e.type === 'game-over')).toBe(true);

    engine.retry();
    expect(engine.state).toBe('READY');
    expect(engine.players[0].lives).toBe(3);
    expect(engine.players[0].eliminated).toBe(false);
  });

  it('time expiry with no lives left ends in game over', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.players[0].lives = 1;
    engine.players[0].invuln = 0;
    engine.debugSetTime(0.005);
    engine.debugAdvance(0.03);
    expect(engine.state).toBe('TIME_UP');
    expect(engine.players[0].eliminated).toBe(true);
    engine.debugAdvance(TIME_UP_OVERLAY + 0.15);
    expect(engine.state).toBe('GAME_OVER');
  });

  it('completing level 24 enters the campaign-complete state and emits both records', () => {
    const { engine, events } = makeEngine({ startLevelIndex: 23 });
    engine.debugStart();
    engine.debugClearBubbles();
    engine.debugAdvance(0.02);

    expect(engine.level.number).toBe(24);
    expect(engine.state).toBe('CAMPAIGN_COMPLETE');
    expect(engine.completion?.isFinalLevel).toBe(true);
    expect(engine.campaignResult?.finalScore).toBe(engine.completion?.teamScore);
    expect(events.filter((e) => e.type === 'level-complete')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'campaign-complete')).toHaveLength(1);

    engine.restartCampaign();
    expect(engine.state).toBe('READY');
    expect(engine.level.number).toBe(1);
    expect(engine.players[0].score).toBe(0);
  });
});

describe('endless survival', () => {
  it('awards a wave bonus and scales into the next wave', () => {
    const { engine, events } = makeEngine({ mode: 'endless' });
    expect(engine.wave).toBe(1);
    const lives = engine.players[0].lives;
    engine.debugStart();
    engine.debugClearBubbles();
    engine.debugAdvance(0.02);

    expect(engine.state).toBe('WAVE_COMPLETE');
    expect(engine.waveResult?.wave).toBe(1);
    expect(engine.waveResult?.waveBonus).toBeGreaterThan(0);
    expect(events.filter((e) => e.type === 'wave-complete')).toHaveLength(1);
    const scoreAfterWave = engine.players[0].score;
    expect(scoreAfterWave).toBeGreaterThan(0);

    engine.debugAdvance(WAVE_TRANSITION_TIME + 0.2);
    expect(engine.wave).toBe(2);
    expect(engine.state === 'READY' || engine.state === 'PLAYING').toBe(true);
    expect(engine.players[0].lives).toBe(lives);
    expect(engine.players[0].score).toBe(scoreAfterWave);
    expect(engine.level.title.length).toBeGreaterThan(0);
    expect(engine.level.subtitle).toContain('Wave 02');
    expect(engine.timeLimit).toBeLessThanOrEqual(70);
  });
});

describe('additional run rules', () => {
  it('time-out restart resets the current attempt score but keeps session baseline', () => {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    engine.debugSpawnBubble(3, 1080, 180, 0, 0, 0);
    const pop = engine.debugSpawnBubble(3, 320, 260, 0, 0, 0);
    engine.debugHitBubble(pop.id, 0);
    expect(engine.players[0].score).toBeGreaterThan(0);
    const baseline = 0;
    engine.debugSetTime(0.005);
    engine.debugAdvance(0.03);
    expect(engine.state).toBe('TIME_UP');
    engine.debugAdvance(TIME_UP_OVERLAY + 0.15);
    expect(engine.players[0].score).toBe(baseline);
    expect(engine.state === 'READY' || engine.state === 'PLAYING').toBe(true);
  });

  it('ends an endless run when all lives are lost and records the wave', () => {
    const { engine } = makeEngine({ mode: 'endless' });
    engine.debugStart();
    engine.debugClearBubbles();
    for (let i = 0; i < 3; i += 1) {
      engine.players[0].invuln = 0;
      engine.debugPlayerHit(0);
    }
    engine.debugAdvance(0.02);
    expect(engine.state).toBe('GAME_OVER');
    expect(engine.runResult?.mode).toBe('endless');
    expect(engine.runResult?.wave).toBe(1);
    engine.retry();
    expect(engine.state).toBe('READY');
    expect(engine.wave).toBe(1);
    expect(engine.players[0].lives).toBe(3);
  });
});

describe('co-op', () => {
  it('supports simultaneous movement and firing for both players', () => {
    const { engine } = makeEngine({ mode: 'coop' });
    engine.debugStart();
    const p1 = engine.players[0];
    const p2 = engine.players[1];
    const p1Start = p1.x;
    const p2Start = p2.x;

    engine.input.setHeld('ArrowRight', true);
    engine.input.setHeld('Space', true);
    engine.input.setHeld('KeyD', true);
    engine.input.setHeld('KeyQ', true);
    engine.debugAdvance(0.2);

    expect(p1.x).toBeGreaterThan(p1Start);
    expect(p2.x).toBeGreaterThan(p2Start);
    expect(p1.cooldowns.pulse).toBeGreaterThan(0);
    expect(p2.cooldowns.pulse).toBeGreaterThan(0);

    engine.input.setHeld('ArrowRight', false);
    engine.input.setHeld('Space', false);
    engine.input.setHeld('KeyD', false);
    engine.input.setHeld('KeyQ', false);
  });

  it('lets a surviving player finish the arena after their partner is downed', () => {
    const { engine } = makeEngine({ mode: 'coop' });
    engine.debugStart();
    engine.debugClearBubbles();
    const p1 = engine.players[0];
    for (let i = 0; i < 3; i += 1) {
      p1.invuln = 0;
      engine.debugPlayerHit(0);
    }
    expect(p1.eliminated).toBe(true);
    expect(engine.players[1].eliminated).toBe(false);

    engine.debugAdvance(0.02);
    expect(engine.state).toBe('LEVEL_COMPLETE');
    expect(engine.completion?.playerLives[0]).toBe(0);
    expect(engine.completion?.playerLives[1]).toBeGreaterThan(0);
  });

  it('ends the co-op run only when both players are down', () => {
    const { engine } = makeEngine({ mode: 'coop' });
    engine.debugStart();
    engine.debugClearBubbles();
    for (let i = 0; i < 3; i += 1) {
      engine.players[0].invuln = 0;
      engine.debugPlayerHit(0);
    }
    engine.debugAdvance(0.02);
    expect(engine.state).toBe('LEVEL_COMPLETE');

    const second = makeEngine({ mode: 'coop' });
    second.engine.debugStart();
    second.engine.debugClearBubbles();
    for (let i = 0; i < 3; i += 1) {
      second.engine.players[0].invuln = 0;
      second.engine.players[1].invuln = 0;
      second.engine.debugPlayerHit(0);
      second.engine.debugPlayerHit(1);
    }
    second.engine.debugAdvance(0.02);
    expect(second.engine.state).toBe('GAME_OVER');
  });

  it('revives both players when advancing to the next level', () => {
    const { engine } = makeEngine({ mode: 'coop' });
    engine.debugStart();
    engine.debugClearBubbles();
    for (let i = 0; i < 3; i += 1) {
      engine.players[0].invuln = 0;
      engine.debugPlayerHit(0);
    }
    engine.debugAdvance(0.02);
    expect(engine.state).toBe('LEVEL_COMPLETE');
    engine.nextLevel();
    expect(engine.players).toHaveLength(2);
    expect(engine.players.every((p) => p.lives === 3 && !p.eliminated)).toBe(true);
  });
});

describe('pickups and power-ups', () => {
  function collect(type: PickupType, before?: (engine: ReturnType<typeof makeEngine>['engine']) => void) {
    const { engine } = makeEngine();
    engine.debugStart();
    engine.debugClearBubbles();
    addDecoyBubble(engine);
    if (before) before(engine);
    const player = engine.players[0];
    engine.debugSpawnPickup(type, player.x, player.y - 32);
    engine.debugAdvance(0.03);
    return { engine, player };
  }

  it('dual shot activates and appears in the HUD snapshot', () => {
    const { engine, player } = collect('dual');
    expect(player.dualTimer).toBeGreaterThan(PICKUP_PHYSICS.dualDuration - 0.2);
    expect(engine.getSnapshot().effects.some((e) => e.type === 'dual')).toBe(true);
  });

  it('energy shield activates and persists as a one-hit barrier', () => {
    const { engine, player } = collect('shield');
    expect(player.shield).toBe(1);
    expect(engine.getSnapshot().effects.some((e) => e.type === 'shield')).toBe(true);
  });

  it('freeze burst stops ordinary bubble movement while the player can still fire', () => {
    const { engine } = collect('freeze');
    expect(engine.globalFreeze).toBeGreaterThan(0);
    expect(engine.getSnapshot().effects.some((e) => e.type === 'freeze')).toBe(true);
    const bubble = engine.bubbles[0];
    const x = bubble.x;
    const y = bubble.y;
    engine.debugAdvance(0.6);
    expect(bubble.x).toBe(x);
    expect(bubble.y).toBe(y);
    expect(engine.debugFire(0)).toBe(true);
  });

  it('time surge adds seconds to the clock', () => {
    const { engine } = collect('time', (e) => e.debugSetTime(20));
    expect(engine.time).toBeGreaterThan(20);
    expect(engine.time).toBeLessThanOrEqual(engine.timeLimit);
  });

  it('extra life adds one life up to the maximum', () => {
    const { engine, player } = collect('life', (e) => {
      e.players[0].lives = 1;
    });
    expect(player.lives).toBe(2);
  });

  it('score crystal awards its point value', () => {
    const { engine, player } = collect('crystal');
    // The crystal is worth exactly 150 points and does not pop the decoy bubble.
    expect(player.score).toBeGreaterThanOrEqual(150);
    expect(engine.stats.pickups).toBe(1);
    expect(engine.bubbles).toHaveLength(1);
  });
});
