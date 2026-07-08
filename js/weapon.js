// 武器系统：掉落、碎片合成、装备穿戴、持久化
// 4品质（绿/蓝/紫/橙）×5件=20件武器
// 绿/蓝成品直接掉落；紫需3碎片、橙需5碎片合成
// 装备绑定到角色名（悟空/八戒/沙僧/唐三/白龙），游戏中按 generalName 查武器加成
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, A = ZY.adapter;

  var W = {};

  // 持久化结构：{ owned: [weaponId,...], frags: {weaponId: count}, equip: {generalName: weaponId} }
  var state = null;

  function load() {
    if (state) return state;
    var raw = A.storageGet('zy_weapons');
    state = { owned: [], frags: {}, equip: {} };
    if (raw) {
      try {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object') {
          if (Array.isArray(p.owned)) state.owned = p.owned;
          if (p.frags && typeof p.frags === 'object') state.frags = p.frags;
          if (p.equip && typeof p.equip === 'object') state.equip = p.equip;
        }
      } catch (e) { /* 损坏数据重置 */ }
    }
    return state;
  }
  function save() {
    if (!state) return;
    A.storageSet('zy_weapons', JSON.stringify(state));
  }

  W.load = load;
  W.state = function () { return load(); };

  // 判断是否已拥有某武器（成品）
  W.owns = function (wid) { return load().owned.indexOf(wid) >= 0; };
  // 当前装备在指定角色上的武器（返回 weapon 对象或 null）
  W.equipped = function (generalName) {
    var s = load();
    var wid = s.equip[generalName];
    if (!wid) return null;
    return C.WEAPON_MAP[wid] || null;
  };
  // 某武器的碎片数
  W.fragCount = function (wid) { return load().frags[wid] || 0; };
  // 合成所需碎片数
  W.fragNeed = function (wid) {
    var w = C.WEAPON_MAP[wid];
    if (!w) return 0;
    return C.WEAPON_QUALITY[w.quality].fragNeed;
  };
  // 是否可合成（碎片足够且尚未拥有）
  W.canCraft = function (wid) {
    if (W.owns(wid)) return false;
    return W.fragCount(wid) >= W.fragNeed(wid);
  };

  // 领主击杀掉落：按概率绿10/蓝5/紫2/橙1
  // 返回掉落信息 { type:'weapon'|'frag', wid } 或 null
  W.rollDrop = function () {
    var s = load();
    // 按品质概率滚动：先按概率决定品质，再在该品质未拥有的武器里随机
    // 多次仍未掉落则返回 null（保底：绿/蓝成品若已全拥有，则掉碎片给紫/橙）
    var order = ['green', 'blue', 'purple', 'orange'];
    // 各品质独立判定（互斥取最高品质）：实际按"橙>紫>蓝>绿"优先级判断
    var roll = Math.random();
    var dropQ = null;
    if (roll < C.WEAPON_QUALITY.orange.drop) dropQ = 'orange';
    else if (roll < C.WEAPON_QUALITY.orange.drop + C.WEAPON_QUALITY.purple.drop) dropQ = 'purple';
    else if (roll < C.WEAPON_QUALITY.orange.drop + C.WEAPON_QUALITY.purple.drop + C.WEAPON_QUALITY.blue.drop) dropQ = 'blue';
    else if (roll < C.WEAPON_QUALITY.orange.drop + C.WEAPON_QUALITY.purple.drop + C.WEAPON_QUALITY.blue.drop + C.WEAPON_QUALITY.green.drop) dropQ = 'green';
    if (!dropQ) return null;

    var qCfg = C.WEAPON_QUALITY[dropQ];
    // 该品质全部武器
    var pool = C.WEAPONS.filter(function (w) { return w.quality === dropQ; });

    if (qCfg.fragNeed === 0) {
      // 绿/蓝：直接掉落成品（优先掉未拥有的）
      var unowned = pool.filter(function (w) { return s.owned.indexOf(w.id) < 0; });
      if (unowned.length) {
        var pick = unowned[(Math.random() * unowned.length) | 0];
        s.owned.push(pick.id);
        save();
        return { type: 'weapon', wid: pick.id, fresh: true };
      }
      // 已全拥有：转掉紫色碎片（保底）
      return rollFragFor('purple', s);
    } else {
      // 紫/橙：掉落碎片
      return rollFragFor(dropQ, s);
    }
  };

  // 为指定品质掉落一个碎片（优先选已有碎片较多的，便于合成）
  function rollFragFor(quality, s) {
    var pool = C.WEAPONS.filter(function (w) { return w.quality === quality; });
    var pick = pool[(Math.random() * pool.length) | 0];
    s.frags[pick.id] = (s.frags[pick.id] || 0) + 1;
    save();
    return { type: 'frag', wid: pick.id, fresh: true };
  }

  // 合成武器（消耗碎片，加入 owned）
  W.craft = function (wid) {
    var s = load();
    if (s.owned.indexOf(wid) >= 0) return false;
    var need = W.fragNeed(wid);
    if ((s.frags[wid] || 0) < need) return false;
    s.frags[wid] -= need;
    if (s.frags[wid] <= 0) delete s.frags[wid];
    s.owned.push(wid);
    save();
    return true;
  };

  // 装备武器到角色（要求该武器可装备：橙色武器限定 owner，其他品质任意角色）
  W.equip = function (generalName, wid) {
    var s = load();
    if (s.owned.indexOf(wid) < 0) return false;
    var w = C.WEAPON_MAP[wid];
    if (!w) return false;
    // 橙色武器仅其 owner 可装备
    if (w.owner && w.owner !== generalName) return false;
    s.equip[generalName] = wid;
    save();
    return true;
  };
  // 卸下武器
  W.unequip = function (generalName) {
    var s = load();
    if (s.equip[generalName]) {
      delete s.equip[generalName];
      save();
    }
  };
  // 武器能否装备到该角色（UI 提示用）
  W.canEquip = function (generalName, wid) {
    var w = C.WEAPON_MAP[wid];
    if (!w) return false;
    if (!W.owns(wid)) return false;
    if (w.owner && w.owner !== generalName) return false;
    return true;
  };

  ZY.Weapon = W;
})();
