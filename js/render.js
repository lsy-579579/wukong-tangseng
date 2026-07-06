// 渲染：原版风格——暖米色宣纸、青苔地砖、棕色土路、麻将牌字块、红心金冠阿斗
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var A = ZY.adapter;

  var R = {};
  var FONT = '"Kaiti SC", "STKaiti", "KaiTi", "SimKai", serif';
  R.FONT = FONT;
  R.font = function (ctx, size, bold) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT;
  };

  R.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // 伪随机（稳定装饰）
  function srand(seed) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  // ---- 页面背景：暖米色 + 水墨远山 + 飞鸟小鹿 ----
  var bgCache = null;
  R.paper = function (ctx, w, h) {
    if (!bgCache || bgCache.width !== Math.ceil(w) || bgCache._h !== Math.ceil(h)) {
      var c = A.createOffCanvas(Math.ceil(w), Math.ceil(h));
      if (!c) return;
      c._h = Math.ceil(h);
      var g = c.getContext('2d');
      var rnd = srand(7);
      g.fillStyle = '#ded3bd';
      g.fillRect(0, 0, w, h);
      // 纸纹
      g.globalAlpha = 0.06;
      for (var i = 0; i < 700; i++) {
        g.fillStyle = rnd() > 0.5 ? '#b8ab8f' : '#f4ecd9';
        g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 1 + rnd() * 2);
      }
      g.globalAlpha = 1;
      // 远山（顶部两层）
      mountains(g, w, 96, 60, 'rgba(120,116,100,0.35)', 3);
      mountains(g, w, 118, 42, 'rgba(150,144,124,0.28)', 5);
      // 底部山影
      g.save();
      g.translate(w, h);
      g.rotate(Math.PI);
      mountains(g, w, 60, 40, 'rgba(130,124,106,0.25)', 4);
      g.restore();
      // 飞鸟
      g.strokeStyle = 'rgba(60,55,45,0.55)';
      g.lineWidth = 2.5;
      bird(g, w * 0.28, 60, 10); bird(g, w * 0.36, 44, 8); bird(g, w * 0.62, 52, 9);
      // 墨点苔痕
      g.fillStyle = 'rgba(90,84,70,0.12)';
      for (var d = 0; d < 26; d++) {
        g.beginPath();
        g.arc(rnd() * w, rnd() * h, 2 + rnd() * 5, 0, Math.PI * 2);
        g.fill();
      }
      bgCache = c;
    }
    ctx.drawImage(bgCache, 0, 0, w, h);

    function mountains(g, w, baseY, amp, color, humps) {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, baseY);
      for (var x = 0; x <= w; x += 8) {
        g.lineTo(x, baseY - Math.abs(Math.sin(x / w * Math.PI * humps)) * amp - Math.sin(x * 0.05) * 6);
      }
      g.lineTo(w, 0); g.lineTo(0, 0);
      g.closePath(); g.fill();
    }
    function bird(g, x, y, s) {
      g.beginPath();
      g.moveTo(x - s, y);
      g.quadraticCurveTo(x - s / 2, y - s * 0.7, x, y);
      g.quadraticCurveTo(x + s / 2, y - s * 0.7, x + s, y);
      g.stroke();
    }
  };

  // ---- 地砖 ----
  R.tileGreen = function (ctx, x, y, s, seed) {
    var rnd = srand(seed);
    ctx.fillStyle = '#a3bfa8';
    ctx.fillRect(x, y, s, s);
    // 立体下边
    ctx.fillStyle = 'rgba(90,120,96,0.5)';
    ctx.fillRect(x, y + s - 4, s, 4);
    ctx.fillStyle = 'rgba(230,240,225,0.35)';
    ctx.fillRect(x, y, s, 2);
    // 苔斑
    ctx.fillStyle = 'rgba(120,150,120,0.35)';
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + rnd() * s, y + rnd() * s, 2 + rnd() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(80,100,84,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  };

  R.tilePath = function (ctx, x, y, s, seed) {
    var rnd = srand(seed);
    ctx.fillStyle = '#b6a28e';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = 'rgba(140,118,98,0.45)';
    ctx.fillRect(x, y + s - 3, s, 3);
    // 碎石点
    ctx.fillStyle = 'rgba(120,100,84,0.4)';
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + rnd() * s, y + rnd() * s, 1.5 + rnd() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  R.tileWhite = function (ctx, x, y, s) {
    ctx.fillStyle = '#f2eee2';
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    ctx.fillStyle = 'rgba(180,170,148,0.6)';
    ctx.fillRect(x + 2, y + s - 6, s - 4, 4);
    ctx.strokeStyle = 'rgba(150,140,120,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 2.5, y + 2.5, s - 5, s - 5);
  };

  // 路缘尖石
  R.pathStones = function (ctx, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.hypot(dx, dy);
    var n = Math.floor(len / 12);
    ctx.fillStyle = 'rgba(74,60,48,0.85)';
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var px = x1 + dx * t, py = y1 + dy * t;
      var h = 4 + ((i * 7) % 5);
      ctx.beginPath();
      ctx.moveTo(px - 5, py);
      ctx.lineTo(px, py - h);
      ctx.lineTo(px + 5, py);
      ctx.closePath();
      ctx.fill();
    }
  };

  // 刷怪丛：黑色荆棘丛 + 白花
  R.bush = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#3c3a38';
    for (var i = 0; i < 7; i++) {
      var ang = i / 7 * Math.PI * 2;
      var r = s * (0.28 + (i % 3) * 0.09);
      ctx.beginPath();
      ctx.ellipse(Math.cos(ang) * s * 0.18, Math.sin(ang) * s * 0.12, r, r * 0.7, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    // 尖刺
    ctx.strokeStyle = '#2c2a28';
    ctx.lineWidth = 2;
    for (var k = 0; k < 8; k++) {
      var a2 = k / 8 * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a2) * s * 0.3, Math.sin(a2) * s * 0.22);
      ctx.lineTo(Math.cos(a2) * s * 0.52, Math.sin(a2) * s * 0.4);
      ctx.stroke();
    }
    // 白花
    ctx.fillStyle = '#efe9da';
    for (var f = 0; f < 5; f++) {
      var fa = f / 5 * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(fa) * 4, -s * 0.25 + Math.sin(fa) * 4, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c9a94e';
    ctx.beginPath(); ctx.arc(0, -s * 0.25, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  // ---- 麻将牌字块 ----
  // opt: {lv, gold, small, alpha, flash, hl}
  R.mahjong = function (ctx, x, y, s, ch, opt) {
    opt = opt || {};
    ctx.save();
    ctx.globalAlpha = opt.alpha != null ? opt.alpha : 1;
    ctx.translate(x, y);
    var half = s / 2;
    var r = s * 0.14;
    // 底部厚度（立体感）
    ctx.fillStyle = '#b9ac92';
    R.roundRect(ctx, -half, -half + s * 0.06, s, s, r);
    ctx.fill();
    // 牌面
    ctx.fillStyle = opt.flash ? '#ffd9cc' : '#f7f3e8';
    R.roundRect(ctx, -half, -half, s, s * 0.94, r);
    ctx.fill();
    ctx.strokeStyle = opt.hl ? '#c9922e' : 'rgba(120,108,88,0.7)';
    ctx.lineWidth = opt.hl ? 3 : 1.5;
    R.roundRect(ctx, -half, -half, s, s * 0.94, r);
    ctx.stroke();
    // 字
    ctx.fillStyle = opt.gold ? '#b8860b' : '#28221a';
    R.font(ctx, s * 0.6, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, -s * 0.03);
    // 等级角标
    if (opt.lv && opt.lv > 0) {
      ctx.fillStyle = '#5a4a30';
      R.font(ctx, s * 0.24, true);
      ctx.textAlign = 'right';
      ctx.fillText(String(opt.lv), half - s * 0.08, -half + s * 0.18);
    }
    ctx.restore();
  };

  // 敌人小牌 + 血条
  R.enemyTile = function (ctx, x, y, s, ch, hpRatio, boss) {
    R.mahjong(ctx, x, y, s, ch, { gold: false });
    if (boss) {
      ctx.save();
      ctx.strokeStyle = '#8a2a1e';
      ctx.lineWidth = 3;
      R.roundRect(ctx, x - s / 2, y - s / 2, s, s * 0.94, s * 0.14);
      ctx.stroke();
      ctx.restore();
    }
    // 顶部红血条
    ctx.save();
    var bw = s * 0.94;
    ctx.fillStyle = 'rgba(40,30,24,0.75)';
    ctx.fillRect(x - bw / 2, y - s / 2 - 9, bw, 5);
    ctx.fillStyle = '#c23a2a';
    ctx.fillRect(x - bw / 2, y - s / 2 - 9, bw * Math.max(0, Math.min(1, hpRatio)), 5);
    ctx.restore();
  };

  // 红心
  R.heart = function (ctx, x, y, s, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.32);
    ctx.bezierCurveTo(-s * 0.6, -s * 0.15, -s * 0.28, -s * 0.55, 0, -s * 0.2);
    ctx.bezierCurveTo(s * 0.28, -s * 0.55, s * 0.6, -s * 0.15, 0, s * 0.32);
    ctx.closePath();
    ctx.fillStyle = filled ? '#c9302a' : 'rgba(90,80,70,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,24,0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  };

  // 金冠
  R.crown = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    ctx.moveTo(-s / 2, s * 0.28);
    ctx.lineTo(-s / 2, -s * 0.1);
    ctx.lineTo(-s * 0.24, s * 0.06);
    ctx.lineTo(0, -s * 0.32);
    ctx.lineTo(s * 0.24, s * 0.06);
    ctx.lineTo(s / 2, -s * 0.1);
    ctx.lineTo(s / 2, s * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a6a10';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#c9302a';
    ctx.beginPath(); ctx.arc(0, s * 0.05, s * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  // 阿斗：白牌「斗」+ 金冠 + 红心排
  R.adou = function (ctx, x, y, s, hearts, maxHearts, shake) {
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4);
    for (var i = 0; i < maxHearts; i++) {
      R.heart(ctx, x - (maxHearts - 1) * s * 0.19 + i * s * 0.38, y - s * 0.82, s * 0.3, i < hearts);
    }
    R.mahjong(ctx, x, y, s, '斗', {});
    R.crown(ctx, x, y - s * 0.52, s * 0.5);
    ctx.restore();
  };

  // 水墨光晕（武将/僧牌背后的墨晕，呼吸缩放）
  R.inkHalo = function (ctx, x, y, s, t, color) {
    ctx.save();
    ctx.translate(x, y);
    var pulse = 1 + Math.sin(t * 2.2) * 0.06; // 呼吸缩放
    var alpha = 0.22 + Math.sin(t * 2.2) * 0.06;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color || '#3a3126';
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    // 不规则墨晕轮廓
    var pts = 14;
    for (var i = 0; i <= pts; i++) {
      var a = i / pts * Math.PI * 2;
      var noise = 1 + Math.sin(a * 3 + t * 0.8) * 0.18 + Math.cos(a * 5 - t * 0.6) * 0.1;
      var rx = Math.cos(a) * s * 0.95 * noise;
      var ry = Math.sin(a) * s * 0.95 * noise;
      if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.filter = 'blur(4px)';
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
  };

  // 原版风格：会跳动的方块字（参考《赵云与阿斗》实机）
  // 特征：纯文字方块 + 浅色底 + 持续小幅度垂直弹跳（顶部停留短、底部挤压）
  // ch：单字或两字；kind：'general'(武将金色) | 'monk'(僧米白) | 'enemy'(敌人)
  R.livingTile = function (ctx, x, y, s, ch, kind, t) {
    ctx.save();
    // 弹跳周期 ~0.9 秒，使用 |sin| 模拟弹跳（顶部停留短，底部有挤压）
    var period = 0.9;
    var phase = (t % period) / period; // 0~1
    // 用 |sin| 让弹跳有"触地反弹"感：底部=0，顶部=1
    var bounce = Math.abs(Math.sin(phase * Math.PI));
    // 垂直位移：向上跳起 s*0.06
    var dy = -bounce * s * 0.06;
    // 触底挤压：接近底部时 y 方向轻微压扁
    var squash = 1 - (1 - bounce) * 0.08; // 底部压扁 8%
    var stretch = 1 + (1 - bounce) * 0.04; // 底部横向略拉伸（体积守恒）

    ctx.translate(x, y + dy);
    ctx.scale(stretch, squash);

    var half = s / 2;
    var r = s * 0.12;
    // 立体厚度（底部阴影）
    ctx.fillStyle = 'rgba(60,50,40,0.25)';
    R.roundRect(ctx, -half + 2, -half + s * 0.08 + 3, s, s, r);
    ctx.fill();
    // 牌面底色
    if (kind === 'general') {
      ctx.fillStyle = '#fbe9b8'; // 武将金底
    } else if (kind === 'monk') {
      ctx.fillStyle = '#f4ecd6'; // 僧米白底
    } else {
      ctx.fillStyle = '#f7f3e8'; // 默认米白
    }
    R.roundRect(ctx, -half, -half, s, s * 0.96, r);
    ctx.fill();
    // 细边
    ctx.strokeStyle = kind === 'general' ? '#b8860b' : 'rgba(120,108,88,0.6)';
    ctx.lineWidth = kind === 'general' ? 2 : 1.5;
    R.roundRect(ctx, -half, -half, s, s * 0.96, r);
    ctx.stroke();
    // 文字
    ctx.fillStyle = kind === 'general' ? '#7a2a1a' : '#28221a';
    if (ch.length === 1) {
      R.font(ctx, s * 0.58, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, -s * 0.02);
    } else {
      // 两字竖排
      R.font(ctx, s * 0.36, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch[0], 0, -s * 0.22);
      ctx.fillText(ch[1], 0, s * 0.22);
    }
    ctx.restore();
  };

  // 攻击瞬间文字变形化作兵器（原版核心视觉特色）
  // attackT: 攻击动画剩余时间（秒），从 0.35 衰减到 0
  // ch: 兵种字（刀/枪/弓/骑）或武将名
  // kind: 's' 兵种 | 'g' 武将
  R.morphTile = function (ctx, x, y, s, ch, kind, attackT) {
    if (!attackT || attackT <= 0) return false; // 无变形，调用方走默认渲染
    ctx.save();
    // 进度 0~1：0=刚触发，1=恢复
    var maxT = 0.35;
    var p = 1 - attackT / maxT; // 0→1
    // 变形曲线：前 30% 快速变形到武器形，70% 恢复
    var morph;
    if (p < 0.3) {
      morph = p / 0.3; // 0→1 快速变形
    } else {
      morph = 1 - (p - 0.3) / 0.7; // 1→0 缓慢恢复
    }
    morph = Math.max(0, Math.min(1, morph));
    // 旋转角度：变形时旋转 90°（文字立起变兵器）
    var rot = morph * Math.PI / 2 * 0.5; // 最多 45°
    // 缩放：变形时略微拉长（兵器形态）
    var scaleY = 1 + morph * 0.25;
    var scaleX = 1 - morph * 0.1;
    // 闪光透明度
    var flash = morph * 0.4;

    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scaleX, scaleY);
    ctx.globalAlpha = 1;

    // 金光描边（变形时的能量光）
    if (flash > 0.05) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12 * morph;
    }

    // 兵器形态：根据兵种画不同武器
    if (kind === 's') {
      var weaponColor = '#5a3a1a';
      var metalColor = '#c0c0c0';
      ctx.fillStyle = weaponColor;
      ctx.strokeStyle = '#2a1a0a';
      ctx.lineWidth = 1.5;
      if (ch === '刀') {
        // 刀：弧形刀刃
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, s * 0.35);
        ctx.quadraticCurveTo(s * 0.25, s * 0.1, s * 0.3, -s * 0.35);
        ctx.lineWidth = 6;
        ctx.strokeStyle = metalColor;
        ctx.stroke();
        // 刀柄
        ctx.strokeStyle = weaponColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, s * 0.35);
        ctx.lineTo(-s * 0.4, s * 0.45);
        ctx.stroke();
      } else if (ch === '枪') {
        // 枪：长杆 + 枪头
        ctx.strokeStyle = weaponColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.45);
        ctx.lineTo(0, -s * 0.2);
        ctx.stroke();
        // 枪头（三角）
        ctx.fillStyle = metalColor;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.4);
        ctx.lineTo(-s * 0.1, -s * 0.15);
        ctx.lineTo(s * 0.1, -s * 0.15);
        ctx.closePath();
        ctx.fill();
      } else if (ch === '弓') {
        // 弓：弧形
        ctx.strokeStyle = weaponColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.35, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
        // 弓弦
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s * 0.27, -s * 0.32);
        ctx.lineTo(s * 0.27, s * 0.32);
        ctx.stroke();
        // 箭
        ctx.strokeStyle = metalColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s * 0.27, 0);
        ctx.lineTo(-s * 0.2, 0);
        ctx.stroke();
      } else if (ch === '骑') {
        // 骑：长矛 + 马蹄（用交叉长矛表示）
        ctx.strokeStyle = weaponColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, s * 0.35);
        ctx.lineTo(s * 0.3, -s * 0.35);
        ctx.stroke();
        ctx.fillStyle = metalColor;
        ctx.beginPath();
        ctx.moveTo(s * 0.3, -s * 0.35);
        ctx.lineTo(s * 0.18, -s * 0.2);
        ctx.lineTo(s * 0.4, -s * 0.2);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'g') {
      // 武将攻击：金色光芒爆发
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      // 四芒星
      ctx.beginPath();
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2;
        var r = i % 2 === 0 ? s * 0.4 : s * 0.18;
        var px = Math.cos(a) * r;
        var py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // 变形期间叠加原文字（半透明，做"文字→兵器"过渡）
    if (morph > 0.3) {
      ctx.globalAlpha = (morph - 0.3) / 0.7 * 0.5;
      ctx.rotate(-rot);
      ctx.scale(1 / scaleX, 1 / scaleY);
      ctx.fillStyle = kind === 'g' ? '#7a2a1a' : '#28221a';
      if (ch.length === 1) {
        R.font(ctx, s * 0.5, true);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, 0, 0);
      } else {
        R.font(ctx, s * 0.3, true);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch[0], 0, -s * 0.2);
        ctx.fillText(ch[1], 0, s * 0.2);
      }
    }

    ctx.restore();
    return true; // 已渲染变形
  };

  // 僧（替代阿斗）：无框"僧"字 + 头顶金箍 + 红心 + 左右摆动躲避动画
  // pokeT: 戳刺相位（0~1），接近 0/1 时为戳下瞬间，0.5 为收回
  R.monk = function (ctx, x, y, s, hearts, maxHearts, shake, t, pokeT) {
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4);
    // 红心排
    for (var i = 0; i < maxHearts; i++) {
      R.heart(ctx, x - (maxHearts - 1) * s * 0.19 + i * s * 0.38, y - s * 0.82, s * 0.3, i < hearts);
    }
    // 左右摆动躲避：戳刺接近瞬间摆动幅度最大，收回时回正
    // pokeT: 0~1，0=刚戳下，0.5=收回，1=下次戳下
    // 用 sin 让中间过程平滑，戳下瞬间（0/1）摆动最大
    var pokePhase = pokeT != null ? pokeT : 0;
    // 戳刺力度曲线：在戳下点附近（pokePhase 接近 0 或 1）幅度大
    var pokeNear = Math.cos(pokePhase * Math.PI * 2); // 1=戳下，-1=收回最远
    var pokeForce = Math.max(0, pokeNear); // 只取戳下方向的力
    // 摆动方向：左右交替（每次戳刺换方向）
    var swingDir = Math.sin(t * 3) > 0 ? 1 : -1;
    var swing = pokeForce * 0.22 * swingDir; // 戳下时摆开 12°
    // 基础小幅度持续摆动（即便没戳也有微摆）
    swing += Math.sin(t * 4) * 0.04;
    // 小幅垂直跳动
    var bob = -Math.abs(Math.sin(t * 3.5)) * s * 0.03;

    ctx.translate(x, y + bob);
    ctx.rotate(swing);
    // 僧字阴影（轻微）
    ctx.fillStyle = 'rgba(60,50,40,0.22)';
    R.font(ctx, s * 0.82, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('僧', 3, s * 0.05 + 3);
    // 僧字主体（深棕色，加粗）
    ctx.fillStyle = '#3a2a1a';
    ctx.fillText('僧', 0, s * 0.02);
    ctx.restore();
    // 金箍（替代金冠）
    R.goldRing(ctx, x, y - s * 0.52, s * 0.5, t);
  };

  // 金箍棒（带戳刺动画）
  // x1,y1: 棒尾固定点；x2,y2: 棒头目标点；t: 时间；period: 戳刺周期（秒）
  R.staff = function (ctx, x1, y1, x2, y2, t, period) {
    period = period || 1.2;
    var phase = (t % period) / period; // 0~1
    // 戳刺曲线：用 ease-in-out 让棒头快速戳下后收回
    // 0~0.3: 戳下（棒头向目标点推进）；0.3~1: 收回
    var stab;
    if (phase < 0.3) {
      var p = phase / 0.3; // 0~1
      // ease-out：快速戳下
      stab = 1 - Math.pow(1 - p, 3);
    } else {
      var p2 = (phase - 0.3) / 0.7; // 0~1
      // ease-in-out：缓慢收回
      stab = 1 - (p2 < 0.5 ? 2 * p2 * p2 : 1 - Math.pow(-2 * p2 + 2, 2) / 2);
    }
    // 棒头实际位置：从收回位（距目标 0.35）戳到目标点
    var retractRatio = 0.35;
    var headX = x2 + (x1 - x2) * retractRatio * (1 - stab);
    var headY = y2 + (y1 - y2) * retractRatio * (1 - stab);

    ctx.save();
    // 棒身（金色，两端粗中间细的渐变感）
    var grad = ctx.createLinearGradient(x1, y1, headX, headY);
    grad.addColorStop(0, '#b8860b');
    grad.addColorStop(0.5, '#e8c53a');
    grad.addColorStop(1, '#d4a017');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(headX, headY);
    ctx.stroke();
    // 棒身中段花纹（金色螺旋纹）
    ctx.strokeStyle = 'rgba(138,106,16,0.7)';
    ctx.lineWidth = 2;
    for (var i = 1; i < 6; i++) {
      var r = i / 6;
      var fx = x1 + (headX - x1) * r;
      var fy = y1 + (headY - y1) * r;
      ctx.beginPath();
      ctx.arc(fx, fy, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 棒尾金箍（固定端，较大）
    ctx.fillStyle = '#e8c53a';
    ctx.strokeStyle = '#8a6a10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x1, y1, 11, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // 棒尾内圈
    ctx.fillStyle = '#b8860b';
    ctx.beginPath();
    ctx.arc(x1, y1, 6, 0, Math.PI * 2);
    ctx.fill();
    // 棒头金箍（戳刺端，更大更亮）
    ctx.fillStyle = '#fce58a';
    ctx.beginPath();
    ctx.arc(headX, headY, 13, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    ctx.arc(headX, headY, 7, 0, Math.PI * 2);
    ctx.fill();
    // 戳下瞬间（stab 接近 1）添加冲击波
    if (stab > 0.85) {
      var waveAlpha = (stab - 0.85) / 0.15 * 0.6;
      ctx.globalAlpha = waveAlpha;
      ctx.strokeStyle = '#fce58a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(headX, headY, 18 + (1 - stab) * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // 返回当前戳刺相位（0~1），供僧字摆动用
    return phase;
  };

  // 金箍（孙悟空头上的紧箍咒，带光泽）
  R.goldRing = function (ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y);
    // 金箍主体（椭圆环）
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 高光
    ctx.strokeStyle = '#fce58a';
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.02, s * 0.5, s * 0.18, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // 中央红宝石
    ctx.fillStyle = '#c9302a';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6a10';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  };

  // 馒头图标
  R.bun = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    // 墨迹托底
    ctx.fillStyle = 'rgba(40,34,26,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.22, s * 0.85, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5f0e2';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.52, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,140,120,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  };

  // 营帐图标（备战席）
  R.hut = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#4a3428';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.05);
    ctx.quadraticCurveTo(0, -s * 0.65, s * 0.55, -s * 0.05);
    ctx.lineTo(s * 0.42, s * 0.05);
    ctx.quadraticCurveTo(0, -s * 0.42, -s * 0.42, s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6a5138';
    ctx.fillRect(-s * 0.38, s * 0.02, s * 0.76, s * 0.4);
    ctx.fillStyle = '#f2eee2';
    R.font(ctx, s * 0.34, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('营', 0, s * 0.22);
    ctx.restore();
  };

  // 砖红大按钮（原版“征兵/开始游戏”样式）
  R.redButton = function (ctx, b, pressed) {
    ctx.save();
    ctx.globalAlpha = b.disabled ? 0.55 : 1;
    // 深色底座
    ctx.fillStyle = '#4a3226';
    R.roundRect(ctx, b.x, b.y + 6, b.w, b.h, 14);
    ctx.fill();
    // 红面
    ctx.fillStyle = pressed ? '#9a4432' : '#b5543c';
    R.roundRect(ctx, b.x, b.y, b.w, b.h - 4, 14);
    ctx.fill();
    ctx.strokeStyle = '#7a3826';
    ctx.lineWidth = 2.5;
    R.roundRect(ctx, b.x, b.y, b.w, b.h - 4, 14);
    ctx.stroke();
    ctx.fillStyle = '#f7f0e0';
    R.font(ctx, b.fs || 34, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var cy = b.y + (b.h - 4) / 2;
    if (b.bun != null) {
      ctx.fillText(b.label, b.x + b.w / 2, cy - 12);
      R.bun(ctx, b.x + b.w / 2 - 22, cy + 17, 13);
      R.font(ctx, 24, true);
      ctx.textAlign = 'left';
      ctx.fillText(String(b.bun), b.x + b.w / 2 - 6, cy + 17);
    } else {
      ctx.fillText(b.label, b.x + b.w / 2, cy + 1);
    }
    ctx.restore();
  };

  // 深灰按钮
  R.darkButton = function (ctx, b) {
    ctx.save();
    ctx.fillStyle = '#3f4348';
    R.roundRect(ctx, b.x, b.y + 5, b.w, b.h, 12);
    ctx.fill();
    ctx.fillStyle = '#565c63';
    R.roundRect(ctx, b.x, b.y, b.w, b.h - 3, 12);
    ctx.fill();
    ctx.fillStyle = '#f0ede4';
    R.font(ctx, b.fs || 30, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + (b.h - 3) / 2 + 1);
    ctx.restore();
  };

  // 星星
  R.star = function (ctx, x, y, s, lit) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      var a2 = a + Math.PI / 5;
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.lineTo(Math.cos(a2) * s * 0.45, Math.sin(a2) * s * 0.45);
    }
    ctx.closePath();
    ctx.fillStyle = lit ? '#e8c53a' : '#4a4a48';
    ctx.fill();
    ctx.strokeStyle = lit ? '#a8862a' : '#333330';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  };

  // 乌云横幅（结算）
  R.cloud = function (ctx, x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = color || '#5a6068';
    var n = 6;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var cx = x - w / 2 + t * w;
      var r = h * (0.42 + 0.22 * Math.sin(t * Math.PI * 2.5 + 1));
      ctx.beginPath();
      ctx.arc(cx, y + (i % 2 ? -h * 0.08 : h * 0.08), r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.1, w / 2, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // 黑卷轴
  R.scroll = function (ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#7a4a2a';
    R.roundRect(ctx, x - w / 2 - 18, y - h / 2 - 6, 22, h + 12, 8);
    ctx.fill();
    R.roundRect(ctx, x + w / 2 - 4, y - h / 2 - 6, 22, h + 12, 8);
    ctx.fill();
    ctx.fillStyle = '#23211e';
    R.roundRect(ctx, x - w / 2, y - h / 2, w, h, 6);
    ctx.fill();
    ctx.restore();
  };

  // 可解锁格（铲子目标）：灰色虚线 + 土块纹理，提示可挖
  R.tileUnlockable = function (ctx, x, y, s) {
    ctx.save();
    // 暗绿/灰底
    ctx.fillStyle = 'rgba(120,110,90,0.35)';
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    // 虚线边框（可挖提示）
    ctx.strokeStyle = 'rgba(90,70,40,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
    ctx.setLineDash([]);
    // 中央土块小图标
    ctx.fillStyle = 'rgba(110,80,45,0.55)';
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    // 小铲子图案（提示可用铲子）
    ctx.strokeStyle = 'rgba(80,55,25,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.42, y + s * 0.58);
    ctx.lineTo(x + s * 0.58, y + s * 0.42);
    ctx.stroke();
    ctx.restore();
  };

  // 铲子道具牌（与字牌同尺寸，棕色土底 + 铲子图案 + "铲"字）
  R.shovelTile = function (ctx, x, y, s, opt) {
    opt = opt || {};
    ctx.save();
    ctx.globalAlpha = opt.alpha != null ? opt.alpha : 1;
    ctx.translate(x, y);
    var half = s / 2;
    var r = s * 0.14;
    // 厚度
    ctx.fillStyle = '#a08560';
    R.roundRect(ctx, -half, -half + s * 0.06, s, s, r);
    ctx.fill();
    // 牌面（土黄底）
    ctx.fillStyle = opt.flash ? '#ffd9cc' : '#d9b978';
    R.roundRect(ctx, -half, -half, s, s * 0.94, r);
    ctx.fill();
    ctx.strokeStyle = opt.hl ? '#c9922e' : '#7a5a2a';
    ctx.lineWidth = opt.hl ? 3 : 1.5;
    R.roundRect(ctx, -half, -half, s, s * 0.94, r);
    ctx.stroke();
    // 铲子图案（木柄 + 金属铲头）
    var sc = s * 0.5;
    ctx.save();
    ctx.translate(0, -s * 0.04);
    // 木柄
    ctx.strokeStyle = '#6a4220';
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-sc * 0.35, sc * 0.5);
    ctx.lineTo(sc * 0.35, -sc * 0.3);
    ctx.stroke();
    // 铲头（金属梯形）
    ctx.fillStyle = '#c0c0c0';
    ctx.strokeStyle = '#6a6a6a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sc * 0.18, -sc * 0.18);
    ctx.lineTo(sc * 0.52, -sc * 0.52);
    ctx.lineTo(sc * 0.68, -sc * 0.36);
    ctx.lineTo(sc * 0.34, -sc * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // "铲"字（右下角小字标识）
    ctx.fillStyle = '#3a2a1a';
    R.font(ctx, s * 0.24, true);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('铲', half - s * 0.08, half - s * 0.06);
    ctx.restore();
  };

  // 5 卡牌选择面板已移除：原版机制为征兵直接替换备战席，无需弹窗

  R.inside = function (b, x, y) {
    return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  };

  ZY.R = R;
})();
