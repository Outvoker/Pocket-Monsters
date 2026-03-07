const express  = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const path      = require('path');
const fs        = require('fs');
const GL        = require('./shared/gameLogic');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
let leaderboard = {};
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');

const BLIND_LEVELS = [           // [small, big]
  [10,  20],
  [20,  40],
  [40,  80],
  [80,  160],
  [150, 300],
  [250, 500],
  [500, 1000],
];
const ROUNDS_PER_BLIND_LEVEL = 5; // increase blinds every 5 rounds

class RoomState {
  constructor(id, hostName) {
    this.id            = id;
    this.hostId        = null;
    this.hostName      = hostName;
    this.players       = [];
    this.phase         = GL.PHASES.WAITING;
    this.deck          = [];
    this.community     = [];
    this.pot           = 0;
    this.currentBet    = 0;
    this.turnIndex     = 0;
    this.dealerIdx     = 0;
    this.needsToAct    = new Set();
    this.smallBlind    = 10;
    this.bigBlind      = 20;
    this.maxPlayers    = 8;
    this.minPlayers    = 2;
    this.winners       = [];
    this.roundCount    = 0;       // total rounds played
    this.blindLevel    = 0;       // index into BLIND_LEVELS
    this.finalChampion = null;    // set when only 1 active player remains
    this.raiseCount    = 0;       // track raises in current betting round
    this.sidePots      = [];      // side pot breakdown [{ amount, eligiblePlayerIds }]
    this.potBreakdown  = null;    // per-pot winner info after showdown
    this.playerStats   = {};      // per-player action stats for opponent modeling
  }
  // Active-round participants (non-spectator)
  activePlayers()    { return this.players.filter(p => !p.folded && !p.allIn && !p.spectator); }
  nonFoldedPlayers() { return this.players.filter(p => !p.folded && !p.spectator); }
  roundPlayers()     { return this.players.filter(p => !p.spectator); }  // playing this round
  playerById(id)     { return this.players.find(p => p.id === id); }
  publicState(forPlayerId) {
    return {
      id: this.id, hostId: this.hostId, phase: this.phase,
      community: this.community, pot: this.pot, currentBet: this.currentBet,
      turnIndex: this.turnIndex, dealerIdx: this.dealerIdx,
      smallBlind: this.smallBlind, bigBlind: this.bigBlind, winners: this.winners,
      roundCount: this.roundCount, blindLevel: this.blindLevel,
      finalChampion: this.finalChampion,
      roundResults: this.roundResults || null,
      tournamentBracket: this.tournamentBracket || null,
      sidePots: this.sidePots || [],
      potBreakdown: this.potBreakdown || null,
      players: this.players.map(p => ({
        id: p.id, name: p.name, chips: p.chips, folded: p.folded, allIn: p.allIn,
        bet: p.bet, totalBet: p.totalBet, connected: p.connected, spectator: !!p.spectator,
        handCount: p.hand ? p.hand.length : 0,
        hand:     (this.phase === GL.PHASES.SHOWDOWN || p.id === forPlayerId) ? p.hand : null,
        bestHand: (this.phase === GL.PHASES.SHOWDOWN || p.id === forPlayerId) ? p.bestHand : null,
        isBot:    !!p.isBot,
      })),
    };
  }
}

function makePlayer(id, name) {
  return { id, name, chips:1000, hand:[], folded:false, allIn:false,
           bet:0, totalBet:0, connected:true, bestHand:null, isBot:false };
}

function loadLeaderboard() {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
      leaderboard = JSON.parse(data);
      console.log(`📊 Loaded ${Object.keys(leaderboard).length} leaderboard entries`);
    } else {
      console.log('📊 No existing leaderboard file, starting fresh');
    }
  } catch (err) {
    console.error('❌ Error loading leaderboard:', err);
    leaderboard = {};
  }
}

function saveLeaderboard() {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Error saving leaderboard:', err);
  }
}

function updateLeaderboard(playerName, chips) {
  if (!playerName || playerName.startsWith('训练家')) return;
  const delta = chips - 1000;
  if (!leaderboard[playerName]) {
    leaderboard[playerName] = { name: playerName, totalScore: 0, gamesPlayed: 0 };
  }
  leaderboard[playerName].totalScore += delta;
  leaderboard[playerName].gamesPlayed += 1;
  saveLeaderboard();
}

function getLeaderboard() {
  return Object.values(leaderboard)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);
}

// ─── Bot helpers ─────────────────────────────────────────────────────────────
const BOT_NAMES = [
  '小智', '小霞', '小刚', '小茂', '小建', '小遥', '小胜', '小光',
  '大木博士', '武藏', '小次郎', '喵喵', '坂木老大', 
];

function isBotId(id) { return typeof id === 'string' && id.startsWith('BOT_'); }

function makeBotPlayer(name) {
  const id = 'BOT_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  return { id, name, chips:1000, hand:[], folded:false, allIn:false,
           bet:0, totalBet:0, connected:true, bestHand:null, isBot:true };
}

// ─── Bot AI: helper functions ────────────────────────────────────────────────

/**
 * Preflop hand strength: tiered scoring based on pair/suited/gap/highCard.
 * Returns 0..1
 */
function evaluatePreflopStrength(hand) {
  const values = hand.map(c => c.value).sort((a, b) => b - a);
  const types = hand.map(c => c.type);
  const isPair = values[0] === values[1];
  const isSuited = types[0] === types[1];
  const highCard = values[0];
  const gap = Math.abs(values[0] - values[1]);

  if (isPair) {
    if (highCard >= 10) return 0.85 + (highCard / 13) * 0.10;     // high pair: 0.85-0.95
    if (highCard >= 6)  return 0.65 + (highCard / 13) * 0.15;     // medium pair: 0.65-0.80
    return 0.55 + (highCard / 13) * 0.10;                          // low pair: 0.55-0.65
  }
  // Suited connectors (gap ≤ 1, suited)
  if (isSuited && gap <= 1) {
    return 0.42 + (highCard / 13) * 0.13;                          // 0.42-0.55
  }
  // High card hands (at least one ≥ 11)
  if (highCard >= 11) {
    const base = 0.33 + (highCard / 13) * 0.10;
    return base + (isSuited ? 0.05 : 0) + (gap <= 2 ? 0.02 : 0); // 0.33-0.48+
  }
  // Suited with moderate gap
  if (isSuited) {
    return 0.22 + (highCard / 13) * 0.10;                          // 0.22-0.32
  }
  // Weak hand
  const avg = (values[0] + values[1]) / 2;
  return 0.12 + (avg / 13) * 0.15;                                 // 0.12-0.27
}

