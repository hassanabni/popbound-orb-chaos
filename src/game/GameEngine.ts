import { Renderer } from './render';
import { InputController } from './input';
import {
  ARENA,
  BUBBLE_LIMITS,
  BUBBLE_PHYSICS,
  BUBBLE_TIERS,
  CAMPAIGN_LEVEL_COUNT,
  DIFFICULTY,
  FIXED_DT,
  HUD_REFRESH,
  MAX_FRAME_DT,
  MAX_SUBSTEPS,
  MINE_POSITION,
  PICKUP_PHYSICS,
  PLAYER,
  READY_TIME,
  TIME_BONUS_PER_SECOND,
  TIME_CRITICAL,
  TIME_UP_OVERLAY,
  WAVE_TRANSITION_TIME,
  WEAPON_PHYSICS,
} from './constants';
import {
  CAMPAIGN_LEVELS,
  generateBubbleSpawns,
  getLevel,
  isFinalLevel,
  makeEndlessLevel,
  MODIFIERS,
  scaleTimeForDifficulty,
} from './levels';
import { PICKUPS, PICKUP_ORDER, rollPickupType } from './pickups';
import {
  BOUNCE_CEILING,
  BOUNCE_FLOOR,
  BOUNCE_WALL,
  bubbleHitsPlayer,
  bubbleIntersectsSegment,
  circleOverlap,
  clamp,
  distanceSquared,
  findSafeSpawnX,
  integrateBubblePhysics,
  integratePlayerMovement,
  segmentCircleHitT,
} from './physics';
import { getTheme } from './themes';
import { WEAPON_ORDER, WEAPONS } from './weapons';
import type {
  ActiveEffectHud,
  ArenaBounds,
  AudioBus,
  Bubble,
  BubbleTier,
  CampaignRecord,
  CompletionRecord,
  EngineEvent,
  GameMode,
  GameState,
  HudSnapshot,
  KeyBindings,
  LevelConfig,
  Mine,
  Particle,
  ParticleKind,
  Pickup,
  PickupType,
  Player,
  RunRecord,
  RunStats,
  ScorePopup,
  Settings,
  SoundId,
  WaveRecord,
  WeaponEffect,
  WeaponId,
} from './types';
import { SILENT_AUDIO } from './types';
import type { TouchAction } from './input';

export interface GameEngineOptions {
  mode: GameMode;
  startLevelIndex?: number;
  settings: Settings;
  bindings: KeyBindings;
  audio?: AudioBus;
  onEvent?: (event: EngineEvent) => void;
  debug?: {
    disableDrops?: boolean;
  };
}

type PausedFrom = 'READY' | 'PLAYING';

const EMPTY_STATS = (): RunStats => ({
  pops: 0,
  splits: 0,
  pickups: 0,
  damageTaken: 0,
  levelsCleared: 0,
  wavesCleared: 0,
});

const EMPTY_COOLDOWNS = (): Record<WeaponId, number> => ({
  pulse: 0,
  web: 0,
  prism: 0,
  mine: 0,
});

/**
 * POPBOUND: ORB CHAOS simulation.
 *
 * The engine owns:
 *  - the fixed-timestep loop and canvas lifecycle
 *  - input sampling, player movement and weapon rules
 *  - bubble physics, recursive splitting and collisions
 *  - pickups, power-up clocks, score and run state
 *  - campaign/endless progression and state transitions
 *
 * React only renders menus/overlays and reads immutable-ish snapshots. Tests
 * instantiate this class headlessly and use the debug helpers at the bottom to
 * prove the core rules without a browser canvas.
 */
export class GameEngine {
  /* Public simulation state — the renderer reads these directly. */
  state: GameState = 'READY';
  mode: GameMode;
  settings: Settings;
  bindings: KeyBindings;
  readonly input = new InputController();
  audio: AudioBus;
  onEvent?: (event: EngineEvent) => void;

  readonly arena: ArenaBounds = ARENA;
  level: LevelConfig = CAMPAIGN_LEVELS[0];
  levelIndex = 0;
  wave = 0;

  players: Player[] = [];
  bubbles: Bubble[] = [];
  effects: WeaponEffect[] = [];
  mines: Mine[] = [];
  pickups: Pickup[] = [];
  particles: Particle[] = [];
  popups: ScorePopup[] = [];

  time = 60;
  timeLimit = 60;
  readyTimer = READY_TIME;
  stateTimer = 0;
  globalFreeze = 0;
  visualTime = 0;
  shake = 0;
  flash = 0;
  warningPulse = 0;
  debugFps = 0;

  completion: CompletionRecord | null = null;
  runResult: RunRecord | null = null;
  campaignResult: CampaignRecord | null = null;
  waveResult: WaveRecord | null = null;
  timeUpLosses: number[] = [];

  stats: RunStats = EMPTY_STATS();
  levelPops = 0;
  levelSpawnedCount = 0;

  canvas: HTMLCanvasElement | null = null;

  private ctx: CanvasRenderingContext2D | null = null;
  private renderer: Renderer | null = null;
  private readonly startLevelIndex: number;
  private pausedFrom: PausedFrom = 'PLAYING';
  private accumulator = 0;
  private hudTimer = 0;
  private lastTimestamp: number | null = null;
  private rafId: number | null = null;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private readonly audioRef: AudioBus;
  private readonly disableDrops: boolean;

  private listeners = new Set<() => void>();
  private snapshot!: HudSnapshot;
  private snapshotVersion = 0;

  private levelStartScores: number[] = [];
  private waveStartScore = 0;
  private clearedLevels = new Set<number>();
  private suddenTriggered = false;
  private lastDropAt = -99;
  private lastCountdownSecond = 99;
  private nextEntityId = 1;

