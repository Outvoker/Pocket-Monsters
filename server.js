const express  = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const path      = require('path');
const GL        = require('./shared/gameLogic');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

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
      players: this.players.map(p => ({
        id: p.id, name: p.name, chips: p.chips, folded: p.folded, allIn: p.allIn,
        bet: p.bet, totalBet: p.totalBet, connected: p.connected, spectator: !!p.spectator,
        handCount: p.hand ? p.hand.length : 0,
        hand:     (this.phase === GL.PHASES.SHOWDOWN || p.id === forPlayerId) ? p.hand : null,
        bestHand: (this.phase === GL.PHASES.SHOWDOWN) ? p.bestHand : null,
        isBot:    !!p.isBot,
      })),
    };
  }
}

function makePlayer(id, name) {
  return { id, name, chips:1000, hand:[], folded:false, allIn:false,
           bet:0, totalBet:0, connected:true, bestHand:null, isBot:false };
}

// ─── Bot helpers ─────────────────────────────────────────────────────────────
const BOT_NAMES = ['小智','小霞','小刚','大木博士','火箭队喵喵','小次郎','小兰','阿桂'];

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
 */
function botDecide(room, bot) {
  const toCall = Math.max(0, room.currentBet - bot.bet);
  const bb = room.bigBlind;
  const potOdds = toCall > 0 ? toCall / (room.pot + toCall) : 0;

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
  
  // Very strong hand (rank 7-9: straight flush, four of a kind, royal)
  if (strength > 0.75 || handRank >= 7) {
    if (r < 0.02) return { action: GL.ACTIONS.FOLD }; // rare trap fold
    
    // Aggressive raising with strong hands
    if (r < 0.85) {
      const minR = room.currentBet + bb;
      const maxR = bot.bet + bot.chips;
      if (minR < maxR) {
        // Vary raise size: 2-5x big blind or 50-100% pot
        const potRaise = Math.floor(room.pot * (0.5 + Math.random() * 0.5));
        const bbRaise = bb * (2 + Math.floor(Math.random() * 4));
        const raiseAmt = Math.max(minR, Math.min(potRaise, bbRaise));
        const amt = Math.min(raiseAmt, maxR);
        return { action: GL.ACTIONS.RAISE, amount: amt };
      }
    }
    
    if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.ALLIN };
  }

  // Strong hand (rank 5-6: flush, full house, or good pairs/high cards)
  if (strength > 0.55) {
    if (r < 0.05) return { action: GL.ACTIONS.FOLD }; // occasional fold
    
    // Raise more often with strong hands
    if (r < 0.70) {
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
    
    if (toCall <= bot.chips * 0.3) return { action: GL.ACTIONS.CALL };
    if (r < 0.7 && toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.FOLD };
  }

  // Medium hand (rank 3-4: three of a kind, straight, or decent cards)
  if (strength > 0.35) {
    if (toCall === 0) {
      // Occasional bluff raise
      if (r < 0.20) {
        const minR = bb;
        const maxR = bot.bet + bot.chips;
        if (minR < maxR) {
          const amt = Math.min(bb * (1 + Math.floor(Math.random() * 2)), maxR);
          return { action: GL.ACTIONS.RAISE, amount: amt };
        }
      }
      return { action: GL.ACTIONS.CHECK };
    }
    
    // Call if pot odds are good
    if (potOdds < strength * 0.8 && toCall <= bot.chips * 0.2) {
      return { action: GL.ACTIONS.CALL };
    }
    
    if (r < 0.35) return { action: GL.ACTIONS.FOLD };
    if (toCall <= bot.chips * 0.15) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.FOLD };
  }

  // Weak hand
  if (toCall === 0) {
    // Rare bluff
    if (r < 0.08 && bot.chips > bb * 5) {
      const amt = Math.min(bb * (1 + Math.floor(Math.random() * 2)), bot.chips);
      return { action: GL.ACTIONS.RAISE, amount: amt };
    }
    return { action: GL.ACTIONS.CHECK };
  }
  
  // Fold most weak hands when facing a bet
  if (r < 0.80) return { action: GL.ACTIONS.FOLD };
  if (toCall <= bb && bot.chips > bb * 10) return { action: GL.ACTIONS.CALL }; // cheap call
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

  // Mark players with no chips as spectators for this round
  for (const p of room.players) {
    p.spectator = (p.chips <= 0);
    p.hand=[]; p.folded=false; p.allIn=false; p.bet=0; p.totalBet=0; p.bestHand=null;
  }

  // Only deal to active (non-spectator) players
  const rp = room.roundPlayers();
  for (let i = 0; i < 2; i++)
    for (const p of rp) p.hand.push(dealCard(room));

  const n = rp.length;
  const sbIdx = (room.dealerIdx + 1) % n;
  const bbIdx = (room.dealerIdx + 2) % n;
  postBlind(room, rp[sbIdx], room.smallBlind);
  postBlind(room, rp[bbIdx], room.bigBlind);
  room.currentBet = room.bigBlind;

  const firstIdx = (bbIdx + 1) % n;
  // Map index back to global players array
  const firstPlayer = rp[firstIdx];
  room.turnIndex = room.players.findIndex(p => p.id === firstPlayer.id);
  room.needsToAct = new Set(rp.filter(p => !p.allIn).map(p => p.id));
  emitGameState(room);
}

