import type { ReactNode, SVGProps } from 'react';
import type { PickupType, WeaponId } from '../game/types';

type IconProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function baseProps({ size = 24, title, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    role: title ? 'img' : undefined,
    'aria-hidden': title ? undefined : true,
    ...props,
  };
}

function labelled(title: string | undefined, children: ReactNode) {
  return title ? (
    <>
      <title>{title}</title>
      {children}
    </>
  ) : (
    children
  );
}

export function WeaponIcon({ weapon, size = 24, ...rest }: IconProps & { weapon: WeaponId }) {
  const props = baseProps({ ...rest, size });
  return (
    <svg {...props}>
      {labelled(rest.title, <>
        {weapon === 'pulse' && (
          <>
            <path d="M12 21V5" />
            <path d="m9 10 3-6 3 6" />
            <path d="M8.5 15.5h7" opacity=".55" />
            <circle cx="12" cy="21" r="1.4" fill="currentColor" stroke="none" />
            <path d="M6 9.5h1.6M16.4 9.5H18" opacity=".7" />
          </>
        )}
        {weapon === 'web' && (
          <>
            <path d="M12 3v18M5.5 6.5 18.5 17.5M18.5 6.5 5.5 17.5" opacity=".75" />
            <path d="M8.5 5.5c2.4 1.4 4.2 1.4 7 0M8.5 18.5c2.4-1.4 4.2-1.4 7 0" />
            <circle cx="12" cy="12" r="2" />
            <path d="M12 3v2M12 19v2M5 9l2 1M17 15l2 1M19 9l-2 1M7 15l-2 1" opacity=".6" />
          </>
        )}
        {weapon === 'prism' && (
          <>
            <path d="M12 3v6M8 3v6M16 3v6" opacity=".7" />
            <path d="m12 8 4.5 8h-9L12 8Z" />
            <path d="M7.5 16h9" />
            <path d="M12 16v4" opacity=".6" />
            <circle cx="12" cy="21" r="1.2" fill="currentColor" stroke="none" />
          </>
        )}
        {weapon === 'mine' && (
          <>
            <path d="m12 4 6 3.5v7L12 18l-6-3.5v-7L12 4Z" />
            <circle cx="12" cy="11" r="2.4" />
            <path d="M12 2v2M20 8l-2 1M4 8l2 1M20 15l-2-1M4 15l2-1M12 18v4" opacity=".65" />
            <path d="M8 21h8" opacity=".45" />
          </>
        )}
      </>)}
    </svg>
  );
}

export function PickupIcon({ type, size = 24, ...rest }: IconProps & { type: PickupType }) {
  const props = baseProps({ ...rest, size });
  return (
    <svg {...props}>
      {labelled(rest.title, <>
        {type === 'dual' && (
          <>
            <path d="M8 20V6M5 9l3-3 3 3" />
            <path d="M16 20V6M13 9l3-3 3 3" />
          </>
        )}
        {type === 'shield' && (
          <>
            <path d="M12 3 19 6v5.2c0 4.3-2.8 7.5-7 9.8-4.2-2.3-7-5.5-7-9.8V6l7-3Z" />
            <path d="m8.8 12 2.2 2.2 4.3-4.5" />
          </>
        )}
        {type === 'freeze' && (
          <>
            <path d="M12 3v18M4.3 7.5l15.4 9M4.3 16.5l15.4-9" />
            <path d="M9.5 5 12 7.2 14.5 5M9.5 19 12 16.8 14.5 19M5.6 10.5l3 .4-1.4-2.7M18.4 13.5l-3-.4 1.4 2.7M5.6 13.5l3-.4-1.4 2.7M18.4 10.5l-3 .4 1.4-2.7" opacity=".7" />
          </>
        )}
        {type === 'time' && (
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7v5.2l3.2 2" />
            <path d="M9 2.8h6" opacity=".55" />
          </>
        )}
        {type === 'life' && (
          <>
            <path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
            <path d="M9 11.6h6M12 8.6v6" opacity=".8" />
          </>
        )}
        {type === 'crystal' && (
          <>
            <path d="m12 3 6.5 6.5L12 21 5.5 9.5 12 3Z" />
            <path d="M5.5 9.5h13M12 3v18" opacity=".65" />
          </>
        )}
      </>)}
    </svg>
  );
}

