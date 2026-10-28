import { ARENA, BUBBLE_TIERS, CAMPAIGN_LEVEL_COUNT, DIFFICULTY, PLAYER } from './constants';
import { clamp, distanceSquared, mulberry32, pickWeightedIndex, randomRange } from './physics';
import { THEMES, THEME_ORDER } from './themes';
import type {
  BubbleSpawn,
  BubbleTier,
  Difficulty,
  LevelConfig,
  LevelLayout,
  LevelModifier,
  LevelTier,
  ThemeId,
} from './types';

export interface ModifierInfo {
  name: string;
  description: string;
  color: string;
}

export const MODIFIERS: Record<LevelModifier, ModifierInfo> = {
  none: {
    name: 'Standard Arena',
    description: 'Classic arcade physics. Read the bounce.',
    color: '#9db4d0',
  },
  lowGravity: {
    name: 'Low Gravity',
    description: 'Orbs arc slower and hang in the air longer.',
    color: '#9d8bff',
  },
  turbulence: {
    name: 'Turbulence',
    description: 'Orbs drift faster across the arena.',
    color: '#59d9ff',
  },
  denseDrops: {
    name: 'Rich Drops',
    description: 'Destroyed orbs are more likely to drop pickups.',
    color: '#8effb0',
  },
  suddenSpeed: {
    name: 'Sudden Speed',
    description: 'Orbs gain extra pace when the clock drops below 15s.',
    color: '#ffb35c',
  },
};

export const LEVEL_TIER_LABEL: Record<LevelTier, string> = {
  basic: 'BASICS',
  rising: 'BUILDING',
  pressure: 'PRESSURE',
  advanced: 'ADVANCED',
  high: 'HIGH RISK',
  final: 'FINAL',
};

export const LEVEL_TIER_ROMAN: Record<LevelTier, string> = {
  basic: 'I',
  rising: 'II',
  pressure: 'III',
  advanced: 'IV',
  high: 'V',
  final: 'VI',
};

const rawLevels: Array<
  Omit<LevelConfig, 'id' | 'number'> & { number?: number; id?: string }
