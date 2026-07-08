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

  // 武将基础数值（已下调，需配武器才能恢复强度）
  // 未装备武器时只有基础攻击；装备武器后伤害+武器加成，攻击特效变为武器造型
  C.GENERALS = {
    '悟空': { dmg: 90,  itv: 0.7,  range: 3.6, skill: 'pierce',  desc: '如意棒·贯穿直线' },
    '八戒': { dmg: 72,  itv: 1.2,  range: 1.8, skill: 'stun',    desc: '九齿钯·范围眩晕' },
    '沙僧': { dmg: 156, itv: 1.3,  range: 2.2, skill: 'execute', desc: '降妖杖·斩杀残敌' },
    '唐三': { dmg: 51,  itv: 0.38, range: 4.5, skill: 'snipe',   desc: '紧箍咒·速射' },
    '白龙': { dmg: 36,  itv: 1.0,  range: 2.6, skill: 'aura',    desc: '龙息·友军攻击+20%' }
  };
  // 5位主角名（用于武器装备绑定）
  C.GENERAL_NAMES = ['悟空', '八戒', '沙僧', '唐三', '白龙'];

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
    boss: { ch: '牛', hp: 1100, spd: 0.5, mantou: 30, size: 0.95, boss: true }
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

  // ============ 武器系统 ============
  // 4品质 × 5件 = 20件武器
  // 品质色 + 掉落概率 + 合成所需碎片数
  C.WEAPON_QUALITY = {
    green:  { name: '凡品', color: '#5aa860', drop: 0.10, fragNeed: 0 }, // 绿色成品直接掉落
    blue:   { name: '良品', color: '#4a8ad4', drop: 0.05, fragNeed: 0 }, // 蓝色成品直接掉落
    purple: { name: '珍品', color: '#a85ef0', drop: 0.02, fragNeed: 3 }, // 紫色3碎片合成
    orange: { name: '神器', color: '#e8a23a', drop: 0.01, fragNeed: 5 }  // 橙色5碎片合成
  };
  C.WEAPON_QUALITY_ORDER = ['green', 'blue', 'purple', 'orange'];

  // 武器列表：每件武器有 id/name/quality/owner(可选,角色名)/dmg(加成)/shape(弹道造型)
  // 橙色5件：5位主角专属神器
  // 紫色5件：西游经典法宝
  // 蓝色5件：精良兵器
  // 绿色5件：凡间兵器
  C.WEAPONS = [
    // ===== 橙色神器（5件，主角专属，5碎片合成） =====
    { id: 'dinghai',   name: '定海神针', quality: 'orange', owner: '悟空', dmg: 90, shape: 'staff',  desc: '如意金箍棒·一万三千五百斤' },
    { id: 'dingba',    name: '九齿钉耙', quality: 'orange', owner: '八戒', dmg: 80, shape: 'rake',   desc: '上宝沁金耙·天庭御赐' },
    { id: 'jiangyao',  name: '降妖宝杖', quality: 'orange', owner: '沙僧', dmg: 130, shape: 'monkspade', desc: '降妖真宝杖·月宫梭罗' },
    { id: 'xizhang',   name: '九环锡杖', quality: 'orange', owner: '唐三', dmg: 50, shape: 'crosier', desc: '唐王所赐·化缘专用' },
    { id: 'longzhu',   name: '渊海明珠', quality: 'orange', owner: '白龙', dmg: 40, shape: 'pearl',  desc: '西海龙宫·夜明珠' },

    // ===== 紫色珍品（5件，通用法宝，3碎片合成） =====
    { id: 'bajiaoshan', name: '芭蕉扇',   quality: 'purple', dmg: 60, shape: 'fan',    desc: '铁扇公主·一扇熄火' },
    { id: 'huluping',   name: '紫金葫芦', quality: 'purple', dmg: 55, shape: 'gourd',  desc: '金角大王·我叫你敢应吗' },
    { id: 'qixingjian', name: '七星剑',   quality: 'purple', dmg: 65, shape: 'sword',  desc: '天庭神器·斩妖除魔' },
    { id: 'jingping',   name: '羊脂玉净瓶', quality: 'purple', dmg: 50, shape: 'vase',  desc: '观音菩萨·净水甘霖' },
    { id: 'huangjinrope', name: '幌金绳', quality: 'purple', dmg: 45, shape: 'rope',   desc: '九尾狐狸·捆仙索' },

    // ===== 蓝色良品（5件，成品直接掉落） =====
    { id: 'qingfeng',  name: '青锋剑',  quality: 'blue', dmg: 30, shape: 'sword', desc: '寒光凛凛·削铁如泥' },
    { id: 'xuantie',   name: '玄铁盾',  quality: 'blue', dmg: 22, shape: 'shield', desc: '坚不可摧·防御加成' },
    { id: 'hanbing',   name: '寒冰刃',  quality: 'blue', dmg: 28, shape: 'knife', desc: '北冰寒铁·附带冰冻' },
    { id: 'liehuo',    name: '烈火枪',  quality: 'blue', dmg: 32, shape: 'spear', desc: '南焰火精·灼烧敌军' },
    { id: 'fenglei',   name: '风雷弓',  quality: 'blue', dmg: 24, shape: 'bow',   desc: '风雷相激·万里穿杨' },

    // ===== 绿色凡品（5件，成品直接掉落） =====
    { id: 'liumu',     name: '柳木剑',  quality: 'green', dmg: 12, shape: 'sword', desc: '乡野常见·聊胜于无' },
    { id: 'zhujie',    name: '竹节鞭',  quality: 'green', dmg: 14, shape: 'whip',  desc: '竹节所制·灵活轻便' },
    { id: 'tiegong',   name: '铁背弓',  quality: 'green', dmg: 10, shape: 'bow',   desc: '猎户标配·精度尚可' },
    { id: 'mutong',    name: '木铜盾',  quality: 'green', dmg: 8,  shape: 'shield', desc: '包铜木盾·抵御流矢' },
    { id: 'shifu',     name: '石斧',    quality: 'green', dmg: 16, shape: 'axe',   desc: '粗石打磨·力大无穷' }
  ];
  // 按 id 索引方便查询
  C.WEAPON_MAP = {};
  C.WEAPONS.forEach(function (w) { C.WEAPON_MAP[w.id] = w; });

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
