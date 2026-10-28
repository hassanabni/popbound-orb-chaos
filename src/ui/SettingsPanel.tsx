import { useEffect, useState } from 'react';
import type {
  BindableAction,
  KeyBindings,
  PlayerBindings,
  Settings,
  TouchControlsMode,
} from '../game/types';
import {
  DEFAULT_BINDINGS,
  DIFFICULTY,
  RESERVED_KEYS,
  keyLabel,
} from '../game/constants';
import { ScreenHeader, Segmented, Slider, Toggle } from './common';
import { ConfirmDialog } from './overlays';
import { IconBackspace, IconRestart } from './icons';

interface SettingsPanelProps {
  settings: Settings;
  bindings: KeyBindings;
  inGame?: boolean;
  onSettingsChange: (settings: Settings) => void;
  onBindingsChange: (bindings: KeyBindings) => void;
  onResetProgress: () => void;
  onBack: () => void;
}

interface Listening {
  player: 'p1' | 'p2';
  action: BindableAction;
}

const BINDING_ROWS: Array<{
  action: BindableAction;
  label: string;
  hint: string;
}> = [
  { action: 'left', label: 'Move left', hint: 'Movement' },
  { action: 'right', label: 'Move right', hint: 'Movement' },
  { action: 'fire', label: 'Fire', hint: 'Hold to auto-fire' },
  { action: 'weapon1', label: 'Weapon 1', hint: 'Pulse Harpoon' },
  { action: 'weapon2', label: 'Weapon 2', hint: 'Anchor Web' },
  { action: 'weapon3', label: 'Weapon 3', hint: 'Prism Beam' },
  { action: 'weapon4', label: 'Weapon 4', hint: 'Arc Mine' },
];

function getBinding(player: PlayerBindings, action: BindableAction): string {
  if (action === 'left') return player.left;
  if (action === 'right') return player.right;
  if (action === 'fire') return player.fire;
  return player.weapons[Number(action.slice(-1)) - 1] ?? '';
}

function setBinding(
  bindings: KeyBindings,
  playerKey: 'p1' | 'p2',
  action: BindableAction,
  code: string,
): KeyBindings {
  const player = bindings[playerKey];
  if (action === 'left' || action === 'right' || action === 'fire') {
    return {
      ...bindings,
      [playerKey]: { ...player, [action]: code },
    };
  }
  const index = Number(action.slice(-1)) - 1;
  const weapons = [...player.weapons] as [string, string, string, string];
  weapons[index] = code;
  return {
    ...bindings,
    [playerKey]: { ...player, weapons },
  };
}

function bindingUsage(
  bindings: KeyBindings,
  code: string,
  except: Listening,
): string | null {
  for (const playerKey of ['p1', 'p2'] as const) {
    for (const row of BINDING_ROWS) {
      if (playerKey === except.player && row.action === except.action) continue;
      if (getBinding(bindings[playerKey], row.action) !== code) continue;
      const who = playerKey === 'p1' ? 'Player 1' : 'Player 2';
      return `${who} already uses this for “${row.label}”.`;
    }
  }
  return null;
}

