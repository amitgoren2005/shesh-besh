#!/usr/bin/env bash
# Build the Shesh-Besh gnubg engine (WebAssembly) from scratch.
#
# Requirements: emscripten (tested with emcc 6.0.12, `brew install emscripten`), git.
# Output: ../public/engine/sb-engine.js + sb-engine.wasm
#
# Usage: ./build.sh            (clones gnubg-web if missing, then builds)
#        SB_DEBUG=1 ./build.sh (unoptimised build with assertions)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

GW_REPO="https://github.com/hwatheod/gnubg-web"
GW_COMMIT="95d0ffcbaa3f891571c28af5ba57ec831c6ee000"   # tested commit (2026-09-01)
GW="$HERE/gnubg-web"
OUT="$HERE/../public/engine"
OBJ="$HERE/build/obj"

if [ ! -d "$GW" ]; then
    git clone "$GW_REPO" "$GW"
    git -C "$GW" checkout -q "$GW_COMMIT"
fi

GL="$GW/glib/glib-2.62.0"
GB="$GW/gnubg"

mkdir -p "$OUT" "$OBJ" "$HERE/build/data"

# Data files placed at the root of the Emscripten virtual FS.
cp "$GW/packaged_files/gnubg.wd" "$HERE/build/data/gnubg.wd"
cp "$GW/packaged_files/gnubg_os0.bd" "$HERE/build/data/gnubg_os0.bd"

DEFS=(-DGLIB_COMPILATION=1 -DWEB=1)
INCS=(-I "$GL/glib" -I "$GL" -I "$GL/_build/glib" -I "$GB/lib" -I "$GB"
      -I "$GL/_build" -I "$GL/glib/libcharset")

if [ "${SB_DEBUG:-0}" = "1" ]; then
    OPT=(-O0 -g -sASSERTIONS=2)
else
    OPT=(-O3)
fi
# Wasm SIMD (gnubg's SSE code path through emscripten's SSE->wasm-simd headers).
# Off by default for compatibility (needs iOS Safari >= 16.4); SB_SIMD=1 enables
# it (~25% faster, identical results).
if [ "${SB_SIMD:-0}" = "1" ]; then
    SIMD=(-msimd128 -msse2 -DUSE_SIMD_INSTRUCTIONS=1 -DUSE_SSE2=1 -DDISABLE_SIMD_TEST=1)
else
    SIMD=()
fi

# Minimal gnubg evaluation core (sb_api.c #includes eval.c).
GNUBG_SRC=(
    "$HERE/api/sb_api.c"
    "$GB/lib/neuralnet.c"
    "$GB/lib/inputs.c"
    "$GB/lib/cache.c"
    "$GB/lib/isaac.c"
    "$GB/lib/md5.c"
    "$GB/positionid.c"
    "$GB/bearoff.c"
    "$GB/bearoffgammon.c"
    "$GB/matchequity.c"
    "$GB/mtsupport.c"
    "$GB/util.c"
)
if [ "${SB_SIMD:-0}" = "1" ]; then
    GNUBG_SRC+=("$GB/lib/neuralnetsse.c")
fi

# glib subset (pre-configured for emscripten by gnubg-web); unused code is
# dropped by the linker.
GLIB_SRC=("$GL"/glib/*.c "$GL"/glib/libcharset/*.c)

EXPORTS='["_malloc","_free","_sb_init","_sb_best_move","_sb_analyze","_sb_analyze_move","_sb_evaluate","_sb_clear_cache"]'
RUNTIME='["ccall","cwrap","UTF8ToString","HEAP32"]'

emcc "${GNUBG_SRC[@]}" "${GLIB_SRC[@]}" \
    "${OPT[@]}" "${SIMD[@]}" "${DEFS[@]}" "${INCS[@]}" \
    -Wno-everything \
    -o "$OUT/sb-engine.js" \
    --no-entry \
    --embed-file "$HERE/build/data/gnubg.wd@/gnubg.wd" \
    --embed-file "$HERE/build/data/gnubg_os0.bd@/gnubg_os0.bd" \
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createSbEngine \
    -sENVIRONMENT=web,worker,node \
    -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 \
    -sSTACK_SIZE=1048576 \
    -sERROR_ON_UNDEFINED_SYMBOLS=1 \
    -sEXPORTED_FUNCTIONS="$EXPORTS" \
    -sEXPORTED_RUNTIME_METHODS="$RUNTIME"

ls -l "$OUT"
