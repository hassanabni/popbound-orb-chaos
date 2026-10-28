// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../src/game/GameEngine';
import { DEFAULT_BINDINGS, DEFAULT_SETTINGS } from '../src/game/constants';

describe('canvas lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never starts a second animation loop for the same canvas and cleans up on destroy', () => {
    const requestFrame = vi.fn(() => 77);
    const cancelFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);
    vi.stubGlobal('ResizeObserver', undefined);

    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({}) as unknown as CanvasRenderingContext2D),
      getBoundingClientRect: () => ({
        width: 1280,
        height: 720,
        top: 0,
        left: 0,
        right: 1280,
        bottom: 720,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    } as unknown as HTMLCanvasElement;

    const engine = new GameEngine({
      mode: 'campaign',
      settings: { ...DEFAULT_SETTINGS, reducedMotion: true },
      bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)),
      debug: { disableDrops: true },
    });

    engine.attach(canvas);
    expect(requestFrame).toHaveBeenCalledTimes(1);

    // Repeated attachment (for example after a React re-render) must not create
    // another loop or accumulate input listeners.
    engine.attach(canvas);
    expect(requestFrame).toHaveBeenCalledTimes(1);

    // Restarting the level must also not create a loop.
    engine.debugStart();
    engine.pause();
    engine.restartLevel();
    expect(requestFrame).toHaveBeenCalledTimes(1);

    engine.destroy();
    expect(cancelFrame).toHaveBeenCalledTimes(1);
  });
});
