import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { GameEngine } from '../game/GameEngine';
import type {
  AudioBus,
  CampaignRecord,
  CompletionRecord,
  EngineEvent,
  GameMode,
  KeyBindings,
  RunRecord,
  Settings,
  WaveRecord,
} from '../game/types';
import { THEMES } from '../game/themes';
import type { LevelCompletionMeta, RunEndMeta } from '../game/storage';
import { GameCanvas } from './GameCanvas';
import { Hud } from './Hud';
import { TouchControls } from './TouchControls';
import {
  CampaignCompleteOverlay,
  ConfirmDialog,
  GameOverOverlay,
  LevelCompleteOverlay,
  PauseOverlay,
  TimeUpOverlay,
  WaveCompleteOverlay,
} from './overlays';
import { useCoarsePointer, useIsPortrait } from './common';
import { IconClose } from './icons';

export interface GameSessionCallbacks {
  onLevelComplete: (record: CompletionRecord) => LevelCompletionMeta;
  onGameOver: (record: RunRecord) => RunEndMeta;
  onCampaignComplete: (record: CampaignRecord) => { newBest: boolean };
  onWaveComplete: (record: WaveRecord) => void;
}

export interface GameSessionProps extends GameSessionCallbacks {
  mode: GameMode;
  startLevelIndex: number;
  settings: Settings;
  bindings: KeyBindings;
  audio: AudioBus | null;
  isFullscreen: boolean;
  canFullscreen: boolean;
  onToggleFullscreen: () => void;
  onExit: () => void;
  onOpenSettings: () => void;
  shortcutsBlocked: boolean;
}

type ConfirmState = 'exit' | 'restart' | null;

