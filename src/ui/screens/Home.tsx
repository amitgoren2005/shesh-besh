import { useEffect, useState } from 'react';
import { IconChartLine, IconHelpCircle, IconHistory, IconPlayerPlay, IconSettings } from '@tabler/icons-react';
import { initialPosition } from '../../game/rules';
import { LEVEL_NAMES } from '../../engine/types';
import { listGames } from '../../store/db';
import { useSettings } from '../../store/settings';
import type { GameRecord } from '../../store/types';
import { ratingLabel } from '../../training/analysis';
import { Board } from '../components/Board';
import { themeById } from '../themes';
import type { Nav } from '../App';

export function Home({ nav, msg }: { nav: Nav; msg?: string }) {
  const s = useSettings();
  const theme = themeById(s.boardTheme), dice = themeById(s.diceTheme).die;
  const [games, setGames] = useState<GameRecord[] | null>(null);
  useEffect(() => { listGames().then(setGames).catch(() => setGames([])); }, []);

  const paused = games?.find(g => (g.status === 'paused' || g.status === 'active') && g.live);
  const finished = games?.filter(g => g.status === 'finished') ?? [];
  const today = new Date().toDateString();
  const todayCount = finished.filter(g => new Date(g.updatedAt).toDateString() === today).length;
  const last = finished[0];
  const wins = finished.filter(g => g.result?.winner === 'w').length;
  const rated = finished.filter(g => g.rating != null).slice(0, 10);
  const avg = rated.length ? rated.reduce((a, g) => a + (g.rating ?? 0), 0) / rated.length : null;

  return (
    <div className="screen" style={{ padding: '22px 64px 18px 60px', gap: 28, alignItems: 'center' }}>
      <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 900, fontSize: 56, lineHeight: 1 }}>שש־בש</div>
          <div className="muted" style={{ fontSize: 15, marginTop: 4 }}>מאמן אישי מול המחשב</div>
        </div>
        <button className="u btn primary" style={{ height: 50, fontSize: 19 }} onClick={nav.newGame}>
          <IconPlayerPlay size={20} />משחק חדש
        </button>
        {paused && (
          <button className="u btn" style={{ height: 40 }} onClick={() => nav.resume(paused)}>
            <IconPlayerPlay size={17} />המשך: {paused.name}
          </button>
        )}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button className="u chip" onClick={() => nav.go({ name: 'history' })}><IconHistory size={16} />היסטוריה</button>
          <button className="u chip" onClick={() => nav.go({ name: 'stats' })}><IconChartLine size={16} />סטטיסטיקה</button>
          <button className="u chip" onClick={() => nav.go({ name: 'settings' })}><IconSettings size={16} />הגדרות</button>
          <button className="u chip" onClick={() => nav.go({ name: 'help' })}><IconHelpCircle size={16} />עזרה</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div className="metric"><small>היום</small><b>{todayCount}</b> <span className="muted" style={{ fontSize: 12 }}>משחקים</span></div>
          <div className="metric"><small>מאזן כולל</small><b>{wins}–{finished.length - wins}</b></div>
          <div className="metric"><small>דירוג ממוצע</small><b>{avg != null ? avg.toFixed(1) : '—'}</b>{avg != null && <span className="muted" style={{ fontSize: 11 }}> {ratingLabel(avg)}</span>}</div>
        </div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {last ? `משחק אחרון: ${last.result?.winner === 'w' ? 'ניצחון' : 'הפסד'} · רמה: ${LEVEL_NAMES[last.level]}` : `רמת המחשב: ${LEVEL_NAMES[s.lastLevel]}`}
        </div>
        {msg && <div style={{ fontSize: 13, color: 'var(--hl)' }}>{msg}</div>}
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 380, filter: 'drop-shadow(0 6px 18px rgba(0,0,0,.25))' }}>
          <Board className="home-board" pos={initialPosition()} theme={theme} shape={s.checkerShape} dieStyle={dice} homeSide={s.homeSide} />
        </div>
      </div>
      <style>{'.home-board{width:100%;height:auto}'}</style>
    </div>
  );
}
