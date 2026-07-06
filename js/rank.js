// 玩家段位：11 级晋升体系（每级满 5 星 → 通关一次升下一级）
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, A = ZY.adapter;

  var KEY = 'zy_rank_v1';

  function load() {
    var raw = A.storageGet(KEY);
    if (!raw) return { rank: 0, stars: 0 };
    try {
      var d = JSON.parse(raw);
      if (typeof d.rank !== 'number') d.rank = 0;
      if (typeof d.stars !== 'number') d.stars = 0;
      return d;
    } catch (e) { return { rank: 0, stars: 0 }; }
  }

  function save(d) { A.storageSet(KEY, JSON.stringify(d)); }

  function clamp(d) {
    var maxRank = C.RANKS.length - 1;
    if (d.rank > maxRank) d.rank = maxRank;
    if (d.rank < 0) d.rank = 0;
    if (d.stars < 0) d.stars = 0;
    if (d.stars > C.STARS_PER_RANK) d.stars = C.STARS_PER_RANK;
    return d;
  }

  function getRankName(d) {
    return C.RANKS[Math.min(d.rank, C.RANKS.length - 1)] || C.RANKS[0];
  }

  // 通关调用：返回 {promoted, rank, stars, rankName, newRankName}
  function promoteOnWin() {
    var d = clamp(load());
    d.stars += 1;
    var promoted = false;
    var oldRank = d.rank;
    if (d.stars >= C.STARS_PER_RANK && d.rank < C.RANKS.length - 1) {
      d.stars = 0;
      d.rank += 1;
      promoted = true;
    }
    clamp(d);
    save(d);
    return {
      promoted: promoted,
      rank: d.rank,
      stars: d.stars,
      rankName: getRankName({ rank: oldRank }),
      newRankName: getRankName(d)
    };
  }

  // 调试用（保留 API）
  function reset() { A.storageSet(KEY, JSON.stringify({ rank: 0, stars: 0 })); }

  ZY.Rank = { load: load, getRankName: getRankName, promoteOnWin: promoteOnWin, reset: reset };
})();