export function SettingsPanel({
  settings,
  bindings,
  inGame = false,
  onSettingsChange,
  onBindingsChange,
  onResetProgress,
  onBack,
}: SettingsPanelProps) {
  const [listening, setListening] = useState<Listening | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!confirmReset) return;
    const handler = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setConfirmReset(false);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [confirmReset]);

  useEffect(() => {
    if (!listening) return;
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        setListening(null);
        setError(null);
        return;
      }
      const code = event.code;
      if (!code) {
        setError('That key is not supported. Try another.');
        return;
      }
      if (RESERVED_KEYS.has(code)) {
        setError(
          code === 'KeyP' || code === 'Escape'
            ? 'Esc and P are reserved for pausing. Pick another key.'
            : `${keyLabel(code)} is reserved by the game or browser.`,
        );
        return;
      }
      if (code.startsWith('Meta') || code.startsWith('OS') || code.startsWith('Browser')) {
        setError('System keys cannot be bound. Try another key.');
        return;
      }
      const current = getBinding(bindings[listening.player], listening.action);
      if (code === current) {
        setListening(null);
        setError(null);
        return;
      }
      const usage = bindingUsage(bindings, code, listening);
      if (usage) {
        setError(usage);
        return;
      }
      onBindingsChange(setBinding(bindings, listening.player, listening.action, code));
      setListening(null);
      setError(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [listening, bindings, onBindingsChange]);

  const patch = (next: Partial<Settings>) => onSettingsChange({ ...settings, ...next });

  return (
    <div className="screen settings-screen">
      <div className="panel-scroll">
        <ScreenHeader
          eyebrow={inGame ? 'RUN SUSPENDED' : 'SYSTEM CONFIG'}
          title="Settings"
          subtitle="Sound, difficulty, accessibility and controls. Everything is saved locally."
          onBack={onBack}
          autoFocusBack={inGame}
          actions={
            <span className="version-tag" aria-label="Game version">
              v1.0
            </span>
          }
        />

        <div className="settings-grid">
          <section className="panel settings-card" aria-labelledby="settings-audio">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">AUDIO</p>
                <h2 id="settings-audio">Mix desk</h2>
              </div>
              <span className="panel-chip">{settings.soundOn ? 'LIVE' : 'MUTED'}</span>
            </div>
            <Toggle
              label="Sound"
              description="All generated effects and the ambient pad."
              checked={settings.soundOn}
              onChange={(soundOn) => patch({ soundOn })}
            />
            <Slider
              label="Master volume"
              value={settings.masterVolume}
              onChange={(masterVolume) => patch({ masterVolume })}
              disabled={!settings.soundOn}
            />
            <Slider
              label="Effects volume"
              value={settings.sfxVolume}
              onChange={(sfxVolume) => patch({ sfxVolume })}
              disabled={!settings.soundOn}
            />
            <Slider
              label="Music volume"
              value={settings.musicVolume}
              onChange={(musicVolume) => patch({ musicVolume })}
              description="A slow procedural ambient pad. No external tracks."
              disabled={!settings.soundOn}
            />
          </section>

          <section className="panel settings-card" aria-labelledby="settings-gameplay">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">GAMEPLAY</p>
                <h2 id="settings-gameplay">Challenge</h2>
              </div>
              <span className="panel-chip">{DIFFICULTY[settings.difficulty].label.toUpperCase()}</span>
            </div>
            <div className="setting-block">
              <div className="setting-copy">
                <span className="setting-label">Difficulty</span>
                <p>{DIFFICULTY[settings.difficulty].blurb}</p>
              </div>
              <Segmented
                label="Difficulty"
                value={settings.difficulty}
                options={[
                  { value: 'easy', label: 'Easy', description: DIFFICULTY.easy.blurb },
                  { value: 'normal', label: 'Normal', description: DIFFICULTY.normal.blurb },
                  { value: 'hard', label: 'Hard', description: DIFFICULTY.hard.blurb },
                ]}
                onChange={(difficulty) => patch({ difficulty })}
              />
              <p className="setting-note">
                Difficulty applies to level restarts and new runs. {DIFFICULTY[settings.difficulty].lives}{' '}
                starting lives.
              </p>
            </div>
            <Toggle
              label="Screen shake"
              description="Short impacts and damage moments. Disabled by Reduced Motion."
              checked={settings.screenShake}
              onChange={(screenShake) => patch({ screenShake })}
              disabled={settings.reducedMotion}
            />
            <div className="setting-block">
              <div className="setting-copy">
                <span className="setting-label">On-screen controls</span>
                <p>Show the touch pad automatically, always, or never.</p>
              </div>
              <Segmented<TouchControlsMode>
                label="Touch controls visibility"
                compact
                value={settings.touchControls}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'always', label: 'Always' },
                  { value: 'never', label: 'Never' },
                ]}
                onChange={(touchControls) => patch({ touchControls })}
              />
            </div>
          </section>

          <section className="panel settings-card" aria-labelledby="settings-access">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">ACCESSIBILITY</p>
                <h2 id="settings-access">Comfort</h2>
              </div>
              <span className="panel-chip">LIVE</span>
            </div>
            <Toggle
              label="Reduced motion"
              description="Fewer particles, static ambience and no screen shake."
              checked={settings.reducedMotion}
              onChange={(reducedMotion) => patch({ reducedMotion })}
            />
            <Toggle
              label="High contrast"
              description="Solid orb outlines, tier markings, brighter pickups and a darker arena."
              checked={settings.highContrast}
              onChange={(highContrast) => patch({ highContrast })}
            />
            <p className="setting-note">
              Reduced Motion also affects menus and particle bursts on the Canvas. Your choice is
              stored in this browser.
            </p>
            <details className="advanced-details">
              <summary>Advanced</summary>
              <Toggle
                label="Debug overlay"
                description="Show collision circles, entity counts and FPS. Off for normal play."
                checked={settings.debug}
                onChange={(debug) => patch({ debug })}
              />
            </details>
          </section>

          <section className="panel settings-card settings-controls" aria-labelledby="settings-controls">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">CONTROLS</p>
                <h2 id="settings-controls">Bindings</h2>
              </div>
              <button
                type="button"
                className="btn btn-tiny btn-ghost"
                onClick={() => onBindingsChange(JSON.parse(JSON.stringify(DEFAULT_BINDINGS)) as KeyBindings)}
              >
                <IconRestart size={13} />
                Reset keys
              </button>
            </div>
            <p className="binding-help">
              Click a key, then press a new one. <kbd>Esc</kbd> cancels. Pause is always{' '}
              <kbd>Esc</kbd> / <kbd>P</kbd>.
            </p>
            {error && (
              <p className="binding-error" role="alert">
                {error}
              </p>
            )}
            <div className="binding-columns">
              {(['p1', 'p2'] as const).map((playerKey) => (
                <div className="binding-column" key={playerKey}>
                  <div className="binding-column-head">
                    <span className={`player-dot p${playerKey === 'p1' ? 1 : 2}`} />
                    <h3>Player {playerKey === 'p1' ? 1 : 2}</h3>
                    {playerKey === 'p2' && <span className="binding-optional">CO-OP</span>}
                  </div>
                  <div className="binding-list">
                    {BINDING_ROWS.map((row) => {
                      const isListening =
                        listening?.player === playerKey && listening.action === row.action;
                      const code = getBinding(bindings[playerKey], row.action);
                      return (
                        <div className="binding-row" key={row.action}>
                          <span className="binding-action">
                            {row.label}
                            <small>{row.hint}</small>
                          </span>
                          <button
                            type="button"
                            className={`key-button${isListening ? ' is-listening' : ''}`}
                            aria-label={`Rebind ${row.label} for player ${playerKey === 'p1' ? 1 : 2}. Current key ${keyLabel(code)}`}
                            onClick={() => {
                              setError(null);
                              setListening(isListening ? null : { player: playerKey, action: row.action });
                            }}
                          >
                            {isListening ? (
                              <span className="key-listening">
                                <span className="listen-dot" />
                                PRESS KEY
                              </span>
                            ) : (
                              <kbd>{keyLabel(code)}</kbd>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="setting-note">
              Player 2 controls are used in local co-op. Both players use the same keyboard.
            </p>
          </section>

          <section className="panel settings-card settings-data" aria-labelledby="settings-data">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">DATA</p>
                <h2 id="settings-data">Local save</h2>
              </div>
              <span className="panel-chip">BROWSER</span>
            </div>
            <p className="data-copy">
              Progress, high scores, key bindings and volume preferences live in this browser's
              localStorage. No account or network is used.
            </p>
            <div className="data-actions">
              <button
                type="button"
                className="btn btn-danger-ghost"
                onClick={() => setConfirmReset(true)}
              >
                <IconBackspace size={16} />
                Reset progress…
              </button>
              <button type="button" className="btn btn-ghost" onClick={onBack}>
                {inGame ? 'Back to pause menu' : 'Back to menu'}
              </button>
            </div>
          </section>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reset campaign progress?"
          body="This clears unlocked levels, per-level bests, campaign and endless high scores, and lifetime stats. Your sound, accessibility and key settings are kept."
          confirmLabel="RESET PROGRESS"
          danger
          onConfirm={() => {
            onResetProgress();
            setConfirmReset(false);
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
