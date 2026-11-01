(function () {
  // TOP-DOWN PIXEL ROGUELIKE — V5.2 (SPIDER QUEEN, BOSS HEALS, BREATHER UPGRADE)
  // Paste the entire script into the DevTools Console on about:blank. The main menu appears first; press PLAY to start the run.
  // Includes the full previous prototype plus both boss encounters and their phase abilities.
  // START_TIME_SECONDS is replaced per build: 0, 295 (4:55), 595 (9:55), or 835 (13:55 spider test).

  if (window.__topdownRoguelike && window.__topdownRoguelike.destroy) {
    window.__topdownRoguelike.destroy();
  }

  const START_TIME_SECONDS = 0; // 0 = normal; 295 = rat test; 595 = goblin test; 835 = spider queen test.
  const COIN_STORAGE_KEY = 'pixelRoguelikeCoins_v1';
  function loadCoinBalance() {
    try {
      const saved = Number(window.localStorage.getItem(COIN_STORAGE_KEY));
      return Number.isFinite(saved) && saved >= 0 ? Math.floor(saved) : 0;
    } catch (_) { return 0; }
  }
  let coinBalance = loadCoinBalance();
  function saveCoinBalance() {
    try { window.localStorage.setItem(COIN_STORAGE_KEY, String(coinBalance)); } catch (_) { /* storage may be unavailable; balance remains for this page session */ }
  }
  const TILE = 32;
  const MAP_SIZE = 200;
  const MAX_LIVE_ENEMIES = 70; // Browser-safety cap; spawn timers continue normally while the cap is reached.
  const BOSS_ARENA = { x: 80, y: 80, size: 40 };
  const MAX_AMMO = 10;
  const RELOAD_SECONDS = 2.5;
  const PLAYER_SPEED = 4.0;       // Provisional value; not yet approved.
  const BULLET_SPEED = 18.0;      // Provisional value; not yet approved.
  const BULLET_DAMAGE = 10;
  const ARROW_SPEED_FACTOR = 0.95;

  // Seven playable characters. Active class skills use E / the mobile skill button;
  // Q remains reserved for the existing legendary Impulse upgrade.
  const CHARACTER_STORAGE_KEY = 'pixelRoguelikeCharacters_v1';
  const CHARACTER_DEFINITIONS = {
    shooter: {
      id: 'shooter', name: 'Стрелок', weapon: 'Ружьё', hp: 100, price: 0,
      speedMultiplier: 1.0, damage: 10, magazine: 10, range: 15,
      pellets: 1, spread: 0, role: 'Универсальный боец', abilityDescription: 'Без дополнительной способности.'
    },
    hunter: {
      id: 'hunter', name: 'Охотник', weapon: 'Дробовик', hp: 120, price: 100,
      speedMultiplier: 1.10, damage: 5, magazine: 6, range: 5,
      pellets: 5, spread: 0.20, role: 'Ближний бой', abilityDescription: 'Пять дробин веером за один патрон.'
    },
    alchemist: {
      id: 'alchemist', name: 'Алхимик', weapon: 'Алхимические колбы', hp: 100, price: 200,
      speedMultiplier: 1.0, damage: 10, magazine: 8, range: 10,
      pellets: 1, spread: 0, projectileType: 'flask', activeAbility: 'poisonCloud', abilityName: 'Ядовитое облако', abilityCooldown: 25,
      role: 'Яд и контроль территории', abilityDescription: 'Колба наносит 10 HP по площади и оставляет ядовитую лужу на 1 сек. (2 HP каждому врагу). Навык создаёт облако на 4 сек. Перезарядка: 25 сек.'
    },
    medic: {
      id: 'medic', name: 'Медик', weapon: 'Медицинский пистолет', hp: 120, price: 250,
      speedMultiplier: 1.0, damage: 8, magazine: 12, range: 12,
      pellets: 1, spread: 0, projectileType: 'medic', activeAbility: 'heal', abilityName: 'Лечение', abilityCooldown: 45,
      role: 'Выживание', abilityDescription: 'Стреляет красными лечебными маркерами. Восстанавливает 20 HP. Перезарядка: 45 сек.'
    },
    engineer: {
      id: 'engineer', name: 'Инженер', weapon: 'Сервисный пистолет', hp: 100, price: 300,
      speedMultiplier: 0.95, damage: 8, magazine: 18, range: 11,
      pellets: 1, spread: 0, projectileType: 'bullet', activeAbility: 'turret', abilityName: 'Турель', abilityCooldown: 30,
      role: 'Автоматическая поддержка', abilityDescription: 'Ставит турель на 8 сек.: 5 урона каждые 0,3 сек. Перезарядка: 30 сек. Собственный выстрел: 8 HP.'
    },
    scout: {
      id: 'scout', name: 'Разведчик', weapon: 'Лёгкий карабин', hp: 85, price: 150,
      speedMultiplier: 1.50, damage: 6, magazine: 24, range: 10,
      pellets: 1, spread: 0, activeAbility: 'dash', abilityName: 'Рывок', abilityCooldown: 15,
      role: 'Мобильность', abilityDescription: 'С начала каждого забега получает 2 случайных улучшения. Рывок на 4,5 блока наносит 15 HP врагам на пути. Перезарядка: 15 сек.'
    },
    electrician: {
      id: 'electrician', name: 'Электрик', weapon: 'Молниемёт', hp: 95, price: 400,
      speedMultiplier: 1.0, damage: 12, magazine: 12, range: 13,
      pellets: 1, spread: 0, projectileType: 'lightning', electricChain: true,
      activeAbility: 'electricRings', abilityName: 'Энергетические кольца', abilityCooldown: 18,
      role: 'Цепная атака', abilityDescription: 'Активная способность: выпускает вокруг себя 3 расширяющихся кольца энергии радиусом до 8 блоков. Каждое кольцо наносит 20 HP врагам при касании. Перезарядка: 18 сек. Обычные выстрелы наносят 12 HP и могут перескакивать на второго врага.'
    }
  };
  function loadCharacterProfile() {
    try {
      const data = JSON.parse(window.localStorage.getItem(CHARACTER_STORAGE_KEY) || '{}');
      let unlocked = Array.isArray(data.unlockedCharacters)
        ? data.unlockedCharacters.filter(id => Object.prototype.hasOwnProperty.call(CHARACTER_DEFINITIONS, id))
        : ['shooter', ...(data.hunterUnlocked === true ? ['hunter'] : [])];
      if (!unlocked.includes('shooter')) unlocked.unshift('shooter');
      const selected = CHARACTER_DEFINITIONS[data.selected] && unlocked.includes(data.selected) ? data.selected : 'shooter';
      return { unlockedCharacters: [...new Set(unlocked)], selected };
    } catch (_) { return { unlockedCharacters: ['shooter'], selected: 'shooter' }; }
  }
  const savedCharacterProfile = loadCharacterProfile();
  const unlockedCharacterIds = new Set(savedCharacterProfile.unlockedCharacters);
  let hunterUnlocked = unlockedCharacterIds.has('hunter');
  let selectedCharacterId = savedCharacterProfile.selected;
  let characterUiMessage = '';
  function saveCharacterProfile() {
    hunterUnlocked = unlockedCharacterIds.has('hunter');
    try {
      window.localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify({
        unlockedCharacters: [...unlockedCharacterIds],
        hunterUnlocked, // Kept for compatibility with the previous v4.5 save format.
        selected: selectedCharacterId
      }));
    } catch (_) { /* Character unlock remains available for this page session. */ }
  }
  // Provisional base radius: will be increased by the Magnet upgrade later.
  const BASE_XP_PICKUP_RADIUS = 2.5;
  const HIT_INVULNERABILITY_SECONDS = 0.4;
  // Temporary test value: the duration of the Light Boots damage-speed burst
  // has not yet been specified. It can be changed after playtesting.
  const LIGHT_BOOTS_BURST_SECONDS = 1.5;
  // Goblin tuning requested: all attacks are faster and hit harder.
  // Phase 1 cooldowns are 20% shorter (1.25x attack rate); phase 2 is another 40% faster than phase 1.
  const GOBLIN_PHASE1_COOLDOWN_FACTOR = 0.8;
  const GOBLIN_PHASE2_RATE_FACTOR = 1.4;
  const GOBLIN_DAMAGE_FACTOR = 1.3;
  const goblinDamage = value => Math.ceil(value * GOBLIN_DAMAGE_FACTOR);
  const goblinCooldown = (baseSeconds, phase) => baseSeconds * GOBLIN_PHASE1_COOLDOWN_FACTOR / (phase === 2 ? GOBLIN_PHASE2_RATE_FACTOR : 1);

  const style = document.createElement('style');
  style.textContent = `
    html, body {
      margin: 0 !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      background: #101114 !important;
    }
    #rogue-phase2-canvas {
      display: block;
      width: 100vw;
      height: 100vh;
      cursor: crosshair;
      image-rendering: pixelated;
      outline: none;
      user-select: none;
    }
  `;
  style.textContent += `
    #rogue-ui-overlay {
      position: fixed; inset: 0; z-index: 2147483000; display: none;
      align-items: center; justify-content: center; padding: 18px; box-sizing: border-box;
      color: #eee7f6; background: radial-gradient(ellipse at 50% 35%, rgba(65,42,75,.90), rgba(8,8,13,.97) 72%);
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    #rogue-ui-overlay * { box-sizing: border-box; }
    .rl-ui-panel {
      width: min(880px, 96vw); max-height: 94vh; overflow: auto; padding: 26px;
      background: rgba(20,18,27,.98); border: 2px solid #756184; border-radius: 12px;
      box-shadow: 0 18px 65px rgba(0,0,0,.65), inset 0 0 0 1px rgba(210,180,245,.08);
    }
    .rl-ui-title { margin: 0 0 8px; text-align: center; font-size: clamp(24px,4vw,38px); letter-spacing: 2px; color: #e6d2ff; }
    .rl-ui-subtitle { margin: 0 0 22px; text-align: center; color: #b9afc5; font-size: 13px; line-height: 1.55; }
    .rl-ui-menu-buttons { display: grid; gap: 12px; width: min(420px,100%); margin: 22px auto 8px; }
    .rl-ui-btn {
      appearance: none; border: 1px solid #9274ad; border-radius: 7px; padding: 14px 18px;
      background: linear-gradient(180deg,#443253,#2b2036); color: #f6edff; cursor: pointer;
      font: bold 15px ui-monospace,monospace; letter-spacing: 1px; transition: filter .12s, transform .12s;
    }
    .rl-ui-btn:hover:not(:disabled) { filter: brightness(1.25); transform: translateY(-1px); }
    .rl-ui-btn:active:not(:disabled) { transform: translateY(1px); }
    .rl-ui-btn:disabled { cursor: not-allowed; opacity: .42; filter: grayscale(.6); }
    .rl-ui-btn.primary { background: linear-gradient(180deg,#76529a,#4d3269); border-color: #c39be6; }
    .rl-ui-btn.muted { background: linear-gradient(180deg,#303039,#202027); border-color: #5b5865; }
    .rl-ui-note { text-align:center; color:#958a9f; font-size:11px; margin-top:14px; line-height:1.5; }
    .rl-coin-wallet { display:flex; align-items:center; justify-content:center; gap:11px; width:max-content; min-width:154px; margin:14px auto 17px; padding:8px 17px; border:1px solid #a77a2d; border-radius:8px; background:linear-gradient(180deg,rgba(77,55,25,.94),rgba(39,30,21,.96)); box-shadow:0 0 18px rgba(227,166,55,.12), inset 0 0 0 1px rgba(255,220,130,.08); }
    .rl-coin-wallet svg { width:29px; height:29px; flex:none; image-rendering:pixelated; shape-rendering:crispEdges; filter:drop-shadow(0 2px 2px rgba(0,0,0,.5)); }
    .rl-coin-wallet-copy { display:flex; flex-direction:column; align-items:flex-start; gap:1px; }
    .rl-coin-wallet-copy small { color:#d8bd82; font-size:9px; letter-spacing:1.5px; }
    .rl-coin-wallet-copy strong { color:#ffe2a0; font-size:19px; line-height:1.1; font-variant-numeric:tabular-nums; }
    .rl-coin-toast { position:fixed; z-index:2147482500; top:calc(16px + env(safe-area-inset-top)); left:50%; transform:translateX(-50%); padding:9px 15px; border:1px solid rgba(240,195,91,.8); border-radius:7px; color:#ffe5a8; background:rgba(35,26,15,.93); font:bold 13px ui-monospace,monospace; box-shadow:0 5px 18px rgba(0,0,0,.4); pointer-events:none; white-space:nowrap; }
    .rl-ui-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:9px; margin:15px 0 22px; }
    .rl-ui-stat { background:#24202d; border:1px solid #51445e; border-radius:6px; padding:10px; }
    .rl-ui-stat span { display:block; color:#a99bb7; font-size:10px; margin-bottom:5px; }
    .rl-ui-stat strong { color:#f0e5ff; font-size:16px; }
    .rl-ui-section-title { margin:18px 0 10px; color:#d6b8f5; font-size:15px; }
    .rl-ui-upgrades { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:9px; }
    .rl-ui-upgrade { background:#211e29; border:1px solid #494052; border-left:4px solid var(--rarity); border-radius:6px; padding:10px 12px; }
    .rl-ui-upgrade strong { display:block; font-size:12px; color:#f0e7f7; margin-bottom:6px; }
    .rl-ui-upgrade small { display:block; color:#b5a9c1; font-size:10px; line-height:1.5; }
    .rl-ui-footer { display:flex; justify-content:center; gap:10px; margin-top:22px; flex-wrap:wrap; }
    @media (max-width:520px) { .rl-ui-panel { padding:16px; } .rl-ui-btn { padding:12px; } }
    html, body { overscroll-behavior: none; }
    #rogue-phase2-canvas { touch-action: none; }
    .rl-control-mode { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .rl-control-mode .rl-ui-btn { padding:12px 8px; font-size:13px; }
    .rl-control-mode .selected { background:linear-gradient(180deg,#8060a4,#50356d); border-color:#e0c0ff; box-shadow:0 0 0 2px rgba(190,145,235,.22); }
    .rl-settings-block { margin:18px 0 22px; }
    .rl-settings-label { color:#d6b8f5; font-size:14px; font-weight:bold; margin:0 0 10px; text-align:center; letter-spacing:1px; }
    .rl-settings-hint { color:#a89daf; font-size:11px; text-align:center; margin:9px 0 0; }
    .rl-settings-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }
    .rl-settings-options.two { grid-template-columns:repeat(2,minmax(0,1fr)); }
    @media (max-width:520px) { .rl-settings-options { grid-template-columns:1fr; } .rl-settings-options.two { grid-template-columns:1fr 1fr; } }
    #rl-touch-controls { position:fixed; inset:0; z-index:2147482000; display:none; pointer-events:none; touch-action:none; user-select:none; -webkit-user-select:none; }
    .rl-touch-actions { position:absolute; top:calc(12px + env(safe-area-inset-top)); right:calc(12px + env(safe-area-inset-right)); display:flex; gap:8px; pointer-events:auto; }
    .rl-touch-actions button { min-width:42px; height:42px; border:1px solid rgba(219,190,245,.75); border-radius:9px; background:rgba(35,27,45,.88); color:#f2e7ff; font:bold 18px ui-monospace,monospace; box-shadow:0 2px 10px rgba(0,0,0,.35); touch-action:none; }
    .rl-touch-actions button:active { background:rgba(115,79,149,.95); }
    .rl-stick { position:absolute; bottom:calc(22px + env(safe-area-inset-bottom)); width:132px; height:132px; border-radius:50%; pointer-events:auto; touch-action:none; display:flex; align-items:center; justify-content:center; background:rgba(18,16,25,.20); }
    .rl-stick.left { left:calc(18px + env(safe-area-inset-left)); }
    .rl-stick.right { right:calc(18px + env(safe-area-inset-right)); }
    .rl-stick-base { position:absolute; width:112px; height:112px; border-radius:50%; border:2px solid rgba(218,190,245,.62); background:radial-gradient(circle,rgba(105,76,133,.35),rgba(34,27,43,.42)); box-shadow:inset 0 0 18px rgba(0,0,0,.35),0 3px 18px rgba(0,0,0,.25); }
    .rl-stick-knob { position:absolute; width:48px; height:48px; left:50%; top:50%; margin:-24px 0 0 -24px; border-radius:50%; border:2px solid rgba(238,220,255,.9); background:rgba(140,105,177,.82); box-shadow:0 2px 12px rgba(0,0,0,.4); transform:translate(0,0); }
    .rl-stick-label { position:absolute; bottom:-18px; left:0; right:0; text-align:center; color:#eee1fa; font:10px ui-monospace,monospace; letter-spacing:1px; text-shadow:0 1px 4px #000; white-space:nowrap; }
    @media (max-width:420px) { .rl-stick { width:112px; height:112px; bottom:calc(18px + env(safe-area-inset-bottom)); } .rl-stick-base { width:96px; height:96px; } .rl-stick-knob { width:42px; height:42px; margin:-21px 0 0 -21px; } .rl-stick.left { left:calc(10px + env(safe-area-inset-left)); } .rl-stick.right { right:calc(10px + env(safe-area-inset-right)); } }
    @media (orientation:portrait) and (max-width:700px) { .rl-stick { bottom:calc(26px + env(safe-area-inset-bottom)); } }
    /* Small directional skill stick: shown only for characters with an active class ability. */
    .rl-stick.ability { left:50%; right:auto; bottom:calc(28px + env(safe-area-inset-bottom)); width:76px; height:76px; transform:translateX(-50%); background:rgba(18,16,25,.28); }
    .rl-stick.ability .rl-stick-base { width:64px; height:64px; border-color:rgba(190,220,160,.72); background:radial-gradient(circle,rgba(87,119,75,.42),rgba(34,43,28,.48)); }
    .rl-stick.ability .rl-stick-knob { width:30px; height:30px; margin:-15px 0 0 -15px; border-color:rgba(225,245,210,.95); background:rgba(116,157,96,.9); }
    .rl-stick.ability .rl-stick-label { bottom:-16px; font-size:9px; color:#d9f0c7; }
    @media (max-width:420px) { .rl-stick.ability { width:68px; height:68px; bottom:calc(25px + env(safe-area-inset-bottom)); } .rl-stick.ability .rl-stick-base { width:58px; height:58px; } .rl-stick.ability .rl-stick-knob { width:28px; height:28px; margin:-14px 0 0 -14px; } }
    @media (orientation:portrait) and (max-width:700px) { .rl-stick.ability { bottom:calc(31px + env(safe-area-inset-bottom)); } }

    .rl-character-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin:16px 0; }
    .rl-character-card { min-width:0; padding:15px; border:1px solid #5b5067; border-radius:9px; background:linear-gradient(180deg,#282332,#1c1923); }
    .rl-character-card.selected { border-color:#c49ae8; box-shadow:0 0 0 2px rgba(190,145,235,.18),0 0 20px rgba(150,100,190,.12); }
    .rl-character-card.locked { border-style:dashed; border-color:#74634a; }
    .rl-character-head { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
    .rl-character-portrait { width:76px; height:76px; flex:none; display:grid; place-items:center; border:1px solid #665674; border-radius:8px; background:#131219; }
    .rl-character-portrait img { width:64px; height:64px; image-rendering:pixelated; object-fit:contain; }
    .rl-character-name { margin:0 0 5px; color:#f0e6fa; font-size:17px; }
    .rl-character-tag { color:#b7a8c5; font-size:10px; line-height:1.4; }
    .rl-character-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin:12px 0; }
    .rl-character-stat { padding:8px; border-radius:5px; background:#17151e; border:1px solid #393342; min-width:0; }
    .rl-character-stat span { display:block; color:#a99bb7; font-size:9px; margin-bottom:4px; }
    .rl-character-stat strong { color:#f0e5ff; font-size:13px; overflow-wrap:anywhere; }
    .rl-character-card .rl-ui-btn { width:100%; margin-top:5px; }
    .rl-character-message { min-height:18px; color:#e8c990; text-align:center; font-size:12px; margin:5px 0 10px; }
    @media (max-width:640px) { .rl-character-grid { grid-template-columns:1fr; } .rl-character-head { align-items:flex-start; } }
  `;

  document.head.appendChild(style);

  const canvas = document.createElement('canvas');
  canvas.id = 'rogue-phase2-canvas';
  canvas.tabIndex = 0;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // Translate all canvas HUD, boss banners and upgrade text without duplicating draw logic.
  const rawFillText = ctx.fillText.bind(ctx);
  const rawMeasureText = ctx.measureText.bind(ctx);
  ctx.fillText = (text, ...args) => rawFillText(translateText(text), ...args);
  ctx.measureText = text => rawMeasureText(translateText(text));

  const uiOverlay = document.createElement('div');
  uiOverlay.id = 'rogue-ui-overlay';
  uiOverlay.style.display = 'none';
  document.body.appendChild(uiOverlay);
  uiOverlay.addEventListener('click', onUiOverlayClick);

  // Two main virtual sticks plus an optional class-ability stick for phones and tablets.
  const touchControls = document.createElement('div');
  touchControls.id = 'rl-touch-controls';
  touchControls.innerHTML = `
    <div class="rl-touch-actions">
      <button type="button" data-touch-action="pause" aria-label="Пауза">Ⅱ</button>
      <button type="button" data-touch-action="reload" aria-label="Перезарядка">↻</button>
      <button type="button" data-touch-action="impulse" aria-label="Импульс" style="display:none">Q</button>
    </div>
    <div class="rl-stick left" data-stick="move" aria-label="Джойстик движения">
      <div class="rl-stick-base"></div><div class="rl-stick-knob"></div><div class="rl-stick-label">ДВИЖЕНИЕ</div>
    </div>
    <div class="rl-stick right" data-stick="aim" aria-label="Джойстик прицеливания и стрельбы">
      <div class="rl-stick-base"></div><div class="rl-stick-knob"></div><div class="rl-stick-label">ПРИЦЕЛ + ОГОНЬ</div>
    </div>
    <div class="rl-stick ability" data-stick="ability" aria-label="Джойстик способности">
      <div class="rl-stick-base"></div><div class="rl-stick-knob"></div><div class="rl-stick-label">НАВЫК</div>
    </div>`;
  document.body.appendChild(touchControls);
  touchControls.addEventListener('click', onTouchControlClick);

  let screenW = 0;
  let screenH = 0;
  let running = true;
  let menuVisible = true;
  let menuPage = 'main';
  let uiOverlayMode = '';
  const UI_SETTINGS_STORAGE_KEY = 'pixelRoguelikeUiSettings_v1';
  function loadUiSettings() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY) || '{}');
      return {
        language: ['ru', 'en', 'uk'].includes(saved.language) ? saved.language : 'ru',
        controlMode: ['pc', 'mobile'].includes(saved.controlMode) ? saved.controlMode : 'pc'
      };
    } catch (_) { return { language: 'ru', controlMode: 'pc' }; }
  }
  const savedUiSettings = loadUiSettings();
  let currentLanguage = savedUiSettings.language;
  let controlMode = savedUiSettings.controlMode; // Changed in Settings, not on the main menu.
  document.documentElement.lang = currentLanguage;
  function saveUiSettings() {
    document.documentElement.lang = currentLanguage;
    try { window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify({ language: currentLanguage, controlMode })); } catch (_) { /* settings remain active for this page session */ }
  }

  // Russian is the default. Text is translated at the UI/canvas presentation layer,
  // leaving the internal game identifiers and saved character data language-neutral.
  const UI_TRANSLATIONS = {
    en: {
      '2D roguelike shooter · вид сверху · пиксельный мир': '2D roguelike shooter · top-down view · pixel world',
      'ТВОИ МОНЕТЫ': 'YOUR COINS', 'ИГРАТЬ': 'PLAY', 'ПЕРСОНАЖИ': 'CHARACTERS',
      'УСИЛЕНИЯ И СТАТИСТИКА': 'UPGRADES & STATS', 'НАСТРОЙКИ': 'SETTINGS',
      'ВЫБОР ПЕРСОНАЖА': 'CHARACTER SELECT',
      'Выбери героя для следующего забега. Купленные персонажи сохраняются в этом браузере.': 'Choose a hero for your next run. Purchased characters are saved in this browser.',
      'НАЗАД В МЕНЮ': 'BACK TO MENU', 'ВЫБРАН': 'SELECTED', 'ВЫБРАТЬ': 'SELECT',
      'НЕДОСТАТОЧНО МОНЕТ': 'NOT ENOUGH COINS', 'КУПИТЬ ЗА': 'BUY FOR',
      'Стартовый персонаж · бесплатно': 'Starting character · free', 'Персонаж открыт': 'Character unlocked',
      ' патронов': ' rounds', ' патронов.': ' rounds.', ' блоков': ' tiles', '12 HP / выстрел + цепь': '12 damage / shot + chain',
      '10 HP по площади + 2 HP от яда': '10 area damage + 2 poison damage', 'Нет': 'None', 'Пассивная способность / нет': 'Passive ability / none',
      'Закрытый персонаж · цена ': 'Locked character · price ', 'монет': 'coins',
      'ЗДОРОВЬЕ': 'HEALTH', 'УРОН': 'DAMAGE', 'СКОРОСТЬ': 'SPEED', 'ОБОЙМА': 'MAGAZINE',
      'ДАЛЬНОСТЬ': 'RANGE', 'ОРУЖИЕ': 'WEAPON', 'ОСОБЕННОСТЬ': 'SPECIAL',
      'Здоровье': 'Health', 'Персонаж': 'Character', 'Оружие': 'Weapon', 'Уникальная способность': 'Unique ability',
      'Перезарядка навыка': 'Ability cooldown', 'Урон': 'Damage', 'Дальность стрельбы': 'Attack range',
      'Обойма': 'Magazine', 'Перезарядка': 'Reload', 'Скорость': 'Speed', 'Радиус сбора XP': 'XP pickup radius',
      'Снижение урона': 'Damage reduction', 'Шанс уклонения': 'Dodge chance', 'Шанс крит. удара': 'Critical chance',
      'Уровень': 'Level', 'Убийства': 'Kills', 'Всего опыта': 'Total XP', 'Монеты': 'Coins',
      'СТАТИСТИКА И УСИЛЕНИЯ': 'STATS & UPGRADES',
      'Текущие характеристики героя и полный каталог доступных улучшений.': 'Current hero stats and the full list of available upgrades.',
      'ХАРАКТЕРИСТИКИ ПЕРСОНАЖА': 'CHARACTER STATS', 'ВСЕ УЛУЧШЕНИЯ': 'ALL UPGRADES',
      'ПАУЗА': 'PAUSED', 'Забег приостановлен.': 'Run paused.', 'ПРОДОЛЖИТЬ': 'RESUME', 'ВЫХОД В МЕНЮ': 'EXIT TO MENU',
      'ЗАБЕГ ОКОНЧЕН': 'RUN OVER', 'ПОПРОБОВАТЬ СНОВА': 'TRY AGAIN', 'ПОБЕДА!': 'VICTORY!', 'ИГРАТЬ СНОВА': 'PLAY AGAIN',
      'Ты прошёл все испытания и завершил забег!': 'You completed all encounters and finished the run!',
      'Убийства:': 'Kills:', 'Опыт:': 'XP:', 'Время:': 'Time:',
      'НАСТРОЙКИ ИГРЫ': 'GAME SETTINGS', 'ЯЗЫК': 'LANGUAGE', 'УПРАВЛЕНИЕ': 'CONTROLS',
      'Выбери язык интерфейса.': 'Choose the interface language.', 'Выбери управление для этого устройства.': 'Choose controls for this device.',
      'Здесь можно изменить язык и способ управления. Настройки сохраняются в этом браузере.': 'Change the language and control scheme here. Settings are saved in this browser.',
      'ПК: WASD — движение · мышь — прицел · ЛКМ — стрельба.': 'PC: WASD — move · mouse — aim · left click — shoot.',
      'Телефон: левый джойстик — движение · правый — прицел и стрельба.': 'Phone: left joystick — move · right joystick — aim and shoot.',
      'Джойстик движения': 'Movement joystick', 'Джойстик прицеливания и стрельбы': 'Aiming and shooting joystick', 'Джойстик способности': 'Ability joystick',
      'Русский': 'Russian', 'English': 'English', 'Українська': 'Ukrainian', 'КОМПЬЮТЕР': 'PC', 'ТЕЛЕФОН': 'PHONE',
      'ПК': 'PC', 'Сохранённые настройки применяются при следующем запуске.': 'Your settings are saved and applied on the next launch.',
      'Сейчас выбран персонаж: ': 'Selected character: ',
      'Стрелок': 'Shooter', 'СТРЕЛОК': 'SHOOTER', 'Охотник': 'Hunter', 'ОХОТНИК': 'HUNTER',
      'Алхимик': 'Alchemist', 'АЛХИМИК': 'ALCHEMIST', 'Медик': 'Medic', 'МЕДИК': 'MEDIC',
      'Инженер': 'Engineer', 'ИНЖЕНЕР': 'ENGINEER', 'Разведчик': 'Scout', 'РАЗВЕДЧИК': 'SCOUT',
      'Электрик': 'Electrician', 'ЭЛЕКТРИК': 'ELECTRICIAN',
      'Ружьё': 'Rifle', 'РУЖЬЁ': 'RIFLE', 'Дробовик': 'Shotgun', 'ДРОБОВИК': 'SHOTGUN', 'Алхимические колбы': 'Alchemical flasks',
      'Медицинский пистолет': 'Medical pistol', 'МЕДИЦИНСКИЙ ПИСТОЛЕТ': 'MEDICAL PISTOL', 'Сервисный пистолет': 'Service pistol', 'СЕРВИСНЫЙ ПИСТОЛЕТ': 'SERVICE PISTOL', 'Лёгкий карабин': 'Light carbine', 'ЛЁГКИЙ КАРАБИН': 'LIGHT CARBINE', 'Молниемёт': 'Lightning gun', 'МОЛНИЕМЁТ': 'LIGHTNING GUN',
      'Универсальный боец': 'All-round fighter', 'Ближний бой': 'Close-range fighter', 'Яд и контроль территории': 'Poison and area control',
      'Выживание': 'Survival', 'Автоматическая поддержка': 'Automated support', 'Мобильность': 'Mobility', 'Цепная атака': 'Chain attacks',
      'Без дополнительной способности.': 'No additional ability.', 'Пять дробин веером за один патрон.': 'Fires five pellets in a spread per shell.',
      'Ядовитое облако': 'Poison cloud', 'Лечение': 'Healing', 'Турель': 'Turret', 'Рывок': 'Dash', 'Энергетические кольца': 'Energy rings', 'ЭНЕРГЕТИЧЕСКИЕ КОЛЬЦА': 'ENERGY RINGS',
      'Колба наносит 10 HP по площади и оставляет ядовитую лужу на 1 сек. (2 HP каждому врагу). Навык создаёт облако на 4 сек. Перезарядка: 25 сек.': 'The flask deals 10 area damage and leaves a poison puddle for 1 sec. (2 damage to each enemy). The ability creates a cloud for 4 sec. Cooldown: 25 sec.',
      'Стреляет красными лечебными маркерами. Восстанавливает 20 HP. Перезарядка: 45 сек.': 'Fires red rounds. Restores 20 HP. Cooldown: 45 sec.',
      'Ставит турель на 8 сек.: 5 урона каждые 0,3 сек. Перезарядка: 30 сек. Собственный выстрел: 8 HP.': 'Deploys a turret for 8 sec.: 5 damage every 0.3 sec. Cooldown: 30 sec. Own shots: 8 damage.',
      'С начала каждого забега получает 2 случайных улучшения. Рывок на 4,5 блока наносит 15 HP врагам на пути. Перезарядка: 15 сек.': 'Starts each run with 2 random upgrades. Dashes 4.5 tiles and deals 15 damage to enemies along the path. Cooldown: 15 sec.',
      'Активная способность: выпускает вокруг себя 3 расширяющихся кольца энергии радиусом до 8 блоков. Каждое кольцо наносит 20 HP врагам при касании. Перезарядка: 18 сек. Обычные выстрелы наносят 12 HP и могут перескакивать на второго врага.': 'Active ability: releases 3 expanding energy rings around the player, reaching up to 8 tiles away. Each ring deals 20 damage to enemies it touches. Cooldown: 18 sec. Regular shots deal 12 damage and can chain to a second enemy.',
      'Не хватает ': 'You need ', ' монет.': ' more coins.', ' выбран для следующего забега.': ' selected for the next run.', ' куплен и выбран!': ' purchased and selected!',
      'Обычное': 'Common', 'Редкое': 'Rare', 'Эпическое': 'Epic', 'Легендарное': 'Legendary',
      'Обычное': 'Common', 'ОБЫЧНОЕ': 'COMMON', 'РЕДКОЕ': 'RARE', 'ЭПИЧЕСКОЕ': 'EPIC', 'ЛЕГЕНДАРНОЕ': 'LEGENDARY',
      'Тяжёлые пули': 'Heavy bullets', 'Большие карманы': 'Deep pockets', 'Быстрая перезарядка': 'Quick reload', 'Лёгкие сапожки': 'Light boots',
      'Крепкое здоровье': 'Strong health', 'Защита': 'Protection', 'Усиленная броня': 'Reinforced armor', 'Меткость': 'Accuracy',
      'Рикошет': 'Ricochet', 'Магнит': 'Magnet', 'Последний шанс': 'Last chance', 'Взрывные пули': 'Explosive bullets',
      'Энергетический щит': 'Energy shield', 'Вампиризм': 'Vampirism', 'Призрачный стрелок': 'Ghost shooter',
      'Золотая пуля': 'Golden bullet', 'Замедление времени': 'Time slow', 'Феникс': 'Phoenix', 'Импульс': 'Impulse',
      'Уровень:': 'Level:',
      '+2 к урону выстрела за уровень. Сейчас: +': '+2 shot damage per level. Current: +',
      '+4 патрона к обойме за уровень. Сейчас: ': '+4 magazine rounds per level. Current: ',
      ' патронов.': ' rounds.', '−0,2 сек. перезарядки за уровень. Сейчас: ': '−0.2 sec reload per level. Current: ', ' сек.': ' sec.',
      'Скорость: ': 'Speed: ', '%. С 3 уровня при получении урона: +40% скорости (перезарядка 5 сек.).': '%. From level 3, taking damage grants +40% speed (5 sec cooldown).',
      '+10 к максимальному HP за уровень. Сейчас: ': '+10 max HP per level. Current: ',
      '−5% получаемого урона за уровень. Сейчас: ': '−5% incoming damage per level. Current: ',
      '% шанс полностью избежать входящего урона.': '% chance to completely dodge incoming damage.',
      'Аптечки восстанавливают 20 HP.': 'Medkits restore 20 HP.', 'Аптечки выпадают каждые 75 убийств.': 'Medkits drop every 75 kills.',
      '+1 HP каждые 2 секунды.': '+1 HP every 2 seconds.', 'Аптечки выпадают каждые 50 убийств.': 'Medkits drop every 50 kills.',
      '+': '+', '% шанс критического удара. Крит наносит ×2 урона.': '% critical hit chance. Critical hits deal ×2 damage.',
      'Пуля после попадания перескакивает ещё на ': 'After a hit, the bullet jumps to ', ' врагов.': ' more enemies.',
      'Радиус сбора XP увеличен на ': 'XP pickup radius increased by ',
      'Один раз за забег при HP ниже 25%: +30% скорости и поглощение урона на 10 сек.; за каждые 2 убийства в течение 5 сек. +1 HP.': 'Once per run below 25% HP: +30% speed and damage absorption for 10 sec.; gain +1 HP for every 2 kills within 5 sec.',
      'Раз в 10 сек. следующий выстрел вызывает взрыв. Урон взрыва: ': 'Every 10 sec., the next shot causes an explosion. Explosion damage: ',
      ' (временная базовая трактовка: +1 за уровень).': ' (temporary base interpretation: +1 per level).',
      'Каждые 20 сек. полностью блокирует урон на ': 'Every 20 sec., blocks all damage for ',
      'За каждые 10 убийств восстанавливает 3 HP.': 'Restores 3 HP for every 10 kills.',
      'Помощник стреляет каждые 2 сек. Урон выстрела: ': 'A companion fires every 2 sec. Shot damage: ',
      'Последний патрон обоймы: +150% урона, пронзает 5 врагов; затем срабатывает Рикошет, если он есть.': 'The last magazine round deals +150% damage and pierces 5 enemies; Ricochet triggers afterward if owned.',
      'Каждые 10 сек. замедляет всех врагов на 20% на 3 сек.': 'Every 10 sec., slows all enemies by 20% for 3 sec.',
      'Один раз за забег возрождает после смертельного удара с 25% максимального HP.': 'Once per run, revives you after a fatal hit with 25% max HP.',
      'Каждые 15 сек. отталкивает врагов; ': 'Every 15 sec., knocks enemies back; ', 'наносит 5 урона и отбрасывает дальше.': 'deals 5 damage and knocks them farther.', 'без урона.': 'no damage.',
      'Награда за победу над Монструозной крысой — выбери одно': 'Reward for defeating the Monstrous Rat — choose one',
      'Выбери одно улучшение — игра на паузе': 'Choose one upgrade — the game is paused',
      'БЕСПЛАТНОЕ УЛУЧШЕНИЕ!': 'FREE UPGRADE!', 'НОВЫЙ УРОВЕНЬ!': 'LEVEL UP!',
      'НАЖМИ ': 'PRESS ', ' ИЛИ КЛИКНИ': ' OR CLICK', 'Все улучшения достигли максимального уровня.': 'All upgrades are at maximum level.',
      'Нажми Enter, чтобы продолжить.': 'Press Enter to continue.',
      'Улучшение получено!': 'Upgrade acquired!', 'УЛУЧШЕНИЕ ПОЛУЧЕНО!': 'UPGRADE ACQUIRED!',
      'АЛХИМИК: ЯДОВИТОЕ ОБЛАКО!': 'ALCHEMIST: POISON CLOUD!', 'ЗДОРОВЬЕ УЖЕ ПОЛНОЕ': 'HEALTH IS ALREADY FULL',
      'МЕДИК: ': 'MEDIC: ', 'ИНЖЕНЕР: ТУРЕЛЬ УСТАНОВЛЕНА!': 'ENGINEER: TURRET DEPLOYED!', 'РАЗВЕДЧИК: РЫВОК!': 'SCOUT: DASH!',
      'БОСС №1: МОНСТРУОЗНАЯ КРЫСА': 'BOSS #1: MONSTROUS RAT', 'БОСС №2: ГОБЛИН-ПОДРЫВНИК': 'BOSS #2: GOBLIN BOMBER', 'БОСС №3: КОРОЛЕВА ПАУКОВ': 'BOSS #3: SPIDER QUEEN',
      'КОРОЛЕВА ПАУКОВ': 'SPIDER QUEEN', 'ПАУЧЬЕ ПОДЗЕМЕЛЬЕ': 'SPIDER DUNGEON',
      'ПОБЕДА НАД ГОБЛИНОМ — ИСЦЕЛЕНИЕ 50%': 'GOBLIN DEFEATED — 50% HEAL', 'ПОБЕДА НАД КОРОЛЕВОЙ — ИСЦЕЛЕНИЕ 50%': 'SPIDER QUEEN DEFEATED — 50% HEAL',
      'ПЕРЕДЫШКА': 'BREATHER', 'Восстанавливает 30 HP при выборе. Можно выбирать повторно без ограничения.': 'Restores 30 HP when selected. Can be chosen repeatedly with no limit.',
      'ПАУТИНА! НЕ ЗАДЕРЖИВАЙСЯ В ЛИПКИЙ ЗОНЕ!': 'WEB! DO NOT STAY IN THE STICKY AREA!', 'КОРОЛЕВА ПРИЗЫВАЕТ ': 'THE QUEEN SUMMONS ', ' ПАУЧАТ!': ' SPIDERLINGS!',
      'КОРОЛЕВА ПАУКОВ ВЫХОДИТ ИЗ ЯЙЦА! ФАЗА 2': 'SPIDER QUEEN EMERGES FROM HER EGG! PHASE 2', 'КОРОЛЕВА ПАУКОВ В ЯРОСТИ! ФАЗА 3': 'SPIDER QUEEN ENRAGED! PHASE 3',
      'ЯДОВИТЫЙ УКУС!': 'VENOMOUS BITE!', 'КОРОЛЕВА ПАУКОВ ПРЫГАЕТ! УДАРНАЯ ВОЛНА!': 'SPIDER QUEEN LEAPS! SHOCKWAVE!',
      'БОСС №1: МОНСТРУОЗНАЯ КРЫСА': 'BOSS #1: MONSTROUS RAT', 'БОСС №2: ГОБЛИН-ПОДРЫВНИК': 'BOSS #2: GOBLIN BOMBER',
      'МОНСТРУОЗНАЯ КРЫСА ПОВЕРЖЕНА!': 'MONSTROUS RAT DEFEATED!', 'ГОБЛИН ГЛОТАЕТ ДИНАМИТ...': 'THE GOBLIN SWALLOWS DYNAMITE...',
      'Монструозная крыса': 'Monstrous Rat', 'Гоблин-подрывник': 'Goblin Bomber', 'МОНСТРУОЗНАЯ КРЫСА': 'MONSTROUS RAT', 'ГОБЛИН-ПОДРЫВНИК': 'GOBLIN BOMBER',
      'ГОБЛИН ПОВЕРЖЕН! ВЫЖИВИ ЕЩЁ 60 СЕКУНД': 'GOBLIN DEFEATED! SURVIVE 60 MORE SECONDS', 'ФИНАЛЬНАЯ МИНУТА ПРОЙДЕНА! ПОБЕДА!': 'FINAL MINUTE COMPLETE! VICTORY!',
      'НАГРАДА ЗА БОССА: БЕСПЛАТНОЕ УЛУЧШЕНИЕ': 'BOSS REWARD: FREE UPGRADE',
      'ПЕРЕДЫШКА: +': 'BREATHER: +', 'HP': 'HP',
      'ГОБЛИН ПОВЕРЖЕН! ВЫЖИВИ ЕЩЁ 60 СЕКУНД': 'GOBLIN DEFEATED! SURVIVE 60 MORE SECONDS',
      'ЖИВОТНЫЙ КРИК! КРЫСА В ЯРОСТИ!': 'BEASTLY SCREAM! THE RAT IS ENRAGED!', 'ФАЗА 3 — ЯРОСТЬ!': 'PHASE 3 — RAGE!',
      'РАЗГРОМНОЕ ЭХО — СТРЕЛЬБА ЗАПРЕЩЕНА!': 'DEVASTATING ECHO — SHOOTING DISABLED!',
      'КРЫСА ПРИЗЫВАЕТ ': 'THE RAT SUMMONS ', ' МАЛЕНЬКИХ КРЫС!': ' SMALL RATS!',
      'ПОЯС ВЗРЫВАЕТСЯ — ОСКОЛКИ!': 'BELT EXPLODES — SHARDS!', 'ДИНАМИТ ВЗРЫВАЕТСЯ!': 'DYNAMITE EXPLODES!',
      'КРОВАВАЯ ЛУНА НАЧАЛАСЬ!': 'THE BLOOD MOON HAS BEGUN!', 'КРОВАВАЯ ЛУНА ЗАКОНЧИЛАСЬ': 'THE BLOOD MOON HAS ENDED',
      'ВДОХ...': 'INHALE...', 'ФАЗА': 'PHASE',
      'ОБОЙМА': 'MAG', 'НАВЫК': 'SKILL', 'ДВИЖЕНИЕ': 'MOVE', 'ПРИЦЕЛ + ОГОНЬ': 'AIM + FIRE',
      'HP ': 'HP ', 'LV ': 'LV ', 'УРОВЕНЬ ': 'LEVEL ', 'ЗДОРОВЬЕ  ': 'HEALTH  ', 'ПАТРОНЫ  ': 'AMMO  ',
      'ПЕРЕЗАРЯДКА  ': 'RELOADING  ', ' ВРЕМЯ  ': ' TIME  ', 'ВРЕМЯ  ': 'TIME  ',
      'УБИЙСТВА ': 'KILLS ', '   ВСЕГО XP ': '   TOTAL XP ', 'ВРАГИ: ': 'ENEMIES: ',
      'АРЕНА БОССА': 'BOSS ARENA', 'КАНАЛИЗАЦИЯ': 'SEWER', 'ОБЫЧНАЯ АРЕНА': 'REGULAR ARENA',
      ' БЛОКОВ': ' TILES', 'БОССОВОЕ СРАЖЕНИЕ': 'BOSS FIGHT', 'ПОДЗЕМНЫЙ УРОВЕНЬ': 'UNDERGROUND LEVEL',
      'ЗОМБИ • МЫШИ • СКЕЛЕТЫ': 'ZOMBIES • BATS • SKELETONS', 'ФИНАЛЬНАЯ МИНУТА: ': 'FINAL MINUTE: ',
      'КРОВАВАЯ ЛУНА: +15% МОБАМ': 'BLOOD MOON: +15% TO MOBS', 'ВЗРЫВНАЯ ПУЛЯ ГОТОВА': 'EXPLOSIVE ROUND READY',
      'ИМПУЛЬС Q/Й: ': 'IMPULSE Q: ', 'ГОТОВО': 'READY', 'ЩИТ ': 'SHIELD ', 'ПОГЛОЩЕНИЕ ': 'ABSORPTION ',
      'НЕУЯЗВИМОСТЬ ': 'INVULNERABILITY ', 'WASD — движение   МЫШЬ — прицел   ЛКМ — выстрел   R — перезарядка   Q/Й — импульс   ESC — пауза': 'WASD — move   MOUSE — aim   LMB — shoot   R — reload   Q — impulse   ESC — pause',
      'ПАУЗА': 'PAUSED', 'Нажми ESC, чтобы продолжить': 'Press ESC to resume', 'ПОБЕДА!': 'VICTORY!',
      'Ты прошёл все испытания и завершил забег!': 'You completed all encounters and finished the run!',
      'Нажми ENTER, чтобы начать заново': 'Press ENTER to start again', 'ЗАБЕГ ОКОНЧЕН': 'RUN OVER',
      'Забег приостановлен.': 'Run paused.', 'МОН.': 'COINS', ' МИН.': ' MIN.'
    },
    uk: {
      '2D roguelike shooter · вид сверху · пиксельный мир': '2D roguelike shooter · вигляд зверху · піксельний світ',
      'ТВОИ МОНЕТЫ': 'ТВОЇ МОНЕТИ', 'ИГРАТЬ': 'ГРАТИ', 'ПЕРСОНАЖИ': 'ПЕРСОНАЖІ',
      'УСИЛЕНИЯ И СТАТИСТИКА': 'ПОКРАЩЕННЯ ТА СТАТИСТИКА', 'НАСТРОЙКИ': 'НАЛАШТУВАННЯ',
      'ВЫБОР ПЕРСОНАЖА': 'ВИБІР ПЕРСОНАЖА',
      'Выбери героя для следующего забега. Купленные персонажи сохраняются в этом браузере.': 'Обери героя для наступного забігу. Придбані персонажі зберігаються в цьому браузері.',
      'НАЗАД В МЕНЮ': 'НАЗАД ДО МЕНЮ', 'ВЫБРАН': 'ОБРАНО', 'ВЫБРАТЬ': 'ОБРАТИ',
      'НЕДОСТАТОЧНО МОНЕТ': 'НЕДОСТАТНЬО МОНЕТ', 'КУПИТЬ ЗА': 'КУПИТИ ЗА',
      'Стартовый персонаж · бесплатно': 'Стартовий персонаж · безкоштовно', 'Персонаж открыт': 'Персонажа відкрито',
      ' патронов': ' набоїв', ' патронов.': ' набоїв.', ' блоков': ' блоків', '12 HP / выстрел + цепь': '12 шкоди / постріл + ланцюг',
      '10 HP по площади + 2 HP от яда': '10 шкоди по площі + 2 шкоди від отрути', 'Нет': 'Немає', 'Пассивная способность / нет': 'Пасивна здібність / немає',
      'Закрытый персонаж · цена ': 'Закритий персонаж · ціна ', 'монет': 'монет',
      'ЗДОРОВЬЕ': 'ЗДОРОВ’Я', 'УРОН': 'ШКОДА', 'СКОРОСТЬ': 'ШВИДКІСТЬ', 'ОБОЙМА': 'МАГАЗИН',
      'ДАЛЬНОСТЬ': 'ДАЛЬНІСТЬ', 'ОРУЖИЕ': 'ЗБРОЯ', 'ОСОБЕННОСТЬ': 'ОСОБЛИВІСТЬ',
      'Здоровье': 'Здоров’я', 'Персонаж': 'Персонаж', 'Оружие': 'Зброя', 'Уникальная способность': 'Унікальна здібність',
      'Перезарядка навыка': 'Перезарядка здібності', 'Урон': 'Шкода', 'Дальность стрельбы': 'Дальність стрільби',
      'Обойма': 'Магазин', 'Перезарядка': 'Перезарядка', 'Скорость': 'Швидкість', 'Радиус сбора XP': 'Радіус збору XP',
      'Снижение урона': 'Зменшення шкоди', 'Шанс уклонения': 'Шанс ухилення', 'Шанс крит. удара': 'Шанс крит. удару',
      'Уровень': 'Рівень', 'Убийства': 'Убивства', 'Всего опыта': 'Усього досвіду', 'Монеты': 'Монети',
      'СТАТИСТИКА И УСИЛЕНИЯ': 'СТАТИСТИКА ТА ПОКРАЩЕННЯ',
      'Текущие характеристики героя и полный каталог доступных улучшений.': 'Поточні характеристики героя та повний каталог доступних покращень.',
      'ХАРАКТЕРИСТИКИ ПЕРСОНАЖА': 'ХАРАКТЕРИСТИКИ ПЕРСОНАЖА', 'ВСЕ УЛУЧШЕНИЯ': 'УСІ ПОКРАЩЕННЯ',
      'ПАУЗА': 'ПАУЗА', 'Забег приостановлен.': 'Забіг призупинено.', 'ПРОДОЛЖИТЬ': 'ПРОДОВЖИТИ', 'ВЫХОД В МЕНЮ': 'ВИХІД ДО МЕНЮ',
      'ЗАБЕГ ОКОНЧЕН': 'ЗАБІГ ЗАВЕРШЕНО', 'ПОПРОБОВАТЬ СНОВА': 'СПРОБУВАТИ ЗНОВУ', 'ПОБЕДА!': 'ПЕРЕМОГА!', 'ИГРАТЬ СНОВА': 'ГРАТИ ЗНОВУ',
      'Ты прошёл все испытания и завершил забег!': 'Ти пройшов усі випробування та завершив забіг!',
      'Убийства:': 'Убивства:', 'Опыт:': 'Досвід:', 'Время:': 'Час:',
      'НАСТРОЙКИ ИГРЫ': 'НАЛАШТУВАННЯ ГРИ', 'ЯЗЫК': 'МОВА', 'УПРАВЛЕНИЕ': 'КЕРУВАННЯ',
      'Выбери язык интерфейса.': 'Обери мову інтерфейсу.', 'Выбери управление для этого устройства.': 'Обери керування для цього пристрою.',
      'Здесь можно изменить язык и способ управления. Настройки сохраняются в этом браузере.': 'Тут можна змінити мову та спосіб керування. Налаштування зберігаються в цьому браузері.',
      'ПК: WASD — движение · мышь — прицел · ЛКМ — стрельба.': 'ПК: WASD — рух · миша — приціл · ліва кнопка миші — постріл.',
      'Телефон: левый джойстик — движение · правый — прицел и стрельба.': 'Телефон: лівий джойстик — рух · правий — приціл і стрільба.',
      'Джойстик движения': 'Джойстик руху', 'Джойстик прицеливания и стрельбы': 'Джойстик прицілювання та стрільби', 'Джойстик способности': 'Джойстик здібності',
      'Русский': 'Російська', 'English': 'Англійська', 'Українська': 'Українська', 'КОМПЬЮТЕР': 'ПК', 'ТЕЛЕФОН': 'ТЕЛЕФОН',
      'ПК': 'ПК', 'Сохранённые настройки применяются при следующем запуске.': 'Збережені налаштування застосовуються під час наступного запуску.',
      'Сейчас выбран персонаж: ': 'Зараз обрано персонажа: ',
      'Стрелок': 'Стрілець', 'СТРЕЛОК': 'СТРІЛЕЦЬ', 'Охотник': 'Мисливець', 'ОХОТНИК': 'МИСЛИВЕЦЬ',
      'Алхимик': 'Алхімік', 'АЛХИМИК': 'АЛХІМІК', 'Медик': 'Медик', 'МЕДИК': 'МЕДИК',
      'Инженер': 'Інженер', 'ИНЖЕНЕР': 'ІНЖЕНЕР', 'Разведчик': 'Розвідник', 'РАЗВЕДЧИК': 'РОЗВІДНИК',
      'Электрик': 'Електрик', 'ЭЛЕКТРИК': 'ЕЛЕКТРИК',
      'Ружьё': 'Гвинтівка', 'РУЖЬЁ': 'ГВИНТІВКА', 'Дробовик': 'Дробовик', 'ДРОБОВИК': 'ДРОБОВИК', 'Алхимические колбы': 'Алхімічні колби',
      'Медицинский пистолет': 'Медичний пістолет', 'МЕДИЦИНСКИЙ ПИСТОЛЕТ': 'МЕДИЧНИЙ ПІСТОЛЕТ', 'Сервисный пистолет': 'Сервісний пістолет', 'СЕРВИСНЫЙ ПИСТОЛЕТ': 'СЕРВІСНИЙ ПІСТОЛЕТ', 'Лёгкий карабин': 'Легкий карабін', 'ЛЁГКИЙ КАРАБИН': 'ЛЕГКИЙ КАРАБІН', 'Молниемёт': 'Блискавкомет', 'МОЛНИЕМЁТ': 'БЛИСКАВКОМЕТ',
      'Универсальный боец': 'Універсальний боєць', 'Ближний бой': 'Ближній бій', 'Яд и контроль территории': 'Отрута й контроль території',
      'Выживание': 'Виживання', 'Автоматическая поддержка': 'Автоматична підтримка', 'Мобильность': 'Мобільність', 'Цепная атака': 'Ланцюгова атака',
      'Без дополнительной способности.': 'Без додаткової здібності.', 'Пять дробин веером за один патрон.': 'П’ять дробин віялом за один патрон.',
      'Ядовитое облако': 'Отруйна хмара', 'Лечение': 'Лікування', 'Турель': 'Турель', 'Рывок': 'Ривок', 'Энергетические кольца': 'Енергетичні кільця', 'ЭНЕРГЕТИЧЕСКИЕ КОЛЬЦА': 'ЕНЕРГЕТИЧНІ КІЛЬЦЯ',
      'Колба наносит 10 HP по площади и оставляет ядовитую лужу на 1 сек. (2 HP каждому врагу). Навык создаёт облако на 4 сек. Перезарядка: 25 сек.': 'Колба завдає 10 шкоди по площі й залишає отруйну калюжу на 1 с (2 шкоди кожному ворогу). Здібність створює хмару на 4 с. Перезарядка: 25 с.',
      'Стреляет красными лечебными маркерами. Восстанавливает 20 HP. Перезарядка: 45 сек.': 'Стріляє червоними снарядами. Відновлює 20 HP. Перезарядка: 45 с.',
      'Ставит турель на 8 сек.: 5 урона каждые 0,3 сек. Перезарядка: 30 сек. Собственный выстрел: 8 HP.': 'Встановлює турель на 8 с: 5 шкоди кожні 0,3 с. Перезарядка: 30 с. Власний постріл: 8 шкоди.',
      'С начала каждого забега получает 2 случайных улучшения. Рывок на 4,5 блока наносит 15 HP врагам на пути. Перезарядка: 15 сек.': 'На початку кожного забігу отримує 2 випадкові покращення. Ривок на 4,5 блока завдає 15 шкоди ворогам на шляху. Перезарядка: 15 с.',
      'Активная способность: выпускает вокруг себя 3 расширяющихся кольца энергии радиусом до 8 блоков. Каждое кольцо наносит 20 HP врагам при касании. Перезарядка: 18 сек. Обычные выстрелы наносят 12 HP и могут перескакивать на второго врага.': 'Активна здібність: випускає навколо себе 3 кільця енергії, що розширюються на відстань до 8 блоків. Кожне кільце завдає 20 шкоди ворогам при зіткненні. Перезарядка: 18 с. Звичайні постріли завдають 12 шкоди й можуть перескочити на другого ворога.',
      'Не хватает ': 'Не вистачає ', ' монет.': ' монет.', ' выбран для следующего забега.': ' обрано для наступного забігу.', ' куплен и выбран!': ' придбано й обрано!',
      'Обычное': 'Звичайне', 'Редкое': 'Рідкісне', 'Эпическое': 'Епічне', 'Легендарное': 'Легендарне',
      'ОБЫЧНОЕ': 'ЗВИЧАЙНЕ', 'РЕДКОЕ': 'РІДКІСНЕ', 'ЭПИЧЕСКОЕ': 'ЕПІЧНЕ', 'ЛЕГЕНДАРНОЕ': 'ЛЕГЕНДАРНЕ',
      'Тяжёлые пули': 'Важкі кулі', 'Большие карманы': 'Великі кишені', 'Быстрая перезарядка': 'Швидка перезарядка', 'Лёгкие сапожки': 'Легкі чоботи',
      'Крепкое здоровье': 'Міцне здоров’я', 'Защита': 'Захист', 'Усиленная броня': 'Посилена броня', 'Меткость': 'Влучність',
      'Рикошет': 'Рикошет', 'Магнит': 'Магніт', 'Последний шанс': 'Останній шанс', 'Взрывные пули': 'Вибухові кулі',
      'Энергетический щит': 'Енергетичний щит', 'Вампиризм': 'Вампіризм', 'Призрачный стрелок': 'Примарний стрілець',
      'Золотая пуля': 'Золота куля', 'Замедление времени': 'Сповільнення часу', 'Феникс': 'Фенікс', 'Импульс': 'Імпульс',
      'Уровень:': 'Рівень:',
      '+2 к урону выстрела за уровень. Сейчас: +': '+2 до шкоди пострілу за рівень. Зараз: +',
      '+4 патрона к обойме за уровень. Сейчас: ': '+4 патрони до магазину за рівень. Зараз: ',
      ' патронов.': ' патронів.', '−0,2 сек. перезарядки за уровень. Сейчас: ': '−0,2 с перезарядки за рівень. Зараз: ', ' сек.': ' с.',
      'Скорость: ': 'Швидкість: ', '%. С 3 уровня при получении урона: +40% скорости (перезарядка 5 сек.).': '%. З 3 рівня після отримання шкоди: +40% швидкості (перезарядка 5 с).',
      '+10 к максимальному HP за уровень. Сейчас: ': '+10 до максимального HP за рівень. Зараз: ',
      '−5% получаемого урона за уровень. Сейчас: ': '−5% отриманої шкоди за рівень. Зараз: ',
      '% шанс полностью избежать входящего урона.': '% шанс повністю уникнути отриманої шкоди.',
      'Аптечки восстанавливают 20 HP.': 'Аптечки відновлюють 20 HP.', 'Аптечки выпадают каждые 75 убийств.': 'Аптечки випадають кожні 75 убивств.',
      '+1 HP каждые 2 секунды.': '+1 HP кожні 2 секунди.', 'Аптечки выпадают каждые 50 убийств.': 'Аптечки випадають кожні 50 убивств.',
      '% шанс критического удара. Крит наносит ×2 урона.': '% шанс критичного удару. Крит завдає ×2 шкоди.',
      'Пуля после попадания перескакивает ещё на ': 'Куля після влучання перескакує ще на ', ' врагов.': ' ворогів.',
      'Радиус сбора XP увеличен на ': 'Радіус збору XP збільшено на ',
      'Один раз за забег при HP ниже 25%: +30% скорости и поглощение урона на 10 сек.; за каждые 2 убийства в течение 5 сек. +1 HP.': 'Один раз за забіг при HP нижче 25%: +30% швидкості та поглинання шкоди на 10 с; за кожні 2 убивства протягом 5 с +1 HP.',
      'Раз в 10 сек. следующий выстрел вызывает взрыв. Урон взрыва: ': 'Раз на 10 с наступний постріл спричиняє вибух. Шкода вибуху: ',
      ' (временная базовая трактовка: +1 за уровень).': ' (тимчасова базова інтерпретація: +1 за рівень).',
      'Каждые 20 сек. полностью блокирует урон на ': 'Кожні 20 с повністю блокує шкоду на ',
      'За каждые 10 убийств восстанавливает 3 HP.': 'За кожні 10 убивств відновлює 3 HP.',
      'Помощник стреляет каждые 2 сек. Урон выстрела: ': 'Помічник стріляє кожні 2 с. Шкода пострілу: ',
      'Последний патрон обоймы: +150% урона, пронзает 5 врагов; затем срабатывает Рикошет, если он есть.': 'Останній патрон магазину: +150% шкоди, пробиває 5 ворогів; потім спрацьовує Рикошет, якщо він є.',
      'Каждые 10 сек. замедляет всех врагов на 20% на 3 сек.': 'Кожні 10 с сповільнює всіх ворогів на 20% на 3 с.',
      'Один раз за забег возрождает после смертельного удара с 25% максимального HP.': 'Один раз за забіг відроджує після смертельного удару з 25% максимального HP.',
      'Каждые 15 сек. отталкивает врагов; ': 'Кожні 15 с відштовхує ворогів; ', 'наносит 5 урона и отбрасывает дальше.': 'завдає 5 шкоди й відкидає далі.', 'без урона.': 'без шкоди.',
      'Награда за победу над Монструозной крысой — выбери одно': 'Нагорода за перемогу над Монструозним пацюком — обери одне',
      'Выбери одно улучшение — игра на паузе': 'Обери одне покращення — гру призупинено',
      'БЕСПЛАТНОЕ УЛУЧШЕНИЕ!': 'БЕЗКОШТОВНЕ ПОКРАЩЕННЯ!', 'НОВЫЙ УРОВЕНЬ!': 'НОВИЙ РІВЕНЬ!',
      'НАЖМИ ': 'НАТИСНИ ', ' ИЛИ КЛИКНИ': ' АБО НАТИСНИ', 'Все улучшения достигли максимального уровня.': 'Усі покращення досягли максимального рівня.',
      'Нажми Enter, чтобы продолжить.': 'Натисни Enter, щоб продовжити.',
      'УЛУЧШЕНИЕ ПОЛУЧЕНО!': 'ПОКРАЩЕННЯ ОТРИМАНО!', 'АЛХИМИК: ЯДОВИТОЕ ОБЛАКО!': 'АЛХІМІК: ОТРУЙНА ХМАРА!', 'ЗДОРОВЬЕ УЖЕ ПОЛНОЕ': 'ЗДОРОВ’Я ВЖЕ ПОВНЕ',
      'МЕДИК: ': 'МЕДИК: ', 'ИНЖЕНЕР: ТУРЕЛЬ УСТАНОВЛЕНА!': 'ІНЖЕНЕР: ТУРЕЛЬ ВСТАНОВЛЕНО!', 'РАЗВЕДЧИК: РЫВОК!': 'РОЗВІДНИК: РИВОК!',
      'БОСС №1: МОНСТРУОЗНАЯ КРЫСА': 'БОС №1: МОНСТРУОЗНИЙ ПАЦЮК', 'БОСС №2: ГОБЛИН-ПОДРЫВНИК': 'БОС №2: ГОБЛІН-ПІДРИВНИК', 'БОСС №3: КОРОЛЕВА ПАУКОВ': 'БОС №3: КОРОЛЕВА ПАВУКІВ',
      'КОРОЛЕВА ПАУКОВ': 'КОРОЛЕВА ПАВУКІВ', 'ПАУЧЬЕ ПОДЗЕМЕЛЬЕ': 'ПІДЗЕМЕЛЛЯ ПАВУКІВ',
      'ПОБЕДА НАД ГОБЛИНОМ — ИСЦЕЛЕНИЕ 50%': 'ПЕРЕМОГА НАД ГОБЛІНОМ — ЗЦІЛЕННЯ 50%', 'ПОБЕДА НАД КОРОЛЕВОЙ — ИСЦЕЛЕНИЕ 50%': 'ПЕРЕМОГА НАД КОРОЛЕВОЮ — ЗЦІЛЕННЯ 50%',
      'Передышка': 'Перепочинок', 'ПЕРЕДЫШКА': 'ПЕРЕПОЧИНОК', 'Восстанавливает 30 HP при выборе. Можно выбирать повторно без ограничения.': 'Відновлює 30 HP під час вибору. Можна обирати повторно без обмежень.',
      'ПАУТИНА! НЕ ЗАДЕРЖИВАЙСЯ В ЛИПКИЙ ЗОНЕ!': 'ПАВУТИНА! НЕ ЗАТРИМУЙСЯ В ЛИПКІЙ ЗОНІ!', 'КОРОЛЕВА ПРИЗЫВАЕТ ': 'КОРОЛЕВА КЛИЧЕ ', ' ПАУЧАТ!': ' ПАВУЧАТ!',
      'КОРОЛЕВА ПАУКОВ ВЫХОДИТ ИЗ ЯЙЦА! ФАЗА 2': 'КОРОЛЕВА ПАВУКІВ ВИХОДИТЬ З ЯЙЦЯ! ФАЗА 2', 'КОРОЛЕВА ПАУКОВ В ЯРОСТИ! ФАЗА 3': 'КОРОЛЕВА ПАВУКІВ У ЛЮТІ! ФАЗА 3',
      'ЯДОВИТЫЙ УКУС!': 'ОТРУЙНИЙ УКУС!', 'КОРОЛЕВА ПАУКОВ ПРЫГАЕТ! УДАРНАЯ ВОЛНА!': 'КОРОЛЕВА ПАВУКІВ СТРИБАЄ! УДАРНА ХВИЛЯ!',
      'МОНСТРУОЗНАЯ КРЫСА ПОВЕРЖЕНА!': 'МОНСТРУОЗНОГО ПАЦЮКА ПЕРЕМОЖЕНО!', 'ГОБЛИН ГЛОТАЕТ ДИНАМИТ...': 'ГОБЛІН КОВТАЄ ДИНАМІТ...',
      'Монструозная крыса': 'Монструозний пацюк', 'Гоблин-подрывник': 'Гоблін-підривник', 'МОНСТРУОЗНАЯ КРЫСА': 'МОНСТРУОЗНИЙ ПАЦЮК', 'ГОБЛИН-ПОДРЫВНИК': 'ГОБЛІН-ПІДРИВНИК',
      'ФИНАЛЬНАЯ МИНУТА ПРОЙДЕНА! ПОБЕДА!': 'ФІНАЛЬНУ ХВИЛИНУ ПРОЙДЕНО! ПЕРЕМОГА!',
      'НАГРАДА ЗА БОССА: БЕСПЛАТНОЕ УЛУЧШЕНИЕ': 'НАГОРОДА ЗА БОСА: БЕЗКОШТОВНЕ ПОКРАЩЕННЯ',
      'ГОБЛИН ПОВЕРЖЕН! ВЫЖИВИ ЕЩЁ 60 СЕКУНД': 'ГОБЛІНА ПЕРЕМОЖЕНО! ВИЖИВИ ЩЕ 60 СЕКУНД',
      'ЖИВОТНЫЙ КРИК! КРЫСА В ЯРОСТИ!': 'ЗВІРИНИЙ КРИК! ПАЦЮК У ЛЮТІ!', 'ФАЗА 3 — ЯРОСТЬ!': 'ФАЗА 3 — ЛЮТЬ!',
      'РАЗГРОМНОЕ ЭХО — СТРЕЛЬБА ЗАПРЕЩЕНА!': 'РУЙНІВНЕ ЕХО — СТРІЛЬБУ ЗАБОРОНЕНО!',
      'КРЫСА ПРИЗЫВАЕТ ': 'ПАЦЮК КЛИЧЕ ', ' МАЛЕНЬКИХ КРЫС!': ' МАЛИХ ЩУРІВ!',
      'ПОЯС ВЗРЫВАЕТСЯ — ОСКОЛКИ!': 'ПОЯС ВИБУХАЄ — УЛАМКИ!', 'ДИНАМИТ ВЗРЫВАЕТСЯ!': 'ДИНАМІТ ВИБУХАЄ!',
      'КРОВАВАЯ ЛУНА НАЧАЛАСЬ!': 'КРИВАВИЙ МІСЯЦЬ ПОЧАВСЯ!', 'КРОВАВАЯ ЛУНА ЗАКОНЧИЛАСЬ': 'КРИВАВИЙ МІСЯЦЬ ЗАКІНЧИВСЯ',
      'ВДОХ...': 'ВДИХ...', 'ФАЗА': 'ФАЗА',
      'НАВЫК': 'ЗДІБНІСТЬ', 'ДВИЖЕНИЕ': 'РУХ', 'ПРИЦЕЛ + ОГОНЬ': 'ЦІЛЬ + ВОГОНЬ',
      'ЗДОРОВЬЕ  ': 'ЗДОРОВ’Я  ', 'ПАТРОНЫ  ': 'НАБОЇ  ', 'ПЕРЕЗАРЯДКА  ': 'ПЕРЕЗАРЯДКА  ',
      'ВРЕМЯ  ': 'ЧАС  ', 'УБИЙСТВА ': 'УБИВСТВА ', '   ВСЕГО XP ': '   УСЬОГО XP ', 'ВРАГИ: ': 'ВОРОГИ: ',
      'АРЕНА БОССА': 'АРЕНА БОСА', 'КАНАЛИЗАЦИЯ': 'КАНАЛІЗАЦІЯ', 'ОБЫЧНАЯ АРЕНА': 'ЗВИЧАЙНА АРЕНА',
      ' БЛОКОВ': ' БЛОКІВ', 'БОССОВОЕ СРАЖЕНИЕ': 'БІЙ ІЗ БОСОМ', 'ПОДЗЕМНЫЙ УРОВЕНЬ': 'ПІДЗЕМНИЙ РІВЕНЬ',
      'ЗОМБИ • МЫШИ • СКЕЛЕТЫ': 'ЗОМБІ • КАЖАНИ • СКЕЛЕТИ', 'ФИНАЛЬНАЯ МИНУТА: ': 'ФІНАЛЬНА ХВИЛИНА: ',
      'КРОВАВАЯ ЛУНА: +15% МОБАМ': 'КРИВАВИЙ МІСЯЦЬ: +15% МОБАМ', 'ВЗРЫВНАЯ ПУЛЯ ГОТОВА': 'ВИБУХОВА КУЛЯ ГОТОВА',
      'ИМПУЛЬС Q/Й: ': 'ІМПУЛЬС Q: ', 'ГОТОВО': 'ГОТОВО', 'ЩИТ ': 'ЩИТ ', 'ПОГЛОЩЕНИЕ ': 'ПОГЛИНАННЯ ',
      'НЕУЯЗВИМОСТЬ ': 'НЕВРАЗЛИВІСТЬ ', 'WASD — движение   МЫШЬ — прицел   ЛКМ — выстрел   R — перезарядка   Q/Й — импульс   ESC — пауза': 'WASD — рух   МИША — приціл   ЛКМ — постріл   R — перезарядка   Q — імпульс   ESC — пауза',
      'Нажми ESC, чтобы продолжить': 'Натисни ESC, щоб продовжити', 'Ты прошёл все испытания и завершил забег!': 'Ти пройшов усі випробування та завершив забіг!',
      'Нажми ENTER, чтобы начать заново': 'Натисни ENTER, щоб почати знову', 'МОН.': 'МОН.', ' МИН.': ' ХВ.'
    }
  };

  // Final UI glossary: short fragments are used by dynamic stat/HUD values.
  // Keep these separate so the main dictionaries remain readable.
  Object.assign(UI_TRANSLATIONS.en, {
    'снаряд': 'projectile', 'блока': 'tiles', 'блоков': 'tiles',
    ' патронов': ' rounds', ' патронов.': ' rounds.',
    'ЗДОРОВЬЕ': 'HEALTH', 'ОБОЙМА': 'MAGAZINE', 'ДАЛЬНОСТЬ': 'RANGE',
    'СКОРОСТЬ': 'SPEED', 'УРОН': 'DAMAGE', 'ОРУЖИЕ': 'WEAPON', 'ОСОБЕННОСТЬ': 'SPECIAL',
    'ПАУЗА': 'PAUSED', 'ПЕРЕЗАРЯДКА': 'RELOAD', 'НАВЫК': 'ABILITY',
    'ДЖОЙСТИК ДВИЖЕНИЯ': 'MOVE STICK', 'ДЖОЙСТИК ПРИЦЕЛИВАНИЯ И СТРЕЛЬБЫ': 'AIM & FIRE STICK',
    'Энергетические кольца': 'Energy rings', 'ЭНЕРГЕТИЧЕСКИЕ КОЛЬЦА': 'ENERGY RINGS'
  });
  Object.assign(UI_TRANSLATIONS.uk, {
    'ПЕРЕДЫШКА: +': 'ПЕРЕПОЧИНОК: +', 'ПОБЕДА НАД ГОБЛИНОМ — ИСЦЕЛЕНИЕ 50%': 'ПЕРЕМОГА НАД ГОБЛІНОМ — ЗЦІЛЕННЯ 50%',
    'ПОБЕДА НАД КОРОЛЕВОЙ — ИСЦЕЛЕНИЕ 50%': 'ПЕРЕМОГА НАД КОРОЛЕВОЮ — ЗЦІЛЕННЯ 50%',
    'блока': 'блоків', 'блоков': 'блоків', 'снаряд': 'снаряд', 'УРОВЕНЬ': 'РІВЕНЬ', 'ЭЛЕКТРИК: ЭНЕРГЕТИЧЕСКИЕ КОЛЬЦА!': 'ЕЛЕКТРИК: ЕНЕРГЕТИЧНІ КІЛЬЦЯ!',
    'Закрытый персонаж': 'Закритий персонаж', 'Стартовый персонаж': 'Стартовий персонаж',
    'Энергетические кольца': 'Енергетичні кільця', 'ЭНЕРГЕТИЧЕСКИЕ КОЛЬЦА': 'ЕНЕРГЕТИЧНІ КІЛЬЦЯ'
  });

  function translateText(value) {
    let text = String(value);
    const dictionary = UI_TRANSLATIONS[currentLanguage];
    if (!dictionary) return text;
    const keys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    for (const key of keys) text = text.split(key).join(dictionary[key]);
    return text;
  }
  function localizeMarkup(markup) { return translateText(markup); }
  function saveControlMode(mode) {
    controlMode = mode;
    canvas.style.cursor = mode === 'pc' ? 'crosshair' : 'none';
    saveUiSettings();
    resetTouchInput();
  }
  function applyTouchControlLanguage() {
    const move = touchControls.querySelector('[data-stick="move"]');
    const aim = touchControls.querySelector('[data-stick="aim"]');
    const ability = touchControls.querySelector('[data-stick="ability"]');
    if (move) { move.setAttribute('aria-label', translateText('Джойстик движения')); move.querySelector('.rl-stick-label').textContent = translateText('ДВИЖЕНИЕ'); }
    if (aim) { aim.setAttribute('aria-label', translateText('Джойстик прицеливания и стрельбы')); aim.querySelector('.rl-stick-label').textContent = translateText('ПРИЦЕЛ + ОГОНЬ'); }
    if (ability) { ability.setAttribute('aria-label', translateText('Джойстик способности')); ability.querySelector('.rl-stick-label').textContent = translateText('НАВЫК'); }
    touchControls.querySelector('[data-touch-action="pause"]')?.setAttribute('aria-label', translateText('Пауза'));
    touchControls.querySelector('[data-touch-action="reload"]')?.setAttribute('aria-label', translateText('Перезарядка'));
    touchControls.querySelector('[data-touch-action="impulse"]')?.setAttribute('aria-label', translateText('Импульс'));
  }

  let paused = false;
  let dead = false;
  let lastTime = performance.now();
  let animationId = 0;
  let muzzleFlashTimer = 0;
  let damageFlashTimer = 0;
  let hitBannerTimer = 0;
  let lastDamageTaken = 0;
  let upgradeSelection = false;
  let upgradeChoices = [];
  let upgradeCardRects = [];
  let currentLevel = 1;
  let xpIntoLevel = 0;
  let xpForNextLevel = 20;
  let timeSlowTimer = 0;
  let timeSlowCooldown = 10;
  let energyShieldTimer = 0;
  let energyShieldCooldown = 20;
  let impulseCooldown = 0;
  let explosiveCooldown = 10;
  let explosiveReady = false;
  let ghostShotTimer = 2;
  let medicRegenTimer = 2;
  let lastChanceUsed = false;
  let lastChanceSpeedTimer = 0;
  let lastChanceShieldTimer = 0;
  let lastChanceHealTimer = 0;
  let lastChanceKillCounter = 0;
  let bootsBurstTimer = 0;
  let playerSilenceTimer = 0;
  let bossBannerTimer = 0;
  let bossBannerText = '';
  let bossRewardPending = false;
  let upgradeSelectionMode = 'level';
  let activeBoss = null;
  let activeArena = null;
  let sewerBiome = START_TIME_SECONDS >= 595 && START_TIME_SECONDS < 835;
  let spiderBiome = START_TIME_SECONDS >= 835;
  let firstBossDefeated = START_TIME_SECONDS >= 595;
  let secondBossDefeated = START_TIME_SECONDS >= 835;
  let spiderQueenDefeated = false;
  let boss1Spawned = START_TIME_SECONDS >= 300;
  let boss2Spawned = START_TIME_SECONDS >= 600;
  let boss3Spawned = START_TIME_SECONDS >= 840;
  let spiderWebSlowTimer = 0;
  let gameWon = false;
  let victoryTimer = 0;
  // After the Goblin is defeated, the player gets one final minute in the sewer before the run ends.
  let postGoblinSurvivalActive = false;
  let postGoblinSurvivalTimer = 0;
  let bootsBurstCooldown = 0;
  let nextVampirismKillAt = 10;
  let pointerInside = true;
  let elapsed = START_TIME_SECONDS;
  // Ordinary enemies gain 10% max/current HP at each full minute. Boss HP uses its separately approved fixed values.
  let enemyHpMultiplier = Math.pow(1.1, Math.floor(START_TIME_SECONDS / 60));
  let nextEnemyHpRampAt = (Math.floor(START_TIME_SECONDS / 60) + 1) * 60;
  let bloodMoonActive = (START_TIME_SECONDS >= 180 && START_TIME_SECONDS < 240) || (START_TIME_SECONDS >= 480 && START_TIME_SECONDS < 540);
  // Test builds start at the requested timestamp without replaying every earlier spawn.
  let spawnRateMultiplier = Math.pow(1.5, Math.floor(START_TIME_SECONDS / 45));
  let zombieSpawnAt = START_TIME_SECONDS + 2 / spawnRateMultiplier;
  let batSpawnAt = Math.max(60, Math.ceil((START_TIME_SECONDS + 1e-6) / 5) * 5);
  let skeletonHasSpawned = START_TIME_SECONDS >= 120;
  let skeletonSpawnAt = skeletonHasSpawned ? START_TIME_SECONDS + 2 / spawnRateMultiplier : 120;
  // Zombie and skeleton spawn rates increase by 50% multiplicatively every 45 seconds.
  let nextSpawnRampAt = (Math.floor(START_TIME_SECONDS / 45) + 1) * 45;
  let kills = 0;
  let totalXP = 0;
  let lastCoinMinuteAwarded = Math.floor(START_TIME_SECONDS / 60);
  let nextCoinKillMilestone = 10;
  let coinToastTimer = 0;
  let coinToastText = '';
  let nextMedkitAt = 100;

  const keys = Object.create(null);
  const mouse = { x: 0, y: 0 };
  const touchInput = {
    moveX: 0, moveY: 0, aimX: 0, aimY: 0,
    movePointerId: null, aimPointerId: null, abilityPointerId: null,
    aimActive: false, fireTimer: 0, fireInterval: 0.28,
    abilityX: 0, abilityY: 0, abilityActive: false
  };
  const touchStickElements = {};
  const bullets = [];
  const enemyBullets = [];
  const enemies = [];
  const medkits = [];
  const xpOrbs = [];
  const damageNumbers = [];
  const ghostProjectiles = [];
  const explosions = [];
  const bossProjectiles = [];
  const bossHazards = [];
  const classTurrets = [];
  const poisonClouds = [];
  const poisonPuddles = [];
  const lightningLinks = [];
  const electricWaveCast = { remaining: 0, timer: 0, x: 0, y: 0 };
  const electricWaves = []; // Three expanding circular pulses; each can hit each target once.

  const initialCharacter = CHARACTER_DEFINITIONS[selectedCharacterId];
  const player = {
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    angle: 0,
    characterId: selectedCharacterId,
    hp: initialCharacter.hp,
    maxHp: initialCharacter.hp,
    ammo: initialCharacter.magazine,
    maxAmmo: initialCharacter.magazine,
    reloading: false,
    reloadLeft: 0,
    baseSpeed: PLAYER_SPEED * initialCharacter.speedMultiplier,
    speed: PLAYER_SPEED * initialCharacter.speedMultiplier,
    speedMultiplier: 1,
    bulletDamage: initialCharacter.damage,
    baseBulletDamage: initialCharacter.damage,
    range: initialCharacter.range,
    pelletCount: initialCharacter.pellets,
    pelletSpread: initialCharacter.spread,
    weaponName: initialCharacter.weapon,
    classAbilityCooldown: 0,
    classAbilityCooldownMax: initialCharacter.abilityCooldown || 0,
    reloadDuration: RELOAD_SECONDS,
    pickupRadius: BASE_XP_PICKUP_RADIUS,
    damageReduction: 0,
    dodgeChance: 0,
    critChance: 0,
    ricochetLevel: 0,
    explosiveLevel: 0,
    ghostLevel: 0,
    impulseLevel: 0,
    energyShieldLevel: 0,
    timeSlowLevel: 0,
    phoenix: false,
    phoenixUsed: false,
    goldenBullet: false,
    lastChance: false,
    medkitHeal: 10,
    medkitInterval: 100,
    invulnerabilityTimer: 0,
    speedMultiplier: 1
  };

  function applySelectedCharacterBaseStats() {
    const definition = CHARACTER_DEFINITIONS[selectedCharacterId] || CHARACTER_DEFINITIONS.shooter;
    player.characterId = definition.id;
    player.baseSpeed = PLAYER_SPEED * definition.speedMultiplier;
    player.speedMultiplier = 1;
    player.speed = player.baseSpeed;
    player.hp = definition.hp;
    player.maxHp = definition.hp;
    player.ammo = definition.magazine;
    player.maxAmmo = definition.magazine;
    player.bulletDamage = definition.damage;
    player.baseBulletDamage = definition.damage;
    player.range = definition.range;
    player.pelletCount = definition.pellets;
    player.pelletSpread = definition.spread;
    player.weaponName = definition.weapon;
    player.classAbilityCooldown = 0;
    player.classAbilityCooldownMax = definition.abilityCooldown || 0;
    player.reloadDuration = RELOAD_SECONDS;
  }

  const worldPixels = MAP_SIZE * TILE;

  const upgradeDefinitions = [
    { id: 'heavyBullets', name: 'Тяжёлые пули', rarity: 'Обычное', max: 3,
      description: level => `+2 к урону выстрела за уровень. Сейчас: +${level * 2}.` },
    { id: 'bigPockets', name: 'Большие карманы', rarity: 'Обычное', max: 2,
      description: level => `+4 патрона к обойме за уровень. Сейчас: ${(CHARACTER_DEFINITIONS[selectedCharacterId]?.magazine || 10) + level * 4} патронов.` },
    { id: 'fastReload', name: 'Быстрая перезарядка', rarity: 'Обычное', max: 4,
      description: level => `−0,2 сек. перезарядки за уровень. Сейчас: ${(2.5 - level * 0.2).toFixed(1)} сек.` },
    { id: 'lightBoots', name: 'Лёгкие сапожки', rarity: 'Обычное', max: 4,
      description: level => `Скорость: ${[10,20,20,30][level-1]}%. С 3 уровня при получении урона: +40% скорости (перезарядка 5 сек.).` },
    { id: 'strongHealth', name: 'Крепкое здоровье', rarity: 'Обычное', max: 4,
      description: level => `+10 к максимальному HP за уровень. Сейчас: ${(CHARACTER_DEFINITIONS[selectedCharacterId]?.hp || 100) + level * 10} HP.` },
    { id: 'protection', name: 'Защита', rarity: 'Обычное', max: 5,
      description: level => `−5% получаемого урона за уровень. Сейчас: ${level * 5}%.` },
    { id: 'reinforcedArmor', name: 'Усиленная броня', rarity: 'Обычное', max: 5,
      description: level => `${level * 3}% шанс полностью избежать входящего урона.` },
    { id: 'breather', name: 'Передышка', rarity: 'Обычное', max: Infinity,
      description: () => 'Восстанавливает 30 HP при выборе. Можно выбирать повторно без ограничения.' },
    { id: 'medic', name: 'Медик', rarity: 'Редкое', max: 4,
      description: level => ['Аптечки восстанавливают 20 HP.', 'Аптечки выпадают каждые 75 убийств.', '+1 HP каждые 2 секунды.', 'Аптечки выпадают каждые 50 убийств.'][level-1] },
    { id: 'accuracy', name: 'Меткость', rarity: 'Редкое', max: 5,
      description: level => `+${level * 8}% шанс критического удара. Крит наносит ×2 урона.` },
    { id: 'ricochet', name: 'Рикошет', rarity: 'Редкое', max: 4,
      description: level => `Пуля после попадания перескакивает ещё на ${[1,2,3,5][level-1]} врагов.` },
    { id: 'magnet', name: 'Магнит', rarity: 'Редкое', max: 2,
      description: level => `Радиус сбора XP увеличен на ${level * 40}%.` },
    { id: 'lastChance', name: 'Последний шанс', rarity: 'Редкое', max: 1,
      description: () => `Один раз за забег при HP ниже 25%: +30% скорости и поглощение урона на 10 сек.; за каждые 2 убийства в течение 5 сек. +1 HP.` },
    { id: 'explosiveBullets', name: 'Взрывные пули', rarity: 'Эпическое', max: 3,
      description: level => `Раз в 10 сек. следующий выстрел вызывает взрыв. Урон взрыва: ${level} (временная базовая трактовка: +1 за уровень).` },
    { id: 'energyShield', name: 'Энергетический щит', rarity: 'Эпическое', max: 2,
      description: level => `Каждые 20 сек. полностью блокирует урон на ${level === 1 ? '1,5' : '2'} сек.` },
    { id: 'vampirism', name: 'Вампиризм', rarity: 'Эпическое', max: 1,
      description: () => `За каждые 10 убийств восстанавливает 3 HP.` },
    { id: 'ghostShooter', name: 'Призрачный стрелок', rarity: 'Эпическое', max: 3,
      description: level => `Помощник стреляет каждые 2 сек. Урон выстрела: ${5 + (level - 1) * 3}.` },
    { id: 'goldenBullet', name: 'Золотая пуля', rarity: 'Легендарное', max: 1,
      description: () => `Последний патрон обоймы: +150% урона, пронзает 5 врагов; затем срабатывает Рикошет, если он есть.` },
    { id: 'timeSlow', name: 'Замедление времени', rarity: 'Легендарное', max: 1,
      description: () => `Каждые 10 сек. замедляет всех врагов на 20% на 3 сек.` },
    { id: 'phoenix', name: 'Феникс', rarity: 'Легендарное', max: 1,
      description: () => `Один раз за забег возрождает после смертельного удара с 25% максимального HP.` },
    { id: 'impulse', name: 'Импульс', rarity: 'Легендарное', max: 2,
      description: level => `Каждые 15 сек. отталкивает врагов; ${level === 2 ? 'наносит 5 урона и отбрасывает дальше.' : 'без урона.'}` }
  ];

  const upgradeRarityColors = {
    'Обычное': '#aeb4bd',
    'Редкое': '#69a9e8',
    'Эпическое': '#bb83f4',
    'Легендарное': '#f0c56e'
  };

  function xpNeededForLevel(level) {
    const table = [20, 40, 70, 100, 140];
    return table[level - 1] ?? (140 + Math.max(0, level - 5) * 40);
  }

  function getUpgradeLevel(id) {
    return upgradeLevels[id] || 0;
  }

  const upgradeLevels = Object.create(null);
  let scoutStartingUpgradeIds = [];

  function availableUpgrades() {
    return upgradeDefinitions.filter(def =>
      getUpgradeLevel(def.id) < def.max && (def.id !== 'breather' || player.hp < player.maxHp)
    );
  }

  const upgradeRarityWeights = {
    'Обычное': 65,
    'Редкое': 25,
    'Эпическое': 9,
    'Легендарное': 1
  };

  function rollUpgradeChoices() {
    const pool = availableUpgrades().slice();
    const choices = [];

    // Draw three different upgrades. Each rarity keeps its weight while it has
    // available entries, so legendary cards are offered only about 1% per card.
    while (pool.length && choices.length < 3) {
      const groups = new Map();
      for (const def of pool) {
        if (!groups.has(def.rarity)) groups.set(def.rarity, []);
        groups.get(def.rarity).push(def);
      }

      let totalWeight = 0;
      for (const rarity of groups.keys()) totalWeight += upgradeRarityWeights[rarity] || 0;
      if (totalWeight <= 0) break;

      let roll = Math.random() * totalWeight;
      let selectedRarity = null;
      for (const [rarity] of groups) {
        roll -= upgradeRarityWeights[rarity] || 0;
        if (roll < 0) {
          selectedRarity = rarity;
          break;
        }
      }

      const group = groups.get(selectedRarity) || pool;
      const selected = group[Math.floor(Math.random() * group.length)];
      choices.push(selected);
      pool.splice(pool.indexOf(selected), 1);
    }
    return choices;
  }

  function beginLevelUpIfReady() {
    if (upgradeSelection || dead || xpIntoLevel < xpForNextLevel) return;
    xpIntoLevel -= xpForNextLevel;
    currentLevel += 1;
    xpForNextLevel = xpNeededForLevel(currentLevel);
    upgradeChoices = rollUpgradeChoices();
    upgradeCardRects = [];
    upgradeSelection = true;
    upgradeSelectionMode = 'level';
  }

  function addExperience(amount) {
    totalXP += amount;
    xpIntoLevel += amount;
    beginLevelUpIfReady();
  }

  function chooseUpgrade(index) {
    if (!upgradeSelection || !upgradeChoices[index]) return;
    const def = upgradeChoices[index];
    const nextLevel = getUpgradeLevel(def.id) + 1;
    upgradeLevels[def.id] = nextLevel;
    applyUpgrade(def.id, nextLevel);
    upgradeSelection = false;
    upgradeChoices = [];
    upgradeCardRects = [];
    if (upgradeSelectionMode === 'bossReward') {
      bossRewardPending = false;
      upgradeSelectionMode = 'level';
      announceBoss('УЛУЧШЕНИЕ ПОЛУЧЕНО!', 1.5);
    }
    beginLevelUpIfReady();
  }

  function applyUpgrade(id, level) {
    if (id === 'heavyBullets') player.bulletDamage += 2;
    if (id === 'bigPockets') { player.maxAmmo += 4; player.ammo += 4; }
    if (id === 'fastReload') player.reloadDuration = Math.max(0.5, player.reloadDuration - 0.2);
    if (id === 'lightBoots') {
      player.speedMultiplier = [1.10, 1.20, 1.20, 1.30][level - 1];
      player.speed = player.baseSpeed * player.speedMultiplier;
    }
    if (id === 'strongHealth') { player.maxHp += 10; player.hp = Math.min(player.maxHp, player.hp + 10); }
    if (id === 'protection') player.damageReduction = Math.min(0.25, player.damageReduction + 0.05);
    if (id === 'reinforcedArmor') player.dodgeChance = Math.min(0.15, player.dodgeChance + 0.03);
    if (id === 'breather') {
      const healed = Math.min(30, Math.max(0, player.maxHp - player.hp));
      player.hp += healed;
      if (healed > 0) damageNumbers.push({ x: player.x, y: player.y - 0.85, amount: healed, life: 0.9, maxLife: 0.9, heal: true });
      announceBoss(healed > 0 ? `ПЕРЕДЫШКА: +${healed} HP` : 'ЗДОРОВЬЕ УЖЕ ПОЛНОЕ', 1.2);
    }
    if (id === 'medic') {
      if (level === 1) player.medkitHeal = 20;
      if (level === 2) { player.medkitInterval = 75; nextMedkitAt = (Math.floor(kills / 75) + 1) * 75; }
      if (level === 3) medicRegenTimer = 2;
      if (level === 4) { player.medkitInterval = 50; nextMedkitAt = (Math.floor(kills / 50) + 1) * 50; }
    }
    if (id === 'accuracy') player.critChance = Math.min(0.40, player.critChance + 0.08);
    if (id === 'ricochet') player.ricochetLevel = level;
    if (id === 'magnet') player.pickupRadius = BASE_XP_PICKUP_RADIUS * (1 + 0.4 * level);
    if (id === 'lastChance') player.lastChance = true;
    if (id === 'explosiveBullets') { player.explosiveLevel = level; explosiveCooldown = 10; explosiveReady = false; }
    if (id === 'energyShield') { player.energyShieldLevel = level; energyShieldCooldown = 20; energyShieldTimer = 0; }
    if (id === 'vampirism') nextVampirismKillAt = kills + 10;
    if (id === 'ghostShooter') { player.ghostLevel = level; ghostShotTimer = 2; }
    if (id === 'goldenBullet') player.goldenBullet = true;
    if (id === 'timeSlow') { player.timeSlowLevel = 1; timeSlowCooldown = 10; timeSlowTimer = 0; }
    if (id === 'phoenix') player.phoenix = true;
    if (id === 'impulse') { player.impulseLevel = level; impulseCooldown = 0; }
  }

  function resize() {
    screenW = Math.max(320, window.innerWidth);
    screenH = Math.max(240, window.innerHeight);
    canvas.width = screenW;
    canvas.height = screenH;
    ctx.imageSmoothingEnabled = false;
    mouse.x = screenW / 2;
    mouse.y = screenH / 2;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function cameraPosition() {
    if (activeArena) {
      const arenaLeft = activeArena.x * TILE, arenaTop = activeArena.y * TILE;
      const arenaRight = (activeArena.x + activeArena.size) * TILE;
      const arenaBottom = (activeArena.y + activeArena.size) * TILE;
      const maxX = arenaRight - screenW, maxY = arenaBottom - screenH;
      const x = maxX < arenaLeft ? (arenaLeft + arenaRight - screenW) / 2 : clamp(player.x * TILE - screenW / 2, arenaLeft, maxX);
      const y = maxY < arenaTop ? (arenaTop + arenaBottom - screenH) / 2 : clamp(player.y * TILE - screenH / 2, arenaTop, maxY);
      return { x, y };
    }
    const maxX = Math.max(0, worldPixels - screenW);
    const maxY = Math.max(0, worldPixels - screenH);
    return { x: clamp(player.x * TILE - screenW / 2, 0, maxX), y: clamp(player.y * TILE - screenH / 2, 0, maxY) };
  }

  function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function randomSpawnPoint() {
    // Spawn enemies around the player, not directly on top of them.
    const angle = Math.random() * Math.PI * 2;
    const radius = 11 + Math.random() * 6;
    const minX = activeArena ? activeArena.x + 2 : 2;
    const minY = activeArena ? activeArena.y + 2 : 2;
    const maxX = activeArena ? activeArena.x + activeArena.size - 2 : MAP_SIZE - 2;
    const maxY = activeArena ? activeArena.y + activeArena.size - 2 : MAP_SIZE - 2;
    return { x: clamp(player.x + Math.cos(angle) * radius, minX, maxX), y: clamp(player.y + Math.sin(angle) * radius, minY, maxY) };
  }

  function createPixelSprite(draw) {
    const sprite = document.createElement('canvas');
    sprite.width = 16;
    sprite.height = 16;
    const p = sprite.getContext('2d');
    p.imageSmoothingEnabled = false;
    draw(p);
    return sprite;
  }

  function makePlayerSprite() {
    return createPixelSprite(p => {
      // Стрелок: силуэт ориентирован вправо, как на предоставленной игроком пиксельной модели.
      // При наведении на мышь весь 16×16 спрайт поворачивается вместе с оружием.
      const rows = [
        '................',
        '.....HHHH.......',
        '...HHHHHHH......',
        '..HHHHHHHHH.....',
        '.HHHHHHHHHHSS...',
        '.HHHHHHHHHSSS...',
        '.HHHHHHHHHTTBBGG',
        '.HHHHHHHPPDDGGGW',
        '.DDDDHHPPDDDGGG.',
        '.DDDDDDDPPDD....',
        '..DDDDDDDDDD....',
        '..DDDDDDDDDD....',
        '...DDDDDDDDD....',
        '...BB...BB......',
        '...BB...BB......',
        '................'
      ];
      const palette = {
        H: '#17141e', // тёмный капюшон
        D: '#272330', // плащ и одежда
        P: '#80609b', // фиолетовая полоса и детали
        S: '#c9ad9b', // лицо
        T: '#5c455f', // тёмная повязка/тень лица
        B: '#111319', // корпус ружья
        G: '#777781', // ствол
        W: '#b8b5c1'  // светлый кончик ствола
      };
      for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < rows[y].length; x++) {
          const key = rows[y][x];
          if (key !== '.') {
            p.fillStyle = palette[key];
            p.fillRect(x, y, 1, 1);
          }
        }
      }
      // Маленькие пиксели блика на лице и фиолетовой застёжке.
      p.fillStyle = '#ead2c0'; p.fillRect(11, 5, 1, 1);
      p.fillStyle = '#b48bd2'; p.fillRect(6, 8, 1, 1); p.fillRect(7, 9, 1, 1);
      p.fillStyle = '#34303c'; p.fillRect(4, 13, 2, 1); p.fillRect(8, 13, 2, 1);
    });
  }

  function makeHunterSprite() {
    return createPixelSprite(p => {
      // Top-down hunter: olive hood, dark leather coat and a wider shotgun muzzle.
      p.fillStyle = '#11130f'; p.fillRect(2, 3, 12, 12);
      p.fillStyle = '#51462f'; p.fillRect(3, 4, 10, 9);
      p.fillStyle = '#75633d'; p.fillRect(4, 5, 7, 7);
      p.fillStyle = '#9a8956'; p.fillRect(6, 4, 5, 3);
      p.fillStyle = '#27251d'; p.fillRect(5, 8, 6, 4);
      p.fillStyle = '#d0b99a'; p.fillRect(9, 6, 3, 3);
      p.fillStyle = '#282018'; p.fillRect(10, 7, 1, 1);
      p.fillStyle = '#17191a'; p.fillRect(11, 7, 5, 3);
      p.fillStyle = '#8a8a82'; p.fillRect(13, 6, 3, 1); p.fillRect(13, 10, 3, 1);
      p.fillStyle = '#c2bba7'; p.fillRect(15, 7, 1, 3);
      p.fillStyle = '#3a3024'; p.fillRect(3, 12, 3, 3); p.fillRect(9, 12, 3, 3);
      p.fillStyle = '#a08a5c'; p.fillRect(5, 11, 2, 1); p.fillRect(10, 11, 2, 1);
    });
  }

  function makeScoutSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#172018'; p.fillRect(2, 3, 12, 12);
      p.fillStyle = '#526a45'; p.fillRect(3, 4, 10, 9);
      p.fillStyle = '#859b62'; p.fillRect(5, 3, 7, 5);
      p.fillStyle = '#202a24'; p.fillRect(5, 8, 6, 5);
      p.fillStyle = '#d1b99b'; p.fillRect(8, 5, 4, 3);
      p.fillStyle = '#24272a'; p.fillRect(10, 6, 1, 1);
      p.fillStyle = '#8b9a78'; p.fillRect(3, 10, 3, 3); p.fillRect(11, 10, 3, 3);
      p.fillStyle = '#252326'; p.fillRect(10, 7, 6, 2);
      p.fillStyle = '#9b9da0'; p.fillRect(14, 7, 2, 2);
    });
  }

  function makeAlchemistSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#17221c'; p.fillRect(2, 3, 12, 12);
      p.fillStyle = '#405b42'; p.fillRect(3, 4, 10, 9);
      p.fillStyle = '#78905a'; p.fillRect(5, 3, 7, 5);
      p.fillStyle = '#29252b'; p.fillRect(5, 8, 6, 5);
      p.fillStyle = '#d2b99e'; p.fillRect(8, 5, 4, 3);
      p.fillStyle = '#29352a'; p.fillRect(10, 6, 1, 1);
      p.fillStyle = '#6bbd72'; p.fillRect(2, 10, 3, 3); p.fillRect(12, 10, 3, 3);
      p.fillStyle = '#8be08a'; p.fillRect(12, 3, 3, 4); p.fillStyle = '#d1f4a0'; p.fillRect(13, 2, 1, 2);
    });
  }

  function makeMedicSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#17191d'; p.fillRect(2, 3, 12, 12);
      p.fillStyle = '#59616a'; p.fillRect(3, 4, 10, 9);
      p.fillStyle = '#d2d4ce'; p.fillRect(5, 3, 7, 6);
      p.fillStyle = '#d6b99e'; p.fillRect(8, 5, 4, 3);
      p.fillStyle = '#342b31'; p.fillRect(5, 9, 6, 4);
      p.fillStyle = '#b84d58'; p.fillRect(5, 5, 1, 4); p.fillRect(4, 6, 3, 2);
      p.fillStyle = '#ededdf'; p.fillRect(6, 5, 1, 4); p.fillRect(5, 6, 3, 2);
      p.fillStyle = '#8395a3'; p.fillRect(2, 11, 3, 3); p.fillRect(12, 11, 3, 3);
    });
  }

  function makeEngineerSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#17191c'; p.fillRect(2, 3, 12, 12);
      p.fillStyle = '#454c50'; p.fillRect(3, 4, 10, 9);
      p.fillStyle = '#b28a43'; p.fillRect(4, 3, 8, 4);
      p.fillStyle = '#d1b99c'; p.fillRect(8, 5, 4, 3);
      p.fillStyle = '#252b2b'; p.fillRect(5, 8, 6, 5);
      p.fillStyle = '#d3a84f'; p.fillRect(3, 9, 3, 4); p.fillRect(11, 9, 3, 4);
      p.fillStyle = '#97a1a2'; p.fillRect(12, 2, 3, 4);
      p.fillStyle = '#e5ca72'; p.fillRect(13, 3, 1, 2);
    });
  }

  function makeElectricianSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#151a22'; p.fillRect(2, 3, 12, 12);
      p.fillStyle = '#394b5b'; p.fillRect(3, 4, 10, 9);
      p.fillStyle = '#577b91'; p.fillRect(5, 3, 7, 5);
      p.fillStyle = '#d3bea5'; p.fillRect(8, 5, 4, 3);
      p.fillStyle = '#242a36'; p.fillRect(5, 8, 6, 5);
      p.fillStyle = '#6ee5e3'; p.fillRect(5, 7, 2, 2); p.fillRect(11, 7, 2, 2);
      p.fillStyle = '#8cf8e8'; p.fillRect(13, 5, 3, 2); p.fillRect(14, 4, 1, 4);
      p.fillStyle = '#364e60'; p.fillRect(2, 11, 3, 3); p.fillRect(12, 11, 3, 3);
    });
  }

  function makeZombieSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#11110f'; p.fillRect(2, 3, 12, 11);
      p.fillStyle = '#3d5940'; p.fillRect(3, 3, 10, 10);
      p.fillStyle = '#66894f'; p.fillRect(4, 4, 8, 7);
      p.fillStyle = '#789b58'; p.fillRect(5, 4, 4, 2);
      p.fillStyle = '#26352c'; p.fillRect(4, 10, 8, 3);
      p.fillStyle = '#d9d0a2'; p.fillRect(6, 7, 2, 1); p.fillRect(10, 7, 2, 1);
      p.fillStyle = '#20201d'; p.fillRect(6, 7, 1, 1); p.fillRect(10, 7, 1, 1);
      p.fillStyle = '#6a3a3d'; p.fillRect(8, 9, 2, 1);
      p.fillStyle = '#495b45'; p.fillRect(1, 6, 3, 5); p.fillRect(12, 6, 3, 5);
      p.fillStyle = '#6e7651'; p.fillRect(2, 7, 2, 3); p.fillRect(12, 7, 2, 3);
      p.fillStyle = '#1b211d'; p.fillRect(4, 13, 3, 2); p.fillRect(9, 13, 3, 2);
    });
  }

  function makeBatSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#17131d';
      p.fillRect(1, 5, 4, 2); p.fillRect(3, 7, 3, 3); p.fillRect(5, 8, 2, 3);
      p.fillRect(11, 8, 2, 3); p.fillRect(10, 7, 3, 3); p.fillRect(11, 5, 4, 2);
      p.fillStyle = '#57415f';
      p.fillRect(1, 4, 4, 2); p.fillRect(3, 6, 4, 3); p.fillRect(5, 8, 2, 3);
      p.fillRect(11, 8, 2, 3); p.fillRect(9, 6, 4, 3); p.fillRect(11, 4, 4, 2);
      p.fillStyle = '#24202c'; p.fillRect(6, 5, 4, 7);
      p.fillStyle = '#77617f'; p.fillRect(7, 5, 2, 5);
      p.fillStyle = '#a84e58'; p.fillRect(6, 7, 1, 1); p.fillRect(9, 7, 1, 1);
      p.fillStyle = '#d6c4df'; p.fillRect(6, 4, 1, 2); p.fillRect(9, 4, 1, 2);
      p.fillStyle = '#17131d'; p.fillRect(7, 12, 1, 2); p.fillRect(9, 12, 1, 2);
    });
  }

  function makeSkeletonSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#17171b'; p.fillRect(3, 3, 10, 11);
      p.fillStyle = '#c8c3ae'; p.fillRect(4, 3, 8, 8);
      p.fillStyle = '#e0dbc6'; p.fillRect(5, 4, 6, 5);
      p.fillStyle = '#25242a'; p.fillRect(5, 6, 2, 2); p.fillRect(9, 6, 2, 2);
      p.fillStyle = '#7b6b62'; p.fillRect(7, 8, 2, 1);
      p.fillStyle = '#9e9788'; p.fillRect(5, 10, 6, 2);
      p.fillStyle = '#b9b19f'; p.fillRect(6, 12, 2, 2); p.fillRect(9, 12, 2, 2);
      p.fillStyle = '#6b4a30'; p.fillRect(12, 4, 1, 8); p.fillRect(13, 4, 1, 1);
      p.fillStyle = '#b28a56'; p.fillRect(11, 3, 1, 5); p.fillRect(12, 3, 1, 1);
      p.fillStyle = '#4a352c'; p.fillRect(12, 7, 2, 1);
    });
  }


  function makeRatlingSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#171216'; p.fillRect(2, 5, 12, 8);
      p.fillStyle = '#71616a'; p.fillRect(3, 5, 10, 7);
      p.fillStyle = '#8e7780'; p.fillRect(5, 4, 7, 6);
      p.fillStyle = '#c18d9b'; p.fillRect(4, 3, 2, 3); p.fillRect(10, 3, 2, 3);
      p.fillStyle = '#a94355'; p.fillRect(6, 6, 1, 1); p.fillRect(10, 6, 1, 1);
      p.fillStyle = '#24151d'; p.fillRect(7, 9, 2, 1);
      p.fillStyle = '#8a6672'; p.fillRect(1, 11, 4, 2); p.fillRect(12, 11, 3, 2);
      p.fillStyle = '#a77b86'; p.fillRect(11, 13, 4, 1); p.fillRect(14, 12, 1, 2);
    });
  }

  function makeRatBossSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#120f16'; p.fillRect(1, 2, 14, 13);
      p.fillStyle = '#4b3b46'; p.fillRect(2, 3, 12, 11);
      p.fillStyle = '#6c5360'; p.fillRect(3, 4, 10, 9);
      p.fillStyle = '#a27b88'; p.fillRect(4, 3, 3, 3); p.fillRect(10, 3, 3, 3);
      p.fillStyle = '#cc4757'; p.fillRect(5, 6, 2, 2); p.fillRect(10, 6, 2, 2);
      p.fillStyle = '#f08b91'; p.fillRect(5, 6, 1, 1); p.fillRect(10, 6, 1, 1);
      p.fillStyle = '#24141e'; p.fillRect(7, 9, 3, 2);
      p.fillStyle = '#d4c4c5'; p.fillRect(6, 10, 1, 2); p.fillRect(10, 10, 1, 2);
      p.fillStyle = '#32232d'; p.fillRect(2, 12, 3, 3); p.fillRect(11, 12, 3, 3);
      p.fillStyle = '#8c6b79'; p.fillRect(1, 14, 2, 1); p.fillRect(13, 14, 2, 1);
    });
  }

  function makeSpiderlingSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#17101d'; p.fillRect(3, 5, 10, 7);
      p.fillStyle = '#4d315f'; p.fillRect(4, 4, 8, 8);
      p.fillStyle = '#8052a0'; p.fillRect(5, 3, 6, 7);
      p.fillStyle = '#d5a1ed'; p.fillRect(5, 5, 2, 2); p.fillRect(9, 5, 2, 2);
      p.fillStyle = '#f6c7ff'; p.fillRect(6, 5, 1, 1); p.fillRect(10, 5, 1, 1);
      p.fillStyle = '#21172b';
      p.fillRect(1, 3, 3, 1); p.fillRect(0, 2, 2, 1); p.fillRect(12, 3, 3, 1); p.fillRect(14, 2, 2, 1);
      p.fillRect(1, 11, 3, 1); p.fillRect(0, 12, 2, 1); p.fillRect(12, 11, 3, 1); p.fillRect(14, 12, 2, 1);
      p.fillStyle = '#a56dc3'; p.fillRect(3, 13, 2, 1); p.fillRect(11, 13, 2, 1);
    });
  }

  function makeSpiderQueenBossSprite() {
    return createPixelSprite(p => {
      // Broad, top-down spider body with eight angular legs and a violet abdomen.
      p.fillStyle = '#120d18';
      p.fillRect(1, 3, 4, 2); p.fillRect(0, 2, 2, 2); p.fillRect(11, 3, 4, 2); p.fillRect(14, 2, 2, 2);
      p.fillRect(1, 11, 4, 2); p.fillRect(0, 12, 2, 2); p.fillRect(11, 11, 4, 2); p.fillRect(14, 12, 2, 2);
      p.fillRect(3, 1, 3, 2); p.fillRect(10, 1, 3, 2); p.fillRect(3, 13, 3, 2); p.fillRect(10, 13, 3, 2);
      p.fillStyle = '#38213f'; p.fillRect(3, 3, 10, 10);
      p.fillStyle = '#684078'; p.fillRect(4, 4, 8, 8);
      p.fillStyle = '#8c59a5'; p.fillRect(5, 5, 6, 6);
      p.fillStyle = '#bd83d3'; p.fillRect(6, 6, 4, 4);
      p.fillStyle = '#231329'; p.fillRect(5, 2, 6, 3);
      p.fillStyle = '#e54e75'; p.fillRect(5, 4, 2, 2); p.fillRect(9, 4, 2, 2);
      p.fillStyle = '#ffd1db'; p.fillRect(5, 4, 1, 1); p.fillRect(9, 4, 1, 1);
      p.fillStyle = '#25152d'; p.fillRect(7, 7, 2, 2);
      p.fillStyle = '#d8b0e6'; p.fillRect(7, 9, 2, 1);
      p.fillStyle = '#b67cca'; p.fillRect(7, 11, 2, 2);
    });
  }

  function makeGoblinBossSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#17130f'; p.fillRect(2, 2, 12, 13);
      p.fillStyle = '#49613a'; p.fillRect(3, 3, 10, 10);
      p.fillStyle = '#78944b'; p.fillRect(4, 4, 8, 7);
      p.fillStyle = '#9dbb60'; p.fillRect(5, 4, 5, 2);
      p.fillStyle = '#24301f'; p.fillRect(5, 7, 2, 2); p.fillRect(10, 7, 2, 2);
      p.fillStyle = '#e7bb4f'; p.fillRect(6, 7, 1, 1); p.fillRect(10, 7, 1, 1);
      p.fillStyle = '#733b28'; p.fillRect(7, 10, 3, 2);
      p.fillStyle = '#6b3426'; p.fillRect(2, 5, 3, 3); p.fillRect(11, 5, 3, 3);
      p.fillStyle = '#8a3c30'; p.fillRect(3, 12, 4, 3); p.fillRect(9, 12, 4, 3);
      p.fillStyle = '#d5a34b'; p.fillRect(4, 13, 2, 1); p.fillRect(10, 13, 2, 1);
      p.fillStyle = '#e2b05b'; p.fillRect(3, 2, 3, 2); p.fillRect(11, 2, 2, 2);
    });
  }

  function makeGhostSprite() {
    return createPixelSprite(p => {
      p.fillStyle = '#35284a'; p.fillRect(3, 3, 10, 11);
      p.fillStyle = '#9a78c7'; p.fillRect(4, 2, 8, 9);
      p.fillStyle = '#d8c1ff'; p.fillRect(5, 4, 2, 2); p.fillRect(9, 4, 2, 2);
      p.fillStyle = '#42305b'; p.fillRect(4, 10, 3, 4); p.fillRect(9, 10, 3, 4);
      p.fillStyle = '#b28be8'; p.fillRect(2, 6, 2, 4); p.fillRect(12, 6, 2, 4);
    });
  }

  function makeXpSprite() {
    return createPixelSprite(p => {
      // Small violet crystal with a bright center, readable against dark floors.
      p.fillStyle = '#21152f'; p.fillRect(5, 1, 6, 2);
      p.fillRect(3, 3, 10, 2); p.fillRect(2, 5, 12, 5);
      p.fillRect(4, 10, 8, 2); p.fillRect(6, 12, 4, 2);
      p.fillStyle = '#7545a6'; p.fillRect(5, 2, 6, 2);
      p.fillRect(3, 4, 10, 6); p.fillRect(5, 10, 6, 2);
      p.fillStyle = '#b88aff'; p.fillRect(5, 4, 3, 5);
      p.fillStyle = '#f0dcff'; p.fillRect(6, 5, 2, 3);
      p.fillStyle = '#d1a9ff'; p.fillRect(9, 7, 2, 2);
    });
  }

  const playerSprite = makePlayerSprite();
  const playerSprites = {
    shooter: playerSprite,
    hunter: makeHunterSprite(),
    scout: makeScoutSprite(),
    alchemist: makeAlchemistSprite(),
    medic: makeMedicSprite(),
    engineer: makeEngineerSprite(),
    electrician: makeElectricianSprite()
  };
  const enemySprites = {
    zombie: makeZombieSprite(),
    bat: makeBatSprite(),
    skeleton: makeSkeletonSprite()
  };
  const xpSprite = makeXpSprite();
  const ghostSprite = makeGhostSprite();
  const ratlingSprite = makeRatlingSprite();
  const spiderlingSprite = makeSpiderlingSprite();
  const bossSprites = { rat: makeRatBossSprite(), goblin: makeGoblinBossSprite(), spider: makeSpiderQueenBossSprite() };

  function scaledEnemyHp(baseHp) {
    return Math.max(1, Math.round(baseHp * enemyHpMultiplier));
  }

  function spawnEnemy(type) {
    if (enemies.length >= MAX_LIVE_ENEMIES || activeBoss) return;
    const point = randomSpawnPoint();
    const common = {
      id: Math.random().toString(36).slice(2),
      x: point.x,
      y: point.y,
      angle: 0,
      hitFlash: 0
    };

    if (type === 'zombie') {
      enemies.push({
        ...common, type, hp: scaledEnemyHp(12), maxHp: scaledEnemyHp(12), damage: 8,
        speed: PLAYER_SPEED * 0.80, xp: 5,
        attackInterval: 2.0, attackTimer: 1.0,
        attackRange: 0.92, radius: 0.42, sprite: enemySprites.zombie
      });
    } else if (type === 'bat') {
      enemies.push({
        ...common, type, hp: scaledEnemyHp(6), maxHp: scaledEnemyHp(6), damage: 5,
        speed: PLAYER_SPEED * 1.15, xp: 7,
        attackInterval: 1.5, attackTimer: 0.75,
        attackRange: 0.82, radius: 0.36, sprite: enemySprites.bat
      });
    } else if (type === 'skeleton') {
      enemies.push({
        ...common, type, hp: scaledEnemyHp(20), maxHp: scaledEnemyHp(20), damage: 10,
        speed: PLAYER_SPEED * 0.70, xp: 10,
        attackInterval: 2.5, attackTimer: 1.0 + Math.random() * 1.5,
        attackRange: 11.5, preferredDistance: 6.5,
        radius: 0.43, sprite: enemySprites.skeleton
      });
    } else if (type === 'ratling') {
      enemies.push({
        ...common, type, hp: scaledEnemyHp(6), maxHp: scaledEnemyHp(6), damage: 5,
        speed: PLAYER_SPEED * 1.15, xp: 7,
        attackInterval: 1.5, attackTimer: 0.75,
        attackRange: 0.82, radius: 0.34, sprite: ratlingSprite
      });
    }
  }

  function spawnRatlings(count, cx, cy) {
    for (let i = 0; i < count && enemies.length < MAX_LIVE_ENEMIES; i++) {
      const a = (Math.PI * 2 * i / count) + Math.random() * 0.35;
      const r = 2.1 + Math.random() * 0.7;
      const x = clamp(cx + Math.cos(a) * r, activeArena.x + 2, activeArena.x + activeArena.size - 2);
      const y = clamp(cy + Math.sin(a) * r, activeArena.y + 2, activeArena.y + activeArena.size - 2);
      enemies.push({ id: Math.random().toString(36).slice(2), type: 'ratling', x, y, angle: 0, hitFlash: 0, hp: scaledEnemyHp(6), maxHp: scaledEnemyHp(6), damage: 5, speed: PLAYER_SPEED * 1.15, xp: 7, attackInterval: 1.5, attackTimer: 0.7 + Math.random() * 0.7, attackRange: 0.82, radius: 0.34, sprite: ratlingSprite });
    }
  }

  function spawnSpiderlings(count, cx, cy) {
    for (let i = 0; i < count && enemies.length < MAX_LIVE_ENEMIES; i++) {
      const angle = (Math.PI * 2 * i / count) + Math.random() * 0.28;
      const radius = 2.0 + Math.random() * 0.8;
      const x = clamp(cx + Math.cos(angle) * radius, activeArena.x + 2, activeArena.x + activeArena.size - 2);
      const y = clamp(cy + Math.sin(angle) * radius, activeArena.y + 2, activeArena.y + activeArena.size - 2);
      const hp = scaledEnemyHp(8);
      enemies.push({ id: Math.random().toString(36).slice(2), type: 'spiderling', x, y, angle: 0, hitFlash: 0, hp, maxHp: hp,
        damage: 6, speed: PLAYER_SPEED * 1.2, xp: 5, attackInterval: 1.5, attackTimer: 0.5 + Math.random() * 0.8,
        attackRange: 0.82, radius: 0.32, sprite: spiderlingSprite });
    }
  }

  function spawnBatWave() {
    // Every full minute from 1:00, the 5-bat wave replaces that interval's normal 3-bat wave.
    const isMinuteWave = elapsed >= 60 && Math.abs(elapsed - Math.round(elapsed / 60) * 60) < 0.08;
    const count = isMinuteWave ? 5 : 3;
    for (let i = 0; i < count; i++) spawnEnemy('bat');
  }

  function startReload() {
    if (menuVisible || paused || player.reloading || player.ammo >= player.maxAmmo || dead || gameWon) return;
    player.reloading = true;
    player.reloadLeft = player.reloadDuration;
  }

  function shoot() {
    if (!running || menuVisible || paused || dead || gameWon || player.reloading || playerSilenceTimer > 0) return;
    if (player.ammo <= 0) {
      startReload();
      return;
    }

    const ammoBeforeShot = player.ammo;
    const pelletCount = Math.max(1, player.pelletCount || 1);
    const centerPellet = Math.floor(pelletCount / 2);
    const step = pelletCount > 1 ? player.pelletSpread / (pelletCount - 1) : 0;
    const muzzleDistance = pelletCount > 1 ? 0.68 : 0.58;
    const goldenShell = player.goldenBullet && ammoBeforeShot === 1;
    const explosiveShell = player.explosiveLevel > 0 && explosiveReady;

    for (let index = 0; index < pelletCount; index++) {
      const offset = pelletCount > 1 ? (index - centerPellet) * step : 0;
      const angle = player.angle + offset;
      const isCenterPellet = index === centerPellet;
      bullets.push({
        x: player.x + Math.cos(angle) * muzzleDistance,
        y: player.y + Math.sin(angle) * muzzleDistance,
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        damage: player.bulletDamage,
        projectileType: player.characterId === 'alchemist' ? 'flask' : (player.characterId === 'electrician' ? 'lightning' : (player.characterId === 'medic' ? 'medic' : 'bullet')),
        life: player.range / BULLET_SPEED + 0.04,
        maxDistance: player.range,
        travelled: 0,
        hitIds: [],
        ricochetsLeft: player.ricochetLevel,
        // Special shell effects are attached to the central pellet so a shotgun
        // shell does not create five simultaneous explosions or five golden chains.
        pierceLeft: goldenShell && isCenterPellet ? 5 : 0,
        golden: goldenShell && isCenterPellet,
        explosive: explosiveShell && isCenterPellet,
        ghost: false,
        poison: false,
        turretShot: false,
        chainDone: false,
        shotgunPellet: pelletCount > 1
      });
    }

    if (explosiveShell) {
      explosiveReady = false;
      explosiveCooldown = 10;
    }

    // A shotgun shell consumes one cartridge, even though it launches five pellets.
    player.ammo -= 1;
    muzzleFlashTimer = 0.075;
    if (player.ammo === 0) startReload();
  }

  function activateImpulse() {
    if (!player.impulseLevel || impulseCooldown > 0 || menuVisible || dead || paused || gameWon || upgradeSelection || playerSilenceTimer > 0) return;
    const range = player.impulseLevel === 1 ? 4 : 5;
    const push = player.impulseLevel === 1 ? 2.5 : 4.5;
    const minX = activeArena ? activeArena.x + 1.4 : 1.4;
    const minY = activeArena ? activeArena.y + 1.4 : 1.4;
    const maxX = activeArena ? activeArena.x + activeArena.size - 1.4 : MAP_SIZE - 1.4;
    const maxY = activeArena ? activeArena.y + activeArena.size - 1.4 : MAP_SIZE - 1.4;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const dx = enemy.x - player.x, dy = enemy.y - player.y;
      const d = Math.max(0.001, Math.hypot(dx, dy));
      if (d > range) continue;
      enemy.x = clamp(enemy.x + dx / d * push, minX, maxX);
      enemy.y = clamp(enemy.y + dy / d * push, minY, maxY);
      if (player.impulseLevel === 2) {
        enemy.hp -= 5;
        enemy.hitFlash = 0.16;
        damageNumbers.push({ x: enemy.x, y: enemy.y - 0.55, amount: 5, life: 0.65, maxLife: 0.65 });
      }
      if (enemy.hp <= 0) killEnemy(i);
    }
    impulseCooldown = 15;
    explosions.push({ x: player.x, y: player.y, life: 0.42, maxLife: 0.42, radius: range, kind: 'impulse' });
  }

  function damageScoutDashPath(x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1;
    const lengthSq = Math.max(0.0001, vx * vx + vy * vy);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const t = clamp(((enemy.x - x1) * vx + (enemy.y - y1) * vy) / lengthSq, 0, 1);
      const px = x1 + vx * t, py = y1 + vy * t;
      if (distance(enemy.x, enemy.y, px, py) > enemy.radius + 0.48) continue;
      enemy.hp -= 15;
      enemy.hitFlash = 0.18;
      damageNumbers.push({ x: enemy.x, y: enemy.y - 0.55, amount: 15, life: 0.72, maxLife: 0.72 });
      if (enemy.hp <= 0) killEnemy(i);
    }
    if (activeBoss && activeBoss.defeatTimer <= 0) {
      const bossRadius = bossCollisionRadius(activeBoss);
      const t = clamp(((activeBoss.x - x1) * vx + (activeBoss.y - y1) * vy) / lengthSq, 0, 1);
      const px = x1 + vx * t, py = y1 + vy * t;
      if (distance(activeBoss.x, activeBoss.y, px, py) <= bossRadius + 0.48) {
        activeBoss.hp = Math.max(0, activeBoss.hp - 15);
        activeBoss.flash = 0.18;
        damageNumbers.push({ x: activeBoss.x, y: activeBoss.y - 1.6, amount: 15, life: 0.72, maxLife: 0.72 });
        if (activeBoss.hp <= 0) beginBossDefeat();
      }
    }
  }

  function activateCharacterAbility() {
    const definition = CHARACTER_DEFINITIONS[player.characterId] || CHARACTER_DEFINITIONS.shooter;
    if (!definition.activeAbility || player.classAbilityCooldown > 0 || menuVisible || paused || dead || gameWon || upgradeSelection || playerSilenceTimer > 0) return;

    if (definition.activeAbility === 'electricRings') {
      // Three expanding radial energy rings originate at the player and reach 8 tiles.
      // Each ring deals 20 damage once to every enemy or boss it touches; no ammo is consumed.
      electricWaveCast.remaining = 3;
      electricWaveCast.timer = 0;
      electricWaveCast.x = player.x;
      electricWaveCast.y = player.y;
      explosions.push({ x: player.x, y: player.y, life: 0.34, maxLife: 0.34, radius: 1.2, kind: 'electric' });
      announceBoss('ЭЛЕКТРИК: ЭНЕРГЕТИЧЕСКИЕ КОЛЬЦА!', 1.3);
    } else if (definition.activeAbility === 'poisonCloud') {
      const cloudDistance = 4.0;
      const minX = activeArena ? activeArena.x + 2 : 2;
      const minY = activeArena ? activeArena.y + 2 : 2;
      const maxX = activeArena ? activeArena.x + activeArena.size - 2 : MAP_SIZE - 2;
      const maxY = activeArena ? activeArena.y + activeArena.size - 2 : MAP_SIZE - 2;
      const x = clamp(player.x + Math.cos(player.angle) * cloudDistance, minX, maxX);
      const y = clamp(player.y + Math.sin(player.angle) * cloudDistance, minY, maxY);
      poisonClouds.push({ x, y, radius: 2.15, life: 4, maxLife: 4, tick: 0.25 });
      explosions.push({ x, y, life: 0.32, maxLife: 0.32, radius: 2.15, kind: 'poison' });
      announceBoss('АЛХИМИК: ЯДОВИТОЕ ОБЛАКО!', 1.2);
    } else if (definition.activeAbility === 'heal') {
      const healed = Math.min(20, player.maxHp - player.hp);
      if (healed <= 0) {
        announceBoss('ЗДОРОВЬЕ УЖЕ ПОЛНОЕ', 1.0);
        return;
      }
      player.hp += healed;
      damageNumbers.push({ x: player.x, y: player.y - 0.85, amount: healed, life: 0.9, maxLife: 0.9, heal: true });
      announceBoss(`МЕДИК: +${healed} HP`, 1.2);
    } else if (definition.activeAbility === 'turret') {
      const x = clamp(player.x + Math.cos(player.angle) * 1.35, activeArena ? activeArena.x + 2 : 2, activeArena ? activeArena.x + activeArena.size - 2 : MAP_SIZE - 2);
      const y = clamp(player.y + Math.sin(player.angle) * 1.35, activeArena ? activeArena.y + 2 : 2, activeArena ? activeArena.y + activeArena.size - 2 : MAP_SIZE - 2);
      classTurrets.push({ x, y, life: 8, maxLife: 8, fireTimer: 0.2, range: 11, angle: player.angle });
      announceBoss('ИНЖЕНЕР: ТУРЕЛЬ УСТАНОВЛЕНА!', 1.2);
    } else if (definition.activeAbility === 'dash') {
      let dx = 0, dy = 0;
      if (keys.w || keys.arrowup) dy -= 1;
      if (keys.s || keys.arrowdown) dy += 1;
      if (keys.a || keys.arrowleft) dx -= 1;
      if (keys.d || keys.arrowright) dx += 1;
      if (controlMode === 'mobile') { dx += touchInput.moveX; dy += touchInput.moveY; }
      let length = Math.hypot(dx, dy);
      if (length < 0.12) { dx = Math.cos(player.angle); dy = Math.sin(player.angle); length = 1; }
      dx /= length; dy /= length;
      const oldX = player.x, oldY = player.y;
      if (activeArena) {
        player.x = bossArenaClampX(player.x + dx * 4.5, 1.6);
        player.y = bossArenaClampY(player.y + dy * 4.5, 1.6);
      } else {
        player.x = clamp(player.x + dx * 4.5, 1.6, MAP_SIZE - 1.6);
        player.y = clamp(player.y + dy * 4.5, 1.6, MAP_SIZE - 1.6);
      }
      damageScoutDashPath(oldX, oldY, player.x, player.y);
      explosions.push({ x: oldX, y: oldY, life: 0.3, maxLife: 0.3, radius: 1.3, kind: 'dash' });
      explosions.push({ x: player.x, y: player.y, life: 0.3, maxLife: 0.3, radius: 1.3, kind: 'dash' });
      announceBoss('РАЗВЕДЧИК: РЫВОК!', 0.8);
    }

    player.classAbilityCooldown = definition.abilityCooldown || 0;
    syncTouchControlsVisibility();
  }

  function onTouchControlClick(event) {
    const button = event.target && event.target.closest ? event.target.closest('button[data-touch-action]') : null;
    if (!button || menuVisible || dead || gameWon || upgradeSelection) return;
    const action = button.dataset.touchAction;
    if (action === 'pause') {
      paused = true;
      uiOverlayMode = '';
      updateUiOverlay();
    } else if (action === 'reload') {
      startReload();
    } else if (action === 'impulse') {
      activateImpulse();
    }
  }

  function resetStickVisual(side) {
    const item = touchStickElements[side];
    if (!item) return;
    item.knob.style.transform = 'translate(0px, 0px)';
  }

  function resetTouchInput() {
    touchInput.moveX = 0; touchInput.moveY = 0;
    touchInput.aimX = 0; touchInput.aimY = 0;
    touchInput.abilityX = 0; touchInput.abilityY = 0; touchInput.abilityActive = false;
    touchInput.movePointerId = null; touchInput.aimPointerId = null; touchInput.abilityPointerId = null;
    touchInput.aimActive = false; touchInput.fireTimer = 0;
    resetStickVisual('move'); resetStickVisual('aim'); resetStickVisual('ability');
    syncTouchControlsVisibility();
  }

  function syncTouchControlsVisibility() {
    if (!touchControls) return;
    const visible = controlMode === 'mobile' && !menuVisible && !paused && !dead && !gameWon && !upgradeSelection;
    touchControls.style.display = visible ? 'block' : 'none';
    touchControls.style.pointerEvents = 'none';
    const impulseButton = touchControls.querySelector('[data-touch-action="impulse"]');
    if (impulseButton) impulseButton.style.display = player.impulseLevel > 0 ? 'inline-flex' : 'none';
    const selectedDefinition = CHARACTER_DEFINITIONS[player.characterId] || CHARACTER_DEFINITIONS.shooter;
    const abilityStick = touchControls.querySelector('[data-stick="ability"]');
    if (abilityStick) {
      const hasAbility = Boolean(selectedDefinition.activeAbility);
      abilityStick.style.display = hasAbility ? 'flex' : 'none';
      abilityStick.style.opacity = player.classAbilityCooldown > 0 ? '0.58' : '1';
      const label = abilityStick.querySelector('.rl-stick-label');
      if (label) label.textContent = player.classAbilityCooldown > 0 ? `${Math.ceil(player.classAbilityCooldown)}${currentLanguage === 'en' ? 's' : currentLanguage === 'uk' ? 'с' : 'с'}` : translateText('НАВЫК');
    }
    if (!visible && (touchInput.movePointerId !== null || touchInput.aimPointerId !== null || touchInput.abilityPointerId !== null)) resetTouchInput();
  }

  function updateStickFromPointer(side, event) {
    const item = touchStickElements[side];
    if (!item) return;
    const rect = item.pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x = (event.clientX - cx) / (rect.width * 0.36);
    let y = (event.clientY - cy) / (rect.height * 0.36);
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    const deadzone = 0.13;
    if (Math.hypot(x, y) < deadzone) x = y = 0;
    const knobTravel = side === 'ability' ? rect.width * 0.23 : rect.width * 0.25;
    item.knob.style.transform = `translate(${x * knobTravel}px, ${y * knobTravel}px)`;
    if (side === 'move') {
      touchInput.moveX = x;
      touchInput.moveY = y;
    } else if (side === 'aim') {
      touchInput.aimX = x;
      touchInput.aimY = y;
      touchInput.aimActive = Math.hypot(x, y) > 0.05;
      if (touchInput.aimActive) {
        player.angle = Math.atan2(y, x);
        mouse.x = screenW / 2 + x * 100;
        mouse.y = screenH / 2 + y * 100;
        pointerInside = false;
      }
    } else if (side === 'ability') {
      touchInput.abilityX = x;
      touchInput.abilityY = y;
      touchInput.abilityActive = Math.hypot(x, y) > 0.05;
      // The mini skill stick also sets the direction for aimed abilities (cloud, turret, dash).
      if (touchInput.abilityActive) player.angle = Math.atan2(y, x);
    }
  }

  function setupTouchSticks() {
    for (const pad of touchControls.querySelectorAll('.rl-stick')) {
      const side = pad.dataset.stick;
      const knob = pad.querySelector('.rl-stick-knob');
      touchStickElements[side] = { pad, knob };
      const getOwnedPointer = () => side === 'move' ? touchInput.movePointerId : side === 'aim' ? touchInput.aimPointerId : touchInput.abilityPointerId;
      pad.addEventListener('pointerdown', event => {
        if (controlMode !== 'mobile' || menuVisible || paused || dead || gameWon || upgradeSelection) return;
        event.preventDefault();
        event.stopPropagation();
        if (side === 'move') {
          if (touchInput.movePointerId !== null) return;
          touchInput.movePointerId = event.pointerId;
        } else if (side === 'aim') {
          if (touchInput.aimPointerId !== null) return;
          touchInput.aimPointerId = event.pointerId;
          touchInput.fireTimer = 0;
        } else {
          if (touchInput.abilityPointerId !== null) return;
          touchInput.abilityPointerId = event.pointerId;
        }
        try { pad.setPointerCapture(event.pointerId); } catch (_) {}
        updateStickFromPointer(side, event);
        if (side === 'aim' && touchInput.aimActive) {
          shoot();
          touchInput.fireTimer = touchInput.fireInterval;
        }
      });
      pad.addEventListener('pointermove', event => {
        if (getOwnedPointer() !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        updateStickFromPointer(side, event);
      });
      const end = event => {
        if (getOwnedPointer() !== event.pointerId) return;
        event.preventDefault();
        if (side === 'move') {
          touchInput.movePointerId = null; touchInput.moveX = 0; touchInput.moveY = 0;
        } else if (side === 'aim') {
          touchInput.aimPointerId = null; touchInput.aimX = 0; touchInput.aimY = 0;
          touchInput.aimActive = false; touchInput.fireTimer = 0;
        } else {
          // A tap activates the class skill; dragging first aims it in the chosen direction.
          touchInput.abilityPointerId = null;
          if (touchInput.abilityActive) player.angle = Math.atan2(touchInput.abilityY, touchInput.abilityX);
          touchInput.abilityX = 0; touchInput.abilityY = 0; touchInput.abilityActive = false;
          activateCharacterAbility();
        }
        resetStickVisual(side);
      };
      pad.addEventListener('pointerup', end);
      pad.addEventListener('pointercancel', end);
      pad.addEventListener('lostpointercapture', end);
    }
  }

  function onPointerMove(event) {
    if (controlMode === 'mobile' && !upgradeSelection) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    pointerInside = true;
  }

  function onPointerLeave() {
    pointerInside = false;
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    if (controlMode !== 'mobile' || upgradeSelection) onPointerMove(event);
    canvas.focus();
    if (menuVisible || paused || dead || gameWon) return;
    if (upgradeSelection) {
      for (let i = 0; i < upgradeCardRects.length; i++) {
        const r = upgradeCardRects[i];
        if (r && mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) {
          chooseUpgrade(i);
          return;
        }
      }
      return;
    }
    if (controlMode === 'mobile') {
      // A tap directly on the playfield aims toward the tap and fires once.
      // Touches on the two virtual sticks/buttons are handled by their own elements.
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
      const camera = cameraPosition();
      const playerScreenX = player.x * TILE - camera.x;
      const playerScreenY = player.y * TILE - camera.y;
      const dx = mouse.x - playerScreenX;
      const dy = mouse.y - playerScreenY;
      if (Math.hypot(dx, dy) > 4) player.angle = Math.atan2(dy, dx);
      pointerInside = false;
      shoot();
      return;
    }
    updatePlayerAim();
    shoot();
  }

  function normalizedKey(event) {
    // event.code identifies the physical key, so WASD works in English and Russian layouts.
    const byCode = {
      KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyR: 'r', KeyQ: 'q', KeyE: 'e',
      ArrowUp: 'arrowup', ArrowDown: 'arrowdown',
      ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
      Space: ' ', Escape: 'escape', Enter: 'enter', Digit1: '1', Digit2: '2', Digit3: '3', Numpad1: '1', Numpad2: '2', Numpad3: '3'
    };
    if (byCode[event.code]) return byCode[event.code];

    // Fallback for browsers/keyboards that don't provide event.code.
    const byCharacter = {
      'ц': 'w', 'ф': 'a', 'ы': 's', 'в': 'd', 'к': 'r', 'й': 'q', 'у': 'e'
    };
    const character = String(event.key || '').toLowerCase();
    return byCharacter[character] || character;
  }

  function onKeyDown(event) {
    const key = normalizedKey(event);
    if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
    }
    keys[key] = true;

    if (menuVisible) {
      if (key === 'escape' && !event.repeat && ['upgrades', 'settings', 'characters'].includes(menuPage)) { menuPage = 'main'; uiOverlayMode = ''; updateUiOverlay(); }
      return;
    }
    if (upgradeSelection && ['1', '2', '3'].includes(key) && !event.repeat) chooseUpgrade(Number(key) - 1);
    if (key === 'r' && !event.repeat) startReload();
    if (key === 'q' && !event.repeat) activateImpulse();
    if (key === 'e' && !event.repeat) activateCharacterAbility();
    if (key === 'escape' && !event.repeat && !dead && !gameWon && !upgradeSelection) { paused = !paused; uiOverlayMode = ''; updateUiOverlay(); }
    if (key === 'enter' && (dead || gameWon) && !event.repeat) startNewRunFromMenu();
    if (key === 'enter' && upgradeSelection && upgradeChoices.length === 0 && !event.repeat) { upgradeSelection = false; beginLevelUpIfReady(); }
  }

  function onKeyUp(event) {
    keys[normalizedKey(event)] = false;
  }

  function onBlur() {
    for (const key of Object.keys(keys)) keys[key] = false;
    resetTouchInput();
  }

  function updatePlayerAim() {
    if (controlMode === 'mobile' && touchInput.aimActive) {
      player.angle = Math.atan2(touchInput.aimY, touchInput.aimX);
      return;
    }
    if (controlMode === 'mobile') return;
    const camera = cameraPosition();
    const mouseWorldX = (mouse.x + camera.x) / TILE;
    const mouseWorldY = (mouse.y + camera.y) / TILE;
    player.angle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
  }

  function pointSegmentDistance(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay;
    const wx = px - ax, wy = py - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 <= 1e-9 ? 0 : clamp((wx * vx + wy * vy) / len2, 0, 1);
    return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
  }

  function randomInterval(min, max) { return min + Math.random() * (max - min); }

  function bossArenaClampX(x, margin = 1.5) {
    return clamp(x, activeArena.x + margin, activeArena.x + activeArena.size - margin);
  }
  function bossArenaClampY(y, margin = 1.5) {
    return clamp(y, activeArena.y + margin, activeArena.y + activeArena.size - margin);
  }

  function announceBoss(text, seconds = 2.2) {
    bossBannerText = text;
    bossBannerTimer = seconds;
  }

  function bossCollisionRadius(boss) {
    if (!boss) return 1.0;
    if (boss.kind === 'rat') return 1.65;
    if (boss.kind === 'spider') return 1.5;
    return 1.05;
  }

  function healAfterBossVictory(label) {
    const before = player.hp;
    const healAmount = Math.ceil(player.maxHp * 0.5);
    player.hp = Math.min(player.maxHp, player.hp + healAmount);
    const healed = Math.max(0, Math.round(player.hp - before));
    if (healed > 0) damageNumbers.push({ x: player.x, y: player.y - 0.9, amount: healed, life: 1.0, maxLife: 1.0, heal: true });
    announceBoss(`${label}: +${healed} HP`, 3.0);
  }

  function initializeBoss(kind) {
    const common = { id: `boss-${kind}`, kind, x: BOSS_ARENA.x + BOSS_ARENA.size / 2, y: BOSS_ARENA.y + BOSS_ARENA.size / 2, angle: Math.PI / 2, introTimer: 1.8, defeatTimer: 0 };
    if (kind === 'rat') {
      return { ...common, name: 'МОНСТРУОЗНАЯ КРЫСА', hp: 1000, maxHp: 1000, phase: 1, speed: 2.45, dashCooldown: 4.5, dashTimer: 0, dashVX: 0, dashVY: 0, dashHit: false, clawCooldown: 1.0, echoCooldown: randomInterval(4, 8), echoTimer: 0, summonCooldown: randomInterval(5, 10), raged: false, animalCryTimer: 0, animalCryDone: false, lastPhase: 1, flash: 0 };
    }
    if (kind === 'spider') {
      return { ...common, name: 'КОРОЛЕВА ПАУКОВ', hp: 1200, maxHp: 1200, phase: 1, speed: 2.25,
        biteCooldown: 1.0, webCooldown: 5.0, summonCooldown: 10.0, leapCooldown: 8.0,
        action: '', actionTimer: 0, leapStartX: 0, leapStartY: 0, leapTargetX: 0, leapTargetY: 0, leapDamage: 15, flash: 0 };
    }
    return { ...common, name: 'ГОБЛИН-ПОДРЫВНИК', hp: 800, maxHp: 800, phase: 1, speed: 2.6, dynamiteCooldown: goblinCooldown(6, 1), pyroCooldown: goblinCooldown(12, 1), rushCooldown: goblinCooldown(20, 1), hookCooldown: goblinCooldown(12, 1), action: '', actionTimer: 0, pyroAngle: 0, pyroHit: false, rushVX: 0, rushVY: 0, rushDistance: 0, hookPullTimer: 0, hookSlapPending: false, hookSlapDamage: goblinDamage(5), beltExploded: false, orbitDirection: 1, flash: 0 };
  }

  function startBossEncounter(kind) {
    if (activeBoss || gameWon || dead) return;
    // All enemies outside the boss arena are removed without XP or kill credit.
    enemies.length = 0;
    enemyBullets.length = 0;
    bullets.length = 0;
    xpOrbs.length = 0;
    medkits.length = 0;
    bossProjectiles.length = 0;
    bossHazards.length = 0;
    activeArena = { ...BOSS_ARENA };
    if (kind === 'spider') { spiderBiome = true; sewerBiome = false; }
    else { sewerBiome = true; spiderBiome = false; }
    player.x = activeArena.x + activeArena.size / 2;
    player.y = activeArena.y + activeArena.size - 6;
    player.angle = -Math.PI / 2;
    activeBoss = initializeBoss(kind);
    playerSilenceTimer = 0;
    const intro = kind === 'rat' ? 'БОСС №1: МОНСТРУОЗНАЯ КРЫСА' : kind === 'goblin' ? 'БОСС №2: ГОБЛИН-ПОДРЫВНИК' : 'БОСС №3: КОРОЛЕВА ПАУКОВ';
    announceBoss(intro, 3.0);
  }

  function checkBossSchedule() {
    if (!activeBoss && !boss1Spawned && elapsed >= 300) {
      boss1Spawned = true;
      startBossEncounter('rat');
    } else if (!activeBoss && firstBossDefeated && !boss2Spawned && elapsed >= 600) {
      boss2Spawned = true;
      startBossEncounter('goblin');
    } else if (!activeBoss && secondBossDefeated && !boss3Spawned && elapsed >= 840) {
      boss3Spawned = true;
      startBossEncounter('spider');
    }
  }

  function rescheduleSpawnsAfterBoss() {
    spawnRateMultiplier = Math.pow(1.5, Math.floor(elapsed / 45));
    nextSpawnRampAt = (Math.floor(elapsed / 45) + 1) * 45;
    const interval = 2 / spawnRateMultiplier;
    zombieSpawnAt = elapsed + interval;
    if (skeletonHasSpawned) skeletonSpawnAt = elapsed + interval;
    batSpawnAt = Math.max(batSpawnAt, Math.ceil((elapsed + 1e-6) / 5) * 5);
  }

  function beginBossDefeat() {
    if (!activeBoss || activeBoss.defeatTimer > 0) return;
    activeBoss.hp = 0;
    activeBoss.defeatTimer = activeBoss.kind === 'rat' ? 1.5 : activeBoss.kind === 'goblin' ? 2.6 : 2.2;
    bossProjectiles.length = 0;
    bossHazards.length = 0;
    enemies.length = 0;
    enemyBullets.length = 0;
    const defeatedText = activeBoss.kind === 'rat' ? 'МОНСТРУОЗНАЯ КРЫСА ПОВЕРЖЕНА!' : activeBoss.kind === 'goblin' ? 'ГОБЛИН ГЛОТАЕТ ДИНАМИТ...' : 'КОРОЛЕВА ПАУКОВ ПОВЕРЖЕНА!';
    announceBoss(defeatedText, 2.5);
  }

  function finishRatBoss() {
    activeBoss = null;
    activeArena = null;
    firstBossDefeated = true;
    sewerBiome = true;
    player.x = MAP_SIZE / 2;
    player.y = MAP_SIZE / 2;
    bossProjectiles.length = 0;
    bossHazards.length = 0;
    rescheduleSpawnsAfterBoss();
    upgradeChoices = rollUpgradeChoices();
    upgradeCardRects = [];
    if (upgradeChoices.length) {
      upgradeSelection = true;
      upgradeSelectionMode = 'bossReward';
      bossRewardPending = true;
      announceBoss('НАГРАДА ЗА БОССА: БЕСПЛАТНОЕ УЛУЧШЕНИЕ', 3);
    } else {
      bossRewardPending = false;
      upgradeSelectionMode = 'level';
    }
  }

  function finishGoblinBoss() {
    activeBoss = null;
    activeArena = null;
    bossProjectiles.length = 0;
    bossHazards.length = 0;
    enemies.length = 0;
    enemyBullets.length = 0;
    secondBossDefeated = true;
    postGoblinSurvivalActive = false;
    postGoblinSurvivalTimer = 0;
    rescheduleSpawnsAfterBoss();
    healAfterBossVictory('ПОБЕДА НАД ГОБЛИНОМ — ИСЦЕЛЕНИЕ 50%');
  }

  function finishSpiderBoss() {
    activeBoss = null;
    activeArena = null;
    bossProjectiles.length = 0;
    bossHazards.length = 0;
    enemies.length = 0;
    enemyBullets.length = 0;
    spiderQueenDefeated = true;
    spiderBiome = true;
    sewerBiome = false;
    player.x = MAP_SIZE / 2;
    player.y = MAP_SIZE / 2;
    rescheduleSpawnsAfterBoss();
    healAfterBossVictory('ПОБЕДА НАД КОРОЛЕВОЙ — ИСЦЕЛЕНИЕ 50%');
  }

  function throwGoblinDynamite(boss) {
    const a = Math.atan2(player.y - boss.y, player.x - boss.x);
    bossProjectiles.push({ kind: 'dynamite', x: boss.x + Math.cos(a) * 0.8, y: boss.y + Math.sin(a) * 0.8, vx: Math.cos(a) * 7.0, vy: Math.sin(a) * 7.0, fuse: 1.0, life: 1.0, damage: goblinDamage(20), radius: 1.5 });
  }

  function startGoblinPyromania(boss) {
    boss.action = 'pyroInhale';
    boss.actionTimer = 0.6;
    boss.pyroAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
    boss.pyroHit = false;
    boss.pyroCooldown = goblinCooldown(12, boss.phase);
  }

  function startGoblinRush(boss) {
    const a = Math.atan2(player.y - boss.y, player.x - boss.x);
    boss.action = 'rush';
    boss.actionTimer = 2.8;
    boss.rushVX = Math.cos(a) * 13.0;
    boss.rushVY = Math.sin(a) * 13.0;
    boss.rushDistance = 0;
    boss.rushCooldown = goblinCooldown(20, boss.phase);
  }

  function startGoblinHook(boss) {
    const a = Math.atan2(player.y - boss.y, player.x - boss.x);
    bossProjectiles.push({ kind: 'hook', x: boss.x, y: boss.y, vx: Math.cos(a) * 11, vy: Math.sin(a) * 11, angle: a, life: 2.0, damage: goblinDamage(10) });
    boss.hookCooldown = goblinCooldown(12, boss.phase);
  }

  function updateRatBoss(boss, dt) {
    const d = Math.max(0.001, distance(boss.x, boss.y, player.x, player.y));
    const dx = (player.x - boss.x) / d, dy = (player.y - boss.y) / d;
    const nextPhase = boss.hp > 600 ? 1 : boss.hp > 300 ? 2 : 3;
    if (nextPhase !== boss.phase) {
      boss.phase = nextPhase;
      if (nextPhase >= 2 && !boss.animalCryDone) {
        boss.animalCryDone = true;
        boss.raged = true;
        boss.animalCryTimer = 1.6;
        announceBoss('ЖИВОТНЫЙ КРИК! КРЫСА В ЯРОСТИ!', 2.0);
      }
      if (nextPhase === 3) announceBoss('ФАЗА 3 — ЯРОСТЬ!', 1.8);
    }
    boss.animalCryTimer = Math.max(0, boss.animalCryTimer - dt);
    boss.clawCooldown -= dt;

    if (boss.echoTimer > 0) {
      boss.echoTimer = Math.max(0, boss.echoTimer - dt);
      playerSilenceTimer = Math.max(playerSilenceTimer, boss.echoTimer);
      if (boss.echoTimer <= 0) boss.echoCooldown = randomInterval(4, 8);
    } else if ((boss.phase === 1 || boss.phase === 3) && boss.introTimer <= 0) {
      boss.echoCooldown -= dt;
      if (boss.echoCooldown <= 0) {
        boss.echoTimer = boss.phase === 1 ? 3 : 5;
        playerSilenceTimer = boss.echoTimer;
        boss.echoCooldown = 9999; // Restarted only after the echo has completely ended.
        announceBoss('РАЗГРОМНОЕ ЭХО — СТРЕЛЬБА ЗАПРЕЩЕНА!', boss.echoTimer);
      }
    }

    if (boss.phase >= 2 && boss.introTimer <= 0) {
      boss.summonCooldown -= dt;
      if (boss.summonCooldown <= 0) {
        const count = boss.phase === 2 ? 3 : 6;
        spawnRatlings(count, boss.x, boss.y);
        boss.summonCooldown = randomInterval(5, 10);
        announceBoss(`КРЫСА ПРИЗЫВАЕТ ${count} МАЛЕНЬКИХ КРЫС!`, 1.4);
      }
    }

    if (boss.dashTimer > 0) {
      const oldX = boss.x, oldY = boss.y;
      boss.x = bossArenaClampX(boss.x + boss.dashVX * dt, 2.2);
      boss.y = bossArenaClampY(boss.y + boss.dashVY * dt, 2.2);
      boss.dashTimer = Math.max(0, boss.dashTimer - dt);
      if (!boss.dashHit && distance(boss.x, boss.y, player.x, player.y) < 2.0) {
        applyPlayerDamage(boss.phase === 1 ? 10 : 15);
        boss.dashHit = true;
      }
      if (Math.abs(boss.x - oldX) + Math.abs(boss.y - oldY) < 0.001) boss.dashTimer = 0;
    } else {
      boss.dashCooldown -= dt;
      if (boss.dashCooldown <= 0 && boss.introTimer <= 0) {
        boss.dashVX = dx * 10.5;
        boss.dashVY = dy * 10.5;
        boss.dashTimer = 0.58;
        boss.dashHit = false;
        boss.dashCooldown = 8.5;
      } else if (d > 2.25) {
        const speed = 2.45;
        boss.x = bossArenaClampX(boss.x + dx * speed * dt, 2.2);
        boss.y = bossArenaClampY(boss.y + dy * speed * dt, 2.2);
      }
    }

    if (boss.clawCooldown <= 0 && d <= 2.35 && boss.dashTimer <= 0 && boss.introTimer <= 0) {
      applyPlayerDamage(boss.phase === 1 ? 8 : 10);
      boss.clawCooldown = 1.55;
    }
    boss.angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  }

  function updateGoblinBoss(boss, dt) {
    const d = Math.max(0.001, distance(boss.x, boss.y, player.x, player.y));
    const dx = (player.x - boss.x) / d, dy = (player.y - boss.y) / d;
    const nextPhase = boss.hp > 500 ? 1 : 2;
    if (nextPhase !== boss.phase) {
      boss.phase = nextPhase;
      if (nextPhase === 2 && !boss.beltExploded) {
        boss.beltExploded = true;
        boss.dynamiteCooldown = Math.min(boss.dynamiteCooldown, goblinCooldown(6, 2));
        boss.pyroCooldown = Math.min(boss.pyroCooldown, goblinCooldown(12, 2));
        boss.hookCooldown = Math.min(boss.hookCooldown, goblinCooldown(12, 2));
        boss.speed = 3.25;
        boss.hookSlapDamage = goblinDamage(5);
        announceBoss('ПОЯС ВЗРЫВАЕТСЯ — ОСКОЛКИ!', 1.8);
        for (let i = 0; i < 12; i++) {
          const a = Math.PI * 2 * i / 12;
          bossProjectiles.push({ kind: 'shard', x: boss.x, y: boss.y, vx: Math.cos(a) * 8.2, vy: Math.sin(a) * 8.2, life: 1.15, damage: goblinDamage(5) });
        }
        explosions.push({ x: boss.x, y: boss.y, life: 0.45, maxLife: 0.45, radius: 2.2 });
      }
    }

    boss.dynamiteCooldown -= dt;
    boss.pyroCooldown -= dt;
    boss.rushCooldown -= dt;
    boss.hookCooldown -= dt;

    if (boss.hookPullTimer > 0) {
      const pullD = Math.max(0.001, distance(player.x, player.y, boss.x, boss.y));
      const pullSpeed = 11.0;
      const step = Math.min(pullD, pullSpeed * dt);
      player.x = bossArenaClampX(player.x + (boss.x - player.x) / pullD * step, 1.6);
      player.y = bossArenaClampY(player.y + (boss.y - player.y) / pullD * step, 1.6);
      boss.hookPullTimer = Math.max(0, boss.hookPullTimer - dt);
      if (boss.hookPullTimer <= 0 && boss.hookSlapPending) {
        applyPlayerDamage(boss.hookSlapDamage || goblinDamage(5));
        boss.hookSlapPending = false;
      }
      return;
    }

    if (boss.action === 'pyroInhale') {
      boss.actionTimer -= dt;
      if (boss.actionTimer <= 0) {
        boss.action = 'pyroFlame';
        boss.actionTimer = 0.95;
        boss.pyroHit = false;
      }
      return;
    }
    if (boss.action === 'pyroFlame') {
      boss.actionTimer -= dt;
      if (!boss.pyroHit) {
        const ex = boss.x + Math.cos(boss.pyroAngle) * 8;
        const ey = boss.y + Math.sin(boss.pyroAngle) * 8;
        if (pointSegmentDistance(player.x, player.y, boss.x, boss.y, ex, ey) <= 0.85) {
          applyPlayerDamage(goblinDamage(10)); // Strengthened goblin flame attack.
          boss.pyroHit = true;
        }
      }
      if (boss.actionTimer <= 0) boss.action = '';
      return;
    }
    if (boss.action === 'rush') {
      const oldX = boss.x, oldY = boss.y;
      let nx = boss.x + boss.rushVX * dt;
      let ny = boss.y + boss.rushVY * dt;
      const minX = activeArena.x + 2.1, maxX = activeArena.x + activeArena.size - 2.1;
      const minY = activeArena.y + 2.1, maxY = activeArena.y + activeArena.size - 2.1;
      if (nx < minX || nx > maxX) { boss.rushVX *= -1; nx = clamp(nx, minX, maxX); }
      if (ny < minY || ny > maxY) { boss.rushVY *= -1; ny = clamp(ny, minY, maxY); }
      boss.x = nx; boss.y = ny;
      const moved = distance(oldX, oldY, boss.x, boss.y);
      boss.rushDistance += moved;
      while (boss.rushDistance >= 2) {
        boss.rushDistance -= 2;
        bossHazards.push({ x: oldX, y: oldY, fuse: 0.9, damage: goblinDamage(20), radius: 1.35, kind: 'dynamite' });
      }
      boss.angle = Math.atan2(boss.rushVY, boss.rushVX);
      boss.actionTimer -= dt;
      if (boss.actionTimer <= 0) boss.action = '';
      return;
    }

    if (boss.dynamiteCooldown <= 0 && boss.introTimer <= 0) {
      throwGoblinDynamite(boss);
      boss.dynamiteCooldown = goblinCooldown(6, boss.phase);
    }

    // One special action at a time: Pyromania takes priority, then phase skill.
    if (boss.pyroCooldown <= 0 && boss.introTimer <= 0) {
      startGoblinPyromania(boss);
      return;
    }
    if (boss.phase === 1 && boss.rushCooldown <= 0 && boss.introTimer <= 0) {
      startGoblinRush(boss);
      return;
    }
    if (boss.phase === 2 && boss.hookCooldown <= 0 && boss.introTimer <= 0) {
      startGoblinHook(boss);
      return;
    }

    if (boss.introTimer <= 0) {
      // The goblin stays active: it approaches from afar, backs off when too close,
      // and circles the player at medium range between attacks.
      if (d > 5.0) {
        boss.x = bossArenaClampX(boss.x + dx * boss.speed * dt, 1.4);
        boss.y = bossArenaClampY(boss.y + dy * boss.speed * dt, 1.4);
      } else if (d < 3.5) {
        boss.x = bossArenaClampX(boss.x - dx * boss.speed * 0.8 * dt, 1.4);
        boss.y = bossArenaClampY(boss.y - dy * boss.speed * 0.8 * dt, 1.4);
      } else {
        const orbit = boss.orbitDirection || 1;
        boss.x = bossArenaClampX(boss.x - dy * orbit * boss.speed * 0.55 * dt, 1.4);
        boss.y = bossArenaClampY(boss.y + dx * orbit * boss.speed * 0.55 * dt, 1.4);
      }
    }
    boss.angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  }


  function updateSpiderBoss(boss, dt) {
    const d = Math.max(0.001, distance(boss.x, boss.y, player.x, player.y));
    const dx = (player.x - boss.x) / d, dy = (player.y - boss.y) / d;
    const nextPhase = boss.hp > 800 ? 1 : boss.hp > 400 ? 2 : 3;
    if (nextPhase !== boss.phase) {
      boss.phase = nextPhase;
      announceBoss(nextPhase === 2 ? 'КОРОЛЕВА ПАУКОВ ВЫХОДИТ ИЗ ЯЙЦА! ФАЗА 2' : 'КОРОЛЕВА ПАУКОВ В ЯРОСТИ! ФАЗА 3', 2.0);
      boss.webCooldown = Math.min(boss.webCooldown, 2.0);
      boss.summonCooldown = Math.min(boss.summonCooldown, 1.5);
      boss.leapCooldown = Math.min(boss.leapCooldown, 1.2);
    }

    if (boss.action === 'leap') {
      boss.actionTimer = Math.max(0, boss.actionTimer - dt);
      const progress = clamp(1 - boss.actionTimer / boss.leapDuration, 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      boss.x = bossArenaClampX(boss.leapStartX + (boss.leapTargetX - boss.leapStartX) * eased, 2.0);
      boss.y = bossArenaClampY(boss.leapStartY + (boss.leapTargetY - boss.leapStartY) * eased, 2.0);
      if (boss.actionTimer <= 0) {
        boss.x = bossArenaClampX(boss.leapTargetX, 2.0);
        boss.y = bossArenaClampY(boss.leapTargetY, 2.0);
        const shockRadius = boss.phase === 3 ? 4.2 : 3.6;
        const shockDamage = boss.phase === 1 ? 15 : boss.phase === 2 ? 18 : 20;
        bossHazards.push({ kind: 'spiderShockwave', x: boss.x, y: boss.y, fuse: 0.5, radius: shockRadius, damage: shockDamage });
        explosions.push({ x: boss.x, y: boss.y, life: 0.45, maxLife: 0.45, radius: 1.8, kind: 'web' });
        boss.action = '';
        boss.leapCooldown = boss.phase === 1 ? 9.0 : boss.phase === 2 ? 7.0 : 5.5;
      }
      return;
    }

    boss.biteCooldown -= dt;
    boss.webCooldown -= dt;
    boss.summonCooldown -= dt;
    boss.leapCooldown -= dt;

    if (d > 2.7 && boss.introTimer <= 0) {
      const speed = boss.speed * (boss.phase === 3 ? 1.18 : 1);
      boss.x = bossArenaClampX(boss.x + dx * speed * dt, 2.0);
      boss.y = bossArenaClampY(boss.y + dy * speed * dt, 2.0);
    }

    if (boss.biteCooldown <= 0 && d <= 2.25 && boss.introTimer <= 0) {
      applyPlayerDamage(15);
      boss.biteCooldown = 1.45;
      announceBoss('ЯДОВИТЫЙ УКУС!', 0.8);
    }

    // Web patches warn briefly, then remain for four seconds. Standing in a web
    // refreshes the 40% movement slow; leaving it starts the four-second recovery.
    if (boss.webCooldown <= 0 && boss.introTimer <= 0) {
      const minX = activeArena.x + 2.5, maxX = activeArena.x + activeArena.size - 2.5;
      const minY = activeArena.y + 2.5, maxY = activeArena.y + activeArena.size - 2.5;
      const targetX = clamp(player.x, minX, maxX);
      const targetY = clamp(player.y, minY, maxY);
      bossHazards.push({ kind: 'spiderWeb', x: targetX, y: targetY, radius: 2.55, warning: 0.5, life: 4.0 });
      boss.webCooldown = boss.phase === 1 ? 10 : boss.phase === 2 ? 8 : 6;
      announceBoss('ПАУТИНА! НЕ ЗАДЕРЖИВАЙСЯ В ЛИПКИЙ ЗОНЕ!', 1.2);
      return;
    }

    if (boss.phase >= 2 && boss.summonCooldown <= 0 && boss.introTimer <= 0) {
      const count = boss.phase === 2 ? 4 : 6;
      spawnSpiderlings(count, boss.x, boss.y);
      boss.summonCooldown = boss.phase === 2 ? 12 : 9;
      announceBoss(`КОРОЛЕВА ПРИЗЫВАЕТ ${count} ПАУЧАТ!`, 1.4);
      return;
    }

    if (boss.leapCooldown <= 0 && boss.introTimer <= 0) {
      boss.action = 'leap';
      boss.leapStartX = boss.x;
      boss.leapStartY = boss.y;
      boss.leapTargetX = clamp(player.x, activeArena.x + 3, activeArena.x + activeArena.size - 3);
      boss.leapTargetY = clamp(player.y, activeArena.y + 3, activeArena.y + activeArena.size - 3);
      boss.leapDuration = 0.68;
      boss.actionTimer = boss.leapDuration;
      announceBoss('КОРОЛЕВА ПАУКОВ ПРЫГАЕТ! УДАРНАЯ ВОЛНА!', 1.1);
      return;
    }

    boss.angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  }

  function updateBossProjectiles(dt) {
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
      const p = bossProjectiles[i];
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      p.life -= dt;
      if (p.kind === 'dynamite') {
        p.fuse -= dt;
        if (p.fuse <= 0) {
          if (distance(player.x, player.y, p.x, p.y) <= p.radius) applyPlayerDamage(p.damage);
          explosions.push({ x: p.x, y: p.y, life: 0.42, maxLife: 0.42, radius: p.radius });
          bossProjectiles.splice(i, 1);
          continue;
        }
      } else if (p.kind === 'hook') {
        if (distance(player.x, player.y, p.x, p.y) <= 0.58) {
          applyPlayerDamage(p.damage || goblinDamage(10));
          if (activeBoss && activeBoss.kind === 'goblin') {
            activeBoss.hookPullTimer = 0.55;
            activeBoss.hookSlapPending = true;
          }
          bossProjectiles.splice(i, 1);
          continue;
        }
      } else if (p.kind === 'shard') {
        if (distance(player.x, player.y, p.x, p.y) <= 0.42) {
          applyPlayerDamage(p.damage);
          bossProjectiles.splice(i, 1);
          continue;
        }
      }
      if (p.life <= 0 || !activeArena || p.x < activeArena.x + 1 || p.y < activeArena.y + 1 || p.x > activeArena.x + activeArena.size - 1 || p.y > activeArena.y + activeArena.size - 1) bossProjectiles.splice(i, 1);
    }
  }

  function updateBossHazards(dt) {
    for (let i = bossHazards.length - 1; i >= 0; i--) {
      const h = bossHazards[i];
      if (h.kind === 'spiderWeb') {
        if (h.warning > 0) {
          h.warning = Math.max(0, h.warning - dt);
          continue;
        }
        h.life -= dt;
        if (distance(player.x, player.y, h.x, h.y) <= h.radius) spiderWebSlowTimer = Math.max(spiderWebSlowTimer, 4.0);
        if (h.life <= 0) bossHazards.splice(i, 1);
        continue;
      }
      h.fuse -= dt;
      if (h.fuse <= 0) {
        if (distance(player.x, player.y, h.x, h.y) <= h.radius) applyPlayerDamage(h.damage);
        explosions.push({ x: h.x, y: h.y, life: 0.4, maxLife: 0.4, radius: h.radius, kind: h.kind === 'spiderShockwave' ? 'web' : undefined });
        bossHazards.splice(i, 1);
      }
    }
  }

  function updateBoss(dt) {
    if (bossBannerTimer > 0) bossBannerTimer = Math.max(0, bossBannerTimer - dt);
    playerSilenceTimer = Math.max(0, playerSilenceTimer - dt);
    if (!activeBoss) return;
    const boss = activeBoss;
    boss.introTimer = Math.max(0, boss.introTimer - dt);
    if (boss.defeatTimer > 0) {
      boss.defeatTimer -= dt;
      if (boss.kind === 'goblin' && boss.defeatTimer <= 1.35 && !boss.deathExplosionDone) {
        boss.deathExplosionDone = true;
        explosions.push({ x: boss.x, y: boss.y, life: 0.9, maxLife: 0.9, radius: 3.6 });
        announceBoss('ДИНАМИТ ВЗРЫВАЕТСЯ!', 1.1);
      }
      if (boss.defeatTimer <= 0) {
        if (boss.kind === 'rat') finishRatBoss();
        else if (boss.kind === 'goblin') finishGoblinBoss();
        else finishSpiderBoss();
      }
      return;
    }
    boss.flash = Math.max(0, (boss.flash || 0) - dt);
    if (boss.kind === 'rat') updateRatBoss(boss, dt);
    else if (boss.kind === 'goblin') updateGoblinBoss(boss, dt);
    else updateSpiderBoss(boss, dt);
    updateBossProjectiles(dt);
    updateBossHazards(dt);
    if (boss.hp <= 0) beginBossDefeat();
  }

  function applyPlayerDamage(amount) {
    if (dead || amount <= 0) return;
    if (player.invulnerabilityTimer > 0 || energyShieldTimer > 0 || lastChanceShieldTimer > 0) return;
    if (Math.random() < player.dodgeChance) {
      damageFlashTimer = 0.10;
      return;
    }
    const reducedDamage = Math.max(1, Math.round(amount * (1 - player.damageReduction) * 10) / 10);
    const actualDamage = Math.min(player.hp, reducedDamage);
    player.hp = Math.max(0, player.hp - actualDamage);
    player.invulnerabilityTimer = HIT_INVULNERABILITY_SECONDS;

    // Light Boots: the 5-second cooldown is approved; burst duration is a temporary 1.5-second test value.
    if (getUpgradeLevel('lightBoots') >= 3 && bootsBurstCooldown <= 0) {
      bootsBurstTimer = LIGHT_BOOTS_BURST_SECONDS;
      bootsBurstCooldown = 5;
    }

    damageFlashTimer = 0.38;
    hitBannerTimer = 0.9;
    lastDamageTaken = actualDamage;
    damageNumbers.push({ x: player.x, y: player.y - 0.65, amount: actualDamage, life: 0.95, maxLife: 0.95 });

    // Last Chance triggers once when HP falls below 25% and absorbs all damage for 10 seconds.
    if (player.lastChance && !lastChanceUsed && player.hp > 0 && player.hp <= player.maxHp * 0.25) {
      lastChanceUsed = true;
      lastChanceSpeedTimer = 10;
      lastChanceShieldTimer = 10;
      lastChanceHealTimer = 5;
      lastChanceKillCounter = 0;
    }

    if (player.hp <= 0 && player.phoenix && !player.phoenixUsed) {
      player.phoenixUsed = true;
      player.hp = Math.max(1, Math.ceil(player.maxHp * 0.25));
      player.invulnerabilityTimer = HIT_INVULNERABILITY_SECONDS;
      damageFlashTimer = 0.65;
      hitBannerTimer = 1.1;
      lastDamageTaken = 0;
      return;
    }

    if (player.hp <= 0) {
      player.hp = 0;
      dead = true;
      paused = false;
    }
  }

  function killEnemy(index) {
    const enemy = enemies[index];
    if (!enemy) return;
    kills += 1;
    while (kills >= nextCoinKillMilestone) {
      awardCoins(1, `ЗА ${nextCoinKillMilestone} УБИЙСТВ`);
      nextCoinKillMilestone += 10;
    }
    xpOrbs.push({ x: enemy.x, y: enemy.y, value: enemy.xp, phase: Math.random() * Math.PI * 2, bornAt: elapsed });

    if (kills >= nextMedkitAt) {
      medkits.push({ x: enemy.x, y: enemy.y, bob: Math.random() * Math.PI * 2 });
      nextMedkitAt += player.medkitInterval;
    }
    if (player.ghostLevel > 0) { /* ghost shots have no separate kill reward */ }
    if (getUpgradeLevel('vampirism') > 0 && kills >= nextVampirismKillAt) {
      player.hp = Math.min(player.maxHp, player.hp + 3);
      nextVampirismKillAt += 10;
    }
    if (lastChanceHealTimer > 0) {
      lastChanceKillCounter += 1;
      if (lastChanceKillCounter >= 2) {
        player.hp = Math.min(player.maxHp, player.hp + 1);
        lastChanceKillCounter = 0;
      }
    }
    enemies.splice(index, 1);
  }

  function findEnemyById(id) {
    return enemies.find(enemy => enemy.id === id);
  }

  function setNextRicochetTarget(bullet) {
    const candidates = enemies.filter(enemy => !bullet.hitIds.includes(enemy.id));
    if (!candidates.length) return false;
    candidates.sort((a, b) => distance(bullet.x, bullet.y, a.x, a.y) - distance(bullet.x, bullet.y, b.x, b.y));
    const target = candidates[0];
    if (distance(bullet.x, bullet.y, target.x, target.y) > 8) return false;
    bullet.targetId = target.id;
    bullet.homing = true;
    const angle = Math.atan2(target.y - bullet.y, target.x - bullet.x);
    const speed = Math.hypot(bullet.vx, bullet.vy);
    bullet.vx = Math.cos(angle) * speed;
    bullet.vy = Math.sin(angle) * speed;
    bullet.life = Math.max(bullet.life, 1.8);
    return true;
  }

  function triggerExplosiveHit(x, y) {
    const radius = 1.5;
    // The original upgrade description left its base splash damage unspecified.
    // Use 10 base damage plus +1 for each explosive-bullet level (11 / 12 / 13 HP).
    const splashDamage = 10 + player.explosiveLevel;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (distance(x, y, enemy.x, enemy.y) > radius) continue;
      enemy.hp -= splashDamage;
      enemy.hitFlash = 0.18;
      damageNumbers.push({ x: enemy.x, y: enemy.y - 0.55, amount: splashDamage, life: 0.72, maxLife: 0.72 });
      if (enemy.hp <= 0) killEnemy(i);
    }
    if (activeBoss && activeBoss.defeatTimer <= 0 && distance(x, y, activeBoss.x, activeBoss.y) <= radius) {
      activeBoss.hp = Math.max(0, activeBoss.hp - splashDamage);
      activeBoss.flash = 0.18;
      damageNumbers.push({ x: activeBoss.x, y: activeBoss.y - 1.6, amount: splashDamage, life: 0.72, maxLife: 0.72 });
      if (activeBoss.hp <= 0) beginBossDefeat();
    }
    explosions.push({ x, y, life: 0.36, maxLife: 0.36, radius, kind: 'explosive' });
  }

  function triggerAlchemistFlaskHit(x, y, projectile = null) {
    const splashRadius = 1.4;
    const baseDamage = projectile ? projectile.damage : player.bulletDamage;
    const damageScale = projectile && projectile.golden ? 2.5 : 1;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (distance(x, y, enemy.x, enemy.y) > splashRadius + enemy.radius) continue;
      const crit = Math.random() < player.critChance;
      const dealt = Math.max(1, Math.round(baseDamage * damageScale * (crit ? 2 : 1)));
      enemy.hp -= dealt;
      enemy.hitFlash = 0.18;
      damageNumbers.push({ x: enemy.x, y: enemy.y - 0.55, amount: dealt, life: 0.72, maxLife: 0.72, crit });
      if (enemy.hp <= 0) killEnemy(i);
    }
    if (activeBoss && activeBoss.defeatTimer <= 0) {
      const bossRadius = bossCollisionRadius(activeBoss);
      if (distance(x, y, activeBoss.x, activeBoss.y) <= splashRadius + bossRadius) {
        const crit = Math.random() < player.critChance;
        const dealt = Math.max(1, Math.round(baseDamage * damageScale * (crit ? 2 : 1)));
        activeBoss.hp = Math.max(0, activeBoss.hp - dealt);
        activeBoss.flash = 0.18;
        damageNumbers.push({ x: activeBoss.x, y: activeBoss.y - 1.6, amount: dealt, life: 0.72, maxLife: 0.72, crit });
        if (activeBoss.hp <= 0) beginBossDefeat();
      }
    }
    // The puddle lasts one second. Each target can take 2 poison damage once while standing in it.
    poisonPuddles.push({ x, y, radius: 1.15, life: 1, maxLife: 1, tick: 0.12, hitIds: [] });
    explosions.push({ x, y, life: 0.38, maxLife: 0.38, radius: splashRadius, kind: 'poison' });
  }

  function applyPoisonStatus(target) {
    if (!target) return;
    target.poisonTicksRemaining = 3;
    target.poisonTickTimer = 1;
  }

  function applyElectricChain(originX, originY, primaryDamage, excludedId) {
    if (player.characterId !== 'electrician') return;
    const candidates = [];
    for (const enemy of enemies) {
      if (enemy.id === excludedId) continue;
      const d = distance(originX, originY, enemy.x, enemy.y);
      if (d <= 4.5) candidates.push({ target: enemy, d, boss: false });
    }
    if (activeBoss && activeBoss.id !== excludedId && activeBoss.defeatTimer <= 0) {
      const d = distance(originX, originY, activeBoss.x, activeBoss.y);
      if (d <= 4.5) candidates.push({ target: activeBoss, d, boss: true });
    }
    candidates.sort((a, b) => a.d - b.d);
    const next = candidates[0];
    if (!next) return;
    const damage = Math.max(1, Math.round(primaryDamage * 0.5));
    next.target.hp = Math.max(0, next.target.hp - damage);
    if (next.boss) next.target.flash = 0.18;
    else next.target.hitFlash = 0.18;
    damageNumbers.push({ x: next.target.x, y: next.target.y - (next.boss ? 1.5 : 0.55), amount: damage, life: 0.72, maxLife: 0.72, electric: true });
    lightningLinks.push({ x1: originX, y1: originY, x2: next.target.x, y2: next.target.y, life: 0.22, maxLife: 0.22 });
    if (next.boss) {
      if (next.target.hp <= 0) beginBossDefeat();
    } else if (next.target.hp <= 0) {
      const index = enemies.indexOf(next.target);
      if (index >= 0) killEnemy(index);
    }
  }

  function updateClassEffects(dt) {
    player.classAbilityCooldown = Math.max(0, player.classAbilityCooldown - dt);
    // Emit three radial pulses in quick succession from the position where the skill was activated.
    electricWaveCast.timer -= dt;
    while (electricWaveCast.remaining > 0 && electricWaveCast.timer <= 0) {
      electricWaves.push({
        x: electricWaveCast.x, y: electricWaveCast.y,
        elapsed: 0, duration: 0.68, previousRadius: 0, radius: 0,
        maxRadius: 8, damage: 20, hitIds: []
      });
      electricWaveCast.remaining -= 1;
      electricWaveCast.timer += 0.22;
    }

    // Each energy ring damages a target once as its circular edge passes over that target.
    for (let wi = electricWaves.length - 1; wi >= 0; wi--) {
      const wave = electricWaves[wi];
      wave.previousRadius = wave.radius;
      wave.elapsed += dt;
      wave.radius = wave.maxRadius * clamp(wave.elapsed / wave.duration, 0, 1);
      const ringThickness = 0.28;
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const enemy = enemies[ei];
        if (wave.hitIds.includes(enemy.id)) continue;
        const d = distance(wave.x, wave.y, enemy.x, enemy.y);
        const targetRadius = Math.max(0.22, enemy.radius || 0.32);
        const crossedRing = d + targetRadius >= Math.max(0, wave.previousRadius - ringThickness)
          && d - targetRadius <= wave.radius + ringThickness
          && d <= wave.maxRadius + targetRadius;
        if (!crossedRing) continue;
        wave.hitIds.push(enemy.id);
        enemy.hp = Math.max(0, enemy.hp - wave.damage);
        enemy.hitFlash = 0.2;
        damageNumbers.push({ x: enemy.x, y: enemy.y - 0.6, amount: wave.damage, life: 0.72, maxLife: 0.72, electric: true });
        if (enemy.hp <= 0) killEnemy(ei);
      }
      if (activeBoss && activeBoss.defeatTimer <= 0 && !wave.hitIds.includes(activeBoss.id)) {
        const d = distance(wave.x, wave.y, activeBoss.x, activeBoss.y);
        const bossRadius = bossCollisionRadius(activeBoss);
        const crossedBoss = d + bossRadius >= Math.max(0, wave.previousRadius - ringThickness)
          && d - bossRadius <= wave.radius + ringThickness
          && d <= wave.maxRadius + bossRadius;
        if (crossedBoss) {
          wave.hitIds.push(activeBoss.id);
          activeBoss.hp = Math.max(0, activeBoss.hp - wave.damage);
          activeBoss.flash = 0.2;
          damageNumbers.push({ x: activeBoss.x, y: activeBoss.y - 1.6, amount: wave.damage, life: 0.72, maxLife: 0.72, electric: true });
          if (activeBoss.hp <= 0) beginBossDefeat();
        }
      }
      if (wave.elapsed >= wave.duration) electricWaves.splice(wi, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if ((enemy.poisonTicksRemaining || 0) <= 0) continue;
      enemy.poisonTickTimer -= dt;
      while (enemy.poisonTickTimer <= 0 && enemy.poisonTicksRemaining > 0) {
        enemy.poisonTicksRemaining -= 1;
        enemy.hp -= 2;
        enemy.hitFlash = 0.16;
        damageNumbers.push({ x: enemy.x, y: enemy.y - 0.6, amount: 2, life: 0.62, maxLife: 0.62, poison: true });
        enemy.poisonTickTimer += 1;
        if (enemy.hp <= 0) { killEnemy(i); break; }
      }
    }

    if (activeBoss && (activeBoss.poisonTicksRemaining || 0) > 0 && activeBoss.defeatTimer <= 0) {
      activeBoss.poisonTickTimer -= dt;
      while (activeBoss.poisonTickTimer <= 0 && activeBoss.poisonTicksRemaining > 0 && activeBoss.defeatTimer <= 0) {
        activeBoss.poisonTicksRemaining -= 1;
        activeBoss.hp = Math.max(0, activeBoss.hp - 2);
        activeBoss.flash = 0.16;
        damageNumbers.push({ x: activeBoss.x, y: activeBoss.y - 1.6, amount: 2, life: 0.65, maxLife: 0.65, poison: true });
        activeBoss.poisonTickTimer += 1;
        if (activeBoss.hp <= 0) { beginBossDefeat(); break; }
      }
    }

    for (let i = poisonClouds.length - 1; i >= 0; i--) {
      const cloud = poisonClouds[i];
      cloud.life -= dt;
      cloud.tick -= dt;
      while (cloud.tick <= 0 && cloud.life > 0) {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const enemy = enemies[j];
          if (distance(cloud.x, cloud.y, enemy.x, enemy.y) > cloud.radius) continue;
          enemy.hp -= 2;
          enemy.hitFlash = 0.16;
          damageNumbers.push({ x: enemy.x, y: enemy.y - 0.55, amount: 2, life: 0.58, maxLife: 0.58, poison: true });
          if (enemy.hp <= 0) killEnemy(j);
        }
        if (activeBoss && activeBoss.defeatTimer <= 0 && distance(cloud.x, cloud.y, activeBoss.x, activeBoss.y) <= cloud.radius) {
          activeBoss.hp = Math.max(0, activeBoss.hp - 2);
          activeBoss.flash = 0.15;
          damageNumbers.push({ x: activeBoss.x, y: activeBoss.y - 1.6, amount: 2, life: 0.58, maxLife: 0.58, poison: true });
          if (activeBoss.hp <= 0) beginBossDefeat();
        }
        cloud.tick += 1;
      }
      if (cloud.life <= 0) poisonClouds.splice(i, 1);
    }

    for (let i = poisonPuddles.length - 1; i >= 0; i--) {
      const puddle = poisonPuddles[i];
      puddle.life -= dt;
      puddle.tick -= dt;
      if (puddle.tick <= 0 && puddle.life > 0) {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const enemy = enemies[j];
          if (puddle.hitIds.includes(enemy.id)) continue;
          if (distance(puddle.x, puddle.y, enemy.x, enemy.y) > puddle.radius + enemy.radius) continue;
          puddle.hitIds.push(enemy.id);
          enemy.hp -= 2;
          enemy.hitFlash = 0.16;
          damageNumbers.push({ x: enemy.x, y: enemy.y - 0.55, amount: 2, life: 0.62, maxLife: 0.62, poison: true });
          if (enemy.hp <= 0) killEnemy(j);
        }
        if (activeBoss && activeBoss.defeatTimer <= 0 && !puddle.hitIds.includes(activeBoss.id)) {
          const bossRadius = bossCollisionRadius(activeBoss);
          if (distance(puddle.x, puddle.y, activeBoss.x, activeBoss.y) <= puddle.radius + bossRadius) {
            puddle.hitIds.push(activeBoss.id);
            activeBoss.hp = Math.max(0, activeBoss.hp - 2);
            activeBoss.flash = 0.16;
            damageNumbers.push({ x: activeBoss.x, y: activeBoss.y - 1.6, amount: 2, life: 0.62, maxLife: 0.62, poison: true });
            if (activeBoss.hp <= 0) beginBossDefeat();
          }
        }
        puddle.tick = 0.12;
      }
      if (puddle.life <= 0) poisonPuddles.splice(i, 1);
    }

    for (let i = lightningLinks.length - 1; i >= 0; i--) {
      lightningLinks[i].life -= dt;
      if (lightningLinks[i].life <= 0) lightningLinks.splice(i, 1);
    }
  }

  function updateClassTurrets(dt) {
    for (let i = classTurrets.length - 1; i >= 0; i--) {
      const turret = classTurrets[i];
      turret.life -= dt;
      turret.fireTimer -= dt;
      if (turret.life <= 0) { classTurrets.splice(i, 1); continue; }
      if (turret.fireTimer > 0) continue;

      const targets = enemies.map(enemy => ({ target: enemy, boss: false, d: distance(turret.x, turret.y, enemy.x, enemy.y) }));
      if (activeBoss && activeBoss.defeatTimer <= 0) targets.push({ target: activeBoss, boss: true, d: distance(turret.x, turret.y, activeBoss.x, activeBoss.y) });
      targets.sort((a, b) => a.d - b.d);
      const candidate = targets.find(item => item.d <= turret.range);
      turret.fireTimer = 0.3;
      if (!candidate) continue;
      const target = candidate.target;
      const angle = Math.atan2(target.y - turret.y, target.x - turret.x);
      turret.angle = angle;
      const speed = 14;
      bullets.push({
        x: turret.x + Math.cos(angle) * 0.35, y: turret.y + Math.sin(angle) * 0.35,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        damage: 5, life: turret.range / speed + 0.04, maxDistance: turret.range,
        travelled: 0, hitIds: [], ricochetsLeft: 0, pierceLeft: 0,
        golden: false, explosive: false, ghost: false, turretShot: true, poison: false,
        shotgunPellet: false
      });
    }
  }

  function fireSkeletonArrow(enemy) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const angle = Math.atan2(dy, dx);
    const speed = player.speed * ARROW_SPEED_FACTOR;
    enemyBullets.push({
      x: enemy.x + Math.cos(angle) * 0.55,
      y: enemy.y + Math.sin(angle) * 0.55,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      damage: enemy.damage * (bloodMoonActive ? 1.15 : 1),
      life: 5
    });
  }

  function updateEnemyHpScaling() {
    while (elapsed + 1e-9 >= nextEnemyHpRampAt) {
      enemyHpMultiplier *= 1.1;
      for (const enemy of enemies) {
        enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * 1.1));
        enemy.hp = Math.min(enemy.maxHp, Math.max(1, Math.round(enemy.hp * 1.1)));
      }
      nextEnemyHpRampAt += 60;
    }
  }

  function updateWorldEvents() {
    const shouldBeActive = (elapsed >= 180 && elapsed < 240) || (elapsed >= 480 && elapsed < 540);
    if (shouldBeActive === bloodMoonActive) return;
    bloodMoonActive = shouldBeActive;
    if (bloodMoonActive) announceBoss('КРОВАВАЯ ЛУНА НАЧАЛАСЬ!', 3.0);
    else announceBoss('КРОВАВАЯ ЛУНА ЗАКОНЧИЛАСЬ', 2.4);
  }

  function updateSpawning() {
    if (activeBoss) return;
    // Process spawn events in time order so frame drops do not skip difficulty ramps.
    // At every 45-second mark, zombie/skeleton spawn frequency is multiplied by 1.5.
    const EPSILON = 1e-9;
    while (true) {
      const nextEventAt = Math.min(zombieSpawnAt, batSpawnAt, skeletonSpawnAt, nextSpawnRampAt);
      if (nextEventAt > elapsed + EPSILON) break;

      // Apply a ramp before spawns scheduled at the exact same timestamp.
      if (nextSpawnRampAt <= nextEventAt + EPSILON) {
        const rampTime = nextSpawnRampAt;
        spawnRateMultiplier *= 1.5;
        const newSpawnInterval = 2 / spawnRateMultiplier;

        // If an active spawn timer would otherwise wait beyond the ramp, restart
        // its next interval from the ramp timestamp using the faster rate.
        if (zombieSpawnAt > rampTime + EPSILON) {
          zombieSpawnAt = rampTime + newSpawnInterval;
        }
        // Skeletons still begin at exactly 2:00; only accelerate their schedule
        // after their first spawn has happened.
        if (skeletonHasSpawned && skeletonSpawnAt > rampTime + EPSILON) {
          skeletonSpawnAt = rampTime + newSpawnInterval;
        }
        nextSpawnRampAt += 45;
        continue;
      }

      if (zombieSpawnAt <= nextEventAt + EPSILON) {
        spawnEnemy('zombie');
        zombieSpawnAt += 2 / spawnRateMultiplier;
      }

      if (batSpawnAt <= nextEventAt + EPSILON) {
        // Bats begin at 1:00. At 1:00, 2:00, etc., the minute wave has 5 bats; other waves have 3.
        const minuteMark = Math.round(batSpawnAt / 60);
        const isSpecialMinute = minuteMark >= 1 && Math.abs(batSpawnAt - minuteMark * 60) < 0.001;
        const count = isSpecialMinute ? 5 : 3;
        for (let i = 0; i < count; i++) spawnEnemy('bat');
        batSpawnAt += 5;
      }

      if (skeletonSpawnAt <= nextEventAt + EPSILON) {
        spawnEnemy('skeleton');
        skeletonHasSpawned = true;
        skeletonSpawnAt += 2 / spawnRateMultiplier;
      }
    }
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.attackTimer -= dt;

      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const d = Math.max(0.0001, Math.hypot(dx, dy));
      const nx = dx / d;
      const ny = dy / d;
      enemy.angle = Math.atan2(dy, dx);

      if (enemy.type === 'skeleton') {
        const preferred = enemy.preferredDistance;
        if (d > preferred + 1.0) {
          enemy.x += nx * enemy.speed * (bloodMoonActive ? 1.15 : 1) * dt;
          enemy.y += ny * enemy.speed * (bloodMoonActive ? 1.15 : 1) * dt;
        } else if (d < preferred - 1.3) {
          enemy.x -= nx * enemy.speed * (bloodMoonActive ? 1.15 : 1) * dt;
          enemy.y -= ny * enemy.speed * (bloodMoonActive ? 1.15 : 1) * dt;
        }

        if (d <= enemy.attackRange && enemy.attackTimer <= 0) {
          fireSkeletonArrow(enemy);
          enemy.attackTimer = enemy.attackInterval;
        }
      } else {
        if (d > enemy.attackRange) {
          enemy.x += nx * enemy.speed * (bloodMoonActive ? 1.15 : 1) * dt;
          enemy.y += ny * enemy.speed * (bloodMoonActive ? 1.15 : 1) * dt;
        } else if (enemy.attackTimer <= 0) {
          applyPlayerDamage(enemy.damage * (bloodMoonActive ? 1.15 : 1));
          enemy.attackTimer = enemy.attackInterval;
        }
      }

      if (activeArena) {
        enemy.x = bossArenaClampX(enemy.x, 1.4);
        enemy.y = bossArenaClampY(enemy.y, 1.4);
      } else {
        enemy.x = clamp(enemy.x, 1.4, MAP_SIZE - 1.4);
        enemy.y = clamp(enemy.y, 1.4, MAP_SIZE - 1.4);
      }
    }
  }

  function updateProjectiles(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      if (bullet.homing && bullet.targetId) {
        const target = findEnemyById(bullet.targetId);
        if (target) {
          const a = Math.atan2(target.y - bullet.y, target.x - bullet.x);
          const speed = Math.hypot(bullet.vx, bullet.vy);
          bullet.vx = Math.cos(a) * speed;
          bullet.vy = Math.sin(a) * speed;
        } else if (!setNextRicochetTarget(bullet)) {
          bullets.splice(i, 1);
          continue;
        }
      }
      let moveX = bullet.vx * dt;
      let moveY = bullet.vy * dt;
      let moveDistance = Math.hypot(moveX, moveY);
      if (Number.isFinite(bullet.maxDistance)) {
        const remaining = Math.max(0, bullet.maxDistance - (bullet.travelled || 0));
        if (moveDistance > remaining && moveDistance > 0) {
          const ratio = remaining / moveDistance;
          moveX *= ratio;
          moveY *= ratio;
          moveDistance = remaining;
        }
        bullet.travelled = (bullet.travelled || 0) + moveDistance;
      }
      bullet.x += moveX;
      bullet.y += moveY;
      bullet.life -= dt;
      let hitIndex = -1;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (bullet.hitIds.includes(enemy.id)) continue;
        if (distance(bullet.x, bullet.y, enemy.x, enemy.y) <= enemy.radius + 0.12) {
          hitIndex = j;
          break;
        }
      }

      if (hitIndex !== -1) {
        if (bullet.projectileType === 'flask') {
          triggerAlchemistFlaskHit(bullet.x, bullet.y, bullet);
          if (bullet.explosive) triggerExplosiveHit(bullet.x, bullet.y);
          bullets.splice(i, 1);
          continue;
        }
        const enemy = enemies[hitIndex];
        bullet.hitIds.push(enemy.id);
        const isCrit = bullet.turretShot ? false : Math.random() < player.critChance;
        const dealt = Math.round(bullet.damage * (bullet.golden ? 2.5 : 1) * (isCrit ? 2 : 1));
        enemy.hp -= dealt;
        enemy.hitFlash = 0.12;
        damageNumbers.push({ x: enemy.x, y: enemy.y - 0.55, amount: dealt, life: 0.62, maxLife: 0.62, crit: isCrit });
        if (bullet.poison && !bullet.turretShot && enemy.hp > 0) applyPoisonStatus(enemy);
        if (!bullet.turretShot && !bullet.ghost && !bullet.chainDone && player.characterId === 'electrician') {
          bullet.chainDone = true;
          applyElectricChain(enemy.x, enemy.y, dealt, enemy.id);
        }
        const remainingEnemyIndex = enemies.indexOf(enemy);
        if (enemy.hp <= 0 && remainingEnemyIndex >= 0) killEnemy(remainingEnemyIndex);

        if (bullet.explosive) {
          triggerExplosiveHit(bullet.x, bullet.y);
          bullet.explosive = false;
        }

        if (bullet.golden && bullet.pierceLeft > 0) {
          bullet.pierceLeft -= 1;
          if (bullet.pierceLeft === 0) {
            if (bullet.ricochetsLeft > 0) {
              bullet.ricochetsLeft -= 1;
              if (!setNextRicochetTarget(bullet)) { bullets.splice(i, 1); continue; }
            } else { bullets.splice(i, 1); continue; }
          }
        } else if (bullet.ricochetsLeft > 0) {
          bullet.ricochetsLeft -= 1;
          if (!setNextRicochetTarget(bullet)) { bullets.splice(i, 1); continue; }
        } else {
          bullets.splice(i, 1);
          continue;
        }
      }

      if (activeBoss && activeBoss.defeatTimer <= 0 && !bullet.hitIds.includes(activeBoss.id)) {
        const bossRadius = bossCollisionRadius(activeBoss);
        if (distance(bullet.x, bullet.y, activeBoss.x, activeBoss.y) <= bossRadius) {
          if (bullet.projectileType === 'flask') {
            triggerAlchemistFlaskHit(bullet.x, bullet.y, bullet);
            if (bullet.explosive) triggerExplosiveHit(bullet.x, bullet.y);
            bullets.splice(i, 1);
            continue;
          }
          bullet.hitIds.push(activeBoss.id);
          const isCrit = bullet.turretShot ? false : Math.random() < player.critChance;
          const dealt = Math.round(bullet.damage * (bullet.golden ? 2.5 : 1) * (isCrit ? 2 : 1));
          activeBoss.hp = Math.max(0, activeBoss.hp - dealt);
          activeBoss.flash = 0.16;
          damageNumbers.push({ x: activeBoss.x, y: activeBoss.y - 1.6, amount: dealt, life: 0.72, maxLife: 0.72, crit: isCrit });
          if (bullet.poison && !bullet.turretShot && activeBoss.hp > 0) applyPoisonStatus(activeBoss);
          if (!bullet.turretShot && !bullet.ghost && !bullet.chainDone && player.characterId === 'electrician') {
            bullet.chainDone = true;
            applyElectricChain(activeBoss.x, activeBoss.y, dealt, activeBoss.id);
          }
          if (bullet.explosive) {
            triggerExplosiveHit(bullet.x, bullet.y);
            bullet.explosive = false;
          }
          if (activeBoss && activeBoss.hp <= 0) beginBossDefeat();
          bullets.splice(i, 1);
          continue;
        }
      }

      const outside = bullet.x < 1 || bullet.y < 1 || bullet.x > MAP_SIZE - 1 || bullet.y > MAP_SIZE - 1;
      const rangeReached = Number.isFinite(bullet.maxDistance) && (bullet.travelled || 0) >= bullet.maxDistance - 1e-6;
      if (bullet.life <= 0 || outside || rangeReached) {
        if (bullet.projectileType === 'flask') {
          triggerAlchemistFlaskHit(bullet.x, bullet.y, bullet);
          if (bullet.explosive) triggerExplosiveHit(bullet.x, bullet.y);
        }
        bullets.splice(i, 1);
      }
    }

    const enemyProjectileScale = timeSlowTimer > 0 ? 0.8 : 1;
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const arrow = enemyBullets[i];
      arrow.x += arrow.vx * dt * enemyProjectileScale;
      arrow.y += arrow.vy * dt * enemyProjectileScale;
      arrow.life -= dt * enemyProjectileScale;
      if (distance(arrow.x, arrow.y, player.x, player.y) <= 0.48) {
        applyPlayerDamage(arrow.damage);
        enemyBullets.splice(i, 1);
        continue;
      }
      const outside = arrow.x < 1 || arrow.y < 1 || arrow.x > MAP_SIZE - 1 || arrow.y > MAP_SIZE - 1;
      if (arrow.life <= 0 || outside) enemyBullets.splice(i, 1);
    }
  }

  function updateCompanion(dt) {
    if (player.ghostLevel <= 0 || dead || playerSilenceTimer > 0) return;
    ghostShotTimer -= dt;
    if (ghostShotTimer > 0 || enemies.length === 0) return;
    ghostShotTimer = 2;
    const target = enemies.slice().sort((a, b) => distance(player.x, player.y, a.x, a.y) - distance(player.x, player.y, b.x, b.y))[0];
    if (!target) return;
    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    const speed = 12;
    bullets.push({
      x: player.x + Math.cos(angle) * 0.45, y: player.y + Math.sin(angle) * 0.45,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      damage: 5 + (player.ghostLevel - 1) * 3, life: 2.5,
      hitIds: [], ricochetsLeft: 0, pierceLeft: 0, golden: false,
      explosive: false, ghost: true, targetId: target.id, homing: true
    });
  }

  function updatePassiveAbilities(dt) {
    player.invulnerabilityTimer = Math.max(0, player.invulnerabilityTimer - dt);
    bootsBurstCooldown = Math.max(0, bootsBurstCooldown - dt);
    bootsBurstTimer = Math.max(0, bootsBurstTimer - dt);
    lastChanceSpeedTimer = Math.max(0, lastChanceSpeedTimer - dt);
    lastChanceShieldTimer = Math.max(0, lastChanceShieldTimer - dt);
    if (lastChanceHealTimer > 0) lastChanceHealTimer = Math.max(0, lastChanceHealTimer - dt);

    if (player.energyShieldLevel > 0 && playerSilenceTimer <= 0) {
      energyShieldCooldown -= dt;
      if (energyShieldTimer > 0) energyShieldTimer = Math.max(0, energyShieldTimer - dt);
      if (energyShieldCooldown <= 0 && energyShieldTimer <= 0) {
        energyShieldTimer = player.energyShieldLevel === 1 ? 1.5 : 2.0;
        energyShieldCooldown = 20;
      }
    }

    if (player.explosiveLevel > 0 && !explosiveReady && playerSilenceTimer <= 0) {
      explosiveCooldown -= dt;
      if (explosiveCooldown <= 0) explosiveReady = true;
    }

    if (player.timeSlowLevel > 0 && playerSilenceTimer <= 0) {
      timeSlowCooldown -= dt;
      if (timeSlowTimer > 0) timeSlowTimer = Math.max(0, timeSlowTimer - dt);
      if (timeSlowCooldown <= 0 && timeSlowTimer <= 0) {
        timeSlowTimer = 3;
        timeSlowCooldown = 10;
      }
    }

    if (player.impulseLevel > 0) {
      impulseCooldown = Math.max(0, impulseCooldown - dt);
    }

    if (getUpgradeLevel('medic') >= 3) {
      medicRegenTimer -= dt;
      if (medicRegenTimer <= 0) {
        player.hp = Math.min(player.maxHp, player.hp + 1);
        medicRegenTimer = 2;
      }
    }

    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].life -= dt;
      if (explosions[i].life <= 0) explosions.splice(i, 1);
    }
  }

  function updateXpOrbs(dt) {
    for (let i = xpOrbs.length - 1; i >= 0; i--) {
      const orb = xpOrbs[i];
      orb.phase += dt * 4;
      if (distance(player.x, player.y, orb.x, orb.y) <= player.pickupRadius) {
        addExperience(orb.value);
        xpOrbs.splice(i, 1);
        if (upgradeSelection) break;
      }
    }
  }

  function updateMedkits() {
    for (let i = medkits.length - 1; i >= 0; i--) {
      const medkit = medkits[i];
      if (distance(player.x, player.y, medkit.x, medkit.y) <= 0.72) {
        player.hp = Math.min(player.maxHp, player.hp + player.medkitHeal);
        medkits.splice(i, 1);
      }
    }
  }

  function resetRun() {
    resetTouchInput();
    player.x = MAP_SIZE / 2; player.y = MAP_SIZE / 2; player.angle = 0;
    applySelectedCharacterBaseStats();
    player.reloading = false; player.reloadLeft = 0;
    player.pickupRadius = BASE_XP_PICKUP_RADIUS;
    player.damageReduction = 0; player.dodgeChance = 0;
    player.critChance = 0; player.ricochetLevel = 0; player.explosiveLevel = 0;
    player.ghostLevel = 0; player.impulseLevel = 0; player.energyShieldLevel = 0;
    player.timeSlowLevel = 0; player.phoenix = false; player.phoenixUsed = false;
    player.goldenBullet = false; player.lastChance = false; player.medkitHeal = 10;
    player.medkitInterval = 100; player.invulnerabilityTimer = 0;
    for (const key of Object.keys(upgradeLevels)) delete upgradeLevels[key];
    bullets.length = 0; enemyBullets.length = 0; enemies.length = 0; medkits.length = 0;
    xpOrbs.length = 0; damageNumbers.length = 0; explosions.length = 0;
    classTurrets.length = 0; poisonClouds.length = 0; poisonPuddles.length = 0; lightningLinks.length = 0;
    electricWaveCast.remaining = 0; electricWaveCast.timer = 0; electricWaveCast.x = 0; electricWaveCast.y = 0; electricWaves.length = 0;
    elapsed = START_TIME_SECONDS;
    enemyHpMultiplier = Math.pow(1.1, Math.floor(START_TIME_SECONDS / 60));
    nextEnemyHpRampAt = (Math.floor(START_TIME_SECONDS / 60) + 1) * 60;
    bloodMoonActive = (START_TIME_SECONDS >= 180 && START_TIME_SECONDS < 240) || (START_TIME_SECONDS >= 480 && START_TIME_SECONDS < 540);
    spawnRateMultiplier = Math.pow(1.5, Math.floor(START_TIME_SECONDS / 45));
    zombieSpawnAt = elapsed + 2 / spawnRateMultiplier;
    batSpawnAt = Math.max(60, Math.ceil((elapsed + 1e-6) / 5) * 5);
    skeletonHasSpawned = elapsed >= 120;
    skeletonSpawnAt = skeletonHasSpawned ? elapsed + 2 / spawnRateMultiplier : 120;
    nextSpawnRampAt = (Math.floor(START_TIME_SECONDS / 45) + 1) * 45;
    activeBoss = null; activeArena = null; bossProjectiles.length = 0; bossHazards.length = 0;
    sewerBiome = START_TIME_SECONDS >= 595 && START_TIME_SECONDS < 835;
    spiderBiome = START_TIME_SECONDS >= 835;
    firstBossDefeated = START_TIME_SECONDS >= 595;
    secondBossDefeated = START_TIME_SECONDS >= 835;
    spiderQueenDefeated = false;
    boss1Spawned = START_TIME_SECONDS >= 300;
    boss2Spawned = START_TIME_SECONDS >= 600;
    boss3Spawned = START_TIME_SECONDS >= 840;
    spiderWebSlowTimer = 0;
    playerSilenceTimer = 0; bossBannerTimer = 0; bossBannerText = ''; bossRewardPending = false;
    upgradeSelectionMode = 'level'; gameWon = false; victoryTimer = 0;
    postGoblinSurvivalActive = false; postGoblinSurvivalTimer = 0;
    kills = 0; totalXP = 0; xpIntoLevel = 0; currentLevel = 1; xpForNextLevel = 20;
    lastCoinMinuteAwarded = Math.floor(START_TIME_SECONDS / 60); nextCoinKillMilestone = 10; coinToastTimer = 0; coinToastText = '';
    nextMedkitAt = 100; dead = false; paused = false; upgradeSelection = false;
    upgradeChoices = []; upgradeCardRects = []; muzzleFlashTimer = 0; damageFlashTimer = 0;
    hitBannerTimer = 0; lastDamageTaken = 0; timeSlowTimer = 0; timeSlowCooldown = 10;
    energyShieldTimer = 0; energyShieldCooldown = 20; impulseCooldown = 0; player.classAbilityCooldown = 0;
    explosiveCooldown = 10; explosiveReady = false; ghostShotTimer = 2; medicRegenTimer = 2;
    lastChanceUsed = false; lastChanceSpeedTimer = 0; lastChanceShieldTimer = 0;
    lastChanceHealTimer = 0; lastChanceKillCounter = 0; bootsBurstTimer = 0; bootsBurstCooldown = 0;
    playerSilenceTimer = 0; bossBannerTimer = 0; bossBannerText = ''; bossRewardPending = false; upgradeSelectionMode = 'level';
    nextVampirismKillAt = 10;
    scoutStartingUpgradeIds = [];
    if (selectedCharacterId === 'scout') {
      const starterUpgrades = rollUpgradeChoices().slice(0, 2);
      for (const def of starterUpgrades) {
        upgradeLevels[def.id] = 1;
        applyUpgrade(def.id, 1);
        scoutStartingUpgradeIds.push(def.id);
      }
      if (scoutStartingUpgradeIds.length) {
        bossBannerText = `РАЗВЕДЧИК: 2 СТАРТОВЫХ УЛУЧШЕНИЯ`;
        bossBannerTimer = 2.4;
      }
    }
    lastTime = performance.now();
  }

  function drawFloorTile(x, y, sx, sy) {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n = (n ^ (n >>> 16)) >>> 0;
    const shades = spiderBiome
      ? ['#251e2d', '#2b2234', '#30263a', '#211a29']
      : sewerBiome ? ['#252a2b', '#282f30', '#2b3333', '#222829'] : ['#292a2b', '#2c2d2e', '#303031', '#272829'];
    ctx.fillStyle = shades[n % shades.length];
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = 'rgba(8, 9, 10, 0.32)';
    ctx.fillRect(sx, sy + TILE - 1, TILE, 1);
    ctx.fillRect(sx + TILE - 1, sy, 1, TILE);
    if ((n & 7) === 0) {
      ctx.fillStyle = '#202122';
      ctx.fillRect(sx + 7 + (n % 9), sy + 8 + ((n >>> 5) % 10), 4, 1);
      ctx.fillRect(sx + 10 + (n % 7), sy + 9 + ((n >>> 7) % 8), 1, 3);
    } else if ((n & 15) === 1) {
      ctx.fillStyle = '#3b3b3b';
      ctx.fillRect(sx + 5 + (n % 17), sy + 6 + ((n >>> 4) % 17), 2, 2);
    }
    if (spiderBiome && (n & 7) === 2) {
      ctx.strokeStyle = 'rgba(188,145,210,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx + 3, sy + 4); ctx.lineTo(sx + TILE - 4, sy + TILE - 5);
      ctx.moveTo(sx + TILE - 4, sy + 4); ctx.lineTo(sx + 3, sy + TILE - 5); ctx.stroke();
    }
  }

  function drawWallTile(sx, sy, x, y) {
    ctx.fillStyle = spiderBiome ? '#17121d' : '#17191c'; ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = spiderBiome ? '#4b3b55' : '#45464a'; ctx.fillRect(sx + 1, sy + 1, TILE - 2, 5);
    ctx.fillStyle = spiderBiome ? '#30263a' : '#303236'; ctx.fillRect(sx + 1, sy + 6, TILE - 2, TILE - 7);
    ctx.fillStyle = spiderBiome ? '#735681' : '#56575b'; ctx.fillRect(sx + 3, sy + 7, TILE - 6, 1);
    ctx.fillStyle = spiderBiome ? '#241b2b' : '#222428'; ctx.fillRect(sx + 2, sy + 15, TILE - 4, 1);
    if ((x + y) % 2 === 0) {
      ctx.fillStyle = '#202226'; ctx.fillRect(sx + 15, sy + 7, 1, 9);
    }
  }

  function drawMap(camera) {
    ctx.fillStyle = '#101114';
    ctx.fillRect(0, 0, screenW, screenH);
    const startX = clamp(Math.floor(camera.x / TILE), 0, MAP_SIZE - 1);
    const startY = clamp(Math.floor(camera.y / TILE), 0, MAP_SIZE - 1);
    const endX = clamp(Math.ceil((camera.x + screenW) / TILE), 0, MAP_SIZE);
    const endY = clamp(Math.ceil((camera.y + screenH) / TILE), 0, MAP_SIZE);
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const sx = Math.floor(x * TILE - camera.x);
        const sy = Math.floor(y * TILE - camera.y);
        if (activeArena) {
          const lx = x - activeArena.x, ly = y - activeArena.y;
          const inside = lx >= 0 && ly >= 0 && lx < activeArena.size && ly < activeArena.size;
          if (!inside) { ctx.fillStyle = '#08090b'; ctx.fillRect(sx, sy, TILE, TILE); }
          else if (lx === 0 || ly === 0 || lx === activeArena.size - 1 || ly === activeArena.size - 1) drawWallTile(sx, sy, lx, ly);
          else {
            drawFloorTile(x, y, sx, sy);
            if (sewerBiome && (x * 7 + y * 11) % 71 === 0) { ctx.fillStyle = 'rgba(92, 151, 104, 0.18)'; ctx.fillRect(sx + 4, sy + 5, 23, 3); }
            if (spiderBiome && (x * 13 + y * 5) % 83 === 0) { ctx.strokeStyle = 'rgba(193,151,218,0.33)'; ctx.beginPath(); ctx.moveTo(sx+4,sy+4); ctx.lineTo(sx+28,sy+28); ctx.moveTo(sx+28,sy+4); ctx.lineTo(sx+4,sy+28); ctx.stroke(); }
          }
        } else {
          const isWall = x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1;
          if (isWall) drawWallTile(sx, sy, x, y);
          else {
            drawFloorTile(x, y, sx, sy);
            if (sewerBiome && (x * 7 + y * 11) % 79 === 0) { ctx.fillStyle = 'rgba(68, 135, 91, 0.18)'; ctx.fillRect(sx + 5, sy + 8, 20, 3); }
            if (spiderBiome && (x * 17 + y * 11) % 97 === 0) { ctx.strokeStyle = 'rgba(193,151,218,0.28)'; ctx.beginPath(); ctx.moveTo(sx+4,sy+4); ctx.lineTo(sx+28,sy+28); ctx.moveTo(sx+28,sy+4); ctx.lineTo(sx+4,sy+28); ctx.stroke(); }
          }
        }
      }
    }
  }

  function drawBullets(camera) {
    for (const bullet of bullets) {
      const sx = bullet.x * TILE - camera.x;
      const sy = bullet.y * TILE - camera.y;
      const angle = Math.atan2(bullet.vy, bullet.vx);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      if (bullet.projectileType === 'lightning') {
        // The Electrician fires a moving jagged lightning bolt, not a round bullet or orb.
        const flicker = Math.sin(performance.now() * 0.045 + bullet.x * 13 + bullet.y * 7) * 2;
        ctx.shadowColor = '#54eaff'; ctx.shadowBlur = 13;
        ctx.strokeStyle = '#62eaff'; ctx.lineWidth = 3.2; ctx.lineCap = 'square';
        ctx.beginPath(); ctx.moveTo(-11, 1); ctx.lineTo(-6, -2 + flicker); ctx.lineTo(-2, 2); ctx.lineTo(2, -4 - flicker * 0.4); ctx.lineTo(6, 1); ctx.lineTo(11, -1); ctx.stroke();
        ctx.strokeStyle = '#e1ffff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-2, 2); ctx.lineTo(2, -3); ctx.lineTo(6, 1); ctx.stroke();
      } else if (bullet.projectileType === 'medic') {
        // Medic ammunition is visibly red rather than the standard brass projectile.
        ctx.shadowColor = '#ff5368'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#cf344c'; ctx.fillRect(-5, -2, 10, 4);
        ctx.fillStyle = '#ff9aa5'; ctx.fillRect(1, -1, 4, 2);
        ctx.fillStyle = '#fff0f0'; ctx.fillRect(3, -1, 2, 2);
      } else if (bullet.projectileType === 'flask') {
        // A small green glass flask with a cork, thrown toward the cursor.
        ctx.shadowColor = '#8ce66c'; ctx.shadowBlur = 7;
        ctx.fillStyle = '#314d35'; ctx.fillRect(-4, -3, 8, 7);
        ctx.fillStyle = '#75c85f'; ctx.fillRect(-3, -2, 6, 5);
        ctx.fillStyle = '#c8f58c'; ctx.fillRect(-2, -1, 3, 2);
        ctx.fillStyle = '#8a6540'; ctx.fillRect(3, -2, 3, 4);
        ctx.fillStyle = '#d7bd87'; ctx.fillRect(4, -1, 2, 2);
      } else {
        ctx.fillStyle = bullet.ghost ? '#b98cff' : (bullet.golden ? '#ffe17d' : bullet.shotgunPellet ? '#e8d7b5' : '#f2d18a');
        ctx.fillRect(-4, bullet.shotgunPellet ? -1 : -2, 8, bullet.shotgunPellet ? 2 : 4);
        ctx.fillStyle = bullet.ghost ? '#f0dcff' : '#fff0c5'; ctx.fillRect(1, -1, 3, 2);
      }
      ctx.restore();
    }
  }

  function drawEnemyBullets(camera) {
    for (const arrow of enemyBullets) {
      const sx = arrow.x * TILE - camera.x;
      const sy = arrow.y * TILE - camera.y;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(arrow.angle);
      ctx.fillStyle = '#9b754d'; ctx.fillRect(-8, -1, 14, 2);
      ctx.fillStyle = '#d6d0bd'; ctx.fillRect(4, -2, 5, 4);
      ctx.fillStyle = '#5b4937'; ctx.fillRect(-8, -3, 2, 6);
      ctx.restore();
    }
  }

  function drawXpOrbs(camera) {
    for (const orb of xpOrbs) {
      const sx = orb.x * TILE - camera.x;
      const sy = orb.y * TILE - camera.y + Math.sin(orb.phase) * 2;
      const pulse = 0.5 + Math.sin(orb.phase * 1.4) * 0.15;
      ctx.save();
      ctx.globalAlpha = 0.28 + pulse * 0.22;
      ctx.fillStyle = '#a76aff';
      ctx.beginPath();
      ctx.arc(sx, sy, 10 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(xpSprite, Math.round(sx - 9), Math.round(sy - 9), 18, 18);
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#170f22';
      ctx.strokeText(`${orb.value} XP`, sx, sy - 13);
      ctx.fillStyle = '#e4caff';
      ctx.fillText(`${orb.value} XP`, sx, sy - 13);
      ctx.restore();
    }
  }

  function drawPickupRadius(camera) {
    const sx = player.x * TILE - camera.x;
    const sy = player.y * TILE - camera.y;
    const radius = player.pickupRadius * TILE;
    ctx.save();
    ctx.strokeStyle = 'rgba(177, 119, 255, 0.48)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(151, 94, 220, 0.045)';
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMedkits(camera) {
    const pulse = 0.5 + Math.sin(elapsed * 5) * 0.12;
    for (const medkit of medkits) {
      const sx = medkit.x * TILE - camera.x;
      const sy = medkit.y * TILE - camera.y;
      ctx.fillStyle = `rgba(200, 65, 75, ${pulse})`;
      ctx.fillRect(Math.round(sx - 9), Math.round(sy - 8), 18, 16);
      ctx.fillStyle = '#e8dfd7'; ctx.fillRect(Math.round(sx - 6), Math.round(sy - 6), 12, 12);
      ctx.fillStyle = '#b8424c'; ctx.fillRect(Math.round(sx - 2), Math.round(sy - 5), 4, 10);
      ctx.fillRect(Math.round(sx - 5), Math.round(sy - 2), 10, 4);
    }
  }

  function drawEnemies(camera) {
    // Draw back-to-front by Y, so sprites overlap more naturally.
    const ordered = enemies.slice().sort((a, b) => a.y - b.y);
    for (const enemy of ordered) {
      const sx = enemy.x * TILE - camera.x;
      const sy = enemy.y * TILE - camera.y;
      const size = enemy.type === 'skeleton' ? 30 : enemy.type === 'ratling' ? 23 : enemy.type === 'spiderling' ? 22 : 27;
      ctx.save();
      ctx.translate(sx, sy);
      if (enemy.type !== 'bat') ctx.rotate(enemy.angle);
      ctx.drawImage(enemy.sprite, -size / 2, -size / 2, size, size);
      ctx.restore();

      if (enemy.hp < enemy.maxHp || enemy.type === 'skeleton') {
        const barW = 25;
        const barY = sy - 19;
        ctx.fillStyle = '#151519'; ctx.fillRect(sx - barW / 2, barY, barW, 4);
        ctx.fillStyle = enemy.type === 'bat' ? '#a66baf' : '#a64a55';
        ctx.fillRect(sx - barW / 2 + 1, barY + 1, Math.max(0, (barW - 2) * enemy.hp / enemy.maxHp), 2);
      }

      if (enemy.hitFlash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${enemy.hitFlash * 3})`;
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
    }
  }

  function drawBossProjectiles(camera) {
    for (const p of bossProjectiles) {
      const sx = p.x * TILE - camera.x, sy = p.y * TILE - camera.y;
      ctx.save();
      if (p.kind === 'dynamite') {
        ctx.translate(sx, sy); ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = '#8f3329'; ctx.fillRect(-9, -4, 18, 8);
        ctx.fillStyle = '#e3b35b'; ctx.fillRect(-7, -2, 3, 4);
        ctx.fillStyle = '#f7d07a'; ctx.fillRect(8, -2, 3, 4);
        ctx.restore();
        ctx.fillStyle = '#ff9c52'; ctx.beginPath(); ctx.arc(sx + 8, sy - 7, 2 + Math.sin(elapsed * 18) * 1.2, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      if (p.kind === 'hook') {
        ctx.translate(sx, sy); ctx.rotate(p.angle);
        ctx.strokeStyle = '#c4c0b6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.strokeStyle = '#e0d8c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(10, 0, 5, -1.2, 1.2); ctx.stroke();
      } else if (p.kind === 'shard') {
        ctx.translate(sx, sy); ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = '#e8c17b'; ctx.fillRect(-5, -2, 10, 4);
      }
      ctx.restore();
    }
    for (const h of bossHazards) {
      const sx = h.x * TILE - camera.x, sy = h.y * TILE - camera.y;
      if (h.kind === 'spiderWeb') {
        const warning = h.warning > 0;
        const pulse = 0.55 + Math.sin(elapsed * 8) * 0.12;
        ctx.save();
        ctx.globalAlpha = warning ? 0.35 + pulse * 0.35 : 0.48;
        ctx.strokeStyle = warning ? '#f0c9ff' : '#c48bdc';
        ctx.fillStyle = warning ? 'rgba(210,150,235,0.10)' : 'rgba(162,100,190,0.20)';
        ctx.lineWidth = warning ? 2 : 1.6;
        ctx.setLineDash(warning ? [5, 5] : [2, 4]);
        ctx.beginPath(); ctx.arc(sx, sy, h.radius * TILE, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        for (let spoke = 0; spoke < 8; spoke++) {
          const a = Math.PI * 2 * spoke / 8;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * h.radius * TILE, sy + Math.sin(a) * h.radius * TILE); ctx.stroke();
        }
        for (let ring = 1; ring <= 3; ring++) {
          ctx.beginPath(); ctx.arc(sx, sy, h.radius * TILE * ring / 4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      if (h.kind === 'spiderShockwave') {
        const pulse = 1 + Math.sin(elapsed * 18) * 0.05;
        ctx.save();
        ctx.globalAlpha = h.fuse > 0 ? 0.48 : 0.7;
        ctx.strokeStyle = '#d5a0ef'; ctx.fillStyle = 'rgba(168,105,205,0.12)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, h.radius * TILE * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.fillStyle = '#742c28'; ctx.fillRect(sx - 9, sy - 5, 18, 10);
      ctx.strokeStyle = '#ff9b4f'; ctx.lineWidth = 2; ctx.strokeRect(sx - 9, sy - 5, 18, 10);
      ctx.fillStyle = '#ffe18b'; ctx.beginPath(); ctx.arc(sx + 8, sy - 7, 2 + Math.sin(elapsed * 20) * 1.1, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBoss(camera) {
    if (!activeBoss) return;
    const b = activeBoss;
    const sx = b.x * TILE - camera.x, sy = b.y * TILE - camera.y;
    const isRat = b.kind === 'rat';
    const isSpider = b.kind === 'spider';
    const w = (isRat ? 3 : isSpider ? 3 : 2) * TILE;
    const h = (isRat ? 4 : isSpider ? 3 : 2) * TILE;
    ctx.save();
    if (b.raged || b.phase === 2 && isRat) {
      ctx.globalAlpha = 0.22 + Math.sin(elapsed * 12) * 0.08;
      ctx.fillStyle = '#ff283f'; ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.72, h * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (isSpider) {
      ctx.globalAlpha = 0.18 + Math.sin(elapsed * 7) * 0.05;
      ctx.fillStyle = '#a64dc3'; ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.82, h * 0.76, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (b.flash > 0) ctx.globalAlpha = 0.45;
    ctx.drawImage(bossSprites[b.kind], sx - w / 2, sy - h / 2, w, h);
    if (b.kind === 'goblin' && b.defeatTimer > 0) {
      ctx.fillStyle = '#a93429'; ctx.fillRect(sx - 5, sy - 2, 10, 5);
      ctx.fillStyle = '#ffd27b'; ctx.fillRect(sx + 4, sy - 6, 3, 3);
    }
    ctx.restore();
    if (isSpider && b.action === 'leap') {
      const tx = b.leapTargetX * TILE - camera.x, ty = b.leapTargetY * TILE - camera.y;
      const r = (b.phase === 3 ? 4.2 : 3.6) * TILE;
      ctx.save(); ctx.strokeStyle = 'rgba(230,170,255,0.82)'; ctx.fillStyle = 'rgba(170,95,210,0.12)'; ctx.lineWidth = 2; ctx.setLineDash([6,5]);
      ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }

    // Boss-specific telegraphs and active ability effects.
    if (isRat && b.echoTimer > 0) {
      ctx.save(); ctx.strokeStyle = 'rgba(235, 87, 99, 0.65)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(sx, sy, (2.5 + (1 - b.echoTimer / (b.phase === 1 ? 3 : 5)) * 7) * TILE, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (isRat && b.animalCryTimer > 0) {
      ctx.save(); ctx.strokeStyle = `rgba(255,70,80,${b.animalCryTimer / 1.6})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(sx, sy, (3 + (1.6 - b.animalCryTimer) * 4) * TILE, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (!isRat && (b.action === 'pyroInhale' || b.action === 'pyroFlame')) {
      const length = 8 * TILE;
      const ex = sx + Math.cos(b.pyroAngle) * length, ey = sy + Math.sin(b.pyroAngle) * length;
      ctx.save(); ctx.lineCap = 'square';
      ctx.strokeStyle = b.action === 'pyroInhale' ? 'rgba(255,170,70,0.35)' : 'rgba(255,94,35,0.75)';
      ctx.lineWidth = b.action === 'pyroInhale' ? 16 : 28;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      if (b.action === 'pyroFlame') { ctx.strokeStyle = 'rgba(255,220,120,0.8)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); }
      ctx.restore();
    }
    if (!isRat && b.action === 'pyroInhale') {
      ctx.fillStyle = 'rgba(255,190,85,0.75)'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('ВДОХ...', sx, sy - h / 2 - 12);
    }
  }

  function drawBossHUD() {
    if (!activeBoss) return;
    const b = activeBoss;
    const width = Math.min(560, screenW - 60), x = (screenW - width) / 2, y = screenH - 94;
    ctx.save();
    ctx.fillStyle = 'rgba(12, 10, 14, 0.94)'; ctx.fillRect(x - 12, y - 30, width + 24, 58);
    ctx.strokeStyle = b.kind === 'rat' ? '#b64d59' : b.kind === 'spider' ? '#a36bc1' : '#c28a47'; ctx.lineWidth = 2; ctx.strokeRect(x - 11, y - 29, width + 22, 56);
    ctx.fillStyle = '#f1e8ed'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${b.name} — ФАЗА ${b.phase}`, screenW / 2, y - 10);
    const fill = b.kind === 'rat' ? '#a94655' : b.kind === 'spider' ? '#874aa4' : '#b77b3b';
    drawBar(x, y, width, 18, Math.max(0, b.hp) / b.maxHp, fill, '#261c20');
    ctx.fillStyle = '#f7e9e9'; ctx.font = 'bold 11px monospace'; ctx.fillText(`${Math.max(0, Math.ceil(b.hp))} / ${b.maxHp} HP`, screenW / 2, y + 14);
    ctx.restore();
  }

  function drawBossBanner() {
    if (bossBannerTimer <= 0 || !bossBannerText) return;
    ctx.save();
    const alpha = Math.min(1, bossBannerTimer / 0.3);
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
    const width = Math.min(screenW - 40, ctx.measureText(bossBannerText).width + 34);
    const x = (screenW - width) / 2, y = activeBoss ? screenH * 0.18 : screenH * 0.25;
    ctx.fillStyle = 'rgba(20, 10, 14, 0.9)'; ctx.fillRect(x, y, width, 40);
    ctx.strokeStyle = activeBoss && activeBoss.kind === 'goblin' ? '#d69c54' : activeBoss && activeBoss.kind === 'spider' ? '#bd85d7' : '#cb5664'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, 40);
    ctx.fillStyle = '#fff0e9'; ctx.fillText(bossBannerText, screenW / 2, y + 26);
    ctx.restore();
  }

  function drawGhostCompanion(camera) {
    if (player.ghostLevel <= 0) return;
    const angle = elapsed * 1.7;
    const gx = player.x + Math.cos(angle) * 0.85;
    const gy = player.y + Math.sin(angle) * 0.85;
    const sx = gx * TILE - camera.x;
    const sy = gy * TILE - camera.y;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.drawImage(ghostSprite, Math.round(sx - 12), Math.round(sy - 12), 24, 24);
    ctx.restore();
  }

  function drawPlayer(camera) {
    const sx = player.x * TILE - camera.x;
    const sy = player.y * TILE - camera.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(player.angle);
    if (player.invulnerabilityTimer > 0 && Math.floor(performance.now() / 55) % 2 === 0) ctx.globalAlpha = 0.38;
    ctx.drawImage(playerSprites[player.characterId] || playerSprite, -TILE / 2, -TILE / 2, TILE, TILE);
    ctx.globalAlpha = 1;
    if (muzzleFlashTimer > 0) {
      ctx.fillStyle = '#ffe4a3'; ctx.fillRect(TILE * 0.44, -2, 7, 4);
      ctx.fillStyle = '#fff7d5'; ctx.fillRect(TILE * 0.57, -1, 4, 2);
    }
    ctx.restore();
  }

  function drawDamageNumbers(camera) {
    for (const item of damageNumbers) {
      const sx = item.x * TILE - camera.x;
      const sy = item.y * TILE - camera.y;
      const alpha = clamp(item.life / 0.28, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = item.crit ? 'bold 21px monospace' : 'bold 18px monospace';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#26090d';
      ctx.strokeText(item.heal ? `+${item.amount}` : `-${item.amount}`, sx, sy);
      ctx.fillStyle = item.heal ? '#8df0a2' : item.electric ? '#8cecff' : item.poison ? '#a9ed70' : item.crit ? '#ffe17d' : '#ff5968';
      ctx.fillText(item.heal ? `+${item.amount}` : `-${item.amount}`, sx, sy);
      ctx.restore();
    }
  }

  function drawHitFeedback() {
    if (damageFlashTimer > 0) {
      const strength = damageFlashTimer / 0.38;
      ctx.save();
      ctx.fillStyle = `rgba(190, 20, 38, ${0.18 * strength})`;
      ctx.fillRect(0, 0, screenW, screenH);
      ctx.strokeStyle = `rgba(255, 55, 70, ${0.85 * strength})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, screenW - 10, screenH - 10);
      ctx.restore();
    }

    if (hitBannerTimer > 0 && !dead) {
      const alpha = clamp(hitBannerTimer / 0.18, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      const label = `ПОЛУЧЕН УРОН: -${lastDamageTaken} HP`;
      ctx.font = 'bold 17px monospace';
      const width = ctx.measureText(label).width + 30;
      const x = (screenW - width) / 2;
      const y = 24;
      ctx.fillStyle = 'rgba(45, 8, 14, 0.92)';
      ctx.fillRect(x, y, width, 34);
      ctx.strokeStyle = '#ef5967';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, width - 2, 32);
      ctx.fillStyle = '#ffe4e7';
      ctx.textAlign = 'center';
      ctx.fillText(label, screenW / 2, y + 23);
      ctx.restore();
    }
  }

  function drawClassObjects(camera) {
    for (const puddle of poisonPuddles) {
      const sx = puddle.x * TILE - camera.x, sy = puddle.y * TILE - camera.y;
      const alpha = 0.52 * clamp(puddle.life / puddle.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#4e9e35';
      ctx.beginPath(); ctx.ellipse(sx, sy, puddle.radius * TILE, puddle.radius * TILE * 0.72, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha + 0.18;
      ctx.strokeStyle = '#b7f078'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy, puddle.radius * TILE * 0.78, puddle.radius * TILE * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      for (let b = 0; b < 4; b++) {
        const a = b * Math.PI * 0.5 + performance.now() * 0.0014;
        const r = puddle.radius * TILE * (0.25 + (b % 2) * 0.24);
        ctx.fillStyle = b % 2 ? '#d0ff91' : '#8bdd56';
        ctx.fillRect(sx + Math.cos(a) * r - 2, sy + Math.sin(a) * r - 2, 4, 4);
      }
      ctx.restore();
    }
    for (const cloud of poisonClouds) {
      const sx = cloud.x * TILE - camera.x, sy = cloud.y * TILE - camera.y;
      const alpha = clamp(cloud.life / cloud.maxLife, 0, 1) * 0.24;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#72d34f'; ctx.beginPath(); ctx.arc(sx, sy, cloud.radius * TILE, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha + 0.12;
      ctx.strokeStyle = '#a7ef70'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(sx, sy, cloud.radius * TILE * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b5f57c';
      for (let b = 0; b < 5; b++) {
        const a = (cloud.life * 1.7 + b * Math.PI * 0.4) % (Math.PI * 2);
        const r = (0.35 + (b % 3) * 0.22) * TILE;
        ctx.fillRect(sx + Math.cos(a) * r - 2, sy + Math.sin(a) * r - 2, 4, 4);
      }
      ctx.restore();
    }
    for (const turret of classTurrets) {
      const sx = turret.x * TILE - camera.x, sy = turret.y * TILE - camera.y;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(turret.angle || 0);
      ctx.fillStyle = '#11171a'; ctx.fillRect(-11, -10, 22, 20);
      ctx.fillStyle = '#788a8b'; ctx.fillRect(-8, -7, 16, 14);
      ctx.fillStyle = '#c2a45b'; ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#29363a'; ctx.fillRect(0, -3, 16, 6);
      ctx.fillStyle = '#8de2db'; ctx.fillRect(9, -2, 6, 4);
      ctx.restore();
    }
    for (const link of lightningLinks) {
      const sx = link.x1 * TILE - camera.x, sy = link.y1 * TILE - camera.y;
      const ex = link.x2 * TILE - camera.x, ey = link.y2 * TILE - camera.y;
      ctx.save(); ctx.globalAlpha = clamp(link.life / link.maxLife, 0, 1);
      ctx.strokeStyle = '#8cecff'; ctx.lineWidth = 3; ctx.shadowColor = '#50d9ff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      ctx.lineTo(mx + (Math.random() - 0.5) * 14, my + (Math.random() - 0.5) * 14);
      ctx.lineTo(ex, ey); ctx.stroke(); ctx.restore();
    }
  }

  function drawElectricWaves(camera) {
    for (const wave of electricWaves) {
      const sx = wave.x * TILE - camera.x;
      const sy = wave.y * TILE - camera.y;
      const radiusPx = wave.radius * TILE;
      const fade = clamp(1 - wave.elapsed / wave.duration, 0, 1);
      if (radiusPx <= 0.5) continue;
      ctx.save();
      ctx.globalAlpha = 0.34 + fade * 0.56;
      ctx.shadowColor = '#49eaff';
      ctx.shadowBlur = 17;
      ctx.strokeStyle = '#55eaff';
      ctx.lineWidth = 5;
      ctx.setLineDash([11, 7]);
      ctx.beginPath();
      ctx.arc(sx, sy, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#d8fbff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0, radiusPx - 4), 0, Math.PI * 2);
      ctx.stroke();
      // Small bright sparks travel around the circumference to make the ring read as electricity.
      ctx.fillStyle = '#c9fbff';
      for (let spark = 0; spark < 12; spark++) {
        const angle = spark * Math.PI / 6 + wave.elapsed * 4.5;
        const wobble = Math.sin(wave.elapsed * 18 + spark * 2.1) * 2.5;
        const r = Math.max(0, radiusPx + wobble);
        ctx.fillRect(sx + Math.cos(angle) * r - 2, sy + Math.sin(angle) * r - 2, 4, 4);
      }
      ctx.restore();
    }
  }

  function drawExplosions(camera) {
    for (const e of explosions) {
      const sx = e.x * TILE - camera.x, sy = e.y * TILE - camera.y;
      const t = 1 - e.life / e.maxLife;
      ctx.save();
      ctx.globalAlpha = 0.68 * (1 - t);
      const ringColor = e.kind === 'explosive' ? '#ff9a43' : e.kind === 'impulse' ? '#d9a0ff' : e.kind === 'poison' ? '#9be86d' : e.kind === 'dash' ? '#b5db7a' : e.kind === 'electric' ? '#55eaff' : '#c98cff';
      const fillColor = e.kind === 'explosive' ? 'rgba(255, 110, 35, 0.22)' : e.kind === 'impulse' ? 'rgba(180, 115, 255, 0.18)' : e.kind === 'poison' ? 'rgba(103, 205, 70, 0.18)' : e.kind === 'dash' ? 'rgba(157, 210, 115, 0.15)' : e.kind === 'electric' ? 'rgba(70, 225, 255, 0.2)' : 'rgba(170, 100, 245, 0.12)';
      ctx.strokeStyle = ringColor; ctx.lineWidth = e.kind === 'explosive' ? 5 : 3;
      ctx.beginPath(); ctx.arc(sx, sy, e.radius * TILE * (0.25 + t), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = fillColor;
      ctx.beginPath(); ctx.arc(sx, sy, e.radius * TILE * (0.25 + t), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawUpgradeOverlay() {
    if (!upgradeSelection) return;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 7, 12, 0.88)'; ctx.fillRect(0, 0, screenW, screenH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0e6ff'; ctx.font = 'bold 28px monospace';
    const overlayTitle = upgradeSelectionMode === 'bossReward' ? 'БЕСПЛАТНОЕ УЛУЧШЕНИЕ!' : 'НОВЫЙ УРОВЕНЬ!';
    ctx.fillText(overlayTitle, screenW / 2, Math.max(58, screenH * 0.16));
    ctx.fillStyle = '#c9bed6'; ctx.font = '14px monospace';
    ctx.fillText(upgradeSelectionMode === 'bossReward' ? 'Награда за победу над Монструозной крысой — выбери одно' : 'Выбери одно улучшение — игра на паузе', screenW / 2, Math.max(84, screenH * 0.16 + 27));

    const count = upgradeChoices.length;
    const gap = 14;
    const cardW = Math.min(270, (screenW - 50 - gap * (count - 1)) / Math.max(1, count));
    const cardH = Math.min(270, Math.max(205, screenH * 0.40));
    const totalW = count * cardW + Math.max(0, count - 1) * gap;
    const startX = (screenW - totalW) / 2;
    const y = (screenH - cardH) / 2 + 16;
    upgradeCardRects = [];

    upgradeChoices.forEach((def, i) => {
      const x = startX + i * (cardW + gap);
      upgradeCardRects.push({ x, y, w: cardW, h: cardH });
      const rarityColor = upgradeRarityColors[def.rarity] || '#ddd';
      const current = getUpgradeLevel(def.id);
      const next = current + 1;
      ctx.fillStyle = 'rgba(26, 23, 34, 0.98)'; ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = rarityColor; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, cardW - 3, cardH - 3);
      ctx.fillStyle = rarityColor; ctx.fillRect(x + 2, y + 2, cardW - 4, 6);
      ctx.textAlign = 'left';
      ctx.fillStyle = rarityColor; ctx.font = 'bold 11px monospace';
      ctx.fillText(def.rarity.toUpperCase(), x + 13, y + 28);
      ctx.fillStyle = '#f3edf8'; ctx.font = 'bold 16px monospace';
      const title = def.name;
      ctx.fillText(title.length > 24 ? title.slice(0, 22) + '…' : title, x + 13, y + 57);
      ctx.fillStyle = '#c4bacd'; ctx.font = '12px monospace';
      ctx.fillText(`УРОВЕНЬ ${next}${def.max > 1 ? ` / ${def.max}` : ''}`, x + 13, y + 82);
      const description = def.description(next);
      const words = description.split(' ');
      let line = '', lineY = y + 112;
      const maxTextW = cardW - 26;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxTextW && line) {
          ctx.fillText(line, x + 13, lineY); line = word; lineY += 18;
        } else line = test;
      }
      if (line) ctx.fillText(line, x + 13, lineY);
      ctx.fillStyle = '#8d819a'; ctx.font = '11px monospace';
      ctx.fillText(`НАЖМИ ${i + 1} ИЛИ КЛИКНИ`, x + 13, y + cardH - 18);
    });
    if (!count) {
      ctx.fillStyle = '#f1e6f7'; ctx.font = '16px monospace';
      ctx.fillText('Все улучшения достигли максимального уровня.', screenW / 2, y + cardH / 2);
      ctx.fillText('Нажми Enter, чтобы продолжить.', screenW / 2, y + cardH / 2 + 28);
    }
    ctx.restore();
  }


  function escapeUiText(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function uiButton(label, action, extra = '') {
    return `<button type="button" class="rl-ui-btn ${extra}" data-ui-action="${action}">${label}</button>`;
  }

  function coinIconHtml() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4" y="1" width="8" height="1" fill="#69400f"/><rect x="2" y="2" width="12" height="1" fill="#9a5b16"/>
      <rect x="1" y="3" width="14" height="9" fill="#bf7d1e"/><rect x="2" y="4" width="12" height="7" fill="#efc451"/>
      <rect x="3" y="5" width="10" height="5" fill="#f7d977"/><rect x="5" y="5" width="2" height="1" fill="#fff0a8"/>
      <rect x="6" y="6" width="4" height="4" fill="#bd791d"/><rect x="7" y="7" width="2" height="2" fill="#ffe59a"/>
      <rect x="2" y="12" width="12" height="1" fill="#8e5011"/><rect x="4" y="13" width="8" height="1" fill="#63380d"/>
    </svg>`;
  }

  function buildMainMenuHtml() {
    return `<div class="rl-ui-panel">
      <h1 class="rl-ui-title">PIXEL ROGUELIKE</h1>
      <p class="rl-ui-subtitle">2D roguelike shooter · вид сверху · пиксельный мир</p>
      <div class="rl-coin-wallet">${coinIconHtml()}<span class="rl-coin-wallet-copy"><small>ТВОИ МОНЕТЫ</small><strong>${coinBalance.toLocaleString(currentLanguage === 'en' ? 'en-US' : currentLanguage === 'uk' ? 'uk-UA' : 'ru-RU')}</strong></span></div>
      <div class="rl-ui-menu-buttons">
        ${uiButton('ИГРАТЬ', 'play', 'primary')}
        ${uiButton('ПЕРСОНАЖИ', 'characters')}
        ${uiButton('УСИЛЕНИЯ И СТАТИСТИКА', 'open-upgrades')}
        ${uiButton('НАСТРОЙКИ', 'open-settings', 'muted')}
      </div>
      <p class="rl-ui-note">Сейчас выбран персонаж: ${CHARACTER_DEFINITIONS[selectedCharacterId].name}.</p>
      <p class="rl-ui-note">${escapeUiText(CHARACTER_DEFINITIONS[selectedCharacterId].abilityDescription || '')}</p>
    </div>`;
  }

  function buildSettingsHtml() {
    return `<div class="rl-ui-panel" style="width:min(620px,96vw)">
      <h2 class="rl-ui-title">НАСТРОЙКИ ИГРЫ</h2>
      <p class="rl-ui-subtitle">Здесь можно изменить язык и способ управления. Настройки сохраняются в этом браузере.</p>
      <div class="rl-settings-block">
        <p class="rl-settings-label">ЯЗЫК</p>
        <div class="rl-settings-options">
          ${uiButton('Русский', 'language-ru', currentLanguage === 'ru' ? 'selected' : 'muted')}
          ${uiButton('English', 'language-en', currentLanguage === 'en' ? 'selected' : 'muted')}
          ${uiButton('Українська', 'language-uk', currentLanguage === 'uk' ? 'selected' : 'muted')}
        </div>
      </div>
      <div class="rl-settings-block">
        <p class="rl-settings-label">УПРАВЛЕНИЕ</p>
        <div class="rl-settings-options two">
          ${uiButton('ПК', 'control-pc', controlMode === 'pc' ? 'selected' : 'muted')}
          ${uiButton('ТЕЛЕФОН', 'control-mobile', controlMode === 'mobile' ? 'selected' : 'muted')}
        </div>
        <p class="rl-settings-hint">${controlMode === 'pc' ? 'ПК: WASD — движение · мышь — прицел · ЛКМ — стрельба.' : 'Телефон: левый джойстик — движение · правый — прицел и стрельба.'}</p>
      </div>
      <div class="rl-ui-footer">${uiButton('НАЗАД В МЕНЮ', 'back-menu', 'primary')}</div>
    </div>`;
  }

  function characterStatHtml(label, value) {
    return `<div class="rl-character-stat"><span>${escapeUiText(label)}</span><strong>${escapeUiText(value)}</strong></div>`;
  }

  function buildCharacterCard(characterId) {
    const definition = CHARACTER_DEFINITIONS[characterId];
    const unlocked = unlockedCharacterIds.has(characterId);
    const selected = selectedCharacterId === characterId;
    let actionButton;
    if (selected) {
      actionButton = '<button type="button" class="rl-ui-btn muted" disabled>ВЫБРАН</button>';
    } else if (unlocked) {
      actionButton = uiButton(`ВЫБРАТЬ ${definition.name.toUpperCase()}`, `select-${characterId}`, 'primary');
    } else if (coinBalance >= definition.price) {
      actionButton = uiButton(`КУПИТЬ ЗА ${definition.price} 🪙`, `buy-${characterId}`, 'primary');
    } else {
      actionButton = '<button type="button" class="rl-ui-btn muted" disabled>НЕДОСТАТОЧНО МОНЕТ</button>';
    }

    const damageText = characterId === 'alchemist'
      ? '10 HP по площади + 2 HP от яда'
      : definition.pellets > 1
        ? `${definition.damage} × ${definition.pellets} = ${definition.damage * definition.pellets} HP`
        : characterId === 'electrician' ? '12 HP / выстрел + цепь' : `${definition.damage} HP / снаряд`;
    const stats = [
      characterStatHtml('ЗДОРОВЬЕ', `${definition.hp} HP`),
      characterStatHtml('УРОН', damageText),
      characterStatHtml('СКОРОСТЬ', `${Math.round(definition.speedMultiplier * 100)}%`),
      characterStatHtml('ОБОЙМА', `${definition.magazine} патронов`),
      characterStatHtml('ДАЛЬНОСТЬ', `${definition.range} блоков`),
      characterStatHtml('ОРУЖИЕ', definition.weapon),
      characterStatHtml('ОСОБЕННОСТЬ', definition.abilityDescription || 'Нет')
    ].join('');
    const portrait = playerSprites[characterId] ? playerSprites[characterId].toDataURL() : playerSprite.toDataURL();
    const tag = definition.price === 0
      ? 'Стартовый персонаж · бесплатно'
      : unlocked ? 'Персонаж открыт' : `Закрытый персонаж · цена ${definition.price} монет`;

    return `<section class="rl-character-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}">
      <div class="rl-character-head">
        <div class="rl-character-portrait"><img src="${portrait}" alt="${escapeUiText(definition.name)}" style="${unlocked ? '' : 'filter:grayscale(.75) brightness(.62)'}"></div>
        <div><h3 class="rl-character-name">${escapeUiText(definition.name.toUpperCase())}</h3><div class="rl-character-tag">${escapeUiText(tag)}</div><div class="rl-character-tag">${escapeUiText(definition.role || '')}</div>${selected ? '<div class="rl-character-tag" style="color:#c9a3ed;margin-top:5px">● ВЫБРАН</div>' : ''}</div>
      </div>
      <div class="rl-character-stats">${stats}</div>
      ${actionButton}
    </section>`;
  }

  function buildCharactersHtml() {
    const cards = Object.keys(CHARACTER_DEFINITIONS).map(buildCharacterCard).join('');
    return `<div class="rl-ui-panel" style="width:min(1000px,96vw)">
      <h2 class="rl-ui-title">ВЫБОР ПЕРСОНАЖА</h2>
      <p class="rl-ui-subtitle">Выбери героя для следующего забега. Купленные персонажи сохраняются в этом браузере.</p>
      <div class="rl-coin-wallet">${coinIconHtml()}<span class="rl-coin-wallet-copy"><small>ТВОИ МОНЕТЫ</small><strong>${coinBalance.toLocaleString('ru-RU')}</strong></span></div>
      <div class="rl-character-grid">${cards}</div>
      <p class="rl-character-message">${escapeUiText(characterUiMessage)}</p>
      <div class="rl-ui-footer">${uiButton('НАЗАД В МЕНЮ', 'back-menu', 'muted')}</div>
    </div>`;
  }

  function selectCharacter(characterId) {
    if (!CHARACTER_DEFINITIONS[characterId] || !unlockedCharacterIds.has(characterId)) return;
    selectedCharacterId = characterId;
    characterUiMessage = `${CHARACTER_DEFINITIONS[selectedCharacterId].name} выбран для следующего забега.`;
    saveCharacterProfile();
    resetRun();
    uiOverlayMode = '';
    updateUiOverlay();
  }

  function buyCharacter(characterId) {
    const definition = CHARACTER_DEFINITIONS[characterId];
    if (!definition) return;
    if (unlockedCharacterIds.has(characterId)) { selectCharacter(characterId); return; }
    if (coinBalance < definition.price) {
      characterUiMessage = `Не хватает ${definition.price - coinBalance} монет.`;
      uiOverlayMode = '';
      updateUiOverlay();
      return;
    }
    coinBalance -= definition.price;
    saveCoinBalance();
    unlockedCharacterIds.add(characterId);
    selectedCharacterId = characterId;
    characterUiMessage = `${definition.name} куплен и выбран!`;
    saveCharacterProfile();
    resetRun();
    uiOverlayMode = '';
    updateUiOverlay();
  }

  function buildUpgradeMenuHtml() {
    const selectedDef = CHARACTER_DEFINITIONS[selectedCharacterId] || CHARACTER_DEFINITIONS.shooter;
    const weaponDamageText = player.characterId === 'alchemist'
      ? `${Math.round(player.bulletDamage)} HP по площади + яд 2 HP`
      : player.characterId === 'electrician'
        ? `${Math.round(player.bulletDamage)} HP / выстрел + цепная молния`
        : player.pelletCount > 1
          ? `${Math.round(player.bulletDamage)} × ${player.pelletCount} = ${Math.round(player.bulletDamage * player.pelletCount)} HP`
          : `${Math.round(player.bulletDamage)} HP / снаряд`;
    const stats = [
      ['Персонаж', selectedDef.name],
      ['Здоровье', `${Math.round(player.hp)} / ${Math.round(player.maxHp)} HP`],
      ['Оружие', selectedDef.weapon],
      ['Уникальная способность', selectedDef.abilityName || 'Нет'],
      ['Перезарядка навыка', selectedDef.activeAbility ? `${(player.classAbilityCooldown || 0).toFixed(1)} / ${selectedDef.abilityCooldown} сек.` : 'Пассивная способность / нет'],
      ['Урон', weaponDamageText],
      ['Дальность стрельбы', `${player.range} блоков`],
      ['Обойма', `${player.ammo} / ${player.maxAmmo}`],
      ['Перезарядка', `${player.reloadDuration.toFixed(2)} сек.`],
      ['Скорость', `${Math.round(player.speed / PLAYER_SPEED * 100)}%`],
      ['Радиус сбора XP', `${player.pickupRadius.toFixed(2)} блока`],
      ['Снижение урона', `${Math.round(player.damageReduction * 100)}%`],
      ['Шанс уклонения', `${Math.round(player.dodgeChance * 100)}%`],
      ['Шанс крит. удара', `${Math.round(player.critChance * 100)}%`],
      ['Уровень', `${currentLevel}`],
      ['Убийства', `${kills}`],
      ['Всего опыта', `${totalXP} XP`],
      ['Монеты', `${coinBalance} 🪙`]
    ];
    const statHtml = stats.map(([label, value]) => `<div class="rl-ui-stat"><span>${escapeUiText(label)}</span><strong>${escapeUiText(value)}</strong></div>`).join('');
    const upgradeHtml = upgradeDefinitions.map(def => {
      const level = getUpgradeLevel(def.id);
      const preview = def.description(Math.max(1, level));
      const color = upgradeRarityColors[def.rarity] || '#9b91a4';
      const maxLabel = Number.isFinite(def.max) ? def.max : '∞';
      return `<div class="rl-ui-upgrade" style="--rarity:${color}"><strong>${escapeUiText(def.name)} <span style="color:${color};font-weight:normal">· ${escapeUiText(def.rarity)}</span></strong><small>Уровень: ${level}/${maxLabel}</small><small>${escapeUiText(preview)}</small></div>`;
    }).join('');
    return `<div class="rl-ui-panel">
      <h2 class="rl-ui-title">СТАТИСТИКА И УСИЛЕНИЯ</h2>
      <p class="rl-ui-subtitle">Текущие характеристики героя и полный каталог доступных улучшений.</p>
      <h3 class="rl-ui-section-title">ХАРАКТЕРИСТИКИ ПЕРСОНАЖА</h3>
      <div class="rl-ui-stats">${statHtml}</div>
      <h3 class="rl-ui-section-title">ВСЕ УЛУЧШЕНИЯ (${upgradeDefinitions.length})</h3>
      <div class="rl-ui-upgrades">${upgradeHtml}</div>
      <div class="rl-ui-footer">${uiButton('НАЗАД В МЕНЮ', 'back-menu', 'primary')}</div>
    </div>`;
  }

  function buildStatusOverlayHtml(mode) {
    if (mode === 'pause') {
      return `<div class="rl-ui-panel" style="width:min(460px,94vw);text-align:center">
        <h2 class="rl-ui-title">ПАУЗА</h2><p class="rl-ui-subtitle">Забег приостановлен.</p>
        <div class="rl-ui-menu-buttons">${uiButton('ПРОДОЛЖИТЬ', 'resume', 'primary')}${uiButton('ВЫХОД В МЕНЮ', 'exit-menu', 'muted')}</div>
      </div>`;
    }
    if (mode === 'dead') {
      return `<div class="rl-ui-panel" style="width:min(520px,94vw);text-align:center">
        <h2 class="rl-ui-title" style="color:#f0b8c0">ЗАБЕГ ОКОНЧЕН</h2>
        <p class="rl-ui-subtitle">Убийства: ${kills} · Опыт: ${totalXP} · Время: ${formatTime(elapsed)}</p>
        <div class="rl-ui-menu-buttons">${uiButton('ПОПРОБОВАТЬ СНОВА', 'retry', 'primary')}${uiButton('ВЫХОД В МЕНЮ', 'exit-menu', 'muted')}</div>
      </div>`;
    }
    return `<div class="rl-ui-panel" style="width:min(560px,94vw);text-align:center">
      <h2 class="rl-ui-title" style="color:#ffd18a">ПОБЕДА!</h2>
      <p class="rl-ui-subtitle">Ты прошёл все испытания и завершил забег!<br>Убийства: ${kills} · Опыт: ${totalXP} · Время: ${formatTime(elapsed)}</p>
      <div class="rl-ui-menu-buttons">${uiButton('ИГРАТЬ СНОВА', 'retry', 'primary')}${uiButton('ВЫХОД В МЕНЮ', 'exit-menu', 'muted')}</div>
    </div>`;
  }

  function updateUiOverlay() {
    syncTouchControlsVisibility();
    const mode = menuVisible ? `menu:${menuPage}` : paused ? 'pause' : dead ? 'dead' : gameWon ? 'win' : '';
    // Always hide the overlay when gameplay has no modal screen. This must
    // happen even when uiOverlayMode is already an empty string (the Play bug).
    if (!mode) {
      uiOverlayMode = '';
      uiOverlay.style.display = 'none';
      uiOverlay.innerHTML = '';
      return;
    }
    if (mode === uiOverlayMode) return;
    uiOverlayMode = mode;
    uiOverlay.style.display = 'flex';
    if (mode === 'menu:main') uiOverlay.innerHTML = localizeMarkup(buildMainMenuHtml());
    else if (mode === 'menu:characters') uiOverlay.innerHTML = localizeMarkup(buildCharactersHtml());
    else if (mode === 'menu:upgrades') uiOverlay.innerHTML = localizeMarkup(buildUpgradeMenuHtml());
    else if (mode === 'menu:settings') uiOverlay.innerHTML = localizeMarkup(buildSettingsHtml());
    else uiOverlay.innerHTML = localizeMarkup(buildStatusOverlayHtml(mode));
  }

  function returnToMainMenu() {
    menuVisible = true;
    menuPage = 'main';
    paused = false;
    for (const key of Object.keys(keys)) keys[key] = false;
    uiOverlayMode = '';
    updateUiOverlay();
  }

  function startNewRunFromMenu() {
    resetRun();
    menuVisible = false;
    menuPage = 'main';
    uiOverlayMode = '';
    updateUiOverlay();
    syncTouchControlsVisibility();
    canvas.focus();
  }

  function onUiOverlayClick(event) {
    const button = event.target && event.target.closest ? event.target.closest('button[data-ui-action]') : null;
    if (!button || button.disabled) return;
    const action = button.getAttribute('data-ui-action');
    if (action === 'play' || action === 'retry') startNewRunFromMenu();
    else if (action === 'control-pc') { saveControlMode('pc'); uiOverlayMode = ''; updateUiOverlay(); }
    else if (action === 'control-mobile') { saveControlMode('mobile'); uiOverlayMode = ''; updateUiOverlay(); }
    else if (action === 'language-ru' || action === 'language-en' || action === 'language-uk') { currentLanguage = action.slice('language-'.length); saveUiSettings(); applyTouchControlLanguage(); uiOverlayMode = ''; updateUiOverlay(); }
    else if (action === 'open-settings') { menuPage = 'settings'; uiOverlayMode = ''; updateUiOverlay(); }
    else if (action === 'characters') { menuPage = 'characters'; characterUiMessage = ''; uiOverlayMode = ''; updateUiOverlay(); }
    else if (action.startsWith('select-')) selectCharacter(action.slice('select-'.length));
    else if (action.startsWith('buy-')) buyCharacter(action.slice('buy-'.length));
    else if (action === 'open-upgrades') { menuPage = 'upgrades'; uiOverlayMode = ''; updateUiOverlay(); }
    else if (action === 'back-menu') { menuPage = 'main'; uiOverlayMode = ''; updateUiOverlay(); }
    else if (action === 'resume') { paused = false; uiOverlayMode = ''; updateUiOverlay(); canvas.focus(); }
    else if (action === 'exit-menu') returnToMainMenu();
  }

  function drawBar(x, y, width, height, ratio, fill, background = '#17191d') {
    ctx.fillStyle = background; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * clamp(ratio, 0, 1)), height - 2);
    ctx.strokeStyle = '#65636a'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  function awardCoins(amount, reason) {
    const value = Math.max(0, Math.floor(amount));
    if (!value) return;
    coinBalance += value;
    saveCoinBalance();
    coinToastText = `+${value} МОН. · ${reason}`;
    coinToastTimer = 2.2;
  }

  function updateMinuteCoinRewards() {
    const completedMinutes = Math.floor(elapsed / 60);
    while (lastCoinMinuteAwarded < completedMinutes) {
      lastCoinMinuteAwarded += 1;
      awardCoins(10, `ЗА ${lastCoinMinuteAwarded} МИН.`);
    }
  }

  function drawBloodMoonOverlay() {
    if (!bloodMoonActive) return;
    const pulse = 0.17 + (Math.sin(elapsed * 3.2) + 1) * 0.018;
    ctx.save();
    ctx.fillStyle = `rgba(145, 8, 24, ${pulse})`;
    ctx.fillRect(0, 0, screenW, screenH);
    const vignette = ctx.createRadialGradient(screenW / 2, screenH / 2, Math.min(screenW, screenH) * 0.15, screenW / 2, screenH / 2, Math.max(screenW, screenH) * 0.72);
    vignette.addColorStop(0, 'rgba(105, 0, 12, 0)');
    vignette.addColorStop(1, 'rgba(105, 0, 12, 0.18)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();
  }

  function drawHUD() {
    if (controlMode === 'mobile') {
      // Compact phone HUD: only HP, XP and magazine are shown here.
      const panelW = Math.min(184, screenW - 20);
      const panelH = 78;
      const px = 10, py = 10;
      ctx.fillStyle = 'rgba(12, 13, 17, 0.78)';
      ctx.fillRect(px, py, panelW, panelH);
      ctx.strokeStyle = 'rgba(145, 124, 164, 0.72)'; ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1);
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f0dce1';
      ctx.fillText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`, px + 8, py + 14);
      drawBar(px + 8, py + 19, panelW - 16, 6, player.hp / player.maxHp, '#b94f5d', '#39242a');
      ctx.fillStyle = '#ddc8f1';
      ctx.fillText(`LV ${currentLevel} · XP ${xpIntoLevel}/${xpForNextLevel}`, px + 8, py + 39);
      drawBar(px + 8, py + 44, panelW - 16, 6, xpIntoLevel / xpForNextLevel, '#a879d2', '#2e2438');
      ctx.fillStyle = player.reloading ? '#f0c47a' : '#e6e1ed';
      const ammoText = player.reloading ? `ОБОЙМА ${player.ammo}/${player.maxAmmo} · ${player.reloadLeft.toFixed(1)}с` : `ОБОЙМА ${player.ammo}/${player.maxAmmo}`;
      ctx.fillText(ammoText, px + 8, py + 66);
    } else {
      ctx.fillStyle = 'rgba(12, 13, 17, 0.93)';
      ctx.fillRect(14, 14, 330, 205);
      ctx.strokeStyle = '#5b5266'; ctx.lineWidth = 2;
      ctx.strokeRect(15, 15, 328, 203);

      ctx.fillStyle = '#d9c8e7'; ctx.font = 'bold 15px monospace';
      ctx.fillText('PIXEL ROGUELIKE — v5.1', 26, 38);
      ctx.fillStyle = '#e7e1e8'; ctx.font = '14px monospace';
      ctx.fillText(`ЗДОРОВЬЕ  ${player.hp}/${player.maxHp}`, 26, 61);
      drawBar(26, 68, 300, 12, player.hp / player.maxHp, '#a64a55');

      ctx.fillStyle = '#e7e1e8';
      ctx.fillText(`ПАТРОНЫ  ${player.ammo}/${player.maxAmmo}`, 26, 103);
      if (player.reloading) {
        ctx.fillStyle = '#e1bd77';
        ctx.fillText(`ПЕРЕЗАРЯДКА  ${player.reloadLeft.toFixed(1)}с`, 175, 103);
        drawBar(26, 111, 300, 8, 1 - player.reloadLeft / player.reloadDuration, '#b78a4d');
      } else {
        ctx.fillStyle = '#aaa5b0'; ctx.fillText('ГОТОВО', 178, 103);
      }

      ctx.fillStyle = '#d9c8e7';
      ctx.fillText(`ВРЕМЯ  ${formatTime(elapsed)}`, 26, 145);
      ctx.fillStyle = '#e7e1e8';
      ctx.fillText(`УРОВЕНЬ ${currentLevel}   XP ${xpIntoLevel}/${xpForNextLevel}`, 26, 170);
      drawBar(26, 175, 300, 7, xpIntoLevel / xpForNextLevel, '#9d70c7');
      ctx.fillStyle = '#d7baff'; ctx.font = '11px monospace';
      ctx.fillText(`УБИЙСТВА ${kills}   ВСЕГО XP ${totalXP}`, 26, 198);
      ctx.fillStyle = '#b9b1c1';
      ctx.fillText(`ВРАГИ: ${enemies.length}`, 210, 198);

      const infoW = 230;
      ctx.fillStyle = 'rgba(12, 13, 17, 0.88)';
      ctx.fillRect(screenW - infoW - 14, 14, infoW, 164);
      ctx.strokeStyle = '#494650'; ctx.strokeRect(screenW - infoW - 13.5, 14.5, infoW - 1, 163);
      ctx.fillStyle = '#d9c8e7'; ctx.font = 'bold 13px monospace';
      ctx.fillText(activeBoss ? 'АРЕНА БОССА' : sewerBiome ? 'КАНАЛИЗАЦИЯ' : 'ОБЫЧНАЯ АРЕНА', screenW - infoW, 36);
      ctx.fillStyle = '#bdb8c2'; ctx.font = '12px monospace';
      ctx.fillText(activeBoss ? '40 × 40 БЛОКОВ' : '200 × 200 БЛОКОВ', screenW - infoW, 57);
      ctx.fillText(activeBoss ? 'БОССОВОЕ СРАЖЕНИЕ' : sewerBiome ? 'ПОДЗЕМНЫЙ УРОВЕНЬ' : 'ЗОМБИ • МЫШИ • СКЕЛЕТЫ', screenW - infoW, 77);
      if (postGoblinSurvivalActive) {
        ctx.fillStyle = '#ffd58e'; ctx.font = 'bold 11px monospace';
        ctx.fillText(`ФИНАЛЬНАЯ МИНУТА: ${Math.ceil(postGoblinSurvivalTimer)}с`, screenW - infoW, 98);
      }
      if (bloodMoonActive) { ctx.fillStyle = '#ff7884'; ctx.font = 'bold 11px monospace'; ctx.fillText('КРОВАВАЯ ЛУНА: +15% МОБАМ', screenW - infoW, 98); }
      if (explosiveReady) { ctx.fillStyle = '#f2ad69'; ctx.font = 'bold 11px monospace'; ctx.fillText('ВЗРЫВНАЯ ПУЛЯ ГОТОВА', screenW - infoW, bloodMoonActive ? 116 : 105); }
      if (player.impulseLevel > 0) { ctx.fillStyle = impulseCooldown <= 0 ? '#d9b5ff' : '#a89bb5'; ctx.font = 'bold 11px monospace'; ctx.fillText(`ИМПУЛЬС Q/Й: ${impulseCooldown <= 0 ? 'ГОТОВ' : impulseCooldown.toFixed(1) + 'с'}`, screenW - infoW, 132); }
      if (player.invulnerabilityTimer > 0 || energyShieldTimer > 0 || lastChanceShieldTimer > 0) {
        ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 11px monospace';
        const shieldText = energyShieldTimer > 0 ? `ЩИТ ${energyShieldTimer.toFixed(1)}с` : lastChanceShieldTimer > 0 ? `ПОГЛОЩЕНИЕ ${lastChanceShieldTimer.toFixed(1)}с` : `НЕУЯЗВИМОСТЬ ${player.invulnerabilityTimer.toFixed(1)}с`;
        ctx.fillText(shieldText, screenW - infoW, 151);
      }
      const activeClassDefinition = CHARACTER_DEFINITIONS[player.characterId] || CHARACTER_DEFINITIONS.shooter;
      if (activeClassDefinition.activeAbility) {
        ctx.fillStyle = player.classAbilityCooldown <= 0 ? '#b9e6a4' : '#9b9aa4';
        ctx.font = 'bold 10px monospace';
        const skillStatus = player.classAbilityCooldown <= 0 ? 'ГОТОВО' : `${player.classAbilityCooldown.toFixed(1)}с`;
        ctx.fillText(`${activeClassDefinition.abilityName.toUpperCase()} [E]: ${skillStatus}`, screenW - infoW, 169);
      }

      ctx.fillStyle = 'rgba(12, 13, 17, 0.84)';
      ctx.fillRect(14, screenH - 58, Math.min(680, screenW - 28), 44);
      ctx.strokeStyle = '#494650';
      ctx.strokeRect(14.5, screenH - 57.5, Math.min(680, screenW - 28) - 1, 43);
      ctx.fillStyle = '#d4cbdc'; ctx.font = '12px monospace';
      ctx.fillText('WASD — движение   МЫШЬ — прицел   ЛКМ — выстрел   R — перезарядка   Q/Й — импульс   ESC — пауза', 25, screenH - 31);
    }

    if (coinToastTimer > 0) {
      ctx.save();
      ctx.font = 'bold 12px monospace';
      const toastW = Math.min(300, ctx.measureText(coinToastText).width + 28);
      const toastX = (screenW - toastW) / 2;
      ctx.fillStyle = 'rgba(35,26,15,.92)'; ctx.fillRect(toastX, 18, toastW, 31);
      ctx.strokeStyle = 'rgba(240,195,91,.85)'; ctx.strokeRect(toastX + .5, 18.5, toastW - 1, 30);
      ctx.fillStyle = '#ffe2a0'; ctx.textAlign = 'center'; ctx.fillText(coinToastText, screenW / 2, 38);
      ctx.restore();
    }

    if (paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.62)'; ctx.fillRect(0, 0, screenW, screenH);
      ctx.fillStyle = '#f0e8f5'; ctx.font = 'bold 38px monospace';
      ctx.textAlign = 'center'; ctx.fillText('ПАУЗА', screenW / 2, screenH / 2);
      ctx.font = '15px monospace'; ctx.fillText('Нажми ESC, чтобы продолжить', screenW / 2, screenH / 2 + 34);
      ctx.textAlign = 'left';
    }

    if (gameWon) {
      ctx.fillStyle = 'rgba(8, 5, 8, 0.84)'; ctx.fillRect(0, 0, screenW, screenH);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd18a'; ctx.font = 'bold 42px monospace';
      ctx.fillText('ПОБЕДА!', screenW / 2, screenH / 2 - 40);
      ctx.fillStyle = '#f0e7df'; ctx.font = '18px monospace';
      ctx.fillText('Ты прошёл все испытания и завершил забег!', screenW / 2, screenH / 2 + 2);
      ctx.fillText(`Убийства: ${kills}   Опыт: ${totalXP}   Время: ${formatTime(elapsed)}`, screenW / 2, screenH / 2 + 34);
      ctx.fillStyle = '#c5b2d4'; ctx.font = '13px monospace';
      ctx.fillText('Нажми ENTER, чтобы начать заново', screenW / 2, screenH / 2 + 70);
      ctx.textAlign = 'left';
    }

    if (dead) {
      ctx.fillStyle = 'rgba(8, 5, 8, 0.86)'; ctx.fillRect(0, 0, screenW, screenH);
      ctx.textAlign = 'center'; ctx.fillStyle = '#f0b5c0'; ctx.font = 'bold 38px monospace';
      ctx.fillText('ЗАБЕГ ОКОНЧЕН', screenW / 2, screenH / 2 - 28);
      ctx.fillStyle = '#eee8ef'; ctx.font = '16px monospace';
      ctx.fillText(`Убийства: ${kills}   Опыт: ${totalXP}   Время: ${formatTime(elapsed)}`, screenW / 2, screenH / 2 + 10);
      ctx.textAlign = 'left';
    }
  }

  function update(dt) {
    if (menuVisible || paused || dead || gameWon || upgradeSelection) return;
    elapsed += dt;
    updateMinuteCoinRewards();
    updateWorldEvents();
    updateEnemyHpScaling();
    checkBossSchedule();
    updateSpawning();

    let dx = 0, dy = 0;
    if (keys.w || keys.arrowup) dy -= 1;
    if (keys.s || keys.arrowdown) dy += 1;
    if (keys.a || keys.arrowleft) dx -= 1;
    if (keys.d || keys.arrowright) dx += 1;
    if (controlMode === 'mobile') {
      dx += touchInput.moveX;
      dy += touchInput.moveY;
      if (touchInput.aimActive) {
        player.angle = Math.atan2(touchInput.aimY, touchInput.aimX);
        touchInput.fireTimer -= dt;
        if (touchInput.fireTimer <= 0) {
          shoot();
          touchInput.fireTimer = touchInput.fireInterval;
        }
      }
    }
    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy); dx /= length; dy /= length;
      let moveSpeed = player.speed;
      if (spiderWebSlowTimer > 0) moveSpeed *= 0.6;
      if (bootsBurstTimer > 0) moveSpeed *= 1.4;
      if (lastChanceSpeedTimer > 0) moveSpeed *= 1.3;
      player.x += dx * moveSpeed * dt;
      player.y += dy * moveSpeed * dt;
    }
    if (activeArena) {
      player.x = bossArenaClampX(player.x, 1.6);
      player.y = bossArenaClampY(player.y, 1.6);
    } else {
      player.x = clamp(player.x, 1.6, MAP_SIZE - 1.6);
      player.y = clamp(player.y, 1.6, MAP_SIZE - 1.6);
    }
    updatePlayerAim();

    if (player.reloading) {
      player.reloadLeft -= dt;
      if (player.reloadLeft <= 0) {
        player.reloadLeft = 0; player.reloading = false; player.ammo = player.maxAmmo;
      }
    }

    spiderWebSlowTimer = Math.max(0, spiderWebSlowTimer - dt);
    updatePassiveAbilities(dt);
    const enemyDt = timeSlowTimer > 0 ? dt * 0.8 : dt;
    updateEnemies(enemyDt);
    updateBoss(dt);
    updateClassEffects(dt);
    updateClassTurrets(dt);
    updateProjectiles(dt);
    updateCompanion(dt);
    updateXpOrbs(dt);
    updateMedkits();

    muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt);
    damageFlashTimer = Math.max(0, damageFlashTimer - dt);
    hitBannerTimer = Math.max(0, hitBannerTimer - dt);
    coinToastTimer = Math.max(0, coinToastTimer - dt);
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const item = damageNumbers[i]; item.life -= dt; item.y -= 0.65 * dt;
      if (item.life <= 0) damageNumbers.splice(i, 1);
    }

    if (postGoblinSurvivalActive) {
      postGoblinSurvivalTimer = Math.max(0, postGoblinSurvivalTimer - dt);
      if (postGoblinSurvivalTimer <= 0) {
        postGoblinSurvivalActive = false;
        gameWon = true;
        announceBoss('ФИНАЛЬНАЯ МИНУТА ПРОЙДЕНА! ПОБЕДА!', 5.0);
      }
    }
  }

  function render() {
    const camera = cameraPosition();
    drawMap(camera);
    drawPickupRadius(camera);
    drawXpOrbs(camera);
    drawMedkits(camera);
    drawBullets(camera);
    drawEnemyBullets(camera);
    drawEnemies(camera);
    drawBossProjectiles(camera);
    drawBoss(camera);
    drawClassObjects(camera);
    drawElectricWaves(camera);
    drawGhostCompanion(camera);
    drawPlayer(camera);
    drawDamageNumbers(camera);
    drawExplosions(camera);
    drawBloodMoonOverlay();
    drawHUD();
    drawHitFeedback();
    drawBossHUD();
    drawBossBanner();
    drawUpgradeOverlay();

    if (controlMode === 'pc' && pointerInside && !paused && !dead) {
      ctx.strokeStyle = 'rgba(238, 220, 255, 0.78)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 7, 0, Math.PI * 2);
      ctx.moveTo(mouse.x - 11, mouse.y); ctx.lineTo(mouse.x - 5, mouse.y);
      ctx.moveTo(mouse.x + 5, mouse.y); ctx.lineTo(mouse.x + 11, mouse.y);
      ctx.moveTo(mouse.x, mouse.y - 11); ctx.lineTo(mouse.x, mouse.y - 5);
      ctx.moveTo(mouse.x, mouse.y + 5); ctx.lineTo(mouse.x, mouse.y + 11);
      ctx.stroke();
    }
    updateUiOverlay();
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt);
    render();
    animationId = requestAnimationFrame(frame);
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function destroy() {
    running = false;
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('contextmenu', onContextMenu);
    uiOverlay.removeEventListener('click', onUiOverlayClick);
    resetTouchInput();
    touchControls.removeEventListener('click', onTouchControlClick);
    touchControls.remove();
    uiOverlay.remove();
    canvas.remove();
    style.remove();
    delete window.__topdownRoguelike;
  }

  setupTouchSticks();
  applyTouchControlLanguage();
  canvas.style.cursor = controlMode === 'pc' ? 'crosshair' : 'none';
  touchControls.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('contextmenu', onContextMenu);

  window.__topdownRoguelike = {
    destroy,
    player,
    bullets,
    enemies,
    enemyBullets,
    medkits,
    classTurrets,
    poisonClouds,
    poisonPuddles,
    lightningLinks,
    electricWaves,
    electricWaveCast,
    xpOrbs,
    upgradeLevels,
    get level() { return currentLevel; },
    get xpIntoLevel() { return xpIntoLevel; },
    get upgradeSelection() { return upgradeSelection; },
    get pickupRadius() { return player.pickupRadius; },
    get elapsed() { return elapsed; },
    get postGoblinSurvivalActive() { return postGoblinSurvivalActive; },
    get postGoblinSurvivalTimer() { return postGoblinSurvivalTimer; },
    get kills() { return kills; },
    get totalXP() { return totalXP; },
    get coins() { return coinBalance; },
    get selectedCharacter() { return selectedCharacterId; },
    get scoutStartingUpgrades() { return [...scoutStartingUpgradeIds]; },
    get hunterUnlocked() { return hunterUnlocked; },
    get unlockedCharacters() { return [...unlockedCharacterIds]; },
    get characterStats() { return { ...CHARACTER_DEFINITIONS[selectedCharacterId] }; },
    get boss() { return activeBoss ? { name: activeBoss.name, kind: activeBoss.kind, hp: activeBoss.hp, phase: activeBoss.phase } : null; },
    get sewerBiome() { return sewerBiome; },
    get spiderBiome() { return spiderBiome; },
    get secondBossDefeated() { return secondBossDefeated; },
    get spiderQueenDefeated() { return spiderQueenDefeated; },
    get spiderWebSlowTimer() { return spiderWebSlowTimer; },
    get startTimeSeconds() { return START_TIME_SECONDS; },
    get bloodMoonActive() { return bloodMoonActive; },
    get enemyHpMultiplier() { return enemyHpMultiplier; },
    get impulseCooldown() { return impulseCooldown; },
    get menuVisible() { return menuVisible; },
    get controlMode() { return controlMode; },
    get language() { return currentLanguage; },
    get settingsPageVisible() { return menuVisible && menuPage === 'settings'; },
    get mobileControlsVisible() { return touchControls.style.display === 'block'; },
    get mobileAbilityStickVisible() { const el = touchControls.querySelector('[data-stick=\"ability\"]'); return !!el && el.style.display === 'flex'; },
    get goblinPhase2RateFactor() { return GOBLIN_PHASE2_RATE_FACTOR; },
    get goblinDamageFactor() { return GOBLIN_DAMAGE_FACTOR; }
  };

  resize();
  render();
  animationId = requestAnimationFrame(frame);
  canvas.focus();

  console.log(`Pixel Roguelike v5.2 — Spider Queen, boss victory healing, repeatable Breather upgrade, RU / EN / UK. Стартовый таймер: ${formatTime(START_TIME_SECONDS)}. Босс 1 — 05:00, босс 2 — 10:00, Королева пауков — 14:00. Улучшение выбирается клавишами 1–3 или мышью. Для остановки: window.__topdownRoguelike.destroy()`);
})();
