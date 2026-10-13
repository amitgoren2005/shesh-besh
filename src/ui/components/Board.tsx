import { useEffect, useRef, useState, type ReactNode } from 'react';
import { applyStep, type Dest, type Position, type Side, type Step } from '../../game/rules';
import type { DieView } from '../../game/controller';
import type { CheckerShape } from '../../store/settings';
import { mix, type DiceStyle, type Theme } from '../themes';

export const BW = 540, BH = 377;
const F = 18, BARW = 30, HALF = (BW - 2 * F - BARW) / 2, PW = HALF / 6, R = 15, PH = 150, TRAY = 64, GAP = 6;
export const FULL_W = BW + GAP + TRAY;

export interface BoardProps {
  pos: Position;
  theme: Theme;
  shape: CheckerShape;
  dieStyle: DiceStyle;
  homeSide: 'right' | 'left';
  dice?: DieView[];
  diceSide?: Side;
  rollFaces?: [number, number] | null;
  opening?: { w: number; b: number; winner: Side | null; tie: boolean } | null;
  selected?: number | null;
  dests?: Dest[];
  movable?: number[];
  lastBot?: number[];
  ghosts?: { from: Position; steps: Step[]; nonce: number } | null;
  thinking?: boolean;
  onTap?: (p: number) => void;
  className?: string;
}

const isTop = (p: number) => p >= 13;

