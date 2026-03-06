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
      communityLabel: '对战场地',
      leaderboard:    '🏆 训练家殿堂',
      helpManual:     '📖 精灵图鉴',
    },
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
      leaderboard:    '🏆 Hall of Fame',
      helpManual:     '📖 Pokédex',
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

  // ─── Sound Effects for Pokemon Types ──────────────────────────────────────────
  let audioContext = null;
  
  function initAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
  }

  function playTypeSound(type) {
    try {
      const ctx = initAudioContext();
      
      if (type === 'fire') {
        // Fire: Crackling fire sound
        playFireSound(ctx);
      } else if (type === 'water') {
        // Water: Wave/splash sound
        playWaterSound(ctx);
      } else if (type === 'electric') {
        // Electric: Thunder/zap sound
        playElectricSound(ctx);
      } else if (type === 'grass') {
        // Grass: Wind through leaves sound
        playGrassSound(ctx);
      }
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }

  function playFireSound(ctx) {
    const now = ctx.currentTime;
    const duration = 1.5;
    
    // Create noise for crackling effect
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.3));
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

  function playWaterSound(ctx) {
    const now = ctx.currentTime;
    const duration = 1.5;
    
    // Create flowing water sound with modulated noise
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generate noise with flowing pattern
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      // Add modulation to create flowing/splashing effect
      const modulation = Math.sin(t * 15) * 0.3 + Math.sin(t * 30) * 0.2 + Math.sin(t * 60) * 0.1;
      data[i] = (Math.random() * 2 - 1) * (0.8 + modulation) * (1 - t / duration * 0.5);
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Use bandpass filter for flowing water frequency range
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.8;
    
    // Add a second filter for more natural sound
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'highpass';
    filter2.frequency.value = 800;
    filter2.Q.value = 0.5;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    noise.connect(filter).connect(filter2).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

  function playElectricSound(ctx) {
    const now = ctx.currentTime;
    const duration = 0.8;
    
    // Create sharp electric zap sound
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + duration);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 5;
    
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playGrassSound(ctx) {
    const now = ctx.currentTime;
    const duration = 1.5;
    
    // Create soft wind/rustling sound
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.sin(t * 3) * 0.5;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 400;
    filter.Q.value = 1;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

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
    socket.on('leaderboard_data', data => {
      if (window.renderLeaderboardData) window.renderLeaderboardData(data);
    });
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
      <span class="al-name">${isBot ? '🎮 ' : ''}${escHtml(name)}</span>
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

    // VFX: Screen shake + flash for allin
    if (action === 'allin') {
      triggerScreenShake();
      triggerScreenFlash();
    }

    // VFX: Chip bet animation for raise/allin/call
    if (action === 'raise' || action === 'allin' || action === 'call') {
      // Find the player's DOM element to animate coins from
      const oppSlots = document.querySelectorAll('.opponent-slot');
      let sourceEl = null;
      oppSlots.forEach(slot => {
        const nameEl = slot.querySelector('.opp-name');
        if (nameEl && nameEl.textContent.includes(name)) sourceEl = slot;
      });
      if (!sourceEl && name === gameState?.players.find(p => p.id === myId)?.name) {
        sourceEl = $('my-chips');
      }
      if (sourceEl) animateChipBet(sourceEl);
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
    playerEl.textContent = (isBot ? '🎮 ' : '') + name;

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

    if (action === 'raise') {
      // Create upward energy beams for raise action
      for (let i = 0; i < 12; i++) {
        const beam = document.createElement('div');
        beam.className = 'action-announcement-particle visual-effect';
        
        const x = 20 + (i * 6); // Spread beams across screen
        const delay = i * 80;
        
        beam.style.cssText = `
          left: ${x}%;
          bottom: 0;
          animation-delay: ${delay}ms;
        `;
        
        particlesContainer.appendChild(beam);
        beam.addEventListener('animationend', () => beam.remove());
      }
    } else if (action === 'allin') {
      // Create explosive burst for allin action
      // Main explosion bursts
      for (let i = 0; i < 16; i++) {
        const burst = document.createElement('div');
        burst.className = 'action-announcement-particle visual-effect';
        
        const angle = (i / 16) * Math.PI * 2;
        const distance = 150 + Math.random() * 100;
        const tx = Math.cos(angle) * distance + 'px';
        const ty = Math.sin(angle) * distance + 'px';
        
        burst.style.cssText = `
          left: 50%;
          top: 50%;
          --tx: ${tx};
          --ty: ${ty};
          animation-delay: ${i * 40}ms;
        `;
        
        particlesContainer.appendChild(burst);
        burst.addEventListener('animationend', () => burst.remove());
      }
      
      // Add shockwave rings
      for (let i = 0; i < 4; i++) {
        const shockwave = document.createElement('div');
        shockwave.className = 'action-announcement-particle shockwave';
        
        shockwave.style.cssText = `
          left: 50%;
          top: 50%;
          animation-delay: ${i * 200}ms;
        `;
        
        particlesContainer.appendChild(shockwave);
        shockwave.addEventListener('animationend', () => shockwave.remove());
      }
    } else {
      // For other actions (fold, check, call), use emoji particles
      const particles = ACTION_PARTICLES[action] || ['✨'];
      const count = 12;

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
      window.switchBgm(targetBgm);
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

    // VFX: Phase transition effects
    triggerPhaseTransition(phaseKey);

    renderCommunity(state);
    renderOpponents(state);
    renderMyHand(state, me);
    renderActionPanel(state, me);
    renderSidebar(state);

    // VFX: Chip change animations
    trackChipChanges(state);

    // VFX: Active turn glow
    applyTurnGlow(state, me);

    // VFX: Streak highlights & rare hand highlights
    if (me) {
      applyStreakHighlight(state, me);
      applyRareHandHighlight(state, me);
    }

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
    const me     = state.players.find(p => p.id === myId);

    // Calculate which community cards are in best hand
    const totalCards = (me?.hand?.length || 0) + cards.length;
    const shouldHighlight = totalCards >= 5;
    const bestKeys = shouldHighlight && me?.bestHand?.bestFive
      ? new Set(me.bestHand.bestFive.map(c => `${c.type}-${c.id}`))
      : new Set();

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
            const inBest = bestKeys.has(key);
            
            if (isNew && state.phase !== 'waiting') {
              // Queue card entry animation for new cards
              const slot = document.createElement('div');
              slot.className = 'poke-slot';
              slot.textContent = '?';
              el.appendChild(slot);
              queueCardEntry(card, el, i, false);
            } else {
              // Render immediately for existing cards or waiting phase
              const monEl = makeMonEl(card, inBest, false, 0);
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
          const inBest = bestKeys.has(key);
          
          if (isNew && state.phase !== 'waiting') {
            // Queue card entry animation for new cards
            queueCardEntry(card, el, i, false);
          } else {
            // Render immediately
            const monEl = makeMonEl(card, inBest, false, 0);
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
    
    // Always update in-best status for all existing community cards
    Array.from(el.children).forEach((monEl, i) => {
      if (monEl.classList.contains('poke-mon') && i < cards.length) {
        const card = cards[i];
        const key = `${card.type}-${card.id}`;
        const inBest = bestKeys.has(key);
        if (inBest) {
          monEl.classList.add('in-best');
        } else {
          monEl.classList.remove('in-best');
        }
      }
    });
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
          <div class="opp-name">${p.isBot ? '🎮 ' : ''}${escHtml(p.name)}${isMe ? ' 👤' : ''}${statusHtml}</div>
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

    // Only highlight best 5 cards when we have at least 5 total cards
    const totalCards = me.hand.length + (state.community?.length || 0);
    const shouldHighlight = totalCards >= 5;
    const bestKeys = shouldHighlight 
      ? new Set((me.bestHand?.bestFive || []).map(c => `${c.type}-${c.id}`))
      : new Set();

    // Show/update power HUD if we have best hand data
    if (me.bestHand && hudEl && hudRankEl && hudPwrEl) {
      hudRankEl.textContent = me.bestHand.rankLabel || '';
      hudPwrEl.textContent = me.bestHand.totalPower != null 
        ? (me.bestHand.totalPower * 100).toLocaleString() 
        : '';
      hudEl.classList.remove('hidden');
    } else if (hudEl) {
      hudEl.classList.add('hidden');
    }

    // Only clear and re-render if hand composition changed
    const currentHandKeys = me.hand.map(c => `${c.type}-${c.id}`).join(',');
    const existingHandKeys = Array.from(cardsEl.children)
      .filter(el => el.classList.contains('poke-mon') || el.classList.contains('poke-slot'))
      .map(el => el.dataset.cardKey || '')
      .join(',');

    if (currentHandKeys !== existingHandKeys) {
      cardsEl.innerHTML = '';
      // Clear tracking when we clear DOM, but preserve queued cards
      const queuedKeys = new Set(queuedCardKeys);
      renderedMyHandKeys.clear();
      // Re-add queued cards to rendered set to prevent re-queuing
      queuedKeys.forEach(k => renderedMyHandKeys.add(k));
      
      me.hand.forEach((card, i) => {
        const key = `${card.type}-${card.id}`;
        const isNew = !renderedMyHandKeys.has(key);
        const isQueued = queuedCardKeys.has(key);
        const inBest = bestKeys.has(key);
        
        if (isNew && !isQueued && state.phase === 'preflop') {
          // Queue card entry animation for new hand cards in preflop
          const slot = document.createElement('div');
          slot.className = 'poke-slot';
          slot.textContent = '?';
          slot.dataset.cardKey = key; // Set cardKey on placeholder too
          cardsEl.appendChild(slot);
          queueCardEntry(card, cardsEl, i, true);
          queuedCardKeys.add(key);
          renderedMyHandKeys.add(key);
        } else if (isQueued) {
          // Card is queued for animation, recreate placeholder
          const slot = document.createElement('div');
          slot.className = 'poke-slot';
          slot.textContent = '?';
          slot.dataset.cardKey = key;
          cardsEl.appendChild(slot);
        } else {
          // Render immediately for existing cards or other phases
          const el = makeMonEl(card, inBest, false, 0);
          el.dataset.cardKey = key;
          cardsEl.appendChild(el);
          renderedMyHandKeys.add(key);
        }
      });
    }
    
    // Always update in-best status for all hand cards
    Array.from(cardsEl.children).forEach((el, i) => {
      if (el.classList.contains('poke-mon') && i < me.hand.length) {
        const card = me.hand[i];
        const key = `${card.type}-${card.id}`;
        const inBest = bestKeys.has(key);
        if (inBest) {
          el.classList.add('in-best');
        } else {
          el.classList.remove('in-best');
        }
      }
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
        <div class="sidebar-player-name">${isDealer ? '🎖️ ' : ''}${p.isBot ? '🎮 ' : ''}${escHtml(p.name)}${p.id === myId ? ' (Me)' : ''}</div>
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
    const BANNER_DURATION = 3200; // 1.2s pokeball + 2s text banner
    
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

    const content = banner.querySelector('.battle-banner-content');

    // Phase 0: Show dark overlay with pokeball spin-enlarge
    banner.classList.remove('hidden');
    if (content) content.style.display = 'none';

    const pokeball = createPokeballVFX();
    pokeball.style.position = 'fixed';
    pokeball.style.zIndex = '210';
    banner.appendChild(pokeball);
    requestAnimationFrame(() => pokeball.classList.add('pokeball-battle-anim'));

    // Flash ring when pokeball reaches max size (~55% of 1.2s)
    setTimeout(() => {
      const ring = document.createElement('div');
      ring.className = 'pokeball-flash-ring';
      ring.style.position = 'fixed';
      ring.style.zIndex = '211';
      banner.appendChild(ring);
      ring.addEventListener('animationend', () => ring.remove());
    }, 660);

    // Phase 1: After pokeball fades (1.2s), show text banner + sound
    setTimeout(() => {
      pokeball.remove();
      if (content) content.style.display = '';

      const fightSfx = $('fight-sfx');
      if (fightSfx) {
        fightSfx.currentTime = 0;
        fightSfx.volume = 0.7;
        fightSfx.play().catch(e => {});
      }

      // Hide banner after 2 more seconds of text display
      setTimeout(() => {
        banner.classList.add('hidden');
      }, 2000);
    }, 1200);
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
    p1El.classList.remove('tournament-winner', 'tournament-loser', 'tournament-attacking', 'loser-fade');
    p2El.classList.remove('tournament-winner', 'tournament-loser', 'tournament-attacking', 'loser-fade');

    // VFX cleanup: remove leftover VFX elements from previous battle
    tournamentOverlay.querySelectorAll('.winner-light-pillar, .pillar-particle, .collision-wave, .collision-ray').forEach(el => el.remove());
    
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
      // Play battle music when attack animation starts
      const battleSfx = new Audio('/audio/battle.mp3');
      battleSfx.volume = 0.5;
      battleSfx.play().catch(e => {});
      
      p1El.classList.add('tournament-attacking');
      p2El.classList.add('tournament-attacking');

      // VFX: Screen shake on collision
      triggerScreenShake();

      // VFX: Collision shockwave at center
      const tournBox = document.querySelector('.tournament-box');
      if (tournBox) addCollisionShockwave(tournBox);
    }, 3500);
    
    // Phase 4: Apply winner/loser effects (at 4.5s)
    setTimeout(() => {
      p1El.classList.remove('tournament-attacking');
      p2El.classList.remove('tournament-attacking');
      
      // Apply winner/loser effects
      if (battle.winnerId === battle.player1.id) {
        p1El.classList.add('tournament-winner');
        p2El.classList.add('tournament-loser');
        // VFX: Loser fade + winner light pillar
        p2El.classList.add('loser-fade');
        addWinnerLightPillar(p1El);
      } else {
        p2El.classList.add('tournament-winner');
        p1El.classList.add('tournament-loser');
        // VFX: Loser fade + winner light pillar
        p1El.classList.add('loser-fade');
        addWinnerLightPillar(p2El);
      }

      // VFX: Screen flash on winner reveal
      triggerScreenFlash();
    }, 4500);
    
    // Phase 5: Show result text after 3 second pause (at 7.5s)
    setTimeout(() => {
      const winner = battle.winnerId === battle.player1.id ? battle.player1 : battle.player2;
      const winnerName = winner.isBot ? '🎮 ' + winner.name : winner.name;
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
    const displayName = player.isBot ? '🎮 ' + player.name : player.name;
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
    // Play victory music as one-time sound effect
    const victorySfx = new Audio('/audio/victory.mp3');
    victorySfx.volume = 0.5;
    victorySfx.play().catch(e => {});
    
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
    if (!winners.length) return;

    showdownTitle.innerHTML = `<span class="showdown-victory-title">${
      winners.length > 1 ? t('draw') : t('victory', winners[0].name)
    }</span>`;

    // Check if all opponents folded (only one player didn't fold)
    const activePlayers = state.players.filter(p => !p.folded && !p.spectator);
    const allOpponentsFolded = activePlayers.length === 1;

    let html = '';
    
    // Display all winners (for ties, show all players with same strength)
    winners.forEach((w, idx) => {
      if (allOpponentsFolded || !w.bestHand) {
        // Simple display when all opponents folded - no need to show cards or strength
        html += `<div class="showdown-winner">
          <div class="showdown-winner-name">🥇 ${escHtml(w.name)}</div>
          <div class="showdown-rank-label">${t('allFolded')}</div>
        </div>`;
      } else {
        // Full display with cards and strength when there was actual competition
        const bestFiveKeys = new Set((w.bestHand.bestFive || []).map(c => `${c.type}-${c.value}`));

        // All 7 cards split into hand + community
        const handCards      = (w.hand || []);
        const communityCards = (state.community || []);

        html += `<div class="showdown-winner${winners.length > 1 ? ' showdown-winner-tied' : ''}">
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
      }
    });

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
        
        // Prioritize showing folded status
        let rankStr = '';
        let foldedClass = '';
        
        if (r.folded) {
          // Always show folded status for folded players
          rankStr = ` · 🏃 ${t('folded')}`;
          foldedClass = ' folded-player';
        } else if (allOpponentsFolded) {
          // Winner when all opponents folded - no rank/power needed
          rankStr = '';
        } else if (r.bestHand) {
          // Normal display with rank and power for active players
          const powerStr = r.bestHand.totalPower != null
            ? Math.round(r.bestHand.totalPower * 100).toLocaleString()
            : '-';
          rankStr = ` · ${escHtml(r.bestHand.rankLabel)} ⚡${powerStr}`;
        }
        
        html += `<div class="round-result-row${isWinner ? ' is-winner' : ''}${foldedClass}">
          <span class="rr-place">${placeStr}</span>
          <span class="rr-name">${r.isBot ? '🎮 ' : ''}${escHtml(r.name)}${isWinner ? ' 🏆' : ''}${rankStr}</span>
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

    // VFX: Add winner light pillars to winner sections
    requestAnimationFrame(() => {
      showdownContent.querySelectorAll('.showdown-winner').forEach(el => {
        addWinnerLightPillar(el);
      });
    });

    // VFX: Track win streaks
    const winnerIds = new Set(winners.map(w => w.id));
    state.players.forEach(p => {
      if (winnerIds.has(p.id)) {
        winStreaks[p.id] = (winStreaks[p.id] || 0) + 1;
      } else {
        winStreaks[p.id] = 0;
      }
    });

    // VFX: Play skill effect based on winner's dominant type
    if (winners.length > 0 && winners[0].bestHand && winners[0].bestHand.bestFive) {
      const types = winners[0].bestHand.bestFive.map(c => c.type);
      const typeCounts = {};
      types.forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
      const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
      if (dominantType) {
        setTimeout(() => playSkillEffect(dominantType[0]), 500);
      }
    }
  }

  function hideShowdown() {
    if (!showdownOverlay._shown) return;
    showdownOverlay._shown = false;
    showdownOverlay.classList.add('hidden');
    showdownOverlay.classList.remove('showdown-epic');
    const overlayBox = showdownOverlay.querySelector('.overlay-box');
    if (overlayBox) overlayBox.classList.remove('showdown-epic-box');
    showdownOverlay.querySelectorAll('.sparkle, .winner-light-pillar, .pillar-particle').forEach(s => s.remove());
    clearInterval(countdownTimer);
    // Don't clear tracking sets here - they should only be cleared when DOM is cleared
    // renderedCommunityKeys and renderedMyHandKeys are cleared in their respective render functions
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

    // VFX: Enhanced champion overlay with halos, bubbles, gradient text
    requestAnimationFrame(() => enhanceChampionOverlay(champOverlay.querySelector('.champ-box')));

    // VFX: Screen flash for champion reveal
    triggerScreenFlash();

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
    
    // Add hover and click sound effects
    let hoverTimeout = null;
    
    // Play sound on mouse enter (with slight delay to avoid too many sounds)
    wrap.addEventListener('mouseenter', () => {
      hoverTimeout = setTimeout(() => {
        playTypeSound(card.type);
      }, 100);
    });
    
    // Cancel sound if mouse leaves quickly
    wrap.addEventListener('mouseleave', () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
    });
    
    // Play sound on touch/click
    wrap.addEventListener('touchstart', (e) => {
      playTypeSound(card.type);
    }, { passive: true });
    
    wrap.addEventListener('click', () => {
      playTypeSound(card.type);
    });
    
    return wrap;
  }

  // ─── Card Entry Animation System ──────────────────────────────────────────────
  const POKEBALL_ENTRY_DURATION = 800; // ms for pokeball phase

  function playCardEntryAnimation(card, targetContainer, targetIndex, isHand = false) {
    const overlay = $('card-entry-overlay');
    const stage = $('card-entry-stage');
    const effectsContainer = $('card-entry-effects');
    const particlesContainer = $('card-entry-particles');
    
    if (!overlay || !stage) return null;

    // ── Phase 0: Pokeball spin-open ──────────────────────────────────
    // Hide the decorative arena pokeball so it doesn't show through overlay
    const arenaPokeball = document.querySelector('.arena-pokeball');
    if (arenaPokeball) arenaPokeball.style.visibility = 'hidden';

    overlay.classList.remove('hidden');
    stage.innerHTML = '';
    effectsContainer.innerHTML = '';
    particlesContainer.innerHTML = '';

    const pokeball = createPokeballVFX();
    stage.appendChild(pokeball);
    requestAnimationFrame(() => pokeball.classList.add('pokeball-entry-anim'));

    // Flash ring at ~50% of pokeball anim
    setTimeout(() => {
      const ring = document.createElement('div');
      ring.className = 'pokeball-flash-ring';
      stage.appendChild(ring);
      ring.addEventListener('animationend', () => ring.remove());
    }, POKEBALL_ENTRY_DURATION * 0.5);

    // ── Phase 1 (after pokeball fades): Card reveal + type effects ───
    return new Promise(resolve => {
      setTimeout(() => {
        pokeball.remove();
        playTypeSound(card.type);

        const cardEl = makeMonEl(card, false, false, 0);
        cardEl.style.opacity = '0';
        cardEl.style.transition = 'none';
        stage.appendChild(cardEl);

        const typeColors = { fire: '#FF6B35', water: '#29B6F6', grass: '#66BB6A', electric: '#FFD600' };
        effectsContainer.style.color = typeColors[card.type] || '#FFD700';
        effectsContainer.className = `card-entry-effects ${card.type}`;
        effectsContainer.innerHTML = '';

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (card.type === 'fire') {
          const flameCount = Math.min(12, Math.floor(vw / 80));
          for (let i = 0; i < flameCount; i++) {
            const flame = document.createElement('div');
            flame.className = 'effect-element';
            const spreadWidth = vw * 0.8;
            const spacing = spreadWidth / (flameCount - 1);
            const offset = (i * spacing) - (spreadWidth / 2);
            flame.style.left = `calc(50% + ${offset}px)`;
            flame.style.animationDuration = `${1.8 + Math.random() * 0.6}s`;
            flame.style.animationDelay = `${Math.random() * 0.2}s`;
            flame.style.transform = `translate(-50%, 0) scale(${0.8 + Math.random() * 0.4})`;
            effectsContainer.appendChild(flame);
          }
        } else if (card.type === 'grass') {
          const leafCount = Math.min(60, Math.floor((vw * vh) / 6000));
          for (let i = 0; i < leafCount; i++) {
            const leaf = document.createElement('div');
            leaf.className = 'effect-element';
            const xOffset = (Math.random() - 0.5) * vw * 0.98;
            leaf.style.left = `calc(50% + ${xOffset}px)`;
            const yStart = -40 + Math.random() * 140;
            leaf.style.top = `${yStart}vh`;
            leaf.style.animationDuration = `${2.5 + Math.random() * 1.5}s`;
            leaf.style.animationDelay = `${Math.random() * 0.2}s`;
            const scale = 0.5 + Math.random() * 0.7;
            const rotation = Math.random() * 360;
            const drift = (Math.random() - 0.5) * 120;
            leaf.style.setProperty('--drift', `${drift}px`);
            leaf.style.transform = `translate(-50%, 0) scale(${scale}) rotate(${rotation}deg)`;
            effectsContainer.appendChild(leaf);
          }
        } else if (card.type === 'electric') {
          const boltCount = Math.min(8, Math.floor(vw / 100) + 2);
          for (let i = 0; i < boltCount; i++) {
            const bolt = document.createElement('div');
            bolt.className = 'effect-element';
            const spreadWidth = vw * 0.7;
            const spacing = spreadWidth / (boltCount - 1);
            const offset = (i * spacing) - (spreadWidth / 2);
            bolt.style.left = `calc(50% + ${offset}px)`;
            bolt.style.animationDelay = `${i * 0.15 + Math.random() * 0.1}s`;
            bolt.style.transform = `translateX(-50%) rotate(${(Math.random() - 0.5) * 8}deg)`;
            effectsContainer.appendChild(bolt);
          }
        } else if (card.type === 'water') {
          const waveCount = 6;
          for (let i = 0; i < waveCount; i++) {
            const wave = document.createElement('div');
            wave.className = 'effect-element';
            const verticalOffset = (i - waveCount / 2) * (vh * 0.08);
            wave.style.top = `calc(50% + ${verticalOffset}px)`;
            wave.style.animationDelay = `${i * 0.15}s`;
            wave.style.animationDuration = `${1.6 + Math.random() * 0.4}s`;
            wave.style.opacity = `${0.7 - i * 0.08}`;
            effectsContainer.appendChild(wave);
          }
        }

        const particleEmojis = {
          fire: ['🔥', '✨', '💫', '⭐', '🌟'],
          water: ['💧', '💦', '✨', '💫', '🌊'],
          grass: ['🌿', '🍃', '✨', '💫', '🌱'],
          electric: ['⚡', '✨', '💫', '⭐', '🌟']
        };
        const emojis = particleEmojis[card.type] || ['✨', '💫', '⭐'];

        particlesContainer.innerHTML = '';
        const baseDistance = Math.min(vw, vh) * 0.25;
        for (let i = 0; i < 20; i++) {
          const particle = document.createElement('div');
          particle.className = 'card-entry-particle';
          const angle = (i / 20) * Math.PI * 2;
          const distance = baseDistance + Math.random() * (baseDistance * 0.4);
          const tx = Math.cos(angle) * distance;
          const ty = Math.sin(angle) * distance;
          particle.style.setProperty('--tx', `${tx}px`);
          particle.style.setProperty('--ty', `${ty}px`);
          particle.style.animationDelay = `${i * 30}ms`;
          particle.textContent = emojis[i % emojis.length];
          particlesContainer.appendChild(particle);
        }

        requestAnimationFrame(() => { cardEl.style.opacity = '1'; });

        // ── Phase 2: Move card to final position ───
        setTimeout(() => {
          const cardRect = cardEl.getBoundingClientRect();
          const currentCenterX = cardRect.left + cardRect.width / 2;
          const currentCenterY = cardRect.top + cardRect.height / 2;

          const targetRect = targetContainer.getBoundingClientRect();
          const containerCenterX = targetRect.left + targetRect.width / 2;
          const containerCenterY = targetRect.top + targetRect.height / 2;

          const cardWidth = isHand ? 108 : 110;
          const gap = 10;
          const totalCards = targetContainer.querySelectorAll('.poke-mon, .poke-slot').length;
          const totalWidth = totalCards * cardWidth + (totalCards - 1) * gap;
          const startX = containerCenterX - totalWidth / 2;
          const finalCenterX = startX + targetIndex * (cardWidth + gap) + cardWidth / 2;
          const finalCenterY = containerCenterY;

          const deltaX = finalCenterX - currentCenterX;
          const deltaY = finalCenterY - currentCenterY;

          cardEl.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
          cardEl.style.left = `calc(50% + ${deltaX}px)`;
          cardEl.style.top = `calc(50% + ${deltaY}px)`;
          cardEl.style.transform = 'translate(-50%, -50%) scale(0.4)';

          setTimeout(() => {
            overlay.classList.add('hidden');
            stage.innerHTML = '';
            particlesContainer.innerHTML = '';

            // Restore arena pokeball visibility
            const arenaPB = document.querySelector('.arena-pokeball');
            if (arenaPB) arenaPB.style.visibility = '';

            const me = gameState?.players.find(p => p.id === myId);
            const totalCards2 = (me?.hand?.length || 0) + (gameState?.community?.length || 0);
            const shouldHighlight = totalCards2 >= 5;
            const bestKeys = shouldHighlight && me?.bestHand?.bestFive
              ? new Set(me.bestHand.bestFive.map(c => `${c.type}-${c.id}`))
              : new Set();
            const key = `${card.type}-${card.id}`;
            const inBest = bestKeys.has(key);

            const finalCard = makeMonEl(card, inBest, false, 0);
            finalCard.dataset.cardKey = key;

            if (targetContainer.children[targetIndex]) {
              targetContainer.replaceChild(finalCard, targetContainer.children[targetIndex]);
            } else {
              targetContainer.appendChild(finalCard);
            }

            resolve();
          }, 650);
        }, 1200);
      }, POKEBALL_ENTRY_DURATION);
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
    const bgm = document.getElementById('bgm');
    if (!bgm) return;

    // ↓↓ 两个场景的 BGM ↓↓
    const BGM_LOBBY  = '/audio/op.mp3';                    // 大厅/等待 BGM
    const BGM_BATTLE = '/audio/hgss-johto-trainer.mp3';   // 游戏中对战 BGM

    let currentBgmUrl = null;
    let userInteracted = false;
    let isSwitching = false;  // Prevent concurrent switches
    bgm.volume = 0.15;

    // Get all volume control elements (both lobby and game)
    const volSliders = [document.getElementById('vol-slider'), document.getElementById('vol-slider-lobby')].filter(Boolean);
    const volValues = [document.getElementById('vol-value'), document.getElementById('vol-value-lobby')].filter(Boolean);
    const volPanels = [document.getElementById('vol-panel'), document.getElementById('vol-panel-lobby')].filter(Boolean);
    const btnVols = [document.getElementById('btn-vol'), document.getElementById('btn-vol-lobby')].filter(Boolean);

    // Sync all sliders to initial volume
    volSliders.forEach(slider => {
      if (slider) slider.value = bgm.volume;
    });
    volValues.forEach(valueEl => {
      if (valueEl) valueEl.textContent = Math.round(bgm.volume * 100) + '%';
    });

    // Function to update all volume displays
    function updateAllVolumeDisplays(volume) {
      volSliders.forEach(slider => {
        if (slider) slider.value = volume;
      });
      volValues.forEach(valueEl => {
        if (valueEl) valueEl.textContent = Math.round(volume * 100) + '%';
      });
    }

    // Toggle volume panels
    btnVols.forEach((btnVol, index) => {
      const panel = volPanels[index];
      if (btnVol && panel) {
        btnVol.addEventListener('click', () => {
          panel.classList.toggle('hidden');
        });
      }
    });

    // Volume sliders - sync all sliders
    volSliders.forEach(slider => {
      if (slider) {
        slider.addEventListener('input', () => {
          const v = parseFloat(slider.value);
          bgm.volume = v;
          updateAllVolumeDisplays(v);
          if (v > 0 && bgm.paused && bgm.src) bgm.play().catch(() => {});
          else if (v === 0) bgm.pause();
        });
      }
    });

    // Switch BGM track (crossfade-ish: fade out → swap → fade in)
    window.switchBgm = function(url) {
      // If already switching to this URL or it's the current URL, skip
      if (currentBgmUrl === url && !bgm.paused) {
        return;
      }
      
      // Update target URL immediately
      currentBgmUrl = url;
      
      if (!userInteracted) {
        // Store the desired BGM URL, will be played on first interaction
        return;
      }
      
      // If already switching, cancel and start new switch immediately
      if (isSwitching) {
        isSwitching = false;
      }
      
      // Get current volume from any available slider
      const currentSlider = volSliders.find(s => s) || { value: 0.15 };
      const targetVol = parseFloat(currentSlider.value);
      
      // If volume is 0 (muted), just switch the source without playing
      if (targetVol === 0) {
        bgm.pause();
        bgm.src = url;
        bgm.volume = 0;
        currentBgmUrl = url;
        return;
      }
      
      // If BGM is not playing (failed to start or paused), try direct switch
      if (bgm.paused || !bgm.src) {
        bgm.src = url;
        bgm.volume = targetVol;
        bgm.play().catch(err => {});
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
            bgm.volume = targetVol; // Restore volume for next attempt
            isSwitching = false;
          }).then(() => {
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
      userInteracted = true;
      const url = currentBgmUrl || BGM_LOBBY;
      currentBgmUrl = url;
      bgm.src = url;
      const currentSlider = volSliders.find(s => s) || { value: 0.15 };
      bgm.volume = parseFloat(currentSlider.value);
      bgm.play().catch(err => {});
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

  // ─── Leaderboard overlay ──────────────────────────────────────────────────────
  (function initLeaderboard() {
    const overlay = document.getElementById('leaderboard-overlay');
    const btnLeaderboard = document.getElementById('btn-leaderboard');
    const btnLeaderboardLobby = document.getElementById('btn-leaderboard-lobby');
    const btnClose = document.getElementById('leaderboard-close');
    const content = document.getElementById('leaderboard-content');
    if (!overlay) return;

    function openLeaderboard() {
      overlay.classList.remove('hidden');
      const loadingText = lang === 'zh' ? '加载中...' : 'Loading...';
      content.innerHTML = `<div class="leaderboard-loading">${loadingText}</div>`;
      
      // Update title and subtitle based on language
      const title = overlay.querySelector('.leaderboard-title');
      const subtitle = overlay.querySelector('.leaderboard-subtitle');
      if (title) title.textContent = lang === 'zh' ? '🏆 训练家殿堂' : '🏆 Hall of Fame';
      if (subtitle) subtitle.textContent = lang === 'zh' ? '传奇训练家荣誉榜' : 'Legendary Trainers Honor Roll';
      
      socket.emit('get_leaderboard');
    }

    function renderLeaderboard(data) {
      const noDataText = lang === 'zh' ? '暂无排行数据' : 'No leaderboard data';
      if (!data || data.length === 0) {
        content.innerHTML = `<div class="leaderboard-loading">${noDataText}</div>`;
        return;
      }

      const headers = lang === 'zh' 
        ? { rank: '排名', name: '训练家', score: '总分', games: '场次' }
        : { rank: 'Rank', name: 'Trainer', score: 'Score', games: 'Games' };

      const rows = data.map((entry, idx) => {
        const rank = idx + 1;
        const rankClass = rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : '';
        const scoreClass = entry.totalScore >= 0 ? 'positive' : 'negative';
        const scoreSign = entry.totalScore >= 0 ? '+' : '';
        
        return `
          <tr>
            <td class="leaderboard-rank ${rankClass}">${rank}</td>
            <td class="leaderboard-name">${escHtml(entry.name)}</td>
            <td class="leaderboard-score ${scoreClass}">${scoreSign}${entry.totalScore}</td>
            <td class="leaderboard-games">${entry.gamesPlayed}</td>
          </tr>
        `;
      }).join('');

      content.innerHTML = `
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>${headers.rank}</th>
              <th>${headers.name}</th>
              <th>${headers.score}</th>
              <th>${headers.games}</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }

    if (btnLeaderboard) btnLeaderboard.addEventListener('click', openLeaderboard);
    if (btnLeaderboardLobby) btnLeaderboardLobby.addEventListener('click', openLeaderboard);
    if (btnClose) btnClose.addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });

    // Expose renderLeaderboard globally for socket handler
    window.renderLeaderboardData = renderLeaderboard;
  })();

  // ─── VFX System ──────────────────────────────────────────────────────────────

  // Creates a standalone pokeball DOM element for VFX animations
  function createPokeballVFX() {
    const pb = document.createElement('div');
    pb.className = 'pokeball-vfx';
    pb.innerHTML = '<div class="pokeball-vfx-top"></div><div class="pokeball-vfx-bottom"></div><div class="pokeball-vfx-mid"></div><div class="pokeball-vfx-btn"></div>';
    return pb;
  }

  let vfxShakeDebounce = false;
  let previousChips = {};   // track per-player chips for chip animations
  let winStreaks = {};       // track per-player win streaks

  // 2. Screen Shake & Flash
  function triggerScreenShake() {
    if (vfxShakeDebounce) return;
    vfxShakeDebounce = true;
    const gameScreen = $('game-screen');
    if (gameScreen) {
      gameScreen.classList.add('screen-shaking');
      gameScreen.addEventListener('animationend', () => {
        gameScreen.classList.remove('screen-shaking');
      }, { once: true });
    }
    setTimeout(() => { vfxShakeDebounce = false; }, 800);
  }

  function triggerScreenFlash() {
    const flashEl = $('screen-flash');
    if (!flashEl) return;
    flashEl.classList.remove('hidden');
    // Force reflow to restart animation
    flashEl.style.animation = 'none';
    flashEl.offsetHeight;
    flashEl.style.animation = '';
    flashEl.addEventListener('animationend', () => {
      flashEl.classList.add('hidden');
    }, { once: true });
  }

  // 3. Type Skill Effects (full-screen attribute effects)
  function playSkillEffect(type) {
    const overlay = $('skill-effect-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';

    if (type === 'fire') {
      // Fire Vortex: flames spiraling upward
      for (let i = 0; i < 15; i++) {
        const p = document.createElement('div');
        p.className = 'skill-fire-particle';
        p.style.left = (10 + Math.random() * 80) + '%';
        p.style.animationDelay = (Math.random() * 0.5) + 's';
        p.style.animationDuration = (1.5 + Math.random() * 0.8) + 's';
        overlay.appendChild(p);
        p.addEventListener('animationend', () => p.remove());
      }
    } else if (type === 'water') {
      // Water Cannon: streams from both sides + splash
      for (let i = 0; i < 3; i++) {
        const left = document.createElement('div');
        left.className = 'skill-water-particle from-left';
        left.style.marginTop = ((i - 1) * 40) + 'px';
        left.style.animationDelay = (i * 0.15) + 's';
        overlay.appendChild(left);
        left.addEventListener('animationend', () => left.remove());

        const right = document.createElement('div');
        right.className = 'skill-water-particle from-right';
        right.style.marginTop = ((i - 1) * 40) + 'px';
        right.style.animationDelay = (i * 0.15) + 's';
        overlay.appendChild(right);
        right.addEventListener('animationend', () => right.remove());
      }
      // Splash at center
      const splash = document.createElement('div');
      splash.className = 'skill-water-splash';
      overlay.appendChild(splash);
      splash.addEventListener('animationend', () => splash.remove());
    } else if (type === 'grass') {
      // Leaf Storm: leaves converging to center then exploding out
      for (let i = 0; i < 20; i++) {
        const leaf = document.createElement('div');
        leaf.className = 'skill-grass-particle';
        const angle = (i / 20) * Math.PI * 2;
        const dist = 300 + Math.random() * 200;
        leaf.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
        leaf.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
        leaf.style.animationDelay = (Math.random() * 0.3) + 's';
        overlay.appendChild(leaf);
        leaf.addEventListener('animationend', () => leaf.remove());
      }
    } else if (type === 'electric') {
      // Thunderbolt: lightning bolts + energy ball
      for (let i = 0; i < 5; i++) {
        const bolt = document.createElement('div');
        bolt.className = 'skill-electric-bolt';
        bolt.style.left = (15 + i * 17) + '%';
        bolt.style.animationDelay = (i * 0.15) + 's';
        overlay.appendChild(bolt);
        bolt.addEventListener('animationend', () => bolt.remove());
      }
      const ball = document.createElement('div');
      ball.className = 'skill-electric-ball';
      overlay.appendChild(ball);
      ball.addEventListener('animationend', () => ball.remove());
    }
  }

  // 4. Phase Transition Effects
  let previousPhaseForTransition = null;
  function triggerPhaseTransition(newPhase) {
    if (!previousPhaseForTransition || previousPhaseForTransition === newPhase) {
      previousPhaseForTransition = newPhase;
      return;
    }
    previousPhaseForTransition = newPhase;

    // Only animate for game phases (not waiting)
    if (newPhase === 'waiting' || newPhase === 'preflop') return;

    // Pokeball spin animation
    const pokeball = document.querySelector('.arena-pokeball');
    if (pokeball) {
      const cls = (newPhase === 'river' || newPhase === 'showdown')
        ? 'pokeball-transitioning-strong' : 'pokeball-transitioning';
      pokeball.classList.add(cls);
      pokeball.addEventListener('animationend', () => pokeball.classList.remove(cls), { once: true });
    }

    // Expanding ring from pokeball center
    const arenaCenter = document.querySelector('.arena-center');
    if (arenaCenter) {
      const ring = document.createElement('div');
      ring.className = 'phase-ring';
      arenaCenter.appendChild(ring);
      ring.addEventListener('animationend', () => ring.remove());

      // Energy lines
      for (let i = 0; i < 4; i++) {
        const line = document.createElement('div');
        line.className = 'phase-energy-line';
        line.style.width = (100 + Math.random() * 100) + 'px';
        line.style.top = (30 + Math.random() * 40) + '%';
        line.style.left = (Math.random() * 80) + '%';
        line.style.animationDelay = (i * 0.1) + 's';
        arenaCenter.appendChild(line);
        line.addEventListener('animationend', () => line.remove());
      }
    }

    // Phase banner bounce
    const phaseBanner = $('phase-banner');
    if (phaseBanner) {
      phaseBanner.classList.add('phase-banner-animating');
      setTimeout(() => phaseBanner.classList.remove('phase-banner-animating'), 600);
    }

    // Phase flash
    const flashEl = $('phase-flash');
    if (flashEl) {
      flashEl.classList.remove('hidden');
      flashEl.style.animation = 'none';
      flashEl.offsetHeight;
      flashEl.style.animation = '';
      flashEl.addEventListener('animationend', () => flashEl.classList.add('hidden'), { once: true });
    }
  }

  // 5. Chip Animations
  function animateChipWin(targetEl, count) {
    const layer = $('chip-anim-layer');
    if (!layer || !targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const coins = Math.min(count, 12);
    for (let i = 0; i < coins; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin-particle';
      coin.textContent = '🪙';
      const fromX = (Math.random() - 0.5) * window.innerWidth * 0.6;
      const fromY = -100 - Math.random() * 200;
      const toX = rect.left + rect.width / 2;
      const toY = rect.top + rect.height / 2;
      coin.style.setProperty('--from-x', fromX + 'px');
      coin.style.setProperty('--from-y', fromY + 'px');
      coin.style.setProperty('--to-x', toX + 'px');
      coin.style.setProperty('--to-y', toY + 'px');
      coin.style.setProperty('--duration', (0.6 + Math.random() * 0.4) + 's');
      coin.style.animationDelay = (i * 0.08) + 's';
      layer.appendChild(coin);
      coin.addEventListener('animationend', () => coin.remove());
    }
  }

  function animateChipLoss(sourceEl, amount) {
    const layer = $('chip-anim-layer');
    if (!layer || !sourceEl) return;
    const rect = sourceEl.getBoundingClientRect();
    const shards = Math.min(Math.ceil(amount / 50), 10);
    const colors = ['#ffd700', '#ffb300', '#ff8f00', '#c6a300', '#e6be00'];
    for (let i = 0; i < shards; i++) {
      const shard = document.createElement('div');
      shard.className = 'chip-shard';
      shard.style.left = (rect.left + rect.width / 2) + 'px';
      shard.style.top = (rect.top + rect.height / 2) + 'px';
      shard.style.background = colors[i % colors.length];
      const angle = (i / shards) * Math.PI * 2;
      const dist = 60 + Math.random() * 80;
      shard.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
      shard.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
      shard.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      shard.style.animationDelay = (i * 0.04) + 's';
      layer.appendChild(shard);
      shard.addEventListener('animationend', () => shard.remove());
    }
  }

  function animateChipBet(sourceEl) {
    const layer = $('chip-anim-layer');
    const potEl = $('pot-display');
    if (!layer || !sourceEl || !potEl) return;
    const srcRect = sourceEl.getBoundingClientRect();
    const potRect = potEl.getBoundingClientRect();
    const tx = (potRect.left + potRect.width / 2) - (srcRect.left + srcRect.width / 2);
    const ty = (potRect.top + potRect.height / 2) - (srcRect.top + srcRect.height / 2);
    for (let i = 0; i < 3; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin-to-pot';
      coin.textContent = '🪙';
      coin.style.left = (srcRect.left + srcRect.width / 2) + 'px';
      coin.style.top = (srcRect.top + srcRect.height / 2) + 'px';
      coin.style.setProperty('--tx', (tx + (Math.random() - 0.5) * 20) + 'px');
      coin.style.setProperty('--ty', (ty + (Math.random() - 0.5) * 20) + 'px');
      coin.style.animationDelay = (i * 0.1) + 's';
      layer.appendChild(coin);
      coin.addEventListener('animationend', () => coin.remove());
    }
  }

  // Track chip changes and trigger animations
  function trackChipChanges(state) {
    if (!state || !state.players) return;
    state.players.forEach((p, idx) => {
      const prev = previousChips[p.id];
      if (prev !== undefined && prev !== p.chips) {
        const diff = p.chips - prev;
        // Find the DOM element for this player
        let targetEl = null;
        if (p.id === myId) {
          targetEl = $('my-chips');
        } else {
          const oppSlots = document.querySelectorAll('.opponent-slot');
          // Match by index in the players array
          oppSlots.forEach(slot => {
            const nameEl = slot.querySelector('.opp-name');
            if (nameEl && nameEl.textContent.includes(p.name)) {
              targetEl = slot;
            }
          });
        }
        if (targetEl) {
          if (diff > 0) {
            animateChipWin(targetEl, Math.ceil(diff / 20));
          } else if (diff < 0 && state.phase === 'showdown') {
            animateChipLoss(targetEl, Math.abs(diff));
          }
        }
      }
      previousChips[p.id] = p.chips;
    });
  }

  // 6. Streak & Rare Hand Highlights
  function applyStreakHighlight(state, me) {
    if (!me || !state) return;
    const myArea = document.querySelector('.my-area');
    if (!myArea) return;

    // Remove existing streak classes
    myArea.classList.remove('streak-bronze', 'streak-silver', 'streak-gold');

    const streak = winStreaks[me.id] || 0;
    if (streak >= 5) {
      myArea.classList.add('streak-gold');
    } else if (streak >= 3) {
      myArea.classList.add('streak-silver');
    } else if (streak >= 2) {
      myArea.classList.add('streak-bronze');
    }
  }

  function applyRareHandHighlight(state, me) {
    if (!me || !me.bestHand) return;
    const rank = me.bestHand.rank;
    const myCards = $('my-cards');
    if (!myCards) return;

    // Remove existing rare highlights
    myCards.classList.remove('rare-highlight-legendary', 'rare-highlight-elite', 'rare-highlight-squad');
    myCards.querySelectorAll('.rare-glow-sprite').forEach(el => el.classList.remove('rare-glow-sprite'));

    // rank 9 = Legendary Lineup (best hand), rank 8 = Elite Four, rank 7 = Evolution Chain
    if (rank >= 9) {
      myCards.classList.add('rare-highlight-legendary');
      myCards.querySelectorAll('.poke-sprite').forEach(el => el.classList.add('rare-glow-sprite'));
    } else if (rank >= 7) {
      myCards.classList.add('rare-highlight-elite');
    } else if (rank >= 5) {
      myCards.classList.add('rare-highlight-squad');
    }
  }

  // 7. Active Turn Glow
  function applyTurnGlow(state, me) {
    // Remove existing turn glow
    document.querySelectorAll('.active-turn-glow').forEach(el => el.classList.remove('active-turn-glow'));
    document.querySelectorAll('.action-urgent').forEach(el => el.classList.remove('action-urgent'));

    if (!state || !me || state.phase === 'waiting' || state.phase === 'showdown') return;

    const isMyTurn = state.players[state.turnIndex]?.id === myId;

    if (isMyTurn) {
      // Add glow to my hand cards
      const myCards = $('my-cards');
      if (myCards) {
        myCards.querySelectorAll('.poke-mon').forEach(el => el.classList.add('active-turn-glow'));
      }

      // Add urgency pulse to action panel
      const actionPanel = $('action-panel');
      if (actionPanel && !actionPanel.classList.contains('hidden')) {
        actionPanel.classList.add('action-urgent');
      }
    }
  }

  // 8. Showdown VFX: Winner light pillar + particles
  function addWinnerLightPillar(containerEl) {
    if (!containerEl) return;
    containerEl.style.position = 'relative';
    containerEl.style.overflow = 'visible';

    const pillar = document.createElement('div');
    pillar.className = 'winner-light-pillar';
    containerEl.appendChild(pillar);

    // Pillar particles
    const particles = ['✨', '⭐', '💫', '🌟', '★'];
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('div');
      p.className = 'pillar-particle';
      p.textContent = particles[i % particles.length];
      p.style.left = (20 + Math.random() * 60) + '%';
      p.style.bottom = (Math.random() * 60) + '%';
      const tx = (Math.random() - 0.5) * 100 + 'px';
      const ty = -(50 + Math.random() * 100) + 'px';
      p.style.setProperty('--tx', tx);
      p.style.setProperty('--ty', ty);
      p.style.animationDelay = (0.5 + i * 0.2) + 's';
      containerEl.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    }
  }

  // 8. Tournament collision shockwave
  function addCollisionShockwave(containerEl) {
    if (!containerEl) return;
    // Shockwave rings
    for (let i = 0; i < 3; i++) {
      const wave = document.createElement('div');
      wave.className = 'collision-wave';
      wave.style.animationDelay = (i * 0.2) + 's';
      containerEl.appendChild(wave);
      wave.addEventListener('animationend', () => wave.remove());
    }
    // Rays
    for (let i = 0; i < 8; i++) {
      const ray = document.createElement('div');
      ray.className = 'collision-ray';
      ray.style.setProperty('--angle', (i * 45) + 'deg');
      ray.style.animationDelay = '0.1s';
      containerEl.appendChild(ray);
      ray.addEventListener('animationend', () => ray.remove());
    }
  }

  // 8. Champion enhancements
  function enhanceChampionOverlay(champBox) {
    if (!champBox) return;
    champBox.style.position = 'relative';
    champBox.style.overflow = 'visible';

    // Add rotating halos
    const halo = document.createElement('div');
    halo.className = 'champion-halo';
    champBox.appendChild(halo);

    const haloInner = document.createElement('div');
    haloInner.className = 'champion-halo-inner';
    champBox.appendChild(haloInner);

    // Golden bubbles rising from bottom
    for (let i = 0; i < 15; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'golden-bubble';
      bubble.style.left = (Math.random() * 100) + '%';
      bubble.style.setProperty('--duration', (3 + Math.random() * 4) + 's');
      bubble.style.animationDelay = (Math.random() * 3) + 's';
      bubble.style.width = (4 + Math.random() * 8) + 'px';
      bubble.style.height = bubble.style.width;
      champBox.appendChild(bubble);
    }

    // Apply gradient flow to title
    const champTitle = $('champ-title');
    if (champTitle) champTitle.classList.add('gradient-flow-text');
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────────
  applyI18n();
  initSocket();
})();
