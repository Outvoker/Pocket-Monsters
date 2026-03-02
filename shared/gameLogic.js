/**
 * Pocket Monsters - Shared Game Logic
 * Hand evaluation, deck management, and power calculation
 */

// ─── Type / Suit definitions ────────────────────────────────────────────────
const TYPES = {
  FIRE:     { id: 'fire',     label: '火系', color: '#FF6B35', emoji: '🔥' },
  WATER:    { id: 'water',    label: '水系', color: '#4FC3F7', emoji: '💧' },
  GRASS:    { id: 'grass',    label: '草系', color: '#66BB6A', emoji: '🌿' },
  ELECTRIC: { id: 'electric', label: '电系', color: '#FFD600', emoji: '⚡' },
};

// ─── Pokemon deck data (52 cards: 4 types × 13 values, 1=weakest → 13=strongest)
// Primarily Gen 1 iconic Pokémon, strength increases with value
const POKEMON_DATA = {
  fire: [
    { id: 4,   name: 'Charmander', zhName: '小火龙',     value: 1  },
    { id: 37,  name: 'Vulpix',     zhName: '六尾',       value: 2  },
    { id: 58,  name: 'Growlithe',  zhName: '卡蒂狗',     value: 3  },
    { id: 77,  name: 'Ponyta',     zhName: '小火马',     value: 4  },
    { id: 5,   name: 'Charmeleon', zhName: '火恐龙',     value: 5  },
    { id: 126, name: 'Magmar',     zhName: '鸭嘴火焰龙', value: 6  },
    { id: 38,  name: 'Ninetales',  zhName: '九尾',       value: 7  },
    { id: 78,  name: 'Rapidash',   zhName: '烈焰马',     value: 8  },
    { id: 136, name: 'Flareon',    zhName: '火伊布',     value: 9  },
    { id: 59,  name: 'Arcanine',   zhName: '风速狗',     value: 10 },
    { id: 146, name: 'Moltres',    zhName: '火焰鸟',     value: 11 },
    { id: 244, name: 'Entei',      zhName: '炎帝',       value: 12 },
    { id: 6,   name: 'Charizard',  zhName: '喷火龙',     value: 13 },
  ],
  water: [
    { id: 129, name: 'Magikarp',   zhName: '鲤鱼王',     value: 1  },
    { id: 7,   name: 'Squirtle',   zhName: '杰尼龟',     value: 2  },
    { id: 54,  name: 'Psyduck',    zhName: '可达鸭',     value: 3  },
    { id: 60,  name: 'Poliwag',    zhName: '蚊香蝌蚪',   value: 4  },
    { id: 79,  name: 'Slowpoke',   zhName: '呆呆兽',     value: 5  },
    { id: 118, name: 'Goldeen',    zhName: '角金鱼',     value: 6  },
    { id: 72,  name: 'Tentacool',  zhName: '玛瑙水母',   value: 7  },
    { id: 8,   name: 'Wartortle',  zhName: '甲壳龟',     value: 8  },
    { id: 121, name: 'Starmie',    zhName: '星形宝石',   value: 9  },
    { id: 134, name: 'Vaporeon',   zhName: '水伊布',     value: 10 },
    { id: 131, name: 'Lapras',     zhName: '乘龙',       value: 11 },
    { id: 130, name: 'Gyarados',   zhName: '暴鲤龙',     value: 12 },
    { id: 9,   name: 'Blastoise',  zhName: '水箭龟',     value: 13 },
  ],
  grass: [
    { id: 43,  name: 'Oddish',     zhName: '走路草',     value: 1  },
    { id: 69,  name: 'Bellsprout', zhName: '喇叭芽',     value: 2  },
    { id: 46,  name: 'Paras',      zhName: '派拉斯',     value: 3  },
    { id: 102, name: 'Exeggcute',  zhName: '蛋蛋',       value: 4  },
    { id: 114, name: 'Tangela',    zhName: '蔓藤怪',     value: 5  },
    { id: 1,   name: 'Bulbasaur',  zhName: '妙蛙种子',   value: 6  },
    { id: 44,  name: 'Gloom',      zhName: '臭臭花',     value: 7  },
    { id: 70,  name: 'Weepinbell', zhName: '喇叭花',     value: 8  },
    { id: 2,   name: 'Ivysaur',    zhName: '妙蛙草',     value: 9  },
    { id: 103, name: 'Exeggutor',  zhName: '椰蛋树',     value: 10 },
    { id: 71,  name: 'Victreebel', zhName: '大食花',     value: 11 },
    { id: 45,  name: 'Vileplume',  zhName: '霸王花',     value: 12 },
    { id: 3,   name: 'Venusaur',   zhName: '妙蛙花',     value: 13 },
  ],
  electric: [
    { id: 100, name: 'Voltorb',    zhName: '霹雳球',     value: 1  },
    { id: 81,  name: 'Magnemite',  zhName: '小磁怪',     value: 2  },
    { id: 82,  name: 'Magneton',   zhName: '三合磁怪',   value: 3  },
    { id: 25,  name: 'Pikachu',    zhName: '皮卡丘',     value: 4  },
    { id: 101, name: 'Electrode',  zhName: '顿顿球',     value: 5  },
    { id: 125, name: 'Electabuzz', zhName: '电击怪',     value: 6  },
    { id: 26,  name: 'Raichu',     zhName: '雷丘',       value: 7  },
    { id: 135, name: 'Jolteon',    zhName: '雷伊布',     value: 8  },
    { id: 181, name: 'Ampharos',   zhName: '电龙',       value: 9  },
    { id: 405, name: 'Luxray',     zhName: '伦琴猫',     value: 10 },
    { id: 466, name: 'Electivire', zhName: '电击魔兽',   value: 11 },
    { id: 243, name: 'Raikou',     zhName: '雷公',       value: 12 },
    { id: 145, name: 'Zapdos',     zhName: '闪电鸟',     value: 13 },
  ],
};

