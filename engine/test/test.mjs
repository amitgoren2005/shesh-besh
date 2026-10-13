// Node test for the Shesh-Besh gnubg engine.
// Run: node engine/test/test.mjs
import createSbEngine from '../../public/engine/sb-engine.js';

const M = await createSbEngine();

let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ok   ' + msg);
  else { failures++; console.log('  FAIL ' + msg); }
}

const bufMe = M._malloc(25 * 4);
const bufOpp = M._malloc(25 * 4);
const bufMv = M._malloc(8 * 4);

function setBoards(me, opp) {
  M.HEAP32.set(me, bufMe >> 2);
  M.HEAP32.set(opp, bufOpp >> 2);
}
function bestMove(me, opp, d0, d1, level) {
  setBoards(me, opp);
  return JSON.parse(M.UTF8ToString(M._sb_best_move(bufMe, bufOpp, d0, d1, level)));
}
function analyze(me, opp, d0, d1, ply) {
  setBoards(me, opp);
  return JSON.parse(M.UTF8ToString(M._sb_analyze(bufMe, bufOpp, d0, d1, ply)));
}
function analyzeMove(me, opp, d0, d1, ply, move) {
  setBoards(me, opp);
  M.HEAP32.set(move.flat(), bufMv >> 2);
  return JSON.parse(M.UTF8ToString(M._sb_analyze_move(bufMe, bufOpp, d0, d1, ply, bufMv, move.length)));
}
function evaluate(me, opp, ply) {
  setBoards(me, opp);
  return JSON.parse(M.UTF8ToString(M._sb_evaluate(bufMe, bufOpp, ply)));
}
function board(spec) { // spec: {index: count}
  const b = new Array(25).fill(0);
  for (const [k, v] of Object.entries(spec)) b[+k] = v;
  return b;
}
const fmt = (mv) => mv.map(([f, t]) => `${f === 24 ? 'bar' : f + 1}/${t < 0 ? 'off' : t + 1}`).join(' ');
const canon = (mv) => JSON.stringify([...mv].map((x) => x.join(',')).sort());
const sameMove = (a, b) => canon(a) === canon(b);
function time(fn, n = 1) {
  const t0 = performance.now();
  let r;
  for (let i = 0; i < n; i++) r = fn();
  return [r, (performance.now() - t0) / n];
}

let t0 = performance.now();
const rc = M._sb_init();
console.log(`sb_init -> ${rc} (${(performance.now() - t0).toFixed(0)} ms)`);
check(rc === 0, 'sb_init returns 0');

const start = board({ 5: 5, 7: 3, 12: 5, 23: 2 });

console.log('\n(a) opening moves, world class (level 4)');
for (const [d0, d1, exp] of [
  [3, 1, [[7, 4], [5, 4]]],
  [6, 1, [[12, 6], [7, 6]]],
  [4, 2, [[7, 3], [5, 3]]],
]) {
  const r = bestMove(start, start, d0, d1, 4);
  check(sameMove(r.move, exp), `${d0}-${d1}: ${fmt(r.move)} (expected ${fmt(exp)})`);
}
console.log('  opening 3-1 at each level:');
for (let lv = 0; lv <= 4; lv++) {
  const seen = new Set();
  for (let i = 0; i < 20; i++) seen.add(fmt(bestMove(start, start, 3, 1, lv).move));
  console.log(`    level ${lv}: ${[...seen].join(' | ')}`);
}

console.log('\n(b) sb_analyze ranking');
for (const [d0, d1] of [[3, 1], [6, 5], [2, 2], [5, 4]]) {
  const r = analyze(start, start, d0, d1, 2);
  const eqs = r.moves.map((m) => m.eq);
  const best = eqs[0];
  check(r.moves.length > 0 && eqs.every((e) => e <= best + 1e-9), `${d0}-${d1}: ${r.moves.length} moves, best ${fmt(r.moves[0].move)} eq=${best.toFixed(3)} >= all others`);
  // within same ply group, sorted descending
  let sorted = true;
  for (let i = 1; i < r.moves.length; i++)
    if (r.moves[i].ply === r.moves[i - 1].ply && r.moves[i].eq > r.moves[i - 1].eq + 1e-9) sorted = false;
  const plyCounts = {};
  r.moves.forEach((m) => (plyCounts[m.ply] = (plyCounts[m.ply] || 0) + 1));
  check(sorted, `${d0}-${d1}: sorted by eq within ply groups ${JSON.stringify(plyCounts)}`);
  const p = r.moves[0].p;
  check(p.length === 5 && p[1] >= p[2] && p[3] >= p[4], `${d0}-${d1}: p = ${JSON.stringify(p)}`);
  // equity consistent with probabilities (cubeless money)
  const eqFromP = 2 * p[0] - 1 + p[1] - p[3] + p[2] - p[4];
  check(Math.abs(eqFromP - best) < 1e-4, `${d0}-${d1}: eq matches probabilities (${eqFromP.toFixed(4)})`);
}
{
  // number of legal moves for 3-1 opening (gnubg dedups identical positions)
  const r0 = analyze(start, start, 3, 1, 0);
  console.log(`  3-1 at 0-ply: ${r0.moves.length} moves; top 3: ` + r0.moves.slice(0, 3).map((m) => `${fmt(m.move)} ${m.eq.toFixed(3)}`).join(', '));
  // analyze a specific (bad) move: guaranteed to be evaluated at 2-ply
  const bad = [[23, 20], [23, 22]];
  const ra = analyzeMove(start, start, 3, 1, 2, bad);
  const e = ra.moves.find((m) => sameMove(m.move, bad));
  check(e && e.ply === 2, `sb_analyze_move: ${fmt(bad)} evaluated at ply ${e && e.ply}, eq ${e && e.eq.toFixed(3)}, loss ${(ra.moves[0].eq - e.eq).toFixed(3)}`);
}

