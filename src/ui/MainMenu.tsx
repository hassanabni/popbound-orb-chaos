import type { SaveData } from '../game/types';
import { CAMPAIGN_LEVEL_COUNT } from '../game/constants';
import { formatScore, pad2 } from './common';
import {
  CourierArt,
  IconBook,
  IconCoop,
  IconFullscreen,
  IconGrid,
  IconInfinity,
  IconPlay,
  IconSettings,
  IconTrophy,
  LogoMark,
} from './icons';

interface MainMenuProps {
  save: SaveData;
  isFullscreen: boolean;
  canFullscreen: boolean;
  onStartCampaign: (levelIndex: number) => void;
  onStartCoop: () => void;
  onStartEndless: () => void;
  onOpenLevels: () => void;
  onOpenHowTo: () => void;
  onOpenSettings: () => void;
  onOpenScores: () => void;
  onToggleFullscreen: () => void;
}

export function MainMenu({
  save,
  isFullscreen,
  canFullscreen,
  onStartCampaign,
  onStartCoop,
  onStartEndless,
  onOpenLevels,
  onOpenHowTo,
  onOpenSettings,
  onOpenScores,
  onToggleFullscreen,
}: MainMenuProps) {
  const completed = save.completedLevels.length;
  const progress = Math.min(1, completed / CAMPAIGN_LEVEL_COUNT);
  const campaignComplete = save.campaignCompleted || completed >= CAMPAIGN_LEVEL_COUNT;
  const resumeLevel = Math.max(1, Math.min(save.highestUnlocked, CAMPAIGN_LEVEL_COUNT));
  const campaignStartIndex = campaignComplete ? 0 : resumeLevel - 1;
  const campaignLabel = campaignComplete
    ? 'REPLAY CAMPAIGN'
    : completed === 0
      ? 'PLAY CAMPAIGN'
      : 'CONTINUE CAMPAIGN';
  const campaignSub = campaignComplete
    ? 'All 24 arenas cleared — chase a cleaner run'
    : completed === 0
      ? 'Begin at Level 01 · 24 hand-tuned arenas'
      : `Resume at Level ${pad2(resumeLevel)} · ${formatScore(save.bestCampaignScore)} best`;

  return (
    <div className="menu-screen">
      <div className="menu-bg" aria-hidden="true">
        <div className="menu-glow glow-a" />
        <div className="menu-glow glow-b" />
        <div className="menu-grid" />
        <div className="menu-scan" />
        <span className="css-orb orb-a" />
        <span className="css-orb orb-b" />
        <span className="css-orb orb-c" />
        <span className="css-orb orb-d" />
      </div>

      <header className="menu-topbar">
        <div className="brand-lockup">
          <LogoMark size={38} />
          <div>
            <span className="brand-name">POPBOUND</span>
            <span className="brand-sub">ORB CHAOS</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="topbar-note">
            <span className="live-dot" /> LOCAL ARCADE
          </span>
          {canFullscreen && (
            <button
              type="button"
              className="icon-btn topbar-icon"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <IconFullscreen size={19} />
            </button>
          )}
        </div>
      </header>

      <main className="menu-main">
        <div className="menu-columns">
          <section className="menu-copy" aria-labelledby="game-title">
            <p className="menu-kicker">
              <span>NEON ARCADE</span>
              <span className="kicker-line" />
              <span>SPLIT · DODGE · SURVIVE</span>
            </p>
            <h1 id="game-title" className="wordmark" aria-label="POPBOUND: ORB CHAOS">
              <span className="wordmark-main" data-text="POPBOUND">
                POPBOUND
              </span>
              <span className="wordmark-sub">
                ORB <span className="wordmark-colon">:</span> CHAOS
              </span>
            </h1>
            <p className="menu-lede">
              One courier. One tether. A sky full of volatile orbs. Split them down to sparks,
              dodge the chaos, and keep the arena standing.
            </p>

            <div className="mode-launchers">
              <button
                type="button"
                className="mode-card mode-campaign"
                onClick={() => onStartCampaign(campaignStartIndex)}
              >
                <span className="mode-card-icon">
                  <IconPlay size={24} />
                </span>
                <span className="mode-card-body">
                  <span className="mode-card-kicker">
                    SOLO CAMPAIGN
                    {campaignComplete && <span className="cleared-badge">CLEARED</span>}
                  </span>
                  <strong>{campaignLabel}</strong>
                  <span className="mode-card-desc">{campaignSub}</span>
                  <span className="campaign-progress" aria-hidden="true">
                    <span style={{ width: `${progress * 100}%` }} />
                  </span>
                </span>
                <span className="mode-card-side">
                  <span>{pad2(completed)}</span>
                  <small>OF {CAMPAIGN_LEVEL_COUNT}</small>
                </span>
                <span className="mode-card-arrow" aria-hidden="true">
                  →
                </span>
              </button>

              <div className="mode-row">
                <button type="button" className="mode-card mode-small mode-coop" onClick={onStartCoop}>
                  <span className="mode-card-icon small">
                    <IconCoop size={21} />
                  </span>
                  <span className="mode-card-body">
                    <span className="mode-card-kicker">TWO PLAYERS · ONE KEYBOARD</span>
                    <strong>CO-OP RUN</strong>
                    <span className="mode-card-desc">
                      {save.bestCoopScore > 0
                        ? `Best ${formatScore(save.bestCoopScore)} · shared arena, split scores`
                        : 'Share the arena with a second courier'}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className="mode-card mode-small mode-endless"
                  onClick={onStartEndless}
                >
                  <span className="mode-card-icon small">
                    <IconInfinity size={23} />
                  </span>
                  <span className="mode-card-body">
                    <span className="mode-card-kicker">SURVIVAL · WAVE SCALING</span>
                    <strong>ENDLESS SURGE</strong>
                    <span className="mode-card-desc">
                      {save.bestEndlessScore > 0
                        ? `Best ${formatScore(save.bestEndlessScore)} · wave ${save.bestEndlessWave}`
                        : 'How many waves can you keep at bay?'}
                    </span>
                  </span>
                </button>
              </div>

              {completed > 0 && !campaignComplete && resumeLevel > 1 && (
                <button
                  type="button"
                  className="text-link menu-fresh-link"
                  onClick={() => onStartCampaign(0)}
                >
                  Start a fresh campaign run from Level 01
                </button>
              )}
            </div>

            <nav className="utility-nav" aria-label="Game menus">
              <button type="button" className="utility-btn" onClick={onOpenLevels}>
                <IconGrid size={19} />
                <span>
                  <strong>Level Select</strong>
                  <small>{completed} / {CAMPAIGN_LEVEL_COUNT} arenas cleared</small>
                </span>
              </button>
              <button type="button" className="utility-btn" onClick={onOpenHowTo}>
                <IconBook size={19} />
                <span>
                  <strong>How to Play</strong>
                  <small>Rules, weapons &amp; pickups</small>
                </span>
              </button>
              <button type="button" className="utility-btn" onClick={onOpenScores}>
                <IconTrophy size={19} />
                <span>
                  <strong>High Scores</strong>
                  <small>Records &amp; lifetime stats</small>
                </span>
              </button>
              <button type="button" className="utility-btn" onClick={onOpenSettings}>
                <IconSettings size={19} />
                <span>
                  <strong>Settings</strong>
                  <small>Audio, controls &amp; access</small>
                </span>
              </button>
            </nav>
          </section>

          <aside className="menu-art" aria-hidden="true">
            <div className="art-frame">
              <div className="art-grid" />
              <CourierArt />
              <div className="art-tag art-tag-top">
                <span className="status-dot" />
                COURIER // READY
              </div>
              <div className="art-tag art-tag-bottom">
                <span>ORB DENSITY</span>
                <strong>CRITICAL</strong>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="menu-footer">
        <div className="footer-stats">
          <div>
            <span>ARENAS CLEARED</span>
            <strong>
              {pad2(completed)}
              <em>/{CAMPAIGN_LEVEL_COUNT}</em>
            </strong>
          </div>
          <div>
            <span>CAMPAIGN BEST</span>
            <strong>{formatScore(save.bestCampaignScore)}</strong>
          </div>
          <div>
            <span>ENDLESS BEST</span>
            <strong>{formatScore(save.bestEndlessScore)}</strong>
          </div>
          <div>
            <span>ORBS POPPED</span>
            <strong>{formatScore(save.stats.totalPops)}</strong>
          </div>
        </div>
        <p className="footer-note">
          Original vector art · procedural Web Audio · local save
          <span className="footer-sep">/</span>
          Built for keyboard, touch and co-op
        </p>
      </footer>
    </div>
  );
}