// ─── Build full deck ──────────────────────────────────────────────────────────
function buildDeck() {
  const deck = [];
  for (const [type, monsters] of Object.entries(POKEMON_DATA)) {
    for (const mon of monsters) {
      deck.push({ ...mon, type });
    }
  }
  return deck;
}

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Hand evaluation ─────────────────────────────────────────────────────────
// Hand rank names (custom Pokemon-themed)
const HAND_RANKS = [
  { rank: 9, key: 'royal_battle',    label: '皇家战队',  desc: '同系最强连击',    power: 900 },
  { rank: 8, key: 'straight_flush',  label: '同系连击',  desc: '同系连续五张',    power: 800 },
  { rank: 7, key: 'four_of_a_kind',  label: '四族合璧',  desc: '四张同点数',      power: 600 },
  { rank: 6, key: 'full_house',      label: '精锐战队',  desc: '三张+两张同点数', power: 450 },
  { rank: 5, key: 'flush',           label: '系出同源',  desc: '五张同系',        power: 350 },
  { rank: 4, key: 'straight',        label: '进化之路',  desc: '五张连续点数',    power: 250 },
  { rank: 3, key: 'three_of_a_kind', label: '三强联合',  desc: '三张同点数',      power: 150 },
  { rank: 2, key: 'two_pair',        label: '双打联盟',  desc: '两组对子',        power: 80  },
  { rank: 1, key: 'one_pair',        label: '同伴出击',  desc: '一组对子',        power: 40  },
  { rank: 0, key: 'high_card',       label: '最强先锋',  desc: '单张最大',        power: 10  },
];

const RANK_MAP = {};
for (const r of HAND_RANKS) RANK_MAP[r.key] = r;

/**
 * Evaluate the best 5-card hand from an array of card objects (up to 7).
 * Returns { rankKey, rankLabel, rankPower, bestFive, totalPower }
 */
