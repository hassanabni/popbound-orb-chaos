import { describe, expect, it } from 'vitest';
import {
  applyCampaignComplete,
  applyLevelCompletion,
  applyRunEnd,
  defaultBindings,
  defaultSave,
  defaultSettings,
  loadSave,
  persistSave,
  resetProgression,
  sanitizeBindings,
  sanitizeSave,
  sanitizeSettings,
  SAVE_KEY,
  type StorageLike,
} from '../src/game/storage';
import type {
  CampaignRecord,
  CompletionRecord,
  RunRecord,
  SaveData,
} from '../src/game/types';

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

function completion(
  levelNumber: number,
  teamScore: number,
  levelTotal = 500,
  options: Partial<CompletionRecord> = {},
): CompletionRecord {
  return {
    mode: 'campaign',
    levelIndex: levelNumber - 1,
    levelNumber,
    levelId: `L${String(levelNumber).padStart(2, '0')}`,
    levelTitle: `Level ${levelNumber}`,
    playerScores: [teamScore],
    playerLives: [3],
    levelBaseScores: [levelTotal - 200],
    timeBonus: 100,
    completionBonus: 100,
    bonusPerPlayer: 200,
    levelTotal,
    teamScore,
    remainingTime: 10,
    pops: 20,
    isFinalLevel: levelNumber === 24,
    ...options,
  };
}

describe('saved campaign progression', () => {
  it('unlocks levels, records level bests and persists scores', () => {
    const storage = new FakeStorage();
    const save = defaultSave();
    const first = applyLevelCompletion(save, completion(1, 1200, 800));

    expect(first.save.highestUnlocked).toBe(2);
    expect(first.save.completedLevels).toEqual([1]);
    expect(first.save.levelBestScores['1']).toBe(800);
    expect(first.save.bestCampaignScore).toBe(1200);
    expect(first.meta.unlockedLevel).toBe(2);
    expect(first.meta.newLevelBest).toBe(true);
    expect(first.meta.newCampaignBest).toBe(true);
    // Lifetime pop count is booked once at the end of a run, not per level, so
    // it cannot double-count when a campaign eventually ends.
    expect(first.save.stats.totalLevelClears).toBe(1);
    expect(first.save.stats.totalPops).toBe(0);

    persistSave(first.save, storage);
    const loaded = loadSave(storage);
    expect(loaded.highestUnlocked).toBe(2);
    expect(loaded.levelBestScores['1']).toBe(800);
    expect(loaded.bestCampaignScore).toBe(1200);
    expect(loaded.completedLevels).toContain(1);
  });

  it('never lowers the highest unlocked level when replaying earlier arenas', () => {
    const save = defaultSave();
    const high = applyLevelCompletion(save, completion(10, 4000, 900)).save;
    expect(high.highestUnlocked).toBe(11);

    const replay = applyLevelCompletion(high, completion(3, 500, 100)).save;
    expect(replay.highestUnlocked).toBe(11);
    expect(replay.completedLevels).toContain(3);
    expect(replay.levelBestScores['10']).toBe(900);
  });

  it('does not replace a better level score with a weaker replay', () => {
    const first = applyLevelCompletion(defaultSave(), completion(2, 2000, 800)).save;
    const second = applyLevelCompletion(first, completion(2, 1500, 500));
    expect(second.save.levelBestScores['2']).toBe(800);
    expect(second.meta.newLevelBest).toBe(false);
  });

  it('keeps separate campaign and co-op bests', () => {
    const campaign = applyLevelCompletion(
      defaultSave(),
      completion(1, 1000, 600, { mode: 'campaign' }),
    ).save;
    const coop = applyLevelCompletion(
      campaign,
      completion(1, 2400, 900, { mode: 'coop', playerScores: [1100, 1300], playerLives: [3, 2] }),
    ).save;
    expect(coop.bestCampaignScore).toBe(1000);
    expect(coop.bestCoopScore).toBe(2400);
    expect(coop.levelBestScores['1']).toBe(600);
  });

  it('marks a completed campaign and lets the campaign-complete record own the final best', () => {
    const finalCompletion = completion(24, 9000, 2500);
    const levelResult = applyLevelCompletion(defaultSave(), finalCompletion);
    expect(levelResult.save.campaignCompleted).toBe(true);
    expect(levelResult.save.highestUnlocked).toBe(24);
    expect(levelResult.save.completedLevels).toContain(24);
    // The final level deliberately defers the campaign record so the victory
    // screen can report a genuine "new best".
    expect(levelResult.save.bestCampaignScore).toBe(0);

    const campaign: CampaignRecord = {
      mode: 'campaign',
      finalScore: 9000,
      playerScores: [9000],
      stats: { pops: 100, splits: 10, pickups: 3, damageTaken: 1, levelsCleared: 24, wavesCleared: 0 },
    };
    const result = applyCampaignComplete(levelResult.save, campaign);
    expect(result.save.campaignCompleted).toBe(true);
    expect(result.save.bestCampaignScore).toBe(9000);
    expect(result.meta.newBest).toBe(true);
    expect(result.save.stats.totalRuns).toBe(1);
    expect(result.save.stats.totalPops).toBe(100);
    expect(result.save.stats.totalPickups).toBe(3);
    expect(result.save.lastRun?.mode).toBe('campaign');
    expect(result.save.lastRun?.level).toBe(24);
  });
});

