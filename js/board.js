// 阵地与备战席：征兵、拖拽布阵、同字同级合成、碎片拼武将
// 双方(p/e)各有独立的馒头、备战席、阵地单位、红心
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, R = ZY.R, M_ = function () { return ZY.Map; };

  var B = {};
  var drag = null; // {from:{type:'bench'|'cell', idx|key}, unit, x, y, downX, downY, moved}
  var selected = null; // {side:'p', key:'c_r'|'bench_i'} 当前选中显示攻击范围的单位

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
    selected = null;
  };

  function key(c, r) { return c + '_' + r; }
  B.key = key;

  // ---- 单位 ----
  B.makeSoldier = function (ch, lv) {
    return { kind: 's', ch: ch, lv: lv || 1, cd: 0 };
  };
  B.makeFrag = function (ch, lv) {
    return { kind: 'f', ch: ch, cd: 0, lv: lv || 0 }; // lv: 携带的武将等级（0表示普通碎片）
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
      var glv = u.lv || 1;
      return {
        dmg: Math.round(g.dmg * C.GEN_LV_DMG_MUL(glv)),
        itv: g.itv * C.GEN_LV_ITV_MUL(glv),
        range: g.range, skill: g.skill, general: true, lv: glv
      };
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
  // luck: 0~1，AI 抽卡运气加成（铲子更少、碎片配对率更高）
  B.rollCard = function (S, luck) {
    luck = Math.max(0, Math.min(1, luck || 0));
    // 运气影响权重：铲子减少、碎片略增
    var wShovel = 8 * (1 - luck * 0.75);     // 8 → 2
    var wFrag = 22 + luck * 6;               // 22 → 28
    var wSoldier = 70;
    var totalW = wShovel + wFrag + wSoldier;
    var roll = Math.random() * totalW;
    var acc = 0;
    // 士兵
    acc += wSoldier;
    if (roll < acc) {
      var ch = C.SOLDIER_CHARS[(Math.random() * C.SOLDIER_CHARS.length) | 0];
      return B.makeSoldier(ch, 1);
    }
    // 铲子
    acc += wShovel;
    if (roll < acc) return B.makeShovel();
    // 碎片：运气越好，越容易补全已有单字
    var own = ownedFragChars(S);
    var wants = [];
    for (var oc in own) {
      var pair = C.FRAG_MAP[oc][1];
      if (!own[pair]) wants.push(pair);
    }
    var pairChance = 0.65 + luck * 0.30; // 0.65 → 0.95
    var fc = (wants.length && Math.random() < pairChance)
      ? wants[(Math.random() * wants.length) | 0]
      : C.FRAG_CHARS[(Math.random() * C.FRAG_CHARS.length) | 0];
    return B.makeFrag(fc);
  };

  // 征兵：原版机制——直接替换整个备战席为5张随机卡牌
  // （士兵/碎片/铲子按权重抽取，原备战席内容被替换）
  B.recruit = function (S, sideIsPlayer, luck) {
    var cost = B.recruitCost(S);
    if (S.mantou < cost) {
      if (sideIsPlayer) ZY.UI.toast('馒头不足');
      return false;
    }
    S.mantou -= cost;
    S.recruitCount++;
    for (var i = 0; i < C.ECON.benchSize; i++) {
      S.bench[i] = B.rollCard(S, luck);
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

  // 武将半身制造（lv: 武将等级 1~5，影响伤害和攻击速度）
  B.makeGeneralHalf = function (name, ch, half, pairedKey, lv) {
    return { kind: 'g', name: name, ch: ch, half: half, pairedKey: pairedKey, lv: lv || 1, cd: 0, attackT: 0 };
  };

  // 武将升级倍率（每级伤害×1.5，攻击间隔×0.85）
  C.GEN_LV_DMG_MUL = function (lv) { return Math.pow(1.5, lv - 1); };
  C.GEN_LV_ITV_MUL = function (lv) { return Math.pow(0.85, lv - 1); };
  C.GEN_MAX_LV = 5;

  // 检查 (c,r) 的左右相邻 build 格是否有配对碎片
  // 合成顺序要求：姓名首字在左，尾字在右（如"悟"左"空"右可合成，"空悟"不可）
  // fragCh 是放置在 (c,r) 的字，需与左右邻居按姓名顺序匹配
  // 返回 { neighborKey, pair } 或 null
  function findAdjFragPair(S, side, c, r, fragCh) {
    var Map = M_();
    // 仅左右相邻（不包含上下，因为姓名是横向书写）
    var neighbors = [[c-1,r],[c+1,r]];
    for (var i = 0; i < neighbors.length; i++) {
      var nc = neighbors[i][0], nr = neighbors[i][1];
      var nk = key(nc, nr);
      if (Map.cellType[nk] !== 'build_' + side) continue;
      var nu = S.units[nk];
      if (!nu || nu.kind !== 'f') continue;
      var pair = B.fragPair({ kind:'f', ch: fragCh }, nu);
      if (!pair) continue;
      var firstChar = pair.name[0];
      var placeIsFirst = (fragCh === firstChar);
      var neighborIsFirst = (nu.ch === firstChar);
      // 顺序校验：首字必须在左，尾字必须在右
      var neighborOnLeft = (nc < c);
      if (neighborOnLeft && !neighborIsFirst) continue;  // 邻居在左但不是首字 → 顺序错
      if (!neighborOnLeft && !placeIsFirst) continue;    // 邻居在右但放置的不是首字（即放置在左却不是首字）→ 顺序错
      return { neighborKey: nk, pair: pair };
    }
    return null;
  }

  // 找一个相邻的空 build 格（用于同格堆叠合成时放置另一半）
  function findAdjEmptyBuild(S, side, c, r) {
    var Map = M_();
    var neighbors = [[c-1,r],[c+1,r],[c,r-1],[c,r+1]];
    for (var i = 0; i < neighbors.length; i++) {
      var nk = neighbors[i][0] + '_' + neighbors[i][1];
      if (Map.cellType[nk] === 'build_' + side && !S.units[nk]) return nk;
    }
    return null;
  }

  // 自动扫描：保留为空操作（合成只在并排放置时触发）
  function autoSynthesize(S, side, isPlayer) { /* 并排放置时已即时合成 */ }
  B.autoSynthesize = autoSynthesize;
  B.findAdjFragPair = findAdjFragPair;

  // 在 placeKey 放置碎片 fragCh，尝试与相邻碎片合成武将（分两格）
  // 成功返回 true（已合成），失败返回 false（应走普通放置）
  // placeLv: 放置碎片携带的武将等级（用于保留等级，可选）
  function tryFormGeneralAdjacent(S, side, placeKey, placeCh, isPlayer, placeLv) {
    var cr = placeKey.split('_');
    var c = +cr[0], r = +cr[1];
    var found = findAdjFragPair(S, side, c, r, placeCh);
    if (!found) return false;
    // 保持各自原有的字在原位，按名字首字决定 half（首字=half 0）
    var pair = found.pair;
    var neighborU = S.units[found.neighborKey];
    var neighborCh = neighborU.ch;
    var firstChar = pair.name[0];
    var neighborHalf = (neighborCh === firstChar) ? 0 : 1;
    var placeHalf = (placeCh === firstChar) ? 0 : 1;
    // 合成时保留等级：取放置碎片与邻居碎片携带等级的最大值（重新合成武将不丢等级）
    var keepLv = Math.max(placeLv || 0, neighborU.lv || 0, 1);
    S.units[found.neighborKey] = B.makeGeneralHalf(pair.name, neighborCh, neighborHalf, placeKey, keepLv);
    S.units[placeKey] = B.makeGeneralHalf(pair.name, placeCh, placeHalf, found.neighborKey, keepLv);
    var p = M_().cellCenter(c, r);
    afterMerge(S, S.units[placeKey], p.x, p.y, isPlayer);
    return true;
  }
  B.tryFormGeneralAdjacent = tryFormGeneralAdjacent;

  // 移除一个半身时，另一半变回碎片（保留武将等级到碎片上）
  function unlinkGeneral(S, halfKey) {
    var u = S.units[halfKey];
    if (!u || u.kind !== 'g' || u.half == null) return;
    var pk = u.pairedKey;
    if (pk && S.units[pk] && S.units[pk].kind === 'g' && S.units[pk].name === u.name) {
      // 另一半变回碎片，携带武将等级
      S.units[pk] = B.makeFrag(S.units[pk].ch, S.units[pk].lv || 1);
    }
  }
  B.unlinkGeneral = unlinkGeneral;

  // 武将升级：拖入同字碎片到武将半身上，武将等级+1（最高 C.GEN_MAX_LV）
  // 检查碎片 ch 是否属于该武将的名字组成
  function fragBelongsToGeneral(fragCh, generalName) {
    return generalName.indexOf(fragCh) >= 0;
  }

  // 尝试升级武将：d.unit 是碎片，target 是武将半身
  // 成功返回 true，失败返回 false
  function tryUpgradeGeneral(S, d, targetKey) {
    var target = S.units[targetKey];
    if (!target || target.kind !== 'g' || target.half == null) return false;
    if (d.unit.kind !== 'f') return false;
    if (!fragBelongsToGeneral(d.unit.ch, target.name)) return false;
    if ((target.lv || 1) >= C.GEN_MAX_LV) {
      ZY.UI.toast(target.name + '已满级');
      return false;
    }
    var newLv = (target.lv || 1) + 1;
    // 两半同步升级
    target.lv = newLv;
    var pk = target.pairedKey;
    if (pk && S.units[pk] && S.units[pk].kind === 'g') S.units[pk].lv = newLv;
    // 消耗碎片
    if (d.from.type === 'bench') S.bench[d.from.idx] = null;
    else delete S.units[d.from.key];
    var cr = targetKey.split('_');
    var p = M_().cellCenter(+cr[0], +cr[1]);
    ZY.Battle.fx('summon', p.x, p.y);
    ZY.Battle.fx('text', p.x, p.y - 70, target.name + ' Lv.' + newLv + '！', '#b8860b');
    ZY.sfx('summon');
    ZY.adapter.vibrate();
    return true;
  }
  B.tryUpgradeGeneral = tryUpgradeGeneral;

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
    if (u.kind === 'shovel') return false; // 铲子不能上阵
    var ck = key(c, r);
    var target = S.units[ck];
    if (!target) {
      // 空格：若是碎片，尝试与相邻碎片合成武将
      if (u.kind === 'f') {
        if (tryFormGeneralAdjacent(S, side, ck, u.ch, side === 'p', u.lv)) {
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
      drag = { from: { type: 'bench', idx: bi }, unit: S.bench[bi], x: x, y: y, downX: x, downY: y, moved: false };
      // 按下即显示攻击范围（抬手或移动后消失）
      selected = { side: 'p', key: 'bench_' + bi };
      return true;
    }
    var cell = Map.cellAt(x, y);
    if (cell) {
      var k = key(cell.c, cell.r);
      if (Map.cellType[k] === 'build_p' && S.units[k]) {
        var u = S.units[k];
        var d = { from: { type: 'cell', key: k }, unit: u, x: x, y: y, downX: x, downY: y, moved: false };
        // 武将半身：拾取后单字可独立拖动（拖走后另一半变回碎片）
        // 拖动超过阈值时才真正拆分（见 onMove），点击则用于查看攻击范围
        if (u.kind === 'g' && u.half != null && u.pairedKey && S.units[u.pairedKey]) {
          d.wasHalf = true;
          d.pairKey = u.pairedKey;
          d.origUnit = u; // 原半身（放回原位时恢复）
        }
        drag = d;
        // 按下即显示攻击范围（抬手或移动后消失）
        selected = { side: 'p', key: k };
        return true;
      }
    }
    // 点空白：清除攻击范围选中
    selected = null;
    return false;
  };

  B.onMove = function (x, y) {
    if (!drag) return false;
    // 阈值判断：未超过 8px 视为点击（查看攻击范围），不进入拖拽
    if (!drag.moved) {
      var dx0 = x - drag.downX, dy0 = y - drag.downY;
      if (dx0 * dx0 + dy0 * dy0 < 64) return true; // 8px 阈值
      drag.moved = true;
      selected = null; // 开始拖拽时清除攻击范围选中
      // 武将半身：真正开始拖动时才拆分（配对格变回碎片，拖动对象变碎片）
      if (drag.wasHalf && !drag.split) {
        var S = ZY.G.p;
        var pairU = S.units[drag.pairKey];
        var keepLv = (drag.unit.lv || 1);
        // 拆分时保留武将等级到两个碎片上，便于再次合成时恢复
        S.units[drag.pairKey] = B.makeFrag(pairU.ch, keepLv);
        drag.unit = B.makeFrag(drag.unit.ch, keepLv);
        delete S.units[drag.from.key];
        drag.split = true;
      }
    }
    drag.x = x; drag.y = y;
    return true;
  };

  B.onUp = function (x, y) {
    if (!drag) return false;
    var G = ZY.G, Map = M_();
    var S = G.p;
    var d = drag;
    drag = null;

    // 未拖动（点击）：抬手即清除攻击范围显示
    if (!d.moved) {
      selected = null;
      return true;
    }
    // 以下为真正拖拽放置逻辑（d.moved === true，武将半身此时已拆分）

    // 与拖拽幽灵显示位置一致（幽灵画在 y-40），放置判定也用 y-40
    var py = y - 40;
    var bi = benchSlotAt(x, y);
    var cell = Map.buildCellAt(x, py, 'p') || Map.cellAt(x, py);
    var ck = cell ? key(cell.c, cell.r) : null;
    var isBuild = ck && Map.cellType[ck] === 'build_p';

    // 判断单位是否为武将半身（用于锁定检测，保留以备扩展）
    function isLockedHalf(u) { return u && u.kind === 'g' && u.half != null; }
    void isLockedHalf;

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
      // 拖回备战席（先尝试合成，否则换位）
      if (bi >= 0 && bi !== d.from.idx) {
        var tb = S.bench[bi];
        if (tb) {
          var mb = B.tryMerge(d.unit, tb);
          if (mb) {
            S.bench[bi] = mb;
            S.bench[d.from.idx] = null;
            var bpb = B.benchSlotCenter(bi);
            afterMerge(S, mb, bpb.x, bpb.y, true);
            return true;
          }
        }
        // 合并不成功：交换位置
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
          if (d.unit.kind === 'f' && tryFormGeneralAdjacent(S, 'p', ck, d.unit.ch, true, d.unit.lv)) {
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
        // 武将升级：拖同字碎片到武将半身上，等级+1
        if (d.unit.kind === 'f' && target.kind === 'g' && target.half != null) {
          if (tryUpgradeGeneral(S, d, ck)) return true;
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
        // 合并不成功：任意两元素交换位置
        if (!isLockedHalf(d.unit) && !isLockedHalf(target)) {
          S.units[ck] = d.unit;
          S.bench[d.from.idx] = target;
          // 交换后放置到格子的碎片检查是否触发武将合成
          if (d.unit.kind === 'f' && tryFormGeneralAdjacent(S, 'p', ck, d.unit.ch, true, d.unit.lv)) {
            return true;
          }
        }
        return true;
      }
      // 拖到非建造区：单位留在备战席
      return true;
    }

    // 从格子拖出
    // 拖到备战席
    if (bi >= 0) {
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
      var tmpB = S.bench[bi];
      S.bench[bi] = d.unit;
      S.units[d.from.key] = tmpB;
      return true;
    }
    // 拖到建造格
    if (isBuild && ck !== d.from.key) {
      var t2 = S.units[ck];
      // 目标格为空：移动（若是碎片，尝试相邻合成武将）
      if (!t2) {
        if (d.unit.kind === 'f' && tryFormGeneralAdjacent(S, 'p', ck, d.unit.ch, true, d.unit.lv)) {
          delete S.units[d.from.key];
          ZY.sfx('click');
          return true;
        }
        S.units[ck] = d.unit;
        delete S.units[d.from.key];
        return true;
      }
      // 武将升级：拖同字碎片到武将半身上，等级+1
      if (d.unit.kind === 'f' && t2.kind === 'g' && t2.half != null) {
        if (tryUpgradeGeneral(S, d, ck)) return true;
      }
      // 目标格有单位：兵种二合一升级
      if (B.mergeOnBoard(S, 'p', d.from.key, ck)) {
        return true;
      }
      // 合并不成功：任意两元素交换位置
      S.units[d.from.key] = t2;
      S.units[ck] = d.unit;
      // 交换后检查是否触发武将合成（按姓名顺序：首字左、尾字右）
      if (d.unit.kind === 'f' && tryFormGeneralAdjacent(S, 'p', ck, d.unit.ch, true, d.unit.lv)) {
        return true;
      }
      if (t2.kind === 'f' && tryFormGeneralAdjacent(S, 'p', d.from.key, t2.ch, true, t2.lv)) {
        return true;
      }
      return true;
    }
    // 拖到非建造区：单位留在原格
    // 武将半身已拆分时，源格已在 onMove 中删除，需将碎片放回原格避免字消失
    if (d.wasHalf && d.split) {
      S.units[d.from.key] = d.unit;
    }
    return true;
  };

  B.dragging = function () { return drag; };
  B.selected = function () { return selected; };
  B.clearSelected = function () { selected = null; };

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
    // 攻击瞬间文字变形化作兵器（原版核心特色，两个字都要有特效）
    if ((u.kind === 's' || u.kind === 'g') && u.attackT && u.attackT > 0) {
      ctx.save();
      ctx.globalAlpha = alpha != null ? alpha : 1;
      // 半身武将用自己的字变形；整将用全名
      var morphCh = (u.kind === 'g' && u.half != null) ? u.ch : (u.kind === 'g' ? u.name : ch);
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
      // 等级标识（Lv.2 起在左上角显示）
      if ((u.lv || 1) > 1) {
        ctx.fillStyle = '#b8860b';
        R.font(ctx, size * 0.2, true);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Lv' + u.lv, x - size / 2 + 4, y - size / 2 + 2);
      }
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
