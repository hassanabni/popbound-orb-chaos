import { describe, expect, it } from 'vitest';
import {
  ARENA,
  BUBBLE_PHYSICS,
  BUBBLE_TIERS,
  PLAYER,
} from '../src/game/constants';
import {
  BOUNCE_CEILING,
  BOUNCE_FLOOR,
  BOUNCE_WALL,
  bubbleHitsPlayer,
  circleOverlap,
  findSafeSpawnX,
  integrateBubblePhysics,
  integratePlayerMovement,
  segmentCircleHit,
  segmentCircleHitT,
} from '../src/game/physics';
import type { Bubble, Player } from '../src/game/types';
import { makeEngine } from './helpers';

describe('bubble boundary physics', () => {
  it('bounces off the floor and never passes through it', () => {
    const radius = BUBBLE_TIERS[0].radius;
    const body = {
      x: ARENA.width / 2,
      y: ARENA.floor - radius - 2,
      vx: 30,
      vy: 400,
      r: radius,
    };
    const flags = integrateBubblePhysics(body, 1 / 120, BUBBLE_PHYSICS.gravity, ARENA, BUBBLE_TIERS[0]);
    expect(flags & BOUNCE_FLOOR).toBe(BOUNCE_FLOOR);
    expect(body.y + body.r).toBeLessThanOrEqual(ARENA.floor + 0.0001);
    expect(body.vy).toBeLessThan(0);
  });

  it('never allows a bubble to fall through the floor across a long simulation', () => {
    const body = {
      x: 640,
      y: 300,
      vx: 500,
      vy: 0,
      r: BUBBLE_TIERS[3].radius,
    };
    for (let i = 0; i < 2400; i += 1) {
      integrateBubblePhysics(body, 1 / 60, BUBBLE_PHYSICS.gravity, ARENA, BUBBLE_TIERS[3]);
      expect(body.y + body.r).toBeLessThanOrEqual(ARENA.floor + 0.0001);
      expect(body.x - body.r).toBeGreaterThanOrEqual(ARENA.left - 0.0001);
      expect(body.x + body.r).toBeLessThanOrEqual(ARENA.right + 0.0001);
    }
  });

  it('keeps every tier bouncing high enough to remain hittable while smaller tiers bounce lower', () => {
    const apexes = BUBBLE_TIERS.map(
      (tier) => (tier.floorBounce * tier.floorBounce) / (2 * BUBBLE_PHYSICS.gravity),
    );
    for (let i = 0; i < apexes.length; i += 1) {
      // Orbs must clear the player's emitter height (base ~600) so they never
      // become lethal floor-hugging objects that cannot be shot.
      expect(apexes[i]).toBeGreaterThan(180);
      if (i > 0) expect(apexes[i]).toBeLessThan(apexes[i - 1]);
    }
  });

  it('bounces off both walls with an inward velocity', () => {
    const left = {
      x: ARENA.left + 21,
      y: 300,
      vx: -500,
      vy: 0,
      r: 20,
    };
    const leftFlags = integrateBubblePhysics(left, 1 / 60, 0, ARENA, BUBBLE_TIERS[3]);
    expect(leftFlags & BOUNCE_WALL).toBe(BOUNCE_WALL);
    expect(left.vx).toBeGreaterThan(0);
    expect(left.x - left.r).toBeGreaterThanOrEqual(ARENA.left - 0.001);

    const right = {
      x: ARENA.right - 21,
      y: 300,
      vx: 500,
      vy: 0,
      r: 20,
    };
    const rightFlags = integrateBubblePhysics(right, 1 / 60, 0, ARENA, BUBBLE_TIERS[3]);
    expect(rightFlags & BOUNCE_WALL).toBe(BOUNCE_WALL);
    expect(right.vx).toBeLessThan(0);
    expect(right.x + right.r).toBeLessThanOrEqual(ARENA.right + 0.001);
  });

  it('bounces down from the ceiling', () => {
    const body = {
      x: 640,
      y: ARENA.top + 21,
      vx: 0,
      vy: -500,
      r: 20,
    };
    const flags = integrateBubblePhysics(body, 1 / 60, 0, ARENA, BUBBLE_TIERS[2]);
    expect(flags & BOUNCE_CEILING).toBe(BOUNCE_CEILING);
    expect(body.vy).toBeGreaterThan(0);
    expect(body.y - body.r).toBeGreaterThanOrEqual(ARENA.top - 0.001);
  });
});