export function Board(props: BoardProps) {
  const { pos, theme: T, shape, dieStyle, homeSide, onTap } = props;
  const B = T.bd;
  const mirror = homeSide === 'left';
  const boardX = mirror ? TRAY + GAP : 0, trayX = mirror ? 0 : BW + GAP;

  const baseX = (p: number) => {
    const rx = F + HALF + BARW;
    if (p <= 6) return rx + HALF - (p - .5) * PW;
    if (p <= 12) return F + HALF - (p - 6.5) * PW;
    if (p <= 18) return F + (p - 12.5) * PW;
    return rx + (p - 18.5) * PW;
  };
  const px = (p: number) => boardX + (mirror ? BW - baseX(p) : baseX(p));
  const cy = (p: number, k: number, n: number) => {
    const sp = n <= 5 ? 2 * R : (PH - 2 * R) / (n - 1);
    return isTop(p) ? F + R + k * sp : BH - F - R - k * sp;
  };
  const barX = boardX + F + HALF + BARW / 2;
  const homeHalfX = boardX + (mirror ? F + HALF / 2 : F + HALF + BARW + HALF / 2);
  const awayHalfX = boardX + (mirror ? F + HALF + BARW + HALF / 2 : F + HALF / 2);
  const count = (side: Side, abs: number) => (side === 'w' ? pos.w[abs] : pos.b[25 - abs]);

  const els: ReactNode[] = [];
  let k = 0;
  const key = () => k++;

  // frame
  if (B.noFrame) els.push(<rect key={key()} x={boardX} width={BW} height={BH} rx={16} fill={B.bed} />);
  else {
    els.push(<rect key={key()} x={boardX} width={BW} height={BH} rx={12} fill={B.frame} stroke={B.frameStroke} strokeWidth={B.frameStroke ? 2 : 0} />);
    if (B.inlay) els.push(<rect key={key()} x={boardX + 3.5} y={3.5} width={BW - 7} height={BH - 7} rx={10} fill="none" stroke={B.inlay} strokeWidth={1.3} />);
    els.push(<rect key={key()} x={boardX + F} y={F} width={HALF} height={BH - 2 * F} fill={B.bed} />);
    els.push(<rect key={key()} x={boardX + F + HALF + BARW} y={F} width={HALF} height={BH - 2 * F} fill={B.bed} />);
  }
  els.push(B.noFrame
    ? <rect key={key()} x={boardX + F + HALF + 11} y={F} width={BARW - 22} height={BH - 2 * F} rx={4} fill={B.bar} />
    : <rect key={key()} x={boardX + F + HALF + 3} y={F - 3} width={BARW - 6} height={BH - 2 * F + 6} rx={3} fill={B.bar} />);

  const destSet = new Map((props.dests ?? []).map(d => [d.to, d]));
  for (let p = 1; p <= 24; p++) {
    const x = px(p);
    els.push(<PointShape key={key()} T={T} p={p} x={x} fill={p % 2 ? B.pA : B.pB} />);
    els.push(<text key={key()} x={x} y={isTop(p) ? F - 5 : BH - F + 12} fontSize={8.5} textAnchor="middle" fill={B.num}>{p}</text>);
    if (destSet.has(p)) els.push(<PointShape key={key()} T={T} p={p} x={x} fill={T.hl} hl />);
  }

  const movable = new Set(props.movable ?? []);
  const lastBot = new Set((props.lastBot ?? []).map(p => (p === 0 ? -1 : 25 - p)));
  for (let p = 1; p <= 24; p++) {
    const x = px(p);
    (['w', 'b'] as Side[]).forEach(side => {
      const n = count(side, p);
      for (let i = 0; i < n; i++) {
        const y = cy(p, i, n);
        els.push(<Checker key={key()} T={T} shape={shape} x={x} y={y} dark={side === 'b'} />);
        if (i === n - 1) {
          if (side === 'w' && props.selected === p) els.push(<circle key={key()} cx={x} cy={y} r={R + 2.5} fill="none" stroke={T.hl} strokeWidth={3} />);
          else if (side === 'w' && props.selected == null && movable.has(p)) els.push(<circle key={key()} cx={x} cy={y} r={R + 1.5} fill="none" stroke={T.hl} strokeOpacity={.55} strokeWidth={1.5} />);
          if (side === 'b' && lastBot.has(p)) els.push(<circle key={key()} cx={x} cy={y} r={R + 2} fill="none" stroke={T.hl} strokeWidth={1.6} strokeDasharray="3 2" />);
        }
      }
      if (n > 5) els.push(<text key={key()} x={x} y={cy(p, n - 1, n) + 4} fontSize={11} fontWeight={700} textAnchor="middle" fill={side === 'w' ? mix(B.pA, '#000000', .2) : B.pB}>{n}</text>);
    });
  }
  // bar checkers
  for (let i = 0; i < pos.b[25]; i++) els.push(<Checker key={key()} T={T} shape={shape} x={barX} y={BH / 2 - R - 8 - i * 2 * R * .8} dark />);
  for (let i = 0; i < pos.w[25]; i++) {
    const y = BH / 2 + R + 8 + i * 2 * R * .8;
    els.push(<Checker key={key()} T={T} shape={shape} x={barX} y={y} dark={false} />);
    if (i === pos.w[25] - 1 && (props.selected === 25 || (props.selected == null && movable.has(25))))
      els.push(<circle key={key()} cx={barX} cy={y} r={R + 2.5} fill="none" stroke={T.hl} strokeOpacity={props.selected === 25 ? 1 : .55} strokeWidth={props.selected === 25 ? 3 : 1.5} />);
  }

  // destination markers
  for (const d of props.dests ?? []) {
    if (d.to === 0) continue;
    const n = pos.w[d.to], x = px(d.to), y = cy(d.to, Math.min(n, 4), Math.max(n + 1, 1));
    els.push(<g key={key()}>
      <circle cx={x} cy={y} r={R - 1} fill={T.hl} fillOpacity={.28} stroke={T.hl} strokeWidth={2} strokeDasharray="4 3" />
      <text x={x} y={y + 4.5} fontSize={11.5} fontWeight={700} textAnchor="middle" fill={mix(T.hl, '#000000', .65)}>{d.steps.map(s => s.die).join('+')}</text>
    </g>);
  }

  // dice
  const diceAt = (cx: number, list: { v: number; used?: boolean }[]) => {
    const n = list.length, sz = n > 2 ? 24 : 30, g = 6, tw = n * sz + (n - 1) * g;
    list.forEach((d, i) => els.push(<Die key={key()} s={dieStyle} x={cx - tw / 2 + i * (sz + g)} y={BH / 2 - sz / 2} v={d.v} sz={sz} fade={!!d.used} />));
  };
  if (props.rollFaces) diceAt(props.diceSide === 'b' ? awayHalfX : homeHalfX, props.rollFaces.map(v => ({ v })));
  else if (props.dice?.length) diceAt(props.diceSide === 'b' ? awayHalfX : homeHalfX, props.dice);
  if (props.opening) {
    const o = props.opening;
    els.push(<Die key={key()} s={dieStyle} x={awayHalfX - 15} y={BH / 2 - 15} v={o.b} sz={30} />);
    els.push(<Die key={key()} s={dieStyle} x={homeHalfX - 15} y={BH / 2 - 15} v={o.w} sz={30} />);
    const label = o.tie ? 'תיקו – מטילים שוב' : o.winner === 'w' ? 'אתה מתחיל' : o.winner === 'b' ? 'המחשב מתחיל' : '';
    if (label) els.push(<Pill key={key()} x={o.tie ? boardX + BW / 2 : o.winner === 'w' ? homeHalfX : awayHalfX} y={BH / 2 + 21} text={label} />);
  }
  if (props.thinking) els.push(<Pill key={key()} x={awayHalfX} y={BH / 2 + 21} text="המחשב חושב…" />);

  // ghosts (demonstration): consecutive steps of one checker are merged into one arc
  if (props.ghosts) {
    let p = props.ghosts.from;
    const segs: { from: number; to: number; pBefore: Position; pAfter: Position }[] = [];
    for (const s of props.ghosts.steps) {
      const next = applyStep(p, 'w', s).pos;
      const last = segs[segs.length - 1];
      if (last && last.to === s.from && last.to !== 0 && last.pAfter.b[25] === last.pBefore.b[25]) { last.to = s.to; last.pAfter = next; }
      else segs.push({ from: s.from, to: s.to, pBefore: p, pAfter: next });
      p = next;
    }
    segs.forEach((g, i) => {
      const nFrom = g.pBefore.w[g.from];
      const x0 = g.from === 25 ? barX : px(g.from), y0 = g.from === 25 ? BH / 2 + R + 8 : cy(g.from, nFrom - 1, nFrom);
      const nTo = g.to === 0 ? 0 : g.pAfter.w[g.to];
      const x1 = g.to === 0 ? trayX + TRAY / 2 : px(g.to), y1 = g.to === 0 ? BH - 40 : cy(g.to, nTo - 1, nTo);
      els.push(<Ghost key={`g${props.ghosts!.nonce}-${i}`} x0={x0} y0={y0} x1={x1} y1={y1} delay={i * 0.6} T={T} />);
    });
  }

  // tray
  const trayInner = B.noFrame ? B.bar : B.frame === '#FFFFFF' ? '#EEF3F0' : mix(B.frame, '#000000', .3);
  els.push(<rect key={key()} x={trayX + 1} y={1} width={TRAY - 2} height={BH - 2} rx={12} fill={B.noFrame ? B.bed : B.frame} stroke={B.frameStroke} strokeWidth={B.frameStroke ? 2 : 0} />);
  els.push(<rect key={key()} x={trayX + 8} y={10} width={TRAY - 16} height={BH / 2 - 16} rx={6} fill={trayInner} />);
  const offHl = destSet.has(0);
  els.push(<rect key={key()} x={trayX + 8} y={BH / 2 + 6} width={TRAY - 16} height={BH / 2 - 16} rx={6} fill={offHl ? T.hl : trayInner} fillOpacity={offHl ? .45 : 1} stroke={offHl ? T.hl : 'none'} strokeWidth={2} />);
  for (let i = 0; i < pos.b[0]; i++) els.push(<rect key={key()} x={trayX + 12} y={14 + i * 9.6} width={TRAY - 24} height={7.5} rx={2} fill={B.pA} stroke={B.rimA} strokeOpacity={.5} />);
  for (let i = 0; i < pos.w[0]; i++) els.push(<rect key={key()} x={trayX + 12} y={BH - 22 - i * 9.6} width={TRAY - 24} height={7.5} rx={2} fill={B.pB} stroke={B.rimB} strokeOpacity={.6} />);
  if (offHl) els.push(<text key={key()} x={trayX + TRAY / 2} y={BH * .75 + 4} fontSize={12} fontWeight={700} textAnchor="middle" fill={mix(T.hl, '#000000', .65)}>{destSet.get(0)!.steps.map(s => s.die).join('+')}</text>);

  // tap targets
  if (onTap) {
    for (let p = 1; p <= 24; p++) {
      const x = px(p);
      els.push(<rect key={key()} data-p={p} x={x - PW / 2} y={isTop(p) ? 0 : BH / 2} width={PW} height={BH / 2} fill="transparent" onPointerDown={() => onTap(p)} />);
    }
    els.push(<rect key={key()} data-p={25} x={barX - BARW / 2} y={0} width={BARW} height={BH} fill="transparent" onPointerDown={() => onTap(25)} />);
    els.push(<rect key={key()} data-p={0} x={trayX} y={0} width={TRAY} height={BH} fill="transparent" onPointerDown={() => onTap(0)} />);
  }

  return (
    <svg className={props.className} viewBox={`0 0 ${FULL_W} ${BH}`} width={FULL_W} height={BH} style={{ display: 'block', fontFamily: 'Heebo, sans-serif' }}>
      <CheckerDefs T={T} />
      {els}
    </svg>
  );
}