/**
 * Calculate draw bonus from flush/straight draws.
 * Returns 0..0.20
 */
function calculateDrawBonus(hand, community) {
  const allCards = [...hand, ...community];
  let bonus = 0;
  const flush = GL.countFlushDraw(allCards);
  if (flush.count === 4) bonus += 0.18;
  const straight = GL.countStraightDraw(allCards);
  if (straight.type === 'open-ended') bonus += 0.15;
  else if (straight.type === 'gutshot') bonus += 0.08;
  return bonus;
}

/**
 * Postflop hand strength: rank-based + draw bonus + high card kicker.
 * Returns 0..1
 */
function evaluatePostflopStrength(hand, community) {
  const allCards = [...hand, ...community];
  const result = GL.evaluateBestHand(allCards);
  const baseStrength = result.rank / 9;
  const highCardBonus = (result.highCardBonus || 0) / 195 * 0.15;
  const drawBonus = (community.length < 5) ? calculateDrawBonus(hand, community) : 0;
  return {
    strength: Math.min(1, baseStrength + highCardBonus + drawBonus),
    rank: result.rank,
  };
}

/**
 * Record a player's action for opponent modeling.
 */
function recordPlayerAction(room, playerId, action) {
  if (!room.playerStats[playerId]) {
    room.playerStats[playerId] = { totalActions: 0, aggressiveActions: 0, allinCount: 0 };
  }
  const stats = room.playerStats[playerId];
  stats.totalActions++;
  if (action === GL.ACTIONS.RAISE || action === GL.ACTIONS.ALLIN) {
    stats.aggressiveActions++;
  }
  if (action === GL.ACTIONS.ALLIN) {
    stats.allinCount++;
  }
}

/**
 * Get opponent aggression rate. Looks at the last raiser or the most aggressive
 * non-bot opponent. Returns 0..1, default 0.3 if insufficient data.
 */
function getOpponentAggression(room, botId) {
  let worstAggression = 0.3;
  for (const p of room.players) {
    if (p.id === botId || p.folded || p.spectator) continue;
    const stats = room.playerStats[p.id];
    if (!stats || stats.totalActions < 4) continue;
    const aggr = stats.aggressiveActions / stats.totalActions;
    if (aggr > worstAggression) worstAggression = aggr;
  }
  return worstAggression;
}

/**
 * Check if an opponent is classified as all-in abuser.
 */
function isAllinAbuser(room, botId) {
  for (const p of room.players) {
    if (p.id === botId || p.folded || p.spectator) continue;
    const stats = room.playerStats[p.id];
    if (!stats || stats.totalActions < 4) continue;
    if (stats.allinCount / stats.totalActions > 0.3) return true;
  }
  return false;
}

/**
 * Dedicated all-in defense logic. Returns action or null if not facing all-in.
 */
function botAllinDefense(room, bot, strength, handRank, potOdds, aggression) {
  const toCall = Math.max(0, room.currentBet - bot.bet);
  const bb = room.bigBlind;
  const r = Math.random();

  // Short-stack all-in (≤ 2× BB): always call
  if (toCall <= bb * 2) return { action: GL.ACTIONS.CALL };

  // Made hand rank ≥ 3 (three_of_a_kind+): never fold
  if (handRank >= 3) {
    if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.ALLIN };
  }

  // strength ≥ 0.50 with favorable pot odds: always call
  if (strength >= 0.50 && potOdds < 0.45) {
    if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.ALLIN };
  }

  // strength ≥ 0.40 vs aggressive opponent: 60% call
  if (strength >= 0.40 && (aggression > 0.6 || isAllinAbuser(room, bot.id))) {
    if (r < 0.60) {
      if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
      return { action: GL.ACTIONS.ALLIN };
    }
    return { action: GL.ACTIONS.FOLD };
  }

  // Decent hand with very favorable pot odds
  if (strength >= 0.35 && potOdds < 0.25) {
    if (r < 0.50) {
      if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
      return { action: GL.ACTIONS.ALLIN };
    }
    return { action: GL.ACTIONS.FOLD };
  }

  // Weak hand: mostly fold, rare hero-call 5-8%
  if (strength < 0.30) {
    if (r < 0.06) {
      if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    }
    return { action: GL.ACTIONS.FOLD };
  }

  // Default for middling strength: use pot odds but lean toward folding
  if (strength > potOdds * 1.2) {
    if (r < 0.55) {
      if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    }
    return { action: GL.ACTIONS.FOLD };
  }
  if (r < 0.12) {
    if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
  }
  return { action: GL.ACTIONS.FOLD };
}

/**
 * Pot-size-based raise sizing.
 */
function calcRaiseAmount(room, bot, strength) {
  const bb = room.bigBlind;
  const minR = room.currentBet + bb;
  const maxR = bot.bet + bot.chips;
  if (minR >= maxR) return maxR;

  let ratio;
  if (strength > 0.75) {
    ratio = 0.60 + Math.random() * 0.40;       // 60-100% pot
  } else if (strength > 0.45) {
    ratio = 0.40 + Math.random() * 0.30;       // 40-70% pot
  } else {
    ratio = 0.50 + Math.random() * 0.25;       // 50-75% pot (bluff sizing)
  }
  const potRaise = Math.floor(room.pot * ratio);
  const amt = Math.max(minR, Math.min(potRaise, maxR));
  return amt;
}

