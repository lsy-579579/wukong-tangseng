// 游戏数值配置（对齐原版：刀枪弓骑平行兵种 + 金色武将碎片 + 馒头经济）
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};

  var C = {};

  // 四大基础兵种：同字同级二合一升级，等级 1~5
  // dmg/hp 按等级乘 C.lvMul(lv)
  C.SOLDIERS = {
    '刀': { name: '刀兵', dmg: 16, itv: 0.75, range: 1.35, hp: 120 },
    '枪': { name: '枪兵', dmg: 24, itv: 0.95, range: 1.8,  hp: 110 },
    '弓': { name: '弓兵', dmg: 13, itv: 0.55, range: 3.2,  hp: 80  },
    '骑': { name: '骑兵', dmg: 34, itv: 1.15, range: 1.5,  hp: 150 }
  };
  C.SOLDIER_CHARS = ['刀', '枪', '弓', '骑'];
  C.MAX_LV = 5;
  C.lvMul = function (lv) { return Math.pow(2.1, lv - 1); };

  // 武将：征兵抽到金色单字碎片（不能作战，纯占格），拼齐姓名觉醒
  C.FRAG_MAP = {
    '赵': ['赵云', '云'], '云': ['赵云', '赵'],
    '张': ['张飞', '飞'], '飞': ['张飞', '张'],
    '关': ['关羽', '羽'], '羽': ['关羽', '关'],
    '黄': ['黄忠', '忠'], '忠': ['黄忠', '黄'],
    '刘': ['刘备', '备'], '备': ['刘备', '刘']
  };
  C.FRAG_CHARS = ['赵', '云', '张', '飞', '关', '羽', '黄', '忠', '刘', '备'];

  C.GENERALS = {
    '赵云': { dmg: 150, itv: 0.7,  range: 3.6, skill: 'pierce',  desc: '龙胆枪·贯穿直线' },
    '张飞': { dmg: 120, itv: 1.2,  range: 1.8, skill: 'stun',    desc: '燕人吼·范围眩晕' },
    '关羽': { dmg: 260, itv: 1.3,  range: 2.2, skill: 'execute', desc: '青龙斩·斩杀残敌' },
    '黄忠': { dmg: 85,  itv: 0.38, range: 4.5, skill: 'snipe',   desc: '百步穿杨·速射' },
    '刘备': { dmg: 60,  itv: 1.0,  range: 2.6, skill: 'aura',    desc: '仁德·友军攻击+20%' }
  };

  // 征兵抽取权重
  C.RECRUIT_POOL = [
    { kind: 's', w: 76 },   // 士兵
    { kind: 'f', w: 24 }    // 武将碎片
  ];

  // 敌人
  C.ENEMIES = {
    zei:  { ch: '贼', hp: 60,   spd: 1.05, mantou: 2, size: 0.62 },
    dao:  { ch: '盗', hp: 130,  spd: 0.9,  mantou: 3, size: 0.66 },
    kou:  { ch: '寇', hp: 280,  spd: 0.75, mantou: 5, size: 0.7  },
    fei:  { ch: '匪', hp: 150,  spd: 1.5,  mantou: 4, size: 0.6  },
    boss: { ch: '曹', hp: 1100, spd: 0.5, mantou: 30, size: 0.95, boss: true }
  };
  C.hpMul = function (wave) {
    return 1 + (wave - 1) * 0.3 + Math.pow(Math.max(0, wave - 6), 1.5) * 0.12;
  };

  C.ECON = {
    startMantou: 20,
    recruitBase: 10,
    recruitInc: 2,
    hearts: 3,
    benchSize: 5,
    waveBonus: function (w) { return 8 + w * 2; }
  };

  C.LEVEL_NAME = '长坂坡';
  C.MAX_WAVE = 10; // 撑过即判定胜利（若对手先失守则提前胜利）

  // 玩家段位（11 级）：每升 1 级 = 当前等级满 5 星后再通关一次
  C.RANKS = [
    '力士', '天兵', '天将', '星官', '星君',
    '真君', '元帅', '天王', '大帝', '天尊',
    '玉皇大天尊'
  ];
  C.STARS_PER_RANK = 5; // 每级满星数

  ZY.C = C;
})();
