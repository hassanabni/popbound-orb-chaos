import { CAMPAIGN_LEVEL_COUNT, DEFAULT_BINDINGS, DEFAULT_SETTINGS } from './constants';
import type {
  CampaignRecord,
  CompletionRecord,
  Difficulty,
  GameMode,
  KeyBindings,
  PlayerBindings,
  RunRecord,
  SaveData,
  Settings,
  TouchControlsMode,
} from './types';

export const SAVE_KEY = 'popbound.orbchaos.save.v1';
export const SAVE_VERSION = 1 as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function clone<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

export function detectStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    const storage = window.localStorage;
    // A real availability probe: Safari private mode historically threw here.
    const probe = '__popbound_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function defaultSettings(): Settings {
  return clone(DEFAULT_SETTINGS);
}

export function defaultBindings(): KeyBindings {
  return clone(DEFAULT_BINDINGS);
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    highestUnlocked: 1,
    completedLevels: [],
    levelBestScores: {},
    bestCampaignScore: 0,
    bestCoopScore: 0,
    bestEndlessScore: 0,
    bestEndlessWave: 0,
    campaignCompleted: false,
    coopCampaignCompleted: false,
    stats: {
      totalPops: 0,
      totalPickups: 0,
      totalRuns: 0,
      totalLevelClears: 0,
      totalWaves: 0,
      bestEndlessWave: 0,
    },
    settings: defaultSettings(),
    bindings: defaultBindings(),
    lastRun: null,
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeNumber(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function safeInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = safeNumber(value, fallback, min, max);
  return Math.round(n);
}

function safeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 && value.length <= 60 ? value : fallback;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
const TOUCH_MODES: TouchControlsMode[] = ['auto', 'always', 'never'];
const MODES: GameMode[] = ['campaign', 'coop', 'endless'];

export function sanitizeSettings(raw: unknown): Settings {
  const defaults = defaultSettings();
  if (!isRecord(raw)) return defaults;
  return {
    soundOn: safeBool(raw.soundOn, defaults.soundOn),
    masterVolume: safeNumber(raw.masterVolume, defaults.masterVolume, 0, 1),
    sfxVolume: safeNumber(raw.sfxVolume, defaults.sfxVolume, 0, 1),
    musicVolume: safeNumber(raw.musicVolume, defaults.musicVolume, 0, 1),
    difficulty: DIFFICULTIES.includes(raw.difficulty as Difficulty)
      ? (raw.difficulty as Difficulty)
      : defaults.difficulty,
    screenShake: safeBool(raw.screenShake, defaults.screenShake),
    reducedMotion: safeBool(raw.reducedMotion, defaults.reducedMotion),
    highContrast: safeBool(raw.highContrast, defaults.highContrast),
    touchControls: TOUCH_MODES.includes(raw.touchControls as TouchControlsMode)
      ? (raw.touchControls as TouchControlsMode)
      : defaults.touchControls,
    debug: safeBool(raw.debug, defaults.debug),
  };
}

function sanitizePlayerBindings(raw: unknown, fallback: PlayerBindings): PlayerBindings {
  if (!isRecord(raw)) return clone(fallback);
  const weaponRaw = Array.isArray(raw.weapons) ? raw.weapons : fallback.weapons;
  return {
    left: safeString(raw.left, fallback.left),
    right: safeString(raw.right, fallback.right),
    fire: safeString(raw.fire, fallback.fire),
    weapons: [
      safeString(weaponRaw[0], fallback.weapons[0]),
      safeString(weaponRaw[1], fallback.weapons[1]),
      safeString(weaponRaw[2], fallback.weapons[2]),
      safeString(weaponRaw[3], fallback.weapons[3]),
    ],
  };
}

export function sanitizeBindings(raw: unknown): KeyBindings {
  const fallback = defaultBindings();
  if (!isRecord(raw)) return fallback;
  return {
    p1: sanitizePlayerBindings(raw.p1, fallback.p1),
    p2: sanitizePlayerBindings(raw.p2, fallback.p2),
  };
}

function sanitizeCompletion(raw: unknown): SaveData['completedLevels'] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<number>();
  for (const n of raw) {
    if (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= CAMPAIGN_LEVEL_COUNT) {
      set.add(n);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

function sanitizeLevelBestScores(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {};
  const out: Record<string, number> = {};
  for (let n = 1; n <= CAMPAIGN_LEVEL_COUNT; n += 1) {
    const value = raw[String(n)];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      out[String(n)] = Math.min(Math.round(value), 99_999_999);
    }
  }
  return out;
}

function sanitizeLastRun(raw: unknown): SaveData['lastRun'] {
  if (!isRecord(raw)) return null;
  if (!MODES.includes(raw.mode as GameMode)) return null;
  const at = typeof raw.at === 'string' && !Number.isNaN(Date.parse(raw.at)) ? raw.at : new Date(0).toISOString();
  return {
    mode: raw.mode as GameMode,
    score: safeInt(raw.score, 0, 0, 99_999_999),
    level: safeInt(raw.level, 1, 1, CAMPAIGN_LEVEL_COUNT),
    wave: safeInt(raw.wave, 0, 0, 1_000_000),
    at,
  };
}

export function sanitizeSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isRecord(raw)) return base;
  if (raw.version !== SAVE_VERSION) return base;

  const completedLevels = sanitizeCompletion(raw.completedLevels);
  let highestUnlocked = safeInt(raw.highestUnlocked, 1, 1, CAMPAIGN_LEVEL_COUNT);
  // Loading must never reduce legitimate progression, and a completed level
  // implies the following level was unlocked (except the final level).
  if (completedLevels.length > 0) {
    const maxCompleted = Math.max(...completedLevels);
    highestUnlocked = Math.max(highestUnlocked, Math.min(CAMPAIGN_LEVEL_COUNT, maxCompleted + 1));
  }

  const statsRaw = isRecord(raw.stats) ? raw.stats : {};
  const bestEndlessWave = safeInt(raw.bestEndlessWave, 0, 0, 1_000_000);

  return {
    version: SAVE_VERSION,
    highestUnlocked,
    completedLevels,
    levelBestScores: sanitizeLevelBestScores(raw.levelBestScores),
    bestCampaignScore: safeInt(raw.bestCampaignScore, 0, 0, 99_999_999),
    bestCoopScore: safeInt(raw.bestCoopScore, 0, 0, 99_999_999),
    bestEndlessScore: safeInt(raw.bestEndlessScore, 0, 0, 99_999_999),
    bestEndlessWave,
    campaignCompleted: safeBool(raw.campaignCompleted, false),
    coopCampaignCompleted: safeBool(raw.coopCampaignCompleted, false),
    stats: {
      totalPops: safeInt(statsRaw.totalPops, 0, 0, 99_999_999),
      totalPickups: safeInt(statsRaw.totalPickups, 0, 0, 99_999_999),
      totalRuns: safeInt(statsRaw.totalRuns, 0, 0, 1_000_000),
      totalLevelClears: safeInt(statsRaw.totalLevelClears, 0, 0, 1_000_000),
      totalWaves: safeInt(statsRaw.totalWaves, 0, 0, 1_000_000),
      bestEndlessWave: safeInt(statsRaw.bestEndlessWave, bestEndlessWave, 0, 1_000_000),
    },
    settings: sanitizeSettings(raw.settings),
    bindings: sanitizeBindings(raw.bindings),
    lastRun: sanitizeLastRun(raw.lastRun),
  };
}

