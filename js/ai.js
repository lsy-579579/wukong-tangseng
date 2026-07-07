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
  // 难度曲线（数据驱动，二次曲线）：基于 11 段位×300 局扫描 + 敏感度探针(500~700 局)标定
  // 旧线性曲线(1.15→0.45 / 0.22→0.02)胜率过于平坦且非单调：rank0~rank10 仅 52%→48%，
  // rank7/8 甚至反超 rank0。新曲线加陡并校正锚点（玩家侧固定 thinkItv=0.8/missRate=0.10）：
  //   rank0  (r=0.00): thinkItv=1.75 missRate=0.43 → 实测玩家胜率~54%（新手友好，不劝退）
  //   rank5  (r=0.45): thinkItv=0.85 missRate=0.12 → ~47%（中段对等，1000局实测）
  //   rank10 (r=0.91): thinkItv=0.34 missRate=0.00 luck=1.00 → ~45%（高段有挑战，晋升有成就感）
  // thinkItv 设下限 0.34：探针实测低于此值 AI 思考过快会触发"过度征兵"——
  // AI.step 第5步征兵会清空整个备战席，thinkItv=0.32 时已配对碎片被反复冲掉，
  // 敌方反而变弱（玩家胜率从 45% 回升至 51%）。0.34 是实测的最强安全点。
  // luck 在高段位额外加成（ratio>0.8 时线性提升至 1.0）：探针实测 luck 从 0.91→1.0
  // 可使 rank10 玩家胜率从 49.5% 降至 ~45%。机制：newGame 中敌方初始手牌用 aiLuck
  // 抽卡（玩家初始手牌 luck=0），luck 越高敌方初始牌越好（铲子更少、碎片配对率更高），
  // 这一开局优势随对局累积放大。注：征兵时双方共享 curDiff.luck，但初始手牌的
  // 不对称才是 luck 影响胜率的主因。
  // 注：本游戏为"并行防守竞速"，双方各自防守自己的波次不直接交战，平局判玩家胜，
  // 因此 thinkItv/missRate 对胜率的影响被削弱，曲线跨度受此机制上限约束。
  AI.difficulty = function () {
    var prog = ZY.Rank.load();
    var C = ZY.C;
    var total = (C.RANKS.length * C.SUB_LEVELS_PER_RANK * C.STARS_PER_RANK);
    var cur = prog.rank * C.SUB_LEVELS_PER_RANK * C.STARS_PER_RANK
      + (prog.subLevel - 1) * C.STARS_PER_RANK
      + prog.stars;
    var ratio = Math.max(0, Math.min(1, cur / total));
    var r = ratio;
    var thinkItv = Math.max(0.34, 0.944 * r * r - 2.409 * r + 1.75);
    var missRate = Math.max(0, 0.460 * r * r - 0.891 * r + 0.43);
    var luck = Math.min(1, ratio + Math.max(0, ratio - 0.8));
    return {
      ratio: ratio,
      thinkItv: thinkItv,
      missRate: missRate,
      luck: luck
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
    // 修复死锁：原条件「备战席全空」几乎永不成立（碎片会留守）。
    // 新条件：席上无可用士兵/武将（只剩碎片/铲子/空位）且馒头足够时即征兵，
    // 让 AI 能持续补充战力、对局进入后期。
    var hasPlayable = false;
    for (var bi = 0; bi < S.bench.length; bi++) {
      var bu = S.bench[bi];
      if (bu && (bu.kind === 's' || bu.kind === 'g')) { hasPlayable = true; break; }
    }
    if (!hasPlayable && S.mantou >= B().recruitCost(S)) {
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
