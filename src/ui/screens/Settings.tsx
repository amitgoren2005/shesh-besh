import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { IconArrowRight, IconDownload, IconUpload } from '@tabler/icons-react';
import { engine } from '../../engine/client';
import type { EngineInfo } from '../../engine/types';
import { exportBackup, importBackup } from '../../store/db';
import { DEFAULT_SETTINGS, getSettings, setSettings, useSettings, type Settings, type Speed } from '../../store/settings';
import { DEFAULT_THRESHOLDS } from '../../training/analysis';
import { Checker, CheckerDefs, Die } from '../components/Board';
import { CHECKER_SHAPES, THEMES, themeById } from '../themes';
import type { Nav } from '../App';

export function SettingsScreen({ nav }: { nav: Nav }) {
  const s = useSettings();
  const theme = themeById(s.boardTheme);
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { engine().info.then(setInfo).catch(() => undefined); }, []);

  const doExport = async () => {
    const data = await exportBackup(getSettings());
    const name = `shesh-besh-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'גיבוי שש־בש' }); setMsg('הגיבוי מוכן'); return; } catch { /* user cancelled share */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setMsg(`נשמר קובץ ${name}`);
  };
  const doImport = async (f: File) => {
    try {
      const r = await importBackup(JSON.parse(await f.text()));
      if (r.settings && typeof r.settings === 'object') setSettings({ ...DEFAULT_SETTINGS, ...(r.settings as Partial<Settings>) });
      setMsg(`יובאו ${r.games} משחקים`);
    } catch { setMsg('הקובץ לא תקין – בחר קובץ גיבוי של שש־בש'); }
  };

  const th = s.thresholds;
  const setTh = (k: keyof typeof th, v: number) => setSettings({ thresholds: { ...th, [k]: v } });

  return (
    <div className="screen page">
      <div className="topbar">
        <button className="u ibtn" aria-label="חזרה" onClick={nav.back}><IconArrowRight size={18} /></button>
        <h1>הגדרות</h1>
        {msg && <span style={{ fontSize: 13, color: 'var(--hl)', marginInlineStart: 'auto' }}>{msg}</span>}
      </div>
      <div className="scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 10 }}>
        <Section title="ערכת עיצוב">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {THEMES.map(t => (
              <button key={t.id} className="u card" onClick={() => setSettings({ boardTheme: t.id, diceTheme: t.id, checkerShape: t.shape })}
                style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8, borderColor: t.id === s.boardTheme ? 'var(--hl)' : undefined, borderWidth: t.id === s.boardTheme ? 2 : 1 }}>
                <svg width={46} height={34} viewBox="0 0 46 34">
                  <CheckerDefs T={t} />
                  <rect width={46} height={34} rx={6} fill={t.bd.noFrame ? t.bd.bed : t.bd.frame} />
                  <rect x={4} y={4} width={38} height={26} rx={3} fill={t.bd.bed} />
                  <polygon points="6,4 14,4 10,20" fill={t.bd.pA} /><polygon points="16,4 24,4 20,20" fill={t.bd.pB} />
                  <Checker T={t} shape={t.shape} x={31} y={21} dark r={7} /><Checker T={t} shape={t.shape} x={36} y={11} dark={false} r={6} />
                </svg>
                <span style={{ fontSize: 13, textAlign: 'right' }}>{t.he}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="צורת החיילים">
          <div style={{ display: 'flex', gap: 8 }}>
            {CHECKER_SHAPES.map(c => (
              <button key={c.id} className="u card" onClick={() => setSettings({ checkerShape: c.id })}
                style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, borderColor: c.id === s.checkerShape ? 'var(--hl)' : undefined, borderWidth: c.id === s.checkerShape ? 2 : 1 }}>
                <svg width={56} height={28} viewBox="0 0 56 28" style={{ background: theme.bd.bed, borderRadius: 6 }}>
                  <CheckerDefs T={theme} />
                  <Checker T={theme} shape={c.id} x={16} y={14} dark r={11} /><Checker T={theme} shape={c.id} x={40} y={14} dark={false} r={11} />
                </svg>
                <span style={{ fontSize: 12 }}>{c.he}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="קוביות">
          <div style={{ display: 'flex', gap: 8 }}>
            {THEMES.map(t => (
              <button key={t.id} className="u card" title={t.he} onClick={() => setSettings({ diceTheme: t.id })}
                style={{ padding: 6, borderColor: t.id === s.diceTheme ? 'var(--hl)' : undefined, borderWidth: t.id === s.diceTheme ? 2 : 1 }}>
                <svg width={54} height={26} viewBox="0 0 54 26" style={{ background: theme.bd.bed, borderRadius: 6 }}>
                  <Die s={t.die} x={3} y={2} v={5} sz={22} /><Die s={t.die} x={29} y={2} v={2} sz={22} />
                </svg>
              </button>
            ))}
          </div>
        </Section>
        <Section title="משחק">
          <Line label="הבית שלך">
            <div className="seg"><button className={s.homeSide === 'right' ? 'on' : ''} onClick={() => setSettings({ homeSide: 'right' })}>מימין למטה</button><button className={s.homeSide === 'left' ? 'on' : ''} onClick={() => setSettings({ homeSide: 'left' })}>משמאל למטה</button></div>
          </Line>
          <Line label="מהירות המחשב">
            <div className="seg">{(['slow', 'normal', 'fast'] as Speed[]).map(v => <button key={v} className={s.speed === v ? 'on' : ''} onClick={() => setSettings({ speed: v })}>{{ slow: 'איטי', normal: 'רגיל', fast: 'מהיר' }[v]}</button>)}</div>
          </Line>
          <Line label="צלילים">
            <div className="seg"><button className={s.sound ? 'on' : ''} onClick={() => setSettings({ sound: true })}>פועל</button><button className={s.sound ? '' : 'on'} onClick={() => setSettings({ sound: false })}>כבוי</button></div>
          </Line>
        </Section>
        <Section title="ספי טעויות במצב אימון (הפסד אקוויטי לעומת המהלך הטוב ביותר)">
          <Slider label="אי-דיוק" color="#ffd34e" v={th.inaccuracy} min={0.01} max={th.mistake - 0.005} on={v => setTh('inaccuracy', v)} />
          <Slider label="טעות" color="#ffb648" v={th.mistake} min={th.inaccuracy + 0.005} max={th.blunder - 0.005} on={v => setTh('mistake', v)} />
          <Slider label="טעות חמורה" color="#ff7a6b" v={th.blunder} min={th.mistake + 0.005} max={0.4} on={v => setTh('blunder', v)} />
          <button className="u btn small" style={{ marginTop: 4 }} onClick={() => setSettings({ thresholds: DEFAULT_THRESHOLDS })}>איפוס לברירת המחדל (0.03 / 0.06 / 0.12)</button>
        </Section>
        <Section title="גיבוי">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="u btn" onClick={doExport}><IconUpload size={16} />ייצוא גיבוי</button>
            <button className="u btn" onClick={() => fileRef.current?.click()}><IconDownload size={16} />ייבוא גיבוי</button>
            <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }} />
            <span className="muted" style={{ fontSize: 12 }}>שמור את הקובץ ב-iCloud Drive. מחיקת האפליקציה מוחקת את ההיסטוריה.</span>
          </div>
        </Section>
        <div className="muted" style={{ fontSize: 11.5 }}>
          מנוע: {info ? (info.kind === 'gnubg' ? 'GNU Backgammon (WebAssembly)' : 'מנוע גיבוי פשוט – המנוע הראשי לא נטען') : 'טוען…'} · גרסה {__APP_VERSION__} · קוד פתוח ברישיון GPL-3.0
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="card" style={{ padding: '8px 12px' }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{title}</div>{children}</div>;
}
function Line({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '3px 0' }}><span style={{ width: 110, fontSize: 13.5 }}>{label}</span>{children}</div>;
}
function Slider({ label, color, v, min, max, on }: { label: string; color: string; v: number; min: number; max: number; on: (v: number) => void }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
    <span style={{ width: 90, fontSize: 13 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color, marginInlineEnd: 6 }} />{label}</span>
    <input type="range" min={min} max={max} step={0.005} value={v} onChange={e => on(Math.round(+e.target.value * 1000) / 1000)} style={{ flex: 1, accentColor: 'var(--acc)' }} />
    <span dir="ltr" style={{ width: 44, fontSize: 13 }}>{v.toFixed(3)}</span>
  </div>;
}
