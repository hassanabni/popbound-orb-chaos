import type { WeaponConfig, WeaponId } from './types';

export const WEAPON_ORDER: WeaponId[] = ['pulse', 'web', 'prism', 'mine'];

export const WEAPONS: Record<WeaponId, WeaponConfig> = {
  pulse: {
    id: 'pulse',
    name: 'Pulse Harpoon',
    shortName: 'HARPOON',
    description:
      'A fast vertical tether. Splits the first orb it touches, then lingers for a heartbeat.',
    cooldown: 0.34,
    color: '#74f7ff',
    glow: 'rgba(116, 247, 255, 0.65)',
  },
  web: {
    id: 'web',
    name: 'Anchor Web',
    shortName: 'WEB',
    description:
      'Deploy a full-height energy web for 3 seconds. Every orb that touches it splits.',
    cooldown: 3.2,
    color: '#ffd166',
    glow: 'rgba(255, 209, 102, 0.6)',
    duration: 3.1,
  },
  prism: {
    id: 'prism',
    name: 'Prism Beam',
    shortName: 'PRISM',
    description:
      'Fire a wide instant beam that splits every orb caught in the column. Short cooldown.',
    cooldown: 0.72,
    color: '#ff91e8',
    glow: 'rgba(255, 145, 232, 0.62)',
  },
  mine: {
    id: 'mine',
    name: 'Arc Mine',
    shortName: 'MINE',
    description:
      'Place an arming trap near your feet. Detonates on contact, splitting every orb in its blast.',
    cooldown: 2.1,
    color: '#a4ff8f',
    glow: 'rgba(164, 255, 143, 0.6)',
  },
};

export function getWeapon(id: WeaponId): WeaponConfig {
  return WEAPONS[id] ?? WEAPONS.pulse;
}

export function weaponIndex(id: WeaponId): number {
  const index = WEAPON_ORDER.indexOf(id);
  return index < 0 ? 0 : index;
}

export function weaponByIdOrPulse(id: string): WeaponId {
  return (WEAPON_ORDER as string[]).includes(id) ? (id as WeaponId) : 'pulse';
}