/* ------------------------------------------------------------------ */
/* Load / persist                                                      */
/* ------------------------------------------------------------------ */

export function loadSave(storage: StorageLike | null = detectStorage()): SaveData {
  if (!storage) return defaultSave();
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed: unknown = JSON.parse(raw);
    return sanitizeSave(parsed);
  } catch {
    return defaultSave();
  }
}

export function persistSave(
  save: SaveData,
  storage: StorageLike | null = detectStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike | null = detectStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // ignore storage access failures
  }
}

export function resetProgression(save: SaveData): SaveData {
  // Volumes, accessibility toggles and key bindings survive a progress reset.
  return {
    ...defaultSave(),
    settings: sanitizeSettings(save.settings),
    bindings: sanitizeBindings(save.bindings),
  };
}

/* ------------------------------------------------------------------ */
/* Progression updates                                                 */
/* ------------------------------------------------------------------ */

export interface LevelCompletionMeta {
  newLevelBest: boolean;
  newCampaignBest: boolean;
  unlockedLevel: number | null;
  bestAfter: number;
}

export interface LevelCompletionUpdate {
  save: SaveData;
  meta: LevelCompletionMeta;
}

export function applyLevelCompletion(
  previous: SaveData,
  record: CompletionRecord,
): LevelCompletionUpdate {
  const save = clone(previous);
  const novelLevel = !save.completedLevels.includes(record.levelNumber);
  if (novelLevel) {
    save.completedLevels.push(record.levelNumber);
    save.completedLevels.sort((a, b) => a - b);
  }

  const previousHighest = save.highestUnlocked;
  if (record.levelNumber < CAMPAIGN_LEVEL_COUNT) {
    save.highestUnlocked = Math.max(
      save.highestUnlocked,
      Math.min(CAMPAIGN_LEVEL_COUNT, record.levelNumber + 1),
    );
  } else {
    save.highestUnlocked = CAMPAIGN_LEVEL_COUNT;
  }

  const previousLevelBest = save.levelBestScores[String(record.levelNumber)] ?? 0;
  let newLevelBest = false;
  if (record.mode === 'campaign' && record.levelTotal > previousLevelBest) {
    save.levelBestScores[String(record.levelNumber)] = record.levelTotal;
    newLevelBest = record.levelTotal > previousLevelBest && previousLevelBest > 0;
    if (previousLevelBest === 0) newLevelBest = true;
  }

  let newCampaignBest = false;
  // On the final level the campaign-complete event immediately follows and owns
  // the final record update. This keeps the "new best" badge accurate for the
  // victory screen instead of consuming it on the hidden level-clear overlay.
  if (!record.isFinalLevel) {
    if (record.mode === 'campaign') {
      if (record.teamScore > save.bestCampaignScore) {
        save.bestCampaignScore = record.teamScore;
        newCampaignBest = true;
      }
    } else if (record.mode === 'coop') {
      if (record.teamScore > save.bestCoopScore) {
        save.bestCoopScore = record.teamScore;
        newCampaignBest = true;
      }
    }
  }

  if (record.isFinalLevel) {
    if (record.mode === 'coop') save.coopCampaignCompleted = true;
    else save.campaignCompleted = true;
    save.highestUnlocked = CAMPAIGN_LEVEL_COUNT;
  }

  save.stats.totalLevelClears += 1;

  const unlockedLevel =
    save.highestUnlocked > previousHighest && record.levelNumber < CAMPAIGN_LEVEL_COUNT
      ? save.highestUnlocked
      : null;

  return {
    save,
    meta: {
      newLevelBest,
      newCampaignBest,
      unlockedLevel,
      bestAfter:
        record.mode === 'coop'
          ? save.bestCoopScore
          : record.mode === 'campaign'
            ? save.bestCampaignScore
            : save.bestEndlessScore,
    },
  };
}

