import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_LEVELS,
  generateBubbleSpawns,
  isFinalLevel,
  LEVEL_TIER_LABEL,
  makeEndlessLevel,
  MODIFIERS,
  scaleTimeForDifficulty,
  validateBubbleSpawns,
} from '../src/game/levels';
import { CAMPAIGN_LEVEL_COUNT, PLAYER } from '../src/game/constants';

describe('campaign data', () => {
  it('contains 24 unique, data-driven levels', () => {
    expect(CAMPAIGN_LEVELS).toHaveLength(CAMPAIGN_LEVEL_COUNT);
    expect(new Set(CAMPAIGN_LEVELS.map((level) => level.id)).size).toBe(24);
    expect(new Set(CAMPAIGN_LEVELS.map((level) => level.title)).size).toBe(24);
    CAMPAIGN_LEVELS.forEach((level, i) => {
      expect(level.number).toBe(i + 1);
      expect(level.id).toBe(`L${String(i + 1).padStart(2, '0')}`);
      expect(level.timeLimit).toBeGreaterThanOrEqual(20);
      expect(level.timeLimit).toBeLessThanOrEqual(120);
      expect(level.bubbleCount).toBeGreaterThanOrEqual(1);
      expect(level.bubbleCount).toBeLessThanOrEqual(20);
      expect(level.tierWeights.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
      expect(level.speed).toBeGreaterThan(0);
      expect(level.pickupChance).toBeGreaterThanOrEqual(0);
      expect(level.pickupChance).toBeLessThanOrEqual(1);
      expect(level.completionBonus).toBeGreaterThan(0);
      expect(LEVEL_TIER_LABEL[level.tier]).toBeTruthy();
      expect(MODIFIERS[level.modifier]).toBeTruthy();
    });
  });

  it('uses all five arena themes and genuine layout/modifier variety', () => {
    const themes = new Set(CAMPAIGN_LEVELS.map((level) => level.theme));
    const layouts = new Set(CAMPAIGN_LEVELS.map((level) => level.layout));
    const modifiers = new Set(CAMPAIGN_LEVELS.map((level) => level.modifier));
    expect(themes.size).toBe(5);
    expect(layouts.size).toBeGreaterThanOrEqual(6);
    expect(modifiers.size).toBeGreaterThanOrEqual(4);
  });

  it('final level detection is correct', () => {
    expect(isFinalLevel(0)).toBe(false);
    expect(isFinalLevel(22)).toBe(false);
    expect(isFinalLevel(23)).toBe(true);
    expect(isFinalLevel(24)).toBe(true);
  });

  it('difficulty scales object timers in a predictable order', () => {
    const easy = scaleTimeForDifficulty(60, 'easy');
    const normal = scaleTimeForDifficulty(60, 'normal');
    const hard = scaleTimeForDifficulty(60, 'hard');
    expect(easy).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(hard);
    expect(normal).toBe(60);
    expect(easy).toBe(70);
    expect(hard).toBe(55);
  });
});

describe('validated spawn layouts', () => {
  it('generates a valid, non-overlapping layout for every campaign level', () => {
    const playerXs = [PLAYER.startSingleX, ...PLAYER.startCoopX];
    for (const level of CAMPAIGN_LEVELS) {
      const spawns = generateBubbleSpawns(level, 1.15);
      expect(spawns).toHaveLength(level.bubbleCount);
      const issues = validateBubbleSpawns(spawns, level.bubbleCount);
      expect(issues, `Level ${level.number} (${level.title}): ${JSON.stringify(issues)}`).toEqual(
        [],
      );
      for (const spawn of spawns) {
        expect(Number.isFinite(spawn.x)).toBe(true);
        expect(Number.isFinite(spawn.y)).toBe(true);
        expect(Number.isFinite(spawn.vx)).toBe(true);
        expect(Number.isFinite(spawn.vy)).toBe(true);
        // Never spawn inside the player spawn zone.
        for (const px of playerXs) {
          const distance = Math.hypot(spawn.x - px, spawn.y - (level.number > 0 ? 652 - 38 : 0));
          expect(distance).toBeGreaterThan(20);
        }
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const level = CAMPAIGN_LEVELS[11];
    const first = generateBubbleSpawns(level, 1.1);
    const second = generateBubbleSpawns(level, 1.1);
    expect(first).toEqual(second);
  });

  it('validates that every endless wave up to 40 is safely spawnable', () => {
    for (let wave = 1; wave <= 40; wave += 1) {
      const level = makeEndlessLevel(wave);
      const spawns = generateBubbleSpawns(level, 1.5);
      expect(spawns).toHaveLength(level.bubbleCount);
      const issues = validateBubbleSpawns(spawns, level.bubbleCount);
      expect(issues, `Wave ${wave}: ${JSON.stringify(issues)}`).toEqual([]);
    }
  });

  it('scales endless difficulty without unbounded counts or instant timers', () => {
    const early = makeEndlessLevel(1);
    const mid = makeEndlessLevel(10);
    const late = makeEndlessLevel(40);
    expect(early.bubbleCount).toBeLessThan(mid.bubbleCount);
    expect(late.bubbleCount).toBeLessThanOrEqual(13);
    expect(late.timeLimit).toBeGreaterThanOrEqual(30);
    expect(late.timeLimit).toBeLessThan(early.timeLimit);
    expect(late.speed).toBeGreaterThan(mid.speed);
    expect(late.speed).toBeLessThanOrEqual(1.9);
    expect(late.completionBonus).toBeGreaterThan(early.completionBonus);
  });
});
