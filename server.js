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
 * Simple bot AI: returns { action, amount? }
 * - Evaluates hand strength from 0..1
 * - Strong hands: raise/call aggressively
 * - Medium: call or check
 * - Weak: fold or check
 */
function botDecide(room, bot) {
  const toCall = Math.max(0, room.currentBet - bot.bet);

  // Estimate hand strength 0..1
  let strength = 0.35;
  if (bot.hand && bot.hand.length >= 2) {
    const allCards = [...bot.hand, ...room.community];
    if (allCards.length >= 5) {
      const result = GL.evaluateBestHand(allCards);
      strength = result.rank / 9;           // rank 0-9 → 0..1
    } else {
      // pre-flop: use average card value as proxy
      const avg = bot.hand.reduce((s, c) => s + c.value, 0) / bot.hand.length;
      strength = avg / 13;
    }
  }

  const r = Math.random();
  const bb = room.bigBlind;

  if (strength > 0.6) {             // strong hand
    if (r < 0.08) return { action: GL.ACTIONS.FOLD };
    if (r < 0.50) {
      const minR = room.currentBet + bb;
      const maxR = bot.bet + bot.chips;
      if (minR < maxR) {
        const amt = Math.min(minR + Math.floor(Math.random() * bb * 3), maxR);
        return { action: GL.ACTIONS.RAISE, amount: amt };
      }
    }
    if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.ALLIN };
  }

  if (strength > 0.30) {            // medium hand
    if (toCall === 0) return { action: r < 0.15 ? GL.ACTIONS.RAISE : GL.ACTIONS.CHECK };
    if (r < 0.30) return { action: GL.ACTIONS.FOLD };
    if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
    return { action: GL.ACTIONS.FOLD };
  }

  // weak hand
  if (toCall === 0) return { action: GL.ACTIONS.CHECK };
  if (r < 0.65) return { action: GL.ACTIONS.FOLD };
  if (toCall <= bot.chips) return { action: GL.ACTIONS.CALL };
  return { action: GL.ACTIONS.FOLD };
}

function executeBotAction(room, bot) {
  if (room.phase === GL.PHASES.WAITING || room.phase === GL.PHASES.SHOWDOWN) return;
  if (bot.folded || bot.allIn || bot.spectator) return;

  const { action, amount } = botDecide(room, bot);
  const toCall = Math.max(0, room.currentBet - bot.bet);

  switch (action) {
    case GL.ACTIONS.FOLD:
      bot.folded = true;
      room.needsToAct.delete(bot.id);
      break;
    case GL.ACTIONS.CHECK:
      room.needsToAct.delete(bot.id);
      break;
    case GL.ACTIONS.CALL:
      addBet(room, bot, Math.min(toCall, bot.chips));
      room.needsToAct.delete(bot.id);
      break;
    case GL.ACTIONS.RAISE: {
      if (amount && amount > room.currentBet) {
        const diff = amount - bot.bet;
        addBet(room, bot, Math.min(diff, bot.chips));
        room.currentBet = bot.bet;
        room.needsToAct = new Set(room.activePlayers().filter(p => p.id !== bot.id).map(p => p.id));
      } else {
        room.needsToAct.delete(bot.id);
      }
      break;
    }
    case GL.ACTIONS.ALLIN: {
      const all = bot.chips;
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
  checkAndAdvance(room);
}

function scheduleBotAction(room) {
  const current = room.players[room.turnIndex];
  if (!current || !current.isBot) return;
  if (room.phase === GL.PHASES.WAITING || room.phase === GL.PHASES.SHOWDOWN) return;
  if (current.folded || current.allIn || current.spectator) return;

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

  let delay = 800;
  for (const step of steps) {
    setTimeout(() => {
      room.phase = step.phase;
      while (room.community.length < step.limit) room.community.push(dealCard(room));
      emitGameState(room);
    }, delay);
    delay += 1600;
  }
  setTimeout(() => doShowdown(room), delay);
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
  room.phase = GL.PHASES.SHOWDOWN;
  const nf = room.nonFoldedPlayers();
  for (const p of nf) p.bestHand = GL.evaluateBestHand([...p.hand, ...room.community]);
  nf.sort((a,b) => GL.compareHandResult(b.bestHand, a.bestHand));
  const topPower = nf[0].bestHand.totalPower;
  const winners  = nf.filter(p => p.bestHand.totalPower === topPower);
  endGame(room, winners);
}

function endGame(room, winners) {
  const share = winners.length ? Math.floor(room.pot / winners.length) : 0;
  for (const w of winners) w.chips += share;
  if (winners.length) winners[0].chips += room.pot - share * winners.length;
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
  }, 9000);
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

    switch (action) {
      case GL.ACTIONS.FOLD:
        player.folded = true;
        room.needsToAct.delete(player.id);
        break;
      case GL.ACTIONS.CHECK:
        if (toCall > 0) return socket.emit('error', { msg: `需要跟注 ${toCall}，不能过牌` });
        room.needsToAct.delete(player.id);
        break;
      case GL.ACTIONS.CALL: {
        addBet(room, player, Math.min(toCall, player.chips));
        room.needsToAct.delete(player.id);
        break;
      }
      case GL.ACTIONS.RAISE: {
        if (!amount || amount <= room.currentBet) return socket.emit('error', { msg: '加注必须大于当前注额' });
        const diff = amount - player.bet;
        addBet(room, player, Math.min(diff, player.chips));
        room.currentBet = player.bet; // what player now has in total
        room.needsToAct = new Set(room.activePlayers().filter(p => p.id !== player.id).map(p => p.id));
        break;
      }
      case GL.ACTIONS.ALLIN: {
        const all = player.chips;
        const newTotal = player.bet + all;
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
    checkAndAdvance(room);
  });

  socket.on('disconnect', () => {
    console.log('- disconnect', socket.id);
    for (const [roomId, room] of Object.entries(rooms)) {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) continue;
      if (room.phase === GL.PHASES.WAITING) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) delete rooms[roomId];
        else if (room.hostId === socket.id) { room.hostId = room.players[0].id; room.hostName = room.players[0].name; }
        if (rooms[roomId]) emitGameState(room);
      } else {
        room.players[idx].connected = false;
        room.players[idx].folded = true;
        room.needsToAct.delete(socket.id);
        if (room.players[room.turnIndex]?.id === socket.id) checkAndAdvance(room);
        else emitGameState(room);
      }
      broadcastRoomList();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎮 Pocket Monsters running at http://localhost:${PORT}`));