/**
 * EV-based decision engine.
 * Returns { action, amount? }
 */
function decideAction(strength, potOdds, aggression, ctx) {
  const { room, bot, canRaise, isPreflop, isPostflop, handRank } = ctx;
  const toCall = Math.max(0, room.currentBet - bot.bet);
  const bb = room.bigBlind;
  const r = Math.random();

  // 5-15% random noise: occasionally make suboptimal play
  const noise = 0.05 + Math.random() * 0.10;

  // ─── No bet to call ───
  if (toCall === 0) {
    // Strong: raise aggressively
    if (strength > 0.65 && canRaise) {
      if (r < 0.85) return { action: GL.ACTIONS.RAISE, amount: calcRaiseAmount(room, bot, strength) };
    }
    // Medium: raise sometimes
    if (strength > 0.40 && canRaise) {
      const raiseRate = isPostflop ? 0.50 : 0.30;
      if (r < raiseRate) return { action: GL.ACTIONS.RAISE, amount: calcRaiseAmount(room, bot, strength) };
    }
    // Weak: occasional bluff
    if (strength <= 0.40 && canRaise && bot.chips > bb * 5) {
      const bluffRate = isPostflop ? 0.20 : 0.12;
      if (r < bluffRate) return { action: GL.ACTIONS.RAISE, amount: calcRaiseAmount(room, bot, strength) };
    }
    return { action: GL.ACTIONS.CHECK };
  }

  // ─── Blind defense: preflop small bets (≤ 2×BB) ───
  if (isPreflop && toCall <= bb * 2) {
    // Most hands should defend blinds against min-raises
    if (strength >= 0.40) {
      // Decent+ hand: always call, sometimes raise
      if (canRaise && r < 0.35) return { action: GL.ACTIONS.RAISE, amount: calcRaiseAmount(room, bot, strength) };
      return { action: GL.ACTIONS.CALL };
    }
    if (strength >= 0.22) {
      // Marginal hand: call ~70%
      if (r < 0.70) return { action: GL.ACTIONS.CALL };
      return { action: GL.ACTIONS.FOLD };
    }
    // Very weak: still call ~30% (blind defense)
    if (r < 0.30) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.FOLD };
  }

  // ─── Facing a bet ───
  // Scale equity down: preflop less discount, postflop more discount
  const equity = strength * (isPreflop ? 0.88 : 0.75);

  // Positive EV: equity > potOdds → call or raise
  if (equity > potOdds) {
    // Random noise: small chance of suboptimal fold
    if (r < noise * 0.5) return { action: GL.ACTIONS.FOLD };

    // Very strong: raise
    if (strength > 0.70 && canRaise && r < 0.80) {
      return { action: GL.ACTIONS.RAISE, amount: calcRaiseAmount(room, bot, strength) };
    }
    // Strong: raise sometimes
    if (strength > 0.55 && canRaise && r < 0.55) {
      return { action: GL.ACTIONS.RAISE, amount: calcRaiseAmount(room, bot, strength) };
    }
    // Call
    if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.ALLIN };
  }

  // Clear negative EV: equity < potOdds * 0.8 → mostly fold
  if (equity < potOdds * 0.8) {
    // Against aggressive opponent: slightly reduce fold rate
    const baseFold = 0.85;
    const foldRate = aggression > 0.6 ? baseFold * 0.70 : baseFold;
    if (r < foldRate) return { action: GL.ACTIONS.FOLD };
    // Stubborn call (bluff catch)
    if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.FOLD };
  }

  // Grey zone: equity between potOdds*0.8 and potOdds
  // Use secondary factors: aggression, stack depth
  const foldBase = 0.55;
  let foldChance = foldBase;
  if (aggression > 0.6) foldChance *= 0.65;    // reduce fold rate vs aggro
  if (bot.chips > room.pot * 3) foldChance *= 0.90; // deep stack → slightly more willing
  if (r < foldChance) return { action: GL.ACTIONS.FOLD };
  if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
  return { action: GL.ACTIONS.FOLD };
}

/**
 * Smart bot AI: returns { action, amount? }
 * Uses pot odds, opponent modeling, draw detection, and all-in defense.
 */
function botDecide(room, bot) {
  const toCall = Math.max(0, room.currentBet - bot.bet);
  const bb = room.bigBlind;
  const potOdds = toCall > 0 ? toCall / (room.pot + toCall) : 0;
  const isPreflop = room.community.length === 0;
  const isPostflop = room.community.length >= 3;

  // ── Evaluate hand strength ──
  let strength = 0.35;
  let handRank = 0;

  if (bot.hand && bot.hand.length >= 2) {
    if (isPreflop) {
      strength = evaluatePreflopStrength(bot.hand);
    } else {
      const result = evaluatePostflopStrength(bot.hand, room.community);
      strength = result.strength;
      handRank = result.rank;
    }
  }

  // ── Opponent aggression ──
  const aggression = getOpponentAggression(room, bot.id);

  // ── Raise count limit (prevent infinite loops) ──
  const maxRaises = isPreflop ? 3 : 4;
  const canRaise = room.raiseCount < maxRaises;

  // ── All-in detection & defense ──
  const someoneAllIn = room.players.some(p =>
    p.id !== bot.id && !p.folded && !p.spectator && p.allIn && p.bet >= room.currentBet * 0.8
  );
  const facingHugeBet = toCall > 0 && toCall >= bot.chips * 0.40;

  if (someoneAllIn || facingHugeBet) {
    const defense = botAllinDefense(room, bot, strength, handRank, potOdds, aggression);
    if (defense) return defense;
  }

  // ── Standard EV-based decision ──
  const ctx = { room, bot, canRaise, isPreflop, isPostflop, handRank };
  return decideAction(strength, potOdds, aggression, ctx);
}

