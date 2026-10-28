import type { SaveData } from '../game/types';
import {
  CAMPAIGN_LEVELS,
  LEVEL_TIER_LABEL,
  MODIFIERS,
  scaleTimeForDifficulty,
} from '../game/levels';
import { CAMPAIGN_LEVEL_COUNT } from '../game/constants';
import { THEMES } from '../game/themes';
import { formatClock, formatScore, pad2, ScreenHeader } from './common';
import { IconCheck, IconLock, IconPlay } from './icons';

export function LevelSelect({
  save,
  onBack,
  onPlay,
}: {
  save: SaveData;
  onBack: () => void;
  onPlay: (levelIndex: number) => void;
}) {
  const completed = new Set(save.completedLevels);
  const progress = completed.size / CAMPAIGN_LEVEL_COUNT;

  return (
    <div className="screen levels-screen">
      <div className="panel-scroll">
        <ScreenHeader
          eyebrow="CAMPAIGN ARCHIVE"
          title="Level Select"
          subtitle="Replay any unlocked arena. Progress unlocks sequentially; runs continue from the arena you choose."
          onBack={onBack}
          actions={
            <span className="version-tag">
              {completed.size} / {CAMPAIGN_LEVEL_COUNT}
            </span>
          }
        />

        <div className="level-progress-row">
          <div>
            <span className="panel-eyebrow">CAMPAIGN PROGRESS</span>
            <div className="campaign-progress large" aria-hidden="true">
              <span style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
          <div className="level-legend">
            <span>
              <i className="legend-dot is-cleared">
                <IconCheck size={10} />
              </i>{' '}
              Cleared
            </span>
            <span>
              <i className="legend-dot is-open" /> Unlocked
            </span>
            <span>
              <i className="legend-dot is-locked">
                <IconLock size={10} />
              </i>{' '}
              Locked
            </span>
          </div>
        </div>

        <div className="level-grid">
          {CAMPAIGN_LEVELS.map((level, index) => {
            const unlocked = level.number <= save.highestUnlocked || save.campaignCompleted;
            const isCompleted = completed.has(level.number);
            const best = save.levelBestScores[String(level.number)] ?? 0;
            const theme = THEMES[level.theme];
            const modifier = MODIFIERS[level.modifier];
            const time = scaleTimeForDifficulty(level.timeLimit, save.settings.difficulty);
            return (
              <button
                type="button"
                key={level.id}
                className={`level-card${unlocked ? '' : ' is-locked'}${isCompleted ? ' is-cleared' : ''}`}
                style={{ ['--level-accent' as string]: theme.accent }}
                onClick={() => unlocked && onPlay(index)}
                disabled={!unlocked}
                aria-label={`Level ${level.number}: ${level.title}${
                  unlocked
                    ? isCompleted
                      ? `. Cleared. Best ${formatScore(best)}. Replay.`
                      : '. Play level.'
                    : '. Locked. Clear the previous level to unlock.'
                }`}
              >
                <div className="level-card-top">
                  <span className="level-index">{pad2(level.number)}</span>
                  <span className="level-tier">{LEVEL_TIER_LABEL[level.tier]}</span>
                  {isCompleted && (
                    <span className="level-status is-cleared" title="Cleared">
                      <IconCheck size={12} />
                    </span>
                  )}
                  {!unlocked && (
                    <span className="level-status is-locked" title="Locked">
                      <IconLock size={12} />
                    </span>
                  )}
                </div>
                <span className="level-theme" style={{ color: theme.accent }}>
                  {theme.name}
                </span>
                <h2 className="level-title">{level.title}</h2>
                <p className="level-subtitle">{level.subtitle}</p>
                <div className="level-meta">
                  <span>{formatClock(time)}</span>
                  <span>{level.bubbleCount} orbs</span>
                  <span>{modifier.name}</span>
                </div>
                <div className="level-card-footer">
                  <span>
                    {isCompleted
                      ? best > 0
                        ? `BEST ${formatScore(best)}`
                        : 'CLEARED'
                      : unlocked
                        ? 'READY'
                        : `CLEAR LEVEL ${pad2(level.number - 1)}`}
                  </span>
                  {unlocked && (
                    <span className="level-play" aria-hidden="true">
                      <IconPlay size={13} />
                      {isCompleted ? 'REPLAY' : 'PLAY'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="level-footer panel">
          <div>
            <p className="panel-eyebrow">THE FINE PRINT</p>
            <p>
              Beat an arena to unlock the next one. Best scores are tracked per level for solo
              campaign runs. Completing Level 24 ends the campaign and opens the victory screen.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onPlay(save.campaignCompleted ? 0 : Math.max(0, save.highestUnlocked - 1))}
          >
            <IconPlay size={16} />
            {save.campaignCompleted ? 'REPLAY FROM LEVEL 01' : 'PLAY LATEST UNLOCKED'}
          </button>
        </div>
      </div>
    </div>
  );
}