describe('endless records', () => {
  const run = (score: number, wave: number): RunRecord => ({
    mode: 'endless',
    finalScore: score,
    levelsCompleted: 0,
    levelNumber: wave,
    wave,
    stats: { pops: 60, splits: 6, pickups: 2, damageTaken: 3, levelsCleared: 0, wavesCleared: wave - 1 },
    reason: 'eliminated',
  });

  it('tracks the best score and deepest wave', () => {
    const first = applyRunEnd(defaultSave(), run(5000, 7));
    expect(first.save.bestEndlessScore).toBe(5000);
    expect(first.save.bestEndlessWave).toBe(7);
    expect(first.save.stats.bestEndlessWave).toBe(7);
    expect(first.save.stats.totalWaves).toBe(6);
    expect(first.save.stats.totalRuns).toBe(1);
    expect(first.save.stats.totalPops).toBe(60);
    expect(first.save.stats.totalPickups).toBe(2);
    expect(first.save.lastRun?.mode).toBe('endless');
    expect(first.meta.newBest).toBe(true);

    const weaker = applyRunEnd(first.save, run(3000, 5));
    expect(weaker.save.bestEndlessScore).toBe(5000);
    expect(weaker.save.bestEndlessWave).toBe(7);
    expect(weaker.meta.newBest).toBe(false);
    expect(weaker.save.stats.totalRuns).toBe(2);
  });
});

describe('settings and bindings persistence', () => {
  it('round-trips settings and key bindings', () => {
    const storage = new FakeStorage();
    const save = defaultSave();
    save.settings = {
      ...save.settings,
      masterVolume: 0.33,
      sfxVolume: 0.22,
      musicVolume: 0.11,
      difficulty: 'hard',
      reducedMotion: true,
      highContrast: true,
      touchControls: 'always',
      soundOn: false,
      screenShake: false,
    };
    save.bindings.p1.fire = 'KeyF';
    save.bindings.p2.left = 'KeyJ';
    save.bindings.p2.weapons[2] = 'KeyK';
    persistSave(save, storage);

    const loaded = loadSave(storage);
    expect(loaded.settings).toEqual(save.settings);
    expect(loaded.bindings.p1.fire).toBe('KeyF');
    expect(loaded.bindings.p2.left).toBe('KeyJ');
    expect(loaded.bindings.p2.weapons[2]).toBe('KeyK');
  });

  it('sanitizes malformed values instead of crashing', () => {
    const settings = sanitizeSettings({
      masterVolume: 99,
      sfxVolume: -2,
      musicVolume: 'loud',
      difficulty: 'impossible',
      soundOn: 'yes',
      touchControls: 'sometimes',
    });
    expect(settings.masterVolume).toBe(1);
    expect(settings.sfxVolume).toBe(0);
    expect(settings.musicVolume).toBe(defaultSettings().musicVolume);
    expect(settings.difficulty).toBe('normal');
    expect(settings.soundOn).toBe(defaultSettings().soundOn);
    expect(settings.touchControls).toBe('auto');

    const bindings = sanitizeBindings({ p1: { left: 42 } });
    expect(bindings.p1.left).toBe(defaultBindings().p1.left);
    expect(bindings.p2.weapons).toHaveLength(4);
  });

  it('handles corrupt, missing and outdated localStorage safely', () => {
    const storage = new FakeStorage();
    expect(loadSave(storage)).toEqual(defaultSave());

    storage.setItem(SAVE_KEY, '{definitely not json');
    expect(loadSave(storage).highestUnlocked).toBe(1);

    storage.setItem(SAVE_KEY, JSON.stringify({ version: 999, highestUnlocked: 20 }));
    expect(loadSave(storage).highestUnlocked).toBe(1);

    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        highestUnlocked: 'oops',
        completedLevels: [1, 1, 2, 99, 'x'],
        levelBestScores: { '1': 'lots', '3': 700 },
        bestCampaignScore: -500,
        settings: { difficulty: 'nonsense', masterVolume: 4 },
        bindings: 'bad',
        stats: { totalPops: 'huge' },
      }),
    );
    const loaded = loadSave(storage);
    expect(loaded.highestUnlocked).toBe(3);
    expect(loaded.completedLevels).toEqual([1, 2]);
    expect(loaded.levelBestScores['3']).toBe(700);
    expect(loaded.levelBestScores['1']).toBeUndefined();
    expect(loaded.bestCampaignScore).toBe(0);
    expect(loaded.settings.difficulty).toBe('normal');
    expect(loaded.settings.masterVolume).toBe(1);
    expect(loaded.bindings.p1.fire).toBe('Space');
  });

  it('strictly validates version and never throws on hostile types', () => {
    expect(sanitizeSave(null).highestUnlocked).toBe(1);
    expect(sanitizeSave([]).version).toBe(1);
    expect(sanitizeSave({ version: 0 }).version).toBe(1);
    expect(sanitizeSave({ version: 1, highestUnlocked: 999 }).highestUnlocked).toBe(24);
  });

  it('reset progression clears records but preserves preferences and bindings', () => {
    const storage = new FakeStorage();
    const save: SaveData = applyLevelCompletion(
      defaultSave(),
      completion(1, 3000, 900),
    ).save;
    save.settings = { ...save.settings, difficulty: 'easy', reducedMotion: true };
    save.bindings.p1.left = 'KeyH';

    const reset = resetProgression(save);
    expect(reset.highestUnlocked).toBe(1);
    expect(reset.completedLevels).toEqual([]);
    expect(reset.bestCampaignScore).toBe(0);
    expect(reset.settings.difficulty).toBe('easy');
    expect(reset.settings.reducedMotion).toBe(true);
    expect(reset.bindings.p1.left).toBe('KeyH');

    persistSave(reset, storage);
    expect(loadSave(storage).highestUnlocked).toBe(1);
  });
});