function executeBotAction(room, bot) {
  if (room.phase === GL.PHASES.WAITING || room.phase === GL.PHASES.SHOWDOWN) return;
  // Bot can't act (all-in / folded / spectator) — ensure needsToAct is cleaned and advance
  if (bot.folded || bot.allIn || bot.spectator) {
    room.needsToAct.delete(bot.id);
    checkAndAdvance(room);
    return;
  }

  const { action, amount } = botDecide(room, bot);
  recordPlayerAction(room, bot.id, action);
  const toCall = Math.max(0, room.currentBet - bot.bet);
  let logAmount = 0;

  switch (action) {
    case GL.ACTIONS.FOLD:
      bot.folded = true;
      room.needsToAct.delete(bot.id);
      break;
    case GL.ACTIONS.CHECK:
      room.needsToAct.delete(bot.id);
      break;
    case GL.ACTIONS.CALL:
      logAmount = Math.min(toCall, bot.chips);
      addBet(room, bot, logAmount);
      room.needsToAct.delete(bot.id);
      break;
    case GL.ACTIONS.RAISE: {
      if (amount && amount > room.currentBet) {
        const diff = amount - bot.bet;
        addBet(room, bot, Math.min(diff, bot.chips));
        room.currentBet = bot.bet;
        logAmount = bot.bet;
        room.raiseCount++;
        room.needsToAct = new Set(room.activePlayers().filter(p => p.id !== bot.id).map(p => p.id));
      } else {
        room.needsToAct.delete(bot.id);
      }
      break;
    }
    case GL.ACTIONS.ALLIN: {
      const all = bot.chips;
      logAmount = all;
      const newTotal = bot.bet + all;
      addBet(room, bot, all);
      if (newTotal > room.currentBet) {
        room.currentBet = newTotal;
        room.raiseCount++;
        room.needsToAct = new Set(room.activePlayers().filter(p => p.id !== bot.id).map(p => p.id));
      } else {
        room.needsToAct.delete(bot.id);
      }
      break;
    }
  }
  broadcastActionLog(room, bot, action, logAmount);
  checkAndAdvance(room);
}

function scheduleBotAction(room) {
  const current = room.players[room.turnIndex];
  if (!current || !current.isBot) return;
  if (room.phase === GL.PHASES.WAITING || room.phase === GL.PHASES.SHOWDOWN) return;
  if (room._autoRevealing) return;  // don't interfere during board auto-reveal
  // Bot can't act — clean up and advance immediately instead of freezing
  if (current.folded || current.allIn || current.spectator) {
    room.needsToAct.delete(current.id);
    setImmediate(() => checkAndAdvance(room));
    return;
  }

  const delay = 900 + Math.random() * 1400;   // 0.9-2.3 s think time
  const roomId = room.id;
  const botId  = current.id;
  setTimeout(() => {
    const r = rooms[roomId];
    if (!r) return;
    const bot = r.players[r.turnIndex];
    if (!bot || !bot.isBot || bot.id !== botId) return;  // turn moved on
    if (r.phase === GL.PHASES.WAITING || r.phase === GL.PHASES.SHOWDOWN) return;
    executeBotAction(r, bot);
  }, delay);
}
function addBet(room, player, amount) {
  player.chips -= amount; player.bet += amount;
  player.totalBet += amount; room.pot += amount;
  if (player.chips === 0) player.allIn = true;
}

/**
 * Calculate side pots from all round participants' totalBet values.
 * Folded players' bets contribute to pot amounts but they are NOT eligible to win.
 * Returns array of { amount, eligiblePlayerIds } sorted from main pot to highest side pot.
 */
function calculateSidePots(room) {
  const rp = room.roundPlayers();
  if (rp.length === 0) return [{ amount: room.pot, eligiblePlayerIds: [] }];

  // All participants sorted by totalBet ascending
  const sorted = [...rp].sort((a, b) => a.totalBet - b.totalBet);

  // Collect unique totalBet thresholds from non-zero bets
  const thresholds = [...new Set(sorted.filter(p => p.totalBet > 0).map(p => p.totalBet))].sort((a, b) => a - b);

  if (thresholds.length === 0) {
    return [{ amount: room.pot, eligiblePlayerIds: rp.filter(p => !p.folded).map(p => p.id) }];
  }

  const pots = [];
  let prevThreshold = 0;

  for (const threshold of thresholds) {
    const tierAmount = threshold - prevThreshold;
    if (tierAmount <= 0) continue;

    // Count how much each participant contributes to this tier
    let potAmount = 0;
    for (const p of rp) {
      const contribution = Math.min(p.totalBet, threshold) - Math.min(p.totalBet, prevThreshold);
      potAmount += contribution;
    }

    // Eligible = non-folded players whose totalBet >= this threshold
    const eligible = rp.filter(p => !p.folded && p.totalBet >= threshold).map(p => p.id);

    if (potAmount > 0) {
      pots.push({ amount: potAmount, eligiblePlayerIds: eligible });
    }

    prevThreshold = threshold;
  }

  // If pots are empty (edge case), return single pot
  if (pots.length === 0) {
    return [{ amount: room.pot, eligiblePlayerIds: rp.filter(p => !p.folded).map(p => p.id) }];
  }

  return pots;
}

/**
 * Distribute pots to winners. For each pot, evaluate eligible players' hands
 * and award to the best hand(s). Returns { allWinners, potBreakdown }.
 */
