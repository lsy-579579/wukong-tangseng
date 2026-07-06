// UI：开始界面（星级/开始游戏）、对局 HUD（馒头/波次/征兵/备战席）、胜负结算（乌云/卷轴）
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, R = ZY.R, A = ZY.adapter;

  var UI = {};
  var toasts = [];
  UI.buttons = {};

  UI.toast = function (text) {
    toasts.push({ text: text, t: 0, dur: 1.8 });
    if (toasts.length > 3) toasts.shift();
  };

  UI.update = function (dt) {
    for (var i = toasts.length - 1; i >= 0; i--) {
      toasts[i].t += dt;
      if (toasts[i].t >= toasts[i].dur) toasts.splice(i, 1);
    }
  };

  function drawToasts(ctx) {
    var DW = A.DW;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < toasts.length; i++) {
      var t = toasts[i];
      var alpha = t.t < 0.2 ? t.t / 0.2 : t.t > t.dur - 0.4 ? (t.dur - t.t) / 0.4 : 1;
      ctx.globalAlpha = alpha * 0.95;
      R.font(ctx, 30, true);
      var w = ctx.measureText(t.text).width + 50;
      var y = 300 + i * 56;
      ctx.fillStyle = 'rgba(160,60,40,0.92)';
      R.roundRect(ctx, DW / 2 - w / 2, y - 26, w, 52, 10);
      ctx.fill();
      ctx.fillStyle = '#f7f0dc';
      ctx.fillText(t.text, DW / 2, y + 1);
    }
    ctx.restore();
  }

  // ---- 开始界面 ----
  UI.drawStart = function (ctx) {
    var DW = A.DW, DH = A.DH;
    R.paper(ctx, DW, DH);

    // 顶部：头像框 + 刀币
    ctx.save();
    ctx.fillStyle = '#efe9d8';
    R.roundRect(ctx, 36, 30, 84, 84, 10);
    ctx.fill();
    ctx.strokeStyle = '#3a3126';
    ctx.lineWidth = 4;
    R.roundRect(ctx, 36, 30, 84, 84, 10);
    ctx.stroke();
    R.font(ctx, 44, true);
    ctx.fillStyle = '#5a4a34';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('云', 78, 74);
    // 刀币胶囊
    ctx.fillStyle = 'rgba(50,40,28,0.85)';
    R.roundRect(ctx, 140, 44, 240, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#e8c53a';
    ctx.beginPath(); ctx.arc(172, 70, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6a10';
    R.font(ctx, 22, true);
    ctx.fillText('刀', 172, 71);
    ctx.fillStyle = '#f2ead2';
    R.font(ctx, 30, true);
    ctx.fillText(String(A.storageGet('zy_coin') || 0), 270, 71);
    ctx.restore();

    // 标题
    ctx.save();
    R.font(ctx, 96, true);
    ctx.fillStyle = '#a8402c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(60,20,10,0.35)';
    ctx.lineWidth = 3;
    ctx.fillText('悟空与唐僧', DW / 2, DH * 0.20);
    ctx.strokeText('悟空与唐僧', DW / 2, DH * 0.20);
    // 段位
    R.font(ctx, 34, true);
    ctx.fillStyle = '#3a3126';
    var best = parseInt(A.storageGet('zy_best') || '0', 10);
    var rank = Math.min(5, 1 + Math.floor(best / 3));
    ctx.fillText('军士.' + '一二三四五'[rank - 1], DW / 2, DH * 0.20 + 78);
    // 星级
    for (var i = 0; i < 5; i++) {
      R.star(ctx, DW / 2 - 128 + i * 64, DH * 0.20 + 140, 26, i < rank);
    }
    ctx.restore();

    // 中央装饰阵盘
    ctx.save();
    var by = DH * 0.46, bw = 440, bh = 170;
    ctx.translate(DW / 2, by);
    ctx.transform(1, 0, -0.28, 0.82, 0, 0); // 透视斜切
    ctx.fillStyle = '#f2eee0';
    R.roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = '#3a3126';
    ctx.lineWidth = 5;
    R.roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 8);
    ctx.stroke();
    for (var gx = 1; gx < 4; gx++) {
      ctx.beginPath();
      ctx.moveTo(-bw / 2 + gx * bw / 4, -bh / 2);
      ctx.lineTo(-bw / 2 + gx * bw / 4, bh / 2);
      ctx.lineWidth = 2; ctx.stroke();
    }
    // 草垫
    ctx.strokeStyle = 'rgba(110,130,90,0.8)';
    ctx.lineWidth = 3;
    for (var g2 = 0; g2 < 40; g2++) {
      var ga = g2 / 40 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ga) * (bw / 2 + 8), Math.sin(ga) * (bh / 2 + 8));
      ctx.lineTo(Math.cos(ga) * (bw / 2 + 26), Math.sin(ga) * (bh / 2 + 20));
      ctx.stroke();
    }
    ctx.restore();
    R.adou(ctx, DW / 2, by - 26, 92, 3, 3, false);
    // 长枪斜插 + 赵云题字
    ctx.save();
    ctx.strokeStyle = '#4a3426';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(DW / 2 + 26, by - 96);
    ctx.lineTo(DW / 2 - 60, by + 108);
    ctx.stroke();
    ctx.fillStyle = '#b8b4ac';
    ctx.beginPath();
    ctx.moveTo(DW / 2 + 26, by - 96);
    ctx.lineTo(DW / 2 + 44, by - 128);
    ctx.lineTo(DW / 2 + 8, by - 112);
    ctx.closePath(); ctx.fill();
    R.font(ctx, 64, true);
    ctx.fillStyle = '#a8402c';
    ctx.textAlign = 'center';
    ctx.fillText('赵云', DW / 2 - 110, by + 96);
    ctx.restore();

    // 开始按钮
    UI.buttons.start = { x: DW / 2 - 190, y: DH * 0.68, w: 380, h: 108, label: '开始游戏 ⚡', fs: 44 };
    R.redButton(ctx, UI.buttons.start);
    // 交叉双剑装饰
    ctx.save();
    ctx.translate(DW / 2, DH * 0.68 - 34);
    R.font(ctx, 52, false);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5a6a78';
    ctx.fillText('⚔', 0, 0);
    ctx.restore();

    if (best > 0) {
      ctx.save();
      R.font(ctx, 26, false);
      ctx.fillStyle = '#6a5c42';
      ctx.textAlign = 'center';
      ctx.fillText('最佳战绩：第 ' + best + ' 波', DW / 2, DH * 0.68 + 150);
      ctx.restore();
    }
    drawToasts(ctx);
  };

  // ---- 对局 HUD ----
  UI.drawHUD = function (ctx) {
    var G = ZY.G, L = ZY.L, DW = A.DW;

    // 暂停墨团
    ctx.save();
    ctx.fillStyle = 'rgba(40,34,26,0.9)';
    ctx.beginPath();
    ctx.ellipse(66, 48, 34, 26, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ead2';
    ctx.fillRect(56, 36, 7, 24);
    ctx.fillRect(70, 36, 7, 24);
    ctx.restore();
    UI.buttons.pause = { x: 30, y: 20, w: 74, h: 58 };

    // 馒头计数
    ctx.save();
    ctx.strokeStyle = 'rgba(40,34,26,0.9)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(44, 100);
    ctx.quadraticCurveTo(110, 92, 190, 100);
    ctx.stroke();
    R.bun(ctx, 70, 96, 22);
    R.font(ctx, 34, true);
    ctx.fillStyle = '#28221a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(G.p.mantou), 104, 98);
    ctx.restore();

    // 关卡名 + 波次
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    R.font(ctx, 44, true);
    ctx.fillStyle = '#8a3a28';
    ctx.fillText(C.LEVEL_NAME, DW / 2, 44);
    ctx.fillStyle = 'rgba(40,34,26,0.88)';
    R.roundRect(ctx, DW / 2 - 66, 66, 132, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#f2ead2';
    R.font(ctx, 26, true);
    ctx.fillText('第' + Math.max(1, G.wave) + '波', DW / 2, 87);
    ctx.restore();

    // 音效开关
    ctx.save();
    R.font(ctx, 30, true);
    ctx.fillStyle = 'rgba(40,34,26,0.8)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ZY.sfxEnabled() ? '♪' : '×', DW - 46, 46);
    ctx.restore();
    UI.buttons.sound = { x: DW - 76, y: 20, w: 60, h: 52 };

    // 波次间隔提示
    if (G.waveState === 'idle' || G.waveState === 'cleared') {
      ctx.save();
      R.font(ctx, 28, true);
      ctx.fillStyle = 'rgba(90,50,36,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('敌军将至 ' + Math.max(0, G.restTimer).toFixed(1) + 's', DW / 2, L.mapY + L.cell * 5);
      ctx.restore();
    }

    // 备战席
    ctx.save();
    R.hut(ctx, L.benchX - 62, L.benchY + 6, 74);
    for (var i = 0; i < C.ECON.benchSize; i++) {
      var p = ZY.Board.benchSlotCenter(i);
      ctx.fillStyle = '#f4f0e4';
      R.roundRect(ctx, p.x - L.benchSlot / 2, p.y - L.benchSlot / 2, L.benchSlot, L.benchSlot, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(130,118,96,0.8)';
      ctx.lineWidth = 2;
      R.roundRect(ctx, p.x - L.benchSlot / 2, p.y - L.benchSlot / 2, L.benchSlot, L.benchSlot, 8);
      ctx.stroke();
      var u = G.p.bench[i];
      var dg = ZY.Board.dragging();
      if (u && !(dg && dg.from.type === 'bench' && dg.from.idx === i)) {
        ZY.Board.drawUnit(ctx, u, p.x, p.y, L.benchSlot - 10, 1);
      }
    }
    ctx.restore();

    // 征兵按钮
    var rb = UI.buttons.recruit = {
      x: DW / 2 - 140, y: L.btnY, w: 280, h: 96,
      label: '征兵', fs: 40, bun: ZY.Board.recruitCost(G.p)
    };
    rb.disabled = G.p.mantou < rb.bun || G.p.bench.indexOf(null) < 0;
    R.redButton(ctx, rb);

    drawToasts(ctx);

    // 拖拽幽灵
    var d = ZY.Board.dragging();
    if (d) {
      ZY.Board.drawUnit(ctx, d.unit, d.x, d.y - 40, L.cell + 10, 0.92);
      // 可放置格高亮
      var cell = ZY.Map.cellAt(d.x, d.y - 40) || ZY.Map.cellAt(d.x, d.y);
      if (cell) {
        var k = cell.c + '_' + cell.r;
        if (ZY.Map.cellType[k] === 'build_p') {
          var t = G.p.units[k];
          var ok = !t || ZY.Board.tryMerge(d.unit, t);
          var pc = ZY.Map.cellCenter(cell.c, cell.r);
          ctx.save();
          ctx.strokeStyle = ok ? '#c9922e' : 'rgba(160,60,40,0.8)';
          ctx.lineWidth = 4;
          R.roundRect(ctx, pc.x - L.cell / 2 + 2, pc.y - L.cell / 2 + 2, L.cell - 4, L.cell - 4, 8);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  };

  // ---- 结算 ----
  UI.drawOver = function (ctx, win) {
    var G = ZY.G, DW = A.DW, DH = A.DH;
    ctx.save();
    ctx.fillStyle = win ? 'rgba(214,205,182,0.96)' : 'rgba(176,186,196,0.96)';
    ctx.fillRect(0, 0, DW, DH);

    // 乌云/彩云横幅
    R.cloud(ctx, DW / 2, DH * 0.16, 340, 90, win ? '#b08a3e' : '#5a6068');
    R.font(ctx, 60, true);
    ctx.fillStyle = '#f5f0e2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(win ? '胜利' : '失败', DW / 2, DH * 0.16);

    // 卷轴 + 星级
    R.scroll(ctx, DW / 2, DH * 0.32, 400, 110);
    R.font(ctx, 30, true);
    ctx.fillStyle = '#e8dfc8';
    ctx.fillText('军士.一', DW / 2, DH * 0.32 - 26);
    for (var i = 0; i < 5; i++) {
      R.star(ctx, DW / 2 - 128 + i * 64, DH * 0.32 + 18, 24, i < (win ? G.p.hearts + 2 : 1));
    }

    // 阿斗与贼群
    var ay = DH * 0.5;
    ctx.fillStyle = 'rgba(200,200,205,0.6)';
    ctx.beginPath();
    ctx.ellipse(DW / 2, ay + 20, 220, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    R.adou(ctx, DW / 2, ay, 84, Math.max(0, G.p.hearts), C.ECON.hearts, !win);
    if (!win) {
      var zs = [[-150, -20], [-90, 40], [90, 40], [150, -16], [0, 66]];
      for (var z = 0; z < zs.length; z++) {
        R.mahjong(ctx, DW / 2 + zs[z][0], ay + zs[z][1], 52, '贼', {});
      }
    }

    // 战利品
    ctx.fillStyle = '#e8c53a';
    ctx.beginPath();
    ctx.arc(DW / 2 - 40, DH * 0.63, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a10';
    R.font(ctx, 24, true);
    ctx.fillText('刀', DW / 2 - 40, DH * 0.63 + 1);
    ctx.fillStyle = '#3a3126';
    R.font(ctx, 40, true);
    ctx.textAlign = 'left';
    ctx.fillText('X' + G.coinReward, DW / 2 - 4, DH * 0.63 + 2);
    ctx.restore();

    UI.buttons.again = { x: DW / 2 - 180, y: DH * 0.70, w: 360, h: 92, label: '再 战', fs: 38 };
    R.redButton(ctx, UI.buttons.again);
    UI.buttons.claim = { x: DW / 2 - 150, y: DH * 0.70 + 116, w: 300, h: 80, label: '领 取', fs: 32 };
    R.darkButton(ctx, UI.buttons.claim);
  };

  // ---- 暂停 ----
  UI.drawPause = function (ctx) {
    var DW = A.DW, DH = A.DH;
    ctx.save();
    ctx.fillStyle = 'rgba(30,26,20,0.6)';
    ctx.fillRect(0, 0, DW, DH);
    R.font(ctx, 56, true);
    ctx.fillStyle = '#f2ead2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂停中', DW / 2, DH * 0.4);
    ctx.restore();
    UI.buttons.resume = { x: DW / 2 - 160, y: DH * 0.5, w: 320, h: 96, label: '继续', fs: 40 };
    R.redButton(ctx, UI.buttons.resume);
  };

  ZY.UI = UI;
})();
