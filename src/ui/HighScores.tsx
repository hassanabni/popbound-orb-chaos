import type { SaveData } from '../game/types';
import { CAMPAIGN_LEVELS, LEVEL_TIER_LABEL } from '../game/levels';
import { THEMES } from '../game/themes';
import { formatDate, formatScore, modeLabel, pad2, ScreenHeader } from './common';
import {
  IconCoop,
  IconInfinity,
  IconStar,
  IconTrophy,
} from './icons';

export function HighScores({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const levelsWithBest = CAMPAIGN_LEVELS.filter(
    (level) => (save.levelBestScores[String(level.number)] ?? 0) > 0,
  );
  const lastRun = save.lastRun;

  return (
    <div className="screen scores-screen">
      <div className="panel-scroll">
        <ScreenHeader
          eyebrow="RECORDS"
          title="High Scores"
          subtitle="Personal bests, clear records and the lifetime tally. Everything is stored on this device."
          onBack={onBack}
        />

        <div className="score-heroes">
          <article className="score-hero campaign">
            <span className="score-hero-icon">
              <IconTrophy size={24} />
            </span>
            <p>BEST CAMPAIGN</p>
            <strong>{formatScore(save.bestCampaignScore)}</strong>
            <span className="score-hero-foot">
              {save.campaignCompleted ? 'Campaign cleared' : `${save.completedLevels.length} / 24 arenas`}
            </span>
          </article>
          <article className="score-hero coop">
            <span className="score-hero-icon">
              <IconCoop size={24} />
            </span>
            <p>BEST CO-OP</p>
            <strong>{formatScore(save.bestCoopScore)}</strong>
            <span className="score-hero-foot">
              {save.coopCampaignCompleted ? 'Co-op campaign cleared' : 'Shared-screen duos'}
            </span>
          </article>
          <article className="score-hero endless">
            <span className="score-hero-icon">
              <IconInfinity size={26} />
            </span>
            <p>BEST ENDLESS</p>
            <strong>{formatScore(save.bestEndlessScore)}</strong>
            <span className="score-hero-foot">
              Reached wave <strong>{save.bestEndlessWave || '—'}</strong>
            </span>
          </article>
          <article className="score-hero lifetime">
            <span className="score-hero-icon">
              <IconStar size={23} />
            </span>
            <p>ORBS POPPED</p>
            <strong>{formatScore(save.stats.totalPops)}</strong>
            <span className="score-hero-foot">{formatScore(save.stats.totalPickups)} pickups collected</span>
          </article>
        </div>

        <div className="scores-layout">
          <section className="panel level-best-panel" aria-labelledby="level-bests-title">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">PER-ARENA</p>
                <h2 id="level-bests-title">Level bests</h2>
              </div>
              <span className="panel-chip">{levelsWithBest.length} SCORED</span>
            </div>
            {levelsWithBest.length === 0 ? (
              <div className="empty-state">
                <span className="empty-orb" aria-hidden="true" />
                <p>No arena scores yet. Start a campaign and split some orbs.</p>
              </div>
            ) : (
              <div className="best-table" role="table" aria-label="Best score by level">
                <div className="best-row best-head" role="row">
                  <span role="columnheader">ARENA</span>
                  <span role="columnheader">TIER</span>
                  <span role="columnheader">SCORE</span>
                  <span role="columnheader">CLEAR</span>
                </div>
                {CAMPAIGN_LEVELS.map((level) => {
                  const best = save.levelBestScores[String(level.number)] ?? 0;
                  const completed = save.completedLevels.includes(level.number);
                  if (!completed && best === 0) return null;
                  const theme = THEMES[level.theme];
                  return (
                    <div className="best-row" role="row" key={level.id}>
                      <span className="best-level" role="cell">
                        <span className="best-index" style={{ color: theme.accent }}>
                          {pad2(level.number)}
                        </span>
                        <span>
                          <strong>{level.title}</strong>
                          <small>{theme.name}</small>
                        </span>
                      </span>
                      <span role="cell" className="best-tier">
                        {LEVEL_TIER_LABEL[level.tier]}
                      </span>
                      <span role="cell" className="best-score">
                        {best > 0 ? formatScore(best) : '—'}
                      </span>
                      <span role="cell">
                        <span className={`clear-dot${completed ? ' is-clear' : ''}`}>
                          {completed ? 'CLEAR' : '—'}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="scores-side">
            <section className="panel lifetime-panel" aria-labelledby="lifetime-title">
              <div className="panel-heading">
                <div>
                  <p className="panel-eyebrow">CAREER</p>
                  <h2 id="lifetime-title">Lifetime tally</h2>
                </div>
              </div>
              <dl className="lifetime-list">
                <div>
                  <dt>Runs finished</dt>
                  <dd>{formatScore(save.stats.totalRuns)}</dd>
                </div>
                <div>
                  <dt>Levels cleared</dt>
                  <dd>{formatScore(save.stats.totalLevelClears)}</dd>
                </div>
                <div>
                  <dt>Waves survived</dt>
                  <dd>{formatScore(save.stats.totalWaves)}</dd>
                </div>
                <div>
                  <dt>Orbs popped</dt>
                  <dd>{formatScore(save.stats.totalPops)}</dd>
                </div>
                <div>
                  <dt>Pickups grabbed</dt>
                  <dd>{formatScore(save.stats.totalPickups)}</dd>
                </div>
                <div>
                  <dt>Best endless wave</dt>
                  <dd>{save.bestEndlessWave || '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="panel last-run-panel" aria-labelledby="last-run-title">
              <div className="panel-heading">
                <div>
                  <p className="panel-eyebrow">LAST SIGNAL</p>
                  <h2 id="last-run-title">Most recent run</h2>
                </div>
              </div>
              {lastRun ? (
                <div className="last-run">
                  <div className="last-run-mode">
                    <span className={`run-mode run-${lastRun.mode}`}>{modeLabel(lastRun.mode)}</span>
                    <span>{formatDate(lastRun.at)}</span>
                  </div>
                  <strong className="last-run-score">{formatScore(lastRun.score)}</strong>
                  <p>
                    {lastRun.mode === 'endless'
                      ? `Fell on wave ${lastRun.wave}.`
                      : `Reached arena ${pad2(lastRun.level)}.`}
                  </p>
                </div>
              ) : (
                <div className="empty-state compact">
                  <p>No runs logged yet. The arena is waiting.</p>
                </div>
              )}
            </section>

            <div className="record-badges">
              <span className={`record-badge${save.campaignCompleted ? ' is-earned' : ''}`}>
                <IconTrophy size={16} /> Campaign Cleared
              </span>
              <span className={`record-badge${save.coopCampaignCompleted ? ' is-earned' : ''}`}>
                <IconCoop size={16} /> Co-op Cleared
              </span>
              <span className={`record-badge${save.bestEndlessWave >= 10 ? ' is-earned' : ''}`}>
                <IconInfinity size={16} /> Wave 10
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
