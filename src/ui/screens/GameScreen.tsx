import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  IconAlertTriangle, IconArrowBackUp, IconChartLine, IconCheck, IconHelpCircle, IconHistory, IconHome,
  IconInfoCircle, IconMenu2, IconPencil, IconPlayerPause, IconPlayerPlay, IconPlayerStop, IconPlus,
  IconSettings, IconX, IconPalette, IconVolume, IconGauge,
} from '@tabler/icons-react';
import type { Game, Snapshot } from '../../game/controller';
import { pipCount } from '../../game/rules';
import { LEVEL_NAMES } from '../../engine/types';
import { listGames } from '../../store/db';
import { setSettings, useSettings, type Speed } from '../../store/settings';
import { SEVERITY_LABEL, SEVERITY_LEVEL, ratingLabel, type MoveAnalysis } from '../../training/analysis';
import { Board } from '../components/Board';
import { THEMES, themeById } from '../themes';
import type { Nav } from '../App';

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const KIND: Record<string, string> = { single: 'ניצחון רגיל', mars: 'מארס', turkish: 'מארס טורקי' };

type Modal = null | 'menu' | 'pause' | 'stop' | 'rename' | 'info' | 'mistakes' | { mistake: MoveAnalysis; turn: number };

export function GameScreen({ game, nav }: { game: Game; nav: Nav }) {
  const snap = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const s = useSettings();
  const theme = themeById(s.boardTheme), dieStyle = themeById(s.diceTheme).die;
  const [modal, setModal] = useState<Modal>(null);
  const [score, setScore] = useState({ w: 0, b: 0 });
  const [shake, setShake] = useState(0);
  const rec = snap.record;

  useEffect(() => {
    listGames().then(gs => {
      const f = gs.filter(g => g.status === 'finished' && g.level === rec.level);
      setScore({ w: f.filter(g => g.result?.winner === 'w').length, b: f.filter(g => g.result?.winner === 'b').length });
    }).catch(() => undefined);
  }, [rec.level, rec.status]);

  // Returning to this screen resumes a game that was left via the menu or pause overlay.
  useEffect(() => { game.resume(); }, [game]);

  const openModal = (m: Modal) => { if (m === 'menu' || m === 'pause') game.pause(); setModal(m); };
  const closeModal = () => { setModal(null); game.resume(); };

  const onDone = () => { if (!game.done()) setShake(n => n + 1); };
  const pipW = pipCount(snap.pos.w), pipB = pipCount(snap.pos.b);
  const myTurn = snap.turn === 'w' && (snap.phase === 'human' || snap.phase === 'rolling');
  const botTurn = snap.turn === 'b' && (snap.phase === 'bot' || snap.phase === 'rolling');
  const mistakes = rec.turns.filter(t => t.side === 'w' && t.analysis && t.analysis.severity !== 'none');

  return (
    <div className="screen game">
      <div className="board-wrap">
        <Board
          pos={snap.demo ? snap.demo.from : snap.pos} theme={theme} shape={s.checkerShape} dieStyle={dieStyle} homeSide={s.homeSide}
          dice={snap.dice} diceSide={snap.diceSide} rollFaces={snap.rollFaces} opening={snap.opening}
          selected={snap.selected} dests={snap.dests} movable={snap.movable} lastBot={snap.turn === 'w' ? snap.lastBot : []}
          ghosts={snap.demo} thinking={snap.thinking} onTap={p => game.tap(p)}
        />
        {snap.toast && <div key={snap.toast.n} className="toast">{snap.toast.text}</div>}
        {snap.phase === 'analyzing' && <div className="toast" style={{ animation: 'none', top: 28 }}>מנתח את המהלך…</div>}
      </div>

      <div className="panel">
        <div style={{ display: 'flex', gap: 5 }}>
          <button className="u ibtn" aria-label="תפריט" onClick={() => openModal('menu')}><IconMenu2 size={18} /></button>
          <button className="u ibtn" aria-label="השהה" onClick={() => openModal('pause')}><IconPlayerPause size={18} /></button>
          <button className="u ibtn" aria-label="עצור" onClick={() => setModal('stop')}><IconPlayerStop size={18} /></button>
        </div>
        <button className="u sname" style={{ textAlign: 'right' }} onClick={() => setModal('rename')} title="שינוי שם">{rec.name}</button>
        <div className={`card pcard ${botTurn ? 'act' : ''}`}>
          <div className="ph"><span className="dot" style={{ background: theme.bd.pA, border: `1px solid ${theme.bd.rimA}` }} />המחשב<span className="st">{snap.opening?.winner === 'b' ? 'מתחיל' : botTurn ? 'חושב…' : ''}</span></div>
          <div className="muted" style={{ fontSize: 11 }}>{LEVEL_NAMES[rec.level]}</div>
          <div className="pp"><b>{pipB}</b>פיפים</div>
        </div>
        <div className="card score">
          <div><small>אתה</small><b>{score.w}</b></div><div className="sep" /><div><small>המחשב</small><b>{score.b}</b></div>
        </div>
        <div className={`card pcard ${myTurn ? 'act' : ''}`}>
          <div className="ph"><span className="dot" style={{ background: theme.bd.pB, border: `1px solid ${theme.bd.rimB}` }} />אתה<span className="st">{snap.opening?.winner === 'w' ? 'מתחיל' : myTurn ? 'תורך' : ''}</span></div>
          <div className="pp"><b>{pipW}</b>פיפים <span style={{ fontSize: 11, color: pipB - pipW >= 0 ? 'var(--muted)' : 'var(--muted)' }}>({pipB - pipW >= 0 ? '+' : ''}{pipB - pipW})</span></div>
        </div>
        <button className="u" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, padding: '0 2px' }} onClick={() => game.setTraining(!rec.training)}>
          <span>מצב אימון</span><span className={`toggle ${rec.training ? 'on' : ''}`}><span /></span>
        </button>
        <div style={{ flex: 1 }} />
        {snap.phase === 'demo' && snap.demo && snap.review ? <DemoBar snap={snap} game={game} /> : <>
        <button className="u muted" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, opacity: snap.canUndo ? 1 : .45 }} onClick={() => game.undo()}>
          <IconArrowBackUp size={15} />בטל מהלך
        </button>
        <button key={shake} className={`u done-btn ${snap.canDone ? '' : 'dim'} ${shake ? 'shake' : ''}`} onClick={onDone}>
          <IconCheck size={18} />סיימתי
        </button>
        </>}
      </div>

      {snap.phase === 'review' && snap.review && <ReviewPopup a={snap.review} onDemo={() => game.showDemo('best')} onContinue={() => game.continueReview()} />}
      {snap.phase === 'over' && rec.result && <GameOver snap={snap} nav={nav} />}

      {modal === 'menu' && <Menu game={game} snap={snap} mistakes={mistakes.length} close={closeModal} nav={nav} open={setModal} />}
      {modal === 'pause' && (
        <div className="overlay">
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <IconPlayerPause size={42} />
            <div style={{ fontSize: 21, margin: '6px 0 14px' }}>המשחק מושהה</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="u btn primary" onClick={closeModal}><IconPlayerPlay size={17} />המשך משחק</button>
              <button className="u btn" onClick={() => { game.leave(); nav.go({ name: 'home' }); }}><IconHome size={17} />למסך הבית</button>
            </div>
          </div>
        </div>
      )}
      {modal === 'stop' && (
        <div className="overlay">
          <div className="dialog" style={{ width: 390 }}>
            <h2>לעצור את המשחק?</h2>
            <div className="muted" style={{ fontSize: 14, marginBottom: 12 }}>המשחק יישמר בהיסטוריה בסטטוס "הופסק" ולא ייספר בסטטיסטיקה.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="u btn danger" onClick={() => { game.stop(); nav.go({ name: 'home', msg: 'המשחק נשמר בהיסטוריה בסטטוס "הופסק"' }); }}>עצור</button>
              <button className="u btn" onClick={() => setModal(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
      {modal === 'rename' && <Rename initial={rec.name} onSave={n => { game.rename(n); closeModal(); }} onClose={closeModal} />}
      {modal === 'info' && (
        <Dialog title="פרטי המשחק" onClose={closeModal}>
          <InfoRow k="שם" v={rec.name} />
          <InfoRow k="רמת המחשב" v={LEVEL_NAMES[rec.level]} />
          <InfoRow k="מצב אימון" v={rec.training ? 'פעיל' : 'כבוי'} />
          <InfoRow k="התחלה" v={new Date(rec.createdAt).toLocaleString('he-IL')} />
          <InfoRow k="פתח" v={rec.starter === 'w' ? 'אתה' : rec.starter === 'b' ? 'המחשב' : '—'} />
          <InfoRow k="מהלכים" v={String(rec.turns.length)} />
          <InfoRow k="טעויות" v={`${mistakes.filter(t => t.analysis!.severity === 'inaccuracy').length} אי-דיוק · ${mistakes.filter(t => t.analysis!.severity === 'mistake').length} טעות · ${mistakes.filter(t => t.analysis!.severity === 'blunder').length} חמורה`} />
        </Dialog>
      )}
      {modal === 'mistakes' && (
        <Dialog title="הטעויות שלי במשחק" onClose={closeModal} width={520}>
          {!mistakes.length && <div className="muted" style={{ fontSize: 14 }}>עדיין אין טעויות במשחק הזה.</div>}
          {mistakes.map(t => {
            const a = t.analysis!, idx = rec.turns.indexOf(t) + 1;
            return (
              <button key={idx} className="u row" style={{ width: '100%', textAlign: 'right' }} onClick={() => setModal({ mistake: a, turn: idx })}>
                <span className={`sev sev-${a.severity}`} style={{ fontSize: 12 }}>{SEVERITY_LABEL[a.severity]}</span>
                <span style={{ fontSize: 13 }}>תור {idx} · {a.dice.join('-')}</span>
                <span dir="ltr" style={{ fontSize: 13, marginInlineStart: 'auto' }}>{a.played.notation} → {a.best.notation}</span>
              </button>
            );
          })}
        </Dialog>
      )}
      {modal && typeof modal === 'object' && (
        <ReviewPopup a={modal.mistake} onContinue={() => setModal('mistakes')} continueLabel="חזרה לרשימה" />
      )}
    </div>
  );
}

function ReviewPopup({ a, onDemo, onContinue, continueLabel = 'המשך' }: { a: MoveAnalysis; onDemo?: () => void; onContinue: () => void; continueLabel?: string }) {
  const lvl = SEVERITY_LEVEL[a.severity];
  const color = a.severity === 'blunder' ? '#ff7a6b' : a.severity === 'mistake' ? '#ffb648' : '#ffd34e';
  return (
    <div className="overlay">
      <div className="dialog" style={{ width: 530, background: '#14211c', color: '#eef3f0', borderColor: 'rgba(255,255,255,.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className={`sev sev-${a.severity}`}>{SEVERITY_LABEL[a.severity]}</span>
          <span className="meter">{[1, 2, 3].map(i => <i key={i} style={i <= lvl ? { background: color } : undefined} />)}</span>
          <span style={{ fontSize: 12, color: '#9fb5ab' }}>רמה {lvl} מתוך 3</span>
          <span style={{ marginInlineStart: 'auto', fontSize: 13, color: '#ff9a8a' }}>הפסד אקוויטי: {a.loss.toFixed(3)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <MoveBox title="המהלך שלך" color="#ff9a9a" bg="#2a1a17" n={a.played.notation} p={a.played.probs} />
          <MoveBox title={`המהלך הטוב ביותר · ${a.bestType}`} color="#8fd6a0" bg="#16291f" n={a.best.notation} p={a.best.probs} />
        </div>
        <ul style={{ margin: '0 0 10px', paddingInlineStart: 18, fontSize: 14, lineHeight: 1.5 }}>
          {a.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onDemo && <button className="u btn primary" style={{ background: '#2f9e6e', borderColor: '#2f9e6e', color: '#fff' }} onClick={onDemo}><IconPlayerPlay size={16} />הדגם על הלוח</button>}
          <button className="u btn" style={{ background: '#22332c', color: '#eef3f0', borderColor: 'transparent' }} onClick={onContinue}>{continueLabel}</button>
          <span style={{ fontSize: 12, color: '#9fb5ab', marginInlineStart: 'auto' }}>המהלך שלך נשאר על הלוח</span>
        </div>
      </div>
    </div>
  );
}

function MoveBox({ title, color, bg, n, p }: { title: string; color: string; bg: string; n: string; p: number[] }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '6px 10px' }}>
      <div style={{ fontSize: 12, color }}>{title}</div>
      <div dir="ltr" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right' }}>{n || '—'}</div>
      <div style={{ fontSize: 12, color: '#9fb5ab' }}>ניצחון {pct(p[0])} · מארס {pct(p[1])}</div>
    </div>
  );
}

function DemoBar({ snap, game }: { snap: Snapshot; game: Game }) {
  const mine = snap.demo!.which === 'mine';
  return (
    <div className="card" style={{ padding: '6px 7px', display: 'flex', flexDirection: 'column', gap: 5, borderColor: 'var(--hl)' }}>
      <div style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <span className="muted">{mine ? 'שלך: ' : 'מומלץ: '}</span>
        <b dir="ltr">{mine ? snap.review!.played.notation : snap.review!.best.notation}</b>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="u btn small" style={{ flex: 1, padding: '4px 0', fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => game.showDemo(snap.demo!.which)}>הצג שוב</button>
        <button className="u btn small" style={{ flex: 1, padding: '4px 0', fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => game.showDemo(mine ? 'best' : 'mine')}>{mine ? 'המומלץ' : 'שלי'}</button>
      </div>
      <button className="u done-btn" style={{ height: 36 }} onClick={() => game.continueReview()}><IconCheck size={18} />הבנתי</button>
    </div>
  );
}

function GameOver({ snap, nav }: { snap: Snapshot; nav: Nav }) {
  const r = snap.record.result!, won = r.winner === 'w', rating = snap.record.rating;
  return (
    <div className="overlay">
      <div className="dialog" style={{ width: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{won ? 'ניצחת!' : 'המחשב ניצח'}</div>
        <div className="muted" style={{ fontSize: 15, margin: '4px 0 10px' }}>{KIND[r.kind]} · {r.points} {r.points === 1 ? 'נקודה' : 'נקודות'}</div>
        <div style={{ fontSize: 14, marginBottom: 14 }}>
          {rating === undefined ? 'מחשב דירוג ביצועים…' : rating === null ? 'אין מספיק מהלכים לדירוג' : <>דירוג ביצועים: <b>{rating.toFixed(1)}</b> ({ratingLabel(rating)})</>}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="u btn primary" onClick={nav.newGame}>משחק חדש</button>
          <button className="u btn" onClick={() => nav.go({ name: 'replay', id: snap.record.id })}>צפייה חוזרת</button>
          <button className="u btn" onClick={() => nav.go({ name: 'home' })}>מסך הבית</button>
        </div>
      </div>
    </div>
  );
}

function Menu({ game, snap, mistakes, close, nav, open }: { game: Game; snap: Snapshot; mistakes: number; close: () => void; nav: Nav; open: (m: Modal) => void }) {
  const s = useSettings();
  const mi = (icon: ReactNode, label: string, onClick: () => void, note?: string, badge?: number) => (
    <button className="u mi" onClick={onClick}>
      <span className="ico">{icon}</span>
      <span className="mt">{label}{note && <small>{note}</small>}</span>
      {badge != null && <span className="badge">{badge}</span>}
    </button>
  );
  const leaveTo = (r: Parameters<Nav['go']>[0]) => { game.leave(); nav.go(r); };
  return (
    <div className="overlay" style={{ justifyContent: 'flex-end', alignItems: 'stretch' }} onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="sheet">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>תפריט</span>
          <button className="u muted" style={{ marginInlineStart: 'auto' }} aria-label="סגור" onClick={close}><IconX size={20} /></button>
        </div>
        <div className="mgrid">
          <div>
            <div className="msec">המשחק הנוכחי</div>
            {mi(<IconPlus size={18} />, 'משחק חדש', () => { close(); nav.newGame(); }, 'הנוכחי יישמר כמושהה')}
            {mi(<IconPencil size={18} />, 'שינוי שם המשחק', () => open('rename'))}
            {mi(<IconInfoCircle size={18} />, 'פרטי המשחק', () => open('info'), 'רמה, שעת התחלה, מהלכים')}
            {mi(<IconAlertTriangle size={18} />, 'הטעויות שלי במשחק', () => open('mistakes'), 'צפייה בכל הטעויות עד כה', mistakes)}
            <div className="msec">ניווט</div>
            {mi(<IconHome size={18} />, 'מסך הבית', () => leaveTo({ name: 'home' }), 'המשחק יישמר כמושהה')}
            {mi(<IconHistory size={18} />, 'היסטוריית משחקים', () => leaveTo({ name: 'history' }))}
            {mi(<IconChartLine size={18} />, 'סטטיסטיקה', () => leaveTo({ name: 'stats' }))}
          </div>
          <div>
            <div className="msec">תצוגה מהירה</div>
            <div className="mi" style={{ cursor: 'default' }}><span className="ico"><IconPalette size={18} /></span><span className="mt">ערכת עיצוב</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 38px 6px 0' }}>
              {THEMES.map(t => (
                <button key={t.id} className="u" aria-label={t.he} title={t.he} onClick={() => setSettings({ boardTheme: t.id, diceTheme: t.id, checkerShape: t.shape })}
                  style={{ width: 26, height: 26, borderRadius: 7, border: `2px solid ${t.id === s.boardTheme ? 'var(--hl)' : 'transparent'}`, background: `linear-gradient(135deg, ${t.bd.pA} 50%, ${t.bd.pB} 50%)`, boxShadow: '0 0 0 1px rgba(127,127,127,.4)' }} />
              ))}
            </div>
            <div className="mi" style={{ cursor: 'default' }}><span className="ico"><IconVolume size={18} /></span><span className="mt">צלילים</span></div>
            <div style={{ padding: '0 38px 6px 0' }}>
              <div className="seg"><button className={s.sound ? 'on' : ''} onClick={() => setSettings({ sound: true })}>פועל</button><button className={s.sound ? '' : 'on'} onClick={() => setSettings({ sound: false })}>כבוי</button></div>
            </div>
            <div className="mi" style={{ cursor: 'default' }}><span className="ico"><IconGauge size={18} /></span><span className="mt">מהירות המחשב</span></div>
            <div style={{ padding: '0 38px 6px 0' }}>
              <div className="seg">{(['slow', 'normal', 'fast'] as Speed[]).map(v => <button key={v} className={s.speed === v ? 'on' : ''} onClick={() => setSettings({ speed: v })}>{{ slow: 'איטי', normal: 'רגיל', fast: 'מהיר' }[v]}</button>)}</div>
            </div>
            <div className="msec">עוד</div>
            {mi(<IconSettings size={18} />, 'הגדרות', () => leaveTo({ name: 'settings' }), 'כיוון לוח, ספי טעויות, גיבוי')}
            {mi(<IconHelpCircle size={18} />, 'חוקי המשחק ועזרה', () => leaveTo({ name: 'help' }))}
          </div>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{snap.paused ? 'המשחק מושהה בזמן שהתפריט פתוח' : ''}</div>
      </div>
    </div>
  );
}

function Rename({ initial, onSave, onClose }: { initial: string; onSave: (n: string) => void; onClose: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="overlay">
      <div className="dialog" style={{ width: 420 }}>
        <h2>שינוי שם המשחק</h2>
        <input className="field" autoFocus value={v} maxLength={60} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onSave(v); }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="u btn primary" onClick={() => onSave(v)}>שמור</button>
          <button className="u btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function Dialog({ title, children, onClose, width = 420 }: { title: string; children: ReactNode; onClose: () => void; width?: number }) {
  return (
    <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" style={{ width }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2>{title}</h2>
          <button className="u muted" style={{ marginInlineStart: 'auto' }} aria-label="סגור" onClick={onClose}><IconX size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return <div style={{ display: 'flex', fontSize: 14, padding: '4px 0', borderBottom: '1px solid var(--cardB)' }}><span className="muted" style={{ width: 110 }}>{k}</span><span>{v}</span></div>;
}
