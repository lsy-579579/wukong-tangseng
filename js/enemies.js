// 敌人：双方同时受波，沿各自 S 形小路行进，抵达守将扣一颗红心
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C;

  var E = {};

  E.reset = function () {
    var G = ZY.G;
    G.enemies = [];        // 双方共用列表，e.side 标记
    G.wave = 0;
    G.waveState = 'idle';  // idle | spawning | fighting | cleared
    G.spawnQueue = [];
    G.spawnTimer = 0;
    G.restTimer = 5;
  };

  function buildWave(w) {
    var q = [];
    function add(type, n) { for (var i = 0; i < n; i++) q.push(type); }
    add('zei', 4 + Math.min(w * 2, 16));
    if (w >= 3) add('fei', Math.floor(w * 0.6));
    if (w >= 4) add('dao', Math.floor(w * 0.7));
    if (w >= 7) add('kou', Math.floor((w - 5) * 0.7));
    for (var i = q.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = q[i]; q[i] = q[j]; q[j] = t;
    }
    if (w % 5 === 0) q.push('boss');
    return q;
  }

  E.startNextWave = function () {
    var G = ZY.G;
    G.wave++;
    G.waveState = 'spawning';
    G.spawnQueue = buildWave(G.wave);
    G.spawnTimer = 0.5;
    if (G.wave % 4 === 0) ZY.sfx('boss');
  };

  function spawn(type, side) {
    var G = ZY.G, L = ZY.L;
    var base = C.ENEMIES[type];
    var hp = Math.round(base.hp * C.hpMul(G.wave));
    var pts = ZY.Map.pathPoints(side);
    G.enemies.push({
      side: side, type: type, ch: base.ch, boss: !!base.boss,
      hp: hp, maxHp: hp,
      spd: base.spd * L.cell,       // 格/秒 → px/秒
      mantou: base.mantou,
      size: base.size * L.cell,
      seg: 0, segT: 0,
      x: pts[0].x, y: pts[0].y,
      slowT: 0, stunT: 0, flashT: 0, dead: false
    });
  }

  E.update = function (dt) {
    var G = ZY.G;

    if (G.waveState === 'idle' || G.waveState === 'cleared') {
      G.restTimer -= dt;
      if (G.restTimer <= 0) {
        if (G.wave >= C.MAX_WAVE) { ZY.Main.matchEnd(); return; }
        E.startNextWave();
      }
    }

    if (G.waveState === 'spawning') {
      G.spawnTimer -= dt;
      if (G.spawnTimer <= 0 && G.spawnQueue.length) {
        var type = G.spawnQueue.shift();
        spawn(type, 'p');
        spawn(type, 'e');   // 双方同款敌人
        G.spawnTimer = Math.max(0.4, 1.5 - G.wave * 0.07);
      }
      if (!G.spawnQueue.length) G.waveState = 'fighting';
    }

    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dead) continue;
      if (e.flashT > 0) e.flashT -= dt;
      if (e.stunT > 0) { e.stunT -= dt; continue; }
      var spd = e.spd * (e.slowT > 0 ? 0.5 : 1);
      if (e.slowT > 0) e.slowT -= dt;

      var pts = ZY.Map.pathPoints(e.side);
      var move = spd * dt;
      while (move > 0 && e.seg < pts.length - 1) {
        var a = pts[e.seg], b = pts[e.seg + 1];
        var segLen = Math.hypot(b.x - a.x, b.y - a.y);
        var remain = (1 - e.segT) * segLen;
        if (move < remain) {
          e.segT += move / segLen;
          move = 0;
        } else {
          move -= remain;
          e.seg++;
          e.segT = 0;
        }
      }
      var p1 = pts[e.seg];
      var p2 = pts[Math.min(e.seg + 1, pts.length - 1)];
      e.x = p1.x + (p2.x - p1.x) * e.segT;
      e.y = p1.y + (p2.y - p1.y) * e.segT;

      // 抵达守将
      if (e.seg >= pts.length - 1) {
        e.dead = true;
        var S = e.side === 'p' ? G.p : G.e;
        S.hearts -= 1;
        S.shakeT = 0.5;
        if (e.side === 'p') ZY.sfx('hit');
        ZY.Battle.fx('ink', e.x, e.y);
      }
    }

    // 本帧全部结算后再判胜负，避免先处理的一侧吃亏
    if (G.p.hearts <= 0 || G.e.hearts <= 0) { ZY.Main.matchEnd(); return; }

    for (var k = G.enemies.length - 1; k >= 0; k--) {
      if (G.enemies[k].dead) G.enemies.splice(k, 1);
    }

    if (G.waveState === 'fighting' && !G.enemies.length) {
      G.waveState = 'cleared';
      var bonus = C.ECON.waveBonus(G.wave);
      G.p.mantou += bonus;
      G.e.mantou += bonus;
      G.restTimer = 5;
      ZY.UI.toast('第 ' + G.wave + ' 波告破 · 犒赏 ' + bonus + ' 馒头');
      ZY.sfx('coin');
    }
  };

  E.kill = function (e) {
    if (e.dead) return;
    e.dead = true;
    var G = ZY.G;
    var S = e.side === 'p' ? G.p : G.e;
    S.mantou += e.mantou;
    if (e.side === 'p') {
      G.kills = (G.kills || 0) + 1;
      ZY.Battle.fx('text', e.x, e.y - 30, '+' + e.mantou, '#7a6428');
    }
    ZY.Battle.fx('ink', e.x, e.y);
    // 领主击杀：玩家侧触发武器掉落
    if (e.boss && e.side === 'p' && ZY.Weapon) {
      var drop = ZY.Weapon.rollDrop();
      if (drop) {
        var w = C.WEAPON_MAP[drop.wid];
        var qCfg = C.WEAPON_QUALITY[w.quality];
        var msg = (drop.type === 'frag' ? '碎片·' : '') + w.name + '！';
        ZY.Battle.fx('text', e.x, e.y - 60, msg, qCfg.color);
        // 存入待结算列表，对局结束后再次提示
        G.drops = G.drops || [];
        G.drops.push({ wid: drop.wid, type: drop.type });
      }
    }
  };

  E.damage = function (e, dmg, opt) {
    if (e.dead) return;
    opt = opt || {};
    e.hp -= dmg;
    e.flashT = 0.1;
    if (opt.stun) e.stunT = Math.max(e.stunT, opt.stun);
    if (opt.slow) e.slowT = Math.max(e.slowT, opt.slow);
    if (e.hp <= 0) E.kill(e);
  };

  E.draw = function (ctx) {
    var G = ZY.G, R = ZY.R;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      ctx.save();
      if (e.flashT > 0) ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
      R.enemyTile(ctx, e.x, e.y - e.size * 0.18, e.size, e.ch, e.hp / e.maxHp, e.boss);
      if (e.stunT > 0) {
        R.font(ctx, 20, true);
        ctx.fillStyle = '#8a6d1f';
        ctx.textAlign = 'center';
        ctx.fillText('晕', e.x + e.size / 2, e.y - e.size * 0.75);
      }
      ctx.restore();
    }
  };

  ZY.Enemies = E;
})();
