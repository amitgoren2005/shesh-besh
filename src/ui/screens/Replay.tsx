import { useEffect, useRef, useState } from 'react';
import {
  IconArrowRight, IconPlayerPause, IconPlayerPlay, IconPlayerSkipBack, IconPlayerSkipForward,
  IconPlayerTrackNext, IconPlayerTrackPrev,
} from '@tabler/icons-react';
import { initialPosition, type Position } from '../../game/rules';
import { getGame } from '../../store/db';
import { useSettings } from '../../store/settings';
import type { GameRecord } from '../../store/types';
import { Board } from '../components/Board';
import { themeById } from '../themes';
import type { Nav } from '../App';
import { resultTag } from './History';

export function Replay({ id, nav }: { id: string; nav: Nav }) {
  const s = useSettings();
  const theme = themeById(s.boardTheme), dieStyle = themeById(s.diceTheme).die;
  const [g, setG] = useState<GameRecord | null>(null);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { getGame(id).then(r => setG(r ?? null)).catch(() => setG(null)); }, [id]);

  const n = g?.turns.length ?? 0;
  useEffect(() => {
    if (!playing) return;
    if (i >= n) { setPlaying(false); return; }
    const t = setTimeout(() => setI(x => Math.min(n, x + 1)), 1300);
    return () => clearTimeout(t);
  }, [playing, i, n]);
  useEffect(() => { listRef.current?.querySelector('[data-cur="1"]')?.scrollIntoView({ block: 'nearest' }); }, [i]);

  if (!g) return <div className="screen page"><div className="muted">טוען…</div></div>;
  const turn = i > 0 ? g.turns[i - 1] : null;
  const pos: Position = turn ? turn.after : g.turns[0]?.before ?? initialPosition();
  const tag = resultTag(g);

  return (
    <div className="screen game">
      <div className="board-wrap">
        <Board pos={pos} theme={theme} shape={s.checkerShape} dieStyle={dieStyle} homeSide={s.homeSide}
          dice={turn ? (turn.dice[0] === turn.dice[1] ? [0, 0, 0, 0] : [0, 0]).map((_, k) => ({ v: turn.dice[k % 2], used: false })) : []}
          diceSide={turn?.side ?? 'w'} lastBot={turn?.side === 'b' ? turn.steps.map(x => x.to) : []} />
      </div>
      <div className="panel">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="u ibtn" aria-label="חזרה" onClick={nav.back}><IconArrowRight size={18} /></button>
          <span style={{ fontSize: 13, fontWeight: 700 }}>צפייה חוזרת</span>
        </div>
        <div className="sname">{g.name}</div>
        <span className={`tag ${tag.cls}`} style={{ alignSelf: 'flex-start' }}>{tag.text}</span>
        <div className="card" style={{ padding: '6px 8px', fontSize: 13, minHeight: 46 }}>
          {turn ? <>
            <div className="muted" style={{ fontSize: 11 }}>מהלך {i} מתוך {n} · {turn.side === 'w' ? 'אתה' : 'המחשב'}</div>
            <div><b dir="ltr">{turn.dice.join('-')}</b> <span dir="ltr">{turn.notation || 'אין מהלך'}</span></div>
          </> : <div className="muted" style={{ fontSize: 12 }}>עמדת הפתיחה</div>}
        </div>
        <div ref={listRef} className="card scroll" style={{ flex: 1, minHeight: 0, flexShrink: 1, fontSize: 12 }}>
          {g.turns.map((t, k) => {
            const cur = k + 1 === i;
            return (
              <button key={k} data-cur={cur ? '1' : '0'} className="u" onClick={() => { setPlaying(false); setI(k + 1); }}
                style={{ display: 'block', width: '100%', padding: '3px 7px', background: cur ? 'var(--acc)' : 'transparent', color: cur ? 'var(--accT)' : 'var(--text)', textAlign: 'right', borderBottom: '1px solid var(--cardB)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                  <span style={{ width: 20, opacity: .7 }}>{k + 1}</span>
                  <span style={{ width: 9, height: 9, borderRadius: 5, display: 'inline-block', background: t.side === 'w' ? theme.bd.pB : theme.bd.pA, border: `1px solid ${t.side === 'w' ? theme.bd.rimB : theme.bd.rimA}` }} />
                  <span>{t.side === 'w' ? 'אתה' : 'המחשב'}</span>
                  <span dir="ltr" style={{ marginInlineStart: 'auto', fontWeight: 700 }}>{t.dice.join('-')}</span>
                </div>
                <div dir="ltr" style={{ fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.notation || '—'}</div>
              </button>
            );
          })}
        </div>
        <input type="range" min={0} max={n} value={i} onChange={e => { setPlaying(false); setI(+e.target.value); }} style={{ width: '100%', accentColor: 'var(--acc)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="u ibtn" aria-label="להתחלה" onClick={() => setI(0)}><IconPlayerSkipForward size={16} /></button>
          <button className="u ibtn" aria-label="הקודם" onClick={() => setI(x => Math.max(0, x - 1))}><IconPlayerTrackNext size={16} /></button>
          <button className="u ibtn" aria-label={playing ? 'עצירה' : 'ניגון'} onClick={() => { if (i >= n) setI(0); setPlaying(!playing); }}>{playing ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}</button>
          <button className="u ibtn" aria-label="הבא" onClick={() => setI(x => Math.min(n, x + 1))}><IconPlayerTrackPrev size={16} /></button>
          <button className="u ibtn" aria-label="לסוף" onClick={() => setI(n)}><IconPlayerSkipBack size={16} /></button>
        </div>
      </div>
    </div>
  );
}
