import { useEffect, useId, useState, type ReactNode } from 'react';
import { IconBack } from './icons';
import type { GameMode } from '../game/types';

export function formatScore(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('en-US');
}

export function pad2(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, '0');
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const whole = Math.ceil(safe);
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function modeLabel(mode: GameMode): string {
  if (mode === 'coop') return 'CO-OP';
  if (mode === 'endless') return 'ENDLESS';
  return 'CAMPAIGN';
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  onBack,
  actions,
  autoFocusBack = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  autoFocusBack?: boolean;
}) {
  return (
    <header className="screen-head">
      <div className="screen-head-main">
        {onBack && (
          <button type="button" className="icon-btn back-btn" onClick={onBack} aria-label="Go back" autoFocus={autoFocusBack}>
            <IconBack size={22} />
          </button>
        )}
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <p className="screen-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="screen-head-actions">{actions}</div>}
    </header>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={`setting-row toggle-row${disabled ? ' is-disabled' : ''}`}>
      <div className="setting-copy">
        <label htmlFor={id}>{label}</label>
        {description && <p>{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' is-on' : ''}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
      >
        <span className="switch-thumb" />
      </button>
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  description,
  disabled = false,
  formatValue = (v: number) => `${Math.round(v * 100)}%`,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  description?: string;
  disabled?: boolean;
  formatValue?: (value: number) => string;
}) {
  const id = useId();
  return (
    <div className={`setting-row slider-row${disabled ? ' is-disabled' : ''}`}>
      <div className="setting-copy">
        <div className="setting-label-line">
          <label htmlFor={id}>{label}</label>
          <span className="setting-value">{formatValue(value)}</span>
        </div>
        {description && <p>{description}</p>}
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        style={{ ['--range' as string]: `${value * 100}%` }}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  options: Array<{ value: T; label: string; description?: string }>;
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <div className={`segmented-wrap${compact ? ' is-compact' : ''}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segment${value === option.value ? ' is-active' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          title={option.description}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function KeyCap({ children }: { children: ReactNode }) {
  return <kbd className="keycap">{children}</kbd>;
}

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="stat-tile" style={accent ? { ['--tile-accent' as string]: accent } : undefined}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return coarse;
}

export function useIsPortrait(): boolean {
  const [portrait, setPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setPortrait(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return portrait;
}
