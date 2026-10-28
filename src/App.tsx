import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from './game/audio';
import {
  applyCampaignComplete,
  applyLevelCompletion,
  applyRunEnd,
  loadSave,
  persistSave,
  resetProgression,
  sanitizeBindings,
  sanitizeSettings,
  type LevelCompletionMeta,
  type RunEndMeta,
} from './game/storage';
import type {
  CampaignRecord,
  CompletionRecord,
  GameMode,
  KeyBindings,
  RunRecord,
  SaveData,
  Settings,
  WaveRecord,
} from './game/types';
import { GameSession } from './ui/GameSession';
import { MainMenu } from './ui/MainMenu';
import { SettingsPanel } from './ui/SettingsPanel';
import { HowToPlay } from './ui/HowToPlay';
import { LevelSelect } from './ui/LevelSelect';
import { HighScores } from './ui/HighScores';
import { CoopIntro } from './ui/CoopIntro';

type Screen = 'menu' | 'howto' | 'settings' | 'scores' | 'levels' | 'coop' | 'game';

interface SessionConfig {
  mode: GameMode;
  startLevelIndex: number;
  id: number;
}

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<Screen>('menu');
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const [session, setSession] = useState<SessionConfig | null>(null);
  const sessionCounter = useRef(0);
  const [gameSettingsOpen, setGameSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const audioRef = useRef<AudioEngine | null>(null);
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new AudioEngine(save.settings);
  }
  const audio = audioRef.current;

  const commitSave = useCallback((next: SaveData) => {
    saveRef.current = next;
    persistSave(next);
    setSave(next);
  }, []);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    audio?.setSettings(save.settings);
  }, [audio, save.settings]);

  useEffect(() => {
    if (!audio) return;
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      audio.unlock();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [audio]);

  useEffect(() => {
    return () => {
      audioRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (screen !== 'game') {
      audio?.setMusicIntensity(0.62);
      audio?.setPaused(false);
    }
  }, [audio, screen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setCanFullscreen(
      typeof document.documentElement.requestFullscreen === 'function' &&
        document.fullscreenEnabled !== false,
    );
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    onChange();
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('button, a[href], input[type="range"]')) return;
      if (screenRef.current === 'game') return;
      audioRef.current?.play('click');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(handle);
  }, [toast]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title =
      screen === 'game' && session
        ? `POPBOUND · ${session.mode === 'endless' ? 'ENDLESS' : session.mode === 'coop' ? 'CO-OP' : 'CAMPAIGN'}`
        : 'POPBOUND: ORB CHAOS';
  }, [screen, session]);

  useEffect(() => {
    if (!gameSettingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;
      event.preventDefault();
      setGameSettingsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameSettingsOpen]);

  const showToast = useCallback((message: string) => setToast(message), []);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (typeof document.documentElement.requestFullscreen === 'function') {
        await document.documentElement.requestFullscreen();
      } else {
        showToast('Fullscreen is not available in this browser.');
      }
    } catch {
      showToast('Fullscreen is not available right now.');
    }
  }, [showToast]);

  const updateSettings = useCallback(
    (next: Settings) => {
      const prev = saveRef.current;
      commitSave({ ...prev, settings: sanitizeSettings(next) });
    },
    [commitSave],
  );

  const updateBindings = useCallback(
    (next: KeyBindings) => {
      const prev = saveRef.current;
      commitSave({ ...prev, bindings: sanitizeBindings(next) });
    },
    [commitSave],
  );

  const resetProgress = useCallback(() => {
    commitSave(resetProgression(saveRef.current));
    showToast('Progress reset. Settings and key bindings were kept.');
  }, [commitSave, showToast]);

  const handleLevelComplete = useCallback(
    (record: CompletionRecord): LevelCompletionMeta => {
      const result = applyLevelCompletion(saveRef.current, record);
      commitSave(result.save);
      return result.meta;
    },
    [commitSave],
  );

  const handleGameOver = useCallback(
    (record: RunRecord): RunEndMeta => {
      const result = applyRunEnd(saveRef.current, record);
      commitSave(result.save);
      return result.meta;
    },
    [commitSave],
  );

  const handleWaveComplete = useCallback(
    (record: WaveRecord) => {
      const previous = saveRef.current;
      const nextBest = Math.max(previous.bestEndlessScore, record.totalScore);
      const nextWave = Math.max(previous.bestEndlessWave, record.wave);
      if (nextBest === previous.bestEndlessScore && nextWave === previous.bestEndlessWave) return;
      commitSave({
        ...previous,
        bestEndlessScore: nextBest,
        bestEndlessWave: nextWave,
        stats: { ...previous.stats, bestEndlessWave: nextWave },
      });
    },
    [commitSave],
  );

  const handleCampaignComplete = useCallback(
    (record: CampaignRecord): { newBest: boolean } => {
      const result = applyCampaignComplete(saveRef.current, record);
      commitSave(result.save);
      return result.meta;
    },
    [commitSave],
  );

  const startGame = useCallback(
    (mode: GameMode, startLevelIndex = 0) => {
      audio?.unlock();
      sessionCounter.current += 1;
      setSession({ mode, startLevelIndex, id: sessionCounter.current });
      setGameSettingsOpen(false);
      setScreen('game');
    },
    [audio],
  );

  const leaveGame = useCallback(() => {
    setGameSettingsOpen(false);
    setSession(null);
    setScreen('menu');
    audio?.setPaused(false);
    audio?.setMusicIntensity(0.62);
  }, [audio]);

  const openGameSettings = useCallback(() => {
    setGameSettingsOpen(true);
  }, []);

  if (screen === 'game' && session) {
    return (
      <div className={`app game-app${save.settings.reducedMotion ? ' reduced-motion' : ''}`}>
        <GameSession
          key={`${session.mode}-${session.id}`}
          mode={session.mode}
          startLevelIndex={session.startLevelIndex}
          settings={save.settings}
          bindings={save.bindings}
          audio={audio}
          isFullscreen={isFullscreen}
          canFullscreen={canFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onExit={leaveGame}
          onOpenSettings={openGameSettings}
          shortcutsBlocked={gameSettingsOpen}
          onLevelComplete={handleLevelComplete}
          onGameOver={handleGameOver}
          onCampaignComplete={handleCampaignComplete}
          onWaveComplete={handleWaveComplete}
        />
        {gameSettingsOpen && (
          <div className="settings-overlay-layer">
            <div className="settings-overlay-card">
              <SettingsPanel
                inGame
                settings={save.settings}
                bindings={save.bindings}
                onSettingsChange={updateSettings}
                onBindingsChange={updateBindings}
                onResetProgress={resetProgress}
                onBack={() => setGameSettingsOpen(false)}
              />
            </div>
          </div>
        )}
        {toast && (
          <div className="toast" role="status" aria-live="polite">
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`app${save.settings.reducedMotion ? ' reduced-motion' : ''}`} data-screen={screen}>
      <div className="app-ambient" aria-hidden="true">
        <span className="ambient-orb ambient-a" />
        <span className="ambient-orb ambient-b" />
        <span className="ambient-orb ambient-c" />
      </div>

      {screen === 'menu' && (
        <MainMenu
          save={save}
          isFullscreen={isFullscreen}
          canFullscreen={canFullscreen}
          onStartCampaign={(levelIndex) => startGame('campaign', levelIndex)}
          onStartCoop={() => setScreen('coop')}
          onStartEndless={() => startGame('endless', 0)}
          onOpenLevels={() => setScreen('levels')}
          onOpenHowTo={() => setScreen('howto')}
          onOpenSettings={() => setScreen('settings')}
          onOpenScores={() => setScreen('scores')}
          onToggleFullscreen={toggleFullscreen}
        />
      )}

      {screen === 'howto' && <HowToPlay bindings={save.bindings} onBack={() => setScreen('menu')} />}

      {screen === 'settings' && (
        <SettingsPanel
          settings={save.settings}
          bindings={save.bindings}
          onSettingsChange={updateSettings}
          onBindingsChange={updateBindings}
          onResetProgress={resetProgress}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'scores' && <HighScores save={save} onBack={() => setScreen('menu')} />}

      {screen === 'levels' && (
        <LevelSelect
          save={save}
          onBack={() => setScreen('menu')}
          onPlay={(levelIndex) => startGame('campaign', levelIndex)}
        />
      )}

      {screen === 'coop' && (
        <CoopIntro
          bindings={save.bindings}
          settings={save.settings}
          onBack={() => setScreen('menu')}
          onStart={() => startGame('coop', 0)}
        />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