function distributePots(pots, room) {
  const allWinnerIds = new Set();
  const potBreakdown = [];

  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i];
    const label = i === 0 ? 'main' : `side-${i}`;

    // Filter eligible players who have bestHand evaluated
    const eligible = pot.eligiblePlayerIds
      .map(id => room.playerById(id))
      .filter(p => p && p.bestHand);

    if (eligible.length === 0) {
      // No eligible player with hand — edge case, pot stays (shouldn't happen normally)
      potBreakdown.push({ label, amount: pot.amount, winnerIds: [], winnerNames: [] });
      continue;
    }

    // Sort by hand strength descending
    eligible.sort((a, b) => GL.compareHandResult(b.bestHand, a.bestHand));
    const topHand = eligible[0].bestHand;
    const winners = eligible.filter(p => GL.compareHandResult(p.bestHand, topHand) === 0);

    // Distribute pot evenly among winners
    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - share * winners.length;
    for (const w of winners) {
      w.chips += share;
      allWinnerIds.add(w.id);
    }
    for (let r = 0; r < remainder; r++) {
      winners[r].chips += 1;
    }

    potBreakdown.push({
      label,
      amount: pot.amount,
      winnerIds: winners.map(w => w.id),
      winnerNames: winners.map(w => w.name),
    });
  }

  return { allWinnerIds, potBreakdown };
}
function dealCard(room) { return room.deck.length ? room.deck.pop() : null; }
function broadcastRoomList() { io.emit('room_list', getRoomList()); }
function getRoomList() {
  return Object.values(rooms).filter(r => r.phase === GL.PHASES.WAITING)
    .map(r => ({ id:r.id, hostName:r.hostName, playerCount:r.players.length, maxPlayers:r.maxPlayers }));
}
function emitGameState(room) {
  // Calculate bestHand for all players who have cards
  for (const p of room.players) {
    if (p.hand && p.hand.length > 0 && room.community) {
      const allCards = [...p.hand, ...room.community];
      if (allCards.length >= 2) {
        p.bestHand = GL.evaluateBestHand(allCards);
      }
    }
  }

  // Update side pot preview (recalculated on every state broadcast)
  if (room.phase !== GL.PHASES.WAITING) {
    room.sidePots = calculateSidePots(room);
  } else {
    room.sidePots = [];
  }
  
  for (const p of room.players) {
    if (isBotId(p.id)) continue;
    const sock = io.sockets.sockets.get(p.id);
    if (sock) sock.emit('game_state', room.publicState(p.id));
  }
  scheduleBotAction(room);
}

function postBlind(room, player, amount) {
  const actual = Math.min(amount, player.chips);
  player.chips -= actual; player.bet += actual;
  player.totalBet += actual; room.pot += actual;
  if (player.chips === 0) player.allIn = true;
}

function startGame(room) {
  room.deck = GL.shuffle(GL.buildDeck());
  room.community = []; room.pot = 0; room.winners = []; room.finalChampion = null;
  room.sidePots = []; room.potBreakdown = null;
  room.phase = GL.PHASES.PREFLOP;
  room._endGameCalled = false;
  room._autoRevealing = false;

  // Mark players with no chips or disconnected as spectators for this round
  for (const p of room.players) {
    p.spectator = (p.chips <= 0 || !p.connected);
    p.hand=[]; p.folded=false; p.allIn=false; p.bet=0; p.totalBet=0; p.bestHand=null;
  }

  // Only deal to active (non-spectator) players
  const rp = room.roundPlayers();
  for (let i = 0; i < 2; i++)
    for (const p of rp) p.hand.push(dealCard(room));

  const n = rp.length;
  // Find dealer's position in the round players array
  const dealerInRp = rp.findIndex(p => p.id === room.players[room.dealerIdx].id);
  const sbIdx = (dealerInRp + 1) % n;
  const bbIdx = (dealerInRp + 2) % n;
  postBlind(room, rp[sbIdx], room.smallBlind);
  postBlind(room, rp[bbIdx], room.bigBlind);
  room.currentBet = room.bigBlind;

  const firstIdx = (bbIdx + 1) % n;
  // Map index back to global players array
  const firstPlayer = rp[firstIdx];
  room.turnIndex = room.players.findIndex(p => p.id === firstPlayer.id);
  room.needsToAct = new Set(rp.filter(p => !p.allIn && p.connected).map(p => p.id));
  emitGameState(room);
}

function startBettingRound(room) {
  room.currentBet = 0;
  room.raiseCount = 0;
  for (const p of room.players) p.bet = 0;
  const rp = room.roundPlayers();
  const n  = rp.length;
  // Find dealer's position in the round players array
  const dealerInRp = rp.findIndex(p => p.id === room.players[room.dealerIdx].id);
  let firstRpIdx = (dealerInRp + 1) % n;
  for (let i = 0; i < n; i++) {
    const p = rp[firstRpIdx];
    if (!p.folded && !p.allIn) break;
    firstRpIdx = (firstRpIdx + 1) % n;
  }
  room.turnIndex = room.players.findIndex(p => p.id === rp[firstRpIdx].id);
  room.needsToAct = new Set(room.activePlayers().filter(p => p.connected).map(p => p.id));
  if (room.needsToAct.size === 0) { proceedToNextPhase(room); return; }
  emitGameState(room);
}

function advanceToNextPlayer(room) {
  const n = room.players.length;
  let idx = (room.turnIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    const p = room.players[idx];
    if (!p.folded && !p.allIn && !p.spectator && p.connected && room.needsToAct.has(p.id)) break;
    idx = (idx + 1) % n;
  }
  room.turnIndex = idx;
}

function checkAndAdvance(room) {
  const nf = room.nonFoldedPlayers();
  if (nf.length <= 1) { proceedToNextPhase(room); return; }
  const stillNeed = [...room.needsToAct].filter(id => {
    const p = room.playerById(id); return p && !p.folded && !p.allIn && !p.spectator && p.connected;
  });
  if (stillNeed.length === 0) { proceedToNextPhase(room); return; }
  advanceToNextPlayer(room);
  emitGameState(room);
}

