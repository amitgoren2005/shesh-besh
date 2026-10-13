import { useState } from 'react';
import { LEVEL_NAMES, type Level } from '../../engine/types';
import { useSettings } from '../../store/settings';
import { defaultGameName } from '../../game/controller';

export function NewGameDialog({ onStart, onClose }: { onStart: (name: string, level: Level, training: boolean) => void; onClose: () => void }) {
  const s = useSettings();
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>(s.lastLevel);
  const [training, setTraining] = useState(s.lastTraining);
  return (
    <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" style={{ width: 480 }}>
        <h2>משחק חדש</h2>
        <div className="lbl">שם המשחק (לא חובה)</div>
        <input className="field" value={name} maxLength={60} placeholder={defaultGameName()} onChange={e => setName(e.target.value)} />
        <div className="lbl">רמת המחשב</div>
        <div className="seg" style={{ display: 'flex' }}>
          {([0, 1, 2, 3, 4] as Level[]).map(l => (
            <button key={l} className={l === level ? 'on' : ''} style={{ flex: 1, textAlign: 'center' }} onClick={() => setLevel(l)}>{LEVEL_NAMES[l]}</button>
          ))}
        </div>
        <button className="u" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', margin: '14px 0 16px', fontSize: 14 }} onClick={() => setTraining(!training)}>
          <span>מצב אימון <span className="muted" style={{ fontSize: 12 }}>– הסבר על כל טעות</span></span>
          <span className={`toggle ${training ? 'on' : ''}`}><span /></span>
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="u btn primary" style={{ flex: 1 }} onClick={() => onStart(name.trim(), level, training)}>התחל משחק</button>
          <button className="u btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
