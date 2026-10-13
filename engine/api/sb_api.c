/*
 * sb_api.c - small JSON C API around the GNU Backgammon evaluation engine,
 * for the Shesh-Besh trainer (WebAssembly / Web Worker).
 *
 * Copyright (C) 2026 the Shesh-Besh authors.
 * Based on GNU Backgammon (C) the GNU Backgammon authors.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * Board convention (gnubg-native):
 *   me[25]  = player ON ROLL, opp[25] = opponent.
 *   index 0..23 = points from that player's own perspective
 *   (0 = that player's ace point, 23 = 24-point), 24 = bar.
 *   Internally anBoard[1] = me, anBoard[0] = opp.
 *
 * Moves are pairs [from,to] in the on-roll player's indices,
 * from 24 = bar, to -1 = borne off.
 *
 * All evaluation is CUBELESS money equity (win=1, gammon=2, backgammon=3,
 * no Jacoby) from the on-roll player's perspective.
 */

/* Include eval.c directly so we can reach its static noise RNG context. */
#include "eval.c"

#include <emscripten/emscripten.h>
#include <stdarg.h>
#include <unistd.h>

#define SB_BUFSIZE (1024 * 1024)
static char sbBuf[SB_BUFSIZE];
static size_t sbLen;
static int sbInitialised = 0;

#if USE_SIMD_INSTRUCTIONS
/* from output.c (not linked); only used for SIMD start-up errors */
extern void
outputerrf(const char *sz, ...)
{
    va_list val;
    va_start(val, sz);
    vfprintf(stderr, sz, val);
    va_end(val);
}
#endif

/* from matchid.c (not linked) */
extern int
LogCube(int n)
{
    int i = 0;
    while (n >>= 1)
        i++;
    return i;
}

static void
sb_reset(void)
{
    sbLen = 0;
    sbBuf[0] = 0;
}

static void
sb_printf(const char *fmt, ...)
{
    va_list ap;
    int n;
    if (sbLen >= SB_BUFSIZE - 1)
        return;
    va_start(ap, fmt);
    n = vsnprintf(sbBuf + sbLen, SB_BUFSIZE - sbLen, fmt, ap);
    va_end(ap);
    if (n > 0) {
        sbLen += (size_t) n;
        if (sbLen >= SB_BUFSIZE)
            sbLen = SB_BUFSIZE - 1;
    }
}

static const char *
sb_error(const char *msg)
{
    sb_reset();
    sb_printf("{\"error\":\"%s\"}", msg);
    return sbBuf;
}

/* Reseed the noise RNG from the platform entropy source (crypto.getRandomValues). */
static void
sb_seed_noise(void)
{
    unsigned int i;
    ub4 seed[RANDSIZ];
    if (getentropy(seed, sizeof(seed)) != 0) {
        ub4 t = (ub4) time(NULL) ^ (ub4) (emscripten_get_now() * 1000.0);
        for (i = 0; i < RANDSIZ; i++)
            seed[i] = t + i * 2654435761u;
    }
    for (i = 0; i < RANDSIZ; i++)
        rc.randrsl[i] = seed[i];
    irandinit(&rc, TRUE);
}

/* Validate and convert JS boards into a gnubg TanBoard. Returns 0 if OK. */
static int
sb_board(TanBoard anBoard, const int *me, const int *opp)
{
    int i, nMe = 0, nOpp = 0;
    if (!me || !opp)
        return -1;
    for (i = 0; i < 25; i++) {
        if (me[i] < 0 || me[i] > 15 || opp[i] < 0 || opp[i] > 15)
            return -1;
        anBoard[1][i] = (unsigned int) me[i];
        anBoard[0][i] = (unsigned int) opp[i];
        nMe += me[i];
        nOpp += opp[i];
    }
    if (nMe > 15 || nOpp > 15)
        return -1;
    /* my point i is opponent's point 23-i: they cannot both be occupied */
    for (i = 0; i < 24; i++)
        if (me[i] && opp[23 - i])
            return -1;
    return 0;
}

static void
sb_cubeinfo(cubeinfo * pci)
{
    /* money game, centred cube of 1, no Jacoby, no beavers */
    SetCubeInfoMoney(pci, 1, -1, 0, FALSE, FALSE, VARIATION_STANDARD);
}

