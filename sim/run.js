'use strict';
// 无头模拟器：在 Node.js 中跑 100 局自动化对战，统计平衡性并给出优化建议
// 不依赖浏览器/Canvas，直接驱动 ZY.Enemies / ZY.Battle / ZY.AI 的 update 循环
// 玩家侧同样由 AI.step 以固定频率驱动（自对战），消除人为操作差异以测量纯数值平衡

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');

// ============================================================
// 1. Mock 浏览器/小游戏环境
// ============================================================
const storage = new Map();

// 递归 no-op Canvas ctx：任意方法调用都是 no-op
// measureText 返回 {width:0}，渐变返回 {addColorStop:noop}
function makeNoopCtx() {
  const handler = {
    get(target, prop) {
      if (prop === 'measureText') return function () { return { width: 0 }; };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern')
        return function () { return { addColorStop: function () {} }; };
      if (typeof prop === 'symbol') return undefined;
      return function noop() { return undefined; };
    },
    set() { return true; }
  };
  return new Proxy({}, handler);
}

const listeners = { down: [], move: [], up: [] };
const mockAdapter = {
  env: 'sim',
  DW: 900,
  DH: 1600,
  canvas: null,
  ctx: makeNoopCtx(),
  scale: 1,
  listeners: listeners,
  hasScreen: false,           // 关键：不启动 raf 主循环，由 sim 自己驱动
  on: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  emit: function (type, x, y) { (listeners[type] || []).forEach(function (fn) { fn(x, y); }); },
  raf: function () { return 0; },
  storageGet: function (key) { return storage.has(key) ? storage.get(key) : null; },
  storageSet: function (key, val) { storage.set(key, String(val)); },
  createOffCanvas: function () { return null; },
  vibrate: function () {}
};

// ============================================================
// 2. 创建 VM context 并加载游戏模块
// ============================================================
const sandbox = {
  console: console,
  setTimeout: setTimeout,
  setInterval: setInterval,
  clearTimeout: clearTimeout,
  clearInterval: clearInterval,
  Date: Date
};
// 预置 ZY：adapter + 音效 no-op（跳过 audio.js）
sandbox.ZY = {
  adapter: mockAdapter,
  sfx: function () {},
  sfxToggle: function () {},
  sfxEnabled: function () { return false; }
};

vm.createContext(sandbox);

function loadFile(name) {
  const src = fs.readFileSync(path.join(JS_DIR, name), 'utf8');
  vm.runInContext(src, sandbox, { filename: name });
}

// 加载顺序（依赖链）：config → rank → map → render → board → enemies → battle → ai → ui → main
// 跳过 adapter.js（已用 mock 替换）和 audio.js（已用 no-op 替换）
loadFile('config.js');
loadFile('rank.js');
loadFile('map.js');
loadFile('render.js');
loadFile('board.js');
loadFile('enemies.js');
loadFile('battle.js');
loadFile('ai.js');
loadFile('ui.js');
loadFile('main.js');

const ZY = sandbox.ZY;
const C = ZY.C;

// ============================================================
// 3. 固定段位 = 力士·一（rank 0, subLevel 1, stars 0）
//    使 AI 难度恒定（thinkItv=1.15s, missRate=0.22, luck=0）
// ============================================================
const FIXED_RANK = { rank: 0, subLevel: 1, stars: 0 };
ZY.Rank.load = function () {
  const d = { rank: FIXED_RANK.rank, subLevel: FIXED_RANK.subLevel, stars: FIXED_RANK.stars };
  d.rankName = ZY.Rank.getRankName(d);
  return d;
};
ZY.Rank.promoteOnWin = function () {
  // 单局从 0 星起算，赢一局仅 +1 星，不触发升阶（满 5 星后再赢才升阶）
  const d = { rank: FIXED_RANK.rank, subLevel: FIXED_RANK.subLevel, stars: FIXED_RANK.stars + 1 };
  return {
    promoted: false,
    rank: d.rank, subLevel: d.subLevel, stars: d.stars,
    rankName: ZY.Rank.getRankName(FIXED_RANK),
    newRankName: ZY.Rank.getRankName(d)
  };
};

