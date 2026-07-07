// AI 操作逻辑：对手侧自动运营；也供 ?bot=1 挂机调试驱动玩家侧
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};

  var AI = {};
  var thinkT = 0;

  // 基础难度参数（最低档）
  var THINK_ITV = 1.15;
  var MISS_RATE = 0.22;

  AI.reset = function () { thinkT = 2.0; };

  // 根据玩家段位计算 AI 难度：段位越高，AI 思考越快、失误越少、抽卡运气越好
  // ratio: 0~1，玩家整体进度占比
  AI.difficulty = function () {
    var prog = ZY.Rank.load();
    var C = ZY.C;
    var total = (C.RANKS.length * C.SUB_LEVELS_PER_RANK * C.STARS_PER_RANK);
    var cur = prog.rank * C.SUB_LEVELS_PER_RANK * C.STARS_PER_RANK
      + (prog.subLevel - 1) * C.STARS_PER_RANK
      + prog.stars;
    var ratio = Math.max(0, Math.min(1, cur / total));
    return {
      ratio: ratio,
      thinkItv: 1.15 - ratio * 0.70,   // 1.15 → 0.45
      missRate: 0.22 - ratio * 0.20,   // 0.22 → 0.02
      luck: ratio                       // 0 → 1
    };
  };
  var curDiff = { thinkItv: THINK_ITV, missRate: MISS_RATE, luck: 0 };

  function B() { return ZY.Board; }

  // 执行一步最优操作，返回是否有动作
  AI.step = function (S, side) {
    var cells = ZY.Map.buildOf(side);

    // 1. 席内碎片/同级配对合成
    for (var i = 0; i < S.bench.length; i++) {
      for (var j = 0; j < S.bench.length; j++) {
        if (i === j || !S.bench[i] || !S.bench[j]) continue;
        var m = B().tryMerge(S.bench[i], S.bench[j]);
        if (m) {
          S.bench[j] = m;
          S.bench[i] = null;
          if (side === 'p') {
            var bp = B().benchSlotCenter(j);
            ZY.Battle.fx(m.kind === 'g' ? 'summon' : 'ink', bp.x, bp.y);
          }
          return true;
        }
      }
    }

    // 2. 阵地互相合成
    var keys = Object.keys(S.units);
    for (var a = 0; a < keys.length; a++) {
      for (var b = 0; b < keys.length; b++) {
        if (a === b) continue;
        if (B().tryMerge(S.units[keys[a]], S.units[keys[b]])) {
          B().mergeOnBoard(S, side, keys[a], keys[b]);
          return true;
        }
      }
    }

    // 3. 席上单位合到阵地
    for (var i2 = 0; i2 < S.bench.length; i2++) {
      var u = S.bench[i2];
      if (!u) continue;
      for (var c = 0; c < cells.length; c++) {
        var k = cells[c][0] + '_' + cells[c][1];
        var t = S.units[k];
        if (t && B().tryMerge(u, t)) {
          B().placeFromBench(S, side, i2, cells[c][0], cells[c][1]);
          return true;
        }
      }
    }

    // 4. 士兵/武将上阵（碎片留席上等配对；席满时也硬放）
    //    铲子AI不会使用，直接丢弃避免遗留
    var emptyBench = 0;
    S.bench.forEach(function (x) { if (!x) emptyBench++; });
    for (var i3 = 0; i3 < S.bench.length; i3++) {
      var u2 = S.bench[i3];
      if (!u2) continue;
      if (u2.kind === 'shovel') { S.bench[i3] = null; continue; } // AI丢弃铲子
      if (u2.kind === 'f' && emptyBench > 1) continue;
      for (var c2 = 0; c2 < cells.length; c2++) {
        var k2 = cells[c2][0] + '_' + cells[c2][1];
        if (!S.units[k2]) {
          B().placeFromBench(S, side, i3, cells[c2][0], cells[c2][1]);
          return true;
        }
      }
    }

    // 5. 征兵（原版机制：替换整个备战席为5张新卡）
    // AI 仅在备战席为空时征兵，避免浪费已有单位
    var allEmpty = S.bench.every(function (x) { return !x; });
    if (allEmpty && S.mantou >= B().recruitCost(S)) {
      return B().recruit(S, false, curDiff.luck);
    }
    return false;
  };

  // 当前 AI 抽卡运气（供 newGame 初始手牌使用）
  AI.curLuck = function () { return AI.difficulty().luck; };

  AI.update = function (dt) {
    var G = ZY.G;
    curDiff = AI.difficulty();
    thinkT -= dt;
    if (thinkT > 0) return;
    thinkT = curDiff.thinkItv;
    if (Math.random() < curDiff.missRate) return;
    AI.step(G.e, 'e');
  };

  ZY.AI = AI;
})();