export interface RunEndMeta {
  newBest: boolean;
  bestScore: number;
}

export function applyRunEnd(
  previous: SaveData,
  record: RunRecord,
): { save: SaveData; meta: RunEndMeta } {
  const save = clone(previous);
  let newBest = false;
  let bestScore = 0;
  if (record.mode === 'endless') {
    if (record.finalScore > save.bestEndlessScore) {
      save.bestEndlessScore = record.finalScore;
      newBest = true;
    }
    save.bestEndlessWave = Math.max(save.bestEndlessWave, record.wave);
    save.stats.bestEndlessWave = Math.max(save.stats.bestEndlessWave, record.wave);
    save.stats.totalWaves += record.stats.wavesCleared;
    bestScore = save.bestEndlessScore;
  } else if (record.mode === 'campaign') {
    bestScore = save.bestCampaignScore;
  } else {
    bestScore = save.bestCoopScore;
  }
  save.stats.totalRuns += 1;
  save.stats.totalPops += Math.max(0, Math.round(record.stats.pops));
  save.stats.totalPickups += Math.max(0, Math.round(record.stats.pickups));
  save.lastRun = {
    mode: record.mode,
    score: record.finalScore,
    level: Math.max(1, record.levelNumber),
    wave: record.wave,
    at: new Date().toISOString(),
  };
  return { save, meta: { newBest, bestScore } };
}

export interface CampaignUpdateResult {
  save: SaveData;
  meta: { newBest: boolean };
}

export function applyCampaignComplete(
  previous: SaveData,
  record: CampaignRecord,
): CampaignUpdateResult {
  const save = clone(previous);
  let newBest = false;
  if (record.mode === 'campaign') {
    save.campaignCompleted = true;
    if (record.finalScore > save.bestCampaignScore) {
      save.bestCampaignScore = record.finalScore;
      newBest = true;
    }
  } else if (record.mode === 'coop') {
    save.coopCampaignCompleted = true;
    if (record.finalScore > save.bestCoopScore) {
      save.bestCoopScore = record.finalScore;
      newBest = true;
    }
  }
  save.highestUnlocked = CAMPAIGN_LEVEL_COUNT;
  save.stats.totalRuns += 1;
  save.stats.totalPops += Math.max(0, Math.round(record.stats.pops));
  save.stats.totalPickups += Math.max(0, Math.round(record.stats.pickups));
  save.lastRun = {
    mode: record.mode,
    score: record.finalScore,
    level: CAMPAIGN_LEVEL_COUNT,
    wave: 0,
    at: new Date().toISOString(),
  };
  return {
    save,
    meta: {
      newBest,
    },
  };
}