// Auto-reveal remaining community cards one by one when all players are all-in
function autoRevealBoard(room) {
  const steps = [];
  if (room.community.length < 3) steps.push({ phase: GL.PHASES.FLOP,  limit: 3, count: 3 });
  if (room.community.length < 4) steps.push({ phase: GL.PHASES.TURN,  limit: 4, count: 1 });
  if (room.community.length < 5) steps.push({ phase: GL.PHASES.RIVER, limit: 5, count: 1 });

  room._autoRevealing = true;   // suppress bot scheduling while we reveal
  
  const singleCardTime = 2800; // 单张卡片动画时间（客户端2.65秒 + 缓冲0.15秒）
  // 如果在preflop阶段all-in，需要等待手牌动画完成（2张手牌 × 2.8秒 = 5.6秒）+ 额外缓冲1秒
  const initialDelay = room.phase === GL.PHASES.PREFLOP ? 6600 : 2000;
  
  let delay = initialDelay;
  for (const step of steps) {
    setTimeout(() => {
      if (room._endGameCalled) return;
      room.phase = step.phase;
      while (room.community.length < step.limit) room.community.push(dealCard(room));
      emitGameState(room);
    }, delay);
    // 根据发牌数量计算下一步延迟（多张牌需要更多时间）
    delay += step.count * singleCardTime;
  }
  // 最后一批牌发完后，额外等待确保动画完成
  setTimeout(() => {
    room._autoRevealing = false;
    doShowdown(room);
  }, delay + 500); // 额外500ms缓冲
}

function proceedToNextPhase(room) {
  room.needsToAct.clear();
  const nf = room.nonFoldedPlayers();
  if (nf.length <= 1) {
    room.tournamentBracket = [];  // Clear bracket when everyone folds
    const startChips = {};
    for (const p of room.players) startChips[p.id] = p.chips + (p.totalBet || 0);
    endGame(room, nf, null, startChips);
    return;
  }

  // All remaining are all-in — reveal board dramatically card by card
  if (room.activePlayers().length === 0 && room.community.length < 5) {
    autoRevealBoard(room); return;
  }

  switch (room.phase) {
    case GL.PHASES.PREFLOP:
      room.phase = GL.PHASES.FLOP;
      for (let i = 0; i < 3; i++) room.community.push(dealCard(room));
      startBettingRound(room); break;
    case GL.PHASES.FLOP:
      room.phase = GL.PHASES.TURN;
      room.community.push(dealCard(room));
      startBettingRound(room); break;
    case GL.PHASES.TURN:
      room.phase = GL.PHASES.RIVER;
      room.community.push(dealCard(room));
      startBettingRound(room); break;
    case GL.PHASES.RIVER:
      doShowdown(room); break;
  }
}

function doShowdown(room) {
  if (room.phase === GL.PHASES.SHOWDOWN) return;  // guard against duplicate calls
  room.phase = GL.PHASES.SHOWDOWN;
  const nf = room.nonFoldedPlayers();
  
  // If only one player remains (everyone else folded), no showdown needed
  if (nf.length === 1) {
    room.tournamentBracket = [];
    const startChips = {};
    for (const p of room.players) startChips[p.id] = p.chips + (p.totalBet || 0);
    endGame(room, nf, null, startChips);
    return;
  }
  
  for (const p of nf) p.bestHand = GL.evaluateBestHand([...p.hand, ...room.community]);
  nf.sort((a,b) => GL.compareHandResult(b.bestHand, a.bestHand));

  // Snapshot start-of-round chips BEFORE any chip modifications
  const startChips = {};
  for (const p of room.players) startChips[p.id] = p.chips + (p.totalBet || 0);

  // Return uncalled bets before pot distribution
  returnUncalledBets(room);

  // Calculate side pots and distribute
  const pots = calculateSidePots(room);
  const { allWinnerIds, potBreakdown } = distributePots(pots, room);

  // Collect winner objects for backward-compatible winners array
  const winners = room.players.filter(p => allWinnerIds.has(p.id));
  
  // Generate tournament bracket for animation
  room.tournamentBracket = generateTournamentBracket(nf);
  
  endGame(room, winners, potBreakdown, startChips);
}

/**
 * Return uncalled portion of a bet. When a player's totalBet exceeds all others'
 * totalBets (because everyone else folded or went all-in for less), the unmatched
 * portion is returned.
 */
function returnUncalledBets(room) {
  const rp = room.roundPlayers();
  if (rp.length < 2) return;

  // Find the two highest totalBets among non-folded players
  const nonFolded = rp.filter(p => !p.folded).sort((a, b) => b.totalBet - a.totalBet);
  if (nonFolded.length < 2) return;

  const highest = nonFolded[0].totalBet;
  const secondHighest = nonFolded[1].totalBet;

  if (highest > secondHighest) {
    const excess = highest - secondHighest;
    const player = nonFolded[0];
    player.chips += excess;
    player.totalBet -= excess;
    room.pot -= excess;
  }
}

// Generate tournament bracket: sequential battles between non-folded players
// Only generate bracket if there are 2+ players (skip if everyone else folded)
function generateTournamentBracket(players) {
  if (players.length < 2) return [];
  
  const bracket = [];
  let remaining = [...players];
  
  // Create sequential battles: A vs B, winner vs C, winner vs D, etc.
  while (remaining.length > 1) {
    const p1 = remaining[0];
    const p2 = remaining[1];
    
    // Determine winner based on hand strength
    const comparison = GL.compareHandResult(p1.bestHand, p2.bestHand);
    const winner = comparison >= 0 ? p1 : p2;
    const loser = comparison >= 0 ? p2 : p1;
    
    bracket.push({
      player1: {
        id: p1.id,
        name: p1.name,
        isBot: p1.isBot,
        hand: p1.hand,
        bestHand: p1.bestHand,
      },
      player2: {
        id: p2.id,
        name: p2.name,
        isBot: p2.isBot,
        hand: p2.hand,
        bestHand: p2.bestHand,
      },
      winnerId: winner.id,
    });
    
    // Remove loser, keep winner at front for next battle
    remaining = [winner, ...remaining.slice(2)];
  }
  
  return bracket;
}