> = [
  {
    title: 'First Contact',
    subtitle: 'One orb. One tether. Every pop counts.',
    theme: 'training',
    tier: 'basic',
    timeLimit: 75,
    bubbleCount: 1,
    tierWeights: [100, 0, 0, 0],
    layout: 'scatter',
    speed: 0.82,
    pickupChance: 0.08,
    completionBonus: 300,
    modifier: 'none',
    seed: 1201,
    hint: 'Fire with SPACE. Each orb splits into two smaller orbs.',
  },
  {
    title: 'Twin Signal',
    subtitle: 'Two orbs, two heartbeats, one floor.',
    theme: 'training',
    tier: 'basic',
    timeLimit: 76,
    bubbleCount: 2,
    tierWeights: [100, 0, 0, 0],
    layout: 'twin',
    speed: 0.86,
    pickupChance: 0.08,
    completionBonus: 320,
    modifier: 'none',
    seed: 1202,
    hint: 'Move with the arrow keys. Small orbs are fast and dangerous.',
  },
  {
    title: 'Echo Chamber',
    subtitle: 'The first shards join the chorus.',
    theme: 'training',
    tier: 'basic',
    timeLimit: 72,
    bubbleCount: 2,
    tierWeights: [75, 25, 0, 0],
    layout: 'columns',
    speed: 0.9,
    pickupChance: 0.09,
    completionBonus: 360,
    modifier: 'none',
    seed: 1203,
    hint: 'Press 1–4 to change weapons without breaking your rhythm.',
  },
  {
    title: "Courier's Trial",
    subtitle: 'Read the bounce. Catch the drop.',
    theme: 'training',
    tier: 'basic',
    timeLimit: 70,
    bubbleCount: 3,
    tierWeights: [65, 35, 0, 0],
    layout: 'scatter',
    speed: 0.94,
    pickupChance: 0.12,
    completionBonus: 400,
    modifier: 'denseDrops',
    seed: 1204,
    hint: 'Pickups fall from destroyed orbs. Grab them before they fade.',
  },
  {
    title: 'Crystal Drift',
    subtitle: 'A slow drift through a brittle sky.',
    theme: 'crystal',
    tier: 'rising',
    timeLimit: 70,
    bubbleCount: 3,
    tierWeights: [55, 45, 0, 0],
    layout: 'arch',
    speed: 0.98,
    pickupChance: 0.08,
    completionBonus: 450,
    modifier: 'none',
    seed: 1205,
  },
  {
    title: 'Prism Rain',
    subtitle: 'Light bends. So does your aim.',
    theme: 'crystal',
    tier: 'rising',
    timeLimit: 68,
    bubbleCount: 4,
    tierWeights: [45, 45, 10, 0],
    layout: 'rain',
    speed: 1.0,
    pickupChance: 0.08,
    completionBonus: 500,
    modifier: 'lowGravity',
    seed: 1206,
  },
  {
    title: 'Shardfall',
    subtitle: 'What falls apart keeps falling.',
    theme: 'crystal',
    tier: 'rising',
    timeLimit: 66,
    bubbleCount: 4,
    tierWeights: [35, 45, 20, 0],
    layout: 'corners',
    speed: 1.04,
    pickupChance: 0.08,
    completionBonus: 550,
    modifier: 'none',
    seed: 1207,
  },
  {
    title: 'Refraction',
    subtitle: 'Three sizes, one clean line.',
    theme: 'crystal',
    tier: 'rising',
    timeLimit: 64,
    bubbleCount: 5,
    tierWeights: [30, 45, 15, 10],
    layout: 'zigzag',
    speed: 1.06,
    pickupChance: 0.08,
    completionBonus: 600,
    modifier: 'turbulence',
    seed: 1208,
  },
  {
    title: 'Pressure Valve',
    subtitle: 'The reactor wants a rhythm.',
    theme: 'reactor',
    tier: 'pressure',
    timeLimit: 66,
    bubbleCount: 4,
    tierWeights: [30, 45, 25, 0],
    layout: 'scatter',
    speed: 1.06,
    pickupChance: 0.07,
    completionBonus: 650,
    modifier: 'none',
    seed: 1209,
  },
  {
    title: 'Meltdown Lattice',
    subtitle: 'Hold the middle. Lose the floor.',
    theme: 'reactor',
    tier: 'pressure',
    timeLimit: 64,
    bubbleCount: 5,
    tierWeights: [20, 45, 30, 5],
    layout: 'columns',
    speed: 1.08,
    pickupChance: 0.07,
    completionBonus: 700,
    modifier: 'suddenSpeed',
    seed: 1210,
  },
  {
    title: 'Steam & Steel',
    subtitle: 'Hot pipes. Hotter orbs.',
    theme: 'reactor',
    tier: 'pressure',
    timeLimit: 62,
    bubbleCount: 5,
    tierWeights: [15, 45, 30, 10],
    layout: 'cluster',
    speed: 1.1,
    pickupChance: 0.07,
    completionBonus: 750,
    modifier: 'none',
    seed: 1211,
  },
  {
    title: 'Core Breach',
    subtitle: 'The containment field is a suggestion.',
    theme: 'reactor',
    tier: 'pressure',
    timeLimit: 60,
    bubbleCount: 6,
    tierWeights: [10, 40, 35, 15],
    layout: 'rain',
    speed: 1.12,
    pickupChance: 0.07,
    completionBonus: 800,
    modifier: 'lowGravity',
    seed: 1212,
  },
  {
    title: 'Overgrowth',
    subtitle: 'The garden has teeth now.',
    theme: 'garden',
    tier: 'advanced',
    timeLimit: 64,
    bubbleCount: 6,
    tierWeights: [15, 35, 35, 15],
    layout: 'zigzag',
    speed: 1.12,
    pickupChance: 0.07,
    completionBonus: 850,
    modifier: 'none',
    seed: 1213,
  },
  {
    title: 'Spore Bloom',
    subtitle: 'Pop one seed. Dodge the bloom.',
    theme: 'garden',
    tier: 'advanced',
    timeLimit: 62,
    bubbleCount: 7,
    tierWeights: [10, 35, 35, 20],
    layout: 'cluster',
    speed: 1.14,
    pickupChance: 0.09,
    completionBonus: 900,
    modifier: 'denseDrops',
    seed: 1214,
  },
  {
    title: 'Thornwild',
    subtitle: 'Vines at the walls. Orbs in the air.',
    theme: 'garden',
    tier: 'advanced',
    timeLimit: 60,
    bubbleCount: 7,
    tierWeights: [5, 35, 40, 20],
    layout: 'corners',
    speed: 1.16,
    pickupChance: 0.07,
    completionBonus: 950,
    modifier: 'turbulence',
    seed: 1215,
  },
  {
    title: 'Bloom Core',
    subtitle: 'A heartbeat in every branch.',
    theme: 'garden',
    tier: 'advanced',
    timeLimit: 58,
    bubbleCount: 8,
    tierWeights: [5, 30, 40, 25],
    layout: 'arch',
    speed: 1.18,
    pickupChance: 0.07,
    completionBonus: 1000,
    modifier: 'none',
    seed: 1216,
  },
  {
    title: 'Starfall',
    subtitle: 'No gravity. Only consequences.',
    theme: 'cosmic',
    tier: 'high',
    timeLimit: 56,
    bubbleCount: 8,
    tierWeights: [5, 30, 40, 25],
    layout: 'rain',
    speed: 1.18,
    pickupChance: 0.06,
    completionBonus: 1050,
    modifier: 'none',
    seed: 1217,
  },
  {
    title: 'Orbit Decay',
    subtitle: 'Everything drifts. Nothing waits.',
    theme: 'cosmic',
    tier: 'high',
    timeLimit: 54,
    bubbleCount: 9,
    tierWeights: [0, 30, 40, 30],
    layout: 'twin',
    speed: 1.2,
    pickupChance: 0.06,
    completionBonus: 1100,
    modifier: 'suddenSpeed',
    seed: 1218,
  },
  {
    title: 'Nebula Pressure',
    subtitle: 'The dark gets crowded.',
    theme: 'cosmic',
    tier: 'high',
    timeLimit: 52,
    bubbleCount: 9,
    tierWeights: [0, 25, 40, 35],
    layout: 'cluster',
    speed: 1.22,
    pickupChance: 0.06,
    completionBonus: 1150,
    modifier: 'lowGravity',
    seed: 1219,
  },
  {
    title: 'Event Horizon',
    subtitle: 'Past this line, the arena bites back.',
    theme: 'cosmic',
    tier: 'high',
    timeLimit: 50,
    bubbleCount: 10,
    tierWeights: [0, 25, 40, 35],
    layout: 'scatter',
    speed: 1.24,
    pickupChance: 0.06,
    completionBonus: 1200,
    modifier: 'turbulence',
    seed: 1220,
  },
  {
    title: 'Prismatic Rift',
    subtitle: 'Five colours. No second chances.',
    theme: 'crystal',
    tier: 'final',
    timeLimit: 55,
    bubbleCount: 10,
    tierWeights: [5, 25, 40, 30],
    layout: 'zigzag',
    speed: 1.24,
    pickupChance: 0.08,
    completionBonus: 1300,
    modifier: 'denseDrops',
    seed: 1221,
  },
  {
    title: 'Reactor Requiem',
    subtitle: "The old machine's final song.",
    theme: 'reactor',
    tier: 'final',
    timeLimit: 52,
    bubbleCount: 10,
    tierWeights: [5, 20, 40, 35],
    layout: 'columns',
    speed: 1.26,
    pickupChance: 0.07,
    completionBonus: 1400,
    modifier: 'suddenSpeed',
    seed: 1222,
  },
  {
    title: 'Garden of Echoes',
    subtitle: 'Every pop returns as a memory.',
    theme: 'garden',
    tier: 'final',
    timeLimit: 52,
    bubbleCount: 11,
    tierWeights: [0, 20, 40, 40],
    layout: 'arch',
    speed: 1.28,
    pickupChance: 0.07,
    completionBonus: 1500,
    modifier: 'turbulence',
    seed: 1223,
  },
  {
    title: 'The Orb Chaos Core',
    subtitle: 'Split. Dodge. Survive. One last time.',
    theme: 'cosmic',
    tier: 'final',
    timeLimit: 68,
    bubbleCount: 12,
    tierWeights: [0, 15, 40, 45],
    layout: 'cluster',
    speed: 1.3,
    pickupChance: 0.09,
    completionBonus: 3000,
    modifier: 'lowGravity',
    seed: 1224,
    hint: 'The containment core is open. Clear every last orb.',
  },
];

