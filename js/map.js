// 地图：8列×10行，上半场为对手(AI)，下半场为玩家，中央山脊分隔
// 每侧一条 S 形土路：刷怪丛 → 蜿蜒小路 → 阿斗
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};

  var M = {};
  M.COLS = 8;
  M.ROWS = 10;

  // 玩家侧（下半场 5~9 行）：刷怪丛(0,9) → 沿9行向右 → 3列向上 → 沿7行向右 → 6列向下 → 阿斗(7,9)
  var P_PATH = [
    [0, 9], [1, 9], [2, 9], [3, 9],
    [3, 8], [3, 7],
    [4, 7], [5, 7], [6, 7],
    [6, 8], [6, 9],
    [7, 9]
  ];
  // 对手侧＝180°镜像
  var E_PATH = P_PATH.map(function (p) { return [M.COLS - 1 - p[0], M.ROWS - 1 - p[1]]; });

  // 玩家可建造白格（路旁空地）
  var P_BUILD = [
    [1, 8], [2, 8], [4, 8], [5, 8],
    [1, 6], [2, 6], [4, 6], [5, 6]
  ];
  var E_BUILD = P_BUILD.map(function (p) { return [M.COLS - 1 - p[0], M.ROWS - 1 - p[1]]; });

  function key(c, r) { return c + '_' + r; }

  M.pathOf = function (side) { return side === 'p' ? P_PATH : E_PATH; };
  M.buildOf = function (side) { return side === 'p' ? P_BUILD : E_BUILD; };
  M.spawnOf = function (side) { return M.pathOf(side)[0]; };
  M.adouOf = function (side) { return M.pathOf(side)[M.pathOf(side).length - 1]; };

  M.cellType = {}; // key -> 'path' | 'build_p' | 'build_e' | 'block'
  function markAll() {
    for (var c = 0; c < M.COLS; c++)
      for (var r = 0; r < M.ROWS; r++)
        M.cellType[key(c, r)] = 'block';
    P_PATH.concat(E_PATH).forEach(function (p) { M.cellType[key(p[0], p[1])] = 'path'; });
    P_BUILD.forEach(function (p) { M.cellType[key(p[0], p[1])] = 'build_p'; });
    E_BUILD.forEach(function (p) { M.cellType[key(p[0], p[1])] = 'build_e'; });
  }
  // 注意：markAll 在 config.js 加载后才执行，这里先注册一个延迟初始化
  M.ensureMarked = function () { if (!M._marked) { markAll(); M._marked = true; } };

  // 每局重置：重新标记所有格子（已铲开的 build_p 会变回 block）
  M.resetUnlockable = function () {
    M._marked = false;
    markAll();
    M._marked = true;
  };

  // 铲子解锁：将任意 block 格转为 build_<side>（所有绿色空地都可铲）
  M.unlockCell = function (c, r, side) {
    var k = key(c, r);
    if (M.cellType[k] !== 'block') return false;
    M.cellType[k] = 'build_' + side;
    return true;
  };
  // 是否可铲：block 格且在指定阵营半场（玩家下半场 / 对手上半场）
  M.isUnlockable = function (c, r, side) {
    if (M.cellType[key(c, r)] !== 'block') return false;
    return side === 'p' ? r >= M.ROWS / 2 : r < M.ROWS / 2;
  };

  // 像素坐标换算（依赖 ZY.L 布局，在 main.js 计算后可用）
  M.cellCenter = function (c, r) {
    var L = ZY.L;
    return {
      x: L.mapX + c * L.cell + L.cell / 2,
      y: L.mapY + r * L.cell + L.cell / 2
    };
  };

  M.cellAt = function (x, y) {
    var L = ZY.L;
    // 增加容差：格子边缘附近也判定为该格（避免"放到位了还判定返回"）
    var c = Math.floor((x - L.mapX) / L.cell);
    var r = Math.floor((y - L.mapY) / L.cell);
    if (c < 0 || c >= M.COLS || r < 0 || r >= M.ROWS) return null;
    return { c: c, r: r };
  };

  // 带容差的建造格判定：返回最近的 build 格（放宽容差，避免"放到位了还判定返回"）
  M.buildCellAt = function (x, y, side) {
    var L = ZY.L;
    var c = Math.floor((x - L.mapX) / L.cell);
    var r = Math.floor((y - L.mapY) / L.cell);
    // 检查当前格 + 8 邻域，找最近的 build 格
    var candidates = [
      [c,r],[c-1,r],[c+1,r],[c,r-1],[c,r+1],
      [c-1,r-1],[c+1,r-1],[c-1,r+1],[c+1,r+1]
    ];
    var best = null, bestDist = Infinity;
    var tolerance = L.cell * 0.7; // 宽松容差半径
    for (var i = 0; i < candidates.length; i++) {
      var cc = candidates[i][0], rr = candidates[i][1];
      var k = cc + '_' + rr;
      if (M.cellType[k] !== 'build_' + side) continue;
      var center = M.cellCenter(cc, rr);
      var d = Math.hypot(x - center.x, y - center.y);
      if (d < tolerance && d < bestDist) {
        best = { c: cc, r: rr };
        bestDist = d;
      }
    }
    return best;
  };

  // 路径像素点序列（供敌人行进插值）
  M.pathPoints = function (side) {
    return M.pathOf(side).map(function (p) { return M.cellCenter(p[0], p[1]); });
  };

  ZY.Map = M;
})();