export function LogoMark({ size = 48, ...rest }: IconProps) {
  const props = baseProps({ ...rest, size });
  return (
    <svg {...props} viewBox="0 0 64 64">
      <defs>
        <radialGradient id="logoOrb" cx="34%" cy="28%" r="75%">
          <stop offset="0" stopColor="#e9fffb" />
          <stop offset=".33" stopColor="#6ef7dc" />
          <stop offset=".72" stopColor="#1b8fa8" />
          <stop offset="1" stopColor="#0b2b47" />
        </radialGradient>
        <linearGradient id="logoRing" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ff9b5c" />
          <stop offset="1" stopColor="#ff5c86" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="34" rx="25" ry="25" fill="url(#logoOrb)" />
      <ellipse cx="24" cy="24" rx="8" ry="5" fill="#fff" opacity=".46" transform="rotate(-28 24 24)" />
      <path d="M25 14c3 3 5 7 5 11" stroke="#0a1620" strokeWidth="1.7" strokeLinecap="round" fill="none" opacity=".55" />
      <ellipse cx="32" cy="34" rx="31" ry="11" fill="none" stroke="url(#logoRing)" strokeWidth="2.4" transform="rotate(-19 32 34)" />
      <circle cx="59" cy="24" r="3" fill="#ff8a4c" />
      <circle cx="6" cy="41" r="2" fill="#6ef7dc" />
      <path d="M24 50c4-3 12-3 16 0" stroke="#6ef7dc" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".55" />
    </svg>
  );
}