console.log('\n(c) bear-off');
{
  const me = board({ 0: 2, 1: 3, 2: 2, 4: 1 });
  const opp = board({ 0: 3, 3: 4, 5: 3 });
  const r = bestMove(me, opp, 6, 3, 4);
  check(r.move.length > 0 && r.move.some(([, t]) => t === -1), `6-3 bear-off: ${fmt(r.move)}`);
  const r2 = bestMove(board({ 0: 1 }), opp, 2, 1, 4);
  check(r2.move.length === 1 && r2.move[0][1] === -1, `last checker 2-1: ${fmt(r2.move)}`);
  const ev = evaluate(me, opp, 0);
  console.log(`  evaluate bearoff position: eq=${ev.eq.toFixed(4)} p=${JSON.stringify(ev.p)}`);
}

console.log('\n(e) checker on the bar');
{
  // me: one checker on bar; opponent holds a 5-point board (points 1..5 from MY perspective are opp's 20..24 => opp indices 19..23?)
  // Opponent's home board = my points 19..24 = my indices 18..23 = opp indices 0..5.
  const me = board({ 24: 1, 5: 5, 7: 3, 12: 5, 13: 1 });
  const opp = board({ 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 7: 2, 12: 3 }); // opp 5-point board, 6-point open
  const r = bestMove(me, opp, 6, 6, 4);
  check(r.move.length > 0 && r.move[0][0] === 24 && r.move[0][1] === 18, `6-6 from bar: ${fmt(r.move)}`);
  const r2 = bestMove(me, opp, 5, 4, 4);
  check(Array.isArray(r2.move) && r2.move.length === 0, `5-4 vs closed points: no legal move -> ${JSON.stringify(r2.move)}`);
  const a = analyze(me, opp, 5, 4, 2);
  check(a.moves.length === 0, `analyze with no legal move -> ${a.moves.length} moves`);
  const ev = evaluate(me, opp, 2);
  console.log(`  evaluate (on bar, 2-ply): eq=${ev.eq.toFixed(4)} p=${JSON.stringify(ev.p)}`);
}

console.log('\n(f) evaluate opening position');
for (const ply of [0, 1, 2]) {
  const [ev, ms] = time(() => evaluate(start, start, ply));
  console.log(`  ply ${ply}: eq=${ev.eq.toFixed(4)} p=${JSON.stringify(ev.p)} (${ms.toFixed(1)} ms)`);
}
check(evaluate(start, start, 0).p[0] > 0.45 && evaluate(start, start, 0).p[0] < 0.6, 'opening win prob plausible');
{
  const r = JSON.parse(M.UTF8ToString((setBoards(board({ 0: 16 }), start), M._sb_evaluate(bufMe, bufOpp, 0))));
  check(r.error, `bad input rejected: ${JSON.stringify(r)}`);
}

console.log('\n(d) timing (Node)');
const mid = [
  ['midgame A', board({ 5: 4, 7: 2, 12: 4, 18: 1, 22: 2, 3: 2 }), board({ 4: 3, 6: 2, 7: 2, 12: 4, 17: 2, 23: 2 })],
  ['midgame B', board({ 2: 2, 3: 2, 4: 3, 5: 3, 7: 2, 12: 1, 20: 2 }), board({ 1: 2, 4: 2, 5: 4, 7: 3, 9: 1, 17: 1, 23: 2 })],
  ['midgame C (blitz)', board({ 0: 2, 2: 2, 3: 2, 4: 2, 5: 3, 7: 2, 12: 2 }), board({ 5: 4, 7: 2, 12: 4, 24: 2, 22: 1, 17: 2 })],
];
for (const [name, me, opp] of mid) {
  const tot = me.reduce((a, b) => a + b), tot2 = opp.reduce((a, b) => a + b);
  for (const [d0, d1] of [[6, 4], [3, 3]]) {
    M._sb_clear_cache();
    const [b, tb] = time(() => bestMove(me, opp, d0, d1, 4));
    M._sb_clear_cache();
    const [b0, tb0] = time(() => bestMove(me, opp, d0, d1, 3));
    M._sb_clear_cache();
    const [a, ta] = time(() => analyze(me, opp, d0, d1, 2));
    const [, ta2] = time(() => analyze(me, opp, d0, d1, 2));
    if (!sameMove(a.moves[0].move, b.move)) console.log(`    note: analyze best ${fmt(a.moves[0].move)} differs from level-4 best ${fmt(b.move)}`);
    console.log(`  ${name} (${tot}/${tot2} chk) ${d0}-${d1}: best L4 ${fmt(b.move)} ${tb.toFixed(0)} ms | L3 ${tb0.toFixed(1)} ms | analyze ply2 ${a.moves.length} moves ${ta.toFixed(0)} ms (cached ${ta2.toFixed(0)} ms)`);
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL TESTS PASSED');
process.exit(failures ? 1 : 0);
