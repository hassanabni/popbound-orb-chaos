import type {
  ArenaBounds,
  BubbleTierSpec,
  Difficulty,
  KeyBindings,
  Settings,
} from './types';

/** The logical playfield. Everything in the engine uses these coordinates. */
export const ARENA: ArenaBounds = {
  width: 1280,
  height: 720,
  left: 46,
  right: 1234,
  top: 108,
  floor: 652,
};

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = 0.05;
export const MAX_SUBSTEPS = 8;

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

export const PLAYER = {
  radius: 26,
  hitOffset: 38,
  halfWidth: 24,
  maxSpeed: 475,
  acceleration: 3600,
  friction: 3100,
  startSingleX: 640,
  startCoopX: [462, 818] as [number, number],
  invulnTime: 2.2,
  shieldInvulnTime: 1.1,
  respawnTime: 0.55,
  maxLivesBonus: 2,
} as const;

export const DIFFICULTY: Record<
  Difficulty,
  {
    lives: number;
    timeScale: number;
    speedScale: number;
    pickupScale: number;
    label: string;
    blurb: string;
  }
> = {
  easy: {
    lives: 4,
    timeScale: 1.2,
    speedScale: 0.85,
    pickupScale: 1.25,
    label: 'Easy',
    blurb: 'Extra lives, slower orbs, longer timers.',
  },
  normal: {
    lives: 3,
    timeScale: 1,
    speedScale: 1,
    pickupScale: 1,
    label: 'Normal',
    blurb: 'The intended arcade experience.',
  },
  hard: {
    lives: 2,
    timeScale: 0.9,
    speedScale: 1.14,
    pickupScale: 0.8,
    label: 'Hard',
    blurb: 'Two lives, faster orbs, tighter clocks.',
  },
};

/* ------------------------------------------------------------------ */
/* Bubbles                                                             */
/* ------------------------------------------------------------------ */

export const BUBBLE_TIERS: readonly BubbleTierSpec[] = [
  { radius: 58, speed: 86, floorBounce: 870, points: 10, label: 'Grand Orb' },
  { radius: 39, speed: 132, floorBounce: 820, points: 20, label: 'Split Orb' },
  { radius: 26, speed: 188, floorBounce: 760, points: 35, label: 'Shard Orb' },
  { radius: 16, speed: 252, floorBounce: 700, points: 60, label: 'Spark Orb' },
];

export const BUBBLE_PHYSICS = {
  gravity: 960,
  wallRestitution: 0.985,
  floorRestitution: 0.96,
  ceilingRestitution: 0.58,
  maxVy: 1500,
  spawnGuard: 0.16,
} as const;

export const BUBBLE_LIMITS = {
  maxParticles: 340,
  maxPickups: 3,
  pickupDropCooldown: 1.15,
  maxBubbles: 120,
} as const;

/* ------------------------------------------------------------------ */
/* Scoring / timing                                                    */
/* ------------------------------------------------------------------ */

export const TIME_BONUS_PER_SECOND = 10;
export const TIME_CRITICAL = 10;
export const READY_TIME = 1.45;
export const TIME_UP_OVERLAY = 2.1;
export const WAVE_TRANSITION_TIME = 2.1;
export const HUD_REFRESH = 0.1;
export const CAMPAIGN_LEVEL_COUNT = 24;

/* ------------------------------------------------------------------ */
/* Pickups                                                             */
/* ------------------------------------------------------------------ */

export const PICKUP_PHYSICS = {
  gravity: 900,
  restitution: 0.46,
  radius: 19,
  ttl: 13,
  dualDuration: 11,
  freezeDuration: 5.5,
  timeBonus: 10,
  scoreCrystal: 150,
} as const;

/* ------------------------------------------------------------------ */
/* Weapons                                                             */
/* ------------------------------------------------------------------ */

export const WEAPON_PHYSICS = {
  pulseSpeed: 2900,
  pulseHold: 0.16,
  webDuration: 3.1,
  prismDuration: 0.22,
  prismHalfWidth: 25,
  mineArm: 0.75,
  mineLife: 6.5,
  mineRadius: 80,
  mineBlastTime: 0.35,
  dualOffset: 27,
  maxMinesPerPlayer: 2,
} as const;

export const MINE_POSITION = {
  yOffset: 12,
} as const;

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

export const DEFAULT_SETTINGS: Settings = {
  soundOn: true,
  masterVolume: 0.8,
  sfxVolume: 0.75,
  musicVolume: 0.34,
  difficulty: 'normal',
  screenShake: true,
  reducedMotion: false,
  highContrast: false,
  touchControls: 'auto',
  debug: false,
};

export const DEFAULT_BINDINGS: KeyBindings = {
  p1: {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    fire: 'Space',
    weapons: ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
  },
  p2: {
    left: 'KeyA',
    right: 'KeyD',
    fire: 'KeyQ',
    weapons: ['Digit7', 'Digit8', 'Digit9', 'Digit0'],
  },
};

/** Codes that must never be assigned to movement/weapon actions. */
export const RESERVED_KEYS = new Set(['Escape', 'KeyP', 'F5', 'F11', 'Tab']);

export const KEY_LABELS: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'SPACE',
  ShiftLeft: 'L-SHIFT',
  ShiftRight: 'R-SHIFT',
  ControlLeft: 'L-CTRL',
  ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT',
  AltRight: 'R-ALT',
  Enter: 'ENTER',
  Backspace: 'BKSP',
};

export function keyLabel(code: string): string {
  if (!code) return '—';
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  if (code.startsWith('Arrow')) return code.slice(5).toUpperCase();
  return code.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
}