static void
sb_print_move(const int anMove[8])
{
    int i;
    sb_printf("[");
    for (i = 0; i < 4 && anMove[2 * i] >= 0; i++) {
        int to = anMove[2 * i + 1];
        sb_printf("%s[%d,%d]", i ? "," : "", anMove[2 * i], to < 0 ? -1 : to);
    }
    sb_printf("]");
}

static void
sb_print_probs(const float *ar)
{
    sb_printf("[%.6f,%.6f,%.6f,%.6f,%.6f]", ar[OUTPUT_WIN], ar[OUTPUT_WINGAMMON],
              ar[OUTPUT_WINBACKGAMMON], ar[OUTPUT_LOSEGAMMON], ar[OUTPUT_LOSEBACKGAMMON]);
}

static int
sb_dice_ok(int d0, int d1)
{
    return d0 >= 1 && d0 <= 6 && d1 >= 1 && d1 <= 6;
}

EMSCRIPTEN_KEEPALIVE int
sb_init(void)
{
    if (sbInitialised)
        return 0;
    /* weights and one-sided bearoff db are in the virtual FS root */
    EvalInitialise(NULL, "/gnubg.wd", FALSE, NULL);
    /* must come after the nets are loaded: allocates the incremental
     * evaluation buffers using the nets' sizes */
    MT_InitThreads();
    if (!nnContact.cInput || !nnRace.cInput || !nnCrashed.cInput)
        return -1;
    if (!pbc1)
        return -2;
    sb_seed_noise();
    sbInitialised = 1;
    return 0;
}

/* level: 0=Beginner 1=Intermediate 2=Advanced 3=Expert 4=World class */
EMSCRIPTEN_KEEPALIVE const char *
sb_best_move(const int *me, const int *opp, int d0, int d1, int level)
{
    TanBoard anBoard;
    cubeinfo ci;
    evalcontext ec;
    int anMove[8];
    int iSetting;
    movefilter (*aamf)[MAX_FILTER_PLIES] = aaamfMoveFilterSettings[2];  /* "Normal" */

    if (!sbInitialised && sb_init() != 0)
        return sb_error("init failed");
    if (sb_board(anBoard, me, opp) || !sb_dice_ok(d0, d1))
        return sb_error("bad input");

    switch (level) {
    case 0: iSetting = SETTINGS_BEGINNER; break;
    case 1: iSetting = SETTINGS_INTERMEDIATE; break;
    case 2: iSetting = SETTINGS_ADVANCED; break;
    case 3: iSetting = SETTINGS_EXPERT; break;
    default: iSetting = SETTINGS_WORLDCLASS; break;
    }
    ec = aecSettings[iSetting];
    ec.fCubeful = FALSE;
    ec.fDeterministic = FALSE;  /* random (non-repeatable) noise */
    if (aiSettingsMoveFilter[iSetting] >= 0)
        aamf = aaamfMoveFilterSettings[aiSettingsMoveFilter[iSetting]];

    sb_cubeinfo(&ci);

    if (FindBestMove(anMove, d0, d1, anBoard, &ci, &ec, aamf) < 0)
        return sb_error("evaluation failed");

    sb_reset();
    sb_printf("{\"move\":");
    sb_print_move(anMove);
    sb_printf("}");
    return sbBuf;
}

/* Move filter for analysis: like gnubg's "Normal" filter, but always keeps
 * at least SB_ANALYZE_MIN candidates for the deep evaluation so that the top
 * moves are always compared at the requested ply. */
#define SB_ANALYZE_MIN 4
static movefilter sbAnalyzeFilter[MAX_FILTER_PLIES][MAX_FILTER_PLIES] = {
    {{SB_ANALYZE_MIN, 8, 0.16f}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}},
    {{SB_ANALYZE_MIN, 8, 0.16f}, {-1, 0, 0}, {0, 0, 0}, {0, 0, 0}},
    {{SB_ANALYZE_MIN, 8, 0.16f}, {-1, 0, 0}, {0, 2, 0.04f}, {0, 0, 0}},
    {{SB_ANALYZE_MIN, 8, 0.16f}, {-1, 0, 0}, {0, 2, 0.04f}, {-1, 0, 0}}
};

