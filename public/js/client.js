/**
 * Pocket Monsters Battle - Client
 */
(() => {
  const GL = window.GameLogic;

  // ─── i18n ───────────────────────────────────────────────────────────────────
  let lang = 'zh';

  const I18N = {
    zh: {
      subtitle:       '集结最强阵容，决战宝可梦擂台！',
      trainerName:    '训练家名称',
      namePlaceholder:'输入你的名字…',
      createRoom:     '创建擂台',
      or:             '或',
      roomCode:       '擂台码',
      joinRoom:       '加入擂台',
      openArenas:     '🏟️ 开放的擂台',
      noRooms:        '暂无开放擂台…',
      arena:          '擂台',
      prize:          '奖池',
      coins:          '金币',
      leave:          '离开',
      battleCost:     '迎战费',
      fold:           '撤  退',
      check:          '蓄  力',
      call:           '迎  战',
      raise:          '强  化',
      allin:          '决一死战',
      startBattle:    '⚔️ 开始对战！',
      nextRound:      '下一局即将开始',
      waitHost:       '等待房主开始对战…',
      playerCount:    (n, max) => `已集结 ${n}/${max} 名训练家`,
      myPower:        '战斗力',
      folded:         '撤退',
      allIn:          '全力出击',
      dealer:         '庄',
      switchLang:     'English',
      phaseLabels: {
        waiting:  '等待集结',
        preflop:  '出战选将',
        flop:     '战场展开',
        turn:     '激战正酣',
        river:    '最终决战',
        showdown: '胜负揭晓',
      },
      battleResult:   '⚔️ 决战结果',
      victory:        name => `🏆 ${name} 获胜！`,
      draw:           '⚔️ 势均力敌！',
      topTeam:        '最强阵容',
      allFolded:      '所有对手撤退',
      power:          '战斗力',
      roomHost:       name => `${name} 的擂台`,
      noName:         '请输入训练家名称！',
      noCode:         '请输入擂台码！',      spectatorMode:  '👀 观战中',
      spectatorHint:  '你的金币已用尽，正在观战剩余选手的对决！',
      finalChampionTitle: name => `🏆 ${name} 是最终胜者！`,
      finalChampionSub:   '最后的训练家！',
      blindsNow:      (s, b) => `盲注: ${s}/${b}`,
      roundLabel:     r => `第 ${r} 局`,
      handLabel:      '手牌宝可梦',
      communityLabel: '公共战场',    },
    en: {
      subtitle:       'Assemble your strongest team and battle!',
      trainerName:    'Trainer Name',
      namePlaceholder:'Enter your name…',
      createRoom:     'Create Arena',
      or:             'or',
      roomCode:       'Arena Code',
      joinRoom:       'Join Arena',
      openArenas:     '🏟️ Open Arenas',
      noRooms:        'No open arenas…',
      arena:          'Arena',
      prize:          'Prize Pool',
      coins:          'coins',
      leave:          'Leave',
      battleCost:     'Battle cost',
      fold:           'Retreat',
      check:          'Charge',
      call:           'Battle',
      raise:          'Power Up',
      allin:          'All-Out!',
      startBattle:    '⚔️ Start Battle!',
      nextRound:      'Next round starting',
      waitHost:       'Waiting for host to start…',
      playerCount:    (n, max) => `${n}/${max} Trainers ready`,
      myPower:        'Power',
      folded:         'Fled',
      allIn:          'All-Out',
      dealer:         'D',
      switchLang:     '中文',
      phaseLabels: {
        waiting:  'Gathering',
        preflop:  'Choose Team',
        flop:     'Field Opens',
        turn:     'Fierce Battle',
        river:    'Final Clash',
        showdown: 'Showdown',
      },
      battleResult:   '⚔️ Battle Result',
      victory:        name => `🏆 ${name} Wins!`,
      draw:           "⚔️ It's a Draw!",
      topTeam:        'Best Team',
      allFolded:      'All opponents fled',
      power:          'Power',
      roomHost:       name => `${name}'s Arena`,
      noName:         'Please enter trainer name!',
      noCode:         'Please enter arena code!',
      spectatorMode:  '👀 Spectating',
      spectatorHint:  'You are out of chips. Watching the battle!',
      finalChampionTitle: name => `🏆 ${name} IS THE CHAMPION!`,
      finalChampionSub:   'Last trainer standing!',
      blindsNow:      (s, b) => `Blinds: ${s}/${b}`,
      roundLabel:     r => `Round ${r}`,
      handLabel:      'Your Pokémon',
      communityLabel: 'Field',
    },
  };

  function t(key, ...args) {
    const val = I18N[lang][key];
    if (typeof val === 'function') return val(...args);
    return val !== undefined ? val : key;
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = I18N[lang][key];
      if (typeof val === 'string') el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (I18N[lang][key]) el.placeholder = I18N[lang][key];
    });
    const bLang  = document.getElementById('btn-lang');
    const bLangG = document.getElementById('btn-lang-game');
    if (bLang)  bLang.textContent  = t('switchLang');
    if (bLangG) bLangG.textContent = t('switchLang');
  }

  function toggleLang() {
    lang = lang === 'zh' ? 'en' : 'zh';
    applyI18n();
    if (gameState) renderGame(gameState);
  }

  // ─── State ──────────────────────────────────────────────────────────────────
  let socket          = null;
  let myId            = null;
  let myRoomId        = null;
  let gameState       = null;
  let countdownTimer  = null;
  // tracks which community card keys are already in the DOM (never re-animate them)
  const renderedCommunityKeys = new Set();

  const TYPE_EMOJI  = { fire: '🔥', water: '💧', grass: '🌿', electric: '⚡' };
  const VALUE_LABEL = v =>
    v === 13 ? 'A' : v === 12 ? 'K' : v === 11 ? 'Q' : v === 10 ? 'J' : String(v + 1);

  // ─── DOM helpers ────────────────────────────────────────────────────────────
  const $  = id => document.getElementById(id);
  const escHtml = s => !s ? '' : String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // ─── Socket ──────────────────────────────────────────────────────────────────
  function initSocket() {
    socket = io();
    socket.on('room_list',   rooms => renderRoomList(rooms));
    socket.on('room_joined', ({ roomId, playerId }) => {
      myId = playerId; myRoomId = roomId; showGameScreen();
    });
    socket.on('game_state',  state => { gameState = state; renderGame(state); });
    socket.on('error',       ({ msg }) => showToast(msg, 'error'));
    socket.on('disconnect',  () => showToast('连接断开', 'error'));
  }

  // ─── Toast ──────────────────────────────────────────────────────────────────
  const toastEl = $('toast');
  function showToast(msg, type = '') {
    toastEl.textContent = msg;
    toastEl.className   = `toast ${type}`;
    toastEl.classList.remove('hidden');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.add('hidden'), 3000);
  }

  // ─── Screen ─────────────────────────────────────────────────────────────────
  function showGameScreen() {
    $('lobby-screen').classList.remove('active');
    $('game-screen').classList.add('active');
    $('hdr-room-id').textContent = myRoomId;
  }

  // ─── Lobby ───────────────────────────────────────────────────────────────────
  function renderRoomList(rooms) {
    const el = $('room-list');
    if (!rooms.length) { el.innerHTML = `<p class="empty-hint">${t('noRooms')}</p>`; return; }
    el.innerHTML = rooms.map(r => `
      <div class="room-item" data-id="${escHtml(r.id)}">
        <span class="room-item-name">🏟️ ${escHtml(t('roomHost', r.hostName))} <small>[${escHtml(r.id)}]</small></span>
        <span class="room-item-count">${r.playerCount}/${r.maxPlayers}</span>
      </div>`).join('');
    el.querySelectorAll('.room-item').forEach(row => {
      row.addEventListener('click', () => { $('room-code-input').value = row.dataset.id; });
    });
  }

  $('btn-create-room').addEventListener('click', () => {
    const name = $('player-name-input').value.trim();
    if (!name) return showToast(t('noName'), 'error');
    socket.emit('create_room', { playerName: name });
  });
  $('btn-join-room').addEventListener('click', () => {
    const name = $('player-name-input').value.trim();
    const code = $('room-code-input').value.trim().toUpperCase();
    if (!name) return showToast(t('noName'), 'error');
    if (!code) return showToast(t('noCode'), 'error');
    socket.emit('join_room', { roomId: code, playerName: name });
  });
  $('btn-leave').addEventListener('click', () => { if (socket) socket.disconnect(); location.reload(); });
  $('room-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join-room').click(); });
  $('player-name-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-create-room').click(); });
  $('btn-lang').addEventListener('click', toggleLang);
  $('btn-lang-game').addEventListener('click', toggleLang);

  // ─── Main render ─────────────────────────────────────────────────────────────
  function renderGame(state) {
    if (!state) return;

    // ─── BGM switch: lobby vs battle ─────────────────────────────────────────
    if (typeof window.switchBgm === 'function') {
      window.switchBgm(state.phase === 'waiting' ? window.BGM_LOBBY : window.BGM_BATTLE);
    }

    const phaseKey   = state.phase;
    const phaseLabel = (t('phaseLabels') || {})[phaseKey] || phaseKey;
    const classMap   = { waiting:'phase-waiting', preflop:'phase-preflop', flop:'phase-flop',
                         turn:'phase-turn', river:'phase-river', showdown:'phase-showdown' };
    $('hdr-phase').innerHTML = `<span class="phase-badge ${classMap[phaseKey]||''}">${escHtml(phaseLabel)}</span>`;
    $('hdr-pot').textContent = state.pot;
    $('pot-display').innerHTML = `<span>${t('prize')}</span>: <strong>${state.pot}</strong> <span>${t('coins')}</span>`;
    // Blind level & round indicator
    const blindInfo = $('hdr-blind-info');
    if (blindInfo) {
      blindInfo.textContent = t('blindsNow', state.smallBlind, state.bigBlind)
        + '  ·  ' + t('roundLabel', state.roundCount || 0);
    }

    const me = state.players.find(p => p.id === myId);
    if (me) {
      $('my-name').textContent  = me.name;
      $('my-chips').innerHTML   = `${me.chips} <span>${t('coins')}</span>`;
    }

    renderCommunity(state);
    renderOpponents(state);
    renderMyHand(state, me);
    renderActionPanel(state, me);
    renderSidebar(state);

    if (state.finalChampion) {
      showFinalChampion(state);
    } else if (state.phase === 'showdown' && state.winners && state.winners.length) {
      showShowdown(state);
    } else {
      hideShowdown();
      hideFinalChampion();
    }
  }

  // ─── Community cards ─────────────────────────────────────────────────────────
  function renderCommunity(state) {
    const cards  = state.community || [];
    const el     = $('community-cards');

    // On new game start the community will be empty; reset tracking
    if (state.phase === 'preflop' || state.phase === 'waiting') {
      renderedCommunityKeys.clear();
    }

    el.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      if (i < cards.length) {
        const card  = cards[i];
        const key   = `${card.type}-${card.id}`;
        const isNew = !renderedCommunityKeys.has(key);
        el.appendChild(makeMonEl(card, false, isNew, isNew ? i * 80 : 0));
        renderedCommunityKeys.add(key);
      } else {
        const slot = document.createElement('div');
        slot.className  = 'poke-slot';
        slot.textContent = '?';
        el.appendChild(slot);
      }
    }
  }

  // ─── Opponents ───────────────────────────────────────────────────────────────
  function renderOpponents(state) {
    const area = $('opponents-area');
    area.innerHTML = '';
    state.players.forEach((p, idx) => {
      if (p.id === myId) return;
      const isDealer = idx === state.dealerIdx;
      const isActive = state.players[state.turnIndex]?.id === p.id;

      let statusHtml = '';
      if (p.folded)     statusHtml = `<span class="opp-status folded">${t('folded')}</span>`;
      else if (p.allIn) statusHtml = `<span class="opp-status allin">${t('allIn')}</span>`;
      else if (isDealer) statusHtml = `<span class="opp-status dealer">${t('dealer')}</span>`;

      const slot = document.createElement('div');
      slot.className = `opponent-slot ${p.folded ? 'folded' : ''} ${isActive ? 'is-turn' : ''}`;

      const cardsHtml = p.hand && p.hand.length
        ? `<div class="opp-back-cards">${p.hand.map(c => miniMonHtml(c)).join('')}</div>`
        : `<div class="opp-back-cards">${'<div class="opp-sprite-back">🔮</div>'.repeat(p.handCount || 2)}</div>`;

      const betHtml = p.bet > 0
        ? `<div class="opp-bet">${t('battleCost')}: ${p.bet}</div>` : '';

      slot.innerHTML = `
        ${cardsHtml}
        <div class="opp-info">
          <div class="opp-name">${escHtml(p.name)} ${statusHtml}</div>
          <div class="opp-chips">${p.chips} ${t('coins')}</div>
          ${betHtml}
          ${p.bestHand ? `<div style="font-size:10px;color:#aaa">${escHtml(p.bestHand.rankLabel)}</div>` : ''}
        </div>`;
      area.appendChild(slot);
    });
  }

  // ─── My hand ──────────────────────────────────────────────────────────────────
  function renderMyHand(state, me) {
    const cardsEl    = $('my-cards');
    const hudEl      = $('power-hud');
    const hudRankEl  = $('power-hud-rank');
    const hudPwrEl   = $('power-hud-power');
    cardsEl.innerHTML = '';

    if (!me || !me.hand || !me.hand.length) {
      for (let i = 0; i < 2; i++) {
        const s = document.createElement('div');
        s.className = 'poke-slot'; s.textContent = '?';
        cardsEl.appendChild(s);
      }
      if (hudEl) hudEl.classList.add('hidden');
      return;
    }

    // Power HUD when enough community cards
    if (state.phase !== 'waiting' && state.community.length >= 3) {
      const best = GL.evaluateBestHand([...me.hand, ...state.community]);
      if (hudRankEl) hudRankEl.textContent = best.rankLabel;
      if (hudPwrEl)  hudPwrEl.textContent  = '⚔️ ' + (best.totalPower * 100).toLocaleString();
      if (hudEl)     hudEl.classList.remove('hidden');
    } else {
      if (hudEl) hudEl.classList.add('hidden');
    }

    const bestKeys = new Set((me.bestHand?.bestFive || []).map(c => `${c.type}-${c.value}`));

    // My hand is NEVER re-animated (player's own mons are stable)
    me.hand.forEach(card => {
      const inBest = bestKeys.has(`${card.type}-${card.value}`);
      cardsEl.appendChild(makeMonEl(card, inBest, false, 0));
    });
  }

  // ─── Action panel ─────────────────────────────────────────────────────────────
  function renderActionPanel(state, me) {
    if (!me) return;
    const isMyTurn   = state.players[state.turnIndex]?.id === myId;
    const isWaiting  = state.phase === 'waiting';
    const isShowdown = state.phase === 'showdown';
    const amHost     = state.hostId === myId;

    $('action-panel').classList.add('hidden');
    $('start-panel').classList.add('hidden');

    if (isWaiting) {
      $('start-panel').classList.remove('hidden');
      if (amHost) {
        $('btn-start').classList.remove('hidden');
        $('waiting-msg').textContent = t('playerCount', state.players.length, state.maxPlayers || 6);
        $('btn-start').disabled = state.players.filter(p => p.chips > 0).length < 2;
      } else {
        $('btn-start').classList.add('hidden');
        $('waiting-msg').textContent = t('waitHost');
      }
      return;
    }
    if (isShowdown || me.folded || me.allIn) return;

    // Spectators: show watching notice instead of action buttons
    if (me.spectator) {
      const ap = $('action-panel');
      ap.classList.remove('hidden');
      if (!ap._specMode) {
        ap._specMode = true;
        ap.innerHTML = `<div class="spectator-notice">${t('spectatorMode')}<br><small>${t('spectatorHint')}</small></div>`;
      }
      return;
    }

    if (!isMyTurn) return;

    $('action-panel').classList.remove('hidden');
    const toCall = Math.max(0, state.currentBet - (me.bet || 0));
    $('call-amount').textContent = toCall;

    $('btn-fold').textContent  = t('fold');
    $('btn-check').textContent = t('check');
    $('btn-call').textContent  = t('call');
    $('btn-raise').textContent = t('raise');
    $('btn-allin').textContent = t('allin');

    $('btn-check').disabled = toCall > 0;
    $('btn-call').disabled  = toCall === 0 || me.chips === 0;
    $('btn-fold').disabled  = false;

    const minRaise = state.currentBet + (state.bigBlind || 20);
    const maxRaise = me.chips + (me.bet || 0);
    $('raise-input').min   = minRaise;
    $('raise-input').max   = maxRaise;
    $('raise-input').value = Math.min(minRaise * 2, maxRaise);
    $('raise-value').textContent = $('raise-input').value;
  }

  // ─── Sidebar ──────────────────────────────────────────────────────────────────
  function renderSidebar(state) {
    const sb = $('player-sidebar');
    sb.innerHTML = '';
    state.players.forEach((p, idx) => {
      const isDealer = idx === state.dealerIdx;
      const isActive = state.players[state.turnIndex]?.id === p.id;
      const div = document.createElement('div');
      div.className = `sidebar-player ${p.folded ? 'folded' : ''} ${isActive ? 'is-turn' : ''}`;
      div.innerHTML = `
        <div class="sidebar-player-name">${isDealer ? '🎖️ ' : ''}${escHtml(p.name)}${p.id === myId ? ' (Me)' : ''}</div>
        <div class="sidebar-player-chips">${p.chips} ${t('coins')}</div>
        ${p.bet ? `<div style="font-size:10px;color:#78909c">${p.bet}</div>` : ''}`;
      sb.appendChild(div);
    });
  }

  // ─── Showdown ─────────────────────────────────────────────────────────────────
  const showdownOverlay  = $('showdown-overlay');
  const showdownTitle    = $('showdown-title');
  const showdownContent  = $('showdown-content');
  const countdownEl      = $('countdown');

  function showShowdown(state) {
    if (showdownOverlay._shown) return;
    showdownOverlay._shown = true;
    showdownOverlay.classList.remove('hidden');
    showdownOverlay.classList.add('showdown-epic');

    const overlayBox = showdownOverlay.querySelector('.overlay-box');
    overlayBox.classList.add('showdown-epic-box');

    const winners = state.winners || [];
    const w       = winners[0];
    if (!w) return;

    showdownTitle.innerHTML = `<span class="showdown-victory-title">${
      winners.length > 1 ? t('draw') : t('victory', w.name)
    }</span>`;

    let html = '';
    if (w.bestHand) {
      const bestFiveKeys = new Set((w.bestHand.bestFive || []).map(c => `${c.type}-${c.value}`));

      // All 7 cards split into hand + community
      const handCards      = (w.hand || []);
      const communityCards = (state.community || []);

      html += `<div class="showdown-winner">
        <div class="showdown-winner-name">🥇 ${escHtml(w.name)}</div>
        <div class="showdown-rank-name">${escHtml(w.bestHand.rankLabel)}</div>
        <div class="showdown-power">⚔️ ${(w.bestHand.totalPower * 100).toLocaleString()}</div>

        <div class="showdown-group-label">${t('handLabel')}</div>
        <div class="showdown-mons-epic">
          ${handCards.map((c, i) => bigMonHtml(c, bestFiveKeys.has(`${c.type}-${c.value}`), i)).join('')}
        </div>

        <div class="showdown-group-label">${t('communityLabel')}</div>
        <div class="showdown-mons-epic showdown-community-mons">
          ${communityCards.map((c, i) => bigMonHtml(c, bestFiveKeys.has(`${c.type}-${c.value}`), i + handCards.length)).join('')}
        </div>
      </div>`;
    } else {
      html += `<div class="showdown-winner">
        <div class="showdown-winner-name">🥇 ${escHtml(w.name)}</div>
        <div class="showdown-rank-label">${t('allFolded')}</div>
      </div>`;
    }

    const others = state.players.filter(p => !winners.find(ww => ww.id === p.id) && p.hand);
    if (others.length) {
      html += '<div class="other-results">';
      others.forEach(p => {
        const bh = p.bestHand;
        html += `<div class="result-row">
          <span>${escHtml(p.name)}${p.folded ? ` (${t('folded')})` : ''}</span>
          <span>${bh ? `${escHtml(bh.rankLabel)} · ${(bh.totalPower * 100).toLocaleString()}` : '-'}</span>
        </div>`;
      });
      html += '</div>';
    }
    showdownContent.innerHTML = html;

    requestAnimationFrame(() => spawnSparkles(overlayBox));

    let secs = 9;
    countdownEl.textContent = secs;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      secs--;
      countdownEl.textContent = secs;
      if (secs <= 0) clearInterval(countdownTimer);
    }, 1000);
  }

  function hideShowdown() {
    if (!showdownOverlay._shown) return;
    showdownOverlay._shown = false;
    showdownOverlay.classList.add('hidden');
    showdownOverlay.classList.remove('showdown-epic');
    const overlayBox = showdownOverlay.querySelector('.overlay-box');
    if (overlayBox) overlayBox.classList.remove('showdown-epic-box');
    showdownOverlay.querySelectorAll('.sparkle').forEach(s => s.remove());
    clearInterval(countdownTimer);
    renderedCommunityKeys.clear();
  }

  // ─── Final Champion Screen ─────────────────────────────────────────────────
  const champOverlay = $('champion-overlay');

  function showFinalChampion(state) {
    if (!champOverlay || champOverlay._shown) return;
    champOverlay._shown = true;
    champOverlay.classList.remove('hidden');

    const fc = state.finalChampion;
    const isMine = fc && fc.id === myId;
    const cards = fc ? (fc.hand || []) : [];

    $('champ-title').innerHTML = fc ? escHtml(t('finalChampionTitle', fc.name)) : '🏆';
    $('champ-sub').textContent  = t('finalChampionSub');
    $('champ-rounds').textContent = t('roundLabel', state.roundCount || 0);

    const monsEl = $('champ-mons');
    monsEl.innerHTML = cards.map(c =>
      `<div class="champ-mon">
        <img src="${GL.spriteUrl(c.id)}" alt="${escHtml(getMonName(c))}" />
        <div class="champ-mon-name">${escHtml(getMonName(c))}</div>
      </div>`
    ).join('');

    requestAnimationFrame(() => spawnSparkles(champOverlay.querySelector('.champ-box')));

    $('champ-back-btn').addEventListener('click', () => {
      if (socket) socket.disconnect();
      location.reload();
    }, { once: true });
  }

  function hideFinalChampion() {
    if (!champOverlay || !champOverlay._shown) return;
    champOverlay._shown = false;
    champOverlay.classList.add('hidden');
    if (champOverlay) champOverlay.querySelectorAll('.sparkle').forEach(s => s.remove());
  }

  // ─── Pokémon element builders ────────────────────────────────────────────────
  function getMonName(card) {
    return (lang === 'zh' && card.zhName) ? card.zhName : card.name;
  }

  const TYPE_COLORS = { fire:'#FF6B35', water:'#29B6F6', grass:'#66BB6A', electric:'#FFD600' };

  // Large showdown sprite
  function bigMonHtml(card, inBest, idx) {
    const delay    = idx * 120;
    const color    = TYPE_COLORS[card.type] || '#fff';
    const valLabel = VALUE_LABEL(card.value);
    const typeEmoji = TYPE_EMOJI[card.type] || '';
    const typeName  = card.type ? (lang === 'zh'
      ? { fire:'火系', water:'水系', grass:'草系', electric:'电系' }[card.type]
      : card.type.charAt(0).toUpperCase() + card.type.slice(1))
      : '';
    return `<div class="showdown-mon-big${inBest ? ' in-best' : ''}" style="animation-delay:${delay}ms">
      <div class="showdown-mon-big-val">${valLabel}</div>
      <img src="${GL.spriteUrl(card.id)}" alt="${escHtml(getMonName(card))}" />
      <div class="showdown-mon-big-name" style="color:${color}">${escHtml(getMonName(card))}</div>
      <div class="showdown-mon-big-type" style="color:${color}">${typeEmoji} ${typeName}</div>
      ${inBest ? `<div class="showdown-mon-big-badge">★</div>` : ''}
    </div>`;
  }

  // Spawn sparkle stars inside container
  function spawnSparkles(container) {
    const STARS = ['✨','⭐','💥','★','◆'];
    for (let i = 0; i < 14; i++) {
      const el = document.createElement('span');
      el.className = 'sparkle';
      const x = Math.random() * 90 + 5;  // vw %
      const y = Math.random() * 80 + 5;  // vh %
      const tx = (Math.random() - .5) * 120 + 'px';
      const ty = -(Math.random() * 80 + 20) + 'px';
      el.style.cssText = `left:${x}%;top:${y}%;--tx:${tx};--ty:${ty};animation-delay:${i * 80}ms;font-size:${14 + Math.random()*14}px`;
      el.textContent = STARS[i % STARS.length];
      container.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  function makeMonEl(card, inBest = false, animate = false, delay = 0) {
    const wrap = document.createElement('div');
    wrap.className = `poke-mon ${card.type}${inBest ? ' in-best' : ''}${animate ? ' appearing' : ''}`;
    if (animate && delay > 0) wrap.style.animationDelay = delay + 'ms';

    const url = GL.spriteUrl(card.id);
    wrap.innerHTML = `
      <div class="poke-mon-sprite-wrap">
        <span class="poke-value-badge">${VALUE_LABEL(card.value)}</span>
        <span class="poke-type-badge">${TYPE_EMOJI[card.type] || ''}</span>
        <img class="poke-sprite" src="${url}" alt="${escHtml(getMonName(card))}"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 96%22%3E%3Ctext y=%2272%22 font-size=%2272%22%3E%E2%9D%93%3C/text%3E%3C/svg%3E'" />
      </div>
      <div class="poke-mon-name">${escHtml(getMonName(card))}</div>`;
    return wrap;
  }

  function miniMonHtml(card, large = false) {
    if (!card) return '<div class="opp-sprite-back">🔮</div>';
    const sz = large ? 52 : 36;
    return `<div class="mini-mon">
      <img src="${GL.spriteUrl(card.id)}" style="width:${sz}px;height:${sz}px;image-rendering:pixelated"
           title="${escHtml(getMonName(card))}" />
      <div class="mini-mon-label">${TYPE_EMOJI[card.type] || ''}${VALUE_LABEL(card.value)}</div>
    </div>`;
  }

  // ─── Action wiring ───────────────────────────────────────────────────────────
  function emitAction(action, amount) {
    if (!myRoomId) return;
    socket.emit('player_action', { roomId: myRoomId, action, amount });
  }

  $('btn-fold').addEventListener('click',  () => emitAction(GL.ACTIONS.FOLD));
  $('btn-check').addEventListener('click', () => emitAction(GL.ACTIONS.CHECK));
  $('btn-call').addEventListener('click',  () => emitAction(GL.ACTIONS.CALL));
  $('btn-allin').addEventListener('click', () => emitAction(GL.ACTIONS.ALLIN));
  $('btn-raise').addEventListener('click', () => emitAction(GL.ACTIONS.RAISE, parseInt($('raise-input').value, 10)));
  $('raise-input').addEventListener('input', () => { $('raise-value').textContent = $('raise-input').value; });
  $('btn-start').addEventListener('click', () => socket.emit('start_game', { roomId: myRoomId }));

  // ─── BGM ──────────────────────────────────────────────────────────────────────
  (function initBgm() {
    const bgm       = document.getElementById('bgm');
    const volSlider = $('vol-slider');
    const volValue  = $('vol-value');
    const volPanel  = $('vol-panel');
    if (!bgm) return;

    // ↓↓ 两个场景的 BGM ↓↓
    const BGM_LOBBY  = '/audio/op.mp3';                    // 大厅/等待 BGM
    const BGM_BATTLE = '/audio/hgss-johto-trainer.mp3';   // 游戏中对战 BGM

    let currentBgmUrl = null;
    let userInteracted = false;
    bgm.volume = 0.35;

    // Update slider display to match initial volume
    if (volSlider) {
      volSlider.value = bgm.volume;
      if (volValue) volValue.textContent = Math.round(bgm.volume * 100) + '%';
    }

    // Toggle volume panel
    const btnVol = $('btn-vol');
    if (btnVol && volPanel) {
      btnVol.addEventListener('click', () => volPanel.classList.toggle('hidden'));
    }

    // Volume slider
    if (volSlider) {
      volSlider.addEventListener('input', () => {
        const v = parseFloat(volSlider.value);
        bgm.volume = v;
        if (volValue) volValue.textContent = Math.round(v * 100) + '%';
        if (v > 0 && bgm.paused && bgm.src) bgm.play().catch(() => {});
        else if (v === 0) bgm.pause();
      });
    }

    // Switch BGM track (crossfade-ish: fade out → swap → fade in)
    window.switchBgm = function(url) {
      if (currentBgmUrl === url) return;
      currentBgmUrl = url;
      if (!userInteracted) return; // will be played on next interaction
      const targetVol = bgm.volume;
      // Fade out
      let fadeOut = setInterval(() => {
        if (bgm.volume > 0.04) {
          bgm.volume = Math.max(0, bgm.volume - 0.04);
        } else {
          clearInterval(fadeOut);
          bgm.pause();
          bgm.src = url;
          bgm.volume = 0;
          bgm.play().catch(() => {});
          // Fade in
          let fadeIn = setInterval(() => {
            if (bgm.volume < targetVol - 0.04) {
              bgm.volume = Math.min(targetVol, bgm.volume + 0.04);
            } else {
              bgm.volume = targetVol;
              clearInterval(fadeIn);
            }
          }, 40);
        }
      }, 40);
    };

    // Auto-start BGM on first user interaction (browsers block autoplay)
    function tryPlayBgm() {
      userInteracted = true;
      const url = currentBgmUrl || BGM_LOBBY;
      currentBgmUrl = url;
      bgm.src = url;
      bgm.play().catch(() => {});
    }
    document.addEventListener('click', tryPlayBgm, { once: true });
    document.addEventListener('touchstart', tryPlayBgm, { once: true });

    // Default to lobby BGM on load
    window.switchBgm(BGM_LOBBY);

    // Expose URLs for renderGame to use
    window.BGM_LOBBY  = BGM_LOBBY;
    window.BGM_BATTLE = BGM_BATTLE;
  })();

  // ─── Help overlay ──────────────────────────────────────────────────────────────
  (function initHelp() {
    const overlay  = document.getElementById('help-overlay');
    const btnHelp  = document.getElementById('btn-help');
    const btnClose = document.getElementById('help-close');
    if (!overlay || !btnHelp) return;

    const RANK_LABELS = { 9:'#1', 8:'#2', 7:'#3', 6:'#4', 5:'#5', 4:'#6', 3:'#7', 2:'#8', 1:'#9', 0:'#10' };

    function buildHelp() {
      // ── Hand rankings ──
      const handsEl = document.getElementById('help-hands');
      if (handsEl && !handsEl.childElementCount) {
        const sorted = [...GL.HAND_RANKS].sort((a, b) => b.rank - a.rank);
        handsEl.innerHTML = sorted.map(r => `
          <div class="help-hand-row">
            <span class="help-hand-rank">${RANK_LABELS[r.rank]}</span>
            <span class="help-hand-label">${r.label}</span>
            <span class="help-hand-desc">${r.desc}</span>
            <span class="help-hand-power">+${r.power}</span>
          </div>`).join('');
      }

      // ── Pokémon per type ──
      const typeIds = { fire:'help-mons-fire', water:'help-mons-water', grass:'help-mons-grass', electric:'help-mons-electric' };
      for (const [type, elId] of Object.entries(typeIds)) {
        const el = document.getElementById(elId);
        if (!el || el.childElementCount) continue;
        const mons = [...GL.POKEMON_DATA[type]].sort((a, b) => b.value - a.value); // A(13) first
        el.innerHTML = mons.map(m => `
          <div class="help-mon-card">
            <div class="help-mon-val">${VALUE_LABEL(m.value)}</div>
            <img class="help-mon-img" src="${GL.spriteUrl(m.id)}" alt="${m.zhName}" loading="lazy" />
            <div class="help-mon-name">${m.zhName}</div>
          </div>`).join('');
      }
    }

    btnHelp.addEventListener('click', () => {
      buildHelp();
      overlay.classList.remove('hidden');
    });
    btnClose.addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  })();

  // ─── Boot ─────────────────────────────────────────────────────────────────────
  applyI18n();
  initSocket();
})();