  private readonly handleWindowResize = (): void => this.resizeCanvas();
  private readonly handleVisibility = (): void => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.input.clearTouch();
      if (this.state === 'PLAYING' || this.state === 'READY') this.pause();
    }
  };

  constructor(options: GameEngineOptions) {
    this.mode = options.mode;
    this.settings = { ...options.settings };
    this.bindings = options.bindings;
    this.audioRef = options.audio ?? SILENT_AUDIO;
    this.audio = this.audioRef;
    this.onEvent = options.onEvent;
    this.disableDrops = options.debug?.disableDrops ?? false;
    this.startLevelIndex =
      options.startLevelIndex !== undefined
        ? clamp(Math.floor(options.startLevelIndex), 0, CAMPAIGN_LEVEL_COUNT - 1)
        : 0;
    this.input.setBindings(this.bindings);

    this.beginRun(this.startLevelIndex);
    this.snapshot = this.buildSnapshot();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibility);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Public lifecycle                                                    */
  /* ------------------------------------------------------------------ */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): HudSnapshot => this.snapshot;

  refreshSnapshot(): void {
    this.notifySnapshot();
  }

  attach(canvas: HTMLCanvasElement): void {
    if (typeof window === 'undefined' || !canvas) return;
    if (this.canvas === canvas && this.rafId !== null) return;
    this.detach();
    this.destroyed = false;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderer = new Renderer();
    this.input.attach(window);
    this.audio.setMusicIntensity(0.82);
    this.audio.setPaused(this.state === 'PAUSED');
    window.addEventListener('resize', this.handleWindowResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(canvas);
    }
    this.resizeCanvas();
    this.lastTimestamp = null;
    this.accumulator = 0;
    this.hudTimer = 0;
    this.rafId = requestAnimationFrame(this.frame);
    this.notifySnapshot();
  }

  detach(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleWindowResize);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.input.detach();
    this.canvas = null;
    this.ctx = null;
    this.renderer = null;
    this.lastTimestamp = null;
  }

  destroy(): void {
    this.destroyed = true;
    this.detach();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
    this.listeners.clear();
    this.audio.setPaused(false);
    this.audio.setMusicIntensity(0.6);
  }

  applySettings(settings: Settings): void {
    this.settings = { ...settings };
    if (!settings.screenShake || settings.reducedMotion) this.shake = 0;
    this.notifySnapshot();
  }

  applyBindings(bindings: KeyBindings): void {
    this.bindings = bindings;
    this.input.setBindings(bindings);
  }

  /* ------------------------------------------------------------------ */
  /* Frame loop                                                          */
  /* ------------------------------------------------------------------ */

  private frame = (timestamp: number): void => {
    this.rafId = null;
    if (this.destroyed || !this.canvas) return;
    const previous = this.lastTimestamp;
    this.lastTimestamp = timestamp;
    if (previous !== null) {
      const raw = (timestamp - previous) / 1000;
      if (raw > 0) this.debugFps = this.debugFps * 0.92 + (1 / raw) * 0.08;
      this.update(Math.min(raw, MAX_FRAME_DT));
    }
    this.renderFrame();
    if (!this.destroyed && this.canvas) {
      this.rafId = requestAnimationFrame(this.frame);
    }
  };

  /** Advance the simulation by a wall-clock delta. Capped and fixed-stepped. */
  update(dt: number): void {
    if (this.destroyed) return;
    if (this.state === 'PAUSED') {
      this.accumulator = 0;
      return;
    }
    const safeDt = clamp(Number.isFinite(dt) ? dt : 0, 0, MAX_FRAME_DT);
    this.accumulator += safeDt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.fixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
      if ((this.state as GameState) === 'PAUSED') {
        this.accumulator = 0;
        break;
      }
    }
    if (steps >= MAX_SUBSTEPS) this.accumulator = 0;
  }

  private fixedUpdate(dt: number): void {
    this.visualTime += dt;
    switch (this.state) {
      case 'READY':
        this.tickReady(dt);
        break;
      case 'PLAYING':
        this.tickPlaying(dt);
        break;
      case 'TIME_UP':
        this.tickTimeUp(dt);
        break;
      case 'WAVE_COMPLETE':
        this.tickWaveComplete(dt);
        break;
      case 'LEVEL_COMPLETE':
      case 'GAME_OVER':
      case 'CAMPAIGN_COMPLETE':
        // Gameplay is frozen; only particles and score popups keep breathing.
        break;
      case 'PAUSED':
        return;
      default:
        break;
    }
    this.updateCosmetics(dt);
    this.input.endFrame();
    this.hudTimer += dt;
    if (this.hudTimer >= HUD_REFRESH) {
      this.hudTimer = 0;
      this.notifySnapshot();
    }
  }

  private tickReady(dt: number): void {
    this.readyTimer = Math.max(0, this.readyTimer - dt);
    this.handleWeaponSelection();
    if (this.readyTimer <= 0) {
      this.state = 'PLAYING';
      this.lastCountdownSecond = Math.ceil(this.time);
      this.audio.setMusicIntensity(0.92);
      this.emit({ type: 'state-change', state: 'PLAYING' });
      this.notifySnapshot();
    }
  }

  private tickPlaying(dt: number): void {
    this.time = Math.max(0, this.time - dt);
    this.trackCountdown();
    this.handleWeaponSwitchKeys();
    this.handleSuddenSpeed();

    for (const player of this.players) {
      this.updatePlayerTimers(player, dt);
      if (player.eliminated) continue;
      const axis = this.input.axis(player.index, this.bindings);
      integratePlayerMovement(player, axis, dt, this.arena);
      if (Math.abs(player.vx) > 24) {
        player.facing = player.vx > 0 ? 1 : -1;
        player.walkPhase += dt * (7 + Math.abs(player.vx) / 90);
      } else {
        player.idlePhase += dt * 2.1;
      }
      if (this.input.isFireHeld(player.index, this.bindings)) {
        this.tryFire(player);
      }
    }

    this.updateWeaponEffects(dt);
    this.updateMines(dt);
    this.updateBubbles(dt);
    this.updatePickups(dt);
    this.updateBubblePlayerCollisions();
    this.globalFreeze = Math.max(0, this.globalFreeze - dt);

    this.resolvePlayingOutcome();
  }

  private tickTimeUp(dt: number): void {
    this.stateTimer = Math.max(0, this.stateTimer - dt);
    if (this.stateTimer > 0) return;
    const anyoneAlive = this.players.some((p) => !p.eliminated && p.lives > 0);
    if (!anyoneAlive) {
      this.finishGameOver('timeout');
      return;
    }
    this.restartAfterTimeout();
  }

  private tickWaveComplete(dt: number): void {
    this.stateTimer = Math.max(0, this.stateTimer - dt);
    if (this.stateTimer > 0) return;
    if (this.mode !== 'endless') return;
    this.wave += 1;
    const previousScore = this.players[0]?.score ?? 0;
    this.enterStage(
      makeEndlessLevel(this.wave),
      this.wave - 1,
      [previousScore],
      [this.players[0]?.lives ?? DIFFICULTY[this.settings.difficulty].lives],
      [false],
      this.wave,
    );
    this.notifySnapshot();
  }

  private resolvePlayingOutcome(): void {
    if (this.state !== 'PLAYING') return;
    const anyoneAlive = this.players.some((p) => !p.eliminated && p.lives > 0);
    if (!anyoneAlive) {
      this.finishGameOver('eliminated');
      return;
    }
    if (this.bubbles.length === 0 && this.levelSpawnedCount > 0) {
      if (this.mode === 'endless') this.completeWave();
      else this.completeLevel();
      return;
    }
    if (this.time <= 0) {
      this.beginTimeUp();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Player systems                                                      */
  /* ------------------------------------------------------------------ */

  private updatePlayerTimers(player: Player, dt: number): void {
    for (const weapon of WEAPON_ORDER) {
      player.cooldowns[weapon] = Math.max(0, player.cooldowns[weapon] - dt);
    }
    player.invuln = Math.max(0, player.invuln - dt);
    player.dualTimer = Math.max(0, player.dualTimer - dt);
    player.hitTimer = Math.max(0, player.hitTimer - dt);
    player.respawnTimer = Math.max(0, player.respawnTimer - dt);
    player.fireAnim = Math.max(0, player.fireAnim - dt);
    player.muzzle = Math.max(0, player.muzzle - dt);
    player.flash = Math.max(0, player.flash - dt * 3.2);
    player.idlePhase += dt * 1.2;
    if (Math.abs(player.vx) < 10) {
      player.walkPhase += dt * 0.6;
    }
  }

  private handleWeaponSelection(): void {
    for (const player of this.players) {
      if (player.eliminated) continue;
      const selection = this.input.consumeWeaponSelection(player.index, this.bindings);
      if (selection) this.setWeapon(player.index, selection, true);
    }
  }

  private handleWeaponSwitchKeys(): void {
    this.handleWeaponSelection();
  }

  setWeapon(playerIndex: number, weapon: WeaponId, silent = false): boolean {
    const player = this.players[playerIndex];
    if (!player || player.eliminated) return false;
    if (!WEAPON_ORDER.includes(weapon)) return false;
    if (player.weapon === weapon) return false;
    player.weapon = weapon;
    player.fireAnim = Math.max(player.fireAnim, 0.08);
    if (!silent) this.audioRef.play('click');
    this.notifySnapshot();
    return true;
  }

  cycleWeapon(playerIndex: number): boolean {
    const player = this.players[playerIndex];
    if (!player || player.eliminated) return false;
    const index = WEAPON_ORDER.indexOf(player.weapon);
    return this.setWeapon(playerIndex, WEAPON_ORDER[(index + 1) % WEAPON_ORDER.length]);
  }

  setTouchAction(action: TouchAction, down: boolean): void {
    this.input.setTouch(action, down);
  }

  tryFire(player: Player, force = false): boolean {
    if (player.eliminated || player.lives <= 0) return false;
    const config = WEAPONS[player.weapon];
    if (!force && player.cooldowns[player.weapon] > 0) return false;
    player.cooldowns[player.weapon] = config.cooldown;
    player.fireAnim = 0.2;
    player.muzzle = 0.14;
    const dual = player.dualTimer > 0;
    const offsets = dual
      ? [-WEAPON_PHYSICS.dualOffset, WEAPON_PHYSICS.dualOffset]
      : [0];
    const baseY = player.y - 52;

    switch (player.weapon) {
      case 'pulse': {
        for (const offset of offsets) {
          this.effects.push({
            id: this.nextEntityId++,
            owner: player.index,
            weapon: 'pulse',
            x: clamp(player.x + offset, this.arena.left + 8, this.arena.right - 8),
            baseY,
            tipY: baseY,
            maxY: this.arena.top + 12,
            age: 0,
            hold: 0,
            phase: 'extend',
            width: 9,
            hitIds: new Set(),
            hitFlash: 0,
            seed: Math.random() * 1000,
          });
        }
        this.playSound('fire-pulse');
        break;
      }
      case 'web': {
        for (const offset of offsets) {
          this.effects.push({
            id: this.nextEntityId++,
            owner: player.index,
            weapon: 'web',
            x: clamp(player.x + offset, this.arena.left + 8, this.arena.right - 8),
            baseY: player.y - 18,
            tipY: this.arena.top + 8,
            maxY: this.arena.top + 8,
            age: 0,
            hold: WEAPON_PHYSICS.webDuration,
            phase: 'hold',
            width: 11,
            hitIds: new Set(),
            hitFlash: 0,
            seed: Math.random() * 1000,
          });
        }
        this.playSound('fire-web');
        this.addShake(0.7);
        break;
      }
      case 'prism': {
        const hitIds = new Set<number>();
        for (const offset of offsets) {
          const x = clamp(player.x + offset, this.arena.left + 8, this.arena.right - 8);
          for (const bubble of this.bubbles) {
            if (bubble.spawnGuard > 0) continue;
            if (
              bubbleIntersectsSegment(
                bubble,
                x,
                baseY,
                this.arena.top + 8,
                WEAPON_PHYSICS.prismHalfWidth,
              )
            ) {
              hitIds.add(bubble.id);
            }
          }
          this.effects.push({
            id: this.nextEntityId++,
            owner: player.index,
            weapon: 'prism',
            x,
            baseY,
            tipY: this.arena.top + 8,
            maxY: this.arena.top + 8,
            age: 0,
            hold: WEAPON_PHYSICS.prismDuration,
            phase: 'hold',
            width: WEAPON_PHYSICS.prismHalfWidth,
            hitIds: new Set(),
            hitFlash: 0,
            seed: Math.random() * 1000,
          });
        }
        for (const id of hitIds) {
          this.hitBubbleById(id, player.index);
        }
        this.playSound('fire-prism');
        this.addShake(1.1);
        break;
      }
      case 'mine': {
        for (const offset of offsets) {
          const mine: Mine = {
            id: this.nextEntityId++,
            owner: player.index,
            x: clamp(player.x + offset, this.arena.left + 20, this.arena.right - 20),
            y: this.arena.floor - MINE_POSITION.yOffset,
            radius: WEAPON_PHYSICS.mineRadius,
            arm: WEAPON_PHYSICS.mineArm,
            life: WEAPON_PHYSICS.mineLife,
            age: 0,
            phase: 0,
            blast: 0,
            seed: Math.random() * 1000,
          };
          this.mines.push(mine);
        }
        while (
          this.mines.filter((mine) => mine.owner === player.index).length >
          WEAPON_PHYSICS.maxMinesPerPlayer
        ) {
          const oldest = this.mines.findIndex((mine) => mine.owner === player.index);
          if (oldest < 0) break;
          this.mines.splice(oldest, 1);
        }
        this.playSound('fire-mine');
        this.addShake(0.6);
        break;
      }
      default:
        break;
    }
    this.notifySnapshot();
    return true;
  }

  private damagePlayer(player: Player): boolean {
    if (player.eliminated || player.invuln > 0 || player.lives <= 0) return false;
    const theme = getTheme(this.level.theme);

    if (player.shield > 0) {
      player.shield = 0;
      player.invuln = PLAYER.shieldInvulnTime;
      player.flash = 1;
      player.hitTimer = 0.25;
      this.playSound('shield');
      this.burst(player.x, player.y - 38, 40, [theme.accent, '#ffffff'], 18, 'ring');
      this.addShake(2.2);
      this.addPopup(player.x, player.y - 90, 'BLOCKED', '#7dffd0', 1.1);
      this.notifySnapshot();
      return true;
    }

    player.lives = Math.max(0, player.lives - 1);
    this.stats.damageTaken += 1;
    player.flash = 1;
    player.hitTimer = 0.55;
    player.invuln = PLAYER.invulnTime;
    player.respawnTimer = PLAYER.respawnTime;
    player.dualTimer = 0;
    this.flash = Math.max(this.flash, this.settings.reducedMotion ? 0.22 : 0.55);
    this.playSound('hurt');
    this.addShake(7);
    this.burst(player.x, player.y - 38, 30, ['#ff8a5c', '#ffd166', '#ff5e7a'], 24, 'spark');

    if (player.lives <= 0) {
      player.eliminated = true;
      player.lives = 0;
      this.addPopup(player.x, player.y - 100, 'DOWN', '#ff819b', 1.25);
    } else {
      const safeX = findSafeSpawnX(this.bubbles, player.x, this.arena);
      player.x = safeX;
      player.lastSafeX = safeX;
      player.vx = 0;
      this.addPopup(player.x, player.y - 100, `${player.lives} LIVES`, '#ffd166', 1);
    }
    this.notifySnapshot();
    return true;
  }

  private updateBubblePlayerCollisions(): void {
    if (this.state !== 'PLAYING') return;
    for (const player of this.players) {
      if (player.eliminated) continue;
      for (const bubble of this.bubbles) {
        if (bubble.spawnGuard > 0) continue;
        if (bubbleHitsPlayer(bubble, player)) {
          this.damagePlayer(player);
          break;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Bubbles                                                             */
  /* ------------------------------------------------------------------ */

  private updateBubbles(dt: number): void {
    const gravity =
      BUBBLE_PHYSICS.gravity * (this.level.modifier === 'lowGravity' ? 0.74 : 1);
    for (const bubble of this.bubbles) {
      bubble.age += dt;
      bubble.spawnGuard = Math.max(0, bubble.spawnGuard - dt);
      bubble.wobble += bubble.wobbleSpeed * dt;
      bubble.spin += bubble.spinSpeed * dt;
      bubble.squash = Math.max(0, bubble.squash - dt * 2.6);
      if (this.globalFreeze > 0) continue;
      const flags = integrateBubblePhysics(
        bubble,
        dt,
        gravity,
        this.arena,
        BUBBLE_TIERS[bubble.tier],
      );
      if ((flags & BOUNCE_FLOOR) !== 0) {
        bubble.squash = Math.min(0.28, Math.abs(bubble.vy) / 2600 + 0.12);
      } else if ((flags & BOUNCE_WALL) !== 0) {
        bubble.squash = Math.max(bubble.squash, 0.12);
      } else if ((flags & BOUNCE_CEILING) !== 0) {
        bubble.squash = Math.max(bubble.squash, 0.08);
      }
    }
  }

  private hitBubbleById(
    id: number,
    ownerIndex: number,
    options: { suppressDrops?: boolean } = {},
  ): boolean {
    const index = this.bubbles.findIndex((bubble) => bubble.id === id);
    if (index < 0) return false;
    const bubble = this.bubbles[index];
    if (bubble.spawnGuard > 0) return false;
    this.bubbles.splice(index, 1);

    const spec = BUBBLE_TIERS[bubble.tier];
    const owner = this.players[ownerIndex] ?? this.players[0];
    const theme = getTheme(this.level.theme);
    const palette = theme.bubbles[bubble.tier];
    const gained = spec.points;

    if (owner) owner.score += gained;
    this.stats.pops += 1;
    this.levelPops += 1;
    this.addPopup(bubble.x, bubble.y - bubble.r * 0.5, `+${gained}`, palette.light, 1);
    this.burst(bubble.x, bubble.y, bubble.r, [palette.light, palette.mid, palette.core], 14, 'dot');
    this.addShake(bubble.tier === 0 ? 2.8 : bubble.tier === 1 ? 1.8 : 1);
    this.playSound(bubble.tier === 3 ? 'pop-small' : 'split', bubble.tier);

    if (bubble.tier < 3) {
      const childTier = (bubble.tier + 1) as BubbleTier;
      const childSpec = BUBBLE_TIERS[childTier];
      const factor = this.bubbleSpeedFactor();
      for (const side of [-1, 1] as const) {
        const vx =
          side *
          Math.max(
            110,
            childSpec.speed * factor * (0.66 + Math.random() * 0.38) +
              Math.abs(bubble.vx) * 0.18,
          );
        const vy = -Math.min(650, 190 + Math.random() * 170 + childTier * 18);
        const x = clamp(
          bubble.x + side * childSpec.radius * 0.55,
          this.arena.left + childSpec.radius,
          this.arena.right - childSpec.radius,
        );
        const y = clamp(
          bubble.y - childSpec.radius * 0.2,
          this.arena.top + childSpec.radius,
          this.arena.floor - childSpec.radius,
        );
        this.bubbles.push(this.createBubble(childTier, x, y, vx, vy, BUBBLE_PHYSICS.spawnGuard));
      }
      this.stats.splits += 1;
    } else {
      this.burst(bubble.x, bubble.y, bubble.r * 1.6, [palette.light, '#ffffff'], 11, 'ring');
    }

    if (!options.suppressDrops && !this.disableDrops) {
      this.tryDropPickup(bubble);
    }
    return true;
  }

  private createBubble(
    tier: BubbleTier,
    x: number,
    y: number,
    vx: number,
    vy: number,
    spawnGuard = 0,
  ): Bubble {
    const spec = BUBBLE_TIERS[tier];
    return {
      id: this.nextEntityId++,
      tier,
      x,
      y,
      vx,
      vy,
      r: spec.radius,
      hue: Math.random() * 360,
      variant: Math.floor(Math.random() * 3),
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.8 + Math.random() * 1.5,
      spin: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.6),
      squash: 0,
      spawnGuard,
      age: 0,
    };
  }

  private bubbleSpeedFactor(): number {
    const diff = DIFFICULTY[this.settings.difficulty].speedScale;
    const modifier = this.level.modifier === 'turbulence' ? 1.14 : 1;
    const sudden = this.suddenTriggered ? 1.12 : 1;
    return diff * this.level.speed * modifier * sudden;
  }

  private initialBubbleSpeedFactor(): number {
    const diff = DIFFICULTY[this.settings.difficulty].speedScale;
    const modifier = this.level.modifier === 'turbulence' ? 1.14 : 1;
    return diff * this.level.speed * modifier;
  }

  private handleSuddenSpeed(): void {
    if (
      this.level.modifier === 'suddenSpeed' &&
      !this.suddenTriggered &&
      this.time > 0 &&
      this.time <= 15
    ) {
      this.suddenTriggered = true;
      for (const bubble of this.bubbles) {
        bubble.vx *= 1.12;
        bubble.vy *= 1.04;
      }
      this.warningPulse = 1;
      this.addPopup(this.arena.width / 2, 260, 'SPEED SURGE', '#ffb35c', 1.25);
      this.playSound('countdown');
      this.addShake(1.5);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Weapons                                                             */
  /* ------------------------------------------------------------------ */

  private updateWeaponEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      effect.age += dt;
      effect.hitFlash = Math.max(0, effect.hitFlash - dt * 6);
      let finished = false;

      if (effect.weapon === 'pulse') {
        if (effect.phase === 'extend') {
          const newTip = Math.max(effect.maxY, effect.tipY - WEAPON_PHYSICS.pulseSpeed * dt);
          const bubble = this.findFirstBubbleOnSegment(
            effect.x,
            effect.baseY,
            newTip,
            effect.width,
            effect.hitIds,
          );
          if (bubble) {
            effect.hitIds.add(bubble.id);
            effect.tipY = Math.max(newTip, bubble.y);
            effect.phase = 'fade';
            effect.hold = WEAPON_PHYSICS.pulseHold;
            effect.hitFlash = 1;
            this.hitBubbleById(bubble.id, effect.owner);
            this.addShake(1.1);
          } else {
            effect.tipY = newTip;
            if (newTip <= effect.maxY) {
              effect.phase = 'hold';
              effect.hold = WEAPON_PHYSICS.pulseHold;
            }
          }
        } else if (effect.phase === 'hold') {
          const bubble = this.findFirstBubbleOnSegment(
            effect.x,
            effect.baseY,
            effect.tipY,
            effect.width,
            effect.hitIds,
          );
          if (bubble) {
            effect.hitIds.add(bubble.id);
            effect.phase = 'fade';
            effect.hold = WEAPON_PHYSICS.pulseHold;
            effect.hitFlash = 1;
            this.hitBubbleById(bubble.id, effect.owner);
            this.addShake(1.1);
          } else {
            effect.hold -= dt;
            if (effect.hold <= 0) {
              effect.phase = 'fade';
              effect.hold = 0.06;
            }
          }
        } else if (effect.phase === 'fade') {
          effect.hold -= dt;
          finished = effect.hold <= 0;
        }
      } else if (effect.weapon === 'web') {
        if (effect.phase === 'hold') {
          const toHit: number[] = [];
          for (const bubble of this.bubbles) {
            if (effect.hitIds.has(bubble.id)) continue;
            if (bubble.spawnGuard > 0) continue;
            if (
              bubbleIntersectsSegment(
                bubble,
                effect.x,
                effect.baseY,
                effect.tipY,
                effect.width,
              )
            ) {
              effect.hitIds.add(bubble.id);
              toHit.push(bubble.id);
            }
          }
          for (const id of toHit) this.hitBubbleById(id, effect.owner);
          if (toHit.length > 0) {
            effect.hitFlash = 1;
            this.addShake(1.2);
          }
          effect.hold -= dt;
          if (effect.hold <= 0) {
            effect.phase = 'fade';
            effect.hold = 0.14;
          }
        } else if (effect.phase === 'fade') {
          effect.hold -= dt;
          finished = effect.hold <= 0;
        }
      } else if (effect.weapon === 'prism') {
        effect.hold -= dt;
        finished = effect.hold <= 0;
      }

      if (finished) this.effects.splice(i, 1);
    }
  }

  private findFirstBubbleOnSegment(
    x: number,
    baseY: number,
    tipY: number,
    halfWidth: number,
    exclude: Set<number>,
  ): Bubble | null {
    let best: Bubble | null = null;
    let bestT = Infinity;
    for (const bubble of this.bubbles) {
      if (bubble.spawnGuard > 0 || exclude.has(bubble.id)) continue;
      const t = segmentCircleHitT(
        x,
        baseY,
        x,
        tipY,
        bubble.x,
        bubble.y,
        bubble.r + halfWidth,
      );
      if (t >= 0 && t < bestT) {
        bestT = t;
        best = bubble;
      }
    }
    return best;
  }

  private updateMines(dt: number): void {
    for (let i = this.mines.length - 1; i >= 0; i -= 1) {
      const mine = this.mines[i];
      mine.age += dt;
      if (mine.phase === 0) {
        mine.arm -= dt;
        if (mine.arm <= 0) mine.phase = 1;
      } else if (mine.phase === 1) {
        mine.life -= dt;
        const armed = mine.arm <= 0;
        let victim = false;
        if (armed) {
          for (const bubble of this.bubbles) {
            if (bubble.spawnGuard > 0) continue;
            if (
              circleOverlap(
                mine.x,
                mine.y,
                mine.radius,
                bubble.x,
                bubble.y,
                bubble.r,
              )
            ) {
              victim = true;
              break;
            }
          }
        }
        if (victim) {
          mine.phase = 2;
          mine.blast = WEAPON_PHYSICS.mineBlastTime;
          const toHit: number[] = [];
          for (const bubble of this.bubbles) {
            if (bubble.spawnGuard > 0) continue;
            if (
              circleOverlap(
                mine.x,
                mine.y,
                mine.radius + 8,
                bubble.x,
                bubble.y,
                bubble.r,
              )
            ) {
              toHit.push(bubble.id);
            }
          }
          for (const id of toHit) this.hitBubbleById(id, mine.owner);
          const theme = getTheme(this.level.theme);
          this.burst(mine.x, mine.y - 12, mine.radius, [theme.accent, '#a4ff8f', '#ffffff'], 26, 'spark');
          this.addShake(4.5);
          this.playSound('fire-mine');
        } else if (mine.life <= 0) {
          this.mines.splice(i, 1);
        }
      } else if (mine.phase === 2) {
        mine.blast -= dt;
        if (mine.blast <= 0) this.mines.splice(i, 1);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pickups                                                             */
  /* ------------------------------------------------------------------ */

  private tryDropPickup(bubble: Bubble): void {
    if (this.level.pickupChance <= 0) return;
    if (this.pickups.length >= BUBBLE_LIMITS.maxPickups) return;
    if (this.visualTime - this.lastDropAt < BUBBLE_LIMITS.pickupDropCooldown) return;
    const difficultyScale = DIFFICULTY[this.settings.difficulty].pickupScale;
    const modifierScale = this.level.modifier === 'denseDrops' ? 1.65 : 1;
    const chance = clamp(this.level.pickupChance * difficultyScale * modifierScale, 0, 0.85);
    if (Math.random() > chance) return;
    const allMaxLives = this.players.every((p) => p.lives >= p.maxLives);
    const type = rollPickupType(Math.random, allMaxLives);
    this.pickups.push({
      id: this.nextEntityId++,
      type,
      x: bubble.x,
      y: bubble.y,
      vx: (Math.random() - 0.5) * 130,
      vy: -160 - Math.random() * 90,
      r: PICKUP_PHYSICS.radius,
      age: 0,
      ttl: PICKUP_PHYSICS.ttl,
      grounded: false,
      phase: Math.random() * Math.PI * 2,
    });
    this.lastDropAt = this.visualTime;
  }

  private updatePickups(dt: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      pickup.age += dt;
      pickup.phase += dt * 2;
      pickup.vy += PICKUP_PHYSICS.gravity * dt;
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      if (pickup.x - pickup.r < this.arena.left) {
        pickup.x = this.arena.left + pickup.r;
        pickup.vx = Math.abs(pickup.vx) * 0.55;
      } else if (pickup.x + pickup.r > this.arena.right) {
        pickup.x = this.arena.right - pickup.r;
        pickup.vx = -Math.abs(pickup.vx) * 0.55;
      }
      if (pickup.y + pickup.r > this.arena.floor) {
        pickup.y = this.arena.floor - pickup.r;
        pickup.vy = -Math.abs(pickup.vy) * PICKUP_PHYSICS.restitution;
        if (Math.abs(pickup.vy) < 55) {
          pickup.vy = 0;
          pickup.grounded = true;
        }
        pickup.vx *= 0.9;
      }
      if (pickup.y - pickup.r < this.arena.top) {
        pickup.y = this.arena.top + pickup.r;
        pickup.vy = Math.abs(pickup.vy) * 0.5;
      }

      if (pickup.age >= pickup.ttl) {
        this.burst(pickup.x, pickup.y, 18, ['#7e8ea8', '#c4d1e6'], 6, 'dot');
        this.pickups.splice(i, 1);
        continue;
      }

      let collected = false;
      for (const player of this.players) {
        if (player.eliminated) continue;
        if (
          circleOverlap(
            pickup.x,
            pickup.y,
            pickup.r + 8,
            player.x,
            player.y - 32,
            32,
          )
        ) {
          this.collectPickup(player, pickup);
          this.pickups.splice(i, 1);
          collected = true;
          break;
        }
      }
      if (collected) continue;
    }
  }

  private collectPickup(player: Player, pickup: Pickup): void {
    const config = PICKUPS[pickup.type];
    const theme = getTheme(this.level.theme);
    this.stats.pickups += 1;
    let label = config.shortName;
    let color = config.color;
    let points = config.points;

    switch (pickup.type) {
      case 'dual':
        player.dualTimer = Math.max(player.dualTimer, PICKUP_PHYSICS.dualDuration);
        this.playSound('pickup', 0);
        label = 'DUAL SHOT';
        break;
      case 'shield':
        if (player.shield > 0) {
          points += 75;
          label = 'SHIELD +75';
        } else {
          player.shield = 1;
          label = 'SHIELD';
        }
        this.playSound('shield');
        break;
      case 'freeze':
        this.globalFreeze = Math.max(this.globalFreeze, PICKUP_PHYSICS.freezeDuration);
        this.playSound('freeze');
        label = 'FREEZE';
        break;
      case 'time': {
        const gained = Math.max(0, Math.min(PICKUP_PHYSICS.timeBonus, this.timeLimit - this.time));
        if (gained > 0.05) {
          this.time += gained;
          label = `+${Math.round(gained)} SEC`;
          color = '#ffe27a';
        } else {
          points += 75;
          label = 'TIME +75';
        }
        this.playSound('time');
        break;
      }
      case 'life': {
        if (player.lives < player.maxLives) {
          player.lives += 1;
          label = '+1 LIFE';
          this.playSound('pickup-life');
        } else {
          points += 120;
          label = 'MAX LIFE +120';
          this.playSound('pickup', 4);
        }
        break;
      }
      case 'crystal':
      default:
        this.playSound('pickup', PICKUP_ORDER.indexOf('crystal'));
        label = `CRYSTAL +${PICKUP_PHYSICS.scoreCrystal}`;
        break;
    }

    player.score += points;
    this.addPopup(player.x, player.y - 108, label, color, 1.05);
    this.burst(player.x, player.y - 48, 24, [color, config.glow, theme.accent], 13, 'dot');
    this.addShake(0.8);
    this.notifySnapshot();
  }

  /* ------------------------------------------------------------------ */
  /* Cosmetic feedback                                                   */
  /* ------------------------------------------------------------------ */

  private addShake(amount: number): void {
    if (!this.settings.screenShake || this.settings.reducedMotion) return;
    this.shake = clamp(Math.max(this.shake, amount), 0, 13);
  }

  private playSound(sound: SoundId, variant = 0): void {
    try {
      this.audioRef.play(sound, variant);
    } catch {
      // Audio can never interrupt gameplay.
    }
  }

  private addPopup(x: number, y: number, text: string, color: string, scale = 1): void {
    if (this.popups.length >= 30) this.popups.shift();
    this.popups.push({
      x,
      y,
      text,
      color,
      life: 0.95,
      maxLife: 0.95,
      scale,
      vy: -42,
    });
  }

  private burst(
    x: number,
    y: number,
    radius: number,
    colors: string[],
    count: number,
    kind: ParticleKind,
  ): void {
    const motion = this.settings.reducedMotion ? 0.4 : 1;
    const total = Math.max(2, Math.round(count * motion));
    if (this.particles.length >= BUBBLE_LIMITS.maxParticles) return;

    if (kind === 'ring' || kind === 'dot') {
      this.pushParticle({
        x,
        y,
        vx: 0,
        vy: 0,
        life: 0.46,
        maxLife: 0.46,
        size: Math.max(12, radius * 0.9),
        color: colors[0] ?? '#ffffff',
        gravity: 0,
        drag: 0,
        kind: 'ring',
        rotation: 0,
        spin: 0,
      });
    }

    for (let i = 0; i < total; i += 1) {
      if (this.particles.length >= BUBBLE_LIMITS.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = (40 + Math.random() * 260) * (kind === 'spark' ? 1.2 : 1);
      const size =
        kind === 'spark'
          ? 1.5 + Math.random() * 3.5
          : kind === 'shard'
            ? 3 + Math.random() * 5
            : 2 + Math.random() * 4;
      this.pushParticle({
        x: x + (Math.random() - 0.5) * radius * 0.5,
        y: y + (Math.random() - 0.5) * radius * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.35 + Math.random() * 0.55,
        maxLife: 0.9,
        size,
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#ffffff',
        gravity: kind === 'spark' ? 620 : 380,
        drag: 1.4,
        kind: Math.random() < 0.25 ? 'star' : kind === 'ring' ? 'dot' : kind,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 8,
      });
    }
  }

  private pushParticle(particle: Particle): void {
    if (this.particles.length >= BUBBLE_LIMITS.maxParticles) return;
    this.particles.push(particle);
  }

  private updateCosmetics(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 20);
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.warningPulse = Math.max(0, this.warningPulse - dt * 1.35);

    let write = 0;
    for (let read = 0; read < this.particles.length; read += 1) {
      const particle = this.particles[read];
      particle.life -= dt;
      if (particle.life <= 0) continue;
      particle.vy += particle.gravity * dt;
      const damping = Math.max(0, 1 - particle.drag * dt);
      particle.vx *= damping;
      particle.vy *= damping;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.spin * dt;
      this.particles[write] = particle;
      write += 1;
    }
    this.particles.length = write;

    write = 0;
    for (let read = 0; read < this.popups.length; read += 1) {
      const popup = this.popups[read];
      popup.life -= dt;
      if (popup.life <= 0) continue;
      popup.y += popup.vy * dt;
      popup.vy *= Math.max(0, 1 - dt * 1.8);
      this.popups[write] = popup;
      write += 1;
    }
    this.popups.length = write;
  }

  private trackCountdown(): void {
    const second = Math.ceil(this.time);
    if (second !== this.lastCountdownSecond) {
      if (second <= 5 && second > 0) {
        this.playSound('countdown');
        this.warningPulse = Math.max(this.warningPulse, 0.85);
      }
      this.lastCountdownSecond = second;
    }
    if (this.time > 0 && this.time <= TIME_CRITICAL) {
      this.warningPulse = Math.max(this.warningPulse, 0.22);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Outcomes and transitions                                            */
  /* ------------------------------------------------------------------ */

  private beginTimeUp(): void {
    if (this.state !== 'PLAYING') return;
    this.time = 0;
    const losses: number[] = [];
    for (const player of this.players) {
      if (player.eliminated) continue;
      player.lives = Math.max(0, player.lives - 1);
      player.flash = 1;
      player.hitTimer = 0.5;
      losses.push(player.index);
      if (player.lives <= 0) player.eliminated = true;
    }
    this.timeUpLosses = losses;
    this.warningPulse = 1;
    this.flash = Math.max(this.flash, 0.5);
    this.addShake(4);
    this.playSound('hurt');
    this.effects.length = 0;
    this.mines.length = 0;
    this.state = 'TIME_UP';
    this.stateTimer = TIME_UP_OVERLAY;
    this.emit({ type: 'state-change', state: 'TIME_UP' });
    this.notifySnapshot();
  }

  private restartAfterTimeout(): void {
    const lives = this.players.map((p) => p.lives);
    const eliminated = this.players.map((p) => p.eliminated || p.lives <= 0);
    const scores =
      this.mode === 'endless'
        ? [this.waveStartScore]
        : this.levelStartScores.length > 0
          ? [...this.levelStartScores]
          : this.players.map(() => 0);
    this.enterStage(
      this.level,
      this.levelIndex,
      scores,
      lives,
      eliminated,
      this.mode === 'endless' ? this.wave : 0,
    );
    this.timeUpLosses = [];
    this.notifySnapshot();
  }

  private completeLevel(): void {
    if (this.state !== 'PLAYING') return;
    this.time = Math.max(0, this.time);
    const remaining = Math.ceil(this.time);
    const timeBonus = remaining * TIME_BONUS_PER_SECOND;
    const completionBonus = this.level.completionBonus;
    const survivors = this.players.filter((p) => !p.eliminated);
    const bonusPerPlayer = completionBonus + timeBonus;
    const levelBaseScores = this.players.map((p, i) =>
      Math.max(0, p.score - (this.levelStartScores[i] ?? 0)),
    );
    for (const player of survivors) {
      player.score += bonusPerPlayer;
    }
    const playerScores = this.players.map((p) => p.score);
    const teamScore = playerScores.reduce((a, b) => a + b, 0);
    const levelTotal = levelBaseScores.reduce((a, b) => a + b, 0) + bonusPerPlayer * survivors.length;
    const final = isFinalLevel(this.levelIndex) && this.mode !== 'endless';

    this.clearedLevels.add(this.levelIndex);
    this.stats.levelsCleared = this.clearedLevels.size;
    this.completion = {
      mode: this.mode,
      levelIndex: this.levelIndex,
      levelNumber: this.level.number,
      levelId: this.level.id,
      levelTitle: this.level.title,
      playerScores,
      playerLives: this.players.map((p) => p.lives),
      levelBaseScores,
      timeBonus,
      completionBonus,
      bonusPerPlayer,
      levelTotal,
      teamScore,
      remainingTime: this.time,
      pops: this.levelPops,
      isFinalLevel: final,
    };
    this.effects.length = 0;
    this.mines.length = 0;
    this.playSound('level-complete');
    this.audio.setMusicIntensity(0.55);
    this.addShake(3);
    const theme = getTheme(this.level.theme);
    this.burst(this.arena.width / 2, this.arena.height * 0.35, 80, [theme.accent, theme.accent2, '#ffffff'], 34, 'star');

    if (final) {
      this.campaignResult = {
        mode: this.mode,
        finalScore: teamScore,
        playerScores,
        stats: { ...this.stats },
      };
      this.state = 'CAMPAIGN_COMPLETE';
      this.emit({ type: 'state-change', state: 'CAMPAIGN_COMPLETE' });
      this.emit({ type: 'level-complete', record: this.completion });
      this.emit({ type: 'campaign-complete', record: this.campaignResult });
    } else {
      this.state = 'LEVEL_COMPLETE';
      this.emit({ type: 'state-change', state: 'LEVEL_COMPLETE' });
      this.emit({ type: 'level-complete', record: this.completion });
    }
    this.notifySnapshot();
  }

  private completeWave(): void {
    if (this.state !== 'PLAYING' || this.mode !== 'endless') return;
    const player = this.players[0];
    if (!player) return;
    const remaining = Math.ceil(this.time);
    const timeBonus = remaining * TIME_BONUS_PER_SECOND;
    const waveBonus = this.level.completionBonus;
    const baseScore = Math.max(0, player.score - this.waveStartScore);
    player.score += waveBonus + timeBonus;
    this.stats.wavesCleared += 1;
    this.waveResult = {
      mode: 'endless',
      wave: this.wave,
      levelBaseScore: baseScore,
      timeBonus,
      waveBonus,
      totalScore: player.score,
      remainingTime: this.time,
    };
    this.effects.length = 0;
    this.mines.length = 0;
    this.state = 'WAVE_COMPLETE';
    this.stateTimer = WAVE_TRANSITION_TIME;
    this.playSound('wave-complete');
    this.audio.setMusicIntensity(0.7);
    this.emit({ type: 'state-change', state: 'WAVE_COMPLETE' });
    this.emit({ type: 'wave-complete', record: this.waveResult });
    this.notifySnapshot();
  }

  private finishGameOver(reason: 'eliminated' | 'timeout'): void {
    if (this.state === 'GAME_OVER') return;
    this.stats.levelsCleared = this.clearedLevels.size;
    const finalScore = this.players.reduce((total, p) => total + p.score, 0);
    this.runResult = {
      mode: this.mode,
      finalScore,
      levelsCompleted: this.stats.levelsCleared,
      levelNumber: this.mode === 'endless' ? this.wave : this.level.number,
      wave: this.mode === 'endless' ? this.wave : 0,
      stats: { ...this.stats },
      reason,
    };
    this.state = 'GAME_OVER';
    this.stateTimer = 0;
    this.effects.length = 0;
    this.mines.length = 0;
    this.playSound('game-over');
    this.audio.setMusicIntensity(0.45);
    this.emit({ type: 'state-change', state: 'GAME_OVER' });
    this.emit({ type: 'game-over', record: this.runResult });
    this.notifySnapshot();
  }

  /* ------------------------------------------------------------------ */
  /* Session control                                                     */
  /* ------------------------------------------------------------------ */

  pause(): boolean {
    if (this.state !== 'PLAYING' && this.state !== 'READY') return false;
    this.pausedFrom = this.state;
    this.state = 'PAUSED';
    this.accumulator = 0;
    this.input.releaseAll();
    this.audio.setPaused(true);
    this.emit({ type: 'state-change', state: 'PAUSED' });
    this.notifySnapshot();
    return true;
  }

  resume(): boolean {
    if (this.state !== 'PAUSED') return false;
    this.state = this.pausedFrom;
    this.accumulator = 0;
    this.lastTimestamp = null;
    this.input.releaseAll();
    this.audio.setPaused(false);
    this.emit({ type: 'state-change', state: this.state });
    this.notifySnapshot();
    return true;
  }

  togglePause(): void {
    if (this.state === 'PAUSED') this.resume();
    else this.pause();
  }

  restartLevel(): void {
    if (this.state !== 'PAUSED' && this.state !== 'PLAYING') return;
    this.audio.setPaused(false);
    if (this.mode === 'endless') {
      this.beginRun(0);
      this.notifySnapshot();
      return;
    }
    const baseline =
      this.levelStartScores.length > 0 ? [...this.levelStartScores] : this.players.map(() => 0);
    const lives = this.players.map(() => DIFFICULTY[this.settings.difficulty].lives);
    const eliminated = lives.map(() => false);
    this.enterStage(this.level, this.levelIndex, baseline, lives, eliminated, 0);
    this.notifySnapshot();
  }

  nextLevel(): void {
    if (this.state !== 'LEVEL_COMPLETE' || this.mode === 'endless') return;
    const nextIndex = this.levelIndex + 1;
    if (nextIndex >= CAMPAIGN_LEVEL_COUNT) return;
    const scores = this.players.map((p) => p.score);
    const lives = this.players.map(() => DIFFICULTY[this.settings.difficulty].lives);
    const eliminated = lives.map(() => false);
    this.audio.setPaused(false);
    this.enterStage(getLevel(nextIndex), nextIndex, scores, lives, eliminated, 0);
    this.notifySnapshot();
  }

  retry(): void {
    if (this.state !== 'GAME_OVER') return;
    this.audio.setPaused(false);
    if (this.mode === 'endless') {
      this.beginRun(0);
      this.notifySnapshot();
      return;
    }
    const baseline =
      this.levelStartScores.length > 0 ? [...this.levelStartScores] : this.players.map(() => 0);
    const lives = this.players.map(() => DIFFICULTY[this.settings.difficulty].lives);
    this.enterStage(this.level, this.levelIndex, baseline, lives, lives.map(() => false), 0);
    this.notifySnapshot();
  }

  restartCampaign(): void {
    this.beginRun(0);
    this.audio.setPaused(false);
    this.notifySnapshot();
  }

  private beginRun(startAtLevel: number): void {
    this.stats = EMPTY_STATS();
    this.clearedLevels.clear();
    this.nextEntityId = 1;
    this.completion = null;
    this.runResult = null;
    this.campaignResult = null;
    this.waveResult = null;
    this.timeUpLosses = [];
    if (this.mode === 'endless') {
      this.wave = 1;
      this.enterStage(
        makeEndlessLevel(1),
        0,
        [0],
        [DIFFICULTY[this.settings.difficulty].lives],
        [false],
        1,
      );
    } else {
      const index =
        this.mode === 'coop' ? 0 : clamp(startAtLevel, 0, CAMPAIGN_LEVEL_COUNT - 1);
      const config = getLevel(index);
      const count = this.playerCount();
      const zeroes = Array.from({ length: count }, () => 0);
      const lives = zeroes.map(() => DIFFICULTY[this.settings.difficulty].lives);
      this.enterStage(config, index, zeroes, lives, zeroes.map(() => false), 0);
    }
  }

  private playerCount(): number {
    return this.mode === 'coop' ? 2 : 1;
  }

  private playerStartX(index: number): number {
    if (this.mode === 'coop') return PLAYER.startCoopX[index === 1 ? 1 : 0];
    return PLAYER.startSingleX;
  }

  private createPlayer(
    index: number,
    score: number,
    lives: number,
    eliminated: boolean,
  ): Player {
    const startLives = DIFFICULTY[this.settings.difficulty].lives;
    const maxLives = startLives + PLAYER.maxLivesBonus;
    const safeLives = clamp(Math.floor(lives), 0, maxLives);
    return {
      index,
      x: this.playerStartX(index),
      y: this.arena.floor,
      vx: 0,
      facing: index === 1 ? -1 : 1,
      lives: safeLives,
      maxLives,
      score: Math.max(0, Math.floor(score)),
      weapon: 'pulse',
      cooldowns: EMPTY_COOLDOWNS(),
      invuln: 0,
      shield: 0,
      dualTimer: 0,
      eliminated: eliminated || safeLives <= 0,
      hitTimer: 0,
      respawnTimer: 0,
      fireAnim: 0,
      walkPhase: 0,
      idlePhase: index * 1.8,
      flash: 0,
      muzzle: 0,
      lastSafeX: this.playerStartX(index),
    };
  }

  /**
   * Loads a stage fresh: bubbles, timer, players, power-ups and projectiles.
   * Scores are supplied explicitly so retries can reset the current attempt's
   * score while preserving the session total from previous levels.
   */
  private enterStage(
    config: LevelConfig,
    levelIndex: number,
    scores: number[],
    lives: number[],
    eliminated: boolean[],
    wave: number,
  ): void {
    this.level = config;
    this.levelIndex = clamp(levelIndex, 0, CAMPAIGN_LEVEL_COUNT - 1);
    this.wave = wave;
    this.timeLimit = scaleTimeForDifficulty(config.timeLimit, this.settings.difficulty);
    this.time = this.timeLimit;
    this.readyTimer = READY_TIME;
    this.stateTimer = 0;
    this.levelStartScores = scores.map((score) => Math.max(0, Math.floor(score)));
    this.waveStartScore = this.levelStartScores[0] ?? 0;
    this.levelPops = 0;
    this.dropsReset();
    this.particles = [];
    this.popups = [];
    this.effects = [];
    this.mines = [];
    this.pickups = [];
    this.globalFreeze = 0;
    this.shake = 0;
    this.flash = 0;
    this.warningPulse = 0;
    this.suddenTriggered = false;
    this.timeUpLosses = [];
    this.completion = null;
    this.runResult = null;
    this.campaignResult = null;
    this.waveResult = null;
    this.state = 'READY';
    this.pausedFrom = 'PLAYING';
    this.accumulator = 0;
    this.hudTimer = 0;
    this.lastCountdownSecond = Math.ceil(this.time);

    const count = this.playerCount();
    this.players = Array.from({ length: count }, (_, i) =>
      this.createPlayer(
        i,
        this.levelStartScores[i] ?? 0,
        lives[i] ?? DIFFICULTY[this.settings.difficulty].lives,
        eliminated[i] ?? false,
      ),
    );

    const spawns = generateBubbleSpawns(config, this.initialBubbleSpeedFactor());
    this.bubbles = spawns.map((spawn) =>
      this.createBubble(
        spawn.tier,
        spawn.x,
        spawn.y,
        spawn.vx,
        spawn.vy,
        0.24,
      ),
    );
    this.levelSpawnedCount = this.bubbles.length;
    this.input.clearTouch();
    this.audio.setPaused(false);
  }

  private dropsReset(): void {
    this.lastDropAt = -99;
  }

  /* ------------------------------------------------------------------ */
  /* Snapshot                                                            */
  /* ------------------------------------------------------------------ */

  private notifySnapshot(): void {
    this.snapshotVersion += 1;
    this.snapshot = this.buildSnapshot();
    for (const listener of Array.from(this.listeners)) {
      try {
        listener();
      } catch {
        // A UI listener must never break the simulation.
      }
    }
  }

  private buildSnapshot(): HudSnapshot {
    const effects: ActiveEffectHud[] = [];
    for (const player of this.players) {
      if (player.dualTimer > 0) {
        effects.push({
          key: `dual-${player.index}`,
          type: 'dual',
          label: 'DUAL SHOT',
          color: PICKUPS.dual.color,
          remaining: player.dualTimer,
          player: player.index,
        });
      }
      if (player.shield > 0) {
        effects.push({
          key: `shield-${player.index}`,
          type: 'shield',
          label: 'SHIELD',
          color: PICKUPS.shield.color,
          remaining: 1,
          player: player.index,
        });
      }
    }
    if (this.globalFreeze > 0) {
      effects.push({
        key: 'freeze-global',
        type: 'freeze',
        label: 'FREEZE',
        color: PICKUPS.freeze.color,
        remaining: this.globalFreeze,
        player: 'all',
      });
    }

    const playerHud = this.players.map((player) => {
      const total = WEAPONS[player.weapon].cooldown;
      const remaining = player.cooldowns[player.weapon];
      return {
        index: player.index,
        score: Math.round(player.score),
        lives: player.lives,
        maxLives: player.maxLives,
        weapon: player.weapon,
        cooldownRemaining: remaining,
        cooldownTotal: total,
        cooldownRatio: total <= 0 ? 1 : clamp(1 - remaining / total, 0, 1),
        shield: player.shield,
        dualTimer: player.dualTimer,
        invuln: player.invuln,
        eliminated: player.eliminated,
      };
    });

    return {
      state: this.state,
      mode: this.mode,
      difficulty: this.settings.difficulty,
      levelNumber: this.level.number,
      levelTitle: this.level.title,
      levelSubtitle: this.level.subtitle,
      levelTotal: this.mode === 'endless' ? this.wave : CAMPAIGN_LEVEL_COUNT,
      levelHint: this.level.hint ?? null,
      modifier: this.level.modifier,
      theme: this.level.theme,
      timeRemaining: this.time,
      timeLimit: this.timeLimit,
      timeCritical:
        (this.state === 'PLAYING' || this.state === 'READY') &&
        this.time <= TIME_CRITICAL &&
        this.time > 0,
      readyTimer: this.readyTimer,
      stateTimer: this.stateTimer,
      wave: this.wave,
      players: playerHud,
      effects,
      bubbleCount: this.bubbles.length,
      teamScore: this.players.reduce((total, p) => total + p.score, 0),
      freezeRemaining: this.globalFreeze,
      completion: this.completion,
      runResult: this.runResult,
      campaignResult: this.campaignResult,
      timeUpLosses: [...this.timeUpLosses],
      lastWave: this.waveResult,
      version: this.snapshotVersion,
    };
  }

  private emit(event: EngineEvent): void {
    try {
      this.onEvent?.(event);
    } catch {
      // UI callbacks are isolated from the simulation loop.
    }
  }

  /* ------------------------------------------------------------------ */
  /* Canvas                                                              */
  /* ------------------------------------------------------------------ */

  resizeCanvas(): void {
    if (!this.canvas || typeof window === 'undefined') return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private renderFrame(): void {
    if (!this.ctx || !this.canvas || !this.renderer) return;
    if (this.canvas.width < 2 || this.canvas.height < 2) {
      this.resizeCanvas();
    }
    this.renderer.render(this, this.ctx);
  }

  /* ------------------------------------------------------------------ */
  /* Headless test/debug helpers                                         */
  /* ------------------------------------------------------------------ */

  /** Skip the ready countdown. Used by tests and the debug overlay. */
  debugStart(): void {
    if (this.state !== 'READY') return;
    this.readyTimer = 0;
    this.state = 'PLAYING';
    this.lastCountdownSecond = Math.ceil(this.time);
    this.emit({ type: 'state-change', state: 'PLAYING' });
    this.notifySnapshot();
  }

  debugAdvance(seconds: number): void {
    if (this.state === 'PAUSED') return;
    let remaining = Math.max(0, seconds);
    let guard = 0;
    while (remaining > 1e-6 && guard < 30000) {
      const dt = Math.min(FIXED_DT, remaining);
      this.fixedUpdate(dt);
      remaining -= dt;
      guard += 1;
      if ((this.state as GameState) === 'PAUSED') break;
    }
    this.notifySnapshot();
  }

  debugSpawnBubble(
    tier: BubbleTier,
    x: number,
    y: number,
    vx = 0,
    vy = 0,
    spawnGuard = 0,
  ): Bubble {
    const safeTier = clamp(Math.floor(tier), 0, 3) as BubbleTier;
    const radius = BUBBLE_TIERS[safeTier].radius;
    const bubble = this.createBubble(
      safeTier,
      clamp(x, this.arena.left + radius, this.arena.right - radius),
      clamp(y, this.arena.top + radius, this.arena.floor - radius),
      vx,
      vy,
      spawnGuard,
    );
    this.bubbles.push(bubble);
    this.levelSpawnedCount = Math.max(this.levelSpawnedCount, 1);
    this.notifySnapshot();
    return bubble;
  }

  debugSpawnPickup(type: PickupType, x: number, y: number): Pickup {
    const pickup: Pickup = {
      id: this.nextEntityId++,
      type,
      x: clamp(x, this.arena.left + 30, this.arena.right - 30),
      y: clamp(y, this.arena.top + 30, this.arena.floor - 30),
      vx: 0,
      vy: 0,
      r: PICKUP_PHYSICS.radius,
      age: 0,
      ttl: PICKUP_PHYSICS.ttl,
      grounded: false,
      phase: 0,
    };
    this.pickups.push(pickup);
    this.notifySnapshot();
    return pickup;
  }

  debugHitBubble(id: number, ownerIndex = 0): boolean {
    const result = this.hitBubbleById(id, ownerIndex, { suppressDrops: true });
    this.notifySnapshot();
    return result;
  }

  debugClearBubbles(): void {
    this.bubbles.length = 0;
    this.levelSpawnedCount = Math.max(this.levelSpawnedCount, 1);
    this.notifySnapshot();
  }

  debugSetTime(seconds: number): void {
    this.time = Math.max(0, Math.min(this.timeLimit, seconds));
    this.notifySnapshot();
  }

  debugFire(playerIndex = 0): boolean {
    const player = this.players[playerIndex];
    if (!player) return false;
    const result = this.tryFire(player, true);
    this.notifySnapshot();
    return result;
  }

  debugSetState(state: GameState): void {
    this.state = state;
    this.notifySnapshot();
  }

  debugPlayerHit(playerIndex = 0): boolean {
    const player = this.players[playerIndex];
    if (!player) return false;
    const result = this.damagePlayer(player);
    this.notifySnapshot();
    return result;
  }
}

