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
      prize:          '奖励池',
      coins:          '金币',
      leave:          '离开',
      battleCost:     '应战费用',
      fold:           '撤  退',
      check:          '观  望',
      call:           '应  战',
      raise:          '强  化',
      allin:          '全力以赴',
      startBattle:    '⚔️ 开始对战！',
      nextRound:      '下一局即将开始',
      waitHost:       '等待房主开始对战…',
      playerCount:    (n, max) => `已集结 ${n}/${max} 名训练家`,
      myPower:        '战斗力',
      folded:         '撤退',
      allIn:          '全力出击',
      dealer:         '道馆主',
      smallBlind:     '挑战者',
      bigBlind:       '守关者',
      switchLang:     'English',
      phaseLabels: {
        waiting:  '等待集结',
        preflop:  '初始精灵',
        flop:     '探索阶段',
        turn:     '遭遇阶段',
        river:    '决战阶段',
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
      blindsNow:      (s, b) => `入场费: ${s}/${b}`,
      roundLabel:     r => `第 ${r} 局`,
      handLabel:      '持有精灵',
      communityLabel: '对战场地',    },
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
      dealer:         'Gym Leader',
      smallBlind:     'Challenger',
      bigBlind:       'Gatekeeper',
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
  // tracks which hand card keys are already in the DOM (never re-animate them)
  const renderedMyHandKeys = new Set();
  // tournament animation state
  let tournamentAnimationActive = false;
  let tournamentAnimationComplete = false;
  let lastShowdownRound = -1; // Track which round's showdown we've animated
  // card entry animation queue
  let cardEntryQueue = [];
  let isPlayingCardEntry = false;
  // track which cards are queued or animating to prevent duplicates
  const queuedCardKeys = new Set();
  // track last phase to detect phase changes
  let lastPhase = null;

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
    socket.on('game_state',   state => { gameState = state; renderGame(state); });
    socket.on('action_log',   data  => showActionLog(data));
    socket.on('error',        ({ msg }) => showToast(msg, 'error'));
    socket.on('disconnect',   () => showToast('连接断开', 'error'));
  }
  // ─── Action log feed ───────────────────────────────────────────────────────────────
  const ACTION_ICON  = { fold: '🏳️', check: '💪', call: '⚔️', raise: '⬆️', allin: '💥' };
  const ACTION_COLOR = { fold: '#ef5350', check: '#78909c', call: '#29b6f6', raise: '#ffca28', allin: '#ff6e40' };
  const ACTION_PARTICLES = { 
    fold: ['💨', '🏳️', '💔', '😰', '👋'],
    check: ['💪', '👀', '🤔', '⏸️', '✋'],
    call: ['⚔️', '💥', '🔥', '⚡', '💢'],
    raise: ['⬆️', '💰', '✨', '🚀', '💎'],
    allin: ['💥', '🔥', '⚡', '💣', '💫', '🌟', '✨', '💢']
  };

  const actionFeed = $('action-log-feed');
  function showActionLog({ name, isBot, action, amount, labels }) {
    if (!actionFeed) return;
    const zhLabel = (labels[action] || {}).zh || action;
    const enLabel = (labels[action] || {}).en || action;
    const label   = lang === 'zh' ? zhLabel : enLabel;
    const icon    = ACTION_ICON[action]  || '•';
    const color   = ACTION_COLOR[action] || '#ccc';
    const amountStr = amount > 0 ? ` <span class="al-amount">${amount}</span>` : '';

    const el = document.createElement('div');
    el.className = 'action-log-item';
    el.style.borderLeftColor = color;
    el.innerHTML = `<span class="al-icon">${icon}</span>
      <span class="al-name">${isBot ? '🤖 ' : ''}${escHtml(name)}</span>
      <span class="al-label" style="color:${color}">${label}</span>${amountStr}`;
    actionFeed.prepend(el);

    // Limit feed to 6 entries
    while (actionFeed.children.length > 6) actionFeed.lastChild.remove();

    // Auto-remove after 4 s
    requestAnimationFrame(() => el.classList.add('al-visible'));
    setTimeout(() => {
      el.classList.add('al-hiding');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, 4000);

    // Show epic action announcement only for raise and allin
    if (action === 'raise' || action === 'allin') {
      showActionAnnouncement({ name, isBot, action, amount, labels });
    }
  }

  // ─── Epic Action Announcement ──────────────────────────────────────────────────
  let announcementTimeout = null;
  function showActionAnnouncement({ name, isBot, action, amount, labels }) {
    const announcement = $('action-announcement');
    if (!announcement) return;

    // Clear any existing announcement
    if (announcementTimeout) {
      clearTimeout(announcementTimeout);
      announcement.classList.add('hidden');
    }

    const zhLabel = (labels[action] || {}).zh || action;
    const enLabel = (labels[action] || {}).en || action;
    const label   = lang === 'zh' ? zhLabel : enLabel;

    // Set player name
    const playerEl = announcement.querySelector('.action-announcement-player');
    playerEl.textContent = (isBot ? '🤖 ' : '') + name;

    // Set action text
    const textEl = announcement.querySelector('.action-announcement-text');
    textEl.textContent = label;

    // Set amount (if applicable)
    const amountEl = announcement.querySelector('.action-announcement-amount');
    if (amount > 0) {
      amountEl.textContent = `${amount} ${t('coins')}`;
      amountEl.style.display = 'block';
    } else {
      amountEl.style.display = 'none';
    }

    // Set action-specific class
    announcement.className = 'action-announcement action-' + action;

    // Spawn particles
    spawnActionParticles(announcement, action);

    // Show announcement
    announcement.classList.remove('hidden');

    // Auto-hide after 2 seconds
    announcementTimeout = setTimeout(() => {
      announcement.classList.add('hidden');
      // Clean up particles
      const particlesContainer = announcement.querySelector('.action-announcement-particles');
      if (particlesContainer) particlesContainer.innerHTML = '';
    }, 2000);
  }

  function spawnActionParticles(container, action) {
    const particlesContainer = container.querySelector('.action-announcement-particles');
    if (!particlesContainer) return;

    // Clear existing particles
    particlesContainer.innerHTML = '';

    const particles = ACTION_PARTICLES[action] || ['✨'];
    const count = action === 'allin' ? 20 : 12;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'action-announcement-particle';
      
      // Random position
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      
      // Random trajectory
      const tx = (Math.random() - 0.5) * 200 + 'px';
      const ty = -(Math.random() * 150 + 50) + 'px';
      const rotate = (Math.random() * 720 - 360) + 'deg';
      
      particle.style.cssText = `
        left: ${x}%;
        top: ${y}%;
        --tx: ${tx};
        --ty: ${ty};
        --rotate: ${rotate};
        animation-delay: ${i * 50}ms;
      `;
      
      particle.textContent = particles[i % particles.length];
      particlesContainer.appendChild(particle);
      
      // Remove after animation
      particle.addEventListener('animationend', () => particle.remove());
    }
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
      const targetBgm = state.phase === 'waiting' ? window.BGM_LOBBY : window.BGM_BATTLE;
      console.log('[renderGame] Phase:', state.phase, 'Target BGM:', targetBgm);
      window.switchBgm(targetBgm);
    } else {
      console.log('[renderGame] switchBgm not available yet');
    }

    const phaseKey   = state.phase;
    const phaseLabel = (t('phaseLabels') || {})[phaseKey] || phaseKey;
    const classMap   = { waiting:'phase-waiting', preflop:'phase-preflop', flop:'phase-flop',
                         turn:'phase-turn', river:'phase-river', showdown:'phase-showdown' };
    $('hdr-phase').innerHTML = `<span class="phase-badge ${classMap[phaseKey]||''}">${escHtml(phaseLabel)}</span>`;
    const phaseBanner = $('phase-banner');
    if (phaseBanner) {
      phaseBanner.innerHTML = `<span class="phase-badge phase-badge-big ${classMap[phaseKey]||""}">${escHtml(phaseLabel)}</span>`;
    }
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
      // Reset animation state for each new round
      if (state.roundCount !== lastShowdownRound) {
        lastShowdownRound = state.roundCount;
        tournamentAnimationComplete = false;
        tournamentAnimationActive = false;
      }
      
      // Check if we need to play tournament animations first
      if (state.tournamentBracket && state.tournamentBracket.length > 0 && !tournamentAnimationComplete) {
        if (!tournamentAnimationActive) {
          playTournamentAnimations(state);
        }
      } else {
        showShowdown(state);
      }
    } else {
      hideShowdown();
      hideFinalChampion();
      hideTournament();
    }
  }

  // ─── Community cards ─────────────────────────────────────────────────────────
  function renderCommunity(state) {
    const cards  = state.community || [];
    const el     = $('community-cards');

    // On new game start the community will be empty; reset tracking
    if (state.phase === 'preflop' || state.phase === 'waiting') {
      renderedCommunityKeys.clear();
      el.innerHTML = '';
    }

    // Get current number of rendered cards
    const currentCardCount = Array.from(el.children).filter(child => 
      child.classList.contains('poke-mon')
    ).length;

    // Only render if the number of cards changed or container is empty
    if (currentCardCount !== cards.length || el.children.length === 0) {
      // If we have fewer cards than before or starting fresh, do full render
      if (currentCardCount > cards.length || el.children.length === 0) {
        el.innerHTML = '';
        renderedCommunityKeys.clear();
        
        for (let i = 0; i < 5; i++) {
          if (i < cards.length) {
            const card  = cards[i];
            const key   = `${card.type}-${card.id}`;
            const isNew = !renderedCommunityKeys.has(key);
            
            if (isNew && state.phase !== 'waiting') {
              // Queue card entry animation for new cards
              const slot = document.createElement('div');
              slot.className = 'poke-slot';
              slot.textContent = '?';
              el.appendChild(slot);
              queueCardEntry(card, el, i, false);
            } else {
              // Render immediately for existing cards or waiting phase
              const monEl = makeMonEl(card, false, false, 0);
              monEl.dataset.cardKey = key;
              el.appendChild(monEl);
            }
            renderedCommunityKeys.add(key);
          } else {
            const slot = document.createElement('div');
            slot.className  = 'poke-slot';
            slot.textContent = '?';
            el.appendChild(slot);
          }
        }
      } else {
        // We have more cards than before - only add the new ones
        for (let i = currentCardCount; i < cards.length; i++) {
          const card  = cards[i];
          const key   = `${card.type}-${card.id}`;
          const isNew = !renderedCommunityKeys.has(key);
          
          if (isNew && state.phase !== 'waiting') {
            // Queue card entry animation for new cards
            queueCardEntry(card, el, i, false);
          } else {
            // Render immediately
            const monEl = makeMonEl(card, false, false, 0);
            monEl.dataset.cardKey = key;
            
            // Replace the placeholder at position i
            if (el.children[i] && el.children[i].classList.contains('poke-slot')) {
              el.replaceChild(monEl, el.children[i]);
            } else {
              el.appendChild(monEl);
            }
          }
          
          renderedCommunityKeys.add(key);
        }
      }
    }
  }

  // ─── Opponents ───────────────────────────────────────────────────────────────
  function renderOpponents(state) {
    const area = $('opponents-area');
    area.innerHTML = '';
    const n = state.players.length;
    
    state.players.forEach((p, idx) => {
      const isMe = p.id === myId;
      const isDealer = idx === state.dealerIdx;
      const isActive = state.players[state.turnIndex]?.id === p.id;
      
      // Calculate small blind and big blind positions
      const sbIdx = n > 1 ? (state.dealerIdx + 1) % n : -1;
      const bbIdx = n > 2 ? (state.dealerIdx + 2) % n : -1;
      const isSmallBlind = idx === sbIdx && state.phase !== 'waiting';
      const isBigBlind = idx === bbIdx && state.phase !== 'waiting';

      let statusHtml = '';
      // Position indicators take priority, then status
      if (isDealer) statusHtml = `<span class="opp-status dealer">${t('dealer')}</span>`;
      else if (isSmallBlind) statusHtml = `<span class="opp-status small-blind">${t('smallBlind')}</span>`;
      else if (isBigBlind) statusHtml = `<span class="opp-status big-blind">${t('bigBlind')}</span>`;
      else if (p.folded) statusHtml = `<span class="opp-status folded">${t('folded')}</span>`;
      else if (p.allIn) statusHtml = `<span class="opp-status allin">${t('allIn')}</span>`;

      const slot = document.createElement('div');
      slot.className = `opponent-slot ${p.folded ? 'folded' : ''} ${isActive ? 'is-turn' : ''}`;
      if (p.isBot) slot.classList.add('is-bot');
      if (isMe) slot.classList.add('is-me');

      // 不显示卡片占位符
      const cardsHtml = '';

      const betHtml = p.bet > 0
        ? `<div class="opp-bet">${t('battleCost')}: ${p.bet}</div>` : '';

      slot.innerHTML = `
        ${cardsHtml}
        <div class="opp-info">
          <div class="opp-name">${p.isBot ? '🤖 ' : ''}${escHtml(p.name)}${isMe ? ' 👤' : ''}${statusHtml}</div>
          <div class="opp-chips">${p.chips} ${t('coins')}</div>
          ${betHtml}
          ${p.bestHand ? `<div style="font-size:10px;color:#aaa">${escHtml(p.bestHand.rankLabel)}</div>` : ''}
        </div>`;
      area.appendChild(slot);
    });
  }

  // ─── My hand ────────────────────────────────────────────────────────────────────────
  function renderMyHand(state, me) {
    const cardsEl    = $('my-cards');
    const hudEl      = $('power-hud');
    const hudRankEl  = $('power-hud-rank');
    const hudPwrEl   = $('power-hud-power');

    // Reset tracking only when phase actually changes to waiting (new round)
    if (state.phase === 'waiting' && lastPhase !== 'waiting') {
      renderedMyHandKeys.clear();
      queuedCardKeys.clear();
    }
    lastPhase = state.phase;

    if (!me || !me.hand || !me.hand.length) {
      cardsEl.innerHTML = '';
      for (let i = 0; i < 2; i++) {
        const s = document.createElement('div');
        s.className = 'poke-slot'; s.textContent = '?';
        cardsEl.appendChild(s);
      }
      if (hudEl) hudEl.classList.add('hidden');
      return;
    }

    const bestKeys = new Set((me.bestHand?.bestFive || []).map(c => `${c.type}-${c.value}`));

    // Only clear and re-render if hand composition changed
    const currentHandKeys = me.hand.map(c => `${c.type}-${c.id}`).join(',');
    const existingHandKeys = Array.from(cardsEl.children)
      .filter(el => el.classList.contains('poke-mon'))
      .map(el => el.dataset.cardKey)
      .join(',');

    if (currentHandKeys !== existingHandKeys) {
      cardsEl.innerHTML = '';
      me.hand.forEach((card, i) => {
        const key = `${card.type}-${card.id}`;
        const isNew = !renderedMyHandKeys.has(key);
        const isQueued = queuedCardKeys.has(key);
        const inBest = bestKeys.has(`${card.type}-${card.value}`);
        
        if (isNew && !isQueued && state.phase === 'preflop') {
          // Queue card entry animation for new hand cards in preflop
          const slot = document.createElement('div');
          slot.className = 'poke-slot';
          slot.textContent = '?';
          cardsEl.appendChild(slot);
          queueCardEntry(card, cardsEl, i, true);
          queuedCardKeys.add(key);
        } else {
          // Render immediately for existing cards or other phases
          const el = makeMonEl(card, inBest, false, 0);
          el.dataset.cardKey = key;
          cardsEl.appendChild(el);
        }
        renderedMyHandKeys.add(key);
      });
    } else {
      // Just update in-best status without re-rendering
      Array.from(cardsEl.children).forEach((el, i) => {
        if (i < me.hand.length) {
          const card = me.hand[i];
          const inBest = bestKeys.has(`${card.type}-${card.value}`);
          if (inBest) {
            el.classList.add('in-best');
          } else {
            el.classList.remove('in-best');
          }
        }
      });
    }
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
        $('waiting-msg').textContent = t('playerCount', state.players.length, state.maxPlayers || 8);
        $('btn-start').disabled = state.players.filter(p => p.chips > 0).length < 2;
        $('bot-controls').classList.remove('hidden');
        $('btn-remove-bot').disabled = !state.players.some(p => p.isBot);
      } else {
        $('btn-start').classList.add('hidden');
        $('bot-controls').classList.add('hidden');
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
    $('raise-input').min   = 0;
    $('raise-input').max   = maxRaise;
    $('raise-input').value = Math.min(minRaise * 2, maxRaise);
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
        <div class="sidebar-player-name">${isDealer ? '🎖️ ' : ''}${p.isBot ? '🤖 ' : ''}${escHtml(p.name)}${p.id === myId ? ' (Me)' : ''}</div>
        <div class="sidebar-player-chips">${p.chips} ${t('coins')}</div>
        ${p.bet ? `<div style="font-size:10px;color:#78909c">${p.bet}</div>` : ''}`;
      sb.appendChild(div);
    });
  }

  // ─── Pokémon name helper ──────────────────────────────────────────────────────
  function getMonName(card) {
    return (lang === 'zh' && card.zhName) ? card.zhName : card.name;
  }

  // ─── Tournament Animations ───────────────────────────────────────────────────
  const tournamentOverlay = $('tournament-overlay');
  
  function playTournamentAnimations(state) {
    tournamentAnimationActive = true;
    const bracket = state.tournamentBracket || [];
    
    if (bracket.length === 0) {
      tournamentAnimationComplete = true;
      tournamentAnimationActive = false;
      showShowdown(state);
      return;
    }
    
    // Show battle start banner first
    showBattleStartBanner();
    
    let currentBattleIndex = 0;
    const BATTLE_DURATION = 8000; // 8 seconds per battle (slower)
    const PAUSE_BETWEEN = 1000;   // 1 second pause between battles
    const BANNER_DURATION = 2000; // 2 seconds for banner
    
    function playNextBattle() {
      if (currentBattleIndex >= bracket.length) {
        // All battles complete, hide tournament overlay and show showdown
        hideTournament();
        tournamentAnimationComplete = true;
        tournamentAnimationActive = false;
        showShowdown(state);
        return;
      }
      
      const battle = bracket[currentBattleIndex];
      showTournamentBattle(battle, state.community);
      
      currentBattleIndex++;
      setTimeout(playNextBattle, BATTLE_DURATION + PAUSE_BETWEEN);
    }
    
    // Start first battle after banner completes
    setTimeout(() => {
      playNextBattle();
    }, BANNER_DURATION);
  }
  
  function showBattleStartBanner() {
    const banner = $('battle-start-banner');
    if (!banner) return;
    
    banner.classList.remove('hidden');
    
    // Play fight sound effect
    const fightSfx = $('fight-sfx');
    if (fightSfx) {
      fightSfx.currentTime = 0;
      fightSfx.volume = 0.7;
      fightSfx.play().catch(e => console.log('Fight SFX play failed:', e));
    }
    
    // Hide banner after 2 seconds
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 2000);
  }
  
  function showTournamentBattle(battle, community) {
    if (!tournamentOverlay) return;
    
    tournamentOverlay.classList.remove('hidden');
    
    const p1El = $('tournament-p1');
    const p2El = $('tournament-p2');
    const resultEl = $('tournament-result');
    const titleEl = $('tournament-title');
    
    // Set title
    titleEl.textContent = lang === 'zh' ? '⚔️ 擂台对决' : '⚔️ Arena Battle';
    
    // Clear previous result and animations
    resultEl.textContent = '';
    resultEl.className = 'tournament-result';
    p1El.classList.remove('tournament-winner', 'tournament-loser', 'tournament-attacking');
    p2El.classList.remove('tournament-winner', 'tournament-loser', 'tournament-attacking');
    
    // Render player 1 and 2 with cards (no animation classes yet)
    renderTournamentPlayer(p1El, battle.player1, community, false);
    renderTournamentPlayer(p2El, battle.player2, community, false);
    
    // Phase 1: Show all cards (0-1.5s)
    // Phase 2: Highlight best 5 cards for both players (at 1.5s)
    setTimeout(() => {
      highlightBestCards(p1El);
      highlightBestCards(p2El);
    }, 1500);
    
    // Phase 3: Both players attack simultaneously (at 3.5s)
    setTimeout(() => {
      p1El.classList.add('tournament-attacking');
      p2El.classList.add('tournament-attacking');
    }, 3500);
    
    // Phase 4: Apply winner/loser effects (at 4.5s)
    setTimeout(() => {
      p1El.classList.remove('tournament-attacking');
      p2El.classList.remove('tournament-attacking');
      
      // Apply winner/loser effects
      if (battle.winnerId === battle.player1.id) {
        p1El.classList.add('tournament-winner');
        p2El.classList.add('tournament-loser');
      } else {
        p2El.classList.add('tournament-winner');
        p1El.classList.add('tournament-loser');
      }
    }, 4500);
    
    // Phase 5: Show result text after 3 second pause (at 7.5s)
    setTimeout(() => {
      const winner = battle.winnerId === battle.player1.id ? battle.player1 : battle.player2;
      const winnerName = winner.isBot ? '🤖 ' + winner.name : winner.name;
      resultEl.textContent = lang === 'zh' ? `🏆 ${winnerName} 胜出！` : `🏆 ${winnerName} Wins!`;
      resultEl.classList.add('tournament-result-show');
    }, 7500);
  }
  
  function highlightBestCards(playerEl) {
    const mons = playerEl.querySelectorAll('.tournament-mon');
    mons.forEach(mon => {
      if (mon.getAttribute('data-best') === 'true') {
        mon.classList.add('in-best-hand');
      } else {
        mon.classList.add('not-in-best');
      }
    });
  }
  
  function renderTournamentPlayer(playerEl, player, community, withInitialAnimation = true) {
    const nameEl = playerEl.querySelector('.tournament-player-name');
    const monsEl = playerEl.querySelector('.tournament-player-mons');
    const rankEl = playerEl.querySelector('.tournament-player-rank');
    const powerEl = playerEl.querySelector('.tournament-player-power');
    
    // Reset classes
    playerEl.classList.remove('tournament-winner', 'tournament-loser');
    
    // Player name
    const displayName = player.isBot ? '🤖 ' + player.name : player.name;
    nameEl.textContent = displayName;
    
    // Get best 5 cards for highlighting (but don't apply classes yet)
    const bestFiveKeys = new Set();
    if (player.bestHand && player.bestHand.bestFive) {
      player.bestHand.bestFive.forEach(c => {
        bestFiveKeys.add(`${c.type}-${c.value}`);
      });
    }
    
    // Render all 7 cards (2 hand + 5 community) with separator
    // Start with normal appearance, no highlight/dim classes
    const handCards = player.hand.map((card) => {
      const key = `${card.type}-${card.value}`;
      const isInBest = bestFiveKeys.has(key);
      return `<div class="tournament-mon hand-mon" data-best="${isInBest}" data-type="${card.type}">
        <img src="${GL.spriteUrl(card.id)}" alt="${escHtml(getMonName(card))}" />
        <div class="tournament-mon-name">${escHtml(getMonName(card))}</div>
        <div class="tournament-mon-label">${TYPE_EMOJI[card.type] || ''}${VALUE_LABEL(card.value)}</div>
      </div>`;
    }).join('');
    
    const communityCards = community.map((card) => {
      const key = `${card.type}-${card.value}`;
      const isInBest = bestFiveKeys.has(key);
      return `<div class="tournament-mon community-mon" data-best="${isInBest}" data-type="${card.type}">
        <img src="${GL.spriteUrl(card.id)}" alt="${escHtml(getMonName(card))}" />
        <div class="tournament-mon-name">${escHtml(getMonName(card))}</div>
        <div class="tournament-mon-label">${TYPE_EMOJI[card.type] || ''}${VALUE_LABEL(card.value)}</div>
      </div>`;
    }).join('');
    
    monsEl.innerHTML = `
      ${handCards}
      <div class="tournament-card-separator"></div>
      ${communityCards}
    `;
    
    // Rank and power
    if (player.bestHand) {
      rankEl.textContent = player.bestHand.rankLabel;
      powerEl.textContent = '⚡ ' + (player.bestHand.totalPower * 100).toLocaleString();
    }
  }
  
  function hideTournament() {
    if (tournamentOverlay) {
      tournamentOverlay.classList.add('hidden');
    }
  }

  // ─── Showdown ─────────────────────────────────────────────────────────────────
  const showdownOverlay  = $('showdown-overlay');
  const showdownTitle    = $('showdown-title');
  const showdownContent  = $('showdown-content');
  const countdownEl      = $('countdown');

  function showShowdown(state) {
    // Calculate total tournament animation time
    const bracket = state.tournamentBracket || [];
    const BATTLE_DURATION = 8000;  // Match server-side duration
    const PAUSE_BETWEEN = 1000;    // Match server-side pause
    const tournamentTime = bracket.length > 0 ? bracket.length * (BATTLE_DURATION + PAUSE_BETWEEN) : 0;
    
    // If no tournament (everyone folded), use 5s; otherwise 15s base
    const baseSeconds = bracket.length === 0 ? 5 : 15;
    const tournamentSeconds = Math.ceil(tournamentTime / 1000);
    let secs = baseSeconds;
    
    countdownEl.textContent = secs;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      secs--;
      countdownEl.textContent = secs;
      if (secs <= 0) clearInterval(countdownTimer);
    }, 1000);

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

    // ── Per-player chip change table ──
    if (state.roundResults && state.roundResults.length) {
      const winnerIds = new Set(winners.map(w => w.id));
      // Sort by chips descending (overall ranking)
      const sorted = [...state.roundResults].sort((a, b) => b.chips - a.chips);
      html += '<div class="round-results">';
      html += `<div class="round-results-title">${lang === 'zh' ? '本局金币变化' : 'Chip Changes'}</div>`;
      html += '<div class="round-results-list">';
      sorted.forEach((r, idx) => {
        const place = idx + 1;
        const placeStr = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `#${place}`;
        const isWinner = winnerIds.has(r.id);
        const deltaStr = (r.delta >= 0 ? '+' : '') + r.delta;
        const deltaClass = r.delta > 0 ? 'delta-pos' : r.delta < 0 ? 'delta-neg' : 'delta-zero';
        const powerStr = r.bestHand && r.bestHand.totalPower != null
          ? Math.round(r.bestHand.totalPower * 100).toLocaleString()
          : '-';
        const rankStr = r.bestHand
          ? ` · ${escHtml(r.bestHand.rankLabel)} ⚡${powerStr}`
          : r.folded ? ` · (${t('folded')})` : '';
        html += `<div class="round-result-row${isWinner ? ' is-winner' : ''}">
          <span class="rr-place">${placeStr}</span>
          <span class="rr-name">${r.isBot ? '🤖 ' : ''}${escHtml(r.name)}${isWinner ? ' 🏆' : ''}${rankStr}</span>
          <span class="rr-delta ${deltaClass}">${deltaStr}</span>
          <span class="rr-chips">= ${r.chips} ${t('coins')}</span>
        </div>`;
      });
      html += '</div></div>';
    } else if (others.length) {
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
    renderedMyHandKeys.clear();
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
    return `<div class="showdown-mon-big${inBest ? ' in-best' : ' not-best'}" style="animation-delay:${delay}ms">
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

  // ─── Card Entry Animation System ──────────────────────────────────────────────
  function playCardEntryAnimation(card, targetContainer, targetIndex, isHand = false) {
    const overlay = $('card-entry-overlay');
    const stage = $('card-entry-stage');
    const effectsContainer = $('card-entry-effects');
    const particlesContainer = $('card-entry-particles');
    
    if (!overlay || !stage) return null;

    // Create card element for center stage
    const cardEl = makeMonEl(card, false, false, 0);
    cardEl.style.opacity = '0';
    cardEl.style.transition = 'none';
    
    // Show overlay
    overlay.classList.remove('hidden');
    stage.appendChild(cardEl);
    
    // Set effect color and type based on card type
    const typeColors = {
      fire: '#FF6B35',
      water: '#29B6F6',
      grass: '#66BB6A',
      electric: '#FFD600'
    };
    effectsContainer.style.color = typeColors[card.type] || '#FFD700';
    effectsContainer.className = `card-entry-effects ${card.type}`;
    
    // Create type-specific large-scale effects
    effectsContainer.innerHTML = '';
    
    if (card.type === 'fire') {
      // Fire: Multiple large flames rising from bottom (increased to 15)
      for (let i = 0; i < 15; i++) {
        const flame = document.createElement('div');
        flame.className = 'effect-element';
        const offset = (i - 7) * 50; // Spread flames horizontally
        flame.style.left = `calc(50% + ${offset}px)`;
        flame.style.animationDuration = `${1.2 + Math.random() * 1}s`;
        flame.style.animationDelay = `${i * 0.1}s`;
        flame.style.transform = `translate(-50%, 0) scale(${0.7 + Math.random() * 0.5})`;
        effectsContainer.appendChild(flame);
      }
    } else if (card.type === 'grass') {
      // Grass: Many leaves falling from top (increased to 35)
      for (let i = 0; i < 35; i++) {
        const leaf = document.createElement('div');
        leaf.className = 'effect-element';
        const offset = (Math.random() - 0.5) * 500; // Random horizontal spread
        leaf.style.left = `calc(50% + ${offset}px)`;
        leaf.style.animationDuration = `${2 + Math.random() * 1.5}s`;
        leaf.style.animationDelay = `${i * 0.08}s`;
        leaf.style.transform = `translate(-50%, 0) scale(${0.6 + Math.random() * 0.7}) rotate(${Math.random() * 360}deg)`;
        effectsContainer.appendChild(leaf);
      }
    } else if (card.type === 'electric') {
      // Electric: Lightning bolts striking from sky (increased to 12)
      for (let i = 0; i < 12; i++) {
        const bolt = document.createElement('div');
        bolt.className = 'effect-element';
        const offset = (i - 5.5) * 60; // Spread lightning bolts
        bolt.style.left = `calc(50% + ${offset}px)`;
        bolt.style.animationDelay = `${i * 0.2}s`;
        bolt.style.transform = `translate(-50%, 0) rotate(${(Math.random() - 0.5) * 20}deg)`;
        bolt.style.width = `${6 + Math.random() * 4}px`;
        effectsContainer.appendChild(bolt);
      }
    } else if (card.type === 'water') {
      // Water: Surging waves from bottom (increased to 8)
      for (let i = 0; i < 8; i++) {
        const wave = document.createElement('div');
        wave.className = 'effect-element';
        wave.style.animationDelay = `${i * 0.2}s`;
        wave.style.transform = `translate(-50%, 0) scale(${1 + i * 0.12})`;
        wave.style.opacity = `${0.85 - i * 0.1}`;
        effectsContainer.appendChild(wave);
      }
    }
    
    // Create particles
    const particleEmojis = {
      fire: ['🔥', '✨', '💫', '⭐', '🌟'],
      water: ['💧', '💦', '✨', '💫', '🌊'],
      grass: ['🌿', '🍃', '✨', '💫', '🌱'],
      electric: ['⚡', '✨', '💫', '⭐', '🌟']
    };
    const emojis = particleEmojis[card.type] || ['✨', '💫', '⭐'];
    
    particlesContainer.innerHTML = '';
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'card-entry-particle';
      const angle = (i / 20) * Math.PI * 2;
      const distance = 150 + Math.random() * 100;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      particle.style.setProperty('--tx', `${tx}px`);
      particle.style.setProperty('--ty', `${ty}px`);
      particle.style.animationDelay = `${i * 30}ms`;
      particle.textContent = emojis[i % emojis.length];
      particlesContainer.appendChild(particle);
    }
    
    // Trigger animation
    requestAnimationFrame(() => {
      cardEl.style.opacity = '1';
    });
    
    // After center animation, move to position
    return new Promise(resolve => {
      setTimeout(() => {
        // Get current card position (center of screen)
        const cardRect = cardEl.getBoundingClientRect();
        const currentCenterX = cardRect.left + cardRect.width / 2;
        const currentCenterY = cardRect.top + cardRect.height / 2;
        
        // Get target container position
        const targetRect = targetContainer.getBoundingClientRect();
        
        // Calculate the center of the target container
        const containerCenterX = targetRect.left + targetRect.width / 2;
        const containerCenterY = targetRect.top + targetRect.height / 2;
        
        // Calculate card dimensions at normal scale (110px for community, 108px for hand)
        const cardWidth = isHand ? 108 : 110;
        const gap = 10;
        
        // Calculate total width of all cards with gaps
        const totalCards = targetContainer.querySelectorAll('.poke-mon, .poke-slot').length;
        const totalWidth = totalCards * cardWidth + (totalCards - 1) * gap;
        
        // Calculate starting X position to center all cards
        const startX = containerCenterX - totalWidth / 2;
        
        // Calculate final center position for this specific card
        const finalCenterX = startX + targetIndex * (cardWidth + gap) + cardWidth / 2;
        const finalCenterY = containerCenterY;
        
        // Calculate how much to move from current position
        const deltaX = finalCenterX - currentCenterX;
        const deltaY = finalCenterY - currentCenterY;
        
        // Enable transition and move to final position
        cardEl.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        // Keep the translate(-50%, -50%) from CSS animation, just change position and scale
        cardEl.style.left = `calc(50% + ${deltaX}px)`;
        cardEl.style.top = `calc(50% + ${deltaY}px)`;
        cardEl.style.transform = 'translate(-50%, -50%) scale(0.4)';
        
        // After move animation completes
        setTimeout(() => {
          // Hide overlay
          overlay.classList.add('hidden');
          stage.innerHTML = '';
          particlesContainer.innerHTML = '';
          
          // Add card to actual target container
          const finalCard = makeMonEl(card, false, false, 0);
          const key = `${card.type}-${card.id}`;
          finalCard.dataset.cardKey = key;
          
          if (targetContainer.children[targetIndex]) {
            targetContainer.replaceChild(finalCard, targetContainer.children[targetIndex]);
          } else {
            targetContainer.appendChild(finalCard);
          }
          
          resolve();
        }, 650);
      }, 1200);
    });
  }

  async function processCardEntryQueue() {
    if (isPlayingCardEntry || cardEntryQueue.length === 0) return;
    
    isPlayingCardEntry = true;
    
    while (cardEntryQueue.length > 0) {
      const entry = cardEntryQueue.shift();
      await playCardEntryAnimation(entry.card, entry.targetContainer, entry.targetIndex, entry.isHand);
      // Remove from queued set after animation completes
      const key = `${entry.card.type}-${entry.card.id}`;
      queuedCardKeys.delete(key);
    }
    
    isPlayingCardEntry = false;
  }

  function queueCardEntry(card, targetContainer, targetIndex, isHand = false) {
    cardEntryQueue.push({ card, targetContainer, targetIndex, isHand });
    processCardEntryQueue();
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
  $('btn-raise').addEventListener('click', () => {
    const el = $('raise-input');
    const v  = parseInt(el.value, 10);
    const mn = parseInt(el.min, 10) || 0;
    const mx = parseInt(el.max, 10) || 99999;
    if (isNaN(v) || v < mn || v > mx) {
      el.style.borderColor = '#ef5350';
      setTimeout(() => { el.style.borderColor = ''; }, 1500);
      return;
    }
    el.style.borderColor = '';
    emitAction(GL.ACTIONS.RAISE, v);
  });
  $('raise-input').addEventListener('input', () => {
    $('raise-input').style.borderColor = '';
  });
  document.querySelectorAll('.raise-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const el  = $('raise-input');
      const add = parseInt(btn.dataset.add, 10);
      const cur = parseInt(el.value, 10) || 0;
      const mx  = parseInt(el.max, 10) || 99999;
      el.value = Math.min(cur + add, mx);
      el.style.borderColor = '';
    });
  });
  $('btn-start').addEventListener('click',      () => socket.emit('start_game',  { roomId: myRoomId }));
  $('btn-add-bot').addEventListener('click',    () => socket.emit('add_bot',      { roomId: myRoomId }));
  $('btn-remove-bot').addEventListener('click', () => socket.emit('remove_bot',   { roomId: myRoomId }));

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
    let isSwitching = false;  // Prevent concurrent switches
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
      console.log('[BGM] switchBgm called:', url, 'current:', currentBgmUrl, 'userInteracted:', userInteracted, 'isSwitching:', isSwitching);
      
      // If already switching to this URL or it's the current URL, skip
      if (currentBgmUrl === url && !bgm.paused) {
        console.log('[BGM] Already playing this URL');
        return;
      }
      
      // Update target URL immediately
      currentBgmUrl = url;
      
      if (!userInteracted) {
        // Store the desired BGM URL, will be played on first interaction
        console.log('[BGM] User not interacted yet, storing URL for later');
        return;
      }
      
      // If already switching, cancel and start new switch immediately
      if (isSwitching) {
        console.log('[BGM] Already switching, forcing immediate switch to:', url);
        isSwitching = false;
      }
      
      const targetVol = parseFloat(volSlider?.value || 0.35);
      
      // If BGM is not playing (failed to start or paused), try direct switch
      if (bgm.paused || !bgm.src) {
        console.log('[BGM] BGM not playing, attempting direct switch');
        bgm.src = url;
        bgm.volume = targetVol;
        bgm.play().catch(err => {
          console.log('[BGM] Autoplay blocked:', err);
        }).then(() => {
          console.log('[BGM] Playing:', url);
        });
        return;
      }
      
      // Mark as switching
      isSwitching = true;
      
      // Quick fade out (faster for better responsiveness)
      const fadeOutStep = 0.08;  // Faster fade
      let fadeOut = setInterval(() => {
        if (bgm.volume > fadeOutStep) {
          bgm.volume = Math.max(0, bgm.volume - fadeOutStep);
        } else {
          clearInterval(fadeOut);
          bgm.pause();
          bgm.src = url;
          bgm.volume = 0;
          bgm.play().catch(err => {
            console.log('[BGM] play failed:', err);
            bgm.volume = targetVol; // Restore volume for next attempt
            isSwitching = false;
          }).then(() => {
            console.log('[BGM] Now playing:', url);
            // Quick fade in
            let fadeIn = setInterval(() => {
              if (bgm.volume < targetVol - fadeOutStep) {
                bgm.volume = Math.min(targetVol, bgm.volume + fadeOutStep);
              } else {
                bgm.volume = targetVol;
                clearInterval(fadeIn);
                isSwitching = false;
              }
            }, 30);
          });
        }
      }, 30);
    };

    // Auto-start BGM on first user interaction (browsers block autoplay)
    function tryPlayBgm() {
      if (userInteracted) return; // Already initialized
      console.log('[BGM] First user interaction detected');
      userInteracted = true;
      const url = currentBgmUrl || BGM_LOBBY;
      currentBgmUrl = url;
      bgm.src = url;
      bgm.volume = parseFloat(volSlider?.value || 0.35);
      console.log('[BGM] Attempting to play:', url);
      bgm.play().catch(err => {
        console.log('[BGM] Initial autoplay blocked:', err);
        // Will retry on next switchBgm call
      }).then(() => {
        console.log('[BGM] Successfully started playing:', url);
      });
    }
    document.addEventListener('click', tryPlayBgm);
    document.addEventListener('touchstart', tryPlayBgm);
    document.addEventListener('keydown', tryPlayBgm);

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
    const btnHelpLobby = document.getElementById('btn-help-lobby');
    const btnClose = document.getElementById('help-close');
    if (!overlay) return;

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

    function openHelp() {
      buildHelp();
      overlay.classList.remove('hidden');
    }

    if (btnHelp) btnHelp.addEventListener('click', openHelp);
    if (btnHelpLobby) btnHelpLobby.addEventListener('click', openHelp);
    if (btnClose) btnClose.addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  })();

  // ─── Boot ─────────────────────────────────────────────────────────────────────
  applyI18n();
  initSocket();
})();