function endGame(room, winners, potBreakdown, startChips) {
  if (room._endGameCalled) return;  // prevent double settlement
  room._endGameCalled = true;

  // If potBreakdown is null, this is an everyone-folded scenario:
  // give the full pot to the single remaining winner (no side pot calc needed)
  if (!potBreakdown) {
    if (winners.length > 0) {
      const share = Math.floor(room.pot / winners.length);
      const remainder = room.pot - share * winners.length;
      for (const w of winners) w.chips += share;
      for (let i = 0; i < remainder; i++) winners[i].chips += 1;
    }
    room.potBreakdown = [{
      label: 'main',
      amount: room.pot,
      winnerIds: winners.map(w => w.id),
      winnerNames: winners.map(w => w.name),
    }];
  } else {
    // Chips already distributed by distributePots(); just store breakdown
    room.potBreakdown = potBreakdown;
  }

  // Per-player chip delta for the result panel
  room.roundResults = room.players
    .filter(p => !p.spectator)
    .map(p => ({
      id:     p.id,
      name:   p.name,
      isBot:  !!p.isBot,
      delta:  p.chips - startChips[p.id],
      chips:  p.chips,
      folded: p.folded,
      bestHand: p.bestHand ? { rankLabel: p.bestHand.rankLabel, totalPower: p.bestHand.totalPower } : null,
    }));

  room.winners = winners.map(w => ({ id:w.id, name:w.name, chips:w.chips, hand:w.hand, bestHand:w.bestHand }));
  room.phase = GL.PHASES.SHOWDOWN;

  // Increment round counter + escalate blinds
  room.roundCount++;
  const newLevel = Math.min(Math.floor(room.roundCount / ROUNDS_PER_BLIND_LEVEL), BLIND_LEVELS.length - 1);
  if (newLevel > room.blindLevel) {
    room.blindLevel = newLevel;
    [room.smallBlind, room.bigBlind] = BLIND_LEVELS[newLevel];
  }

  emitGameState(room);

  // Calculate delay: shorter if everyone folded, longer for actual showdowns
  const BATTLE_DURATION = 8000;  // 8 seconds per battle (slower with 3s pause)
  const PAUSE_BETWEEN = 1000;    // 1 second pause between battles
  const bracketLength = room.tournamentBracket ? room.tournamentBracket.length : 0;
  const tournamentTime = bracketLength * (BATTLE_DURATION + PAUSE_BETWEEN);
  
  // If no tournament (everyone folded), use 5s delay; otherwise 15s base + animation time
  const baseDelay = bracketLength === 0 ? 5000 : 15000;
  const totalDelay = baseDelay + tournamentTime;

  setTimeout(() => {
    // Move broke players to spectator
    for (const p of room.players) {
      if (p.chips <= 0) p.spectator = true;
    }
    const alive = room.players.filter(p => p.chips > 0);

    // If no humans remain at all, just close the room silently
    if (closeRoomIfBotsOnly(room)) return;

    if (alive.length <= 1) {
      // Final champion!
      const champion = alive[0] || winners[0];
      room.finalChampion = champion
        ? { id: champion.id, name: champion.name, chips: champion.chips, hand: champion.hand }
        : null;
      // Update leaderboard for all non-bot players when game ends
      for (const p of room.players) {
        if (!p.isBot) {
          updateLeaderboard(p.name, p.chips);
        }
      }
      room.phase = GL.PHASES.WAITING;
      // Keep everyone in the room so they see the final screen
      emitGameState(room);
      broadcastRoomList();
    } else {
      // Advance dealer to next non-spectator player
      const nonSpectators = room.players.filter(p => !p.spectator);
      if (nonSpectators.length === 0) {
        // Safety check: if all are spectators, game shouldn't continue
        room.phase = GL.PHASES.WAITING;
        emitGameState(room);
        return;
      }
      // Find current dealer in non-spectator list and advance
      const currentDealer = room.players[room.dealerIdx];
      const currentDealerInNonSpec = nonSpectators.findIndex(p => p.id === currentDealer.id);
      const nextDealerInNonSpec = (currentDealerInNonSpec + 1) % nonSpectators.length;
      const nextDealer = nonSpectators[nextDealerInNonSpec];
      room.dealerIdx = room.players.findIndex(p => p.id === nextDealer.id);
      startGame(room);
    }
  }, totalDelay);
}

// Close a room if no human (non-bot) players remain
function closeRoomIfBotsOnly(room) {
  const hasHuman = room.players.some(p => !p.isBot);
  if (hasHuman) return false;
  console.log(`Room ${room.id}: no humans left, closing.`);
  delete rooms[room.id];
  broadcastRoomList();
  return true;
}

function broadcastActionLog(room, player, action, amount) {
  const labels = {
    fold:  { zh: '撤退',     en: 'Folded'   },
    check: { zh: '观望',     en: 'Checked'  },
    call:  { zh: '应战',     en: 'Called'   },
    raise: { zh: '强化',     en: 'Raised'   },
    allin: { zh: '全力以赴', en: 'All-In'   },
  };
  io.to(room.id).emit('action_log', {
    name:   player.name,
    isBot:  !!player.isBot,
    action,
    amount: amount || 0,
    labels,
  });
}