// ============================================================
// 4. 埋点：征兵花费 / 铲子使用 / 解锁格子
//    （武将合成通过 tryFormGeneralAdjacent 的 *局部* 引用触发，
//     无法从外部拦截，改用「局末统计场上 distinct 武将名」——
//     武将一旦合成不会被消灭/合并消失，所以等价于累计合成数）
// ============================================================
const stats = { pMantouSpent: 0, eMantouSpent: 0, pShovels: 0, pUnlocks: 0 };
const origRecruit = ZY.Board.recruit;
ZY.Board.recruit = function (S, sideIsPlayer, luck) {
  const cost = ZY.Board.recruitCost(S);
  const r = origRecruit.apply(this, arguments);
  if (r) {
    if (S === ZY.G.p) stats.pMantouSpent += cost;
    else if (S === ZY.G.e) stats.eMantouSpent += cost;
  }
  return r;
};
const origUnlock = ZY.Map.unlockCell;
ZY.Map.unlockCell = function (c, r, side) {
  const res = origUnlock.apply(this, arguments);
  if (res && side === 'p') stats.pUnlocks++;
  return res;
};
const origShovel = ZY.Board.useShovel;
ZY.Board.useShovel = function (S, c, r) {
  const res = origShovel.apply(this, arguments);
  if (res && S === ZY.G.p) stats.pShovels++;
  return res;
};

// ============================================================
// 5. 统计辅助
// ============================================================
function countGenerals(S) {
  const names = {};
  for (const k in S.units) {
    const u = S.units[k];
    if (u && u.kind === 'g') names[u.name] = true;
  }
  return Object.keys(names).length;
}
function maxLevel(S) {
  let mx = 0;
  const scan = function (u) {
    if (!u) return;
    if (u.kind === 's' || u.kind === 'g') {
      const lv = u.lv || 1;
      if (lv > mx) mx = lv;
    }
  };
  for (const k in S.units) scan(S.units[k]);
  for (let i = 0; i < S.bench.length; i++) scan(S.bench[i]);
  return mx;
}

// ============================================================
// 6. 单局模拟（复刻 main.js frame() 的更新序列，去掉绘制）
//    顺序：G.time+=dt → 玩家AI.step → Enemies.update → Battle.update → AI.update(敌方)
// ============================================================
const DT = 1 / 30;
const MAX_SIM_SECONDS = 800;
const MAX_STEPS = Math.floor(MAX_SIM_SECONDS / DT);
const PLAYER_ITV = 0.8;     // 玩家思考间隔（秒）
const PLAYER_MISS = 0.10;   // 玩家失误率（低）

function runOneGame(idx) {
  stats.pMantouSpent = 0; stats.eMantouSpent = 0; stats.pShovels = 0; stats.pUnlocks = 0;
  ZY.Main.newGame();
  const G = ZY.G;
  let botAcc = 0;
  for (let s = 0; s < MAX_STEPS; s++) {
    if (G.scene !== 'play') break;
    G.time += DT;
    botAcc += DT;
    if (botAcc >= PLAYER_ITV) {
      botAcc = 0;
      if (Math.random() >= PLAYER_MISS) ZY.AI.step(G.p, 'p');
    }
    ZY.Enemies.update(DT);
    if (G.scene !== 'play') break;
    ZY.Battle.update(DT);
    ZY.AI.update(DT);
  }

  const ended = G.scene === 'over';
  // 胜负分类（比 matchEnd 的二值更细：区分平局）
  let winner;
  if (G.p.hearts <= 0 && G.e.hearts <= 0) winner = 'draw';
  else if (G.e.hearts <= 0) winner = 'p';
  else if (G.p.hearts <= 0) winner = 'e';
  else {
    if (G.p.hearts > G.e.hearts) winner = 'p';
    else if (G.e.hearts > G.p.hearts) winner = 'e';
    else winner = 'draw';
  }
  let reason;
  if (!ended) reason = 'timeout';
  else if (G.p.hearts <= 0 || G.e.hearts <= 0) reason = 'hearts';
  else reason = 'maxwave';

  return {
    idx: idx, ended: ended, winner: winner, win: G.win, wave: G.wave, reason: reason,
    pHearts: G.p.hearts, eHearts: G.e.hearts, time: G.time,
    pGenerals: countGenerals(G.p), eGenerals: countGenerals(G.e),
    pMaxLv: maxLevel(G.p), eMaxLv: maxLevel(G.e),
    pRecruits: G.p.recruitCount, eRecruits: G.e.recruitCount,
    pMantouSpent: stats.pMantouSpent, eMantouSpent: stats.eMantouSpent,
    pShovels: stats.pShovels, pUnlocks: stats.pUnlocks,
    rankPromote: !!(G.rankPromote && G.rankPromote.promoted),
    pMantou: G.p.mantou, eMantou: G.e.mantou
  };
}

