#!/bin/bash
cd "$(dirname "$0")/.."
TMP=$(mktemp /tmp/zy_dbg_XXXX.js)
{
  echo 'var print = function (s) { console.log(s); };'
  cat js/adapter.js js/config.js js/map.js js/render.js js/audio.js js/board.js js/enemies.js js/battle.js js/ai.js js/rank.js js/weapon.js js/ui.js js/main.js tools/debug_sim.js
} > "$TMP"
osascript -l JavaScript "$TMP" 2>&1
rm -f "$TMP"
