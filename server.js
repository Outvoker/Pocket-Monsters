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

/**
 * Enhanced bot AI: returns { action, amount? }
 * - Evaluates hand strength more accurately
 * - Strong hands: raise aggressively with variable amounts
 * - Medium: call or check, occasional bluffs
 * - Weak: fold or check
 * - Prevents infinite raise loops by limiting re-raises
 */
function botDecide(room, bot) {
  const toCall = Math.max(0, room.currentBet - bot.bet);
  const bb = room.bigBlind;
  const potOdds = toCall > 0 ? toCall / (room.pot + toCall) : 0;
  const isPreflop = room.community.length === 0;
  const isPostflop = room.community.length >= 3;

  // Estimate hand strength 0..1 with better evaluation
  let strength = 0.35;
  let handRank = 0;
  
  if (bot.hand && bot.hand.length >= 2) {
    const allCards = [...bot.hand, ...room.community];
    if (allCards.length >= 5) {
      const result = GL.evaluateBestHand(allCards);
      handRank = result.rank;
      strength = result.rank / 9;
      // Boost strength based on high cards
      const highCardBonus = result.highCardBonus / 195;
      strength = Math.min(1, strength + highCardBonus * 0.15);
    } else {
      // Pre-flop: better evaluation based on card quality
      const values = bot.hand.map(c => c.value).sort((a, b) => b - a);
      const types = bot.hand.map(c => c.type);
      const isPair = values[0] === values[1];
      const isSuited = types[0] === types[1];
      const highCard = values[0];
      
      if (isPair) {
        strength = 0.5 + (highCard / 13) * 0.35; // pairs are strong
      } else {
        const avg = (values[0] + values[1]) / 2;
        strength = (avg / 13) * 0.6;
        if (isSuited) strength += 0.1; // suited bonus
        if (highCard >= 11) strength += 0.15; // face card bonus
      }
    }
  }

  const r = Math.random();
  const chipRatio = bot.chips / (room.pot + bot.chips);
  
  // Limit raises to prevent infinite loops: max 3-4 raises per round
  const maxRaises = isPreflop ? 3 : 4;
  const canRaise = room.raiseCount < maxRaises;
  
  // Very strong hand (rank 7-9: straight flush, four of a kind, royal)
  if (strength > 0.75 || handRank >= 7) {
    // Almost never fold strong hands - only 0.5% trap fold
    if (r < 0.005) return { action: GL.ACTIONS.FOLD };
    
    // Very aggressive raising with strong hands - 90% raise rate
    if (canRaise && r < 0.90) {
      const minR = room.currentBet + bb;
      const maxR = bot.bet + bot.chips;
      if (minR < maxR) {
        // Larger raise sizes: 3-6x big blind or 60-120% pot
        const potRaise = Math.floor(room.pot * (0.6 + Math.random() * 0.6));
        const bbRaise = bb * (3 + Math.floor(Math.random() * 4));
        const raiseAmt = Math.max(minR, Math.min(potRaise, bbRaise));
        const amt = Math.min(raiseAmt, maxR);
        return { action: GL.ACTIONS.RAISE, amount: amt };
      }
    }
    
    // Always call with strong hands, even large bets
    if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.ALLIN };
  }

  // Strong hand (rank 5-6: flush, full house, or good pairs/high cards)
  if (strength > 0.55) {
    // Almost never fold strong hands - only 1% fold rate
    if (r < 0.01) return { action: GL.ACTIONS.FOLD };
    
    // More aggressive raising - 80% raise rate
    if (canRaise && r < 0.80) {
      const minR = room.currentBet + bb;
      const maxR = bot.bet + bot.chips;
      if (minR < maxR) {
        const potRaise = Math.floor(room.pot * (0.4 + Math.random() * 0.4));
        const bbRaise = bb * (2 + Math.floor(Math.random() * 3));
        const raiseAmt = Math.max(minR, Math.min(potRaise, bbRaise));
        const amt = Math.min(raiseAmt, maxR);
        return { action: GL.ACTIONS.RAISE, amount: amt };
      }
    }
    
    // Much more willing to call large bets - up to 75% of chips
    if (toCall <= bot.chips * 0.75) return { action: GL.ACTIONS.CALL };
    // 90% chance to call even larger bets
    if (r < 0.90 && toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.FOLD };
  }

  // Medium hand (rank 3-4: three of a kind, straight, or decent cards)
  if (strength > 0.35) {
    if (toCall === 0) {
      // Post-flop: bet more aggressively - 55% raise rate
      if (isPostflop && canRaise && r < 0.55) {
        const minR = bb;
        const maxR = bot.bet + bot.chips;
        if (minR < maxR) {
          const amt = Math.min(bb * (1 + Math.floor(Math.random() * 3)), maxR);
          return { action: GL.ACTIONS.RAISE, amount: amt };
        }
      }
      // Pre-flop: more bluff raises - 35% rate
      if (isPreflop && canRaise && r < 0.35) {
        const minR = bb;
        const maxR = bot.bet + bot.chips;
        if (minR < maxR) {
          const amt = Math.min(bb * (1 + Math.floor(Math.random() * 3)), maxR);
          return { action: GL.ACTIONS.RAISE, amount: amt };
        }
      }
      return { action: GL.ACTIONS.CHECK };
    }
    
    // More willing to call - up to 50% of chips
    if (toCall <= bot.chips * 0.5) {
      return { action: GL.ACTIONS.CALL };
    }
    
    // Better pot odds calculation - only fold 10% of the time
    if (r < 0.10) return { action: GL.ACTIONS.FOLD };
    if (toCall <= bot.chips * 0.65) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.FOLD };
  }

  // Weak hand
  if (toCall === 0) {
    // Post-flop: more bluffing - 30% rate
    if (isPostflop && canRaise && r < 0.30 && bot.chips > bb * 5) {
      const amt = Math.min(bb * (1 + Math.floor(Math.random() * 2)), bot.chips);
      return { action: GL.ACTIONS.RAISE, amount: amt };
    }
    // Pre-flop: more bluffing - 20% rate
    if (isPreflop && canRaise && r < 0.20 && bot.chips > bb * 5) {
      const amt = Math.min(bb * (1 + Math.floor(Math.random() * 2)), bot.chips);
      return { action: GL.ACTIONS.RAISE, amount: amt };
    }
    return { action: GL.ACTIONS.CHECK };
  }
  
  // More willing to call with weak hands - fold only 50% of the time
  if (r < 0.50) return { action: GL.ACTIONS.FOLD };
  if (toCall <= bb * 3 && bot.chips > bb * 10) return { action: GL.ACTIONS.CALL }; // call up to 3x BB
  if (toCall <= bot.chips * 0.20) return { action: GL.ACTIONS.CALL }; // call small bets up to 20% of chips
  return { action: GL.ACTIONS.FOLD };
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
  
  const singleCardTime = 2200; // 单张卡片动画时间（客户端1.85秒 + 缓冲0.35秒）
  // 如果在preflop阶段all-in，需要等待手牌动画完成（2张手牌 × 2.2秒 = 4.4秒）+ 额外缓冲1秒
  const initialDelay = room.phase === GL.PHASES.PREFLOP ? 5500 : 2000;
  
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
    endGame(room, nf);
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
    endGame(room, nf);
    return;
  }
  
  for (const p of nf) p.bestHand = GL.evaluateBestHand([...p.hand, ...room.community]);
  nf.sort((a,b) => GL.compareHandResult(b.bestHand, a.bestHand));
  // Find all players with the same hand strength as the top player (ties)
  const topHand = nf[0].bestHand;
  const winners = nf.filter(p => GL.compareHandResult(p.bestHand, topHand) === 0);
  
  // Generate tournament bracket for animation
  room.tournamentBracket = generateTournamentBracket(nf);
  
  endGame(room, winners);
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

function endGame(room, winners) {
  if (room._endGameCalled) return;  // prevent double settlement
  room._endGameCalled = true;

  // Snapshot start-of-round chips (current chips + what they bet this round)
  const startChips = {};
  for (const p of room.players) startChips[p.id] = p.chips + (p.totalBet || 0);

  // Distribute pot evenly among winners (standard poker rule for ties)
  if (winners.length > 0) {
    const share = Math.floor(room.pot / winners.length);
    const remainder = room.pot - share * winners.length;
    
    // Give each winner their equal share
    for (const w of winners) {
      w.chips += share;
    }
    
    // Distribute remainder chips one at a time to winners in order
    // This ensures the most fair distribution when pot doesn't divide evenly
    for (let i = 0; i < remainder; i++) {
      winners[i].chips += 1;
    }
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
