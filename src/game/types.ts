/**
 * POPBOUND: ORB CHAOS — shared domain types.
 *
 * Everything here is renderer-agnostic and React-agnostic. The engine, the
 * persistence layer, the Canvas renderer and the UI all speak these types.
 */

export type GameMode = 'campaign' | 'coop' | 'endless';

export type GameState =
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'TIME_UP'
  | 'WAVE_COMPLETE'
  | 'LEVEL_COMPLETE'
  | 'GAME_OVER'
  | 'CAMPAIGN_COMPLETE';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type ThemeId = 'training' | 'crystal' | 'reactor' | 'garden' | 'cosmic';

export type WeaponId = 'pulse' | 'web' | 'prism' | 'mine';

export type PickupType = 'dual' | 'shield' | 'freeze' | 'time' | 'life' | 'crystal';

export type BubbleTier = 0 | 1 | 2 | 3;

export type LevelModifier = 'none' | 'lowGravity' | 'turbulence' | 'denseDrops' | 'suddenSpeed';

export type LevelLayout =
  | 'scatter'
  | 'columns'
  | 'arch'
  | 'corners'
  | 'cluster'
  | 'zigzag'
  | 'twin'
  | 'rain';

export type LevelTier = 'basic' | 'rising' | 'pressure' | 'advanced' | 'high' | 'final';

export type TouchControlsMode = 'auto' | 'always' | 'never';

export interface ArenaBounds {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  floor: number;
}

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

export interface LevelConfig {
  id: string;
  /** 1-based level number. */
  number: number;
  title: string;
  subtitle: string;
  theme: ThemeId;
  tier: LevelTier;
  /** Baseline seconds before difficulty scaling. */
  timeLimit: number;
  /** Number of bubbles present at level start. */
  bubbleCount: number;
  /** Relative weights for starting bubble tiers 0..3. */
  tierWeights: [number, number, number, number];
  layout: LevelLayout;
  /** Global bubble speed multiplier for this level. */
  speed: number;
  /** Probability that a destroyed bubble drops a pickup. */
  pickupChance: number;
  completionBonus: number;
  modifier: LevelModifier;
  /** Deterministic spawn seed. */
  seed: number;
  hint?: string;
}

export interface BubbleTierSpec {
  radius: number;
  /** Base horizontal speed in px/s. */
  speed: number;
  /** Minimum speed imparted by a floor bounce. */
  floorBounce: number;
  points: number;
  label: string;
}

export interface SplitResult {
  childTiers: BubbleTier[];
  points: number;
}

export interface WeaponConfig {
  id: WeaponId;
  name: string;
  shortName: string;
  description: string;
  cooldown: number;
  color: string;
  glow: string;
  /** Optional duration for persistent effects. */
  duration?: number;
}

export interface PickupConfig {
  type: PickupType;
  name: string;
  shortName: string;
  description: string;
  color: string;
  glow: string;
  points: number;
}

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */

export interface Bubble {
  id: number;
  tier: BubbleTier;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  variant: number;
  wobble: number;
  wobbleSpeed: number;
  spin: number;
  spinSpeed: number;
  squash: number;
  /** Seconds of hit immunity after spawning (prevents chain/duplicate hits). */
  spawnGuard: number;
  /** Cosmetic pulse driven by the engine clock. */
  age: number;
}

export interface Player {
  index: number;
  x: number;
  /** Feet position. */
  y: number;
  vx: number;
  facing: 1 | -1;
  lives: number;
  maxLives: number;
  score: number;
  weapon: WeaponId;
  cooldowns: Record<WeaponId, number>;
  invuln: number;
  shield: number;
  dualTimer: number;
  eliminated: boolean;
  hitTimer: number;
  respawnTimer: number;
  fireAnim: number;
  walkPhase: number;
  idlePhase: number;
  flash: number;
  muzzle: number;
  lastSafeX: number;
}

export type WeaponEffectPhase = 'extend' | 'hold' | 'fade' | 'done';

export interface WeaponEffect {
  id: number;
  owner: number;
  weapon: WeaponId;
  x: number;
  /** Y of the emitter. */
  baseY: number;
  /** Current tip Y (pulses) or ceiling Y for full-height beams. */
  tipY: number;
  /** Maximum upward reach. */
  maxY: number;
  age: number;
  /** Remaining lifetime while holding / fading. */
  hold: number;
  phase: WeaponEffectPhase;
  width: number;
  /** Bubbles already resolved by this effect instance. */
  hitIds: Set<number>;
  hitFlash: number;
  seed: number;
}

export interface Mine {
  id: number;
  owner: number;
  x: number;
  y: number;
  radius: number;
  arm: number;
  life: number;
  age: number;
  /** 0 while arming, 1 once active, 2 while detonating. */
  phase: 0 | 1 | 2;
  blast: number;
  seed: number;
}

export interface Pickup {
  id: number;
  type: PickupType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  ttl: number;
  grounded: boolean;
  phase: number;
}

export type ParticleKind = 'dot' | 'spark' | 'ring' | 'shard' | 'star';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  kind: ParticleKind;
  rotation: number;
  spin: number;
}

export interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
  vy: number;
}