function PointShape({ T, p, x, fill, hl }: { T: Theme; p: number; x: number; fill: string; hl?: boolean }) {
  const t = isTop(p), by = t ? F : BH - F, ty = t ? F + PH : BH - F - PH;
  const st = hl ? { fillOpacity: .22, stroke: fill, strokeWidth: 2.2, strokeLinejoin: 'round' as const }
    : T.bd.pStroke ? { stroke: T.bd.pStroke, strokeWidth: 1 } : {};
  switch (T.bd.point) {
    case 'rounded': {
      const dir = t ? 1 : -1;
      if (hl) return <polygon points={`${x - PW / 2 + 2},${by} ${x + PW / 2 - 2},${by} ${x},${ty - dir * 2}`} fill={fill} {...st} />;
      return <polygon points={`${x - PW / 2 + 3.5},${by} ${x + PW / 2 - 3.5},${by} ${x},${ty - dir * 3}`} fill={fill} stroke={fill} strokeWidth={6} strokeLinejoin="round" />;
    }
    case 'slim': {
      const w = PW * .74;
      return <polygon points={`${x - w / 2},${by} ${x + w / 2},${by} ${x},${ty}`} fill={fill} {...st} />;
    }
    case 'arch': {
      const r = PW * .33;
      const d = t ? `M${x - r},${by} L${x - r},${ty - r} A${r},${r} 0 0 0 ${x + r},${ty - r} L${x + r},${by} Z`
        : `M${x - r},${by} L${x - r},${ty + r} A${r},${r} 0 0 1 ${x + r},${ty + r} L${x + r},${by} Z`;
      return <path d={d} fill={fill} {...(hl ? st : {})} />;
    }
    default:
      return <polygon points={`${x - PW / 2 + .5},${by} ${x + PW / 2 - .5},${by} ${x},${ty}`} fill={fill} {...st} />;
  }
}

