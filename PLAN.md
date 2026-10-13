# שש־בש – Backgammon trainer: implementation plan (v2)

Status: awaiting approval · Updated 2026-10-13

## 1. Product
A Hebrew (RTL) iPhone web app (PWA) for one player against the computer, built to train you. It is played in landscape, installed from Safari to the Home Screen, and works offline. No App Store and no Xcode.

## 2. Opponent and rules
- **Engine:** GNU Backgammon (gnubg) neural-net engine compiled to WebAssembly, running in a background thread on the phone.
- **Levels:** מתחיל (beginner), בינוני (intermediate), מתקדם (advanced), מומחה (expert), אלוף העולם (world-class, the default). Analysis always runs at full strength.
- **Format:** single games, no doubling cube. Scoring: win = 1, Mars (מארס) = 2, Turkish mars (מארס טורקי) = 3. The bot plays to these values.
- **Opening roll:** each side rolls one die and the higher one starts. A tie means both roll again ("תיקו – מטילים שוב"). The starter then rolls both dice again for the first move (house rule, chosen over the standard rule). That roll can be doubles.
- **Full rules:** bar entry, hitting, bearing off, the must-use-both-dice and larger-die rules, doubles played four times. Dice use a fair cryptographic random generator.

## 3. Screens
| Screen | Contents |
|---|---|
| Home (בית) | Title "שש־בש", subtitle "מאמן אישי מול המחשב", board picture, משחק חדש (New game, primary button), המשך משחק (Resume game, shown when one is paused), buttons for היסטוריה (History) / סטטיסטיקה (Statistics) / הגדרות (Settings), status lines (today's activity, bot level, last result and rating) |
| New game | Optional name, bot level (5 options), training mode on/off, התחל משחק (Start game) |
| Game | Left panel: menu / pause / stop icons, editable session name, bot card (level, pips), score box, your card (pips, "תורך" = your turn), training switch, בטל מהלך (Undo), סיימתי (Done). Center: board. Right: bear-off tray |
| Menu (תפריט) | Two-column panel. **Current game:** new game (current one saved as paused), rename, game details, my mistakes in this game (with count). **Navigation:** home (game saved as paused), history, statistics. **Quick display:** theme, sound on/off, bot speed slow/normal/fast. **More:** settings, rules and help |
| History | All games with name, date, result (win/Mars/Turkish mars, loss, stopped, paused) and rating. Search by name, filter by result/status/training, sort by date or rating, swipe to delete with confirmation |
| Replay | Step back and forward move by move, autoplay, position slider |
| Statistics | Performance rating per game and over time, mistakes by severity, luck rating, win rate per level |
| Settings | Theme (board, checkers, dice separately), board direction (home right/left), mistake thresholds, sound, bot speed, export/import backup |

## 4. Playing a move
- Tap a checker: its legal landing points light up, each labeled with the die it uses ("3", "6", "6+3"). Tap a highlighted point to drop it there.
- Undo works freely until you press סיימתי. Done shakes if dice are left that you could still play.
- The bot's last move is marked on the board with dashed rings.
- Pip counts for both players are always visible.
- **Pause:** an overlay with המשך משחק (Resume) or למסך הבית (Home). A paused game survives closing the app.
- **Stop:** asks to confirm, then saves the game as "הופסק" (stopped). Stopped games stay in history and can be replayed, but don't count in statistics.

## 5. Training mode
- Every move is analyzed in the background, even when training is off, to feed the statistics.
- When training is **on** and a move crosses a threshold, a popup appears after סיימתי. **No popup after good moves.**
- **Severity levels** (equity lost, adjustable in settings): 🟡 אי-דיוק (inaccuracy) ≥ 0.03 · 🟠 טעות (mistake) ≥ 0.06 · 🔴 טעות חמורה (blunder) ≥ 0.12.
- **Popup contents:** severity badge with a 3-segment meter, equity loss, your move vs the best move with win% and Mars%, and 2–3 Hebrew explanation bullets.
- **הדגם על הלוח** (Show on the board): ghost checkers with arrows replay the best move. Buttons: הצג שוב (Show again), שלי / המומלץ (Mine / Recommended) to compare, הבנתי (Got it). Your move stays on the board.
- **Explanations** are generated offline from rules. They cover:
  - shot risk: hits out of 36 rolls, direct and indirect
  - points and primes made, anchors, stacking, checkers left back
  - the race: pip lead, rules of thumb
  - Mars risk
  - the strategy choice: hit / build / run / hold / safe
  - an equity breakdown

## 6. Statistics
- **Performance rating:** average equity lost per move ×1000 (gnubg's error rate), with skill labels.
- **Charts:** trend over time and mistakes by severity.
- **Luck rating:** how much the dice helped or hurt you in each game.

## 7. Themes
Brand colors are **#0F4C3A and white**. In every theme the checkers use the same colors as the points. All 8 themes ship, and board, checkers and dice can be mixed in Settings. Default: **1 – אמרלד קלאסי** (Emerald classic).

| # | Theme | Colors | Shapes | Image |
|---|---|---|---|---|
| 1 | אמרלד קלאסי (Emerald classic, **default**) | #0F4C3A + white on a light mist surface | Classic triangles · flat checkers with a ring · white dice | [01](mockups/themes/01-emerald-classic.png) |
| 2 | לילה ירוק (Emerald night) | Jade + white on dark green | Rounded-tip triangles · domed checkers · green dice | [02](mockups/themes/02-emerald-night.png) |
| 3 | נייר לבן (Paper white) | White screen, green lines | Slim triangles · outlined checkers · square pips | [03](mockups/themes/03-paper-white.png) |
| 4 | ירוק, שנהב וזהב (Green, ivory and gold) | Gold + ivory on green felt | Classic triangles · engraved checkers · gold frame line | [04](mockups/themes/04-green-ivory-gold.png) |
| 5 | גיאומטרי מודרני (Modern geometric) | Green + white on sage, no frame | Rounded columns · hexagon checkers · round dice | [05](mockups/themes/05-geometric.png) |
| 6 | אסימוני קזינו (Casino chips) | Green + white on sage | Classic triangles · poker-chip checkers | [06](mockups/themes/06-casino-chips.png) |
| 7 | טרקוטה וחול (Terracotta and sand) | Terracotta + white on sand | Rounded triangles · flat checkers | [07](mockups/themes/07-terracotta-sand.png) |
| 8 | כחול ולבן (Navy and white) | Navy + white on light blue | Slim triangles · domed checkers | [08](mockups/themes/08-navy-white.png) |

Overview: [mockups/themes/00-overview.png](mockups/themes/00-overview.png). Interactive layout mockup: [mockups/index.html](mockups/index.html). Its colors predate the theme choice and will be replaced by the themes above.

## 8. Data
- Everything is stored on the phone (IndexedDB): every position, roll, move and analysis result for each game. Nothing is sent anywhere.
- Manual export/import of a backup file through iCloud Drive / Files.

## 9. Tech
- TypeScript, React and Vite. The board is drawn in SVG, and each theme is a set of design tokens plus shape choices for points, checkers and dice.
- gnubg in WebAssembly, run in a Web Worker. A service worker makes the app work offline.
- Unit tests (Vitest) for the rules engine, scoring and explanation rules. End-to-end tests (Playwright) on an iPhone-landscape-sized screen.
- License: GPL (gnubg), so the repo is public.
- Risk: full-strength analysis may take 0.3–1.5 s per move on the phone. It falls back to a lighter search on slower devices.

## 10. Installing on the iPhone
1. You need a personal GitHub account. I'll set up the repo and an automatic GitHub Pages deploy, **but only after your go-ahead**, because that publishes the code.
2. On the iPhone, open `https://<username>.github.io/shesh-besh/` in Safari, then tap **Share** and **Add to Home Screen**.
3. Open it from the new icon. It works offline and updates itself the next time it's opened online.
4. Export a backup now and then. Deleting the app or clearing Safari's website data erases the history.

## 11. Build order
1. Rules engine and tests, board rendering with the theme system, tap-to-move, pip count, RTL layout.
2. gnubg in WebAssembly: bot at all levels, opening roll, Mars scoring.
3. Saving games: home screen, new game, pause/resume/stop, naming, history.
4. Training mode: analysis, severity popup, Hebrew explanations, ghost demonstration.
5. Replay and statistics.
6. All 8 themes, settings, menu, sounds, animations, export/import.
7. Offline/install setup, GitHub Pages deploy, README; final check on an iPhone-sized screen.

## 12. Open items (defaults used unless you say otherwise)
| Question | Default |
|---|---|
| What the score box counts | Your all-time record vs the bot at the current level |
| Dice rolling | Your dice roll automatically when your turn starts |
| Opening the menu during the bot's turn | Pauses the bot |
| Changing the bot level mid-game | Not allowed (keeps stats clean) |
