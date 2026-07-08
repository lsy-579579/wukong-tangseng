#!/bin/bash
# 拼接游戏逻辑与无头模拟器，用 macOS 自带的 JavaScript 引擎（JXA）运行
cd "$(dirname "$0")/.."
TMP=$(mktemp /tmp/zy_sim_XXXX.js)
{
  echo 'var print = function (s) { console.log(s); };'
  cat js/adapter.js js/config.js js/map.js js/render.js js/audio.js js/board.js js/enemies.js js/battle.js js/ai.js js/rank.js js/weapon.js js/ui.js js/main.js tools/headless_sim.js
} > "$TMP"
osascript -l JavaScript "$TMP" 2>&1
rc=$?
rm -f "$TMP"
exit $rc
