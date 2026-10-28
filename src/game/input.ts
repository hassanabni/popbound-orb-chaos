import { RESERVED_KEYS, WEAPON_PHYSICS } from './constants';
import { WEAPON_ORDER } from './weapons';
import type { KeyBindings, PlayerBindings, WeaponId } from './types';

export type TouchAction = 'left' | 'right' | 'fire';

interface TouchState {
  left: boolean;
  right: boolean;
  fire: boolean;
}

/**
 * Keyboard and touch input is collected here, never in the renderer. The engine
 * reads an immutable-ish action state, which keeps simultaneous co-op input
 * simple: every player has their own binding map and touch state.
 *
 * Held keys are continuously sampled. One-shot weapon keys are consumed once
 * and cleared at the end of an engine step.
 */
export class InputController {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private touch: TouchState = { left: false, right: false, fire: false };
  private bindings: KeyBindings | null = null;
  private target: Window | null = null;
  private attached = false;
  enabled = true;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isInteractiveTarget(event.target)) return;
    const code = event.code;
    if (code === 'Tab' || code === 'F5' || code === 'F11') return;

    if (this.enabled && this.isGameplayCode(code)) {
      event.preventDefault();
    }
    if (this.held.has(code)) {
      // The browser repeats keydowns; keep a single edge press.
      return;
    }
    this.held.add(code);
    this.pressed.add(code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
    // Do not clear pressed here: a very fast tap should still switch weapons.
  };

  private readonly handleBlur = (): void => {
    this.clearHeld();
    this.clearTouch();
  };

  private readonly handleVisibility = (): void => {
    if (typeof document !== 'undefined' && document.hidden) {
      this.clearHeld();
      this.clearTouch();
    }
  };

  attach(target: Window | null = typeof window !== 'undefined' ? window : null): void {
    if (!target || this.attached) return;
    this.target = target;
    target.addEventListener('keydown', this.handleKeyDown, { passive: false });
    target.addEventListener('keyup', this.handleKeyUp);
    target.addEventListener('blur', this.handleBlur);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibility);
    }
    this.attached = true;
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
    this.target = null;
    this.attached = false;
    this.clearHeld();
    this.clearTouch();
  }

  setBindings(bindings: KeyBindings): void {
    this.bindings = bindings;
  }

  private isGameplayCode(code: string): boolean {
    if (code.startsWith('Arrow') || code === 'Space') return true;
    const bindings = this.bindings;
    if (!bindings) return false;
    for (const player of [bindings.p1, bindings.p2]) {
      if (player.left === code || player.right === code || player.fire === code) return true;
      if (player.weapons.includes(code)) return true;
    }
    return false;
  }

  /** Direct state setters are used by tests and by accessibility controllers. */
  setHeld(code: string, down: boolean): void {
    if (down) {
      if (!this.held.has(code)) {
        this.held.add(code);
        this.pressed.add(code);
      }
    } else {
      this.held.delete(code);
    }
  }

  setTouch(action: TouchAction, down: boolean): void {
    this.touch[action] = down;
  }

  clearTouch(): void {
    this.touch.left = false;
    this.touch.right = false;
    this.touch.fire = false;
  }

  clearHeld(): void {
    this.held.clear();
    this.pressed.clear();
  }

  releaseAll(): void {
    this.clearHeld();
    this.clearTouch();
  }

  endFrame(): void {
    this.pressed.clear();
  }

  isHeldCode(code: string): boolean {
    return this.held.has(code);
  }

  getTouchState(): Readonly<TouchState> {
    return this.touch;
  }

  axis(playerIndex: number, bindings: KeyBindings): -1 | 0 | 1 {
    const map = playerIndex === 1 ? bindings.p2 : bindings.p1;
    const useTouch = playerIndex === 0;
    const left =
      this.held.has(map.left) || (useTouch && this.touch.left) ? 1 : 0;
    const right =
      this.held.has(map.right) || (useTouch && this.touch.right) ? 1 : 0;
    return (right - left) as -1 | 0 | 1;
  }

  isFireHeld(playerIndex: number, bindings: KeyBindings): boolean {
    const map = playerIndex === 1 ? bindings.p2 : bindings.p1;
    if (this.held.has(map.fire)) return true;
    return playerIndex === 0 && this.touch.fire;
  }

  /**
   * Returns a weapon request for this player, or null. Touch weapon selection
   * is routed through engine.setWeapon() directly, so this only handles keys.
   */
  consumeWeaponSelection(playerIndex: number, bindings: KeyBindings): WeaponId | null {
    const map = playerIndex === 1 ? bindings.p2 : bindings.p1;
    for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
      const code = map.weapons[i];
      if (this.pressed.has(code)) {
        this.pressed.delete(code);
        return WEAPON_ORDER[i];
      }
    }
    return null;
  }

  /** True when a movement or weapon key for either player is held. */
  isAnyHeld(bindings: KeyBindings): boolean {
    return this.axis(0, bindings) !== 0 || this.axis(1, bindings) !== 0;
  }

  /** Test and debug helper. */
  hasHeldKeys(): boolean {
    return this.held.size > 0;
  }

  static isReserved(code: string): boolean {
    return RESERVED_KEYS.has(code) || code === '';
  }

  static weaponSlots(): number {
    return WEAPON_ORDER.length;
  }

  static dualOffset(): number {
    return WEAPON_PHYSICS.dualOffset;
  }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'BUTTON' ||
    tag === 'A' ||
    target.isContentEditable ||
    target.closest('button, a, input, textarea, select, [role="button"], [contenteditable]') !== null
  );
}

/** Utility for settings UI: is a binding pair conflicting for a single player? */
export function findDuplicateBinding(
  bindings: PlayerBindings,
  ignoreAction?: string,
): string | null {
  const allEntries: Array<[string, string]> = [
    ['Left', bindings.left],
    ['Right', bindings.right],
    ['Fire', bindings.fire],
    ['Weapon 1', bindings.weapons[0]],
    ['Weapon 2', bindings.weapons[1]],
    ['Weapon 3', bindings.weapons[2]],
    ['Weapon 4', bindings.weapons[3]],
  ];
  const entries = allEntries.filter(([, code]) => code !== '');
  const seen = new Set<string>();
  for (const [label, code] of entries) {
    if (ignoreAction === label) continue;
    if (seen.has(code)) return label;
    seen.add(code);
  }
  return null;
}
