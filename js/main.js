// 主循环、布局、地图绘制、场景状态机
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var A = ZY.adapter, C = ZY.C, R = ZY.R;

  var Main = {};
  ZY.Main = Main;

  // ---- 布局（按屏幕高度自适应格子大小，避免底部按钮被裁切）----
  function layout() {
    var DW = A.DW, DH = A.DH;
    var topBar = 128;
    var benchSlot = 92, benchGap = 10;
    var btnH = 96;
    var bottomH = benchSlot + btnH + 50;
    var availH = DH - topBar - bottomH;
    var cellByH = Math.floor(availH / ZY.Map.ROWS);
    var cellByW = Math.floor((DW - 24) / ZY.Map.COLS);
    var cell = Math.min(78, cellByH, cellByW);
    if (cell < 52) cell = 52;

    var mapW = cell * ZY.Map.COLS;
    var mapH = cell * ZY.Map.ROWS;
    var mapY = topBar;
    var benchW = benchSlot * C.ECON.benchSize + benchGap * (C.ECON.benchSize - 1);
    ZY.L = {
      cell: cell,
      mapX: (DW - mapW) / 2, mapY: mapY, mapW: mapW, mapH: mapH,
      benchSlot: benchSlot, benchGap: benchGap,
      benchX: (DW - benchW) / 2 + 34,
      benchY: mapY + mapH + 66,
      btnY: mapY + mapH + 130,
      topBar: topBar
    };
  }
  ZY.onResize = layout;

  // ---- 对局 ----
  function newGame() {
    layout();
    ZY.G = {
      scene: 'play',
      time: 0,
      kills: 0,
      coinReward: 0,
      p: ZY.Board.newSide(),
      e: ZY.Board.newSide(),
      win: false
    };
    ZY.Board.reset();
    ZY.Enemies.reset();
    ZY.Battle.reset();
    ZY.AI.reset();
    // 开局各送两个兵到备战席
    ZY.G.p.bench[0] = ZY.Board.makeSoldier('刀', 1);
    ZY.G.p.bench[1] = ZY.Board.makeSoldier('弓', 1);
    ZY.G.e.bench[0] = ZY.Board.makeSoldier('刀', 1);
    ZY.G.e.bench[1] = ZY.Board.makeSoldier('弓', 1);
    ZY.UI.toast('把字牌拖上白色空地布阵！');
  }
  Main.newGame = newGame;

  Main.matchEnd = function () {
    var G = ZY.G;
    if (G.scene === 'over') return;
    var win;
    if (G.e.hearts <= 0 && G.p.hearts > 0) win = true;
    else if (G.p.hearts <= 0 && G.e.hearts > 0) win = false;
    else win = G.p.hearts >= G.e.hearts; // 同归于尽或撑满波数时比红心，平局判玩家险胜
    G.scene = 'over';
    G.win = win;
    G.coinReward = (win ? 10 : 3) + G.wave;
    G.rankPromote = null;
    if (win) {
      var p = ZY.Rank.promoteOnWin();
      G.rankPromote = p;
      var best = parseInt(A.storageGet('zy_best') || '0', 10);
      if (G.wave > best) A.storageSet('zy_best', String(G.wave));
    }
    var coin = parseInt(A.storageGet('zy_coin') || '0', 10);
    A.storageSet('zy_coin', String(coin + G.coinReward));
    ZY.sfx(win ? 'win' : 'lose');
  };

  // ---- 地图绘制 ----
  function drawMap(ctx) {
    var L = ZY.L, Map = ZY.Map;
    // 深棕外框
    ctx.save();
    ctx.fillStyle = '#4a392b';
    R.roundRect(ctx, L.mapX - 12, L.mapY - 12, L.mapW + 24, L.mapH + 24, 14);
    ctx.fill();
    ctx.restore();

    for (var r = 0; r < Map.ROWS; r++) {
      for (var c = 0; c < Map.COLS; c++) {
        var x = L.mapX + c * L.cell, y = L.mapY + r * L.cell;
        var t = Map.cellType[c + '_' + r];
        var seed = c * 31 + r * 17 + 5;
        if (t === 'path') {
          R.tilePath(ctx, x, y, L.cell, seed);
        } else {
          R.tileGreen(ctx, x, y, L.cell, seed);
          if (t === 'build_p' || t === 'build_e') R.tileWhite(ctx, x, y, L.cell);
        }
      }
    }

    // 中线山脊
    var midY = L.mapY + L.cell * 5;
    R.pathStones(ctx, L.mapX, midY, L.mapX + L.mapW, midY);

    // 路缘石（路与非路的横向交界）
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (var r2 = 0; r2 < Map.ROWS; r2++) {
      for (var c2 = 0; c2 < Map.COLS; c2++) {
        var t2 = Map.cellType[c2 + '_' + r2];
        if (t2 !== 'path') continue;
        var up = r2 > 0 ? Map.cellType[c2 + '_' + (r2 - 1)] : 'path';
        var x2 = L.mapX + c2 * L.cell, y2 = L.mapY + r2 * L.cell;
        if (up !== 'path') R.pathStones(ctx, x2, y2, x2 + L.cell, y2);
      }
    }
    ctx.restore();

    // 刷怪丛与阿斗
    var G = ZY.G;
    ['p', 'e'].forEach(function (side) {
      var sp = Map.spawnOf(side), ad = Map.adouOf(side);
      var spc = Map.cellCenter(sp[0], sp[1]);
      R.bush(ctx, spc.x, spc.y, L.cell * 0.9);
      var adc = Map.cellCenter(ad[0], ad[1]);
      var S = side === 'p' ? G.p : G.e;
      if (S.shakeT > 0) S.shakeT -= 1 / 60;
      R.adou(ctx, adc.x, adc.y, L.cell * 0.82, S.hearts, C.ECON.hearts, S.shakeT > 0);
    });
  }

  function drawUnits(ctx) {
    var G = ZY.G, L = ZY.L;
    var d = ZY.Board.dragging();
    ['p', 'e'].forEach(function (side) {
      var S = side === 'p' ? G.p : G.e;
      ZY.Board.eachUnit(S, function (u, c, r, k) {
        var p = ZY.Map.cellCenter(c, r);
        var isDragSrc = d && side === 'p' && d.from.type === 'cell' && d.from.key === k;
        ZY.Board.drawUnit(ctx, u, p.x, p.y, L.cell - 12, isDragSrc ? 0.3 : 1);
      });
    });
  }

  function drawPlay(ctx) {
    R.paper(ctx, A.DW, A.DH);
    drawMap(ctx);
    drawUnits(ctx);
    ZY.Enemies.draw(ctx);
    ZY.Battle.draw(ctx);
    ZY.UI.drawHUD(ctx);
  }

  // ---- 输入 ----
  function onDown(x, y) {
    var G = ZY.G, ub = ZY.UI.buttons;
    if (!G || G.scene === 'start') {
      if (R.inside(ub.start, x, y)) { ZY.sfx('click'); newGame(); }
      return;
    }
    if (G.scene === 'over') {
      if (R.inside(ub.again, x, y)) { ZY.sfx('click'); newGame(); }
      else if (R.inside(ub.claim, x, y)) { ZY.sfx('click'); ZY.G = null; }
      return;
    }
    if (G.scene === 'pause') {
      if (R.inside(ub.resume, x, y)) { ZY.sfx('click'); G.scene = 'play'; }
      return;
    }
    if (R.inside(ub.pause, x, y)) { ZY.sfx('click'); G.scene = 'pause'; return; }
    if (R.inside(ub.sound, x, y)) { ZY.sfxToggle(); return; }
    if (ub.recruit && R.inside(ub.recruit, x, y)) { ZY.sfx('click'); ZY.Board.recruit(G.p, true); return; }
    ZY.Board.onDown(x, y);
  }

  function onMove(x, y) {
    var G = ZY.G;
    if (G && G.scene === 'play') ZY.Board.onMove(x, y);
  }

  function onUp(x, y) {
    var G = ZY.G;
    if (G && G.scene === 'play') ZY.Board.onUp(x, y);
  }

  A.on('down', onDown);
  A.on('move', onMove);
  A.on('up', onUp);

  // ---- 挂机调试（?bot=1）----
  var botOn = (typeof location !== 'undefined' && /bot=1/.test(location.search));
  var botT = 0;
  function botTick(dt) {
    var G = ZY.G;
    var ub = ZY.UI.buttons;
    if (!G) { if (ub.start) onDown(ub.start.x + 5, ub.start.y + 5); return; }
    if (G.scene === 'over') { if (ub.again) onDown(ub.again.x + 5, ub.again.y + 5); return; }
    if (G.scene !== 'play') return;
    botT += dt;
    if (botT < 0.5) return;
    botT = 0;
    ZY.AI.step(G.p, 'p');
  }

  // ---- 主循环 ----
  var lastT = 0;
  function frame(now) {
    if (!lastT) lastT = now;
    var dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    var G = ZY.G;
    var ctx = A.ctx;
    if (ctx) {
      if (botOn) botTick(dt);
      if (G && G.scene === 'play') {
        G.time += dt;
        ZY.Enemies.update(dt);
        if (ZY.G && ZY.G.scene === 'play') {
          ZY.Battle.update(dt);
          ZY.AI.update(dt);
        }
        ZY.UI.update(dt);
        drawPlay(ctx);
      } else if (G && G.scene === 'pause') {
        drawPlay(ctx);
        ZY.UI.drawPause(ctx);
      } else if (G && G.scene === 'over') {
        ZY.UI.update(dt);
        ZY.UI.drawOver(ctx, G.win);
      } else {
        ZY.UI.update(dt);
        ZY.UI.drawStart(ctx);
      }
    }
    A.raf(frame);
  }

  layout();
  ZY.G = null;
  if (A.hasScreen) A.raf(frame);
})();
