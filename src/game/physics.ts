import { BUBBLE_PHYSICS, PLAYER } from './constants';
import type { ArenaBounds, Bubble, Player } from './types';

export const BOUNCE_FLOOR = 1;
export const BOUNCE_WALL = 2;
export const BOUNCE_CEILING = 4;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function approach(value: number, target: number, delta: number): number {
  if (value < target) return Math.min(value + delta, target);
  if (value > target) return Math.max(value - delta, target);
  return target;
}

/** Small deterministic PRNG; used for level layouts and repeatable effects. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function pickWeightedIndex(rng: () => number, weights: readonly number[]): number {
  let total = 0;
  for (const weight of weights) total += Math.max(0, weight);
  if (total <= 0) return 0;
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= Math.max(0, weights[i]);
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

export function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function circleOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const radii = ar + br;
  return distanceSquared(ax, ay, bx, by) <= radii * radii;
}

/**
 * Returns the parametric position (0..1) of the closest point on a segment to
 * a circle, or -1 if the segment does not intersect the circle. This is the
 * authoritative check behind every beam-style weapon.
 */
export function segmentCircleHitT(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.000001) {
    return distanceSquared(x1, y1, cx, cy) <= radius * radius ? 0 : -1;
  }
  const t = clamp(((cx - x1) * dx + (cy - y1) * dy) / lenSq, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return distanceSquared(px, py, cx, cy) <= radius * radius ? t : -1;
}

export function segmentCircleHit(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  return segmentCircleHitT(x1, y1, x2, y2, cx, cy, radius) >= 0;
}

export interface BubblePhysicsBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface BounceProfile {
  floorBounce: number;
}

/**
 * Frame-rate independent, arcade-tuned bubble integration. Mutates the body and
 * returns a bitmask of boundary contacts so the engine can add feedback.
 *
 * The floor rule guarantees a minimum upward rebound, so bubbles never settle
 * or tunnel through the arena floor even when their incoming speed is tiny.
 */
export function integrateBubblePhysics(
  body: BubblePhysicsBody,
  dt: number,
  gravity: number,
  bounds: ArenaBounds,
  profile: BounceProfile,
): number {
  let flags = 0;
  body.vy += gravity * dt;
  if (body.vy > BUBBLE_PHYSICS.maxVy) body.vy = BUBBLE_PHYSICS.maxVy;

  body.x += body.vx * dt;
  body.y += body.vy * dt;

  const minX = bounds.left + body.r;
  const maxX = bounds.right - body.r;
  if (body.x < minX) {
    body.x = minX;
    body.vx = Math.abs(body.vx) * BUBBLE_PHYSICS.wallRestitution;
    flags |= BOUNCE_WALL;
  } else if (body.x > maxX) {
    body.x = maxX;
    body.vx = -Math.abs(body.vx) * BUBBLE_PHYSICS.wallRestitution;
    flags |= BOUNCE_WALL;
  }

  const floorY = bounds.floor - body.r;
  if (body.y > floorY) {
    body.y = floorY;
    if (body.vy > 0) {
      const rebound = Math.max(
        Math.abs(body.vy) * BUBBLE_PHYSICS.floorRestitution,
        profile.floorBounce,
      );
      body.vy = -rebound;
      flags |= BOUNCE_FLOOR;
    } else {
      body.vy = 0;
    }
  }

  const ceilingY = bounds.top + body.r;
  if (body.y < ceilingY) {
    body.y = ceilingY;
    if (body.vy < 0) {
      const rebound = Math.abs(body.vy) * BUBBLE_PHYSICS.ceilingRestitution;
      body.vy = Math.max(rebound, 80);
      flags |= BOUNCE_CEILING;
    }
  }

  // Final safety clamps. These also prevent entities getting trapped in a wall
  // if a level is hot-reloaded or an extreme velocity is injected.
  body.x = clamp(body.x, bounds.left + body.r, bounds.right - body.r);
  body.y = clamp(body.y, bounds.top + body.r, bounds.floor - body.r);

  return flags;
}

export function integratePlayerMovement(
  player: Pick<Player, 'x' | 'vx'>,
  axis: -1 | 0 | 1,
  dt: number,
  bounds: ArenaBounds,
): void {
  const maxSpeed = PLAYER.maxSpeed;
  if (axis !== 0) {
    const target = axis * maxSpeed;
    const turning = Math.sign(player.vx) !== 0 && Math.sign(player.vx) !== axis;
    const rate = PLAYER.acceleration * (turning ? 1.5 : 1);
    player.vx = approach(player.vx, target, rate * dt);
  } else {
    player.vx = approach(player.vx, 0, PLAYER.friction * dt);
  }

  player.x += player.vx * dt;
  const minX = bounds.left + PLAYER.halfWidth;
  const maxX = bounds.right - PLAYER.halfWidth;
  if (player.x < minX) {
    player.x = minX;
    player.vx = Math.max(0, player.vx);
  } else if (player.x > maxX) {
    player.x = maxX;
    player.vx = Math.min(0, player.vx);
  }
}

export function playerHitCircle(player: Pick<Player, 'x' | 'y'>): {
  x: number;
  y: number;
  r: number;
} {
  return { x: player.x, y: player.y - PLAYER.hitOffset, r: PLAYER.radius };
}

export function bubbleHitsPlayer(bubble: Bubble, player: Player): boolean {
  if (player.eliminated || player.invuln > 0) return false;
  const circle = playerHitCircle(player);
  return circleOverlap(bubble.x, bubble.y, bubble.r, circle.x, circle.y, circle.r);
}

export function bubbleIntersectsSegment(
  bubble: Bubble,
  x: number,
  baseY: number,
  tipY: number,
  halfWidth: number,
): boolean {
  // A beam is a vertical band. Treat it as a capsule so the rounded tip and
  // emitter are both generous, while the width gives aim assist without
  // letting visually-missed bubbles pop.
  const closestX = clamp(bubble.x, x - halfWidth, x + halfWidth);
  const closestY = clamp(bubble.y, tipY, baseY);
  return distanceSquared(bubble.x, bubble.y, closestX, closestY) <= bubble.r * bubble.r;
}

/** Find the safest horizontal respawn lane after a hit. */
export function findSafeSpawnX(
  bubbleXs: Array<{ x: number; y: number }>,
  currentX: number,
  bounds: ArenaBounds,
): number {
  const candidates: number[] = [];
  const lanes = 11;
  for (let i = 0; i < lanes; i += 1) {
    candidates.push(bounds.left + 60 + (i / (lanes - 1)) * (bounds.right - bounds.left - 120));
  }
  let best = clamp(currentX, bounds.left + 60, bounds.right - 60);
  let bestScore = -Infinity;
  for (const x of candidates) {
    let nearest = Infinity;
    for (const b of bubbleXs) {
      const dx = x - b.x;
      const dy = bounds.floor - 38 - b.y;
      nearest = Math.min(nearest, Math.sqrt(dx * dx + dy * dy));
    }
    // Prefer safe lanes but stay close to where the player already was.
    const score = nearest - Math.abs(x - currentX) * 0.12;
    if (score > bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best;
}
