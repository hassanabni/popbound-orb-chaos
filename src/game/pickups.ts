import { pickWeightedIndex } from './physics';
import type { PickupConfig, PickupType } from './types';

export const PICKUPS: Record<PickupType, PickupConfig> = {
  dual: {
    type: 'dual',
    name: 'Dual Shot',
    shortName: 'DUAL',
    description: 'Twin tethers and twin beams for 11 seconds.',
    color: '#5ce1ff',
    glow: 'rgba(92, 225, 255, 0.7)',
    points: 25,
  },
  shield: {
    type: 'shield',
    name: 'Energy Shield',
    shortName: 'SHIELD',
    description: 'Absorbs the next orb that touches you.',
    color: '#69ffc3',
    glow: 'rgba(105, 255, 195, 0.7)',
    points: 25,
  },
  freeze: {
    type: 'freeze',
    name: 'Freeze Burst',
    shortName: 'FREEZE',
    description: 'Freezes every ordinary orb for 5.5 seconds.',
    color: '#8ed8ff',
    glow: 'rgba(142, 216, 255, 0.7)',
    points: 25,
  },
  time: {
    type: 'time',
    name: 'Time Surge',
    shortName: 'TIME',
    description: 'Adds up to 10 seconds to the level clock.',
    color: '#ffd35c',
    glow: 'rgba(255, 211, 92, 0.7)',
    points: 25,
  },
  life: {
    type: 'life',
    name: 'Extra Life',
    shortName: 'LIFE',
    description: 'Restores one life, up to the maximum.',
    color: '#ff7d9d',
    glow: 'rgba(255, 125, 157, 0.7)',
    points: 50,
  },
  crystal: {
    type: 'crystal',
    name: 'Score Crystal',
    shortName: 'CRYSTAL',
    description: 'A raw chunk of arcade points. Worth 150.',
    color: '#c39bff',
    glow: 'rgba(195, 155, 255, 0.7)',
    points: 150,
  },
};

export const PICKUP_ORDER: PickupType[] = ['dual', 'shield', 'freeze', 'time', 'life', 'crystal'];

/** Relative drop weights. Extra lives are deliberately rare. */
export const PICKUP_DROP_WEIGHTS: Record<PickupType, number> = {
  dual: 18,
  shield: 20,
  freeze: 16,
  time: 17,
  life: 5,
  crystal: 24,
};

const WEIGHT_ORDER: PickupType[] = ['dual', 'shield', 'freeze', 'time', 'life', 'crystal'];

export function rollPickupType(rng: () => number, livesAtMax = false): PickupType {
  const weights = WEIGHT_ORDER.map((type) =>
    livesAtMax && type === 'life' ? 0 : PICKUP_DROP_WEIGHTS[type],
  );
  const index = pickWeightedIndex(rng, weights);
  return WEIGHT_ORDER[index] ?? 'crystal';
}

export function getPickup(type: PickupType): PickupConfig {
  return PICKUPS[type] ?? PICKUPS.crystal;
}