describe('projectile collision geometry', () => {
  it('detects circles with overlapping and separated centres', () => {
    expect(circleOverlap(100, 100, 20, 130, 100, 20)).toBe(true);
    expect(circleOverlap(100, 100, 20, 141, 100, 20)).toBe(false);
  });

  it('sweeps a fast vertical segment across a small bubble', () => {
    // The harpoon tip moves from y=600 to y=120 in one step. A naive point test
    // would miss the bubble at y=350; the segment test must catch it.
    expect(segmentCircleHit(600, 600, 600, 120, 600, 350, 16)).toBe(true);
    expect(segmentCircleHitT(600, 600, 600, 120, 600, 350, 16)).toBeGreaterThan(0);
    expect(segmentCircleHit(600, 600, 600, 120, 760, 350, 16)).toBe(false);
  });

  it('detects bubble-to-player circle collisions and respects invulnerability', () => {
    const { engine } = makeEngine();
    const player = engine.players[0];
    const bubble: Bubble = {
      id: 1,
      tier: 3,
      x: player.x,
      y: player.y - 38,
      vx: 0,
      vy: 0,
      r: 16,
      hue: 0,
      variant: 0,
      wobble: 0,
      wobbleSpeed: 0,
      spin: 0,
      spinSpeed: 0,
      squash: 0,
      spawnGuard: 0,
      age: 0,
    };
    expect(bubbleHitsPlayer(bubble, player)).toBe(true);
    const invulnerable = { ...player, invuln: 2 } as Player;
    expect(bubbleHitsPlayer(bubble, invulnerable)).toBe(false);
    const eliminated = { ...player, eliminated: true } as Player;
    expect(bubbleHitsPlayer(bubble, eliminated)).toBe(false);
  });
});

describe('player movement', () => {
  it('accelerates toward the input, decelerates on release and respects walls', () => {
    const player = { x: ARENA.width / 2, vx: 0 };
    integratePlayerMovement(player, 1, 0.1, ARENA);
    expect(player.vx).toBeGreaterThan(0);
    expect(player.x).toBeGreaterThan(ARENA.width / 2);

    integratePlayerMovement(player, 0, 0.2, ARENA);
    expect(Math.abs(player.vx)).toBeLessThan(PLAYER.maxSpeed);

    player.x = ARENA.left + PLAYER.halfWidth + 2;
    player.vx = -800;
    integratePlayerMovement(player, -1, 0.2, ARENA);
    expect(player.x).toBeGreaterThanOrEqual(ARENA.left + PLAYER.halfWidth - 0.001);
    expect(player.vx).toBeGreaterThanOrEqual(0);

    player.x = ARENA.right - PLAYER.halfWidth - 2;
    player.vx = 800;
    integratePlayerMovement(player, 1, 0.2, ARENA);
    expect(player.x).toBeLessThanOrEqual(ARENA.right - PLAYER.halfWidth + 0.001);
    expect(player.vx).toBeLessThanOrEqual(0);
  });

  it('never leaves the arena during a long held-direction run', () => {
    const player = { x: ARENA.width / 2, vx: 0 };
    for (let i = 0; i < 600; i += 1) {
      integratePlayerMovement(player, 1, 1 / 60, ARENA);
      expect(player.x + PLAYER.halfWidth).toBeLessThanOrEqual(ARENA.right + 0.001);
    }
    for (let i = 0; i < 900; i += 1) {
      integratePlayerMovement(player, -1, 1 / 60, ARENA);
      expect(player.x - PLAYER.halfWidth).toBeGreaterThanOrEqual(ARENA.left - 0.001);
    }
  });

  it('chooses a respawn lane inside the arena', () => {
    const x = findSafeSpawnX(
      [
        { x: 300, y: 200 },
        { x: 640, y: 300 },
        { x: 980, y: 260 },
      ],
      640,
      ARENA,
    );
    expect(x).toBeGreaterThanOrEqual(ARENA.left + 60);
    expect(x).toBeLessThanOrEqual(ARENA.right - 60);
  });
});
