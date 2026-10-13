import type { CheckerShape } from '../store/settings';

export type PointStyle = 'classic' | 'rounded' | 'slim' | 'arch';

export interface AppColors { bg: string; card: string; cardB: string; text: string; muted: string; acc: string; accT: string; act: string }
export interface BoardColors {
  frame: string; frameStroke?: string; inlay?: string; noFrame?: boolean;
  bed: string; bar: string; pA: string; pB: string; pStroke: string | null; num: string; point: PointStyle;
  rimA: string; rimB: string;
}
export interface DiceStyle { fill: string; stroke: string; sw: number; pip: string; r: number; pipShape: 'circle' | 'square' | 'ring' }

export interface Theme {
  id: string; he: string; en: string;
  app: AppColors; bd: BoardColors; shape: CheckerShape; die: DiceStyle; hl: string;
}

const G = '#0F4C3A';

export const THEMES: Theme[] = [
  { id: 'emerald-classic', he: 'אמרלד קלאסי', en: 'Emerald classic',
    app: { bg: G, card: '#0B3D2F', cardB: 'rgba(255,255,255,.14)', text: '#FFFFFF', muted: '#A9C9BC', acc: '#FFFFFF', accT: G, act: '#FFFFFF' },
    bd: { frame: '#0A3328', bed: '#E6EEE9', bar: '#0A3328', pA: G, pB: '#FFFFFF', pStroke: 'rgba(15,76,58,.25)', num: '#A9C9BC', point: 'classic', rimA: '#E6EEE9', rimB: G },
    shape: 'flat', die: { fill: '#FFFFFF', stroke: '#0A3328', sw: 1, pip: G, r: .2, pipShape: 'circle' }, hl: '#F2B33D' },
  { id: 'emerald-night', he: 'לילה ירוק', en: 'Emerald night',
    app: { bg: '#071F18', card: '#0D2E24', cardB: 'rgba(63,181,138,.25)', text: '#FFFFFF', muted: '#7FA899', acc: '#3FB58A', accT: '#04150F', act: '#3FB58A' },
    bd: { frame: G, bed: '#0B3A2D', bar: '#082C22', pA: '#3FB58A', pB: '#FFFFFF', pStroke: null, num: '#7FC9AA', point: 'rounded', rimA: '#1E7A58', rimB: '#B9CFC6' },
    shape: 'dome', die: { fill: G, stroke: '#3FB58A', sw: 1.5, pip: '#FFFFFF', r: .24, pipShape: 'circle' }, hl: '#FFD34E' },
  { id: 'paper-white', he: 'נייר לבן', en: 'Paper white',
    app: { bg: '#FFFFFF', card: '#F2F6F4', cardB: '#DCE6E1', text: G, muted: '#6B8A7E', acc: G, accT: '#FFFFFF', act: G },
    bd: { frame: '#FFFFFF', frameStroke: G, bed: '#F6F9F7', bar: G, pA: G, pB: '#FFFFFF', pStroke: G, num: '#6B8A7E', point: 'slim', rimA: G, rimB: G },
    shape: 'outline', die: { fill: '#FFFFFF', stroke: G, sw: 2, pip: G, r: .18, pipShape: 'square' }, hl: '#E8A317' },
  { id: 'green-ivory-gold', he: 'ירוק, שנהב וזהב', en: 'Green, ivory and gold',
    app: { bg: '#0C3B2E', card: G, cardB: 'rgba(212,175,55,.3)', text: '#F4EFE2', muted: '#B9C9B0', acc: '#D4AF37', accT: '#0C3B2E', act: '#D4AF37' },
    bd: { frame: G, inlay: '#D4AF37', bed: '#15604A', bar: '#0C3B2E', pA: '#C9A54A', pB: '#F4EFE2', pStroke: null, num: '#D4AF37', point: 'classic', rimA: '#8C6F22', rimB: '#B8AE93' },
    shape: 'engraved', die: { fill: '#F4EFE2', stroke: '#C9A54A', sw: 1.2, pip: G, r: .2, pipShape: 'circle' }, hl: '#FF8F5A' },
  { id: 'geometric', he: 'גיאומטרי מודרני', en: 'Modern geometric',
    app: { bg: '#F2F6F4', card: '#FFFFFF', cardB: '#DCE6E1', text: G, muted: '#6B8A7E', acc: G, accT: '#FFFFFF', act: G },
    bd: { frame: '#DCE7E1', bed: '#DCE7E1', bar: '#C9D9D0', pA: G, pB: '#FFFFFF', pStroke: null, num: '#6B8A7E', point: 'arch', noFrame: true, rimA: '#0A3328', rimB: '#AFC7BB' },
    shape: 'hex', die: { fill: '#FFFFFF', stroke: '#C9D9D0', sw: 1, pip: G, r: .5, pipShape: 'ring' }, hl: '#F2B33D' },
  { id: 'casino-chips', he: 'אסימוני קזינו', en: 'Casino chips',
    app: { bg: G, card: '#0B3D2F', cardB: 'rgba(255,255,255,.14)', text: '#FFFFFF', muted: '#A9C9BC', acc: '#FFFFFF', accT: G, act: '#FFFFFF' },
    bd: { frame: '#0A3328', bed: '#9FBFB0', bar: '#0A3328', pA: G, pB: '#FFFFFF', pStroke: null, num: '#CFE0D8', point: 'classic', rimA: '#FFFFFF', rimB: G },
    shape: 'chip', die: { fill: '#FFFFFF', stroke: '#0A3328', sw: 1, pip: G, r: .22, pipShape: 'circle' }, hl: '#FFD34E' },
  { id: 'terracotta-sand', he: 'טרקוטה וחול', en: 'Terracotta and sand',
    app: { bg: G, card: '#0B3D2F', cardB: 'rgba(255,255,255,.14)', text: '#FFFFFF', muted: '#A9C9BC', acc: '#E07A5F', accT: '#FFFFFF', act: '#E07A5F' },
    bd: { frame: '#0A3328', bed: '#EADFCB', bar: '#0A3328', pA: '#C8613F', pB: '#FFFFFF', pStroke: 'rgba(200,97,63,.35)', num: '#CFE0D8', point: 'rounded', rimA: '#8E3F25', rimB: '#C8613F' },
    shape: 'flat', die: { fill: '#FFFFFF', stroke: '#C8613F', sw: 1.2, pip: '#C8613F', r: .22, pipShape: 'circle' }, hl: G },
  { id: 'navy-white', he: 'כחול ולבן', en: 'Navy and white',
    app: { bg: '#13263F', card: '#1B3354', cardB: 'rgba(255,255,255,.14)', text: '#FFFFFF', muted: '#9FB4CC', acc: '#FFFFFF', accT: '#13263F', act: '#FFFFFF' },
    bd: { frame: '#0B1828', bed: '#A9C2D9', bar: '#13263F', pA: '#1D3557', pB: '#FFFFFF', pStroke: null, num: '#9FB4CC', point: 'slim', rimA: '#0E1D33', rimB: '#9FB4CC' },
    shape: 'dome', die: { fill: '#FFFFFF', stroke: '#13263F', sw: 1, pip: '#1D3557', r: .2, pipShape: 'circle' }, hl: '#F2B33D' },
];

export const CHECKER_SHAPES: { id: CheckerShape; he: string }[] = [
  { id: 'flat', he: 'שטוח עם טבעת' }, { id: 'dome', he: 'קמור' }, { id: 'outline', he: 'קו מתאר' },
  { id: 'engraved', he: 'חרוט' }, { id: 'hex', he: 'משושה' }, { id: 'chip', he: 'אסימון' },
];

export const themeById = (id: string) => THEMES.find(t => t.id === id) ?? THEMES[0];

export function mix(hex: string, w: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(w);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