export const CAMPAIGN_LEVELS: LevelConfig[] = rawLevels.map((level, index) => ({
  ...level,
  number: index + 1,
  id: `L${String(index + 1).padStart(2, '0')}`,
}));

export function getLevel(index: number): LevelConfig {
  const safe = clamp(Math.floor(index), 0, CAMPAIGN_LEVELS.length - 1);
  return CAMPAIGN_LEVELS[safe];
}

export function getLevelByNumber(number: number): LevelConfig {
  return getLevel(number - 1);
}

export function levelIndexFromNumber(number: number): number {
  return clamp(Math.floor(number) - 1, 0, CAMPAIGN_LEVELS.length - 1);
}

export function isFinalLevel(index: number): boolean {
  return index >= CAMPAIGN_LEVEL_COUNT - 1;
}

export function scaleTimeForDifficulty(base: number, difficulty: Difficulty): number {
  const scaled = base * DIFFICULTY[difficulty].timeScale;
  return Math.max(20, Math.round(scaled / 5) * 5);
}

export function themeForWave(wave: number): ThemeId {
  return THEME_ORDER[(wave - 1) % THEME_ORDER.length];
}

const ENDLESS_CODENAMES = [
  'Static Bloom',
  'Fracture Tide',
  'Crystal Gale',
  'Ember Orbit',
  'Neon Canopy',
  'Hollow Current',
  'Shard Tempest',
  'Cosmic Verge',
];

