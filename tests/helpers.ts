import { GameEngine } from '../src/game/GameEngine';
import { DEFAULT_BINDINGS, DEFAULT_SETTINGS } from '../src/game/constants';
import type {
  EngineEvent,
  GameMode,
  Settings,
} from '../src/game/types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface TestEngine {
  engine: GameEngine;
  events: EngineEvent[];
}

export function makeEngine(options: {
  mode?: GameMode;
  startLevelIndex?: number;
  settings?: Partial<Settings>;
} = {}): TestEngine {
  const events: EngineEvent[] = [];
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    difficulty: 'normal',
    screenShake: false,
    reducedMotion: true,
    ...options.settings,
  };
  const engine = new GameEngine({
    mode: options.mode ?? 'campaign',
    startLevelIndex: options.startLevelIndex ?? 0,
    settings,
    bindings: clone(DEFAULT_BINDINGS),
    onEvent: (event) => events.push(event),
    debug: { disableDrops: true },
  });
  return { engine, events };
}

/** A harmless bubble parked far from the player, to keep a level alive. */
export function addDecoyBubble(engine: GameEngine) {
  return engine.debugSpawnBubble(3, 1080, 180, 0, 0, 0);
}

export function startEngine(engine: GameEngine): void {
  engine.debugStart();
  if (engine.state === 'READY') {
    engine.debugAdvance(0.05);
  }
}

export function step(engine: GameEngine, seconds = 1 / 60): void {
  engine.debugAdvance(seconds);
}