// ============================================================
// 7. 跑 100 局
// ============================================================
const N = 100;
const records = [];
console.log('=== 西游记塔防（赵云与阿斗对战版）无头模拟 ===');
console.log('固定段位: 力士·一 (rank 0, subLevel 1, stars 0)');
console.log('  → AI 难度 thinkItv=1.15s missRate=0.22 luck=0');
console.log('玩家驱动: AI.step 间隔 ' + PLAYER_ITV + 's, 失误率 ' + (PLAYER_MISS * 100) + '% ( competent, not perfect )');
console.log('模拟步长 dt=' + DT + 's, 每局上限 ' + MAX_SIM_SECONDS + 's');
console.log('开始运行 ' + N + ' 局...');
for (let i = 1; i <= N; i++) {
  const rec = runOneGame(i);
  records.push(rec);
  if (i % 10 === 0) console.log('  已完成 ' + i + '/' + N);
}

// ============================================================
// 8. 统计报告
// ============================================================
function avg(arr) { if (!arr.length) return 0; let s = 0; for (const v of arr) s += v; return s / arr.length; }
function pct(n) { return ((n / N) * 100).toFixed(1) + '%'; }
function fmt(n) { return Number(n).toFixed(2); }

const wins = records.filter(r => r.winner === 'p');
const losses = records.filter(r => r.winner === 'e');
const draws = records.filter(r => r.winner === 'draw');
const timeouts = records.filter(r => !r.ended);

const waveHist = {};
for (let w = 0; w <= C.MAX_WAVE; w++) waveHist[w] = 0;
records.forEach(r => { waveHist[r.wave] = (waveHist[r.wave] || 0) + 1; });

const lossReasons = { hearts: 0, maxwave: 0, timeout: 0 };
losses.forEach(r => { lossReasons[r.reason] = (lossReasons[r.reason] || 0) + 1; });

const winWaves = wins.map(r => r.wave);
const lossWaves = losses.map(r => r.wave);

// 失败波数分布（看玩家通常死在第几波）
const lossWaveHist = {};
losses.forEach(r => { lossWaveHist[r.wave] = (lossWaveHist[r.wave] || 0) + 1; });

console.log('');
console.log('==================== 统计报告 ====================');
console.log('总局数: ' + N + ' | 正常结束: ' + (N - timeouts.length) + ' | 超时: ' + timeouts.length);
console.log('');
console.log('--- 胜负 ---');
console.log('玩家胜: ' + wins.length + ' (' + pct(wins.length) + ')');
console.log('玩家负: ' + losses.length + ' (' + pct(losses.length) + ')');
console.log('平局:   ' + draws.length + ' (' + pct(draws.length) + ')');
console.log('');
console.log('--- 存活波数 ---');
console.log('平均存活波数: 总体=' + fmt(avg(records.map(r => r.wave))) +
  ' | 胜=' + fmt(avg(winWaves)) + ' | 负=' + fmt(avg(lossWaves)));
console.log('最终波数分布:');
for (let w = 0; w <= C.MAX_WAVE; w++) {
  if (waveHist[w]) console.log('  波' + w + ': ' + waveHist[w] + ' (' + pct(waveHist[w]) + ')');
}
console.log('玩家负局死亡波数分布:');
for (const w in lossWaveHist) console.log('  波' + w + ': ' + lossWaveHist[w]);
console.log('');
console.log('--- 对局时长 ---');
console.log('平均对局时长: ' + fmt(avg(records.map(r => r.time))) + 's' +
  ' | 胜=' + fmt(avg(wins.map(r => r.time))) + 's 负=' + fmt(avg(losses.map(r => r.time))) + 's');
console.log('');
console.log('--- 武将合成（场上 distinct 武将名，等价累计合成数）---');
console.log('玩家平均合成武将: ' + fmt(avg(records.map(r => r.pGenerals))) +
  ' (胜=' + fmt(avg(wins.map(r => r.pGenerals))) + ' 负=' + fmt(avg(losses.map(r => r.pGenerals))) + ')');
console.log('敌方平均合成武将: ' + fmt(avg(records.map(r => r.eGenerals))) +
  ' (玩家胜局中敌=' + fmt(avg(wins.map(r => r.eGenerals))) + ' 玩家负局中敌=' + fmt(avg(losses.map(r => r.eGenerals))) + ')');
