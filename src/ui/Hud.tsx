import type { GameEngine } from '../game/GameEngine';
import { TIME_CRITICAL } from '../game/constants';
import { MODIFIERS } from '../game/levels';
import { PICKUPS } from '../game/pickups';
import { WEAPONS, WEAPON_ORDER } from '../game/weapons';
import type { ActiveEffectHud, HudSnapshot, PlayerHud, WeaponId } from '../game/types';
import { formatClock, formatScore, modeLabel, pad2 } from './common';
import {
  IconFullscreen,
  IconExitFullscreen,
  IconPause,
  IconHeart,
  PickupIcon,
  WeaponIcon,
} from './icons';

interface HudProps {
  snapshot: HudSnapshot;
  engine: GameEngine;
  isFullscreen: boolean;
  canFullscreen: boolean;
  onPause: () => void;
  onToggleFullscreen: () => void;
}

export function Hud({
  snapshot,
  engine,
  isFullscreen,
  canFullscreen,
  onPause,
  onToggleFullscreen,
}: HudProps) {
  const modifier = MODIFIERS[snapshot.modifier] ?? MODIFIERS.none;
  const timerFraction = Math.max(0, Math.min(1, snapshot.timeRemaining / snapshot.timeLimit));
  const critical =
    snapshot.timeRemaining <= TIME_CRITICAL && snapshot.state === 'PLAYING';
  const pauseDisabled = snapshot.state !== 'PLAYING' && snapshot.state !== 'READY';

  return (
    <header className="hud" data-mode={snapshot.mode}>
      <div className="hud-top">
        <div className="hud-level">
          <div className="hud-kicker">
            <span className="hud-mode">{modeLabel(snapshot.mode)}</span>
            <span className="dot-sep">·</span>
            <span>{snapshot.difficulty.toUpperCase()}</span>
            <span className="hud-orbs">
              <span className="dot-sep">·</span>
              {snapshot.bubbleCount} ORB{snapshot.bubbleCount === 1 ? '' : 'S'}
            </span>
          </div>
          <div className="hud-title-line">
            <span className="hud-level-number">
              {snapshot.mode === 'endless'
                ? `W${pad2(snapshot.wave)}`
                : `${pad2(snapshot.levelNumber)}/${pad2(snapshot.levelTotal)}`}
            </span>
            <h2 title={snapshot.levelTitle}>{snapshot.levelTitle}</h2>
            <span className="modifier-chip" title={modifier.description} style={{ color: modifier.color }}>
              {modifier.name}
            </span>
          </div>
        </div>

        <div className={`hud-timer${critical ? ' is-critical' : ''}`} role="timer" aria-live="off">
          <div className="timer-copy">
            <span>TIME</span>
            <strong>{formatClock(snapshot.timeRemaining)}</strong>
          </div>
          <div
            className="timer-track"
            role="progressbar"
            aria-label="Time remaining"
            aria-valuemin={0}
            aria-valuemax={snapshot.timeLimit}
            aria-valuenow={Math.ceil(snapshot.timeRemaining)}
          >
            <div className="timer-fill" style={{ width: `${timerFraction * 100}%` }} />
            <div className="timer-ticks" aria-hidden="true" />
          </div>
        </div>

        <div className="hud-actions">
          {canFullscreen && (
            <button
              type="button"
              className="icon-btn hud-icon-btn"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={(event) => {
                event.currentTarget.blur();
                onToggleFullscreen();
              }}
            >
              {isFullscreen ? <IconExitFullscreen size={19} /> : <IconFullscreen size={19} />}
            </button>
          )}
          <button
            type="button"
            className="btn btn-small btn-glass pause-btn"
            aria-label="Pause game"
            onClick={(event) => {
              event.currentTarget.blur();
              onPause();
            }}
            disabled={pauseDisabled}
          >
            <IconPause size={16} />
            <span>PAUSE</span>
          </button>
        </div>
      </div>

      <div className={`hud-players players-${snapshot.players.length}`}>
        {snapshot.players.map((player) => (
          <PlayerCard
            key={player.index}
            player={player}
            effects={snapshot.effects.filter(
              (effect) =>
                effect.player === player.index ||
                (effect.player === 'all' && player.index === 0),
            )}
            onWeapon={(weapon) => engine.setWeapon(player.index, weapon)}
          />
        ))}
      </div>
    </header>
  );
}

