// 阵地与备战席：征兵、拖拽布阵、同字同级合成、碎片拼武将
// 双方(p/e)各有独立的馒头、备战席、阵地单位、红心
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, R = ZY.R, M_ = function () { return ZY.Map; };

  var B = {};
  var drag = null; // {from:{type:'bench'|'cell', idx|key}, unit, x, y}

  B.newSide = function () {
    return {
      mantou: C.ECON.startMantou,
      recruitCount: 0,
      bench: new Array(C.ECON.benchSize).fill(null),
      units: {},           // 'c_r' -> unit
      hearts: C.ECON.hearts,
      shakeT: 0
    };
  };

  B.reset = function () {
    drag = null;
  };

  function key(c, r) { return c + '_' + r; }
  B.key = key;

  // ---- 单位 ----
  B.makeSoldier = function (ch, lv) {
    return { kind: 's', ch: ch, lv: lv || 1, cd: 0 };
  };
  B.makeFrag = function (ch) {
    return { kind: 'f', ch: ch, cd: 0 };
  };
  B.makeGeneral = function (name) {
    return { kind: 'g', name: name, ch: name, cd: 0 };
  };

  ZY.unitStats = function (u) {
    if (u.kind === 's') {
      var s = C.SOLDIERS[u.ch];
      var m = C.lvMul(u.lv);
      return { dmg: Math.round(s.dmg * m), itv: s.itv, range: s.range, soldier: true };
    }
    if (u.kind === 'g') {
      var g = C.GENERALS[u.name];
      return { dmg: g.dmg, itv: g.itv, range: g.range, skill: g.skill, general: true };
    }
    return { inert: true }; // 碎片/铲子不能作战
  };

  // ---- 征兵 ----
  B.recruitCost = function (S) {
    return C.ECON.recruitBase + S.recruitCount * C.ECON.recruitInc;
  };

  function ownedFragChars(S) {
    var own = {};
    S.bench.forEach(function (u) { if (u && u.kind === 'f') own[u.ch] = true; });
    for (var k in S.units) if (S.units[k].kind === 'f') own[S.units[k].ch] = true;
    return own;
  }

  // 制造铲子道具
  B.makeShovel = function () {
    return { kind: 'shovel', ch: '铲', cd: 0 };
  };

  // 抽一张卡牌（按权重）：士兵/碎片/铲子
  function rollOneCard(S) {
    var roll = Math.random() * 100;
    var acc = 0;
    for (var i = 0; i < C.RECRUIT_POOL.length; i++) {
      acc += C.RECRUIT_POOL[i].w;
      if (roll < acc) {
        var kind = C.RECRUIT_POOL[i].kind;
        if (kind === 's') {
          var ch = C.SOLDIER_CHARS[(Math.random() * C.SOLDIER_CHARS.length) | 0];
          return B.makeSoldier(ch, 1);
        } else if (kind === 'shovel') {
          return B.makeShovel();
        } else {
          // 碎片：优先补全已有单字
          var own = ownedFragChars(S);
          var wants = [];
          for (var oc in own) {
            var pair = C.FRAG_MAP[oc][1];
            if (!own[pair]) wants.push(pair);
          }
          var fc = (wants.length && Math.random() < 0.65)
            ? wants[(Math.random() * wants.length) | 0]
            : C.FRAG_CHARS[(Math.random() * C.FRAG_CHARS.length) | 0];
          return B.makeFrag(fc);
        }
      }
    }
    return B.makeSoldier(C.SOLDIER_CHARS[0], 1);
  }

  // 征兵：原版机制——直接替换整个备战席为5张随机卡牌
  // （士兵/碎片/铲子按权重抽取，原备战席内容被替换）
  B.recruit = function (S, sideIsPlayer) {
    var cost = B.recruitCost(S);
    if (S.mantou < cost) {
      if (sideIsPlayer) ZY.UI.toast('馒头不足');
      return false;
    }
    S.mantou -= cost;
    S.recruitCount++;
    for (var i = 0; i < C.ECON.benchSize; i++) {
      S.bench[i] = rollOneCard(S);
    }
    if (sideIsPlayer) ZY.sfx('coin');
    return true;
  };

  // 使用铲子解锁格子（铲子模式）
  B.useShovel = function (S, c, r) {
    var Map = M_();
    if (!Map.isUnlockable(c, r, 'p')) {
      ZY.UI.toast('该格不可解锁');
      return false;
    }
    Map.unlockCell(c, r, 'p');
    ZY.UI.toast('已解锁新空地！');
    ZY.sfx('merge');
    return true;
  };

  // ---- 合成判定 ----
  // 兵种二合一（同字同级升级）
  B.tryMerge = function (a, b) {
    if (a.kind === 's' && b.kind === 's' && a.ch === b.ch && a.lv === b.lv && a.lv < C.MAX_LV) {
      return B.makeSoldier(a.ch, a.lv + 1);
    }
    return null;
  };

  // 碎片配对检测：a+b 是否能组成武将
  B.fragPair = function (a, b) {
    if (a.kind !== 'f' || b.kind !== 'f') return null;
    var map = C.FRAG_MAP[a.ch];
    if (map && map[1] === b.ch) return { name: map[0], firstCh: a.ch, secondCh: b.ch };
    return null;
  };

  // 武将半身制造
  B.makeGeneralHalf = function (name, ch, half, pairedKey) {
    return { kind: 'g', name: name, ch: ch, half: half, pairedKey: pairedKey, cd: 0, attackT: 0 };
  };

  // 检查 (c,r) 的四连通相邻 build 格是否有配对碎片
  // 返回 { neighborKey, pair } 或 null
  function findAdjFragPair(S, side, c, r, fragCh) {
    var Map = M_();
    var neighbors = [[c-1,r],[c+1,r],[c,r-1],[c,r+1]];
    for (var i = 0; i < neighbors.length; i++) {
      var nc = neighbors[i][0], nr = neighbors[i][1];
      var nk = key(nc, nr);
      if (Map.cellType[nk] !== 'build_' + side) continue;
      var nu = S.units[nk];
      if (!nu || nu.kind !== 'f') continue;
      var pair = B.fragPair({ kind:'f', ch: fragCh }, nu);
      if (pair) return { neighborKey: nk, pair: pair };
    }
    return null;
  }
  B.findAdjFragPair = findAdjFragPair;

  // 在 placeKey 放置碎片 fragCh，尝试与相邻碎片合成武将（分两格）
  // 成功返回 true（已合成），失败返回 false（应走普通放置）
  function tryFormGeneralAdjacent(S, side, placeKey, placeCh, isPlayer) {
    var cr = placeKey.split('_');
    var c = +cr[0], r = +cr[1];
    var found = findAdjFragPair(S, side, c, r, placeCh);
    if (!found) return false;
    // 合成：邻居格变 half=0（首字），placeKey 放 half=1（尾字）
    var pair = found.pair;
    S.units[found.neighborKey] = B.makeGeneralHalf(pair.name, pair.firstCh, 0, placeKey);
    S.units[placeKey] = B.makeGeneralHalf(pair.name, pair.secondCh, 1, found.neighborKey);
    var p = M_().cellCenter(c, r);
    afterMerge(S, S.units[placeKey], p.x, p.y, isPlayer);
    return true;
  }
  B.tryFormGeneralAdjacent = tryFormGeneralAdjacent;

  // 移除一个半身时，另一半变回碎片
  function unlinkGeneral(S, halfKey) {
    var u = S.units[halfKey];
    if (!u || u.kind !== 'g' || u.half == null) return;
    var pk = u.pairedKey;
    if (pk && S.units[pk] && S.units[pk].kind === 'g' && S.units[pk].name === u.name) {
      // 另一半变回碎片
      S.units[pk] = B.makeFrag(S.units[pk].ch);
    }
  }
  B.unlinkGeneral = unlinkGeneral;

  function afterMerge(S, merged, x, y, isPlayer) {
    if (merged.kind === 'g') {
      ZY.Battle.fx('summon', x, y);
      ZY.Battle.fx('text', x, y - 70, merged.name + '·觉醒！', '#b8860b');
      if (isPlayer) { ZY.sfx('summon'); ZY.adapter.vibrate(); }
    } else {
      ZY.Battle.fx('ink', x, y);
      if (isPlayer) ZY.sfx('merge');
    }
  }

  // ---- AI 可复用的操作原语 ----
  B.placeFromBench = function (S, side, benchIdx, c, r) {
    var Map = M_();
    var t = Map.cellType[key(c, r)];
    if (t !== 'build_' + side) return false;
    var u = S.bench[benchIdx];
    if (!u) return false;
    var ck = key(c, r);
    var target = S.units[ck];
    if (!target) {
      // 空格：若是碎片，尝试与相邻碎片合成武将
      if (u.kind === 'f') {
        if (tryFormGeneralAdjacent(S, side, ck, u.ch, side === 'p')) {
          S.bench[benchIdx] = null;
          return true;
        }
      }
      // 普通放置
      S.units[ck] = u;
      S.bench[benchIdx] = null;
      return true;
    }
    // 目标格有单位：仅兵种可二合一升级
    var merged = B.tryMerge(u, target);
    if (merged) {
      S.units[ck] = merged;
      S.bench[benchIdx] = null;
      var p = Map.cellCenter(c, r);
      afterMerge(S, merged, p.x, p.y, side === 'p');
      return true;
    }
    return false;
  };

  B.mergeOnBoard = function (S, side, fromKey, toKey) {
    var a = S.units[fromKey], b = S.units[toKey];
    if (!a || !b) return false;
    // 兵种二合一升级
    var merged = B.tryMerge(a, b);
    if (merged) {
      S.units[toKey] = merged;
      delete S.units[fromKey];
      var cr = toKey.split('_');
      var p = M_().cellCenter(+cr[0], +cr[1]);
      afterMerge(S, merged, p.x, p.y, side === 'p');
      return true;
    }
    return false;
  };

  // ---- 玩家拖拽 ----
  function benchSlotAt(x, y) {
    var L = ZY.L;
    if (y < L.benchY - L.benchSlot / 2 - 8 || y > L.benchY + L.benchSlot / 2 + 8) return -1;
    for (var i = 0; i < C.ECON.benchSize; i++) {
      var sx = L.benchX + i * (L.benchSlot + L.benchGap) + L.benchSlot / 2;
      if (Math.abs(x - sx) <= L.benchSlot / 2 + L.benchGap / 2) return i;
    }
    return -1;
  }
  B.benchSlotCenter = function (i) {
    var L = ZY.L;
    return { x: L.benchX + i * (L.benchSlot + L.benchGap) + L.benchSlot / 2, y: L.benchY };
  };

  B.onDown = function (x, y) {
    var G = ZY.G, Map = M_();
    var S = G.p;
    var bi = benchSlotAt(x, y);
    if (bi >= 0 && S.bench[bi]) {
      drag = { from: { type: 'bench', idx: bi }, unit: S.bench[bi], x: x, y: y };
      return true;
    }
    var cell = Map.cellAt(x, y);
    if (cell) {
      var k = key(cell.c, cell.r);
      if (Map.cellType[k] === 'build_p' && S.units[k]) {
        drag = { from: { type: 'cell', key: k }, unit: S.units[k], x: x, y: y };
        return true;
      }
    }
    return false;
  };

  B.onMove = function (x, y) {
    if (!drag) return false;
    drag.x = x; drag.y = y;
    return true;
  };

  B.onUp = function (x, y) {
    if (!drag) return false;
    var G = ZY.G, Map = M_();
    var S = G.p;
    var d = drag;
    drag = null;

    // 与拖拽幽灵显示位置一致（幽灵画在 y-40），放置判定也用 y-40
    var py = y - 40;
    var bi = benchSlotAt(x, y);
    var cell = Map.buildCellAt(x, py, 'p') || Map.cellAt(x, py);
    var ck = cell ? key(cell.c, cell.r) : null;
    var isBuild = ck && Map.cellType[ck] === 'build_p';

    // 判断单位是否为武将半身（锁定，不可交换/拖动到异地）
    function isLockedHalf(u) { return u && u.kind === 'g' && u.half != null; }

    // 铲子特殊处理：拖到任意可铲 block 格解锁，否则返回原位
    if (d.unit.kind === 'shovel') {
      var cellAny = Map.cellAt(x, py) || Map.cellAt(x, y);
      if (cellAny && Map.isUnlockable(cellAny.c, cellAny.r, 'p')) {
        if (B.useShovel(S, cellAny.c, cellAny.r)) {
          // 消耗铲子
          if (d.from.type === 'bench') S.bench[d.from.idx] = null;
          else delete S.units[d.from.key];
          return true;
        }
      }
      // 铲子不能放在普通建造格，返回原位
      return true;
    }

    // 从备战席拖出
    if (d.from.type === 'bench') {
      // 拖回备战席（换位）
      if (bi >= 0 && bi !== d.from.idx) {
        var tmp = S.bench[bi];
        S.bench[bi] = d.unit;
        S.bench[d.from.idx] = tmp;
        return true;
      }
      // 拖到建造格
      if (isBuild) {
        var target = S.units[ck];
        // 空格放置
        if (!target) {
          // 碎片：尝试与相邻碎片合成武将（分两格）
          if (d.unit.kind === 'f' && tryFormGeneralAdjacent(S, 'p', ck, d.unit.ch, true)) {
            S.bench[d.from.idx] = null;
            ZY.sfx('click');
            return true;
          }
          // 普通放置
          S.units[ck] = d.unit;
          S.bench[d.from.idx] = null;
          ZY.sfx('click');
          return true;
        }
        // 目标格有单位：兵种可二合一升级
        var merged = B.tryMerge(d.unit, target);
        if (merged) {
          S.units[ck] = merged;
          S.bench[d.from.idx] = null;
          var p = Map.cellCenter(cell.c, cell.r);
          afterMerge(S, merged, p.x, p.y, true);
          return true;
        }
        // 合并不成功：任意两元素交换位置（武将半身锁定除外）
        if (!isLockedHalf(d.unit) && !isLockedHalf(target)) {
          S.units[ck] = d.unit;
          S.bench[d.from.idx] = target;
        }
        return true;
      }
      // 拖到非建造区：单位留在备战席
      return true;
    }

    // 从格子拖出
    // 拖到备战席
    if (bi >= 0) {
      // 武将半身拖到备战席：另一半变回碎片，半身本身变回碎片
      if (isLockedHalf(d.unit)) {
        unlinkGeneral(S, d.from.key);
        S.bench[bi] = B.makeFrag(d.unit.ch);
        delete S.units[d.from.key];
        return true;
      }
      // 备战席为空：直接放入
      if (!S.bench[bi]) { S.bench[bi] = d.unit; delete S.units[d.from.key]; return true; }
      // 备战席有单位：尝试兵种合成
      var m2 = B.tryMerge(d.unit, S.bench[bi]);
      if (m2) {
        S.bench[bi] = m2;
        delete S.units[d.from.key];
        var bp = B.benchSlotCenter(bi);
        afterMerge(S, m2, bp.x, bp.y, true);
        return true;
      }
      // 合并不成功：任意两元素交换位置
      if (!isLockedHalf(S.bench[bi])) {
        var tmpB = S.bench[bi];
        S.bench[bi] = d.unit;
        S.units[d.from.key] = tmpB;
      }
      return true;
    }
    // 拖到建造格
    if (isBuild && ck !== d.from.key) {
      var t2 = S.units[ck];
      // 武将半身拖动：禁止（锁定），返回原位
      if (isLockedHalf(d.unit)) {
        return true; // 不做任何变动
      }
      // 目标格为空：移动（若是碎片，尝试相邻合成武将）
      if (!t2) {
        if (d.unit.kind === 'f' && tryFormGeneralAdjacent(S, 'p', ck, d.unit.ch, true)) {
          delete S.units[d.from.key];
          ZY.sfx('click');
          return true;
        }
        S.units[ck] = d.unit;
        delete S.units[d.from.key];
        return true;
      }
      // 目标格有单位：兵种二合一升级
      if (B.mergeOnBoard(S, 'p', d.from.key, ck)) {
        return true;
      }
      // 合并不成功：任意两元素交换位置（目标武将半身锁定除外）
      if (!isLockedHalf(t2)) {
        S.units[d.from.key] = t2;
        S.units[ck] = d.unit;
      }
      return true;
    }
    // 拖到非建造区：单位留在原格
    return true;
  };

  B.dragging = function () { return drag; };

  B.eachUnit = function (S, fn) {
    for (var k in S.units) {
      var cr = k.split('_');
      fn(S.units[k], +cr[0], +cr[1], k);
    }
  };

  // ---- 绘制单位牌 ----
  B.drawUnit = function (ctx, u, x, y, size, alpha) {
    var opt = { alpha: alpha };
    if (u.kind === 's') { opt.lv = u.lv; }
    if (u.kind === 'f') { opt.gold = true; }
    if (u.kind === 'g') { opt.gold = true; opt.hl = true; }
    // 武将半身：单字 + 金底 + 半身标识
    var isHalf = u.kind === 'g' && u.half != null;
    var ch = isHalf ? u.ch : (u.kind === 'g' ? u.name : u.ch);
    // 攻击瞬间文字变形化作兵器（原版核心特色，仅 half=0 触发避免双倍）
    if ((u.kind === 's' || (u.kind === 'g' && u.half === 0)) && u.attackT && u.attackT > 0) {
      ctx.save();
      ctx.globalAlpha = alpha != null ? alpha : 1;
      var morphCh = u.kind === 'g' ? u.name : ch;
      var morphed = R.morphTile(ctx, x, y, size, morphCh, u.kind, u.attackT);
      ctx.restore();
      if (morphed) return;
    }
    if (isHalf) {
      // 武将半身：金底 + 单字 + 半身连接标识
      ctx.save();
      ctx.globalAlpha = alpha != null ? alpha : 1;
      R.mahjong(ctx, x, y, size, '', opt);
      // 半身底色（金色渐变）
      ctx.fillStyle = u.half === 0 ? '#fbe9b8' : '#f4d98a';
      R.roundRect(ctx, x - size/2, y - size/2, size, size * 0.96, size * 0.12);
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      R.roundRect(ctx, x - size/2, y - size/2, size, size * 0.96, size * 0.12);
      ctx.stroke();
      // 半身连接边（half=0 右边高亮，half=1 左边高亮，表示配对方向）
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (u.half === 0) {
        ctx.moveTo(x + size/2 - 2, y - size/2 + 4);
        ctx.lineTo(x + size/2 - 2, y + size/2 - 4);
      } else {
        ctx.moveTo(x - size/2 + 2, y - size/2 + 4);
        ctx.lineTo(x - size/2 + 2, y + size/2 - 4);
      }
      ctx.stroke();
      // 单字
      ctx.fillStyle = '#7a2a1a';
      R.font(ctx, size * 0.55, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, x, y - size * 0.02);
      ctx.restore();
    } else if (u.kind === 'shovel') {
      // 铲子道具：用专门渲染
      ctx.save();
      ctx.globalAlpha = alpha != null ? alpha : 1;
      R.shovelTile(ctx, x, y, size, {});
      ctx.restore();
    } else if (u.kind === 'g') {
      // 旧式整武将（兼容）：双字竖排
      ctx.save();
      ctx.globalAlpha = alpha != null ? alpha : 1;
      R.mahjong(ctx, x, y, size, '', opt);
      ctx.fillStyle = '#b8860b';
      R.font(ctx, size * 0.4, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch[0], x, y - size * 0.2);
      ctx.fillText(ch[1], x, y + size * 0.22);
      ctx.restore();
    } else {
      R.mahjong(ctx, x, y, size, ch, opt);
    }
  };

  ZY.Board = B;
})();