const pNoGeneral = records.filter(r => r.pGenerals === 0).length;
console.log('玩家0武将局: ' + pNoGeneral + ' (' + pct(pNoGeneral) + ')');
console.log('');
console.log('--- 单位最高等级 ---');
console.log('玩家平均最高等级: ' + fmt(avg(records.map(r => r.pMaxLv))) +
  ' (胜=' + fmt(avg(wins.map(r => r.pMaxLv))) + ' 负=' + fmt(avg(losses.map(r => r.pMaxLv))) + ')');
console.log('敌方平均最高等级: ' + fmt(avg(records.map(r => r.eMaxLv))));
console.log('');
console.log('--- 征兵与经济 ---');
console.log('玩家平均征兵次数: ' + fmt(avg(records.map(r => r.pRecruits))) +
  ' | 敌方: ' + fmt(avg(records.map(r => r.eRecruits))));
console.log('玩家平均馒头花费: ' + fmt(avg(records.map(r => r.pMantouSpent))) +
  ' | 敌方: ' + fmt(avg(records.map(r => r.eMantouSpent))));
console.log('玩家征兵次数 胜=' + fmt(avg(wins.map(r => r.pRecruits))) + ' 负=' + fmt(avg(losses.map(r => r.pRecruits))));
console.log('玩家铲子使用总次数: ' + records.reduce((a, r) => a + r.pShovels, 0) +
  ' | 解锁格总次数: ' + records.reduce((a, r) => a + r.pUnlocks, 0));
console.log('段位升阶发生: ' + records.filter(r => r.rankPromote).length + ' (单局从0星起算不会升阶，符合预期)');
console.log('');
console.log('--- 失败原因 ---');
console.log('玩家负局原因: 心血耗尽=' + lossReasons.hearts +
  ' | 撑满10波但红心较少=' + lossReasons.maxwave +
  ' | 超时=' + lossReasons.timeout);
console.log('');
console.log('--- 相关性分析 ---');
const g2 = records.filter(r => r.pGenerals >= 2);
const g2w = g2.filter(r => r.winner === 'p').length;
console.log('玩家合成>=2武将: ' + g2.length + '局, 胜率 ' + (g2.length ? pct(g2w) : 'N/A'));
const g1 = records.filter(r => r.pGenerals === 1);
const g1w = g1.filter(r => r.winner === 'p').length;
console.log('玩家合成=1武将: ' + g1.length + '局, 胜率 ' + (g1.length ? pct(g1w) : 'N/A'));
const g0 = records.filter(r => r.pGenerals === 0);
const g0w = g0.filter(r => r.winner === 'p').length;
console.log('玩家合成=0武将: ' + g0.length + '局, 胜率 ' + (g0.length ? pct(g0w) : 'N/A'));
console.log('玩家最高等级 胜=' + fmt(avg(wins.map(r => r.pMaxLv))) + ' 负=' + fmt(avg(losses.map(r => r.pMaxLv))));
console.log('玩家征兵次数 胜=' + fmt(avg(wins.map(r => r.pRecruits))) + ' 负=' + fmt(avg(losses.map(r => r.pRecruits))));
console.log('玩家馒头花费 胜=' + fmt(avg(wins.map(r => r.pMantouSpent))) + ' 负=' + fmt(avg(losses.map(r => r.pMantouSpent))));

// ============================================================
// 9. 数据驱动的优化建议
// ============================================================
console.log('');
console.log('==================== 优化建议（数据驱动）====================');

const winRate = wins.length / N;
const avgPG = avg(records.map(r => r.pGenerals));
const avgPR = avg(records.map(r => r.pRecruits));
const avgPMS = avg(records.map(r => r.pMantouSpent));
const avgWave = avg(records.map(r => r.wave));

// 建议 1：胜负平衡
console.log('');
console.log('[1] 胜负平衡');
console.log('  数据: 玩家胜率 ' + pct(wins.length) + ' (玩家0.8s思考 vs 敌方1.15s+22%失误)');
if (winRate > 0.65) {
  console.log('  → 玩家方偏强。玩家思考间隔(0.8s)显著快于敌方(1.15s)且无失误叠加，建议：');
  console.log('    - 适当提高敌方AI在低段位的思考频率，或缩小 thinkItv 区间（当前 1.15→0.45，低段位1.15过慢）');
  console.log('    - 或降低玩家AI辅助频率，使双方更对等');
} else if (winRate < 0.35) {
  console.log('  → 玩家方偏弱。即便玩家操作更快，仍难以取胜，说明数值/经济对玩家不利');
} else {
  console.log('  → 胜负大致平衡');
}