/** Menu hero illustration: the original courier and a cluster of volatile orbs. */
export function CourierArt() {
  return (
    <svg
      className="courier-art"
      viewBox="0 0 560 520"
      fill="none"
      role="img"
      aria-label="A POPBOUND courier in an orange suit and teal visor stands beneath a cluster of glossy orbs."
    >
      <defs>
        <radialGradient id="heroOrbA" cx="35%" cy="27%" r="72%">
          <stop offset="0" stopColor="#f4fffc" />
          <stop offset=".26" stopColor="#7cf7df" />
          <stop offset=".62" stopColor="#2a97b5" stopOpacity=".85" />
          <stop offset="1" stopColor="#0b314d" stopOpacity=".8" />
        </radialGradient>
        <radialGradient id="heroOrbB" cx="36%" cy="28%" r="73%">
          <stop offset="0" stopColor="#fff2e0" />
          <stop offset=".25" stopColor="#ffc46e" />
          <stop offset=".65" stopColor="#e05f55" stopOpacity=".9" />
          <stop offset="1" stopColor="#6e1d39" stopOpacity=".72" />
        </radialGradient>
        <radialGradient id="heroOrbC" cx="34%" cy="29%" r="75%">
          <stop offset="0" stopColor="#f6eeff" />
          <stop offset=".28" stopColor="#c9a4ff" />
          <stop offset=".68" stopColor="#7652d6" stopOpacity=".8" />
          <stop offset="1" stopColor="#241356" stopOpacity=".7" />
        </radialGradient>
        <linearGradient id="suitMain" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffc074" />
          <stop offset=".5" stopColor="#ff8a4c" />
          <stop offset="1" stopColor="#d94c35" />
        </linearGradient>
        <linearGradient id="visorMain" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#bdfff8" />
          <stop offset=".52" stopColor="#43e4d3" />
          <stop offset="1" stopColor="#0b6d7c" />
        </linearGradient>
        <linearGradient id="tether" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#6ef7dc" stopOpacity="0" />
          <stop offset=".35" stopColor="#6ef7dc" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffb066" stopOpacity="1" />
        </linearGradient>
        <filter id="heroGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>

      {/* Orbit rings */}
      <ellipse cx="300" cy="230" rx="228" ry="98" stroke="#7cf7df" strokeOpacity=".15" strokeWidth="1.4" strokeDasharray="3 12" transform="rotate(-16 300 230)" />
      <ellipse cx="300" cy="230" rx="286" ry="132" stroke="#ff9b5c" strokeOpacity=".1" strokeWidth="1" strokeDasharray="2 16" transform="rotate(11 300 230)" />

      {/* Energy tether */}
      <path d="M327 114c-7 42-26 67-24 102 2 34 19 46 16 78" stroke="url(#tether)" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="320" cy="296" r="8" fill="#6ef7dc" opacity=".2" filter="url(#heroGlow)" />
      <circle cx="320" cy="296" r="3" fill="#d9fffb" />

      {/* Orbs */}
      <g>
        <circle cx="360" cy="105" r="77" fill="url(#heroOrbB)" />
        <circle cx="360" cy="105" r="77" stroke="#ffd6b1" strokeOpacity=".55" strokeWidth="1.5" />
        <ellipse cx="330" cy="74" rx="25" ry="14" fill="#fff" opacity=".4" transform="rotate(-28 330 74)" />
        <ellipse cx="393" cy="124" rx="20" ry="28" fill="#ff9a72" opacity=".2" transform="rotate(20 393 124)" />
        <circle cx="360" cy="105" r="15" fill="#ffe7bc" opacity=".18" filter="url(#softGlow)" />
      </g>
      <g>
        <circle cx="462" cy="245" r="54" fill="url(#heroOrbC)" />
        <circle cx="462" cy="245" r="54" stroke="#e6d5ff" strokeOpacity=".5" strokeWidth="1.3" />
        <ellipse cx="441" cy="224" rx="17" ry="9" fill="#fff" opacity=".42" transform="rotate(-28 441 224)" />
        <path d="M438 262c12-2 24-9 31-20" stroke="#ffe4b8" strokeWidth="1.4" strokeOpacity=".5" fill="none" />
      </g>
      <g>
        <circle cx="177" cy="152" r="37" fill="url(#heroOrbA)" />
        <circle cx="177" cy="152" r="37" stroke="#c4fff2" strokeOpacity=".45" strokeWidth="1.2" />
        <ellipse cx="162" cy="138" rx="12" ry="6.5" fill="#fff" opacity=".48" transform="rotate(-30 162 138)" />
        <circle cx="180" cy="154" r="8" fill="#ffdca7" opacity=".18" />
      </g>
      <g opacity=".8">
        <circle cx="245" cy="315" r="21" fill="url(#heroOrbA)" />
        <ellipse cx="237" cy="307" rx="7" ry="3.7" fill="#fff" opacity=".4" transform="rotate(-30 237 307)" />
      </g>
      <g opacity=".65">
        <circle cx="492" cy="140" r="13" fill="url(#heroOrbB)" />
      </g>
      <g opacity=".5">
        <circle cx="140" cy="268" r="10" fill="url(#heroOrbC)" />
      </g>

      {/* Platform */}
      <ellipse cx="300" cy="475" rx="176" ry="28" fill="#06121c" opacity=".75" />
      <ellipse cx="300" cy="468" rx="162" ry="22" fill="#0e2a34" opacity=".7" />
      <path d="M136 468h328" stroke="#6ef7dc" strokeOpacity=".45" strokeWidth="2" />
      <path d="M190 486h220" stroke="#ff9b5c" strokeOpacity=".2" strokeWidth="1" strokeDasharray="2 8" />

      {/* Backpack */}
      <rect x="230" y="298" width="42" height="92" rx="17" fill="#123849" stroke="#07121b" strokeWidth="3" />
      <rect x="240" y="313" width="22" height="7" rx="3.5" fill="#5be6d1" opacity=".8" />
      <rect x="240" y="331" width="22" height="4" rx="2" fill="#06121b" opacity=".6" />
      <path d="M250 356v18" stroke="#ffb166" strokeWidth="3" strokeLinecap="round" />

      {/* Legs */}
      <g>
        <rect x="280" y="376" width="26" height="86" rx="12" fill="#c64a2d" stroke="#07121b" strokeWidth="3" />
        <rect x="278" y="448" width="40" height="24" rx="10" fill="#142434" stroke="#07121b" strokeWidth="3" />
        <path d="M321 450h-5" stroke="#6ef7dc" strokeOpacity=".7" strokeWidth="2" />
      </g>
      <g>
        <rect x="320" y="376" width="27" height="84" rx="12" fill="#a93c2b" stroke="#07121b" strokeWidth="3" />
        <rect x="318" y="446" width="42" height="24" rx="10" fill="#162a38" stroke="#07121b" strokeWidth="3" />
        <path d="M359 452h-18" stroke="#ff9b5c" strokeOpacity=".6" strokeWidth="2" />
      </g>

      {/* Body */}
      <rect x="259" y="274" width="106" height="119" rx="38" fill="url(#suitMain)" stroke="#07121b" strokeWidth="3.5" />
      <path d="M266 344h92" stroke="#5b1e1a" strokeOpacity=".55" strokeWidth="7" />
      <rect x="300" y="350" width="24" height="8" rx="4" fill="#ffd48c" stroke="#7a2e19" strokeWidth="1.4" />
      <path d="m311 302 17 12-17 12-17-12 17-12Z" fill="#75f5df" stroke="#07313b" strokeWidth="2" />
      <circle cx="311" cy="314" r="4.5" fill="#063c44" />
      <path d="M276 292c3 2.5 6 2.5 9 0M331 292c3 2.5 6 2.5 9 0" stroke="#ffe3b6" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />

      {/* Left arm */}
      <rect x="234" y="300" width="29" height="88" rx="14" fill="#d95634" stroke="#07121b" strokeWidth="3" transform="rotate(11 248 344)" />
      <circle cx="248" cy="387" r="15" fill="#7a2a21" stroke="#07121b" strokeWidth="3" />

      {/* Firing arm */}
      <g>
        <rect x="347" y="258" width="29" height="92" rx="14" fill="#ff9b58" stroke="#07121b" strokeWidth="3" transform="rotate(29 361 304)" />
        <rect x="359" y="213" width="35" height="35" rx="11" fill="#183746" stroke="#07121b" strokeWidth="3" />
        <circle cx="376" cy="230" r="7" fill="#6ef7dc" filter="url(#softGlow)" />
        <circle cx="376" cy="230" r="3" fill="#eafffc" />
        <path d="M377 206c8-8 9-17 5-27" stroke="#6ef7dc" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Head */}
      <g>
        <circle cx="306" cy="235" r="49" fill="#ee7240" stroke="#07121b" strokeWidth="3.5" />
        <path d="M267 215c8-22 29-35 51-31 15 3 26 13 31 25" stroke="#ffb36b" strokeWidth="7" strokeLinecap="round" opacity=".75" />
        <ellipse cx="321" cy="237" rx="31" ry="25" fill="url(#visorMain)" stroke="#06151f" strokeWidth="3" />
        <ellipse cx="320" cy="241" rx="23" ry="18" fill="#063b47" opacity=".6" />
        <circle cx="316" cy="237" r="5.4" fill="#dcfffb" />
        <circle cx="337" cy="237" r="5.4" fill="#dcfffb" />
        <path d="M306 257c8 4 17 4 25-1" stroke="#d8fffb" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
        <path d="M270 234c-7 4-12 10-14 18" stroke="#ffb36b" strokeWidth="4" strokeLinecap="round" opacity=".6" />
        <path d="M282 190c-5-17-4-29 4-40" stroke="#07121b" strokeWidth="3" strokeLinecap="round" />
        <circle cx="285" cy="145" r="5" fill="#6ef7dc" />
        <circle cx="285" cy="145" r="10" fill="#6ef7dc" opacity=".2" filter="url(#softGlow)" />
      </g>

      {/* Whisps */}
      <path d="M110 388c20-10 43-8 55 6" stroke="#6ef7dc" strokeOpacity=".18" strokeWidth="2" strokeLinecap="round" />
      <path d="M434 390c18-7 31-3 40 7" stroke="#ff9b5c" strokeOpacity=".2" strokeWidth="2" strokeLinecap="round" />
      <circle cx="104" cy="329" r="3" fill="#6ef7dc" opacity=".5" />
      <circle cx="506" cy="323" r="2.6" fill="#ffb166" opacity=".55" />
      <circle cx="426" cy="188" r="2.2" fill="#c9a4ff" opacity=".6" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...baseProps(props)} fill="none">
      <path d="M8 5.2v13.6L19 12 8 5.2Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconCoop(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="8.5" cy="8.5" r="3" />
      <circle cx="16.5" cy="9.5" r="2.5" />
      <path d="M3.5 20c.4-4 2.3-6 5-6s4.6 2 5 6M14 14.5c3 0 5 1.8 5.8 5.2" />
    </svg>
  );
}

