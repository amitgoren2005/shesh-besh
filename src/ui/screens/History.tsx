import { useEffect, useMemo, useState } from 'react';
import { IconArrowRight, IconPlayerPlay, IconSchool, IconTrash, IconVideo } from '@tabler/icons-react';
import { LEVEL_NAMES } from '../../engine/types';
import { deleteGame, listGames } from '../../store/db';
import type { GameRecord } from '../../store/types';
import type { Nav } from '../App';

type Filter = 'all' | 'won' | 'lost' | 'paused' | 'stopped' | 'training';
const FILTERS: [Filter, string][] = [['all', 'הכול'], ['won', 'ניצחונות'], ['lost', 'הפסדים'], ['paused', 'מושהים'], ['stopped', 'הופסקו'], ['training', 'עם אימון']];
const KIND: Record<string, string> = { single: 'ניצחון', mars: 'מארס', turkish: 'מארס טורקי' };

export function resultTag(g: GameRecord): { cls: string; text: string } {
  if (g.status === 'finished' && g.result) {
    const won = g.result.winner === 'w';
    return { cls: won ? 'win' : 'loss', text: won ? `ניצחון${g.result.kind !== 'single' ? ` · ${KIND[g.result.kind]}` : ''}` : `הפסד${g.result.kind !== 'single' ? ` · ${KIND[g.result.kind]}` : ''}` };
  }
  if (g.status === 'stopped') return { cls: '', text: 'הופסק' };
  return { cls: 'paused', text: 'מושהה' };
}

export function History({ nav }: { nav: Nav }) {
  const [games, setGames] = useState<GameRecord[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'date' | 'rating'>('date');
  const [confirm, setConfirm] = useState<GameRecord | null>(null);
  const load = () => listGames().then(setGames).catch(() => setGames([]));
  useEffect(() => { void load(); }, []);

  const shown = useMemo(() => {
    let g = games.filter(x => x.name.toLowerCase().includes(q.trim().toLowerCase()));
    g = g.filter(x => {
      switch (filter) {
        case 'won': return x.status === 'finished' && x.result?.winner === 'w';
        case 'lost': return x.status === 'finished' && x.result?.winner === 'b';
        case 'paused': return x.status === 'paused' || x.status === 'active';
        case 'stopped': return x.status === 'stopped';
        case 'training': return x.training;
        default: return true;
      }
    });
    if (sort === 'rating') g = [...g].sort((a, b) => (a.rating ?? 999) - (b.rating ?? 999));
    return g;
  }, [games, q, filter, sort]);

  return (
    <div className="screen page">
      <div className="topbar">
        <button className="u ibtn" aria-label="חזרה" onClick={() => nav.go({ name: 'home' })}><IconArrowRight size={18} /></button>
        <h1>היסטוריית משחקים</h1>
        <input className="field" style={{ width: 200, height: 32, marginInlineStart: 'auto' }} placeholder="חיפוש לפי שם" value={q} onChange={e => setQ(e.target.value)} />
        <div className="seg">
          <button className={sort === 'date' ? 'on' : ''} onClick={() => setSort('date')}>תאריך</button>
          <button className={sort === 'rating' ? 'on' : ''} onClick={() => setSort('rating')}>דירוג</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {FILTERS.map(([f, t]) => <button key={f} className={`u chip ${filter === f ? 'on' : ''}`} style={{ padding: '3px 11px', fontSize: 13 }} onClick={() => setFilter(f)}>{t}</button>)}
      </div>
      <div className="card scroll" style={{ flex: 1 }}>
        {!shown.length && <div className="muted" style={{ padding: 20, textAlign: 'center' }}>{games.length ? 'אין משחקים שמתאימים לחיפוש.' : 'עוד לא שיחקת. התחל משחק חדש מהמסך הראשי.'}</div>}
        {shown.map(g => {
          const tag = resultTag(g), resumable = (g.status === 'paused' || g.status === 'active') && !!g.live;
          return (
            <div key={g.id} className="row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{new Date(g.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })} · {LEVEL_NAMES[g.level]} · {g.turns.length} מהלכים</div>
              </div>
              {g.training && <IconSchool size={16} className="muted" aria-label="מצב אימון" />}
              <span className={`tag ${tag.cls}`}>{tag.text}</span>
              <span style={{ width: 62, fontSize: 13, textAlign: 'center' }}>{g.rating != null ? g.rating.toFixed(1) : '—'}</span>
              {resumable && <button className="u btn small primary" onClick={() => nav.resume(g)}><IconPlayerPlay size={14} />המשך</button>}
              <button className="u btn small" disabled={!g.turns.length} onClick={() => nav.go({ name: 'replay', id: g.id })}><IconVideo size={14} />צפייה</button>
              <button className="u btn small" aria-label="מחיקה" onClick={() => setConfirm(g)}><IconTrash size={14} /></button>
            </div>
          );
        })}
      </div>
      {confirm && (
        <div className="overlay">
          <div className="dialog" style={{ width: 380 }}>
            <h2>למחוק את המשחק?</h2>
            <div className="muted" style={{ fontSize: 14, marginBottom: 12 }}>"{confirm.name}" יימחק לצמיתות מההיסטוריה.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="u btn danger" onClick={async () => { await deleteGame(confirm.id); setConfirm(null); void load(); }}>מחק</button>
              <button className="u btn" onClick={() => setConfirm(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