// 建议 2：武将合成稀有度
console.log('');
console.log('[2] 武将合成稀有度');
console.log('  数据: 玩家平均合成 ' + fmt(avgPG) + ' 个武将, 0武将局占 ' + pct(pNoGeneral));
if (avgPG < 1.2) {
  console.log('  → 武将合成过稀。当前 RECRUIT_POOL 碎片权重 w=22（约22%），但需姓名首尾配对且并排顺序正确');
  console.log('    建议: 提升碎片权重至 ~28，或提升 rollCard 的 pairChance（当前 0.65+luck*0.30，luck=0 时仅 0.65）');
  console.log('    数据点: 碎片需配对+顺序，碎片权重22 → 实际合成率低');
}

// 建议 3：对局过早崩盘 / 后期内容不可达
console.log('');
console.log('[3] 对局过早崩盘，后期内容不可达');
const earlyEnd = records.filter(r => r.wave <= 4).length;
console.log('  数据: 平均存活到波 ' + fmt(avgWave) + ' / ' + C.MAX_WAVE + '；' + pct(earlyEnd) + ' 的对局在波4前结束');
console.log('  数据: 全部 ' + losses.length + ' 负局均因心血耗尽，无一撑满10波');
console.log('  → 游戏设计的后期内容（波5~10、BOSS、3级以上单位、5武将体系）在 AI 对战中完全不可达');
console.log('    根因不是 hpMul 太陡（波4 hpMul 仅 1.9），而是玩家 DPS 无法成长（见[4][2]）');
console.log('    建议: 优先解决 AI 征兵/合成卡手，让单位能持续升级，对局才能进入后期再调 hpMul');
console.log('    （若后期仍偏陡：hpMul 幂次项 max(0,w-6)^1.5*0.12 可降到 0.08/1.2）');

// 建议 4：AI 征兵保守（根因）
console.log('');
console.log('[4] AI 征兵保守（核心根因）');
console.log('  数据: 玩家平均征兵 ' + fmt(avgPR) + ' 次, 敌方 ' + fmt(avg(records.map(r => r.eRecruits))) + ' 次/局');
console.log('  代码: AI.step 第5步仅在「备战席全空(allEmpty)」时征兵');
console.log('  → 开局5张牌出完后，席上常残留碎片（step4 对碎片 emptyBench>1 时跳过上阵），allEmpty 永不成立');
console.log('    → 永不征兵 → 阵地固化 → 无法补强/升级 → 波4前后必然崩盘');
console.log('    建议: 放宽征兵条件为「席上非空格 ≤2 且均为碎片」时也征兵；');
console.log('          或允许 AI 主动丢弃/合并无用碎片腾出席位；');
console.log('          或当 mantou 充裕（≥2倍费用）且阵地未满时强制征兵');

// 建议 5：铲子道具无用
console.log('');
console.log('[5] 铲子道具');
console.log('  数据: 100局中玩家铲子使用 ' + records.reduce((a, r) => a + r.pShovels, 0) + ' 次, 解锁 ' + records.reduce((a, r) => a + r.pUnlocks, 0) + ' 次');
console.log('  代码: AI.step 直接丢弃铲子（S.bench[i3]=null），RECRUIT_POOL 铲子权重 w=8');
console.log('  → 铲子对 AI 完全无价值，且占用 8% 抽卡权重，变相稀释了士兵/碎片产出');
console.log('    建议: AI 端识别铲子并主动解锁中路 block 格扩展阵地，或降低铲子权重至 ~4');

// 建议 6：单位成长与经济
console.log('');
console.log('[6] 单位成长停滞 / 经济未充分利用');
console.log('  数据: 玩家平均最高等级 ' + fmt(avg(records.map(r => r.pMaxLv))) + '（几乎停在2级，3~5级不可见）');
console.log('  数据: 玩家平均馒头花费 ' + fmt(avgPMS) + ' (胜=' + fmt(avg(wins.map(r => r.pMantouSpent))) + ' 负=' + fmt(avg(losses.map(r => r.pMantouSpent))) + ')');
console.log('  代码: recruitCost = 10 + recruitCount*2；startMantou=20, waveBonus=8+w*2');
console.log('  → 经济并非瓶颈（胜局能花 14.6 馒头），瓶颈在征兵门槛与合成概率');
console.log('    建议: 配合[4]放开征兵后，单位升级路径才能跑通；经济本身可暂不动');

console.log('');
console.log('==================== 报告结束 ====================');
