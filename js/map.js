// 地图：8列×10行，上半场为对手(AI)，下半场为玩家，中央山脊分隔
// 5 种地图布局，每局随机调用一种；每张图玩家侧 S 形土路 + 镜像对手侧
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};

  var M = {};
  M.COLS = 8;
  M.ROWS = 10;

  // ---- 5 种地图布局（玩家侧路径 + 建造格），对手侧 = 180° 镜像 ----
  // 路径必须从底行走到 (7,9) 阿斗格；建造格在路旁空地
  var LAYOUTS = [
    {
      name: '火焰山',
      pPath: [
        [0, 9], [1, 9], [2, 9], [3, 9],
        [3, 8], [3, 7],
        [4, 7], [5, 7], [6, 7],
        [6, 8], [6, 9],
        [7, 9]
      ],
      pBuild: [
        [1, 8], [2, 8], [4, 8], [5, 8],
        [1, 6], [2, 6], [4, 6], [5, 6]
      ]
    },
    {
      name: '流沙河',
      // 蛇形双拐：底行→上行→中行→下行→阿斗
      pPath: [
        [0, 9], [1, 9], [2, 9], [3, 9], [4, 9], [5, 9],
        [5, 8], [5, 7],
        [4, 7], [3, 7], [2, 7], [1, 7],
        [1, 8], [1, 9],
        [2, 9], [3, 9], [4, 9], [5, 9],
        [6, 9], [7, 9]
      ],
      pBuild: [
        [0, 8], [6, 8], [7, 8],
        [0, 6], [2, 6], [3, 6], [4, 6], [6, 6], [7, 6]
      ]
    },
    {
      name: '盘丝洞',
      // 双 U 形回环：底行→上拐→中行→下拐→中行→上拐→阿斗
      pPath: [
        [0, 9], [1, 9], [2, 9],
        [2, 8], [2, 7],
        [3, 7], [4, 7], [5, 7],
        [5, 8], [5, 9],
        [4, 9], [3, 9],
        [3, 8], [3, 7],
        [4, 7], [5, 7], [6, 7],
        [6, 8], [6, 9],
        [7, 9]
      ],
      pBuild: [
        [0, 8], [1, 8], [4, 8],
        [0, 6], [1, 6], [2, 6], [5, 6], [6, 6], [7, 6]
      ]
    },
    {
      name: '水帘洞',
      // 长直 L 形：底行长直→边列上行→顶中行→右列下行→阿斗
      pPath: [
        [0, 9], [1, 9], [2, 9], [3, 9], [4, 9], [5, 9], [6, 9],
        [6, 8], [6, 7],
        [5, 7], [4, 7], [3, 7], [2, 7], [1, 7], [0, 7],
        [0, 8], [0, 9],
        [1, 9], [2, 9], [3, 9], [4, 9], [5, 9], [6, 9],
        [7, 9]
      ],
      pBuild: [
        [7, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
        [7, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]
      ]
    },
    {
      name: '女儿国',
      // 简洁 Z 形：底行短→上→中行长→下→阿斗（建造格多，适合布阵）
      pPath: [
        [0, 9], [1, 9], [2, 9],
        [2, 8], [2, 7],
        [3, 7], [4, 7], [5, 7],
        [5, 8], [5, 9],
        [6, 9], [7, 9]
      ],
      pBuild: [
        [0, 8], [1, 8], [3, 8], [4, 8], [6, 8], [7, 8],
        [0, 6], [1, 6], [3, 6], [4, 6], [6, 6], [7, 6]
      ]
    }
  ];

  function mirrorPath(path) {
    return path.map(function (p) { return [M.COLS - 1 - p[0], M.ROWS - 1 - p[1]]; });
  }
  function mirrorBuild(build) {
    return build.map(function (p) { return [M.COLS - 1 - p[0], M.ROWS - 1 - p[1]]; });
  }

  // 当前局使用的地图（每局随机选一个）
  var curLayout = null;
  var P_PATH = null, E_PATH = null, P_BUILD = null, E_BUILD = null;

  function key(c, r) { return c + '_' + r; }

  // 选定本局地图：随机一个布局并计算镜像
  function pickRandom() {
    var idx = Math.floor(Math.random() * LAYOUTS.length);
    curLayout = LAYOUTS[idx];
    P_PATH = curLayout.pPath;
    E_PATH = mirrorPath(P_PATH);
    P_BUILD = curLayout.pBuild;
    E_BUILD = mirrorBuild(P_BUILD);
    // 更新关卡名供 UI 显示
    if (ZY.C) ZY.C.LEVEL_NAME = curLayout.name;
    M._marked = false;
  }
  // 默认选第一张，避免初始化前访问报错
  pickRandom();

  M.pathOf = function (side) { return side === 'p' ? P_PATH : E_PATH; };
  M.buildOf = function (side) { return side === 'p' ? P_BUILD : E_BUILD; };
  M.spawnOf = function (side) { return M.pathOf(side)[0]; };
  M.adouOf = function (side) { return M.pathOf(side)[M.pathOf(side).length - 1]; };
  M.curName = function () { return curLayout ? curLayout.name : LAYOUTS[0].name; };

  M.cellType = {}; // key -> 'path' | 'build_p' | 'build_e' | 'block'
  function markAll() {
    for (var c = 0; c < M.COLS; c++)
      for (var r = 0; r < M.ROWS; r++)
        M.cellType[key(c, r)] = 'block';
    P_PATH.concat(E_PATH).forEach(function (p) { M.cellType[key(p[0], p[1])] = 'path'; });
    P_BUILD.forEach(function (p) { M.cellType[key(p[0], p[1])] = 'build_p'; });
    E_BUILD.forEach(function (p) { M.cellType[key(p[0], p[1])] = 'build_e'; });
  }
  M.ensureMarked = function () { if (!M._marked) { markAll(); M._marked = true; } };

  // 每局重置：随机选新地图并重新标记
  M.resetUnlockable = function () {
    pickRandom();
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
    var c = Math.floor((x - L.mapX) / L.cell);
    var r = Math.floor((y - L.mapY) / L.cell);
    if (c < 0 || c >= M.COLS || r < 0 || r >= M.ROWS) return null;
    return { c: c, r: r };
  };

  // 带容差的建造格判定：返回最近的 build 格
  M.buildCellAt = function (x, y, side) {
    var L = ZY.L;
    var c = Math.floor((x - L.mapX) / L.cell);
    var r = Math.floor((y - L.mapY) / L.cell);
    var candidates = [
      [c,r],[c-1,r],[c+1,r],[c,r-1],[c,r+1],
      [c-1,r-1],[c+1,r-1],[c-1,r+1],[c+1,r+1]
    ];
    var best = null, bestDist = Infinity;
    var tolerance = L.cell * 0.7;
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
