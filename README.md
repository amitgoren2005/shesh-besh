# שש־בש – a personal backgammon trainer for iPhone

A Hebrew (RTL) backgammon app for one player against the computer, built to make you a better player:

- **Opponent:** GNU Backgammon's neural-net engine, compiled to WebAssembly and running on the phone. Five levels, from מתחיל (beginner) to אלוף העולם (world class, 2-ply).
- **Training mode:** every move is graded against the engine's best move. Mistakes get a popup with a 3-level severity, the equity lost, win/Mars odds, Hebrew explanations (shot counts, points, primes, anchors, race, Mars risk) and a ghost-checker demonstration on the board.
- **Your games:** pause/resume/stop, name a session at any time, game history (search, filter, sort, delete), move-by-move replay, statistics (performance rating, mistakes by severity, luck, results per level).
- **Look and play:** 8 themes, 6 checker shapes and 8 dice styles to mix and match; board direction; mistake thresholds; sounds; bot speed; backup export/import.
- **Offline:** runs entirely on the device as an installable web app (PWA) — no App Store, no account, nothing sent anywhere.

## Install on your iPhone (no App Store)

The app is a Progressive Web App: it is hosted as a website (free, on GitHub Pages) and then added to your Home Screen, where it opens full-screen like a normal app and works offline.

### 1. Publish it (once)

1. Create a free **personal** GitHub account at <https://github.com/signup> (don't use a work/organization account).
2. Create a new **public** repository named `shesh-besh` (GitHub Pages is free for public repos). Don't add a README.
3. From this folder, push the code (replace `<username>`):
   ```bash
   git add -A && git commit -m "Shesh-besh trainer"
   git branch -M main
   git remote add origin https://github.com/<username>/shesh-besh.git
   git push -u origin main
   ```
4. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Open the **Actions** tab and wait for "Deploy to GitHub Pages" to turn green (about 2 minutes). Your app is now at
   `https://<username>.github.io/shesh-besh/`.

### 2. Add it to the iPhone

1. Open the address above in **Safari** (it must be Safari, not Chrome).
2. Tap the **Share** button (square with an arrow) → **Add to Home Screen** → **Add**.
3. Open **שש־בש** from the new icon and turn the phone sideways. Make sure the orientation lock is off.
4. The first launch downloads the engine (~2 MB). After that the app works without internet.

### Updates

Every push to `main` redeploys automatically. The installed app picks up the new version the next time it is opened with an internet connection (close it fully and reopen if you don't see the change).

### Backups

Your games live only on the phone. In **הגדרות → גיבוי → ייצוא גיבוי** save the backup file to iCloud Drive / Files; **ייבוא גיבוי** restores it. Deleting the Home Screen app or clearing Safari's website data erases the history.

### Tips

- No sound? iPhone's silent switch also mutes web apps.
- Trying it before publishing: run `npm run build && npm run preview`, then open `http://<your-mac-ip>:4173` in Safari on an iPhone on the same Wi-Fi (`ipconfig getifaddr en0` shows the Mac's address). Offline mode needs the HTTPS (GitHub Pages) version.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests: rules, analysis, random games, move generation vs gnubg
npx playwright test  # end-to-end in Chrome at iPhone-landscape size (plays full games)
npm run build        # production build in dist/
```

Project layout:

| Path | What |
|---|---|
| `src/game/rules.ts` | Backgammon rules: move generation (max dice / larger die), bar, bear-off, Mars scoring, notation |
| `src/game/controller.ts` | Game flow: opening roll (starter rolls fresh dice), turns, bot, training review, pause/stop, saving |
| `src/engine/` | Web Worker wrapper around the WebAssembly engine, with a simple fallback evaluator |
| `src/training/analysis.ts` | Severity levels, exact shot counting, position features and the Hebrew explanations |
| `src/store/` | IndexedDB game history, settings, backup |
| `src/ui/` | React screens, SVG board, themes, sounds |
| `engine/` | Build of the gnubg engine (`engine/build.sh`, API in `engine/README.md`) |
| `public/engine/` | Prebuilt engine: `sb-engine.js` + `sb-engine.wasm` |
| `mockups/` | Design mockups and theme images from the planning phase |

## License

GPL-3.0-or-later. The engine is [GNU Backgammon](https://www.gnu.org/software/gnubg/) (GPL), built from the [gnubg-web](https://github.com/hwatheod/gnubg-web) Emscripten port. See `engine/COPYING`.
