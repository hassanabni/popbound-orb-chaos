import type { KeyBindings } from '../game/types';
import { PICKUPS, PICKUP_ORDER } from '../game/pickups';
import { WEAPONS, WEAPON_ORDER } from '../game/weapons';
import { keyLabel } from '../game/constants';
import { KeyCap, ScreenHeader } from './common';
import { PickupIcon, WeaponIcon } from './icons';

export function HowToPlay({
  onBack,
  bindings,
}: {
  onBack: () => void;
  bindings: KeyBindings;
}) {
  const p1 = bindings.p1;
  const p2 = bindings.p2;
  return (
    <div className="screen howto-screen">
      <div className="panel-scroll">
        <ScreenHeader
          eyebrow="FIELD MANUAL"
          title="How to Play"
          subtitle="Everything a POPBOUND courier needs before stepping onto the containment floor."
          onBack={onBack}
        />

        <section className="manual-hero panel" aria-labelledby="manual-basics">
          <p className="panel-eyebrow">THE LOOP</p>
          <h2 id="manual-basics" className="manual-title">
            Split. Dodge. Survive.
          </h2>
          <p className="manual-lede">
            You stand on the arena floor and fire straight up. Every orb you hit splits into two
            smaller, faster orbs. Keep splitting until the smallest sparks vanish. If any orb
            touches you, you lose a life.
          </p>
          <div className="split-chain" aria-label="Orb splitting chain">
            <div className="chain-step">
              <span className="chain-orb tier-0" aria-hidden="true" />
              <strong>Tier 0</strong>
              <span>Large · slow</span>
            </div>
            <span className="chain-arrow" aria-hidden="true">×2 →</span>
            <div className="chain-step">
              <span className="chain-orb tier-1" aria-hidden="true" />
              <strong>Tier 1</strong>
              <span>Medium · quicker</span>
            </div>
            <span className="chain-arrow" aria-hidden="true">×2 →</span>
            <div className="chain-step">
              <span className="chain-orb tier-2" aria-hidden="true" />
              <strong>Tier 2</strong>
              <span>Small · fast</span>
            </div>
            <span className="chain-arrow" aria-hidden="true">×2 →</span>
            <div className="chain-step">
              <span className="chain-orb tier-3" aria-hidden="true" />
              <strong>Tier 3</strong>
              <span>Tiny · dangerous</span>
            </div>
            <span className="chain-arrow" aria-hidden="true">POP</span>
          </div>
          <p className="manual-note">
            One hit removes exactly one orb. The two children are launched apart with fresh upward
            speed. Smaller orbs bounce lower but move faster horizontally.
          </p>
        </section>

        <div className="manual-grid">
          <section className="panel" aria-labelledby="manual-controls">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">CONTROLS</p>
                <h2 id="manual-controls">Ground crew</h2>
              </div>
              <span className="panel-chip">KEYBOARD</span>
            </div>
            <div className="control-columns">
              <div>
                <h3 className="control-player p1-color">PLAYER 1</h3>
                <dl className="control-list">
                  <div>
                    <dt>Move</dt>
                    <dd>
                      <KeyCap>{keyLabel(p1.left)}</KeyCap>
                      <KeyCap>{keyLabel(p1.right)}</KeyCap>
                    </dd>
                  </div>
                  <div>
                    <dt>Fire</dt>
                    <dd>
                      <KeyCap>{keyLabel(p1.fire)}</KeyCap>
                      <span className="control-hint">hold to auto-fire</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Weapons</dt>
                    <dd className="key-group">
                      {p1.weapons.map((code, i) => (
                        <KeyCap key={i}>{keyLabel(code)}</KeyCap>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt>Pause</dt>
                    <dd>
                      <KeyCap>Esc</KeyCap> or <KeyCap>P</KeyCap>
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="control-player p2-color">PLAYER 2 · CO-OP</h3>
                <dl className="control-list">
                  <div>
                    <dt>Move</dt>
                    <dd>
                      <KeyCap>{keyLabel(p2.left)}</KeyCap>
                      <KeyCap>{keyLabel(p2.right)}</KeyCap>
                    </dd>
                  </div>
                  <div>
                    <dt>Fire</dt>
                    <dd>
                      <KeyCap>{keyLabel(p2.fire)}</KeyCap>
                    </dd>
                  </div>
                  <div>
                    <dt>Weapons</dt>
                    <dd className="key-group">
                      {p2.weapons.map((code, i) => (
                        <KeyCap key={i}>{keyLabel(code)}</KeyCap>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt>Reminder</dt>
                    <dd className="control-hint">Keys can be rebound in Settings.</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="touch-strip">
              <span className="touch-badge">TOUCH</span>
              <p>
                On phones and tablets, hold the on-screen arrows to move, hold <strong>FIRE</strong>{' '}
                to shoot, and tap <strong>WEAPON</strong> to cycle your loadout. Pause lives in the
                top HUD. Rotate to landscape for a wider arena.
              </p>
            </div>
          </section>

          <section className="panel" aria-labelledby="manual-rules">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">SURVIVAL</p>
                <h2 id="manual-rules">Clock &amp; lives</h2>
              </div>
              <span className="panel-chip">RULES</span>
            </div>
            <ul className="rule-list">
              <li>
                <strong>Time limit.</strong> Each arena has a countdown. Clear every orb before it
                reaches zero. The bar turns critical in the final ten seconds.
              </li>
              <li>
                <strong>Time's up.</strong> Every active courier loses one life. If anyone still
                has lives, the arena resets with a fresh clock and the current attempt's score is
                returned to the level starting score. No timeout farming.
              </li>
              <li>
                <strong>Contact.</strong> Touching any orb costs a life. A short invulnerability
                window and a safe respawn prevent one collision from draining multiple lives.
              </li>
              <li>
                <strong>Lives.</strong> Easy starts with 4, Normal with 3, Hard with 2. Extra Life
                pickups can raise you above the starting amount, up to the displayed maximum.
              </li>
              <li>
                <strong>Level clear.</strong> The arena is only complete when zero orbs remain.
                Completing a level banks pop points, a clear bonus and a per-second time bonus.
              </li>
              <li>
                <strong>Co-op.</strong> A downed player sits out the rest of that arena; surviving
                players can still clear it. Both couriers return on the next level. The run ends
                only when both are down at once.
              </li>
              <li>
                <strong>Endless.</strong> Waves keep arriving with more, faster orbs and smaller
                reaction windows. Time is reset between waves, but lives are not. A failed clock
                costs a life and restarts the current wave — with its score reset.
              </li>
            </ul>
          </section>
        </div>

        <section className="panel" aria-labelledby="manual-weapons">
          <div className="panel-heading">
            <div>
              <p className="panel-eyebrow">LOADOUT</p>
              <h2 id="manual-weapons">Four ways to split</h2>
            </div>
            <span className="panel-chip">COOLDOWNS</span>
          </div>
          <div className="manual-card-grid weapons-grid">
            {WEAPON_ORDER.map((id, index) => {
              const weapon = WEAPONS[id];
              return (
                <article className="manual-card weapon-card" key={id} style={{ ['--card-accent' as string]: weapon.color }}>
                  <div className="manual-card-head">
                    <span className="manual-icon" aria-hidden="true">
                      <WeaponIcon weapon={id} size={26} />
                    </span>
                    <div>
                      <span className="manual-card-kicker">SLOT {index + 1}</span>
                      <h3>{weapon.name}</h3>
                    </div>
                    <span className="cooldown-badge">{weapon.cooldown.toFixed(2)}s</span>
                  </div>
                  <p>{weapon.description}</p>
                </article>
              );
            })}
          </div>
          <p className="manual-note">
            All four weapons split orbs. Use the Pulse Harpoon for precision, the Anchor Web to lock
            down a lane, the Prism Beam to clear a packed column instantly, and Arc Mines to guard
            your feet while you reposition. Dual Shot doubles the next firing effect.
          </p>
        </section>

        <section className="panel" aria-labelledby="manual-pickups">
          <div className="panel-heading">
            <div>
              <p className="panel-eyebrow">SALVAGE</p>
              <h2 id="manual-pickups">Pickups</h2>
            </div>
            <span className="panel-chip">DROP CHANCE</span>
          </div>
          <div className="manual-card-grid pickups-grid">
            {PICKUP_ORDER.map((type) => {
              const pickup = PICKUPS[type];
              return (
                <article className="manual-card pickup-card" key={type} style={{ ['--card-accent' as string]: pickup.color }}>
                  <div className="manual-card-head">
                    <span className="manual-icon" aria-hidden="true">
                      <PickupIcon type={type} size={24} />
                    </span>
                    <h3>{pickup.name}</h3>
                  </div>
                  <p>{pickup.description}</p>
                </article>
              );
            })}
          </div>
          <p className="manual-note">
            Pickups fall, bounce, and expire after about 13 seconds. Only pickups you touch are
            yours; in co-op, the collector gets the benefit. Temporary effects freeze while the
            game is paused. Timers are always visible in the HUD.
          </p>
        </section>

        <div className="manual-grid manual-grid-bottom">
          <section className="panel" aria-labelledby="manual-scoring">
            <p className="panel-eyebrow">SCORING</p>
            <h2 id="manual-scoring">Make every shot count</h2>
            <ul className="rule-list compact">
              <li>Tier 0 pop: <strong>10</strong> · Tier 1: <strong>20</strong></li>
              <li>Tier 2 pop: <strong>35</strong> · Tier 3: <strong>60</strong></li>
              <li>Level clear bonus and <strong>10 points per remaining second</strong> are added to each surviving player.</li>
              <li>Useful pickups also award points; Score Crystals award 150.</li>
              <li>Each orb pays out once — no duplicate collision scoring.</li>
            </ul>
          </section>
          <section className="panel tips-panel" aria-labelledby="manual-tips">
            <p className="panel-eyebrow">FIELD TIPS</p>
            <h2 id="manual-tips">Courier wisdom</h2>
            <ul className="tips-list">
              <li>Watch the floor shadow of each orb to read where it will land.</li>
              <li>Small orbs are the threat. Clear tier 2 orbs early with the Prism Beam.</li>
              <li>The Anchor Web lasts three seconds and can split an entire column.</li>
              <li>Drop a mine before moving; it arms in under a second.</li>
              <li>Freeze Burst buys time: the orbs stop, but you keep firing.</li>
              <li>In co-op, spread out. A single wide beam can cover both lanes.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