export function makeEndlessLevel(waveNumber: number): LevelConfig {
  const wave = Math.max(1, Math.floor(waveNumber));
  const count = Math.min(13, 3 + Math.floor(wave * 0.8));
  const t0 = clamp(42 - wave * 4, 0, 42);
  const t1 = clamp(45 - wave, 10, 45);
  const t2 = clamp(12 + wave * 2, 15, 45);
  const t3 = clamp(2 + wave * 2, 2, 32);
  const layouts: LevelLayout[] = [
    'scatter',
    'columns',
    'arch',
    'corners',
    'cluster',
    'zigzag',
    'twin',
    'rain',
  ];
  const modifiers: LevelModifier[] = [
    'none',
    'none',
    'lowGravity',
    'none',
    'turbulence',
    'none',
    'suddenSpeed',
    'denseDrops',
  ];
  const tier: LevelTier = wave < 4 ? 'rising' : wave < 8 ? 'pressure' : wave < 14 ? 'high' : 'final';
  return {
    id: `ENDLESS-${String(wave).padStart(3, '0')}`,
    number: wave,
    title: ENDLESS_CODENAMES[(wave - 1) % ENDLESS_CODENAMES.length],
    subtitle: `Wave ${String(wave).padStart(2, '0')} · No end. Only the next surge.`,
    theme: themeForWave(wave),
    tier,
    timeLimit: clamp(Math.round((68 - wave * 1.9) / 5) * 5, 30, 68),
    bubbleCount: count,
    tierWeights: [t0, t1, t2, t3],
    layout: layouts[(wave - 1) % layouts.length],
    speed: Math.min(1.9, 1 + (wave - 1) * 0.045),
    pickupChance: Math.min(0.14, 0.08 + wave * 0.002),
    completionBonus: 120 + wave * 45,
    modifier: modifiers[(wave - 1) % modifiers.length],
    seed: 9000 + wave * 137,
  };
}

/* ------------------------------------------------------------------ */
/* Deterministic bubble layout                                         */
/* ------------------------------------------------------------------ */

interface LayoutContext {
  layout: LevelLayout;
  count: number;
  usableLeft: number;
  usableRight: number;
  anchors: Array<{ x: number; y: number }>;
  columns: number;
}

function createLayoutContext(layout: LevelLayout, count: number, rng: () => number): LayoutContext {
  const usableLeft = ARENA.left + 100;
  const usableRight = ARENA.right - 100;
  const anchors: Array<{ x: number; y: number }> = [];
  const anchorCount = layout === 'cluster' ? 3 : 0;
  for (let i = 0; i < anchorCount; i += 1) {
    anchors.push({
      x: randomRange(rng, usableLeft + 150, usableRight - 150),
      y: randomRange(rng, ARENA.top + 120, 330),
    });
  }
  return {
    layout,
    count,
    usableLeft,
    usableRight,
    anchors,
    columns: clamp(Math.ceil(Math.sqrt(count * 1.5)), 2, 5),
  };
}

