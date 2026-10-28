import { useId, type ReactNode } from 'react';
import type { HudSnapshot } from '../game/types';
import type {
  LevelCompletionMeta,
  RunEndMeta,
} from '../game/storage';
import { TIME_UP_OVERLAY, WAVE_TRANSITION_TIME } from '../game/constants';
import { THEMES } from '../game/themes';
import { formatClock, formatScore, pad2 } from './common';
import {
  IconCheck,
  IconHeart,
  IconHome,
  IconPlay,
  IconRestart,
  IconSettings,
  IconStar,
  IconTrophy,
} from './icons';

interface OverlayShellProps {
  children: ReactNode;
  label: string;
  tone?: 'default' | 'win' | 'danger' | 'warning';
  wide?: boolean;
}

function OverlayShell({ children, label, tone = 'default', wide = false }: OverlayShellProps) {
  const id = useId();
  return (
    <div className="game-overlay">
      <div
        className={`dialog dialog-${tone}${wide ? ' dialog-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <span id={id} className="sr-only">
          {label}
        </span>
        {children}
      </div>
    </div>
  );
}

const themeOf = (snapshot: HudSnapshot) => THEMES[snapshot.theme] ?? THEMES.training;

/* ------------------------------------------------------------------ */
/* Pause                                                               */
/* ------------------------------------------------------------------ */

export function PauseOverlay({
  snapshot,
  onResume,
  onRestart,
  onSettings,
  onExit,
  onFullscreen,
  canFullscreen,
}: {
  snapshot: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onExit: () => void;
  onFullscreen: () => void;
  canFullscreen: boolean;
}) {
  const theme = themeOf(snapshot);
  return (
    <OverlayShell label="Game paused" tone="default">
      <div className="dialog-topline" style={{ background: theme.accent }} />
      <p className="dialog-eyebrow">RUN SUSPENDED</p>
      <h2 className="dialog-title">PAUSED</h2>
      <p className="dialog-subtitle">
        {snapshot.levelTitle} · {formatClock(snapshot.timeRemaining)} remaining ·{' '}
        {snapshot.bubbleCount} orb{snapshot.bubbleCount === 1 ? '' : 's'} left
      </p>
      <div className="pause-actions">
        <button type="button" className="btn btn-primary btn-wide" onClick={onResume} autoFocus>
          <IconPlay size={17} />
          RESUME
        </button>
        <div className="button-row">
          <button type="button" className="btn btn-glass" onClick={onRestart}>
            <IconRestart size={16} />
            Restart {snapshot.mode === 'endless' ? 'Run' : 'Level'}
          </button>
          <button type="button" className="btn btn-glass" onClick={onSettings}>
            <IconSettings size={16} />
            Settings
          </button>
        </div>
        {canFullscreen && (
          <button type="button" className="btn btn-ghost btn-wide" onClick={onFullscreen}>
            Toggle fullscreen
          </button>
        )}
        <button type="button" className="btn btn-danger-ghost btn-wide" onClick={onExit}>
          <IconHome size={16} />
          Return to Main Menu
        </button>
      </div>
      <p className="dialog-hint">
        Press <kbd>Esc</kbd> or <kbd>P</kbd> to resume
      </p>
    </OverlayShell>
  );
}

/* ------------------------------------------------------------------ */
/* Time up                                                             */
/* ------------------------------------------------------------------ */

export function TimeUpOverlay({ snapshot }: { snapshot: HudSnapshot }) {
  const progress = Math.max(0, Math.min(1, 1 - snapshot.stateTimer / TIME_UP_OVERLAY));
  const losses = snapshot.timeUpLosses;
  return (
    <OverlayShell label="Time expired" tone="warning">
      <div className="dialog-topline warning" />
      <p className="dialog-eyebrow warning-text">CONTAINMENT WINDOW CLOSED</p>
      <h2 className="dialog-title">TIME'S UP</h2>
      <p className="dialog-subtitle">
        {losses.length > 0
          ? `${losses.map((i) => `P${i + 1}`).join(' & ')} lost a life.`
          : 'The clock hit zero.'}{' '}
        {snapshot.timeUpLosses.length > 0 ? 'Resetting the arena.' : 'Assessing the damage.'}
      </p>
      <div className="timeup-progress">
        <div className="timeup-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="life-loss-row">
        {snapshot.players.map((player) => (
          <div
            className={`life-loss${losses.includes(player.index) ? ' is-hit' : ''}`}
            key={player.index}
          >
            <span>P{player.index + 1}</span>
            <div className="mini-hearts">
              {Array.from({ length: player.maxLives }, (_, i) => (
                <span
                  key={i}
                  className={`life-heart${i < player.lives ? ' is-full' : ''}`}
                  aria-hidden="true"
                >
                  <IconHeart size={12} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </OverlayShell>
  );
}

/* ------------------------------------------------------------------ */
/* Wave clear                                                          */
/* ------------------------------------------------------------------ */

export function WaveCompleteOverlay({ snapshot }: { snapshot: HudSnapshot }) {
  const wave = snapshot.lastWave;
  const progress = Math.max(0, Math.min(1, 1 - snapshot.stateTimer / WAVE_TRANSITION_TIME));
  return (
    <OverlayShell label={`Wave ${wave?.wave ?? snapshot.wave} cleared`} tone="win">
      <div className="dialog-topline win" />
      <p className="dialog-eyebrow">SIGNAL STABLE</p>
      <h2 className="dialog-title">WAVE CLEARED</h2>
      <p className="dialog-subtitle">The next surge is already forming.</p>
      {wave && (
        <div className="bonus-grid">
          <div className="bonus-cell">
            <span>Wave</span>
            <strong>{pad2(wave.wave)}</strong>
          </div>
          <div className="bonus-cell">
            <span>Base score</span>
            <strong>{formatScore(wave.levelBaseScore)}</strong>
          </div>
          <div className="bonus-cell">
            <span>Time bonus</span>
            <strong>+{formatScore(wave.timeBonus)}</strong>
          </div>
          <div className="bonus-cell">
            <span>Wave bonus</span>
            <strong>+{formatScore(wave.waveBonus)}</strong>
          </div>
        </div>
      )}
      <div className="wave-total">
        <span>RUN SCORE</span>
        <strong>{formatScore(snapshot.teamScore)}</strong>
      </div>
      <div className="wave-next">
        <span>Incoming wave {pad2(snapshot.wave + 1)}</span>
        <span>{Math.max(0, Math.ceil(snapshot.stateTimer))}s</span>
      </div>
      <div className="timeup-progress">
        <div className="timeup-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </OverlayShell>
  );
}

/* ------------------------------------------------------------------ */
/* Level clear                                                         */
/* ------------------------------------------------------------------ */

export function LevelCompleteOverlay({
  snapshot,
  meta,
  onNext,
  onMenu,
}: {
  snapshot: HudSnapshot;
  meta: LevelCompletionMeta | null;
  onNext: () => void;
  onMenu: () => void;
}) {
  const completion = snapshot.completion;
  if (!completion) return null;
  const survivors = completion.playerLives.filter((lives) => lives > 0).length || 1;
  const popTotal = completion.levelBaseScores.reduce((a, b) => a + b, 0);
  const timeTotal = completion.timeBonus * survivors;
  const clearTotal = completion.completionBonus * survivors;
  const theme = themeOf(snapshot);
  return (
    <OverlayShell label={`Level ${completion.levelNumber} clear`} tone="win" wide>
      <div className="dialog-topline win" />
      <p className="dialog-eyebrow" style={{ color: theme.accent }}>
        ARENA SECURED // {completion.levelId}
      </p>
      <h2 className="dialog-title">LEVEL CLEAR</h2>
      <p className="dialog-subtitle">
        {completion.levelTitle} is quiet. For now.
      </p>
      <div className="bonus-grid">
        <div className="bonus-cell">
          <span>Pop score</span>
          <strong>{formatScore(popTotal)}</strong>
        </div>
        <div className="bonus-cell">
          <span>Time bonus</span>
          <strong>+{formatScore(timeTotal)}</strong>
        </div>
        <div className="bonus-cell">
          <span>Clear bonus</span>
          <strong>+{formatScore(clearTotal)}</strong>
        </div>
        <div className="bonus-cell is-highlight">
          <span>Level total</span>
          <strong>{formatScore(completion.levelTotal)}</strong>
        </div>
      </div>
      {snapshot.players.length > 1 && (
        <div className="player-breakdown">
          {snapshot.players.map((player) => (
            <div key={player.index}>
              <span>P{player.index + 1} total</span>
              <strong>{formatScore(completion.playerScores[player.index] ?? 0)}</strong>
            </div>
          ))}
          <div>
            <span>Team score</span>
            <strong>{formatScore(completion.teamScore)}</strong>
          </div>
        </div>
      )}
      <div className="completion-meta">
        <div className="score-medal">
          <span>RUN SCORE</span>
          <strong>{formatScore(completion.teamScore)}</strong>
        </div>
        <div className="completion-badges">
          {meta?.unlockedLevel && (
            <span className="badge badge-unlock">
              <IconCheck size={13} /> LEVEL {meta.unlockedLevel} UNLOCKED
            </span>
          )}
          {meta?.newLevelBest && (
            <span className="badge badge-gold">
              <IconStar size={13} /> NEW LEVEL BEST
            </span>
          )}
          {meta?.newCampaignBest && (
            <span className="badge badge-gold">
              <IconTrophy size={13} /> NEW RUN BEST
            </span>
          )}
        </div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={onNext} autoFocus>
          NEXT LEVEL
          <span className="btn-arrow">→</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={onMenu}>
          <IconHome size={15} />
          Main Menu
        </button>
      </div>
    </OverlayShell>
  );
}

/* ------------------------------------------------------------------ */
/* Game over                                                           */
/* ------------------------------------------------------------------ */

export function GameOverOverlay({
  snapshot,
  meta,
  onRetry,
  onMenu,
}: {
  snapshot: HudSnapshot;
  meta: RunEndMeta | null;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const run = snapshot.runResult;
  if (!run) return null;
  const endless = run.mode === 'endless';
  return (
    <OverlayShell label="Game over" tone="danger">
      <div className="dialog-topline danger" />
      <p className="dialog-eyebrow danger-text">
        {run.reason === 'timeout' ? 'CONTAINMENT FAILURE' : 'COURIER SIGNAL LOST'}
      </p>
      <h2 className="dialog-title">GAME OVER</h2>
      <p className="dialog-subtitle">
        {endless
          ? `The endless surge finally broke through on wave ${run.wave}.`
          : run.reason === 'timeout'
            ? 'The clock ran dry with orbs still in the air.'
            : 'The arena got the last bounce.'}
      </p>
      <div className="final-score">
        <span>FINAL SCORE</span>
        <strong>{formatScore(run.finalScore)}</strong>
        {meta?.newBest && (
          <span className="badge badge-gold">
            <IconTrophy size={13} /> NEW BEST
          </span>
        )}
      </div>
      <div className="run-stats">
        <div>
          <span>{endless ? 'WAVE REACHED' : 'LEVELS CLEARED'}</span>
          <strong>{endless ? pad2(run.wave) : run.levelsCompleted}</strong>
        </div>
        <div>
          <span>BEST {endless ? 'ENDLESS' : 'RUN'}</span>
          <strong>{formatScore(meta?.bestScore ?? 0)}</strong>
        </div>
        <div>
          <span>ORBS POPPED</span>
          <strong>{formatScore(run.stats.pops)}</strong>
        </div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
          <IconRestart size={16} />
          {endless ? 'RETRY RUN' : 'RETRY LEVEL'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onMenu}>
          <IconHome size={15} />
          Main Menu
        </button>
      </div>
    </OverlayShell>
  );
}

/* ------------------------------------------------------------------ */
/* Campaign complete                                                   */
/* ------------------------------------------------------------------ */

export function CampaignCompleteOverlay({
  snapshot,
  meta,
  onReplay,
  onMenu,
}: {
  snapshot: HudSnapshot;
  meta: { newBest: boolean } | null;
  onReplay: () => void;
  onMenu: () => void;
}) {
  const campaign = snapshot.campaignResult;
  if (!campaign) return null;
  const theme = THEMES.cosmic;
  return (
    <OverlayShell label="Campaign complete" tone="win" wide>
      <div className="dialog-topline win" />
      <div className="campaign-stars" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ ['--i' as string]: i }} />
        ))}
      </div>
      <p className="dialog-eyebrow" style={{ color: theme.accent }}>
        ALL 24 ARENAS CLEARED
      </p>
      <h2 className="dialog-title victory-title">ORB CHAOS CONTROLLED</h2>
      <p className="dialog-subtitle">
        The cores are quiet. The last courier is standing. The arcade is yours.
      </p>
      <div className="victory-orb" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="final-score victory-score">
        <span>CAMPAIGN SCORE</span>
        <strong>{formatScore(campaign.finalScore)}</strong>
        {meta?.newBest && (
          <span className="badge badge-gold">
            <IconTrophy size={13} /> NEW CAMPAIGN BEST
          </span>
        )}
      </div>
      <div className="run-stats">
        <div>
          <span>LEVELS CLEARED</span>
          <strong>24</strong>
        </div>
        <div>
          <span>ORBS POPPED</span>
          <strong>{formatScore(campaign.stats.pops)}</strong>
        </div>
        <div>
          <span>DAMAGE TAKEN</span>
          <strong>{formatScore(campaign.stats.damageTaken)}</strong>
        </div>
        <div>
          <span>PICKUPS</span>
          <strong>{formatScore(campaign.stats.pickups)}</strong>
        </div>
      </div>
      <p className="victory-copy">
        Thank you for playing <strong>POPBOUND: ORB CHAOS</strong>. Take another run and chase a
        cleaner score.
      </p>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={onReplay} autoFocus>
          PLAY AGAIN
        </button>
        <button type="button" className="btn btn-ghost" onClick={onMenu}>
          <IconHome size={15} />
          Main Menu
        </button>
      </div>
    </OverlayShell>
  );
}

/* ------------------------------------------------------------------ */
/* Confirmation                                                        */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="game-overlay game-overlay-stacked">
      <div className="dialog dialog-confirm" role="alertdialog" aria-modal="true" aria-label={title}>
        <p className="dialog-eyebrow danger-text">HOLD ON</p>
        <h2 className="dialog-title dialog-title-small">{title}</h2>
        <p className="dialog-subtitle">{body}</p>
        <div className="dialog-actions">
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
