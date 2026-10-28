import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameEngine } from '../game/GameEngine';
import { WEAPONS } from '../game/weapons';
import type { WeaponId } from '../game/types';
import type { TouchAction } from '../game/input';
import { WeaponIcon } from './icons';

interface TouchControlsProps {
  engine: GameEngine;
  weapon: WeaponId;
  visible: boolean;
}

const ACTIONS: TouchAction[] = ['left', 'right', 'fire'];

export function TouchControls({ engine, weapon, visible }: TouchControlsProps) {
  const [pressed, setPressed] = useState<Record<TouchAction, boolean>>({
    left: false,
    right: false,
    fire: false,
  });
  const pointers = useRef(new Map<number, TouchAction>());

  const releaseAction = useCallback(
    (action: TouchAction) => {
      engine.setTouchAction(action, false);
      setPressed((prev) => (prev[action] ? { ...prev, [action]: false } : prev));
    },
    [engine],
  );

  const releasePointer = useCallback(
    (pointerId: number) => {
      const action = pointers.current.get(pointerId);
      if (!action) return;
      pointers.current.delete(pointerId);
      releaseAction(action);
    },
    [releaseAction],
  );

  const releaseAll = useCallback(() => {
    pointers.current.clear();
    for (const action of ACTIONS) engine.setTouchAction(action, false);
    setPressed({ left: false, right: false, fire: false });
  }, [engine]);

  useEffect(() => {
    if (!visible) releaseAll();
  }, [visible, releaseAll]);

  useEffect(() => {
    const onPointerUp = (event: PointerEvent) => releasePointer(event.pointerId);
    const onPointerCancel = (event: PointerEvent) => releasePointer(event.pointerId);
    const onBlur = () => releaseAll();
    const onVisibility = () => {
      if (document.hidden) releaseAll();
    };
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      releaseAll();
    };
  }, [releaseAll, releasePointer]);

  const press = (event: ReactPointerEvent<HTMLButtonElement>, action: TouchAction) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a progressive enhancement.
    }
    pointers.current.set(event.pointerId, action);
    engine.setTouchAction(action, true);
    setPressed((prev) => (prev[action] ? prev : { ...prev, [action]: true }));
  };

  const currentWeapon = WEAPONS[weapon];

  return (
    <div
      className={`touch-controls${visible ? ' is-visible' : ''}`}
      aria-hidden={!visible}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="touch-pad touch-move" role="group" aria-label="Movement controls">
        <button
          type="button"
          className={`touch-btn move-btn${pressed.left ? ' is-pressed' : ''}`}
          disabled={!visible}
          aria-label="Move left"
          onPointerDown={(event) => press(event, 'left')}
          onPointerUp={(event) => releasePointer(event.pointerId)}
          onPointerCancel={(event) => releasePointer(event.pointerId)}
          onLostPointerCapture={(event) => releasePointer(event.pointerId)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <button
          type="button"
          className={`touch-btn move-btn${pressed.right ? ' is-pressed' : ''}`}
          disabled={!visible}
          aria-label="Move right"
          onPointerDown={(event) => press(event, 'right')}
          onPointerUp={(event) => releasePointer(event.pointerId)}
          onPointerCancel={(event) => releasePointer(event.pointerId)}
          onLostPointerCapture={(event) => releasePointer(event.pointerId)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="touch-pad touch-action" role="group" aria-label="Weapon and fire controls">
        <button
          type="button"
          className="touch-btn weapon-cycle-btn"
          disabled={!visible}
          aria-label={`Cycle weapon. Current weapon: ${currentWeapon.name}`}
          onClick={() => engine.cycleWeapon(0)}
        >
          <WeaponIcon weapon={weapon} size={22} />
          <span className="touch-cycle-label">
            <span>WEAPON</span>
            <strong style={{ color: currentWeapon.color }}>{currentWeapon.shortName}</strong>
          </span>
        </button>
        <button
          type="button"
          className={`touch-btn fire-btn${pressed.fire ? ' is-pressed' : ''}`}
          disabled={!visible}
          aria-label="Fire weapon"
          onPointerDown={(event) => press(event, 'fire')}
          onPointerUp={(event) => releasePointer(event.pointerId)}
          onPointerCancel={(event) => releasePointer(event.pointerId)}
          onLostPointerCapture={(event) => releasePointer(event.pointerId)}
        >
          <span className="fire-btn-ring" aria-hidden="true" />
          <span className="fire-btn-label">FIRE</span>
        </button>
      </div>
    </div>
  );
}