function desiredPoint(
  ctx: LayoutContext,
  index: number,
  rng: () => number,
): { x: number; y: number } {
  const { layout, count, usableLeft, usableRight, anchors, columns } = ctx;
  const usableWidth = usableRight - usableLeft;
  const t = count <= 1 ? 0.5 : index / (count - 1);
  const jitterX = randomRange(rng, -34, 34);
  const jitterY = randomRange(rng, -22, 22);

  switch (layout) {
    case 'columns': {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = usableLeft + (columns === 1 ? usableWidth / 2 : (col / (columns - 1)) * usableWidth);
      return { x: x + jitterX, y: ARENA.top + 170 + row * 92 + jitterY };
    }
    case 'arch': {
      const x = usableLeft + t * usableWidth;
      const y = ARENA.top + 250 - Math.sin(Math.PI * t) * 120 + jitterY;
      return { x, y };
    }
    case 'corners': {
      const side = index % 2 === 0 ? usableLeft + 40 : usableRight - 40;
      const row = Math.floor(index / 2);
      return {
        x: side + randomRange(rng, -24, 24),
        y: ARENA.top + 170 + row * 85 + jitterY,
      };
    }
    case 'cluster': {
      const anchor = anchors[index % anchors.length] ?? {
        x: ARENA.width / 2,
        y: ARENA.top + 180,
      };
      return {
        x: clamp(anchor.x + randomRange(rng, -150, 150), usableLeft, usableRight),
        y: clamp(anchor.y + randomRange(rng, -80, 80), ARENA.top + 120, 400),
      };
    }
    case 'zigzag': {
      const side = index % 2 === 0 ? 0.18 : 0.82;
      const row = Math.floor(index / 2);
      return {
        x: usableLeft + side * usableWidth + jitterX * 0.6,
        y: ARENA.top + 160 + row * 86 + jitterY,
      };
    }
    case 'twin': {
      const side = index % 2 === 0 ? -1 : 1;
      const pair = Math.floor(index / 2);
      const offset = 110 + (pair % 3) * 110;
      return {
        x: ARENA.width / 2 + side * offset + jitterX * 0.4,
        y: ARENA.top + 160 + Math.floor(pair / 3) * 96 + jitterY,
      };
    }
    case 'rain': {
      const x = usableLeft + t * usableWidth;
      return { x, y: ARENA.top + 150 + (index % 3) * 58 + jitterY * 0.7 };
    }
    case 'scatter':
    default:
      return {
        x: randomRange(rng, usableLeft + 50, usableRight - 50),
        y: randomRange(rng, ARENA.top + 130, 410),
      };
  }
}

interface PlacementItem {
  tier: BubbleTier;
  desiredX: number;
  desiredY: number;
}

interface PlacedBubble {
  tier: BubbleTier;
  x: number;
  y: number;
}

function isPlacementValid(
  placed: PlacedBubble[],
  tier: BubbleTier,
  x: number,
  y: number,
  gap: number,
): boolean {
  const radius = BUBBLE_TIERS[tier].radius;
  if (x - radius < ARENA.left + 12 || x + radius > ARENA.right - 12) return false;
  if (y - radius < ARENA.top + 12 || y + radius > 446) return false;
  for (const other of placed) {
    const otherRadius = BUBBLE_TIERS[other.tier].radius;
    const minDist = radius + otherRadius + gap;
    if (distanceSquared(x, y, other.x, other.y) < minDist * minDist) return false;
  }
  // Never generate a bubble on top of either starting player.
  const coopXs = PLAYER.startCoopX;
  for (const px of [PLAYER.startSingleX, ...coopXs]) {
    if (distanceSquared(x, y, px, ARENA.floor - PLAYER.hitOffset) < (radius + 110) ** 2) {
      return false;
    }
  }
  return true;
}

/**
 * Generates validated, deterministic starting bubbles for a level. Large tiers
 * are placed first so smaller orbs naturally fill the gaps between them.
 */