function startBettingRound(room) {
  room.currentBet = 0;
  for (const p of room.players) p.bet = 0;
  const rp = room.roundPlayers();
  const n  = rp.length;
  let firstRpIdx = (room.dealerIdx + 1) % n;
  for (let i = 0; i < n; i++) {
    const p = rp[firstRpIdx];
    if (!p.folded && !p.allIn) break;
    firstRpIdx = (firstRpIdx + 1) % n;
  }
  room.turnIndex = room.players.findIndex(p => p.id === rp[firstRpIdx].id);
  room.needsToAct = new Set(room.activePlayers().map(p => p.id));
  if (room.needsToAct.size === 0) { proceedToNextPhase(room); return; }
  emitGameState(room);
}

function advanceToNextPlayer(room) {
  const n = room.players.length;
  let idx = (room.turnIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    const p = room.players[idx];
    if (!p.folded && !p.allIn && !p.spectator && room.needsToAct.has(p.id)) break;
    idx = (idx + 1) % n;
  }
  room.turnIndex = idx;
}

function checkAndAdvance(room) {
  const nf = room.nonFoldedPlayers();
  if (nf.length <= 1) { proceedToNextPhase(room); return; }
  const stillNeed = [...room.needsToAct].filter(id => {
    const p = room.playerById(id); return p && !p.folded && !p.allIn && !p.spectator;
  });
  if (stillNeed.length === 0) { proceedToNextPhase(room); return; }
  advanceToNextPlayer(room);
  emitGameState(room);
}

// Auto-reveal remaining community cards one by one when all players are all-in
function autoRevealBoard(room) {
  const steps = [];
  if (room.community.length < 3) steps.push({ phase: GL.PHASES.FLOP,  limit: 3 });
  if (room.community.length < 4) steps.push({ phase: GL.PHASES.TURN,  limit: 4 });
  if (room.community.length < 5) steps.push({ phase: GL.PHASES.RIVER, limit: 5 });

  room._autoRevealing = true;   // suppress bot scheduling while we reveal
  
  const initialDelay = 2000;  // 首次发牌前等待2秒
  const cardInterval = 3000;  // 每张牌之间间隔3秒
  
  let delay = initialDelay;
  for (const step of steps) {
    setTimeout(() => {
      if (room._endGameCalled) return;
      room.phase = step.phase;
      while (room.community.length < step.limit) room.community.push(dealCard(room));
      emitGameState(room);
    }, delay);
    delay += cardInterval;
  }
  setTimeout(() => {
    room._autoRevealing = false;
    doShowdown(room);
  }, delay);
}

function proceedToNextPhase(room) {
  room.needsToAct.clear();
  const nf = room.nonFoldedPlayers();
  if (nf.length <= 1) { endGame(room, nf); return; }

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
  for (const p of nf) p.bestHand = GL.evaluateBestHand([...p.hand, ...room.community]);
  nf.sort((a,b) => GL.compareHandResult(b.bestHand, a.bestHand));
  const topPower = nf[0].bestHand.totalPower;
  const winners  = nf.filter(p => p.bestHand.totalPower === topPower);
  endGame(room, winners);
}

function endGame(room, winners) {
  if (room._endGameCalled) return;  // prevent double settlement
  room._endGameCalled = true;

  // Snapshot start-of-round chips (current chips + what they bet this round)
  const startChips = {};
  for (const p of room.players) startChips[p.id] = p.chips + (p.totalBet || 0);

  const share = winners.length ? Math.floor(room.pot / winners.length) : 0;
  for (const w of winners) w.chips += share;
  if (winners.length) winners[0].chips += room.pot - share * winners.length;

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
      room.phase = GL.PHASES.WAITING;
      // Keep everyone in the room so they see the final screen
      emitGameState(room);
      broadcastRoomList();
    } else {
      room.dealerIdx = (room.dealerIdx + 1) % room.players.length;
      // Skip spectators when advancing dealer
      while (room.players[room.dealerIdx].spectator)
        room.dealerIdx = (room.dealerIdx + 1) % room.players.length;
      startGame(room);
    }
  }, 15000);
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
    if (room.hostId !== socket.id) return socket.emit('error', { msg: '只有房主才能添加机器人' });
    if (room.phase !== GL.PHASES.WAITING) return socket.emit('error', { msg: '只能在等待阶段添加机器人' });
    if (room.players.length >= room.maxPlayers) return socket.emit('error', { msg: '房间已满' });
    const usedNames = new Set(room.players.map(p => p.name));
    const available = BOT_NAMES.filter(n => !usedNames.has(n));
    const botName = available.length ? available[0] : `机器人${room.players.length}`;
    room.players.push(makeBotPlayer(botName));
    emitGameState(room);
    broadcastRoomList();
  });

  socket.on('remove_bot', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit('error', { msg: '只有房主才能移除机器人' });
    if (room.phase !== GL.PHASES.WAITING) return socket.emit('error', { msg: '只能在等待阶段移除机器人' });
    const lastBotIdx = [...room.players].reverse().findIndex(p => p.isBot);
    if (lastBotIdx === -1) return socket.emit('error', { msg: '没有可移除的机器人' });
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
        room.players[idx].connected = false;
        room.players[idx].folded = true;
        room.needsToAct.delete(socket.id);
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
          if (room.players[room.turnIndex]?.id === socket.id) checkAndAdvance(room);
          else emitGameState(room);
        }
      }
      broadcastRoomList();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎮 Pocket Monsters running at http://localhost:${PORT}`));
