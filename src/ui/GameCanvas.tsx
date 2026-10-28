import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameEngine } from '../game/GameEngine';

/**
 * Keeps the 16:9 virtual canvas fitted inside the available stage while letting
 * the engine own the actual backing-store resolution and requestAnimationFrame
 * loop. This component deliberately does no simulation work.
 */
export function GameCanvas({ engine }: { engine: GameEngine }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 960, height: 540 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let frameHandle = 0;

    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      const availableW = Math.max(0, rect.width - 12);
      const availableH = Math.max(0, rect.height - 12);
      if (availableW < 2 || availableH < 2) return;
      const ratio = 16 / 9;
      let width = availableW;
      let height = width / ratio;
      if (height > availableH) {
        height = availableH;
        width = height * ratio;
      }
      width = Math.floor(width);
      height = Math.floor(height);
      setSize((prev) =>
        Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
          ? prev
          : { width, height },
      );
    };

    const onResize = () => {
      cancelAnimationFrame(frameHandle);
      frameHandle = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('resize', onResize);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(onResize);
      observer.observe(wrap);
    }
    return () => {
      cancelAnimationFrame(frameHandle);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engine.attach(canvas);
    return () => {
      engine.detach();
    };
  }, [engine]);

  useEffect(() => {
    engine.resizeCanvas();
  }, [engine, size.width, size.height]);

  return (
    <div className="canvas-measure" ref={wrapRef}>
      <div className="canvas-frame" style={{ width: size.width, height: size.height }}>
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="game-canvas"
          role="img"
          aria-label="POPBOUND gameplay arena: split orbs with vertical weapons and survive their bouncing shards."
        />
      </div>
    </div>
  );
}
