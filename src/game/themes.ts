import type { ThemeId } from './types';

export interface ThemeBubbleColors {
  light: string;
  mid: string;
  deep: string;
  core: string;
}

export interface ThemeSpec {
  id: ThemeId;
  name: string;
  tagline: string;
  accent: string;
  accent2: string;
  text: string;
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  glowA: string;
  glowB: string;
  grid: string;
  floorTop: string;
  floorBottom: string;
  floorEdge: string;
  wall: string;
  particle: string;
  bubbles: [ThemeBubbleColors, ThemeBubbleColors, ThemeBubbleColors, ThemeBubbleColors];
}

export const THEMES: Record<ThemeId, ThemeSpec> = {
  training: {
    id: 'training',
    name: 'Neon Training Chamber',
    tagline: 'Learn the bounce. Trust the tether.',
    accent: '#64f5d2',
    accent2: '#ff8a4c',
    text: '#eafffb',
    bgTop: '#061426',
    bgMid: '#082036',
    bgBottom: '#04101d',
    glowA: 'rgba(61, 232, 213, 0.22)',
    glowB: 'rgba(255, 128, 72, 0.16)',
    grid: 'rgba(80, 230, 213, 0.12)',
    floorTop: '#12324a',
    floorBottom: '#06101c',
    floorEdge: '#59f7dd',
    wall: 'rgba(95, 238, 219, 0.4)',
    particle: 'rgba(115, 249, 230, 0.6)',
    bubbles: [
      { light: '#d8fff8', mid: '#43e4c7', deep: '#0f6f78', core: '#ffb36b' },
      { light: '#d8f5ff', mid: '#55b9f7', deep: '#1b438c', core: '#ffd08c' },
      { light: '#ffd9f8', mid: '#f57bd1', deep: '#84246e', core: '#ffe3a8' },
      { light: '#ffebbd', mid: '#ffb84e', deep: '#a84e16', core: '#fff4d1' },
    ],
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal Observatory',
    tagline: 'A thousand tiny shards, waiting to sing.',
    accent: '#b89dff',
    accent2: '#5ee7ff',
    text: '#f4efff',
    bgTop: '#100b2b',
    bgMid: '#1b1247',
    bgBottom: '#09061b',
    glowA: 'rgba(150, 112, 255, 0.26)',
    glowB: 'rgba(94, 231, 255, 0.18)',
    grid: 'rgba(171, 143, 255, 0.12)',
    floorTop: '#2b2054',
    floorBottom: '#0c0820',
    floorEdge: '#cbb6ff',
    wall: 'rgba(183, 155, 255, 0.45)',
    particle: 'rgba(202, 181, 255, 0.65)',
    bubbles: [
      { light: '#f0e9ff', mid: '#b795ff', deep: '#4f2b96', core: '#7df2ff' },
      { light: '#e3f6ff', mid: '#74c9ff', deep: '#214b8e', core: '#ffe2a9' },
      { light: '#ffddf2', mid: '#fb8fc8', deep: '#8a2d66', core: '#bdf9ff' },
      { light: '#e6ffe8', mid: '#8bf39e', deep: '#2d7a4e', core: '#fff1b0' },
    ],
  },
  reactor: {
    id: 'reactor',
    name: 'Industrial Reactor',
    tagline: 'Heat rising. Pressure climbing. Keep moving.',
    accent: '#ffb84a',
    accent2: '#61e8d0',
    text: '#fff4e6',
    bgTop: '#1c0f08',
    bgMid: '#2a170c',
    bgBottom: '#0d0806',
    glowA: 'rgba(255, 139, 48, 0.2)',
    glowB: 'rgba(58, 228, 200, 0.13)',
    grid: 'rgba(255, 185, 94, 0.09)',
    floorTop: '#3b2a1b',
    floorBottom: '#120c08',
    floorEdge: '#ffbb5c',
    wall: 'rgba(255, 177, 74, 0.38)',
    particle: 'rgba(255, 191, 107, 0.64)',
    bubbles: [
      { light: '#fff0d2', mid: '#ffbe5c', deep: '#8f4a12', core: '#6cf4dd' },
      { light: '#ffe1bb', mid: '#ff8e4d', deep: '#9c2d1a', core: '#8df6e0' },
      { light: '#d5fff8', mid: '#5fe0cf', deep: '#166b68', core: '#ffd091' },
      { light: '#ffe9e0', mid: '#ff7a64', deep: '#a42b2b', core: '#ffe4a1' },
    ],
  },
  garden: {
    id: 'garden',
    name: 'Cybernetic Garden',
    tagline: 'Soft light. Sharp thorns. Living circuitry.',
    accent: '#8dffb2',
    accent2: '#ff9edb',
    text: '#effff4',
    bgTop: '#061a16',
    bgMid: '#0b2a22',
    bgBottom: '#04100e',
    glowA: 'rgba(119, 255, 181, 0.18)',
    glowB: 'rgba(255, 141, 207, 0.14)',
    grid: 'rgba(128, 255, 194, 0.09)',
    floorTop: '#1b3c30',
    floorBottom: '#07130f',
    floorEdge: '#92ffc0',
    wall: 'rgba(147, 255, 189, 0.36)',
    particle: 'rgba(171, 255, 204, 0.62)',
    bubbles: [
      { light: '#e6fff2', mid: '#80f0ae', deep: '#226b4b', core: '#ffe59d' },
      { light: '#e8fff8', mid: '#68e2cf', deep: '#1d6b63', core: '#ffb6d9' },
      { light: '#fff1fa', mid: '#ffa4d7', deep: '#822f69', core: '#dcffad' },
      { light: '#f8ffd7', mid: '#d6f36a', deep: '#5f7a1f', core: '#fff3b8' },
    ],
  },
  cosmic: {
    id: 'cosmic',
    name: 'Cosmic Containment Arena',
    tagline: 'The last arena. The loudest silence.',
    accent: '#cf9bff',
    accent2: '#ff8d85',
    text: '#f8f2ff',
    bgTop: '#080a22',
    bgMid: '#15103a',
    bgBottom: '#04040f',
    glowA: 'rgba(165, 115, 255, 0.24)',
    glowB: 'rgba(255, 128, 115, 0.14)',
    grid: 'rgba(183, 157, 255, 0.1)',
    floorTop: '#241c4a',
    floorBottom: '#070612',
    floorEdge: '#d6b4ff',
    wall: 'rgba(199, 169, 255, 0.42)',
    particle: 'rgba(223, 208, 255, 0.7)',
    bubbles: [
      { light: '#f3eaff', mid: '#bf9bff', deep: '#59309b', core: '#ffc3a7' },
      { light: '#e4edff', mid: '#8fa9ff', deep: '#33418f', core: '#ffb8c2' },
      { light: '#ffe4f4', mid: '#ff91c8', deep: '#8d2b63', core: '#c9f6ff' },
      { light: '#fff0d9', mid: '#ffc36a', deep: '#a6561c', core: '#fff7db' },
    ],
  },
};

export const THEME_ORDER: ThemeId[] = ['training', 'crystal', 'reactor', 'garden', 'cosmic'];

/** High-contrast tier palette keeps every bubble size unmistakable. */
export const HIGH_CONTRAST_BUBBLES: ThemeBubbleColors[] = [
  { light: '#fff6cf', mid: '#ffd447', deep: '#5b4400', core: '#fffdf5' },
  { light: '#d9f8ff', mid: '#42d8ff', deep: '#053f52', core: '#ffffff' },
  { light: '#ffdbf2', mid: '#ff56c7', deep: '#5c043f', core: '#ffffff' },
  { light: '#e4ffe3', mid: '#68ff7a', deep: '#0e4d16', core: '#ffffff' },
];

export function getTheme(id: ThemeId): ThemeSpec {
  return THEMES[id] ?? THEMES.training;
}