io.on('connection', socket => {
  console.log('+ connect', socket.id);
  socket.emit('room_list', getRoomList());

  socket.on('create_room', ({ playerName }) => {
    const roomId = Math.random().toString(36).substring(2,7).toUpperCase();
    const room   = new RoomState(roomId, playerName || 'Host');
    rooms[roomId] = room;
    room.hostId   = socket.id;
    room.players.push(makePlayer(socket.id, playerName || '训练家1'));
    socket.join(roomId);
    socket.emit('room_joined', { roomId, playerId: socket.id });
    emitGameState(room); broadcastRoomList();
  });

  socket.on('join_room', ({ roomId, playerName }) => {
    const room = rooms[roomId];
    if (!room)                            return socket.emit('error', { msg: '房间不存在' });
    if (room.phase !== GL.PHASES.WAITING) return socket.emit('error', { msg: '游戏已开始，无法加入' });
    if (room.players.length >= room.maxPlayers) return socket.emit('error', { msg: '房间已满' });
    room.players.push(makePlayer(socket.id, playerName || `训练家${room.players.length+1}`));
    socket.join(roomId);
    socket.emit('room_joined', { roomId, playerId: socket.id });
    emitGameState(room); broadcastRoomList();
  });

  socket.on('add_bot', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit('error', { msg: '只有房主才能添加训练家' });
    if (room.phase !== GL.PHASES.WAITING) return socket.emit('error', { msg: '只能在等待阶段添加训练家' });
    if (room.players.length >= room.maxPlayers) return socket.emit('error', { msg: '房间已满' });
    const usedNames = new Set(room.players.map(p => p.name));
    const available = BOT_NAMES.filter(n => !usedNames.has(n));
    // Randomly select from available names instead of always picking the first one
    const botName = available.length 
      ? available[Math.floor(Math.random() * available.length)] 
      : `训练家${room.players.length}`;
    room.players.push(makeBotPlayer(botName));
    emitGameState(room);
    broadcastRoomList();
  });

  socket.on('remove_bot', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit('error', { msg: '只有房主才能移除训练家' });
    if (room.phase !== GL.PHASES.WAITING) return socket.emit('error', { msg: '只能在等待阶段移除训练家' });
    const lastBotIdx = [...room.players].reverse().findIndex(p => p.isBot);
    if (lastBotIdx === -1) return socket.emit('error', { msg: '没有可移除的训练家' });
    room.players.splice(room.players.length - 1 - lastBotIdx, 1);
    emitGameState(room);
    broadcastRoomList();
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit('error', { msg: '只有房主才能开始游戏' });
    const nonSpec = room.players.filter(p => p.chips > 0);
    if (nonSpec.length < room.minPlayers) return socket.emit('error', { msg: `至少需要 ${room.minPlayers} 名玩家` });
    startGame(room); broadcastRoomList();
  });

  socket.on('get_leaderboard', () => {
    socket.emit('leaderboard_data', getLeaderboard());
  });

  socket.on('player_action', ({ roomId, action, amount }) => {
    const room = rooms[roomId];
    if (!room || room.phase === GL.PHASES.WAITING || room.phase === GL.PHASES.SHOWDOWN) return;
    const player = room.players[room.turnIndex];
    if (!player || player.id !== socket.id) return socket.emit('error', { msg: '还没轮到你行动' });
    if (player.folded || player.spectator) return;

    recordPlayerAction(room, player.id, action);
    const toCall = Math.max(0, room.currentBet - player.bet);
    let logAmount = 0;

    switch (action) {
      case GL.ACTIONS.FOLD:
        player.folded = true;
        room.needsToAct.delete(player.id);
        break;
      case GL.ACTIONS.CHECK:
        if (toCall > 0) return socket.emit('error', { msg: `需要应战 ${toCall}，不能观望` });
        room.needsToAct.delete(player.id);
        break;
      case GL.ACTIONS.CALL: {
        logAmount = Math.min(toCall, player.chips);
        addBet(room, player, logAmount);
        room.needsToAct.delete(player.id);
        break;
      }
      case GL.ACTIONS.RAISE: {
        if (!amount || amount <= room.currentBet) return socket.emit('error', { msg: '强化必须大于当前下注' });
        const diff = amount - player.bet;
        logAmount = Math.min(diff, player.chips);
        addBet(room, player, logAmount);
        room.currentBet = player.bet;
        logAmount = player.bet;  // show total bet
        room.raiseCount++;
        room.needsToAct = new Set(room.activePlayers().filter(p => p.id !== player.id).map(p => p.id));
        break;
      }
      case GL.ACTIONS.ALLIN: {
        const all = player.chips;
        const newTotal = player.bet + all;
        logAmount = all;
        addBet(room, player, all);
        if (newTotal > room.currentBet) {
          room.currentBet = newTotal;
          room.raiseCount++;
          room.needsToAct = new Set(room.activePlayers().filter(p => p.id !== player.id).map(p => p.id));
        } else {
          room.needsToAct.delete(player.id);
        }
        break;
      }
      default: return socket.emit('error', { msg: '未知操作' });
    }
    broadcastActionLog(room, player, action, logAmount);
    checkAndAdvance(room);
  });

  socket.on('disconnect', () => {
    console.log('- disconnect', socket.id);
    for (const [roomId, room] of Object.entries(rooms)) {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) continue;
      if (room.phase === GL.PHASES.WAITING) {
        room.players.splice(idx, 1);
        if (room.players.length === 0 || closeRoomIfBotsOnly(room)) {
          // room already deleted by closeRoomIfBotsOnly or was empty
          if (rooms[roomId]) delete rooms[roomId];
          broadcastRoomList();
          continue;
        }
        if (room.hostId === socket.id) { room.hostId = room.players.find(p => !p.isBot)?.id || room.players[0].id; room.hostName = room.players.find(p => !p.isBot)?.name || room.players[0].name; }
        emitGameState(room);
      } else {
        const player = room.players[idx];
        room.players[idx].connected = false;
        room.players[idx].folded = true;
        const wasInNeedsToAct = room.needsToAct.has(socket.id);
        room.needsToAct.delete(socket.id);
        // Update leaderboard when player disconnects mid-game
        if (!player.isBot) {
          updateLeaderboard(player.name, player.chips);
        }
        // Check if only bots remain after this disconnect; close after a short delay
        // so the current pending action can resolve cleanly
        const stillHuman = room.players.some(p => !p.isBot && p.id !== socket.id);
        if (!stillHuman) {
          setTimeout(() => {
            if (rooms[roomId]) {
              delete rooms[roomId];
              broadcastRoomList();
            }
          }, 3000);
        } else {
          // Always check and advance if the player was waiting to act or if it's their turn
          // This ensures the game doesn't get stuck waiting for a disconnected player
          if (wasInNeedsToAct || room.players[room.turnIndex]?.id === socket.id) {
            checkAndAdvance(room);
          } else {
            emitGameState(room);
          }
        }
      }
      broadcastRoomList();
    }
  });
});

// Load leaderboard data on startup
loadLeaderboard();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎮 Pocket Monsters running at http://localhost:${PORT}`));