function PlayerCard({
  player,
  effects,
  onWeapon,
}: {
  player: PlayerHud;
  effects: ActiveEffectHud[];
  onWeapon: (weapon: WeaponId) => void;
}) {
  const weapon = WEAPONS[player.weapon];
  const ready = player.cooldownRemaining <= 0.001;
  return (
    <section
      className={`player-card player-${player.index + 1}${player.eliminated ? ' is-eliminated' : ''}`}
      aria-label={`Player ${player.index + 1} status`}
    >
      <div className="player-card-identity">
        <span className="player-tag">P{player.index + 1}</span>
        <div className="player-score-block">
          <strong>{formatScore(player.score)}</strong>
          <div
            className="lives"
            aria-label={`${player.lives} of ${player.maxLives} lives left`}
          >
            {Array.from({ length: player.maxLives }, (_, i) => (
              <span
                key={i}
                className={`life-heart${i < player.lives ? ' is-full' : ''}`}
                aria-hidden="true"
              >
                <IconHeart size={13} />
              </span>
            ))}
          </div>
        </div>
        {player.eliminated && <span className="out-badge">OUT</span>}
      </div>

      <div className="weapon-dock" role="group" aria-label={`Player ${player.index + 1} weapons`}>
        {WEAPON_ORDER.map((id, index) => (
          <button
            key={id}
            type="button"
            className={`weapon-slot${player.weapon === id ? ' is-active' : ''}`}
            onClick={(event) => {
              event.currentTarget.blur();
              onWeapon(id);
            }}
            aria-label={`Select ${WEAPONS[id].name}`}
            aria-pressed={player.weapon === id}
            title={`${WEAPONS[id].name} — ${WEAPONS[id].description}`}
          >
            <WeaponIcon weapon={id} size={17} />
            <span className="weapon-slot-key">{index + 1}</span>
          </button>
        ))}
      </div>

      <div className="weapon-readout">
        <div className="weapon-readout-top">
          <span style={{ color: weapon.color }}>{weapon.shortName}</span>
          <span className={ready ? 'is-ready' : 'is-cooling'}>
            {ready ? 'READY' : `${player.cooldownRemaining.toFixed(1)}s`}
          </span>
        </div>
        <div className="cooldown-track" aria-hidden="true">
          <div
            className="cooldown-fill"
            style={{
              width: `${player.cooldownRatio * 100}%`,
              background: weapon.color,
            }}
          />
        </div>
        {effects.length > 0 && (
          <div className="effects-inline">
            {effects.map((effect) => {
              const label =
                effect.type === 'shield'
                  ? '1 HIT'
                  : effect.type === 'freeze'
                    ? `${effect.remaining.toFixed(1)}s`
                    : effect.type === 'dual'
                      ? `${Math.ceil(effect.remaining)}s`
                      : '';
              return (
                <span
                  className={`effect-chip effect-${effect.type}`}
                  key={effect.key}
                  title={`${effect.label}${label ? `: ${label}` : ''}`}
                  style={{ ['--effect-color' as string]: effect.color }}
                >
                  {effect.type === 'freeze' ? (
                    <PickupIcon type="freeze" size={12} />
                  ) : effect.type === 'shield' ? (
                    <PickupIcon type="shield" size={12} />
                  ) : (
                    <PickupIcon type="dual" size={12} />
                  )}
                  <span>{effect.label}</span>
                  {label && <strong>{label}</strong>}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