export interface BubbleSpawn {
  tier: BubbleTier;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/* ------------------------------------------------------------------ */
/* Settings, input and persistence                                     */
/* ------------------------------------------------------------------ */

export interface Settings {
  soundOn: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  difficulty: Difficulty;
  screenShake: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  touchControls: TouchControlsMode;
  debug: boolean;
}

export interface PlayerBindings {
  left: string;
  right: string;
  fire: string;
  weapons: [string, string, string, string];
}

export interface KeyBindings {
  p1: PlayerBindings;
  p2: PlayerBindings;
}

export type BindableAction =
  | 'left'
  | 'right'
  | 'fire'
  | 'weapon1'
  | 'weapon2'
  | 'weapon3'
  | 'weapon4';

export interface RunStats {
  pops: number;
  splits: number;
  pickups: number;
  damageTaken: number;
  levelsCleared: number;
  wavesCleared: number;
}

export interface LastRunRecord {
  mode: GameMode;
  score: number;
  level: number;
  wave: number;
  at: string;
}

export interface SaveStats {
  totalPops: number;
  totalPickups: number;
  totalRuns: number;
  totalLevelClears: number;
  totalWaves: number;
  bestEndlessWave: number;
}

export interface SaveData {
  version: 1;
  highestUnlocked: number;
  completedLevels: number[];
  levelBestScores: Record<string, number>;
  bestCampaignScore: number;
  bestCoopScore: number;
  bestEndlessScore: number;
  bestEndlessWave: number;
  campaignCompleted: boolean;
  coopCampaignCompleted: boolean;
  stats: SaveStats;
  settings: Settings;
  bindings: KeyBindings;
  lastRun: LastRunRecord | null;
}

/* ------------------------------------------------------------------ */
/* Run / completion records (the engine reports, UI persists)           */
/* ------------------------------------------------------------------ */

export interface CompletionRecord {
  mode: GameMode;
  levelIndex: number;
  levelNumber: number;
  levelId: string;
  levelTitle: string;
  playerScores: number[];
  playerLives: number[];
  levelBaseScores: number[];
  timeBonus: number;
  completionBonus: number;
  bonusPerPlayer: number;
  levelTotal: number;
  teamScore: number;
  remainingTime: number;
  pops: number;
  isFinalLevel: boolean;
}

export interface WaveRecord {
  mode: 'endless';
  wave: number;
  levelBaseScore: number;
  timeBonus: number;
  waveBonus: number;
  totalScore: number;
  remainingTime: number;
}

export interface RunRecord {
  mode: GameMode;
  finalScore: number;
  levelsCompleted: number;
  levelNumber: number;
  wave: number;
  stats: RunStats;
  reason: 'eliminated' | 'timeout';
}

export interface CampaignRecord {
  mode: GameMode;
  finalScore: number;
  playerScores: number[];
  stats: RunStats;
}

export type EngineEvent =
  | { type: 'level-complete'; record: CompletionRecord }
  | { type: 'wave-complete'; record: WaveRecord }
  | { type: 'campaign-complete'; record: CampaignRecord }
  | { type: 'game-over'; record: RunRecord }
  | { type: 'state-change'; state: GameState };

/* ------------------------------------------------------------------ */
/* HUD snapshot                                                        */
/* ------------------------------------------------------------------ */

export interface ActiveEffectHud {
  key: string;
  type: PickupType | 'freeze';
  label: string;
  color: string;
  remaining: number;
  player: number | 'all';
}

export interface PlayerHud {
  index: number;
  score: number;
  lives: number;
  maxLives: number;
  weapon: WeaponId;
  cooldownRemaining: number;
  cooldownTotal: number;
  cooldownRatio: number;
  shield: number;
  dualTimer: number;
  invuln: number;
  eliminated: boolean;
}

export interface HudSnapshot {
  state: GameState;
  mode: GameMode;
  difficulty: Difficulty;
  levelNumber: number;
  levelTitle: string;
  levelSubtitle: string;
  levelTotal: number;
  levelHint: string | null;
  modifier: LevelModifier;
  theme: ThemeId;
  timeRemaining: number;
  timeLimit: number;
  timeCritical: boolean;
  readyTimer: number;
  stateTimer: number;
  wave: number;
  players: PlayerHud[];
  effects: ActiveEffectHud[];
  bubbleCount: number;
  teamScore: number;
  freezeRemaining: number;
  completion: CompletionRecord | null;
  runResult: RunRecord | null;
  campaignResult: CampaignRecord | null;
  timeUpLosses: number[];
  lastWave: WaveRecord | null;
  version: number;
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

export type SoundId =
  | 'click'
  | 'hover'
  | 'fire-pulse'
  | 'fire-web'
  | 'fire-prism'
  | 'fire-mine'
  | 'split'
  | 'pop-small'
  | 'pickup'
  | 'pickup-life'
  | 'hurt'
  | 'shield'
  | 'countdown'
  | 'level-complete'
  | 'wave-complete'
  | 'game-over'
  | 'freeze'
  | 'time'
  | 'unlock';

export interface AudioBus {
  unlock(): void;
  play(sound: SoundId, variant?: number): void;
  setPaused(paused: boolean): void;
  setMusicIntensity(intensity: number): void;
  dispose(): void;
}

/** No-op audio used by the engine in tests and as a safety fallback. */
export const SILENT_AUDIO: AudioBus = {
  unlock() {},
  play() {},
  setPaused() {},
  setMusicIntensity() {},
  dispose() {},
};