export function generateBubbleSpawns(
  level: LevelConfig,
  speedScale = 1,
  spawnSeedOffset = 0,
): BubbleSpawn[] {
  const rng = mulberry32(level.seed + spawnSeedOffset * 7919);
  const count = clamp(Math.floor(level.bubbleCount), 1, 40);
  const context = createLayoutContext(level.layout, count, rng);

  const items: PlacementItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const tier = pickWeightedIndex(rng, level.tierWeights) as BubbleTier;
    const point = desiredPoint(context, i, rng);
    items.push({ tier, desiredX: point.x, desiredY: point.y });
  }
  // Larger bubbles go down first; this keeps the arena composition readable.
  items.sort((a, b) => b.tier - a.tier);

  const placed: PlacedBubble[] = [];
  for (const item of items) {
    const radius = BUBBLE_TIERS[item.tier].radius;
    let found = false;
    // Pass 1: honour the chosen layout with gentle jitter.
    for (let attempt = 0; attempt < 55 && !found; attempt += 1) {
      const jitterScale = attempt === 0 ? 0 : Math.min(1.6, 0.18 + attempt * 0.035);
      const x = clamp(
        item.desiredX + randomRange(rng, -160, 160) * jitterScale,
        ARENA.left + radius + 16,
        ARENA.right - radius - 16,
      );
      const y = clamp(
        item.desiredY + randomRange(rng, -90, 90) * jitterScale,
        ARENA.top + radius + 16,
        446 - radius,
      );
      if (isPlacementValid(placed, item.tier, x, y, 22)) {
        placed.push({ tier: item.tier, x, y });
        found = true;
      }
    }
    // Pass 2: scan a coarse grid. Guarantees a valid level even for dense sets.
    if (!found) {
      for (let gap = 22; gap >= 6 && !found; gap -= 8) {
        const stepX = 96;
        const stepY = 74;
        for (let y = ARENA.top + radius + 22; y <= 446 - radius && !found; y += stepY) {
          for (let x = ARENA.left + radius + 30; x <= ARENA.right - radius - 30; x += stepX) {
            if (isPlacementValid(placed, item.tier, x, y, gap)) {
              placed.push({ tier: item.tier, x, y });
              found = true;
              break;
            }
          }
        }
      }
    }
    // Extremely defensive fallback: place in the upper arena even if packed.
    if (!found) {
      placed.push({
        tier: item.tier,
        x: clamp(ARENA.width / 2 + (placed.length % 5) * 90 - 180, ARENA.left + radius, ARENA.right - radius),
        y: ARENA.top + radius + 30,
      });
    }
  }

  return placed.map((bubble, i) => {
    const tierSpec = BUBBLE_TIERS[bubble.tier];
    const direction = i % 2 === 0 ? -1 : 1;
    const speed = tierSpec.speed * speedScale * randomRange(rng, 0.72, 1.08);
    const vy = -(randomRange(rng, 90, 220) + bubble.tier * 10);
    return {
      tier: bubble.tier,
      x: bubble.x,
      y: bubble.y,
      vx: direction * speed,
      vy,
    };
  });
}

export interface SpawnValidationIssue {
  index: number;
  reason: string;
}

/** Used by tests and the debug overlay to prove a level configuration is sane. */
export function validateBubbleSpawns(
  spawns: BubbleSpawn[],
  expectedCount?: number,
): SpawnValidationIssue[] {
  const issues: SpawnValidationIssue[] = [];
  if (expectedCount !== undefined && spawns.length !== expectedCount) {
    issues.push({ index: -1, reason: `expected ${expectedCount} spawns, got ${spawns.length}` });
  }
  spawns.forEach((spawn, i) => {
    const radius = BUBBLE_TIERS[spawn.tier].radius;
    if (spawn.x - radius < ARENA.left || spawn.x + radius > ARENA.right) {
      issues.push({ index: i, reason: 'outside arena walls' });
    }
    if (spawn.y - radius < ARENA.top || spawn.y + radius > ARENA.floor) {
      issues.push({ index: i, reason: 'outside arena vertically' });
    }
    if (spawn.y + radius > 470) {
      issues.push({ index: i, reason: 'spawned too close to the floor' });
    }
    for (let j = 0; j < i; j += 1) {
      const other = spawns[j];
      const otherRadius = BUBBLE_TIERS[other.tier].radius;
      const min = radius + otherRadius + 4;
      if (distanceSquared(spawn.x, spawn.y, other.x, other.y) < min * min) {
        issues.push({ index: i, reason: `overlaps bubble ${j}` });
      }
    }
    for (const px of [PLAYER.startSingleX, ...PLAYER.startCoopX]) {
      const dx = spawn.x - px;
      const dy = spawn.y - (ARENA.floor - PLAYER.hitOffset);
      if (Math.sqrt(dx * dx + dy * dy) < radius + 90) {
        issues.push({ index: i, reason: 'spawned on a player start' });
      }
    }
  });
  return issues;
}

export function levelThemeName(level: LevelConfig): string {
  return THEMES[level.theme]?.name ?? 'Unknown Arena';
}
