# Shesh-Besh engine (GNU Backgammon -> WebAssembly)

The move engine for the Shesh-Besh trainer: GNU Backgammon's evaluator (real
neural nets `gnubg.wd` + one-sided bearoff database `gnubg_os0.bd`) compiled
with Emscripten, wrapped in a small C API (`api/sb_api.c`) that returns JSON.
Plays at gnubg strength. Runs fully offline.

## Files

| Path | What |
|------|------|
| `api/sb_api.c` | The C API (it `#include`s gnubg's `eval.c`) |
| `build.sh` | Reproducible build (clones gnubg-web at a pinned commit) |
| `test/test.mjs` | Node test + timings: `node engine/test/test.mjs` |
| `gnubg-web/` | Clone of https://github.com/hwatheod/gnubg-web (gnubg 1.05 + emscripten-ready glib 2.62 subset) |
| `../public/engine/sb-engine.js` | ES6 module factory (`createSbEngine`), ~68 KB (19 KB gzip) |
| `../public/engine/sb-engine.wasm` | Code + embedded data files, ~2.2 MB (1.5 MB gzip, 1.3 MB brotli) |

The data files are embedded into the `.wasm` (`--embed-file`), so there is no
`.data` file; only the two files above are needed at runtime (cache both in the
PWA service worker).

## Build

```sh
brew install emscripten     # tested with emcc 6.0.12
./engine/build.sh           # -> public/engine/sb-engine.{js,wasm}
node engine/test/test.mjs
```

Options: `SB_SIMD=1 ./build.sh` builds with wasm SIMD (gnubg's SSE2 path via
emscripten's SSE headers): ~25% faster with identical results, but requires
iOS Safari 16.4+, so it is off by default. `SB_DEBUG=1` gives an unoptimised
build with assertions.

Only gnubg's evaluation core is compiled (`eval.c`, `lib/neuralnet.c`,
`lib/inputs.c`, `lib/cache.c`, `lib/isaac.c`, `lib/md5.c`, `positionid.c`,
`bearoff.c`, `bearoffgammon.c`, `matchequity.c`, `mtsupport.c`, `util.c`) plus
the glib subset; no GUI, sound, python, sqlite, CLI, rollouts. The two-sided
bearoff DB is not included (gnubg prints "No two-sided bearoff databases..."
once at init; pass a `print` override to silence it).

## Board convention (gnubg-native)

Two `int[25]` arrays:

- `me[25]` = the player **on roll**, `opp[25]` = the opponent.
- Index `0..23` = points from **that player's own perspective** (0 = that
  player's ace/1-point, 23 = their 24-point). Index `24` = bar.
- My point `i` is the opponent's point `23 - i`.
- Checkers borne off are implicit (15 minus the sum).

Opening position: `me[5]=5, me[7]=3, me[12]=5, me[23]=2`, same for `opp`.

Moves are arrays of `[from, to]` pairs in the on-roll player's indices:
`from = 24` means from the bar, `to = -1` means borne off. Each pair is one die
(doubles give up to 4 pairs). Move legality follows the full rules (must use
both dice / the larger die when possible); gnubg lists each distinct resulting
position once.

Inputs are validated (0..15 per point, at most 15 per side, no point occupied
by both); invalid input returns `{"error":"bad input"}`.

## Evaluation mode

Money game **without doubling cube**: cubeless evaluation (`fCubeful = FALSE`),
gammons and backgammons count (win = 1, gammon = 2, backgammon = 3), no Jacoby.
`eq` = cubeless money equity for the on-roll player, in [-3, 3].
`p` = gnubg's 5 outputs `[win, winGammon, winBackgammon, loseGammon,
loseBackgammon]`, cumulative as in gnubg (winGammon includes winBackgammon), so
`eq = 2*win - 1 + winG - loseG + winBG - loseBG`.

## API

All functions return a pointer to a JSON string in a **single static buffer**
that is overwritten by the next call — read it immediately with
`UTF8ToString`. Boards are passed as pointers to 25 `int32`s in wasm memory.

| Function | Result |
|----------|--------|
| `int sb_init(void)` | 0 on success (loads nets + bearoff DB, ~10-30 ms). Called automatically by the others if needed. |
| `const char* sb_best_move(const int* me, const int* opp, int d0, int d1, int level)` | `{"move":[[from,to],...]}`; `[]` if no legal move |
| `const char* sb_analyze(const int* me, const int* opp, int d0, int d1, int ply)` | `{"moves":[{"move":[[f,t],...],"eq":0.123,"p":[5 floats],"ply":2}, ...]}` ranked best-first; `[]` if no legal move |
| `const char* sb_analyze_move(me, opp, d0, d1, ply, const int* move, int nPairs)` | Same as `sb_analyze`, but guarantees the given move (`nPairs` `[from,to]` pairs, flattened) is evaluated at full `ply`, together with the best move (gnubg's "analyse played move" behaviour). Use this to grade the user's move. |
| `const char* sb_evaluate(const int* me, const int* opp, int ply)` | `{"eq":..,"p":[...],"ply":n}` for the position with `me` on roll, before rolling |
| `void sb_clear_cache(void)` | Flush the evaluation cache (benchmarking only) |

`ply` is clamped to 0..3 (2 recommended).

### Levels (`sb_best_move`)

gnubg's own predefined player settings, with **non-deterministic** noise
(seeded from `crypto.getRandomValues` at init):

| level | gnubg setting | search | noise (std dev) |
|-------|---------------|--------|-----------------|
| 0 | Beginner | 0-ply | 0.060 |
| 1 | Intermediate | 0-ply | 0.040 |
| 2 | Advanced | 0-ply | 0.015 |
| 3 | Expert | 0-ply | none |
| 4 | World class | 2-ply, gnubg "Normal" move filter, pruning nets | none |

### Ranking in `sb_analyze`

Moves are evaluated at 0-ply, the best candidates (always at least 4, plus up
to 8 more within 0.16 equity of the best — gnubg's "Normal" filter with a
minimum of 4) are re-evaluated at `ply`. The result is in gnubg's order:
first the moves evaluated at `ply`, sorted by equity, then the filtered-out
moves sorted by their 0-ply equity (their `"ply"` field says 0). The first
move is the best; a filtered-out move's 0-ply equity is not strictly
comparable with deeper equities, so use `sb_analyze_move` to grade a specific
move. Because of the minimum of 4 candidates, `sb_analyze(...)` at ply 2 can
very occasionally prefer a different move than `sb_best_move(..., 4)`, which
uses gnubg's exact world-class filter.

## Usage from a module Web Worker

```js
// engine.worker.js  (type: 'module')
const { default: createSbEngine } = await import(/* @vite-ignore */ '/engine/sb-engine.js');
const M = await createSbEngine({ print: () => {} });
M._sb_init();
const pMe = M._malloc(100), pOpp = M._malloc(100), pMv = M._malloc(32);
function call(fn, me, opp, ...args) {
  M.HEAP32.set(me, pMe >> 2);
  M.HEAP32.set(opp, pOpp >> 2);
  return JSON.parse(M.UTF8ToString(fn(pMe, pOpp, ...args)));
}
const best = call(M._sb_best_move, me, opp, 3, 1, 4);   // {move:[[7,4],[5,4]]}
const ana  = call(M._sb_analyze, me, opp, 3, 1, 2);
```

The wasm is located relative to `sb-engine.js` (`import.meta.url`); pass
`locateFile` to the factory to override.

## Performance (Node 26, Apple Silicon, scalar build, cold cache)

- `sb_best_move` level 0-3: < 1 ms.
- `sb_best_move` level 4 (2-ply): 3-55 ms on midgame positions.
- `sb_analyze` ply 2: 4-47 ms; `sb_evaluate` ply 2 ~ 11 ms.
- Expect several times slower on an iPhone.

## License

GNU Backgammon and gnubg-web are GPL-3.0-or-later; so is this engine
(`api/sb_api.c`) and the built `sb-engine.{js,wasm}` (see `COPYING`).
Source: GNU Backgammon 1.05 (https://www.gnu.org/software/gnubg/) via
gnubg-web (https://github.com/hwatheod/gnubg-web, commit 95d0ffc), plus the
files in this directory.