export function IconInfinity(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M7.2 8.4c2.8 0 3.4 7.2 6.1 7.2 2.6 0 4.7-1.6 4.7-3.6s-2.1-3.6-4.7-3.6c-2.7 0-3.3 7.2-6.1 7.2C4.6 15.6 2.5 14 2.5 12s2.1-3.6 4.7-3.6Z" />
    </svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H4.5v2A3.5 3.5 0 0 0 8 10.5M16 5h3.5v2A3.5 3.5 0 0 1 16 10.5M12 12.5V16M8.5 20h7M10 16h4" />
    </svg>
  );
}

export function IconBook(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
      <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 10.5h5" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.37.35.7.65.96.3.26.68.4 1.08.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="6.5" y="5" width="3.6" height="14" rx="1.3" fill="currentColor" stroke="none" />
      <rect x="13.9" y="5" width="3.6" height="14" rx="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFullscreen(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

export function IconExitFullscreen(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </svg>
  );
}

export function IconBack(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14v2.5" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="m4.5 12.5 4.5 4.5L19.5 6.5" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconRestart(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4.5 9A8 8 0 1 1 4 13" />
      <path d="M4 4.5V9h4.5" />
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="m3.5 10.5 8.5-7 8.5 7M5.5 9.5V20h13V9.5M9.5 20v-6h5v6" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function IconStar(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3l-5.6 3 1.2-6.3L3 9.6l6.3-.8L12 3Z" />
    </svg>
  );
}

export function IconHeart(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

export function IconArrowUp(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 20V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function IconBackspace(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M9 5h11v14H9l-6-7 6-7Z" />
      <path d="m12 9 5 6M17 9l-5 6" />
    </svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M13.5 2 5 13.5h6L10.5 22 19 10.5h-6L13.5 2Z" />
    </svg>
  );
}
