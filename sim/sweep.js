'use strict';
// 批量段位扫描：为每个 rank 启动独立子进程跑 N 局，收集胜率等指标
// 用法:
//   node sim/sweep.js                 // 默认 11 段位 × 300 局
//   node sim/sweep.js 300             // 指定每段位局数
//   node sim/sweep.js 300 0 10        // 指定每段位局数 + 起止 rank
// 每个 rank 用 subLevel=1, stars=0 作为代表点
// 输出汇总表，并在末尾打印 SWEEP_ALL JSON 数组便于二次解析

const { execSync } = require('child_process');
const path = require('path');

const ARGS = process.argv.slice(2);
const PER_RANK = ARGS[0] ? parseInt(ARGS[0], 10) : 300;
const RANK_FROM = ARGS[1] !== undefined ? parseInt(ARGS[1], 10) : 0;
const RANK_TO = ARGS[2] !== undefined ? parseInt(ARGS[2], 10) : 10;

const RANK_NAMES = [
  '力士', '天兵', '天将', '星官', '星君',
  '真君', '元帅', '天王', '大帝', '天尊',
  '玉皇大天尊'
];
const SUB_LEVELS_PER_RANK = 5;
const STARS_PER_RANK = 5;
const TOTAL = RANK_NAMES.length * SUB_LEVELS_PER_RANK * STARS_PER_RANK; // 275

const RUN_JS = path.join(__dirname, 'run.js');
const results = [];

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
function padL(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }
function f2(n) { return Number(n).toFixed(2); }
function f3(n) { return Number(n).toFixed(3); }

console.log('=== 段位批量扫描 ===');
console.log('每段位局数: ' + PER_RANK + ' | 段位范围: rank ' + RANK_FROM + '~' + RANK_TO
  + ' (' + RANK_NAMES[RANK_FROM] + '~' + RANK_NAMES[RANK_TO] + ')');
console.log('代表点: 每个 rank 的 subLevel=1, stars=0');
console.log('');

for (let r = RANK_FROM; r <= RANK_TO; r++) {
  const ratio = (r * SUB_LEVELS_PER_RANK * STARS_PER_RANK) / TOTAL;
  process.stdout.write('[' + (r - RANK_FROM + 1) + '/' + (RANK_TO - RANK_FROM + 1)
    + '] rank ' + r + ' ' + RANK_NAMES[r] + ' ... ');
  let stdout;
  try {
    stdout = execSync('node "' + RUN_JS + '" ' + r + ' 1 0 ' + PER_RANK, {
      env: Object.assign({}, process.env, { SWEEP: '1' }),
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024
    }).toString();
  } catch (e) {
    console.log('FAILED: ' + (e.stderr ? e.stderr.toString().slice(0, 200) : e.message));
    continue;
  }
  const line = stdout.split('\n').find(l => l.startsWith('SWEEP_RESULT '));
  if (!line) { console.log('NO RESULT LINE'); continue; }
  const s = JSON.parse(line.slice('SWEEP_RESULT '.length));
  results.push(s);
  console.log('胜率=' + (s.winRate * 100).toFixed(1) + '%  波=' + f2(s.avgWave)
    + '  等级P/E=' + f2(s.avgPMaxLv) + '/' + f2(s.avgEMaxLv)
    + '  征兵P/E=' + f2(s.avgPRecruits) + '/' + f2(s.avgERecruits));
}

// ---------- 汇总表 ----------
console.log('');
console.log('==================== 汇总表 ====================');
const H = ['rank', '段位', 'ratio', 'thinkItv', 'missRate', 'luck', '胜率', '平局%', 'avg波', 'avg时长s', 'P最高Lv', 'E最高Lv', 'P征兵', 'E征兵'];
const W = [4, 14, 6, 9, 9, 6, 7, 6, 6, 9, 8, 8, 6, 6];
console.log(H.map((h, i) => padL(h, W[i])).join(' | '));
console.log('-'.repeat(H.reduce((a, h, i) => a + W[i] + 3, 0)));
results.forEach(s => {
  const row = [
    s.rank, s.rankName, f3(s.ratio), f3(s.thinkItv), f3(s.missRate), f3(s.luck),
    (s.winRate * 100).toFixed(1) + '%',
    (s.draws / s.N * 100).toFixed(1) + '%',
    f2(s.avgWave), f2(s.avgTime), f2(s.avgPMaxLv), f2(s.avgEMaxLv),
    f2(s.avgPRecruits), f2(s.avgERecruits)
  ];
  console.log(row.map((c, i) => padL(c, W[i])).join(' | '));
});

// ---------- 问题段位标注 ----------
console.log('');
console.log('--- 目标区间检查 (40%~60%) ---');
results.forEach(s => {
  const wr = s.winRate;
  let tag = 'OK';
  if (wr > 0.60) tag = '太容易(>60%)';
  else if (wr < 0.40) tag = '太难(<40%)';
  console.log('  rank ' + s.rank + ' ' + s.rankName + ': '
    + (wr * 100).toFixed(1) + '%  ' + tag);
});

// 末尾输出整体 JSON 便于二次解析
console.log('');
console.log('SWEEP_ALL ' + JSON.stringify(results));