export function GameSession(props: GameSessionProps) {
  const propsRef = useRef(props);
  propsRef.current = props;
  const eventHandlerRef = useRef<(event: EngineEvent) => void>(() => undefined);
  const engineRef = useRef<GameEngine | null>(null);
  const [levelMeta, setLevelMeta] = useState<LevelCompletionMeta | null>(null);
  const [runMeta, setRunMeta] = useState<RunEndMeta | null>(null);
  const [campaignMeta, setCampaignMeta] = useState<{ newBest: boolean } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmState>(null);
  const [rotateDismissed, setRotateDismissed] = useState(false);
  const coarsePointer = useCoarsePointer();
  const portrait = useIsPortrait();

  eventHandlerRef.current = (event: EngineEvent) => {
    switch (event.type) {
      case 'level-complete': {
        const meta = propsRef.current.onLevelComplete(event.record);
        setLevelMeta(meta);
        break;
      }
      case 'campaign-complete': {
        const meta = propsRef.current.onCampaignComplete(event.record);
        setCampaignMeta(meta);
        break;
      }
      case 'game-over': {
        const meta = propsRef.current.onGameOver(event.record);
        setRunMeta(meta);
        break;
      }
      case 'wave-complete': {
        propsRef.current.onWaveComplete(event.record);
        break;
      }
      case 'state-change': {
        if (event.state === 'PLAYING' || event.state === 'READY') {
          setLevelMeta(null);
          setRunMeta(null);
          setCampaignMeta(null);
          setConfirmAction(null);
        }
        break;
      }
      default:
        break;
    }
  };

  if (!engineRef.current) {
    engineRef.current = new GameEngine({
      mode: props.mode,
      startLevelIndex: props.startLevelIndex,
      settings: props.settings,
      bindings: props.bindings,
      audio: props.audio ?? undefined,
      onEvent: (event) => eventHandlerRef.current(event),
    });
  }
  const engine = engineRef.current;
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

  useEffect(() => {
    engine.applySettings(propsRef.current.settings);
  }, [engine, props.settings]);

  // Development-only inspection hook used by the browser QA suite. It is
  // tree-shaken/disabled in production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const scoped = window as unknown as { __popboundEngine?: GameEngine };
    scoped.__popboundEngine = engine;
    return () => {
      if (scoped.__popboundEngine === engine) delete scoped.__popboundEngine;
    };
  }, [engine]);

  useEffect(() => {
    engine.applyBindings(propsRef.current.bindings);
  }, [engine, props.bindings]);

  useEffect(() => {
    return () => {
      engine.destroy();
    };
  }, [engine]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('in-game');
    return () => {
      document.body.style.overflow = previous;
      document.documentElement.classList.remove('in-game');
    };
  }, []);

  // Pause/resume shortcut lives at the React layer so it knows when a modal is
  // covering the game. The engine itself never opens menus.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.code !== 'Escape' && event.code !== 'KeyP') return;
      if (confirmAction) {
        if (event.code === 'Escape') {
          event.preventDefault();
          setConfirmAction(null);
        }
        return;
      }
      if (propsRef.current.shortcutsBlocked) return;
      if (engine.state === 'PAUSED') {
        event.preventDefault();
        engine.resume();
      } else if (engine.state === 'PLAYING' || engine.state === 'READY') {
        event.preventDefault();
        engine.pause();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engine, confirmAction]);

  const theme = THEMES[snapshot.theme] ?? THEMES.training;
  const themeStyle = {
    '--arena-accent': theme.accent,
    '--arena-accent-2': theme.accent2,
    '--arena-bg-top': theme.bgTop,
    '--arena-bg-mid': theme.bgMid,
    '--arena-text': theme.text,
  } as CSSProperties;

  const showTouchBase =
    props.settings.touchControls === 'always' ||
    (props.settings.touchControls === 'auto' && coarsePointer);
  const showTouch =
    showTouchBase &&
    (snapshot.state === 'PLAYING' || snapshot.state === 'READY') &&
    !props.shortcutsBlocked;
  const showRotateHint =
    portrait && coarsePointer && !rotateDismissed && snapshot.state !== 'GAME_OVER';

  const stateLabel =
    snapshot.state === 'PAUSED'
      ? 'Game paused'
      : snapshot.state === 'LEVEL_COMPLETE'
        ? 'Level complete'
        : snapshot.state === 'GAME_OVER'
          ? 'Game over'
          : snapshot.state === 'CAMPAIGN_COMPLETE'
            ? 'Campaign complete'
            : snapshot.state === 'TIME_UP'
              ? "Time's up"
              : snapshot.state === 'WAVE_COMPLETE'
                ? 'Wave cleared'
                : snapshot.state === 'READY'
                  ? `Level ${snapshot.levelNumber} ready`
                  : `Level ${snapshot.levelNumber} in progress`;

  return (
    <div
      className={`game-shell${props.settings.highContrast ? ' high-contrast' : ''}${
        props.settings.reducedMotion ? ' reduced-motion' : ''
      }`}
      style={themeStyle}
      data-theme={snapshot.theme}
      data-state={snapshot.state}
    >
      <Hud
        snapshot={snapshot}
        engine={engine}
        isFullscreen={props.isFullscreen}
        canFullscreen={props.canFullscreen}
        onPause={() => engine.pause()}
        onToggleFullscreen={props.onToggleFullscreen}
      />

      {showRotateHint && (
        <div className="rotate-hint" role="note">
          <span className="rotate-icon" aria-hidden="true">
            ⟳
          </span>
          <span>Rotate to landscape for a bigger arena.</span>
          <button
            type="button"
            className="icon-btn rotate-dismiss"
            aria-label="Dismiss rotate hint"
            onClick={() => setRotateDismissed(true)}
          >
            <IconClose size={14} />
          </button>
        </div>
      )}

      <main className="game-main">
        <div className="stage">
          <GameCanvas engine={engine} />
          <div className="stage-corners" aria-hidden="true" />
          <TouchControls
            engine={engine}
            weapon={snapshot.players[0]?.weapon ?? 'pulse'}
            visible={showTouch}
          />

          {snapshot.state === 'PAUSED' && (
            <PauseOverlay
              snapshot={snapshot}
              onResume={() => engine.resume()}
              onRestart={() => setConfirmAction('restart')}
              onSettings={() => props.onOpenSettings()}
              onExit={() => setConfirmAction('exit')}
              onFullscreen={props.onToggleFullscreen}
              canFullscreen={props.canFullscreen}
            />
          )}
          {snapshot.state === 'TIME_UP' && <TimeUpOverlay snapshot={snapshot} />}
          {snapshot.state === 'WAVE_COMPLETE' && <WaveCompleteOverlay snapshot={snapshot} />}
          {snapshot.state === 'LEVEL_COMPLETE' && (
            <LevelCompleteOverlay
              snapshot={snapshot}
              meta={levelMeta}
              onNext={() => engine.nextLevel()}
              onMenu={props.onExit}
            />
          )}
          {snapshot.state === 'GAME_OVER' && (
            <GameOverOverlay
              snapshot={snapshot}
              meta={runMeta}
              onRetry={() => engine.retry()}
              onMenu={props.onExit}
            />
          )}
          {snapshot.state === 'CAMPAIGN_COMPLETE' && (
            <CampaignCompleteOverlay
              snapshot={snapshot}
              meta={campaignMeta}
              onReplay={() => engine.restartCampaign()}
              onMenu={props.onExit}
            />
          )}
          {confirmAction && (
            <ConfirmDialog
              title={confirmAction === 'exit' ? 'Abandon this run?' : 'Restart this attempt?'}
              body={
                confirmAction === 'exit'
                  ? 'Your completed levels are saved, but the current run will end. You can jump back in from the main menu.'
                  : snapshot.mode === 'endless'
                    ? 'This restarts the endless run from wave one. Your best score is safe.'
                    : 'This resets the current level, its timer and the score earned during this attempt.'
              }
              confirmLabel={confirmAction === 'exit' ? 'ABANDON RUN' : 'RESTART'}
              danger
              onConfirm={() => {
                if (confirmAction === 'exit') {
                  props.onExit();
                } else {
                  engine.restartLevel();
                  setConfirmAction(null);
                }
              }}
              onCancel={() => setConfirmAction(null)}
            />
          )}
        </div>
      </main>

      <div className="sr-only" role="status" aria-live="polite">
        {stateLabel}
        {snapshot.state === 'GAME_OVER' && snapshot.runResult
          ? `. Final score ${snapshot.runResult.finalScore}.`
          : ''}
      </div>
    </div>
  );
}
