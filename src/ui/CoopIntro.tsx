import type { KeyBindings, Settings } from '../game/types';
import { DIFFICULTY, keyLabel } from '../game/constants';
import { KeyCap, ScreenHeader } from './common';
import { IconCoop, IconPlay } from './icons';
import { WEAPONS, WEAPON_ORDER } from '../game/weapons';

export function CoopIntro({
  bindings,
  settings,
  onBack,
  onStart,
}: {
  bindings: KeyBindings;
  settings: Settings;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="screen coop-screen">
      <div className="panel-scroll">
        <ScreenHeader
          eyebrow="LOCAL DUO"
          title="Two Couriers. One Arena."
          subtitle="Same screen, shared orbit. Split the load and keep each other alive."
          onBack={onBack}
          actions={
            <span className="version-tag">
              {DIFFICULTY[settings.difficulty].label.toUpperCase()} · {DIFFICULTY[settings.difficulty].lives} LIVES EACH
            </span>
          }
        />

        <section className="coop-hero panel">
          <div className="coop-hero-copy">
            <p className="panel-eyebrow">CO-OP BRIEFING</p>
            <h2>Split the load, not your focus.</h2>
            <p>
              Player 1 and Player 2 share the same arena, the same clock and the same orb swarm.
              Scores are tracked separately. Both players can move, fire and switch weapons at the
              same time — no turn-taking, no shared cooldown.
            </p>
            <div className="coop-facts">
              <div>
                <span>LIVES</span>
                <strong>{DIFFICULTY[settings.difficulty].lives} each</strong>
              </div>
              <div>
                <span>RUN ENDS</span>
                <strong>Both players down</strong>
              </div>
              <div>
                <span>NEXT ARENA</span>
                <strong>Everyone revived</strong>
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-large" onClick={onStart} autoFocus>
              <IconPlay size={18} />
              START CO-OP RUN
            </button>
          </div>
          <div className="coop-art" aria-hidden="true">
            <div className="coop-art-grid" />
            <div className="courier-chip p1">
              <span className="courier-helmet orange">
                <span className="courier-visor teal" />
              </span>
              <span>
                <strong>PLAYER 1</strong>
                <small>ORANGE / TEAL</small>
              </span>
            </div>
            <div className="coop-tether" />
            <div className="courier-chip p2">
              <span className="courier-helmet violet">
                <span className="courier-visor lime" />
              </span>
              <span>
                <strong>PLAYER 2</strong>
                <small>VIOLET / LIME</small>
              </span>
            </div>
            <div className="coop-orb-field">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="coop-art-caption">TWO SIGNALS · ONE CONTAINMENT FIELD</p>
          </div>
        </section>

        <div className="manual-grid">
          <section className="panel" aria-labelledby="coop-controls">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">ASSIGNMENTS</p>
                <h2 id="coop-controls">Shared keyboard</h2>
              </div>
              <IconCoop size={22} />
            </div>
            <div className="control-columns">
              <div className="coop-player-block p1">
                <h3 className="control-player p1-color">PLAYER 1</h3>
                <dl className="control-list">
                  <div>
                    <dt>Move</dt>
                    <dd>
                      <KeyCap>{keyLabel(bindings.p1.left)}</KeyCap>
                      <KeyCap>{keyLabel(bindings.p1.right)}</KeyCap>
                    </dd>
                  </div>
                  <div>
                    <dt>Fire</dt>
                    <dd>
                      <KeyCap>{keyLabel(bindings.p1.fire)}</KeyCap>
                    </dd>
                  </div>
                  <div>
                    <dt>Weapons</dt>
                    <dd className="key-group">
                      {bindings.p1.weapons.map((code, i) => (
                        <KeyCap key={i}>{keyLabel(code)}</KeyCap>
                      ))}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="coop-player-block p2">
                <h3 className="control-player p2-color">PLAYER 2</h3>
                <dl className="control-list">
                  <div>
                    <dt>Move</dt>
                    <dd>
                      <KeyCap>{keyLabel(bindings.p2.left)}</KeyCap>
                      <KeyCap>{keyLabel(bindings.p2.right)}</KeyCap>
                    </dd>
                  </div>
                  <div>
                    <dt>Fire</dt>
                    <dd>
                      <KeyCap>{keyLabel(bindings.p2.fire)}</KeyCap>
                    </dd>
                  </div>
                  <div>
                    <dt>Weapons</dt>
                    <dd className="key-group">
                      {bindings.p2.weapons.map((code, i) => (
                        <KeyCap key={i}>{keyLabel(code)}</KeyCap>
                      ))}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <p className="manual-note">
              Bindings can be changed in Settings. On a single keyboard, look for anti-ghosting
              keys if someone seems to lose input while the other is firing.
            </p>
          </section>

          <section className="panel" aria-labelledby="coop-rules">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">FIELD RULES</p>
                <h2 id="coop-rules">Staying alive together</h2>
              </div>
            </div>
            <ul className="rule-list">
              <li>Both couriers spawn every arena with their own lives and score.</li>
              <li>If one player runs out of lives, the other fights on. A downed courier does not end the run.</li>
              <li>The arena clears when every orb is gone, even if only one player is standing.</li>
              <li>Every courier still alive at the end of a cleared arena gets the clear and time bonuses.</li>
              <li>If every player is down at the same time, the co-op run ends.</li>
              <li>Touch controls drive Player 1 only. For a two-player session, a keyboard is recommended.</li>
            </ul>
            <div className="coop-weapons" aria-label="Weapon slots">
              {WEAPON_ORDER.map((id, i) => (
                <span key={id}>
                  <em>{i + 1}</em> {WEAPONS[id].shortName}
                </span>
              ))}
            </div>
            <button type="button" className="btn btn-glass btn-wide" onClick={onStart}>
              <IconPlay size={15} /> Begin co-op
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
