import type { GameEngine } from './GameEngine';
import { ARENA, BUBBLE_TIERS, READY_TIME, TIME_CRITICAL, WEAPON_PHYSICS } from './constants';
import { getTheme, HIGH_CONTRAST_BUBBLES } from './themes';
import type { ThemeSpec } from './themes';
import { PICKUPS } from './pickups';
import { WEAPONS } from './weapons';
import type {
  Bubble,
  Mine,
  Particle,
  Pickup,
  Player,
  ScorePopup,
  ThemeId,
  WeaponEffect,
} from './types';

const DISPLAY_FONT = '"Arial Black", "Avenir Next Heavy", "Helvetica Neue", sans-serif';
const UI_FONT = '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif';
const MONO_FONT = '"SFMono-Regular", "Cascadia Code", Menlo, monospace';

function rgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgb')) return hex;
  let value = hex.replace('#', '').trim();
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (value.length !== 6) return `rgba(255, 255, 255, ${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawStarPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outer: number,
  inner: number,
  rotation = 0,
): void {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function hexPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation = 0,
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = rotation + (i / 6) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Canvas 2D presentation layer. All art is procedural: no downloaded sprites.
 * Backgrounds are cached per theme; bubbles are cached as glossy sprites; the
 * rest is drawn straight into the scaled virtual 1280x720 viewport.
 */
export class Renderer {
  private background: HTMLCanvasElement | null = null;
  private backgroundKey = '';
  private spriteKey = '';
  private bubbleSprites = new Map<string, HTMLCanvasElement>();

  render(engine: GameEngine, ctx: CanvasRenderingContext2D): void {
    const theme = getTheme(engine.level.theme);
    const hc = engine.settings.highContrast;
    const key = `${theme.id}:${hc ? 'hc' : 'normal'}`;
    if (key !== this.backgroundKey) {
      this.backgroundKey = key;
      this.background = this.buildBackground(theme, hc);
      this.bubbleSprites.clear();
      this.spriteKey = key;
    }

    const canvas = ctx.canvas;
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.min(cw / ARENA.width, ch / ARENA.height);
    const offsetX = (cw - ARENA.width * scale) / 2;
    const offsetY = (ch - ARENA.height * scale) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#03050b';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, ARENA.width * scale, ARENA.height * scale);
    ctx.clip();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Shake is expressed in virtual pixels. Respect both toggles.
    let sx = 0;
    let sy = 0;
    if (engine.shake > 0.05 && engine.settings.screenShake && !engine.settings.reducedMotion) {
      const t = engine.visualTime * 93;
      sx = Math.sin(t * 1.37) * engine.shake * 0.55;
      sy = Math.cos(t * 1.93) * engine.shake * 0.42;
    }
    ctx.fillStyle = theme.bgBottom;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.save();
    ctx.translate(sx, sy);

    this.drawBackground(engine, ctx, theme, hc);
    this.drawAmbient(ctx, engine, theme, hc);
    if (engine.mode !== 'endless' && engine.level.number === 24) {
      this.drawFinalArenaAura(ctx, engine, theme, hc);
    }
    this.drawArenaFrame(ctx, engine, theme, hc);
    this.drawFloor(ctx, engine, theme, hc);
    this.drawBubbleShadows(ctx, engine);

    this.drawMines(ctx, engine, theme);
    this.drawPickups(ctx, engine);
    this.drawBubbles(ctx, engine, theme, hc);
    this.drawWeaponEffects(ctx, engine, theme);
    this.drawPlayers(ctx, engine, theme, hc);
    this.drawParticles(ctx, engine);
    this.drawPopups(ctx, engine);

    if (engine.globalFreeze > 0) this.drawFreezeOverlay(ctx, engine, theme);
    this.drawWarningVignette(ctx, engine, theme);
    if (engine.flash > 0.01) {
      ctx.fillStyle = rgba('#ffd9c9', clamp(engine.flash * 0.42, 0, 0.5));
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }
    if (engine.state === 'READY') this.drawReadyOverlay(ctx, engine, theme);
    if (engine.settings.debug) this.drawDebugOverlay(ctx, engine);

    ctx.restore();
    ctx.restore();

    // Letterbox edges get themed scanlines, never pure black slabs.
    ctx.save();
    ctx.globalAlpha = 0.65;
    const edgeGradient = ctx.createLinearGradient(0, 0, 0, ch);
    edgeGradient.addColorStop(0, theme.bgTop);
    edgeGradient.addColorStop(1, '#03050b');
    if (offsetX > 1) {
      ctx.fillStyle = edgeGradient;
      ctx.fillRect(0, 0, offsetX, ch);
      ctx.fillRect(cw - offsetX, 0, offsetX, ch);
    }
    if (offsetY > 1) {
      ctx.fillStyle = edgeGradient;
      ctx.fillRect(0, 0, cw, offsetY);
      ctx.fillRect(0, ch - offsetY, cw, offsetY);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Backgrounds                                                         */
  /* ------------------------------------------------------------------ */

  private buildBackground(theme: ThemeSpec, hc: boolean): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = ARENA.width;
    canvas.height = ARENA.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const gradient = ctx.createLinearGradient(0, 0, 0, ARENA.height);
    gradient.addColorStop(0, theme.bgTop);
    gradient.addColorStop(0.55, theme.bgMid);
    gradient.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    if (hc) {
      ctx.fillStyle = 'rgba(1, 3, 9, 0.55)';
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }

    // Broad atmospheric glows.
    const glowA = ctx.createRadialGradient(320, 190, 20, 320, 190, 560);
    glowA.addColorStop(0, theme.glowA);
    glowA.addColorStop(0.55, rgba(theme.accent, 0.045));
    glowA.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    const glowB = ctx.createRadialGradient(1010, 430, 30, 1010, 430, 520);
    glowB.addColorStop(0, theme.glowB);
    glowB.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    this.drawStarDust(ctx, theme, hc);
    this.drawArenaGrid(ctx, theme, hc);

    switch (theme.id) {
      case 'training':
        this.drawTrainingBackdrop(ctx, theme, hc);
        break;
      case 'crystal':
        this.drawCrystalBackdrop(ctx, theme, hc);
        break;
      case 'reactor':
        this.drawReactorBackdrop(ctx, theme, hc);
        break;
      case 'garden':
        this.drawGardenBackdrop(ctx, theme, hc);
        break;
      case 'cosmic':
      default:
        this.drawCosmicBackdrop(ctx, theme, hc);
        break;
    }

    // Vignette baked into the background.
    const vignette = ctx.createRadialGradient(
      ARENA.width / 2,
      ARENA.height * 0.44,
      220,
      ARENA.width / 2,
      ARENA.height * 0.46,
      760,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.72, 'rgba(0,0,0,0.18)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    return canvas;
  }

  private drawStarDust(ctx: CanvasRenderingContext2D, theme: ThemeSpec, hc: boolean): void {
    if (hc) return;
    for (let i = 0; i < 90; i += 1) {
      const x = hash(i * 1.7) * ARENA.width;
      const y = hash(i * 3.1 + 8) * ARENA.height;
      const size = 0.4 + hash(i * 5.9) * 1.7;
      const alpha = 0.06 + hash(i * 7.3) * 0.22;
      ctx.fillStyle = i % 9 === 0 ? theme.accent : `rgba(230, 242, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawArenaGrid(ctx: CanvasRenderingContext2D, theme: ThemeSpec, hc: boolean): void {
    ctx.save();
    ctx.strokeStyle = hc ? 'rgba(255,255,255,0.035)' : theme.grid;
    ctx.lineWidth = 1;
    const step = 80;
    ctx.beginPath();
    for (let x = ARENA.left; x <= ARENA.right; x += step) {
      ctx.moveTo(x, ARENA.top);
      ctx.lineTo(x, ARENA.floor);
    }
    for (let y = ARENA.top; y <= ARENA.floor; y += step) {
      ctx.moveTo(ARENA.left, y);
      ctx.lineTo(ARENA.right, y);
    }
    ctx.stroke();

    ctx.strokeStyle = rgba(theme.accent, hc ? 0.12 : 0.06);
    ctx.setLineDash([2, 18]);
    ctx.beginPath();
    ctx.moveTo(ARENA.width / 2, ARENA.top);
    ctx.lineTo(ARENA.width / 2, ARENA.floor);
    ctx.stroke();
    ctx.restore();
  }

  private drawTrainingBackdrop(
    ctx: CanvasRenderingContext2D,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    ctx.save();
    // Holographic target rings behind the arena.
    for (let i = 0; i < 3; i += 1) {
      ctx.strokeStyle = rgba(theme.accent, hc ? 0.08 : 0.11 - i * 0.025);
      ctx.lineWidth = i === 0 ? 3 : 1.4;
      ctx.beginPath();
      ctx.arc(ARENA.width / 2, 360, 155 + i * 92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([8, 16]);
      ctx.beginPath();
      ctx.arc(ARENA.width / 2, 360, 118 + i * 92, 0.3, Math.PI * 1.7);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ceiling canopy / gantry.
    ctx.fillStyle = 'rgba(5, 18, 32, 0.9)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.top);
    ctx.fillStyle = rgba(theme.accent, 0.08);
    for (let x = 90; x < ARENA.width; x += 210) {
      roundRectPath(ctx, x, 24, 110, 24, 7);
      ctx.fill();
      ctx.fillStyle = rgba(theme.accent, 0.4);
      ctx.fillRect(x + 10, 34, 40, 3);
      ctx.fillStyle = rgba(theme.accent, 0.08);
    }
    ctx.font = `700 13px ${MONO_FONT}`;
    ctx.fillStyle = rgba(theme.text, 0.42);
    ctx.fillText('SECTOR 01 // CALIBRATION BAY', 76, 78);

    // Side pylons.
    for (const x of [ARENA.left + 24, ARENA.right - 24]) {
      const grad = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
      grad.addColorStop(0, 'rgba(8,20,34,0)');
      grad.addColorStop(0.5, rgba(theme.accent, 0.16));
      grad.addColorStop(1, 'rgba(8,20,34,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 24, ARENA.top, 48, ARENA.floor - ARENA.top);
    }

    // Holographic warning bands.
    ctx.strokeStyle = rgba(theme.accent2, 0.24);
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(150 + i * 18, 92);
      ctx.lineTo(168 + i * 18, 74);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCrystalBackdrop(
    ctx: CanvasRenderingContext2D,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    ctx.save();
    // Distant crystalline arch.
    ctx.strokeStyle = rgba(theme.accent, hc ? 0.07 : 0.13);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ARENA.width / 2, 440, 505, 365, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([4, 14]);
    ctx.beginPath();
    ctx.ellipse(ARENA.width / 2, 440, 430, 310, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hanging crystal clusters outside the playfield ceiling.
    const clusters = [
      { x: 115, w: 58, h: 200, tilt: -0.1 },
      { x: 256, w: 34, h: 120, tilt: 0.16 },
      { x: 1000, w: 62, h: 170, tilt: 0.13 },
      { x: 1130, w: 40, h: 250, tilt: -0.14 },
    ];
    for (const c of clusters) {
      const grad = ctx.createLinearGradient(c.x, 0, c.x, c.h);
      grad.addColorStop(0, rgba(theme.accent, 0.26));
      grad.addColorStop(0.7, rgba(theme.accent2, 0.12));
      grad.addColorStop(1, 'rgba(12, 8, 32, 0)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = rgba(theme.accent, 0.22);
      ctx.lineWidth = 1;
      const top = -10;
      const bottom = Math.min(c.h, ARENA.top + 18);
      ctx.beginPath();
      ctx.moveTo(c.x, top);
      ctx.lineTo(c.x + c.w / 2, bottom - 60);
      ctx.lineTo(c.x, bottom);
      ctx.lineTo(c.x - c.w / 2, bottom - 60);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = rgba(theme.text, 0.09);
      ctx.beginPath();
      ctx.moveTo(c.x, top);
      ctx.lineTo(c.x + c.w * 0.08, bottom - 50);
      ctx.lineTo(c.x, bottom);
      ctx.stroke();
    }

    // Starfield constellations.
    ctx.strokeStyle = rgba(theme.accent2, 0.09);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(430, 180);
    ctx.lineTo(510, 150);
    ctx.lineTo(560, 210);
    ctx.lineTo(680, 170);
    ctx.stroke();
    ctx.restore();
  }

  private drawReactorBackdrop(
    ctx: CanvasRenderingContext2D,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    ctx.save();
    // Great turbine behind the arena, deliberately low contrast.
    const cx = ARENA.width / 2;
    const cy = 330;
    ctx.strokeStyle = rgba(theme.accent, hc ? 0.04 : 0.08);
    ctx.lineWidth = 2;
    for (let ring = 0; ring < 4; ring += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, 160 + ring * 70, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let blade = 0; blade < 12; blade += 1) {
      const angle = (blade / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 90, cy + Math.sin(angle) * 90);
      ctx.lineTo(cx + Math.cos(angle + 0.12) * 380, cy + Math.sin(angle + 0.12) * 380);
      ctx.stroke();
    }
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 210);
    coreGlow.addColorStop(0, rgba(theme.accent, 0.1));
    coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGlow;
    ctx.fillRect(cx - 220, cy - 220, 440, 440);

    // Ceiling pipes and hazard gantry.
    ctx.fillStyle = 'rgba(15, 9, 5, 0.92)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.top);
    for (let i = 0; i < 5; i += 1) {
      const y = 20 + i * 15;
      const grad = ctx.createLinearGradient(0, y, ARENA.width, y);
      grad.addColorStop(0, 'rgba(60, 37, 18, 0.15)');
      grad.addColorStop(0.5, rgba(theme.accent, 0.12));
      grad.addColorStop(1, 'rgba(60, 37, 18, 0.15)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, ARENA.width, 6);
    }
    // Vertical side pipes.
    for (const x of [72, 1208]) {
      ctx.strokeStyle = 'rgba(37, 28, 20, 0.95)';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA.floor);
      ctx.stroke();
      ctx.strokeStyle = rgba(theme.accent, 0.15);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 5, 0);
      ctx.lineTo(x - 5, ARENA.floor);
      ctx.stroke();
    }
    // Warning lamps.
    for (let i = 0; i < 8; i += 1) {
      const x = 140 + i * 142;
      ctx.fillStyle = i % 2 === 0 ? rgba('#ff8c42', 0.4) : rgba(theme.accent2, 0.26);
      ctx.beginPath();
      ctx.arc(x, 90, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGardenBackdrop(
    ctx: CanvasRenderingContext2D,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    ctx.save();
    // Distant canopy.
    const canopy = ctx.createRadialGradient(640, 40, 40, 640, 170, 560);
    canopy.addColorStop(0, rgba(theme.accent, hc ? 0.03 : 0.1));
    canopy.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = canopy;
    ctx.fillRect(0, 0, ARENA.width, 380);

    // Vines from both sides, kept out of the central play space.
    const vine = (startX: number, dir: number, seed: number) => {
      ctx.strokeStyle = rgba(theme.accent, hc ? 0.1 : 0.2);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      for (let i = 1; i <= 6; i += 1) {
        const y = i * 78;
        const x = startX + dir * (18 + Math.sin(i * 1.4 + seed) * 26) * i * 0.6;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let i = 1; i <= 7; i += 1) {
        const y = i * 66;
        const x = startX + dir * (18 + Math.sin(i * 1.4 + seed) * 26) * i * 0.6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(dir * (0.6 + Math.sin(i + seed) * 0.5));
        ctx.fillStyle = rgba(i % 2 === 0 ? theme.accent : theme.accent2, hc ? 0.12 : 0.22);
        ctx.beginPath();
        ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };
    vine(60, 1, 1.3);
    vine(1220, -1, 2.7);

    // Luminous flowers near the ceiling.
    for (let i = 0; i < 7; i += 1) {
      const x = 190 + i * 150;
      const y = 50 + Math.sin(i * 2.1) * 20;
      ctx.fillStyle = rgba(i % 2 === 0 ? theme.accent : theme.accent2, hc ? 0.15 : 0.3);
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(theme.accent, 0.13);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(i) * 18, y + 30);
      ctx.stroke();
    }

    // Soft moss line at the wall bases.
    ctx.fillStyle = rgba(theme.accent, hc ? 0.04 : 0.08);
    ctx.beginPath();
    ctx.moveTo(0, ARENA.floor);
    for (let x = 0; x <= ARENA.width; x += 40) {
      ctx.lineTo(x, ARENA.floor - 16 - hash(x) * 34);
    }
    ctx.lineTo(ARENA.width, ARENA.floor);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawCosmicBackdrop(
    ctx: CanvasRenderingContext2D,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    ctx.save();
    // Nebula bands.
    for (let i = 0; i < 4; i += 1) {
      const grad = ctx.createRadialGradient(
        260 + i * 290,
        200 + (i % 2) * 230,
        10,
        260 + i * 290,
        200 + (i % 2) * 230,
        290,
      );
      grad.addColorStop(0, rgba(i % 2 === 0 ? theme.accent : theme.accent2, hc ? 0.03 : 0.07));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }

    // Containment rings around the arena, far away.
    ctx.strokeStyle = rgba(theme.accent, hc ? 0.05 : 0.11);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      ctx.save();
      ctx.translate(ARENA.width / 2, 360);
      ctx.rotate(i * 0.35);
      ctx.scale(1, 0.32 + i * 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, 430 + i * 104, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // A distant planet with a ring, tucked above the arena ceiling.
    const planetX = 1050;
    const planetY = 48;
    const planetGrad = ctx.createRadialGradient(
      planetX - 18,
      planetY - 16,
      4,
      planetX,
      planetY,
      70,
    );
    planetGrad.addColorStop(0, rgba(theme.accent2, 0.45));
    planetGrad.addColorStop(0.6, rgba(theme.accent, 0.18));
    planetGrad.addColorStop(1, 'rgba(10, 8, 25, 0.02)');
    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(planetX, planetY, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(theme.accent2, 0.22);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(planetX, planetY, 118, 26, -0.24, 0, Math.PI * 2);
    ctx.stroke();

    // Bright stars.
    for (let i = 0; i < 20; i += 1) {
      const x = hash(i * 9.2 + 3) * ARENA.width;
      const y = hash(i * 4.4 + 1) * (ARENA.floor - 50);
      const radius = 0.8 + hash(i * 2.2) * 1.6;
      ctx.fillStyle = rgba('#ffffff', hc ? 0.25 : 0.55);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Layered arena decoration                                            */
  /* ------------------------------------------------------------------ */

  private drawBackground(
    engine: GameEngine,
    ctx: CanvasRenderingContext2D,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    if (this.background) {
      ctx.drawImage(this.background, 0, 0);
      return;
    }
    const grad = ctx.createLinearGradient(0, 0, 0, ARENA.height);
    grad.addColorStop(0, theme.bgTop);
    grad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.fillStyle = rgba(theme.accent, 0.08);
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  }

  private drawAmbient(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    if (hc) return;
    const reduced = engine.settings.reducedMotion;
    const t = reduced ? 0 : engine.visualTime;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const motes = theme.id === 'garden' ? 26 : theme.id === 'cosmic' ? 36 : 20;
    for (let i = 0; i < motes; i += 1) {
      const baseX = hash(i * 3.7 + 2) * ARENA.width;
      const speed = 3 + hash(i * 1.3) * (theme.id === 'reactor' ? 18 : 9);
      const span = ARENA.floor - ARENA.top;
      const y = reduced
        ? ARENA.top + hash(i * 9.1) * span
        : ARENA.top + ((hash(i * 5.3) * span + t * speed * (i % 3 === 0 ? 1 : 0.55)) % span);
      const x = baseX + Math.sin(t * 0.35 + i) * (theme.id === 'garden' ? 22 : 8);
      const size = theme.id === 'reactor' ? 1 + hash(i) * 2.4 : 0.6 + hash(i + 2) * 1.8;
      const alpha = 0.07 + hash(i * 8.1) * 0.12;
      if (theme.id === 'reactor') {
        const ember = ctx.createRadialGradient(x, y, 0, x, y, size * 5);
        ember.addColorStop(0, rgba(theme.accent2, alpha * 3));
        ember.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ember;
        ctx.beginPath();
        ctx.arc(x, y, size * 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (theme.id === 'garden') {
        ctx.fillStyle = rgba(i % 3 === 0 ? theme.accent2 : theme.accent, alpha);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.16 + i);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 3, size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = rgba(i % 4 === 0 ? theme.accent : theme.particle, alpha);
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (theme.id === 'training' && !reduced) {
      const scanY = ARENA.top + ((t * 34) % (ARENA.floor - ARENA.top));
      const scan = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      scan.addColorStop(0, 'rgba(0,0,0,0)');
      scan.addColorStop(0.5, rgba(theme.accent, 0.045));
      scan.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = scan;
      ctx.fillRect(ARENA.left, scanY - 40, ARENA.width - ARENA.left * 2, 80);
    }

    if (theme.id === 'cosmic' && !reduced) {
      const angle = t * 0.09;
      ctx.strokeStyle = rgba(theme.accent2, 0.08);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ARENA.width / 2, 350, 250, angle, angle + 0.8);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** The last arena gets its own containment-core halo, kept clear of orbs. */
  private drawFinalArenaAura(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    const cx = ARENA.width / 2;
    const cy = 360;
    const t = engine.visualTime;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(cx, cy, 20, cx, cy, 510);
    aura.addColorStop(0, rgba(theme.accent2, hc ? 0.025 : 0.07));
    aura.addColorStop(0.45, rgba(theme.accent, hc ? 0.02 : 0.045));
    aura.addColorStop(1, rgba(theme.accent, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    // Slow counter-rotating containment rings.
    for (let i = 0; i < 3; i += 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (i % 2 === 0 ? 0.018 : -0.013) + i * 0.9);
      ctx.scale(1, 0.38 + i * 0.06);
      ctx.strokeStyle = rgba(i === 1 ? theme.accent2 : theme.accent, hc ? 0.09 : 0.15);
      ctx.lineWidth = i === 0 ? 2 : 1.2;
      ctx.setLineDash(i === 0 ? [10, 22] : [2, 28]);
      ctx.beginPath();
      ctx.arc(0, 0, 356 + i * 92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Faint core mark high above the playable lane.
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `800 10px ${MONO_FONT}`;
    ctx.fillStyle = rgba(theme.accent, hc ? 0.35 : 0.28);
    ctx.textAlign = 'center';
    ctx.fillText('ORB CHAOS CORE // CONTAINMENT UNSTABLE', cx, 190);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  private drawArenaFrame(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    ctx.save();
    // Ceiling emitter.
    const topGlow = ctx.createLinearGradient(0, ARENA.top - 26, 0, ARENA.top + 16);
    topGlow.addColorStop(0, 'rgba(0,0,0,0)');
    topGlow.addColorStop(0.65, rgba(theme.accent, hc ? 0.2 : 0.1));
    topGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(ARENA.left, ARENA.top - 26, ARENA.right - ARENA.left, 42);
    ctx.strokeStyle = rgba(theme.accent, hc ? 0.6 : 0.3);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ARENA.left, ARENA.top);
    ctx.lineTo(ARENA.right, ARENA.top);
    ctx.stroke();
    ctx.setLineDash([3, 26]);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(ARENA.left, ARENA.top - 9);
    ctx.lineTo(ARENA.right, ARENA.top - 9);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Side containment rails.
    for (const x of [ARENA.left, ARENA.right]) {
      const rail = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
      rail.addColorStop(0, 'rgba(0,0,0,0)');
      rail.addColorStop(0.5, rgba(theme.wall, hc ? 0.35 : 0.55));
      rail.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rail;
      ctx.fillRect(x - 14, ARENA.top, 28, ARENA.floor - ARENA.top);
      ctx.strokeStyle = rgba(theme.wall, hc ? 0.8 : 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, ARENA.top);
      ctx.lineTo(x, ARENA.floor);
      ctx.stroke();
      ctx.strokeStyle = rgba(theme.text, 0.25);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 30]);
      ctx.beginPath();
      ctx.moveTo(x, ARENA.top + 12);
      ctx.lineTo(x, ARENA.floor - 12);
      ctx.stroke();
      ctx.setLineDash([]);

      // Floor pylon.
      ctx.fillStyle = rgba(theme.floorTop, 0.9);
      roundRectPath(ctx, x - 18, ARENA.floor - 16, 36, 20, 5);
      ctx.fill();
      ctx.strokeStyle = rgba(theme.floorEdge, 0.6);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // Corner brackets read as a high-tech frame.
    ctx.strokeStyle = rgba(theme.accent, hc ? 0.45 : 0.24);
    ctx.lineWidth = 2;
    const corner = 26;
    for (const [x, y, sx, sy] of [
      [ARENA.left + 8, ARENA.top + 8, 1, 1],
      [ARENA.right - 8, ARENA.top + 8, -1, 1],
      [ARENA.left + 8, ARENA.floor - 8, 1, -1],
      [ARENA.right - 8, ARENA.floor - 8, -1, -1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x + corner * sx, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + corner * sy);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFloor(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    ctx.save();
    const floor = ARENA.floor;
    const grad = ctx.createLinearGradient(0, floor, 0, ARENA.height);
    grad.addColorStop(0, theme.floorTop);
    grad.addColorStop(0.35, theme.floorBottom);
    grad.addColorStop(1, '#03050a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, floor, ARENA.width, ARENA.height - floor);

    // Ambient light bouncing off the floor.
    const bounce = ctx.createLinearGradient(0, floor - 24, 0, floor + 22);
    bounce.addColorStop(0, 'rgba(0,0,0,0)');
    bounce.addColorStop(0.6, rgba(theme.floorEdge, hc ? 0.12 : 0.1));
    bounce.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bounce;
    ctx.fillRect(ARENA.left, floor - 24, ARENA.right - ARENA.left, 46);

    // Main edge highlight.
    ctx.strokeStyle = rgba(theme.floorEdge, hc ? 0.95 : 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ARENA.left, floor);
    ctx.lineTo(ARENA.right, floor);
    ctx.stroke();
    ctx.strokeStyle = rgba(theme.floorEdge, 0.16);
    ctx.lineWidth = 8;
    ctx.stroke();

    // Receding panel seams.
    ctx.strokeStyle = rgba(theme.floorEdge, hc ? 0.12 : 0.16);
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i += 1) {
      const x = ARENA.left + 64 + i * 118;
      ctx.beginPath();
      ctx.moveTo(x, floor + 3);
      ctx.lineTo(x + (x - ARENA.width / 2) * 0.12, ARENA.height);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(ARENA.left, floor + 23);
    ctx.lineTo(ARENA.right, floor + 23);
    ctx.stroke();

    // Hazard chevrons at the edges.
    ctx.globalAlpha = hc ? 0.35 : 0.22;
    for (const side of [-1, 1]) {
      const cx = side < 0 ? 120 : ARENA.width - 120;
      ctx.strokeStyle = theme.accent2;
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 18 - 22 * side, floor + 10);
        ctx.lineTo(cx + i * 18, floor + 20);
        ctx.lineTo(cx + i * 18 - 22 * side, floor + 30);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Reflected glow beneath the arena.
    const centreGlow = ctx.createRadialGradient(
      ARENA.width / 2,
      floor,
      10,
      ARENA.width / 2,
      floor,
      460,
    );
    centreGlow.addColorStop(0, rgba(theme.accent, hc ? 0.04 : 0.07));
    centreGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = centreGlow;
    ctx.fillRect(0, floor, ARENA.width, ARENA.height - floor);

    // Subtle floor label.
    ctx.font = `700 10px ${MONO_FONT}`;
    ctx.fillStyle = rgba(theme.text, 0.18);
    ctx.textAlign = 'center';
    ctx.fillText('POPBOUND // CONTAINMENT FLOOR', ARENA.width / 2, ARENA.height - 12);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Bubbles                                                             */
  /* ------------------------------------------------------------------ */

  private drawBubbleShadows(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
    ctx.save();
    for (const bubble of engine.bubbles) {
      const distance = ARENA.floor - bubble.y - bubble.r;
      if (distance > 580) continue;
      const closeness = clamp(1 - distance / 580, 0, 1);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.03 + closeness * 0.16})`;
      ctx.beginPath();
      ctx.ellipse(
        bubble.x,
        ARENA.floor + 6,
        bubble.r * (0.7 + closeness * 0.45),
        bubble.r * 0.22 * (0.6 + closeness * 0.5),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBubbles(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    const sorted = [...engine.bubbles].sort((a, b) => a.y - b.y);
    for (const bubble of sorted) {
      this.drawBubble(ctx, bubble, engine, theme, hc);
    }
  }

  private drawBubble(
    ctx: CanvasRenderingContext2D,
    bubble: Bubble,
    engine: GameEngine,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    const sprite = this.getBubbleSprite(theme, bubble.tier, bubble.variant, hc);
    const radius = bubble.r;
    const pad = Math.max(14, radius * 0.32);
    const box = radius * 2 + pad * 2;
    const squash = bubble.squash;
    const scaleX = 1 + squash * 0.55;
    const scaleY = 1 - squash * 0.55;
    const spin = bubble.spin + Math.sin(bubble.wobble) * 0.06;

    ctx.save();
    ctx.translate(bubble.x, bubble.y);
    ctx.rotate(spin);
    ctx.scale(scaleX, scaleY);

    if (engine.globalFreeze > 0) {
      ctx.shadowColor = 'rgba(130, 220, 255, 0.8)';
      ctx.shadowBlur = 16;
    } else {
      ctx.shadowColor = rgba(theme.bubbles[bubble.tier].mid, hc ? 0.6 : 0.35);
      ctx.shadowBlur = hc ? 12 : 18;
    }

    if (sprite) {
      ctx.drawImage(sprite, -box / 2, -box / 2, box, box);
    } else {
      this.drawFallbackBubble(ctx, radius, theme, bubble.tier, hc);
    }
    ctx.shadowBlur = 0;

    // Live animated specular glint.
    const glintAngle = bubble.wobble * 0.4;
    const gx = Math.cos(glintAngle - 2.2) * radius * 0.45;
    const gy = Math.sin(glintAngle - 2.2) * radius * 0.45;
    const glint = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius * 0.48);
    glint.addColorStop(0, 'rgba(255,255,255,0.55)');
    glint.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    glint.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    if (hc) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 1.5, 0, Math.PI * 2);
      ctx.stroke();
      this.drawTierMarks(ctx, bubble.tier, radius, '#ffffff');
    } else {
      ctx.strokeStyle = bubble.tier === 3 ? rgba('#ffd9df', 0.7) : rgba('#ffffff', 0.35);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
      ctx.stroke();
      this.drawTierMarks(ctx, bubble.tier, radius, rgba(theme.bubbles[bubble.tier].light, 0.6));
    }

    if (bubble.spawnGuard > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, radius + 5 + bubble.spawnGuard * 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (engine.globalFreeze > 0) {
      ctx.fillStyle = 'rgba(150, 225, 255, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(215, 247, 255, 0.8)';
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI;
        const r1 = radius * 0.35;
        const r2 = radius * 0.85;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(-Math.cos(a) * r1, -Math.sin(a) * r1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Math.cos(a + Math.PI / 2) * r2, Math.sin(a + Math.PI / 2) * r2);
        ctx.lineTo(Math.cos(a + Math.PI / 2) * r1, Math.sin(a + Math.PI / 2) * r1);
        ctx.stroke();
      }
    }

    if (bubble.tier === 3 && !hc) {
      const pulse = 0.18 + Math.sin(engine.visualTime * 7 + bubble.wobble) * 0.08;
      ctx.strokeStyle = rgba('#ff8f9f', pulse);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawTierMarks(
    ctx: CanvasRenderingContext2D,
    tier: number,
    radius: number,
    color: string,
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    const inner = radius * 0.32;
    if (tier === 0) {
      ctx.globalAlpha *= 0.55;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, inner * 1.5, 0.2, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, inner * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (tier === 1) {
      ctx.globalAlpha *= 0.55;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 2; i += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, inner * (1.2 + i * 0.7), i * 1.6, i * 1.6 + 2.1);
        ctx.stroke();
      }
    } else if (tier === 2) {
      ctx.globalAlpha *= 0.6;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * inner, Math.sin(a) * inner, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.globalAlpha *= 0.85;
      drawStarPath(ctx, 0, 0, 4, inner * 1.15, inner * 0.35, Math.PI / 4);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawFallbackBubble(
    ctx: CanvasRenderingContext2D,
    radius: number,
    theme: ThemeSpec,
    tier: number,
    hc: boolean,
  ): void {
    const colors = hc
      ? HIGH_CONTRAST_BUBBLES[tier]
      : theme.bubbles[tier as 0 | 1 | 2 | 3];
    const grad = ctx.createRadialGradient(
      -radius * 0.38,
      -radius * 0.4,
      radius * 0.08,
      0,
      0,
      radius,
    );
    grad.addColorStop(0, colors.light);
    grad.addColorStop(0.42, colors.mid);
    grad.addColorStop(0.86, colors.deep);
    grad.addColorStop(1, rgba(colors.deep, 0.82));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private getBubbleSprite(
    theme: ThemeSpec,
    tier: number,
    variant: number,
    hc: boolean,
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const key = `${theme.id}:${tier}:${variant}:${hc ? 'hc' : 'n'}`;
    const cached = this.bubbleSprites.get(key);
    if (cached) return cached;

    const radius = BUBBLE_TIERS[tier].radius;
    const pad = Math.max(16, radius * 0.42);
    const resolution = 1.75;
    const box = radius * 2 + pad * 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(box * resolution);
    canvas.height = Math.ceil(box * resolution);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(resolution, resolution);
    ctx.translate(box / 2, box / 2);

    const colors = hc
      ? HIGH_CONTRAST_BUBBLES[Math.min(3, Math.max(0, tier))]
      : theme.bubbles[Math.min(3, Math.max(0, tier))];
    const tint = Math.sin(variant * 2.1 + tier) * 0.16;

    // Soft outer aura.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(0, 0, radius * 0.7, 0, 0, radius + pad);
    aura.addColorStop(0, rgba(colors.mid, hc ? 0.2 : 0.28));
    aura.addColorStop(0.55, rgba(colors.deep, hc ? 0.08 : 0.13));
    aura.addColorStop(1, rgba(colors.deep, 0));
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, radius + pad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glass body.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();

    const body = ctx.createRadialGradient(
      -radius * 0.36,
      -radius * 0.42,
      radius * 0.05,
      radius * 0.08,
      radius * 0.1,
      radius * 1.08,
    );
    body.addColorStop(0, rgba(colors.light, hc ? 0.98 : 0.92));
    body.addColorStop(0.28, rgba(colors.mid, hc ? 0.96 : 0.72));
    body.addColorStop(0.64, rgba(colors.mid, 0.52 + tint));
    body.addColorStop(0.88, rgba(colors.deep, 0.56));
    body.addColorStop(1, rgba(colors.deep, 0.78));
    ctx.fillStyle = body;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

    // Swirling inner fluid.
    ctx.globalAlpha = hc ? 0.18 : 0.26;
    const swirl = ctx.createLinearGradient(-radius, -radius, radius, radius);
    swirl.addColorStop(0, colors.core);
    swirl.addColorStop(0.5, 'rgba(255,255,255,0)');
    swirl.addColorStop(1, colors.light);
    ctx.fillStyle = swirl;
    ctx.beginPath();
    ctx.ellipse(
      radius * 0.12,
      radius * 0.18,
      radius * 0.78,
      radius * 0.28,
      -0.6 + variant * 0.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.globalAlpha = 1;

    // Bottom inner glow.
    const bottom = ctx.createRadialGradient(0, radius * 0.7, 0, 0, radius * 0.7, radius);
    bottom.addColorStop(0, rgba(colors.core, 0.28));
    bottom.addColorStop(1, rgba(colors.core, 0));
    ctx.fillStyle = bottom;
    ctx.fillRect(-radius, 0, radius * 2, radius);

    ctx.restore();

    // Rim rings.
    ctx.strokeStyle = rgba(colors.light, hc ? 0.95 : 0.68);
    ctx.lineWidth = hc ? 3 : Math.max(1.4, radius * 0.045);
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba(colors.deep, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 4, 0, Math.PI * 2);
    ctx.stroke();

    // Broad glossy sweep.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    const gloss = ctx.createLinearGradient(
      -radius,
      -radius,
      radius * 0.5,
      radius * 0.2,
    );
    gloss.addColorStop(0, 'rgba(255,255,255,0.5)');
    gloss.addColorStop(0.28, 'rgba(255,255,255,0.13)');
    gloss.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.1, -radius * 0.45, radius * 0.85, radius * 0.55, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Specular blobs.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(
      -radius * 0.42,
      -radius * 0.44,
      radius * 0.2,
      radius * 0.11,
      -0.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(radius * 0.32, radius * 0.36, radius * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // A little orb nucleus.
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.3);
    coreGrad.addColorStop(0, rgba(colors.core, 0.5));
    coreGrad.addColorStop(1, rgba(colors.core, 0));
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(radius * 0.12, radius * 0.14, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    const sprite = canvas;
    this.bubbleSprites.set(key, sprite);
    if (this.bubbleSprites.size > 48) {
      // Keep the sprite cache bounded during very long sessions.
      const first = this.bubbleSprites.keys().next();
      if (!first.done) this.bubbleSprites.delete(first.value);
    }
    return sprite;
  }

  /* ------------------------------------------------------------------ */
  /* Pickups                                                             */
  /* ------------------------------------------------------------------ */

  private drawPickups(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
    for (const pickup of engine.pickups) {
      this.drawPickup(ctx, pickup, engine);
    }
  }

  private drawPickup(
    ctx: CanvasRenderingContext2D,
    pickup: Pickup,
    engine: GameEngine,
  ): void {
    const config = PICKUPS[pickup.type];
    const blink = pickup.ttl - pickup.age < 3 && Math.sin(engine.visualTime * 16) < -0.1;
    if (blink) return;
    const bob = Math.sin(engine.visualTime * 2.4 + pickup.phase) * 3;
    const remaining = clamp(1 - pickup.age / pickup.ttl, 0, 1);

    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);

    // Outer glow.
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 52);
    glow.addColorStop(0, rgba(config.color, 0.38));
    glow.addColorStop(0.55, rgba(config.color, 0.15));
    glow.addColorStop(1, rgba(config.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();

    // Expiry arc.
    ctx.strokeStyle = rgba(config.color, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
    ctx.stroke();

    // Rotating capsule.
    ctx.rotate(Math.sin(engine.visualTime * 1.5 + pickup.phase) * 0.12);
    const body = ctx.createLinearGradient(-18, -18, 18, 18);
    body.addColorStop(0, rgba(config.color, 0.94));
    body.addColorStop(1, rgba(config.color, 0.4));
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 2;
    hexPath(ctx, 0, 0, 21, Math.PI / 6);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    hexPath(ctx, 0, 0, 15, Math.PI / 6);
    ctx.stroke();

    this.drawPickupIcon(ctx, pickup.type, config.color);
    ctx.restore();
  }

  private drawPickupIcon(
    ctx: CanvasRenderingContext2D,
    type: Pickup['type'],
    color: string,
  ): void {
    ctx.save();
    ctx.strokeStyle = '#07111b';
    ctx.fillStyle = '#07111b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (type) {
      case 'dual': {
        for (const dx of [-7, 7]) {
          ctx.beginPath();
          ctx.moveTo(dx, 9);
          ctx.lineTo(dx, -6);
          ctx.moveTo(dx - 5, -1);
          ctx.lineTo(dx, -7);
          ctx.lineTo(dx + 5, -1);
          ctx.stroke();
        }
        break;
      }
      case 'shield': {
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, -6);
        ctx.lineTo(8, 6);
        ctx.lineTo(0, 12);
        ctx.lineTo(-8, 6);
        ctx.lineTo(-10, -6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.7);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
      case 'freeze': {
        for (let i = 0; i < 3; i += 1) {
          const angle = (i / 3) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * -12, Math.sin(angle) * -12);
          ctx.lineTo(Math.cos(angle) * 12, Math.sin(angle) * 12);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'time': {
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -7);
        ctx.moveTo(0, 0);
        ctx.lineTo(6, 3);
        ctx.stroke();
        break;
      }
      case 'life': {
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.lineTo(11, 0);
        ctx.moveTo(0, -11);
        ctx.lineTo(0, 11);
        ctx.lineWidth = 5;
        ctx.stroke();
        break;
      }
      case 'crystal':
      default: {
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, -2);
        ctx.lineTo(4, 11);
        ctx.lineTo(-4, 11);
        ctx.lineTo(-10, -2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
    // Tiny colour glint.
    ctx.fillStyle = rgba(color, 0.6);
    ctx.beginPath();
    ctx.arc(-10, -10, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ------------------------------------------------------------------ */
  /* Weapon effects                                                      */
  /* ------------------------------------------------------------------ */

  private drawWeaponEffects(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
  ): void {
    for (const effect of engine.effects) {
      if (effect.weapon === 'pulse') this.drawPulse(ctx, effect, engine);
      else if (effect.weapon === 'web') this.drawWeb(ctx, effect, engine);
      else if (effect.weapon === 'prism') this.drawPrism(ctx, effect, engine);
    }
  }

  private drawPulse(
    ctx: CanvasRenderingContext2D,
    effect: WeaponEffect,
    engine: GameEngine,
  ): void {
    const weapon = WEAPONS.pulse;
    const alpha =
      effect.phase === 'fade'
        ? clamp(effect.hold / WEAPON_PHYSICS.pulseHold, 0, 1)
        : effect.phase === 'extend'
          ? 0.9
          : 0.75 + Math.sin(engine.visualTime * 24 + effect.seed) * 0.15;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    const base = effect.baseY;
    const tip = effect.tipY;

    const outer = ctx.createLinearGradient(effect.x, base, effect.x, tip);
    outer.addColorStop(0, rgba(weapon.color, 0.05 * alpha));
    outer.addColorStop(0.18, rgba(weapon.color, 0.35 * alpha));
    outer.addColorStop(0.9, rgba(weapon.color, 0.8 * alpha));
    outer.addColorStop(1, rgba('#ffffff', 0.95 * alpha));
    ctx.strokeStyle = outer;
    ctx.lineWidth = 12;
    ctx.shadowColor = weapon.color;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.moveTo(effect.x, base);
    ctx.lineTo(effect.x, tip);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba('#ffffff', 0.92 * alpha);
    ctx.shadowBlur = 10;
    ctx.stroke();

    // Moving energy dashes.
    ctx.shadowBlur = 0;
    ctx.setLineDash([7, 20]);
    ctx.lineDashOffset = -engine.visualTime * 260 - effect.seed;
    ctx.strokeStyle = rgba(weapon.color, 0.85 * alpha);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(effect.x, base);
    ctx.lineTo(effect.x, tip);
    ctx.stroke();
    ctx.setLineDash([]);

    // Tip.
    const tipPulse = 1 + Math.sin(engine.visualTime * 18 + effect.seed) * 0.15;
    const tipGlow = ctx.createRadialGradient(effect.x, tip, 0, effect.x, tip, 22 * tipPulse);
    tipGlow.addColorStop(0, rgba('#ffffff', 0.9 * alpha));
    tipGlow.addColorStop(0.35, rgba(weapon.color, 0.55 * alpha));
    tipGlow.addColorStop(1, rgba(weapon.color, 0));
    ctx.fillStyle = tipGlow;
    ctx.beginPath();
    ctx.arc(effect.x, tip, 22 * tipPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.9 * alpha);
    ctx.beginPath();
    ctx.arc(effect.x, tip, 3.2, 0, Math.PI * 2);
    ctx.fill();

    if (effect.hitFlash > 0) {
      ctx.fillStyle = rgba('#ffffff', effect.hitFlash * 0.7);
      ctx.beginPath();
      ctx.arc(effect.x, tip, 10 + (1 - effect.hitFlash) * 36, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawWeb(
    ctx: CanvasRenderingContext2D,
    effect: WeaponEffect,
    engine: GameEngine,
  ): void {
    const weapon = WEAPONS.web;
    const duration = WEAPON_PHYSICS.webDuration;
    const fade =
      effect.phase === 'fade'
        ? clamp(effect.hold / 0.14, 0, 1)
        : clamp(effect.hold / duration, 0.18, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    ctx.strokeStyle = rgba(weapon.color, 0.55);
    ctx.lineWidth = 2;
    ctx.shadowColor = weapon.color;
    ctx.shadowBlur = 14;

    const x = effect.x;
    const top = effect.tipY;
    const bottom = effect.baseY;
    const offset = Math.sin(engine.visualTime * 2.2 + effect.seed) * 4;

    // Rails.
    ctx.beginPath();
    ctx.moveTo(x - 12 + offset, top);
    ctx.lineTo(x - 12 + offset, bottom);
    ctx.moveTo(x + 12 - offset, top);
    ctx.lineTo(x + 12 - offset, bottom);
    ctx.stroke();
    ctx.strokeStyle = rgba('#fff8dc', 0.75);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + offset * 0.3, top);
    ctx.lineTo(x + offset * 0.3, bottom);
    ctx.stroke();

    // Lattice rungs.
    ctx.strokeStyle = rgba(weapon.color, 0.32);
    ctx.lineWidth = 1.2;
    const step = 38;
    for (let y = top + 24, i = 0; y < bottom - 8; y += step, i += 1) {
      const wobble = Math.sin(engine.visualTime * 2 + i * 0.7 + effect.seed) * 3;
      ctx.beginPath();
      ctx.moveTo(x - 12 + offset + wobble, y);
      ctx.lineTo(x + 12 - offset + wobble, y + step * 0.5);
      ctx.lineTo(x - 12 + offset + wobble, y + step);
      ctx.stroke();
    }

    // Anchors.
    for (const y of [top, bottom]) {
      ctx.fillStyle = rgba(weapon.color, 0.5);
      hexPath(ctx, x, y, 8, Math.PI / 6);
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.75);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (effect.hitFlash > 0) {
      ctx.fillStyle = rgba('#fff5cc', effect.hitFlash * 0.35);
      ctx.fillRect(x - 20, top, 40, bottom - top);
    }
    ctx.restore();
  }

  private drawPrism(
    ctx: CanvasRenderingContext2D,
    effect: WeaponEffect,
    engine: GameEngine,
  ): void {
    const weapon = WEAPONS.prism;
    const alpha = clamp(effect.hold / WEAPON_PHYSICS.prismDuration, 0, 1);
    if (alpha <= 0) return;
    const x = effect.x;
    const top = effect.tipY;
    const bottom = effect.baseY;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;

    const beam = ctx.createLinearGradient(x - 34, 0, x + 34, 0);
    beam.addColorStop(0, 'rgba(114, 247, 255, 0)');
    beam.addColorStop(0.25, 'rgba(114, 247, 255, 0.32)');
    beam.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    beam.addColorStop(0.75, 'rgba(255, 123, 234, 0.38)');
    beam.addColorStop(1, 'rgba(255, 123, 234, 0)');
    ctx.fillStyle = beam;
    ctx.shadowColor = weapon.color;
    ctx.shadowBlur = 26;
    ctx.fillRect(x - 38, top, 76, bottom - top);
    ctx.shadowBlur = 0;

    ctx.fillStyle = rgba('#ffffff', 0.8);
    ctx.fillRect(x - 4, top, 8, bottom - top);

    // Scanline accents inside the beam.
    ctx.fillStyle = rgba(weapon.color, 0.35);
    for (let y = top + ((engine.visualTime * 180) % 28); y < bottom; y += 28) {
      ctx.fillRect(x - 26, y, 52, 2);
    }

    // Prism emitter at the origin.
    ctx.translate(x, bottom);
    ctx.rotate(engine.visualTime * 2.2);
    ctx.fillStyle = rgba(weapon.color, 0.55);
    ctx.strokeStyle = rgba('#ffffff', 0.9);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(13, 9);
    ctx.lineTo(-13, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawMines(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
  ): void {
    for (const mine of engine.mines) {
      this.drawMine(ctx, mine, engine, theme);
    }
  }

  private drawMine(
    ctx: CanvasRenderingContext2D,
    mine: Mine,
    engine: GameEngine,
    theme: ThemeSpec,
  ): void {
    const color = mine.phase === 0 ? '#ffc45c' : mine.phase === 1 ? '#a4ff8f' : '#ffffff';
    const pulse = 1 + Math.sin(engine.visualTime * (mine.phase === 1 ? 6 : 11) + mine.seed) * 0.12;
    ctx.save();
    ctx.translate(mine.x, mine.y);

    if (mine.phase === 2) {
      const blast = 1 - clamp(mine.blast / WEAPON_PHYSICS.mineBlastTime, 0, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#a4ff8f', 1 - blast);
      ctx.lineWidth = 5 * (1 - blast) + 1;
      ctx.beginPath();
      ctx.arc(0, -14, 20 + blast * mine.radius * 1.15, 0, Math.PI * 2);
      ctx.stroke();
      const flash = ctx.createRadialGradient(0, -14, 0, 0, -14, mine.radius);
      flash.addColorStop(0, rgba('#ffffff', 0.8 * (1 - blast)));
      flash.addColorStop(0.5, rgba('#a4ff8f', 0.35 * (1 - blast)));
      flash.addColorStop(1, rgba('#a4ff8f', 0));
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(0, -14, mine.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Active radius.
    if (mine.phase === 1) {
      ctx.strokeStyle = rgba('#a4ff8f', 0.22);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 9]);
      ctx.lineDashOffset = -engine.visualTime * 38;
      ctx.beginPath();
      ctx.arc(0, -14, mine.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = rgba('#a4ff8f', 0.06);
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + engine.visualTime * 0.18;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 20, -14 + Math.sin(a) * 20);
        ctx.lineTo(Math.cos(a) * mine.radius, -14 + Math.sin(a) * mine.radius);
        ctx.stroke();
      }
    }

    // Ground glow.
    const glow = ctx.createRadialGradient(0, -6, 2, 0, -6, 46 * pulse);
    glow.addColorStop(0, rgba(color, 0.28));
    glow.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(-50, -50, 100, 62);

    // Base plate.
    ctx.fillStyle = '#0b1418';
    ctx.strokeStyle = rgba(color, 0.8);
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, -17, -8, 34, 10, 4);
    ctx.fill();
    ctx.stroke();

    // Device body.
    ctx.save();
    ctx.translate(0, -18);
    ctx.rotate(Math.sin(engine.visualTime * 1.6 + mine.seed) * 0.08);
    ctx.fillStyle = '#132228';
    ctx.strokeStyle = rgba(color, 0.95);
    ctx.lineWidth = 2;
    hexPath(ctx, 0, 0, 13 * pulse, Math.PI / 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(color, 0.95);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Antenna.
    ctx.strokeStyle = rgba(color, 0.8);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, -24);
    ctx.stroke();
    ctx.fillStyle = rgba(color, 0.9);
    ctx.beginPath();
    ctx.arc(0, -27, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Arming ring.
    if (mine.phase === 0) {
      const progress = 1 - clamp(mine.arm / WEAPON_PHYSICS.mineArm, 0, 1);
      ctx.strokeStyle = 'rgba(255, 196, 92, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -18, 22, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
      ctx.font = `700 9px ${MONO_FONT}`;
      ctx.fillStyle = 'rgba(255, 196, 92, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('ARMING', 0, 30);
      ctx.textAlign = 'left';
    } else if (mine.phase === 1) {
      ctx.font = `700 9px ${MONO_FONT}`;
      ctx.fillStyle = rgba(theme.accent, 0.7);
      ctx.textAlign = 'center';
      ctx.fillText('ARMED', 0, 30);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Characters                                                          */
  /* ------------------------------------------------------------------ */

  private drawPlayers(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    for (const player of engine.players) {
      if (player.eliminated) continue;
      this.drawPlayer(ctx, player, engine, theme, hc);
    }
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: Player,
    engine: GameEngine,
    theme: ThemeSpec,
    hc: boolean,
  ): void {
    const p1 = player.index === 0;
    const suit = p1
      ? { dark: '#9d321c', mid: '#ff8445', light: '#ffc47c', accent: '#62f6df', visor: '#85fff1' }
      : { dark: '#4c237f', mid: '#a26dff', light: '#d8b8ff', accent: '#c6ff6e', visor: '#b7ff72' };
    const outline = hc ? '#ffffff' : rgba('#081018', 0.9);
    const walking = Math.abs(player.vx) > 22;
    const bob = walking
      ? Math.abs(Math.sin(player.walkPhase)) * 2.2
      : Math.sin(player.idlePhase) * 1.7;
    const lean = clamp(player.vx / 600, -1, 1) * 0.065;
    const hitJolt = player.hitTimer > 0 ? Math.sin(engine.visualTime * 100) * 2.4 : 0;
    const invulnBlink = player.invuln > 0 && Math.floor(engine.visualTime * 15) % 2 === 0;
    const respawnScale =
      player.respawnTimer > 0 ? 0.82 + 0.18 * (1 - player.respawnTimer / 0.55) : 1;

    // Floor shadow.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 2, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (player.dualTimer > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(PICKUPS.dual.color, 0.22 + Math.sin(engine.visualTime * 5) * 0.06);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.arc(player.x, player.y - 42, 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(player.x + hitJolt, player.y - bob);
    ctx.scale(player.facing * respawnScale, respawnScale);
    ctx.rotate(lean);
    if (invulnBlink) ctx.globalAlpha = 0.58;

    // Backpack.
    ctx.fillStyle = hc ? '#f4ffff' : '#143444';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    roundRectPath(ctx, -23, -53, 16, 25, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(suit.accent, 0.9);
    ctx.fillRect(-20, -49, 10, 3);
    ctx.fillStyle = rgba('#06121c', 0.9);
    ctx.fillRect(-20, -41, 10, 2);

    // Legs.
    const stride = walking ? Math.sin(player.walkPhase) * 0.6 : 0;
    const legX = [-8, 8];
    for (let i = 0; i < 2; i += 1) {
      const swing = i === 0 ? stride : -stride;
      ctx.save();
      ctx.translate(legX[i], -27);
      ctx.rotate(swing);
      ctx.fillStyle = hc ? '#ffffff' : suit.dark;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2;
      roundRectPath(ctx, -5.5, 0, 11, 24, 5);
      ctx.fill();
      ctx.stroke();
      // Boot.
      ctx.fillStyle = hc ? '#0b1320' : '#152331';
      roundRectPath(ctx, -6.5, 18, 15, 8, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Body suit.
    const suitGrad = ctx.createLinearGradient(-16, -60, 18, -20);
    suitGrad.addColorStop(0, hc ? '#ffffff' : suit.light);
    suitGrad.addColorStop(0.45, hc ? '#ffe8cf' : suit.mid);
    suitGrad.addColorStop(1, hc ? '#ffffff' : suit.dark);
    ctx.fillStyle = hc ? '#ffdca8' : suitGrad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.2;
    roundRectPath(ctx, -17, -58, 34, 35, 12);
    ctx.fill();
    ctx.stroke();

    // Utility belt.
    ctx.fillStyle = hc ? '#0b111a' : '#2a1a16';
    ctx.fillRect(-17, -31, 34, 5);
    ctx.fillStyle = rgba(suit.accent, 0.95);
    ctx.fillRect(-7, -30, 8, 3);
    ctx.fillStyle = rgba('#ffca66', 0.95);
    ctx.fillRect(7, -30, 5, 3);

    // Chest emblem.
    ctx.fillStyle = rgba(suit.accent, 0.95);
    ctx.beginPath();
    ctx.moveTo(2, -52);
    ctx.lineTo(8, -47);
    ctx.lineTo(2, -42);
    ctx.lineTo(-4, -47);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba('#071521', 0.65);
    ctx.beginPath();
    ctx.arc(2, -47, 2, 0, Math.PI * 2);
    ctx.fill();

    // Rear arm.
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.fillStyle = hc ? '#fff1d9' : suit.dark;
    roundRectPath(ctx, -24, -53, 9, 23, 4.5);
    ctx.fill();
    ctx.stroke();

    // Head + helmet.
    const headY = -66;
    ctx.fillStyle = hc ? '#ffffff' : suit.mid;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, headY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Helmet rim.
    ctx.strokeStyle = rgba(suit.accent, 0.75);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, headY, 12.5, 0.15 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    // Visor.
    const visorGrad = ctx.createLinearGradient(-2, headY - 10, 13, headY + 7);
    visorGrad.addColorStop(0, rgba(suit.visor, 0.95));
    visorGrad.addColorStop(0.55, rgba('#0d6f78', 0.95));
    visorGrad.addColorStop(1, rgba('#061f2a', 0.98));
    ctx.fillStyle = visorGrad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(6, headY, 10, 8.5, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Eyes / expression.
    const expression = player.hitTimer > 0 ? 'hit' : player.fireAnim > 0.08 ? 'focus' : 'idle';
    ctx.fillStyle = rgba('#d6ffff', 0.95);
    if (expression === 'hit') {
      ctx.strokeStyle = rgba('#fff4e8', 0.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(3, headY - 2);
      ctx.lineTo(6, headY + 1);
      ctx.moveTo(6, headY - 2);
      ctx.lineTo(3, headY + 1);
      ctx.moveTo(9, headY - 2);
      ctx.lineTo(12, headY + 1);
      ctx.moveTo(12, headY - 2);
      ctx.lineTo(9, headY + 1);
      ctx.stroke();
    } else {
      const eyeW = expression === 'focus' ? 2.4 : 2;
      ctx.beginPath();
      ctx.ellipse(4, headY, eyeW, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(10, headY, eyeW, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Visor glint.
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1, headY - 5);
    ctx.lineTo(5, headY - 7);
    ctx.stroke();

    // Antenna.
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-3, headY - 14);
    ctx.lineTo(-8, headY - 25);
    ctx.stroke();
    const antennaBlink = 0.45 + Math.sin(engine.visualTime * 4 + player.index * 2) * 0.35;
    ctx.fillStyle = rgba(suit.accent, antennaBlink);
    ctx.beginPath();
    ctx.arc(-8, headY - 26, 2.7, 0, Math.PI * 2);
    ctx.fill();

    // Firing arm and gauntlet.
    const raise = player.fireAnim > 0 ? clamp(player.fireAnim / 0.2, 0, 1) : 0;
    ctx.save();
    ctx.translate(14, -49);
    ctx.rotate(-0.55 - raise * 1.15);
    ctx.fillStyle = hc ? '#ffffff' : suit.light;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    roundRectPath(ctx, -4.5, 0, 9, 23, 4.5);
    ctx.fill();
    ctx.stroke();
    // Gauntlet.
    ctx.fillStyle = hc ? '#1b2837' : '#193444';
    roundRectPath(ctx, -6, 17, 12, 10, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(suit.accent, 0.95);
    ctx.beginPath();
    ctx.arc(0, 21, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Muzzle bloom.
    if (player.muzzle > 0) {
      const mx = 0;
      const my = -70;
      const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 22);
      glow.addColorStop(0, 'rgba(255,255,255,0.9)');
      glow.addColorStop(0.4, rgba(suit.accent, 0.55));
      glow.addColorStop(1, rgba(suit.accent, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(mx, my, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hit star.
    if (player.hitTimer > 0.1) {
      ctx.strokeStyle = rgba('#ff8a7a', player.hitTimer * 1.2);
      ctx.lineWidth = 2;
      drawStarPath(ctx, 0, -42, 5, 34, 13, engine.visualTime * 3);
      ctx.stroke();
    }

    ctx.restore();

    // Shield bubble drawn over the suit so it reads clearly.
    if (player.shield > 0) {
      const r = 49;
      const cy = player.y - 43;
      ctx.save();
      ctx.translate(player.x, cy);
      const rad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 4, 0, 0, r);
      rad.addColorStop(0, 'rgba(150, 255, 220, 0.02)');
      rad.addColorStop(0.72, 'rgba(100, 255, 210, 0.075)');
      rad.addColorStop(1, 'rgba(90, 255, 215, 0.16)');
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba('#6bffc9', 0.75);
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#6bffc9';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Hex facets.
      ctx.strokeStyle = rgba('#a6ffe5', 0.22);
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        const angle = engine.visualTime * 0.5 + (i / 3) * Math.PI * 2;
        ctx.arc(0, 0, r * 0.82, angle, angle + 0.9);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + engine.visualTime * 0.16;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * r * 0.35, Math.sin(angle) * r * 0.35);
        ctx.lineTo(Math.cos(angle) * r * 0.99, Math.sin(angle) * r * 0.99);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Player tag.
    const tag = player.index === 0 ? 'P1' : 'P2';
    ctx.save();
    ctx.font = `800 10px ${MONO_FONT}`;
    const tagWidth = ctx.measureText(tag).width + 12;
    const tagY = player.y - 104 - bob;
    ctx.fillStyle = 'rgba(4, 10, 18, 0.72)';
    roundRectPath(ctx, player.x - tagWidth / 2, tagY - 11, tagWidth, 17, 6);
    ctx.fill();
    ctx.strokeStyle = rgba(suit.accent, 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = hc ? '#ffffff' : rgba(suit.accent, 0.95);
    ctx.textAlign = 'center';
    ctx.fillText(tag, player.x, tagY + 1.5);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Effects, overlays and HUD-in-canvas                                 */
  /* ------------------------------------------------------------------ */

  private drawParticles(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
    if (engine.particles.length === 0) return;
    ctx.save();
    for (const particle of engine.particles) {
      const life = clamp(particle.life / Math.max(0.0001, particle.maxLife), 0, 1);
      const alpha = clamp(particle.life * 1.6, 0, 1);
      this.drawParticle(ctx, particle, particlesAlpha(particle, alpha), life);
    }
    ctx.restore();
  }

  private drawParticle(
    ctx: CanvasRenderingContext2D,
    particle: Particle,
    alpha: number,
    life: number,
  ): void {
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.globalAlpha = alpha;
    if (particle.kind === 'ring') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = 2.5 * life + 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, particle.size * (1.4 - life * 0.7), 0, Math.PI * 2);
      ctx.stroke();
    } else if (particle.kind === 'spark') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = particle.size * 0.7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-particle.vx * 0.028, -particle.vy * 0.028);
      ctx.stroke();
    } else if (particle.kind === 'star') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = particle.color;
      drawStarPath(ctx, 0, 0, 4, particle.size * 2.4, particle.size * 0.55, 0);
      ctx.fill();
    } else if (particle.kind === 'shard') {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.moveTo(0, -particle.size);
      ctx.lineTo(particle.size * 0.7, particle.size);
      ctx.lineTo(-particle.size * 0.7, particle.size * 0.5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(0, 0, particle.size * (0.4 + life * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPopups(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
    for (const popup of engine.popups) {
      this.drawPopup(ctx, popup);
    }
  }

  private drawPopup(ctx: CanvasRenderingContext2D, popup: ScorePopup): void {
    const progress = clamp(1 - popup.life / popup.maxLife, 0, 1);
    const alpha = popup.life > 0.25 ? 1 : popup.life / 0.25;
    const scale = popup.scale * (0.7 + Math.min(1, progress * 4) * 0.3);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(popup.x, popup.y);
    ctx.scale(scale, scale);
    ctx.font = `800 20px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(4, 9, 16, 0.85)';
    ctx.strokeText(popup.text, 0, 0);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, 0, 0);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  private drawFreezeOverlay(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
  ): void {
    const alpha = clamp(engine.globalFreeze / 1.2, 0.15, 0.5);
    ctx.save();
    const frost = ctx.createRadialGradient(
      ARENA.width / 2,
      ARENA.height / 2,
      100,
      ARENA.width / 2,
      ARENA.height / 2,
      720,
    );
    frost.addColorStop(0, 'rgba(130, 220, 255, 0.01)');
    frost.addColorStop(1, rgba('#9bdcff', 0.2 * alpha));
    ctx.fillStyle = frost;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    // Frost feathers around the frame.
    ctx.strokeStyle = 'rgba(205, 245, 255, 0.26)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 12; i += 1) {
      const side = i % 4;
      const t = hash(i * 3.1);
      let x = 0;
      let y = 0;
      let angle = 0;
      if (side === 0) {
        x = t * ARENA.width;
        y = 8;
        angle = Math.PI / 2;
      } else if (side === 1) {
        x = t * ARENA.width;
        y = ARENA.height - 8;
        angle = -Math.PI / 2;
      } else if (side === 2) {
        x = 8;
        y = ARENA.top + t * (ARENA.floor - ARENA.top);
        angle = 0;
      } else {
        x = ARENA.width - 8;
        y = ARENA.top + t * (ARENA.floor - ARENA.top);
        angle = Math.PI;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      for (let j = 0; j < 3; j += 1) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10 + j * 6, -16 - j * 8);
        ctx.moveTo(0, 0);
        ctx.lineTo(10 + j * 6, 16 + j * 8);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.font = `700 12px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(196, 243, 255, 0.72)';
    ctx.fillText('CRYO FIELD ACTIVE', ARENA.width / 2, ARENA.top + 28);
    ctx.textAlign = 'left';
    ctx.restore();
    void theme;
  }

  private drawWarningVignette(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
  ): void {
    const critical =
      engine.state === 'PLAYING' && engine.time > 0 && engine.time <= TIME_CRITICAL;
    if (!critical && engine.warningPulse <= 0.02) return;
    const pulse = critical
      ? 0.3 + Math.sin(engine.visualTime * 6) * 0.12
      : engine.warningPulse * 0.25;
    const grad = ctx.createRadialGradient(
      ARENA.width / 2,
      ARENA.height / 2,
      260,
      ARENA.width / 2,
      ARENA.height / 2,
      800,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, 'rgba(255, 70, 82, 0.02)');
    grad.addColorStop(1, `rgba(255, 62, 74, ${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    // Top border pulse.
    ctx.fillStyle = rgba(theme.accent2, 0.15 + engine.warningPulse * 0.18);
    ctx.fillRect(0, 0, ARENA.width, 2);
  }

  private drawReadyOverlay(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    theme: ThemeSpec,
  ): void {
    const progress = clamp(1 - engine.readyTimer / READY_TIME, 0, 1);
    const appear = clamp(progress * 5, 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(2, 6, 14, ${0.35 * appear})`;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    const w = 720;
    const h = 238;
    const x = (ARENA.width - w) / 2;
    const y = 236;
    const panel = ctx.createLinearGradient(x, y, x, y + h);
    panel.addColorStop(0, 'rgba(7, 16, 30, 0.985)');
    panel.addColorStop(1, 'rgba(4, 9, 19, 0.94)');
    ctx.fillStyle = panel;
    ctx.strokeStyle = rgba(theme.accent, 0.5 * appear);
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, x, y, w, h, 20);
    ctx.fill();
    ctx.stroke();

    // Top accent strip.
    const strip = ctx.createLinearGradient(x + 20, y, x + w - 20, y);
    strip.addColorStop(0, 'rgba(0,0,0,0)');
    strip.addColorStop(0.2, rgba(theme.accent, 0.8 * appear));
    strip.addColorStop(0.8, rgba(theme.accent2, 0.65 * appear));
    strip.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = strip;
    ctx.fillRect(x + 30, y, w - 60, 2);

    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = `800 13px ${MONO_FONT}`;
    ctx.fillStyle = rgba(theme.accent, 0.96);
    const prefix =
      engine.mode === 'endless'
        ? `WAVE ${String(engine.wave).padStart(2, '0')}`
        : engine.level.number === CAMPAIGN_TOTAL_FOR_RENDER
          ? 'FINAL ARENA // CORE BREACH'
          : `LEVEL ${String(engine.level.number).padStart(2, '0')} / ${CAMPAIGN_TOTAL_FOR_RENDER}`;
    ctx.fillText(`${prefix}  //  ${MODIFIER_LABEL_FOR_RENDER(engine)}`, ARENA.width / 2, y + 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 44px ${DISPLAY_FONT}`;
    ctx.fillText(engine.level.title.toUpperCase(), ARENA.width / 2, y + 86);
    ctx.font = `500 15px ${UI_FONT}`;
    ctx.fillStyle = rgba('#d7e8f7', 0.92);
    ctx.fillText(engine.level.subtitle, ARENA.width / 2, y + 114);

    ctx.font = `700 12px ${MONO_FONT}`;
    ctx.fillStyle = rgba(theme.text, 0.7);
    ctx.fillText(theme.name.toUpperCase(), ARENA.width / 2, y + 142);

    const hint =
      engine.level.hint ??
      (engine.mode === 'endless'
        ? 'Survive the wave. Every pop buys a little more time.'
        : 'Move with your keys. Fire straight up. Every orb splits.');
    ctx.font = `500 13px ${UI_FONT}`;
    ctx.fillStyle = rgba('#c3d8ea', 0.82);
    ctx.fillText(hint, ARENA.width / 2, y + 170);

    // Ready badge.
    const badgeW = 190;
    const badgeY = y + 188;
    ctx.fillStyle = rgba(theme.accent, 0.14);
    roundRectPath(ctx, ARENA.width / 2 - badgeW / 2, badgeY, badgeW, 30, 15);
    ctx.fill();
    ctx.strokeStyle = rgba(theme.accent, 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `800 12px ${MONO_FONT}`;
    ctx.fillStyle = rgba(theme.text, 1);
    const dots = Math.floor(engine.visualTime * 3) % 4;
    ctx.fillText(`GET READY${'.'.repeat(dots)}`, ARENA.width / 2, badgeY + 19);
    ctx.textAlign = 'left';

    // Countdown bar.
    const barW = w - 80;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRectPath(ctx, x + 40, y + h - 14, barW, 3, 2);
    ctx.fill();
    ctx.fillStyle = rgba(theme.accent, 0.8);
    roundRectPath(ctx, x + 40, y + h - 14, barW * progress, 3, 2);
    ctx.fill();
    ctx.restore();
  }

  private drawDebugOverlay(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 8, 16, 0.78)';
    ctx.strokeStyle = 'rgba(120, 255, 220, 0.3)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, 58, 126, 310, 168, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = `11px ${MONO_FONT}`;
    ctx.fillStyle = '#9fffe4';
    const lines = [
      `STATE ${engine.state}   MODE ${engine.mode.toUpperCase()}`,
      `FPS ${engine.debugFps.toFixed(0)}   TIME ${engine.time.toFixed(2)}`,
      `BUBBLES ${engine.bubbles.length}   FX ${engine.effects.length}`,
      `MINES ${engine.mines.length}   PICKUPS ${engine.pickups.length}`,
      `PARTICLES ${engine.particles.length}   POPUPS ${engine.popups.length}`,
      `PLAYERS ${engine.players.map((p) => `${p.x.toFixed(0)}/${p.lives}`).join('  ')}`,
      `LIVES ${engine.players.map((p) => p.lives).join('/')}   SCORE ${engine.players.map((p) => p.score).join('/')}`,
      `SEED ${engine.level.seed}   SPEED x${engine.level.speed.toFixed(2)}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, 72, 148 + i * 18));

    // Collision circles and weapon segments.
    ctx.strokeStyle = 'rgba(255, 100, 130, 0.7)';
    for (const bubble of engine.bubbles) {
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120, 255, 220, 0.8)';
    for (const player of engine.players) {
      ctx.beginPath();
      ctx.arc(player.x, player.y - 38, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 235, 100, 0.7)';
    for (const effect of engine.effects) {
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.baseY);
      ctx.lineTo(effect.x, effect.tipY);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120, 255, 180, 0.5)';
    for (const mine of engine.mines) {
      ctx.beginPath();
      ctx.arc(mine.x, mine.y, mine.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

const CAMPAIGN_TOTAL_FOR_RENDER = 24;

function MODIFIER_LABEL_FOR_RENDER(engine: GameEngine): string {
  if (engine.level.modifier === 'none') return 'STANDARD PHYSICS';
  return engine.level.modifier.replace(/([A-Z])/g, ' $1').toUpperCase();
}

function particlesAlpha(particle: Particle, alpha: number): number {
  if (particle.kind === 'ring') return clamp(alpha * 0.7, 0, 0.8);
  return clamp(alpha, 0, 1);
}
