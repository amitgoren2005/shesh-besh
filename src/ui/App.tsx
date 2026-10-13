import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { IconDeviceMobileRotated } from '@tabler/icons-react';
import { Game } from '../game/controller';
import type { Level } from '../engine/types';
import { engine } from '../engine/client';
import { getGame } from '../store/db';
import { setSettings, useSettings } from '../store/settings';
import type { GameRecord } from '../store/types';
import { themeById } from './themes';
import { sound } from './sound';
import { Home } from './screens/Home';
import { GameScreen } from './screens/GameScreen';
import { History } from './screens/History';
import { Replay } from './screens/Replay';
import { Stats } from './screens/Stats';
import { SettingsScreen } from './screens/Settings';
import { Help } from './screens/Help';
import { NewGameDialog } from './screens/NewGameDialog';

export type Route =
  | { name: 'home'; msg?: string }
  | { name: 'game' }
  | { name: 'history' }
  | { name: 'replay'; id: string }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'help' };

export interface Nav {
  go: (r: Route) => void;
  newGame: () => void;
  resume: (rec: GameRecord) => void;
  back: () => void;
}

function Stage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const el = ref.current; if (!el) return;
      const w = window.innerWidth, h = window.innerHeight;
      const s = Math.min(w / 852, h / 393);
      el.style.transform = `translate(${(w - 852 * s) / 2}px, ${(h - 393 * s) / 2}px) scale(${s})`;
    };
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);
  return <div className="stage-outer"><div className="stage" ref={ref} dir="rtl">{children}</div></div>;
}

export function App() {
  const settings = useSettings();
  const theme = themeById(settings.boardTheme);
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [game, setGame] = useState<Game | null>(null);
  const [showNew, setShowNew] = useState(false);
  const prev = useRef<Route>({ name: 'home' });

  useEffect(() => {
    const r = document.documentElement.style, a = theme.app;
    r.setProperty('--bg', a.bg); r.setProperty('--card', a.card); r.setProperty('--cardB', a.cardB);
    r.setProperty('--text', a.text); r.setProperty('--muted', a.muted); r.setProperty('--acc', a.acc);
    r.setProperty('--accT', a.accT); r.setProperty('--act', a.act); r.setProperty('--hl', theme.hl);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', a.bg);
  }, [theme]);

  useEffect(() => { void engine().info; }, []);
  // Test hook for the end-to-end tests (only when the URL contains ?e2e).
  useEffect(() => {
    if (location.search.includes('e2e')) (window as unknown as { __sb: object }).__sb = { game, setSettings };
  }, [game]);
  useEffect(() => {
    const unlock = () => sound.unlock();
    addEventListener('pointerdown', unlock, { once: true });
    return () => removeEventListener('pointerdown', unlock);
  }, []);

  const go = useCallback((r: Route) => {
    setRoute(cur => { prev.current = cur; return r; });
  }, []);

  const startGame = (g: Game) => {
    game?.dispose();
    setGame(g);
    g.start();
    go({ name: 'game' });
  };

  const nav: Nav = {
    go,
    back: () => go(prev.current.name === route.name ? { name: 'home' } : prev.current),
    newGame: () => setShowNew(true),
    resume: async (rec) => {
      const fresh = (await getGame(rec.id)) ?? rec;
      if (game && game.id === rec.id) { game.resume(); go({ name: 'game' }); return; }
      startGame(Game.resume(fresh));
    },
  };

  const create = (name: string, level: Level, training: boolean) => {
    setShowNew(false);
    setSettings({ lastLevel: level, lastTraining: training });
    startGame(Game.create(name, level, training));
  };

  let screen: ReactNode;
  switch (route.name) {
    case 'game': screen = game ? <GameScreen key={game.id} game={game} nav={nav} /> : <Home nav={nav} />; break;
    case 'history': screen = <History nav={nav} />; break;
    case 'replay': screen = <Replay id={route.id} nav={nav} />; break;
    case 'stats': screen = <Stats nav={nav} />; break;
    case 'settings': screen = <SettingsScreen nav={nav} />; break;
    case 'help': screen = <Help nav={nav} />; break;
    default: screen = <Home nav={nav} msg={route.msg} />;
  }

  return (
    <>
      <Stage>
        {screen}
        {showNew && <NewGameDialog onStart={create} onClose={() => setShowNew(false)} />}
      </Stage>
      <div className="rotate-hint" dir="rtl">
        <IconDeviceMobileRotated size={56} />
        <div>סובב את הטלפון לרוחב כדי לשחק</div>
      </div>
    </>
  );
}