export function CheckerDefs({ T }: { T: Theme }) {
  const g = (id: string, c: string, dark: boolean) => (
    <radialGradient id={id} cx="38%" cy="32%" r="75%">
      <stop offset="0" stopColor={mix(c, '#ffffff', dark ? .35 : 0)} />
      <stop offset=".65" stopColor={c} />
      <stop offset="1" stopColor={mix(c, '#000000', .25)} />
    </radialGradient>
  );
  return <defs>{g(`dome-${T.id}-A`, T.bd.pA, true)}{g(`dome-${T.id}-B`, T.bd.pB, false)}</defs>;
}

export function Checker({ T, shape, x, y, dark, r = R, opacity }: { T: Theme; shape: CheckerShape; x: number; y: number; dark: boolean; r?: number; opacity?: number }) {
  const fill = dark ? T.bd.pA : T.bd.pB, rim = dark ? T.bd.rimA : T.bd.rimB;
  const o = { opacity };
  switch (shape) {
    case 'dome':
      return <circle cx={x} cy={y} r={r - .5} fill={`url(#dome-${T.id}-${dark ? 'A' : 'B'})`} stroke={rim} strokeWidth={1} {...o} />;
    case 'chip':
      return <g {...o}>
        <circle cx={x} cy={y} r={r - .5} fill={fill} stroke={rim} strokeOpacity={.5} />
        <circle cx={x} cy={y} r={r - 3} fill="none" stroke={rim} strokeWidth={3.2} strokeDasharray="4.2 3.6" />
        <circle cx={x} cy={y} r={r - 7} fill={fill} stroke={rim} strokeOpacity={.6} />
      </g>;
    case 'engraved':
      return <g {...o}>
        <circle cx={x} cy={y} r={r - .5} fill={fill} stroke={rim} strokeWidth={1.2} />
        <circle cx={x} cy={y} r={r - 4} fill="none" stroke={rim} strokeOpacity={.55} />
        <circle cx={x} cy={y} r={r - 8} fill="none" stroke={rim} strokeOpacity={.45} />
        <circle cx={x} cy={y} r={2} fill={rim} fillOpacity={.55} />
      </g>;
    case 'outline':
      return <g {...o}>
        <circle cx={x} cy={y} r={r - 1} fill={fill} stroke={dark ? fill : rim} strokeWidth={2} />
        <circle cx={x} cy={y} r={r - 5.5} fill="none" stroke={dark ? '#ffffff' : rim} strokeOpacity={.5} />
      </g>;
    case 'hex': {
      const hx = (rr: number) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 3 * i; return `${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`; }).join(' ');
      return <g {...o}>
        <polygon points={hx(r)} fill={fill} stroke={rim} strokeWidth={1.4} strokeLinejoin="round" />
        <polygon points={hx(r - 5)} fill="none" stroke={rim} strokeOpacity={.45} />
      </g>;
    }
    default:
      return <g {...o}>
        <circle cx={x} cy={y} r={r - .5} fill={fill} stroke={rim} strokeWidth={1.4} />
        <circle cx={x} cy={y} r={r - 5} fill="none" stroke={rim} strokeOpacity={.5} />
      </g>;
  }
}