function evaluateBestHand(cards) {
  if (cards.length < 5) {
    // pad with the cards we have
    const partial = evaluateHand(cards);
    return partial;
  }

  // Generate all C(n,5) combinations
  const combos = combinations(cards, 5);
  let best = null;

  for (const combo of combos) {
    const result = evaluateHand(combo);
    if (!best || compareHandResult(result, best) > 0) {
      best = result;
    }
  }
  return best;
}

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluateHand(cards) {
  const values = cards.map(c => c.value).sort((a, b) => b - a);
  const types  = cards.map(c => c.type);

  const valueCounts = {};
  for (const v of values) valueCounts[v] = (valueCounts[v] || 0) + 1;

  const counts = Object.values(valueCounts).sort((a, b) => b - a);
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  const isFlush    = new Set(types).size === 1;
  const isStraight = checkStraight(uniqueValues, values);
  const isAceLow   = checkAceLowStraight(values); // A(13) used as low

  const sortedByFreq = sortByFrequency(valueCounts);

  let rankKey;
  if (isFlush && isStraight && values[0] === 13) {
    rankKey = 'royal_battle';
  } else if (isFlush && (isStraight || isAceLow)) {
    rankKey = 'straight_flush';
  } else if (counts[0] === 4) {
    rankKey = 'four_of_a_kind';
  } else if (counts[0] === 3 && counts[1] === 2) {
    rankKey = 'full_house';
  } else if (isFlush) {
    rankKey = 'flush';
  } else if (isStraight || isAceLow) {
    rankKey = 'straight';
  } else if (counts[0] === 3) {
    rankKey = 'three_of_a_kind';
  } else if (counts[0] === 2 && counts[1] === 2) {
    rankKey = 'two_pair';
  } else if (counts[0] === 2) {
    rankKey = 'one_pair';
  } else {
    rankKey = 'high_card';
  }

  const rankInfo = RANK_MAP[rankKey];
  // Bonus power: weighted sum of top-5 card values sorted by frequency/strength
  // Max possible bonus = 13*5 + 13*4 + 13*3 + 13*2 + 13*1 = 195
  // Base = rank * 200, guaranteeing higher rank ALWAYS beats lower rank regardless of bonus
  const highCardBonus = sortedByFreq.slice(0, 5).reduce((s, v, i) => s + v * (5 - i), 0);
  const totalPower = rankInfo.rank * 200 + highCardBonus;

  return {
    rankKey,
    rankLabel: rankInfo.label,
    rankDesc:  rankInfo.desc,
    rankPower: rankInfo.power,
    rank:      rankInfo.rank,
    totalPower,
    bestFive:  cards,
    sortedByFreq,
    highCardBonus,
  };
}

function checkStraight(uniqueValues, allValues) {
  if (uniqueValues.length < 5) return false;
  const top5 = uniqueValues.slice(0, 5);
  return top5[0] - top5[4] === 4;
}

function checkAceLowStraight(values) {
  // A(13)-2-3-4-5 straight
  const set = new Set(values);
  return set.has(13) && set.has(2) && set.has(3) && set.has(4) && set.has(5);
}

function sortByFrequency(valueCounts) {
  return Object.entries(valueCounts)
    .sort(([va, ca], [vb, cb]) => cb - ca || Number(vb) - Number(va))
    .map(([v]) => Number(v));
}

function compareHandResult(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  // Same rank – compare by sorted card values
  for (let i = 0; i < Math.min(a.sortedByFreq.length, b.sortedByFreq.length); i++) {
    if (a.sortedByFreq[i] !== b.sortedByFreq[i]) {
      return a.sortedByFreq[i] - b.sortedByFreq[i];
    }
  }
  return 0;
}

// ─── Game phases ──────────────────────────────────────────────────────────────
const PHASES = {
  WAITING:  'waiting',
  PREFLOP:  'preflop',
  FLOP:     'flop',
  TURN:     'turn',
  RIVER:    'river',
  SHOWDOWN: 'showdown',
};

const ACTIONS = {
  FOLD:  'fold',
  CHECK: 'check',
  CALL:  'call',
  RAISE: 'raise',
  ALLIN: 'allin',
};

// ─── Sprite URL helper ────────────────────────────────────────────────────────
function spriteUrl(pokemonId) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

// Export for both Node.js and browser
const GameLogic = {
  TYPES, POKEMON_DATA, HAND_RANKS, RANK_MAP, PHASES, ACTIONS,
  buildDeck, shuffle, evaluateBestHand, evaluateHand, spriteUrl, compareHandResult,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameLogic;
} else {
  window.GameLogic = GameLogic;
}
