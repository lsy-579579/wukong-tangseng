// 战斗：双方阵地单位自动攻击本侧敌人；弹道、武将技、特效
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, R = ZY.R;

  var BT = {};

  BT.reset = function () {
    var G = ZY.G;
    G.bullets = [];
    G.effects = [];
  };

  function auraMul(S) {
    for (var k in S.units) {
      if (S.units[k].kind === 'g' && S.units[k].name === '白龙') return 1.2;
    }
    return 1;
  }

  function enemiesOf(side) {
    var G = ZY.G, out = [];
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (!e.dead && e.side === side) out.push(e);
    }
    return out;
  }

  function nearest(list, x, y, range) {
    var best = null, bd = Infinity;
    for (var i = 0; i < list.length; i++) {
      var d = Math.hypot(list[i].x - x, list[i].y - y);
      if (d <= range && d < bd) { bd = d; best = list[i]; }
    }
    return best;
  }

  function mostAdvanced(list, x, y, range) {
    var best = null, bs = -1;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var d = Math.hypot(e.x - x, e.y - y);
      if (d > range) continue;
      var prog = e.seg + e.segT;
      if (prog > bs) { bs = prog; best = e; }
    }
    return best;
  }

  // 同步攻击动画到武将另一半（两字都显示攻击特效，但伤害只在 half=0 结算）
  function syncAttackT(S, u, t) {
    u.attackT = t;
    if (u.kind === 'g' && u.pairedKey && S.units[u.pairedKey]) {
      S.units[u.pairedKey].attackT = t;
    }
  }

  function updateSide(S, side, dt) {
    var L = ZY.L, G = ZY.G;
    var list = enemiesOf(side);
    var aura = auraMul(S);

    ZY.Board.eachUnit(S, function (u, c, r) {
      var st = ZY.unitStats(u);
      if (st.inert) return;
      // 武将半身：只让 half=0 发起攻击，避免双倍伤害；但 half=1 仍衰减攻击动画
      if (u.kind === 'g' && u.half != null && u.half !== 0) {
        if (u.attackT > 0) u.attackT -= dt;
        return;
      }
      if (u.attackT > 0) u.attackT -= dt; // 攻击变形动画计时
      u.cd -= dt;
      if (u.cd > 0) return;
      if (!list.length) { u.cd = 0.08; return; }
      var p = ZY.Map.cellCenter(c, r);
      var range = st.range * L.cell;
      var dmg = Math.round(st.dmg * aura);

      if (st.skill === 'stun') {
        var hitAny = false;
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          if (Math.hypot(e.x - p.x, e.y - p.y) <= range) {
            ZY.Enemies.damage(e, dmg, { stun: 1.0 });
            hitAny = true;
          }
        }
        if (hitAny) {
          u.cd = st.itv;
          syncAttackT(S, u, 0.35); // 触发文字变形（两字同步）
          BT.fx('roar', p.x, p.y);
          if (side === 'p') ZY.sfx('shoot');
        } else u.cd = 0.08;
        return;
      }

      if (st.skill === 'pierce') {
        var t0 = mostAdvanced(list, p.x, p.y, range);
        if (!t0) { u.cd = 0.08; return; }
        u.cd = st.itv;
        syncAttackT(S, u, 0.35); // 触发文字变形（两字同步）
        // 贯穿：目标连线上的敌人全部命中
        var ang = Math.atan2(t0.y - p.y, t0.x - p.x);
        BT.fx('lance', p.x, p.y, ang, range);
        if (side === 'p') ZY.sfx('shoot');
        for (var j = 0; j < list.length; j++) {
          var e2 = list[j];
          var d2 = Math.hypot(e2.x - p.x, e2.y - p.y);
          if (d2 > range) continue;
          var a2 = Math.atan2(e2.y - p.y, e2.x - p.x);
          var diff = Math.abs(((a2 - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff < 0.22) { ZY.Enemies.damage(e2, dmg); BT.fx('slash', e2.x, e2.y); }
        }
        return;
      }

      var target = mostAdvanced(list, p.x, p.y, range);
      if (!target) { u.cd = 0.08; return; }
      u.cd = st.itv;
      syncAttackT(S, u, 0.35); // 触发文字变形（两字同步）
      var exec = st.skill === 'execute' && !target.boss && target.hp / target.maxHp < 0.35;
      G.bullets.push({
        x: p.x, y: p.y - L.cell * 0.2,
        target: target,
        spd: (st.skill === 'snipe' ? 16 : 11) * L.cell,
        dmg: exec ? target.hp + 1 : dmg,
        exec: exec,
        arrow: u.kind === 's' && u.ch === '弓' || st.skill === 'snipe',
        gold: u.kind === 'g',
        shape: u.kind === 's' ? u.ch : (st.skill === 'snipe' ? '弓' : null)
      });
      if (side === 'p') ZY.sfx('shoot');
    });
  }

  BT.update = function (dt) {
    var G = ZY.G;
    updateSide(G.p, 'p', dt);
    updateSide(G.e, 'e', dt);

    for (var b = G.bullets.length - 1; b >= 0; b--) {
      var bl = G.bullets[b];
      if (bl.target.dead) { G.bullets.splice(b, 1); continue; }
      var dx = bl.target.x - bl.x, dy = bl.target.y - bl.y;
      var d = Math.hypot(dx, dy);
      var step = bl.spd * dt;
      if (d <= step) {
        ZY.Enemies.damage(bl.target, bl.dmg);
        BT.fx('hit', bl.target.x, bl.target.y);
        if (bl.exec) BT.fx('text', bl.target.x, bl.target.y - 40, '斩!', '#8a2a1e');
        G.bullets.splice(b, 1);
      } else {
        bl.ang = Math.atan2(dy, dx);
        bl.x += dx / d * step;
        bl.y += dy / d * step;
      }
    }

    for (var f = G.effects.length - 1; f >= 0; f--) {
      G.effects[f].t += dt;
      if (G.effects[f].t >= G.effects[f].dur) G.effects.splice(f, 1);
    }
  };

  BT.fx = function (type, x, y, a, b) {
    var dur = { ink: 0.45, hit: 0.22, text: 1.0, slash: 0.28, lance: 0.25, roar: 0.4, summon: 0.9 }[type] || 0.5;
    ZY.G.effects.push({ type: type, x: x, y: y, a: a, b: b, t: 0, dur: dur });
  };

  BT.draw = function (ctx) {
    var G = ZY.G;

    // 弹道（按兵种绘制不同武器造型）
    for (var i = 0; i < G.bullets.length; i++) {
      var bl = G.bullets[i];
      ctx.save();
      ctx.translate(bl.x, bl.y);
      ctx.rotate(bl.ang || 0);
      var sh = bl.shape, isGold = bl.gold;
      var metal = isGold ? '#b8860b' : '#3a3126';
      var blade = isGold ? '#e8c53a' : '#c8c8d0';
      if (sh === '刀') {
        // 小刀：刀身（弧形刃）+ 刀柄
        ctx.fillStyle = metal;
        ctx.fillRect(-9, -2, 6, 4); // 刀柄
        ctx.fillStyle = blade;
        ctx.beginPath();
        ctx.moveTo(-3, -2);
        ctx.lineTo(10, -3);
        ctx.quadraticCurveTo(13, 0, 10, 3);
        ctx.lineTo(-3, 2);
        ctx.closePath();
        ctx.fill();
      } else if (sh === '枪') {
        // 矛：长杆 + 矛头
        ctx.strokeStyle = metal;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-11, 0); ctx.lineTo(5, 0);
        ctx.stroke();
        ctx.fillStyle = blade;
        ctx.beginPath();
        ctx.moveTo(5, -3);
        ctx.lineTo(13, 0);
        ctx.lineTo(5, 3);
        ctx.closePath();
        ctx.fill();
      } else if (sh === '弓') {
        // 箭：细杆 + 箭头 + 羽尾
        ctx.strokeStyle = metal;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(7, 0);
        ctx.stroke();
        ctx.fillStyle = blade;
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4);
        ctx.closePath();
        ctx.fill();
        // 羽尾
        ctx.strokeStyle = '#8a6a10';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(-13, -3);
        ctx.moveTo(-10, 0); ctx.lineTo(-13, 3);
        ctx.stroke();
      } else if (sh === '骑') {
        // 剑：十字护手 + 直刃 + 剑柄
        ctx.fillStyle = metal;
        ctx.fillRect(-9, -2, 5, 4); // 剑柄
        ctx.fillRect(-5, -4, 2, 8); // 护手横档
        ctx.fillStyle = blade;
        ctx.beginPath();
        ctx.moveTo(-3, -2);
        ctx.lineTo(11, 0);
        ctx.lineTo(-3, 2);
        ctx.closePath();
        ctx.fill();
      } else {
        // 默认/武将：圆点
        ctx.fillStyle = isGold ? '#b8860b' : '#3a3126';
        ctx.beginPath();
        ctx.arc(0, 0, isGold ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 特效
    for (var f = 0; f < G.effects.length; f++) {
      var fx = G.effects[f];
      var k = fx.t / fx.dur;
      ctx.save();
      if (fx.type === 'ink') {
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.fillStyle = '#2b241a';
        for (var d = 0; d < 5; d++) {
          var ang = d * 1.256 + fx.x * 0.1;
          ctx.beginPath();
          ctx.arc(fx.x + Math.cos(ang) * 26 * k, fx.y + Math.sin(ang) * 26 * k, 7 * (1 - k) + 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fx.type === 'hit') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#b04a2e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 8 + 18 * k, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.type === 'text') {
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = fx.b || '#2b241a';
        R.font(ctx, 26, true);
        ctx.textAlign = 'center';
        ctx.fillText(fx.a, fx.x, fx.y - 36 * k);
      } else if (fx.type === 'slash') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#8a2a1e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(fx.x - 18 + 36 * k, fx.y - 18);
        ctx.lineTo(fx.x + 18 - 36 * k + 14, fx.y + 18);
        ctx.stroke();
      } else if (fx.type === 'lance') {
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.a);
        var grd = ctx.createLinearGradient(0, 0, fx.b, 0);
        grd.addColorStop(0, 'rgba(138,42,30,0.9)');
        grd.addColorStop(1, 'rgba(138,42,30,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, -5 * (1 - k) - 2, fx.b, 10 * (1 - k) + 4);
      } else if (fx.type === 'roar') {
        ctx.globalAlpha = 0.55 * (1 - k);
        ctx.strokeStyle = '#3a3126';
        ctx.lineWidth = 5 * (1 - k) + 1;
        for (var rr = 0; rr < 3; rr++) {
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, (40 + rr * 36) * k + 14, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (fx.type === 'summon') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#c9922e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 16 + 66 * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = (1 - k) * 0.3;
        ctx.fillStyle = '#e8c53a';
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 16 + 66 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  ZY.Battle = BT;
})();