const PIPS: Record<number, number[][]> = {
  1: [[.5, .5]], 2: [[.28, .28], [.72, .72]], 3: [[.26, .26], [.5, .5], [.74, .74]], 4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]],
  5: [[.26, .26], [.74, .26], [.5, .5], [.26, .74], [.74, .74]], 6: [[.28, .22], [.72, .22], [.28, .5], [.72, .5], [.28, .78], [.72, .78]],
};

export function Die({ s, x, y, v, sz, fade }: { s: DiceStyle; x: number; y: number; v: number; sz: number; fade?: boolean }) {
  const pr = sz * .09;
  return <g opacity={fade ? .3 : 1}>
    <rect x={x} y={y} width={sz} height={sz} rx={sz * s.r} fill={s.fill} stroke={s.stroke} strokeWidth={s.sw} />
    {PIPS[v].map(([a, b], i) => {
      const cx = x + a * sz, cy = y + b * sz;
      if (s.pipShape === 'square') return <rect key={i} x={cx - pr} y={cy - pr} width={pr * 2} height={pr * 2} rx={1} fill={s.pip} />;
      if (s.pipShape === 'ring') return <circle key={i} cx={cx} cy={cy} r={pr * .95} fill="none" stroke={s.pip} strokeWidth={1.6} />;
      return <circle key={i} cx={cx} cy={cy} r={pr} fill={s.pip} />;
    })}
  </g>;
}

function Pill({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 7 + 22;
  return <g>
    <rect x={x - w / 2} y={y} width={w} height={20} rx={10} fill="rgba(5,20,15,.85)" />
    <text x={x} y={y + 14} fontSize={11.5} textAnchor="middle" fill="#fff">{text}</text>
  </g>;
}

function Ghost({ x0, y0, x1, y1, delay, T }: { x0: number; y0: number; x1: number; y1: number; delay: number; T: Theme }) {
  const [at, setAt] = useState(false);
  const ref = useRef<number>(0);
  useEffect(() => {
    ref.current = requestAnimationFrame(() => { ref.current = requestAnimationFrame(() => setAt(true)); });
    return () => cancelAnimationFrame(ref.current);
  }, []);
  const x = at ? x1 : x0, y = at ? y1 : y0;
  return <g>
    <path d={`M${x0},${y0} Q${(x0 + x1) / 2},${Math.abs(y1 - y0) < 60 ? (y0 < BH / 2 ? Math.max(y0, y1) + 55 : Math.min(y0, y1) - 55) : BH / 2} ${x1},${y1}`} fill="none" stroke={T.hl} strokeWidth={2.5} strokeDasharray="6 4" />
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform .9s ease-in-out ${delay}s` }}>
      <circle r={R - 1} fill={T.bd.pB} fillOpacity={.6} stroke={T.hl} strokeWidth={2.2} strokeDasharray="4 3" />
    </g>
  </g>;
}