static const char *
sb_analyze_impl(const int *me, const int *opp, int d0, int d1, int ply, const int *keyMoves, int nKey)
{
    TanBoard anBoard;
    cubeinfo ci;
    evalcontext ec = { FALSE, 0, TRUE, TRUE, 0.0f };
    movelist ml;
    positionkey key;
    positionkey *pkey = NULL;
    unsigned int i;

    if (!sbInitialised && sb_init() != 0)
        return sb_error("init failed");
    if (sb_board(anBoard, me, opp) || !sb_dice_ok(d0, d1))
        return sb_error("bad input");
    if (ply < 0)
        ply = 0;
    if (ply > 3)
        ply = 3;
    ec.nPlies = (unsigned int) ply;
    sb_cubeinfo(&ci);

    if (keyMoves && nKey > 0) {
        int anMove[8];
        int j;
        for (j = 0; j < 8; j++)
            anMove[j] = -1;
        for (j = 0; j < nKey && j < 4; j++) {
            anMove[2 * j] = keyMoves[2 * j];
            anMove[2 * j + 1] = keyMoves[2 * j + 1];
        }
        if (MoveKey((ConstTanBoard) anBoard, anMove, &key) == 0)
            pkey = &key;
    }

    if (FindnSaveBestMoves(&ml, d0, d1, (ConstTanBoard) anBoard, pkey, 0.0f, &ci, &ec, sbAnalyzeFilter) < 0)
        return sb_error("evaluation failed");

    sb_reset();
    sb_printf("{\"moves\":[");
    for (i = 0; i < ml.cMoves; i++) {
        move *pm = ml.amMoves + i;
        sb_printf("%s{\"move\":", i ? "," : "");
        sb_print_move(pm->anMove);
        sb_printf(",\"eq\":%.6f,\"p\":", pm->rScore);
        sb_print_probs(pm->arEvalMove);
        sb_printf(",\"ply\":%d}", (int) pm->esMove.ec.nPlies);
    }
    sb_printf("]}");
    if (ml.amMoves)
        free(ml.amMoves);
    return sbBuf;
}

/* All legal moves ranked best-first (gnubg ordering: moves evaluated at the
 * requested ply first, sorted by equity; then moves eliminated by the move
 * filter at a lower ply, sorted by their lower-ply equity). */
EMSCRIPTEN_KEEPALIVE const char *
sb_analyze(const int *me, const int *opp, int d0, int d1, int ply)
{
    return sb_analyze_impl(me, opp, d0, d1, ply, NULL, 0);
}

/* Same as sb_analyze, but guarantees that the given move (nMoves [from,to]
 * pairs in moves[2*nMoves]) is evaluated at the full requested ply, like
 * gnubg does when analysing a played move. */
EMSCRIPTEN_KEEPALIVE const char *
sb_analyze_move(const int *me, const int *opp, int d0, int d1, int ply, const int *moves, int nMoves)
{
    return sb_analyze_impl(me, opp, d0, d1, ply, moves, nMoves);
}

/* Evaluate position with `me` on roll, before rolling. */
EMSCRIPTEN_KEEPALIVE const char *
sb_evaluate(const int *me, const int *opp, int ply)
{
    TanBoard anBoard;
    cubeinfo ci;
    evalcontext ec = { FALSE, 0, TRUE, TRUE, 0.0f };
    float arOutput[NUM_ROLLOUT_OUTPUTS];

    if (!sbInitialised && sb_init() != 0)
        return sb_error("init failed");
    if (sb_board(anBoard, me, opp))
        return sb_error("bad input");
    if (ply < 0)
        ply = 0;
    if (ply > 3)
        ply = 3;
    ec.nPlies = (unsigned int) ply;
    sb_cubeinfo(&ci);

    if (GeneralEvaluationE(arOutput, (ConstTanBoard) anBoard, &ci, &ec) < 0)
        return sb_error("evaluation failed");

    sb_reset();
    sb_printf("{\"eq\":%.6f,\"p\":", arOutput[OUTPUT_EQUITY]);
    sb_print_probs(arOutput);
    sb_printf(",\"ply\":%d}", ply);
    return sbBuf;
}

/* Flush gnubg's evaluation cache (mainly for benchmarking). */
EMSCRIPTEN_KEEPALIVE void
sb_clear_cache(void)
{
    EvalCacheFlush();
}
