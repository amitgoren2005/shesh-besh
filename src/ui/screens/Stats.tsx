import { useEffect, useState } from 'react';
import { IconArrowRight } from '@tabler/icons-react';
import { LEVEL_NAMES, type Level } from '../../engine/types';
import { listGames } from '../../store/db';
import type { GameRecord } from '../../store/types';
import { ratingLabel } from '../../training/analysis';
import type { Nav } from '../App';

export function Stats({ nav }: { nav: Nav }) {
  const [games, setGames] = useState<GameRecord[] | null>(null);
  useEffect(() => { listGames().then(setGames).catch(() => setGames([])); }, []);
  const fin = (games ?? []).filter(g => g.status === 'finished' && g.result);
  const wins = fin.filter(g => g.result!.winner === 'w');
  const points = fin.reduce((s, g) => s + (g.result!.winner === 'w' ? g.result!.points : -g.result!.points), 0);
  const rated = fin.filter(g => g.rating != null).slice().reverse();
  const avg = rated.length ? rated.reduce((s, g) => s + g.rating!, 0) / rated.length : null;
  const sev = { inaccuracy: 0, mistake: 0, blunder: 0 };
  let luckSum = 0, luckN = 0;
  for (const g of fin) for (const t of g.turns) {
    if (t.side === 'w' && t.analysis && t.analysis.severity !== 'none') sev[t.analysis.severity]++;
    if (t.luck != null) { luckSum += t.side === 'w' ? t.luck : -t.luck; luckN++; }
  }
  const perGame = fin.length ? (sev.inaccuracy + sev.mistake + sev.blunder) / fin.length : 0;

  return (
    <div className="screen page">
      <div className="topbar">
        <button className="u ibtn" aria-label="חזרה" onClick={() => nav.go({ name: 'home' })}><IconArrowRight size={18} /></button>
        <h1>סטטיסטיקה</h1>
        <span className="muted" style={{ fontSize: 12, marginInlineStart: 'auto' }}>משחקים שהופסקו לא נספרים</span>
      </div>
      {!fin.length ? <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>כאן יופיעו הנתונים שלך אחרי המשחק הראשון שיסתיים.</div> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          <div className="metric"><small>משחקים</small><b>{fin.length}</b></div>
          <div className="metric"><small>אחוז ניצחונות</small><b>{Math.round(wins.length / fin.length * 100)}%</b></div>
          <div className="metric"><small>מאזן נקודות</small><b dir="ltr">{points > 0 ? '+' : ''}{points}</b></div>
          <div className="metric"><small>דירוג ממוצע</small><b>{avg != null ? avg.toFixed(1) : '—'}</b>{avg != null && <small>{ratingLabel(avg)}</small>}</div>
          <div className="metric"><small>מזל ממוצע לתור</small><b dir="ltr">{luckN ? (luckSum / luckN >= 0 ? '+' : '') + (luckSum / luckN).toFixed(3) : '—'}</b></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 8, flex: 1, minHeight: 0 }}>
          <div className="card" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>דירוג ביצועים לאורך זמן <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>(נמוך = טוב יותר)</span></div>
            <RatingChart values={rated.slice(-30).map(g => g.rating!)} />
          </div>
          <div className="card" style={{ padding: '8px 12px', fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>טעויות (סה"כ · {perGame.toFixed(1)} למשחק)</div>
            <Bar label="אי-דיוק" n={sev.inaccuracy} max={Math.max(1, sev.inaccuracy, sev.mistake, sev.blunder)} color="#ffd34e" />
            <Bar label="טעות" n={sev.mistake} max={Math.max(1, sev.inaccuracy, sev.mistake, sev.blunder)} color="#ffb648" />
            <Bar label="טעות חמורה" n={sev.blunder} max={Math.max(1, sev.inaccuracy, sev.mistake, sev.blunder)} color="#ff7a6b" />
            <div style={{ fontWeight: 700, margin: '10px 0 4px' }}>לפי רמת המחשב</div>
            {([0, 1, 2, 3, 4] as Level[]).map(l => {
              const gl = fin.filter(g => g.level === l); if (!gl.length) return null;
              const w = gl.filter(g => g.result!.winner === 'w').length;
              return <div key={l} style={{ display: 'flex', fontSize: 12.5, padding: '1px 0' }}><span style={{ width: 90 }}>{LEVEL_NAMES[l]}</span><span className="muted">{w}–{gl.length - w} ({Math.round(w / gl.length * 100)}%)</span></div>;
            })}
          </div>
        </div>
      </>}
    </div>
  );
}

function Bar({ label, n, max, color }: { label: string; n: number; max: number; color: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
    <span style={{ width: 74, fontSize: 12.5 }}>{label}</span>
    <span style={{ flex: 1, height: 10, borderRadius: 5, background: 'rgba(127,127,127,.18)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${n / max * 100}%`, background: color, borderRadius: 5 }} /></span>
    <span style={{ width: 26, textAlign: 'left', fontSize: 12.5 }}>{n}</span>
  </div>;
}

function RatingChart({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="muted" style={{ fontSize: 12, margin: 'auto' }}>צריך לפחות שני משחקים מדורגים כדי להציג גרף.</div>;
  const W = 420, H = 190, P = 24, max = Math.max(10, ...values) * 1.1;
  const x = (i: number) => P + (W - 2 * P) * (i / (values.length - 1));
  const y = (v: number) => H - P - (H - 2 * P) * (v / max);
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const grid = [0, 5, 10, 20, 30].filter(g => g < max);
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', flex: 1, direction: 'ltr' }}>
    {grid.map(g => <g key={g}><line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={.12} /><text x={P - 4} y={y(g) + 3} fontSize={9} textAnchor="end" fill="currentColor" opacity={.6}>{g}</text></g>)}
    <path d={path} fill="none" stroke="var(--acc)" strokeWidth={2.2} strokeLinejoin="round" />
    {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="var(--acc)" />)}
  </svg>;
}
