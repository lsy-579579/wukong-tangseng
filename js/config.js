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
  // 西游记版本：悟空、八戒、沙僧、唐三、白龙
  C.FRAG_MAP = {
    '悟': ['悟空', '空'], '空': ['悟空', '悟'],
    '八': ['八戒', '戒'], '戒': ['八戒', '八'],
    '沙': ['沙僧', '僧'], '僧': ['沙僧', '沙'],
    '唐': ['唐三', '三'], '三': ['唐三', '唐'],
    '白': ['白龙', '龙'], '龙': ['白龙', '白']
  };
  C.FRAG_CHARS = ['悟', '空', '八', '戒', '沙', '僧', '唐', '三', '白', '龙'];

  C.GENERALS = {
    '悟空': { dmg: 150, itv: 0.7,  range: 3.6, skill: 'pierce',  desc: '如意棒·贯穿直线' },
    '八戒': { dmg: 120, itv: 1.2,  range: 1.8, skill: 'stun',    desc: '九齿钯·范围眩晕' },
    '沙僧': { dmg: 260, itv: 1.3,  range: 2.2, skill: 'execute', desc: '降妖杖·斩杀残敌' },
    '唐三': { dmg: 85,  itv: 0.38, range: 4.5, skill: 'snipe',   desc: '紧箍咒·速射' },
    '白龙': { dmg: 60,  itv: 1.0,  range: 2.6, skill: 'aura',    desc: '龙息·友军攻击+20%' }
  };

  // 征兵抽取权重（每次征兵直接替换整个备战席为5张随机卡牌，原版机制）
  // 调优：铲子对 AI 无价值且稀释产出，权重 8→4；碎片合成率过低，22→26
  C.RECRUIT_POOL = [
    { kind: 's', w: 70 },    // 士兵
    { kind: 'f', w: 26 },    // 武将碎片
    { kind: 'shovel', w: 4 } // 铲子道具（可解锁任意绿色 block 格为 build 格）
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

  C.LEVEL_NAME = '火焰山';
  C.MAX_WAVE = 10; // 撑过即判定胜利（若对手先失守则提前胜利）

  // 玩家头像（西游记5位主角，程序化绘制人物画像）
  C.AVATARS = ['wukong', 'bajie', 'shaseng', 'tangsan', 'bailong'];
  C.AVATAR_LABELS = { wukong: '悟空', bajie: '八戒', shaseng: '沙僧', tangsan: '唐三', bailong: '白龙' };
  C.AVATAR_DEFAULT = 'wukong';

  // 玩家段位（11 级）：每级 5 阶（一~五），每阶满 5 星后再通关一次升下一阶
  C.RANKS = [
    '力士', '天兵', '天将', '星官', '星君',
    '真君', '元帅', '天王', '大帝', '天尊',
    '玉皇大天尊'
  ];
  C.SUB_LEVELS = ['一', '二', '三', '四', '五'];
  C.SUB_LEVELS_PER_RANK = 5; // 每级内部分阶数
  C.STARS_PER_RANK = 5; // 每阶满星数

  ZY.C = C;
})();
