(function () {
  // TOP-DOWN PIXEL ROGUELIKE — PHASE 4.2.2 (CHARACTERS SOON + LOWER LEGENDARY RATE)
  // Paste the entire script into the DevTools Console on about:blank. The main menu appears first; press PLAY to start the run.
  // Includes the full previous prototype plus both boss encounters and their phase abilities.
  // START_TIME_SECONDS is replaced per build: 0, 295 (4:55), or 595 (9:55).

  if (window.__topdownRoguelike && window.__topdownRoguelike.destroy) {
    window.__topdownRoguelike.destroy();
  }

  const START_TIME_SECONDS = 0; // 0 = normal, 295 = rat test, 595 = goblin test.
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
  `;

  document.head.appendChild(style);

  const canvas = document.createElement('canvas');
  canvas.id = 'rogue-phase2-canvas';
  canvas.tabIndex = 0;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const uiOverlay = document.createElement('div');
  uiOverlay.id = 'rogue-ui-overlay';
  uiOverlay.style.display = 'none';
  document.body.appendChild(uiOverlay);
  uiOverlay.addEventListener('click', onUiOverlayClick);

  let screenW = 0;
  let screenH = 0;
  let running = true;
  let menuVisible = true;
  let menuPage = 'main';
  let uiOverlayMode = '';
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
  let sewerBiome = START_TIME_SECONDS >= 595;
  let firstBossDefeated = START_TIME_SECONDS >= 595;
  let boss1Spawned = START_TIME_SECONDS >= 300;
  let boss2Spawned = START_TIME_SECONDS >= 600;
  let gameWon = false;
  let victoryTimer = 0;
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
  let nextMedkitAt = 100;

  const keys = Object.create(null);
  const mouse = { x: 0, y: 0 };
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

  const player = {
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    angle: 0,
    hp: 100,
    maxHp: 100,
    ammo: MAX_AMMO,
    maxAmmo: MAX_AMMO,
    reloading: false,
    reloadLeft: 0,
    speed: PLAYER_SPEED,
    pickupRadius: BASE_XP_PICKUP_RADIUS,
    bulletDamage: BULLET_DAMAGE,
    reloadDuration: RELOAD_SECONDS,
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

  const worldPixels = MAP_SIZE * TILE;

  const upgradeDefinitions = [
    { id: 'heavyBullets', name: 'Тяжёлые пули', rarity: 'Обычное', max: 3,
      description: level => `+2 к урону выстрела за уровень. Сейчас: +${level * 2}.` },
    { id: 'bigPockets', name: 'Большие карманы', rarity: 'Обычное', max: 2,
      description: level => `+4 патрона к обойме за уровень. Сейчас: ${10 + level * 4} патронов.` },
    { id: 'fastReload', name: 'Быстрая перезарядка', rarity: 'Обычное', max: 4,
      description: level => `−0,2 сек. перезарядки за уровень. Сейчас: ${(2.5 - level * 0.2).toFixed(1)} сек.` },
    { id: 'lightBoots', name: 'Лёгкие сапожки', rarity: 'Обычное', max: 4,
      description: level => `Скорость: ${[10,20,20,30][level-1]}%. С 3 уровня при получении урона: +40% скорости (перезарядка 5 сек.).` },
    { id: 'strongHealth', name: 'Крепкое здоровье', rarity: 'Обычное', max: 4,
      description: level => `+10 к максимальному HP за уровень. Сейчас: ${100 + level * 10} HP.` },
    { id: 'protection', name: 'Защита', rarity: 'Обычное', max: 5,
      description: level => `−5% получаемого урона за уровень. Сейчас: ${level * 5}%.` },
    { id: 'reinforcedArmor', name: 'Усиленная броня', rarity: 'Обычное', max: 5,
      description: level => `${level * 3}% шанс полностью избежать входящего урона.` },
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

  function availableUpgrades() {
    return upgradeDefinitions.filter(def => getUpgradeLevel(def.id) < def.max);
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
      player.speed = PLAYER_SPEED * player.speedMultiplier;
    }
    if (id === 'strongHealth') { player.maxHp += 10; player.hp = Math.min(player.maxHp, player.hp + 10); }
    if (id === 'protection') player.damageReduction = Math.min(0.25, player.damageReduction + 0.05);
    if (id === 'reinforcedArmor') player.dodgeChance = Math.min(0.15, player.dodgeChance + 0.03);
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
      p.fillStyle = '#111014'; p.fillRect(2, 4, 12, 10);
      p.fillStyle = '#34313d'; p.fillRect(2, 10, 4, 4); p.fillRect(6, 11, 4, 4);
      p.fillStyle = '#17161d'; p.fillRect(2, 13, 4, 2); p.fillRect(6, 14, 4, 1);
      p.fillStyle = '#211e2b'; p.fillRect(3, 5, 8, 8);
      p.fillStyle = '#514067'; p.fillRect(4, 6, 6, 1); p.fillRect(3, 8, 1, 3);
      p.fillStyle = '#2e263d'; p.fillRect(5, 7, 5, 5);
      p.fillStyle = '#17151d'; p.fillRect(7, 2, 6, 8);
      p.fillStyle = '#655078'; p.fillRect(8, 2, 4, 1); p.fillRect(12, 4, 1, 4);
      p.fillStyle = '#d0b6a0'; p.fillRect(10, 5, 3, 4);
      p.fillStyle = '#30222a'; p.fillRect(11, 6, 1, 1); p.fillRect(12, 6, 1, 1);
      p.fillStyle = '#8b6d9d'; p.fillRect(10, 9, 3, 1);
      p.fillStyle = '#17191e'; p.fillRect(11, 7, 5, 2);
      p.fillStyle = '#77747d'; p.fillRect(13, 7, 3, 1);
      p.fillStyle = '#a79aaa'; p.fillRect(15, 7, 1, 1);
      p.fillStyle = '#4b354f'; p.fillRect(11, 9, 2, 1);
      p.fillStyle = '#9b73ba'; p.fillRect(5, 9, 2, 1); p.fillRect(6, 8, 1, 3);
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
  const enemySprites = {
    zombie: makeZombieSprite(),
    bat: makeBatSprite(),
    skeleton: makeSkeletonSprite()
  };
  const xpSprite = makeXpSprite();
  const ghostSprite = makeGhostSprite();
  const ratlingSprite = makeRatlingSprite();
  const bossSprites = { rat: makeRatBossSprite(), goblin: makeGoblinBossSprite() };

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

    const angle = player.angle;
    const muzzleDistance = 0.58;
    bullets.push({
      x: player.x + Math.cos(angle) * muzzleDistance,
      y: player.y + Math.sin(angle) * muzzleDistance,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      damage: player.bulletDamage,
      life: 2.4,
      hitIds: [],
      ricochetsLeft: player.ricochetLevel,
      pierceLeft: player.goldenBullet && player.ammo === 1 ? 5 : 0,
      golden: player.goldenBullet && player.ammo === 1,
      explosive: player.explosiveLevel > 0 && explosiveReady,
      ghost: false
    });
    if (bullets[bullets.length - 1].explosive) {
      explosiveReady = false;
      explosiveCooldown = 10;
    }

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

  function onPointerMove(event) {
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
    onPointerMove(event);
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
    updatePlayerAim();
    shoot();
  }

  function normalizedKey(event) {
    // event.code identifies the physical key, so WASD works in English and Russian layouts.
    const byCode = {
      KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyR: 'r', KeyQ: 'q',
      ArrowUp: 'arrowup', ArrowDown: 'arrowdown',
      ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
      Space: ' ', Escape: 'escape', Enter: 'enter', Digit1: '1', Digit2: '2', Digit3: '3', Numpad1: '1', Numpad2: '2', Numpad3: '3'
    };
    if (byCode[event.code]) return byCode[event.code];

    // Fallback for browsers/keyboards that don't provide event.code.
    const byCharacter = {
      'ц': 'w', 'ф': 'a', 'ы': 's', 'в': 'd', 'к': 'r', 'й': 'q'
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
      if (key === 'escape' && !event.repeat && menuPage === 'upgrades') { menuPage = 'main'; uiOverlayMode = ''; updateUiOverlay(); }
      return;
    }
    if (upgradeSelection && ['1', '2', '3'].includes(key) && !event.repeat) chooseUpgrade(Number(key) - 1);
    if (key === 'r' && !event.repeat) startReload();
    if (key === 'q' && !event.repeat) activateImpulse();
    if (key === 'escape' && !event.repeat && !dead && !gameWon && !upgradeSelection) { paused = !paused; uiOverlayMode = ''; updateUiOverlay(); }
    if (key === 'enter' && (dead || gameWon) && !event.repeat) startNewRunFromMenu();
    if (key === 'enter' && upgradeSelection && upgradeChoices.length === 0 && !event.repeat) { upgradeSelection = false; beginLevelUpIfReady(); }
  }

  function onKeyUp(event) {
    keys[normalizedKey(event)] = false;
  }

  function onBlur() {
    for (const key of Object.keys(keys)) keys[key] = false;
  }

  function updatePlayerAim() {
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

  function initializeBoss(kind) {
    const common = { id: `boss-${kind}`, kind, x: BOSS_ARENA.x + BOSS_ARENA.size / 2, y: BOSS_ARENA.y + BOSS_ARENA.size / 2, angle: Math.PI / 2, introTimer: 1.8, defeatTimer: 0 };
    if (kind === 'rat') {
      return { ...common, name: 'МОНСТРУОЗНАЯ КРЫСА', hp: 1000, maxHp: 1000, phase: 1, speed: 2.45, dashCooldown: 4.5, dashTimer: 0, dashVX: 0, dashVY: 0, dashHit: false, clawCooldown: 1.0, echoCooldown: randomInterval(4, 8), echoTimer: 0, summonCooldown: randomInterval(5, 10), raged: false, animalCryTimer: 0, animalCryDone: false, lastPhase: 1, flash: 0 };
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
    sewerBiome = true;
    player.x = activeArena.x + activeArena.size / 2;
    player.y = activeArena.y + activeArena.size - 6;
    player.angle = -Math.PI / 2;
    activeBoss = initializeBoss(kind);
    playerSilenceTimer = 0;
    announceBoss(kind === 'rat' ? 'БОСС №1: МОНСТРУОЗНАЯ КРЫСА' : 'БОСС №2: ГОБЛИН-ПОДРЫВНИК', 3.0);
  }

  function checkBossSchedule() {
    if (!activeBoss && !boss1Spawned && elapsed >= 300) {
      boss1Spawned = true;
      startBossEncounter('rat');
    } else if (!activeBoss && firstBossDefeated && !boss2Spawned && elapsed >= 600) {
      boss2Spawned = true;
      startBossEncounter('goblin');
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
    activeBoss.defeatTimer = activeBoss.kind === 'rat' ? 1.5 : 2.6;
    bossProjectiles.length = 0;
    bossHazards.length = 0;
    enemies.length = 0;
    enemyBullets.length = 0;
    announceBoss(activeBoss.kind === 'rat' ? 'МОНСТРУОЗНАЯ КРЫСА ПОВЕРЖЕНА!' : 'ГОБЛИН ГЛОТАЕТ ДИНАМИТ...', 2.5);
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
    gameWon = true;
    victoryTimer = 0;
    announceBoss('ПОБЕДА! ЗАБЕГ ЗАВЕРШЁН', 10);
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
      h.fuse -= dt;
      if (h.fuse <= 0) {
        if (distance(player.x, player.y, h.x, h.y) <= h.radius) applyPlayerDamage(h.damage);
        explosions.push({ x: h.x, y: h.y, life: 0.4, maxLife: 0.4, radius: h.radius });
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
        else finishGoblinBoss();
      }
      return;
    }
    boss.flash = Math.max(0, (boss.flash || 0) - dt);
    if (boss.kind === 'rat') updateRatBoss(boss, dt);
    else updateGoblinBoss(boss, dt);
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
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
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
        const enemy = enemies[hitIndex];
        bullet.hitIds.push(enemy.id);
        const isCrit = Math.random() < player.critChance;
        const dealt = Math.round(bullet.damage * (bullet.golden ? 2.5 : 1) * (isCrit ? 2 : 1));
        enemy.hp -= dealt;
        enemy.hitFlash = 0.12;
        damageNumbers.push({ x: enemy.x, y: enemy.y - 0.55, amount: dealt, life: 0.62, maxLife: 0.62, crit: isCrit });
        if (enemy.hp <= 0) killEnemy(hitIndex);

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
        const bossRadius = activeBoss.kind === 'rat' ? 1.65 : 1.05;
        if (distance(bullet.x, bullet.y, activeBoss.x, activeBoss.y) <= bossRadius) {
          bullet.hitIds.push(activeBoss.id);
          const isCrit = Math.random() < player.critChance;
          const dealt = Math.round(bullet.damage * (bullet.golden ? 2.5 : 1) * (isCrit ? 2 : 1));
          activeBoss.hp = Math.max(0, activeBoss.hp - dealt);
          activeBoss.flash = 0.16;
          damageNumbers.push({ x: activeBoss.x, y: activeBoss.y - 1.6, amount: dealt, life: 0.72, maxLife: 0.72, crit: isCrit });
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
      if (bullet.life <= 0 || outside) bullets.splice(i, 1);
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
    player.x = MAP_SIZE / 2; player.y = MAP_SIZE / 2; player.angle = 0;
    player.hp = 100; player.maxHp = 100; player.ammo = MAX_AMMO; player.maxAmmo = MAX_AMMO;
    player.reloading = false; player.reloadLeft = 0; player.speed = PLAYER_SPEED;
    player.pickupRadius = BASE_XP_PICKUP_RADIUS; player.bulletDamage = BULLET_DAMAGE;
    player.reloadDuration = RELOAD_SECONDS; player.damageReduction = 0; player.dodgeChance = 0;
    player.critChance = 0; player.ricochetLevel = 0; player.explosiveLevel = 0;
    player.ghostLevel = 0; player.impulseLevel = 0; player.energyShieldLevel = 0;
    player.timeSlowLevel = 0; player.phoenix = false; player.phoenixUsed = false;
    player.goldenBullet = false; player.lastChance = false; player.medkitHeal = 10;
    player.medkitInterval = 100; player.invulnerabilityTimer = 0; player.speedMultiplier = 1;
    for (const key of Object.keys(upgradeLevels)) delete upgradeLevels[key];
    bullets.length = 0; enemyBullets.length = 0; enemies.length = 0; medkits.length = 0;
    xpOrbs.length = 0; damageNumbers.length = 0; explosions.length = 0;
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
    sewerBiome = START_TIME_SECONDS >= 595; firstBossDefeated = START_TIME_SECONDS >= 595;
    boss1Spawned = START_TIME_SECONDS >= 300; boss2Spawned = START_TIME_SECONDS >= 600;
    playerSilenceTimer = 0; bossBannerTimer = 0; bossBannerText = ''; bossRewardPending = false;
    upgradeSelectionMode = 'level'; gameWon = false; victoryTimer = 0;
    kills = 0; totalXP = 0; xpIntoLevel = 0; currentLevel = 1; xpForNextLevel = 20;
    nextMedkitAt = 100; dead = false; paused = false; upgradeSelection = false;
    upgradeChoices = []; upgradeCardRects = []; muzzleFlashTimer = 0; damageFlashTimer = 0;
    hitBannerTimer = 0; lastDamageTaken = 0; timeSlowTimer = 0; timeSlowCooldown = 10;
    energyShieldTimer = 0; energyShieldCooldown = 20; impulseCooldown = 0;
    explosiveCooldown = 10; explosiveReady = false; ghostShotTimer = 2; medicRegenTimer = 2;
    lastChanceUsed = false; lastChanceSpeedTimer = 0; lastChanceShieldTimer = 0;
    lastChanceHealTimer = 0; lastChanceKillCounter = 0; bootsBurstTimer = 0; bootsBurstCooldown = 0;
    playerSilenceTimer = 0; bossBannerTimer = 0; bossBannerText = ''; bossRewardPending = false; upgradeSelectionMode = 'level';
    nextVampirismKillAt = 10; lastTime = performance.now();
  }

  function drawFloorTile(x, y, sx, sy) {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n = (n ^ (n >>> 16)) >>> 0;
    const shades = sewerBiome ? ['#252a2b', '#282f30', '#2b3333', '#222829'] : ['#292a2b', '#2c2d2e', '#303031', '#272829'];
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
  }

  function drawWallTile(sx, sy, x, y) {
    ctx.fillStyle = '#17191c'; ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = '#45464a'; ctx.fillRect(sx + 1, sy + 1, TILE - 2, 5);
    ctx.fillStyle = '#303236'; ctx.fillRect(sx + 1, sy + 6, TILE - 2, TILE - 7);
    ctx.fillStyle = '#56575b'; ctx.fillRect(sx + 3, sy + 7, TILE - 6, 1);
    ctx.fillStyle = '#222428'; ctx.fillRect(sx + 2, sy + 15, TILE - 4, 1);
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
          else { drawFloorTile(x, y, sx, sy); if (sewerBiome && (x * 7 + y * 11) % 71 === 0) { ctx.fillStyle = 'rgba(92, 151, 104, 0.18)'; ctx.fillRect(sx + 4, sy + 5, 23, 3); } }
        } else {
          const isWall = x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1;
          if (isWall) drawWallTile(sx, sy, x, y);
          else { drawFloorTile(x, y, sx, sy); if (sewerBiome && (x * 7 + y * 11) % 79 === 0) { ctx.fillStyle = 'rgba(68, 135, 91, 0.18)'; ctx.fillRect(sx + 5, sy + 8, 20, 3); } }
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
      ctx.fillStyle = bullet.ghost ? '#b98cff' : (bullet.golden ? '#ffe17d' : '#f2d18a'); ctx.fillRect(-4, -2, 8, 4);
      ctx.fillStyle = bullet.ghost ? '#f0dcff' : '#fff0c5'; ctx.fillRect(1, -1, 3, 2);
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
      const size = enemy.type === 'skeleton' ? 30 : enemy.type === 'ratling' ? 23 : 27;
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
    const w = (isRat ? 3 : 2) * TILE;
    const h = (isRat ? 4 : 2) * TILE;
    ctx.save();
    if (b.raged || b.phase === 2 && isRat) {
      ctx.globalAlpha = 0.22 + Math.sin(elapsed * 12) * 0.08;
      ctx.fillStyle = '#ff283f'; ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.72, h * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (b.flash > 0) ctx.globalAlpha = 0.45;
    ctx.drawImage(bossSprites[b.kind], sx - w / 2, sy - h / 2, w, h);
    if (b.kind === 'goblin' && b.defeatTimer > 0) {
      ctx.fillStyle = '#a93429'; ctx.fillRect(sx - 5, sy - 2, 10, 5);
      ctx.fillStyle = '#ffd27b'; ctx.fillRect(sx + 4, sy - 6, 3, 3);
    }
    ctx.restore();

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
    ctx.strokeStyle = b.kind === 'rat' ? '#b64d59' : '#c28a47'; ctx.lineWidth = 2; ctx.strokeRect(x - 11, y - 29, width + 22, 56);
    ctx.fillStyle = '#f1e8ed'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${b.name} — ФАЗА ${b.phase}`, screenW / 2, y - 10);
    const fill = b.kind === 'rat' ? '#a94655' : '#b77b3b';
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
    ctx.strokeStyle = activeBoss && activeBoss.kind === 'goblin' ? '#d69c54' : '#cb5664'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, 40);
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
    ctx.drawImage(playerSprite, -TILE / 2, -TILE / 2, TILE, TILE);
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
      ctx.strokeText(`-${item.amount}`, sx, sy);
      ctx.fillStyle = item.crit ? '#ffe17d' : '#ff5968';
      ctx.fillText(`-${item.amount}`, sx, sy);
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

  function drawExplosions(camera) {
    for (const e of explosions) {
      const sx = e.x * TILE - camera.x, sy = e.y * TILE - camera.y;
      const t = 1 - e.life / e.maxLife;
      ctx.save();
      ctx.globalAlpha = 0.68 * (1 - t);
      const ringColor = e.kind === 'explosive' ? '#ff9a43' : e.kind === 'impulse' ? '#d9a0ff' : '#c98cff';
      const fillColor = e.kind === 'explosive' ? 'rgba(255, 110, 35, 0.22)' : e.kind === 'impulse' ? 'rgba(180, 115, 255, 0.18)' : 'rgba(170, 100, 245, 0.12)';
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

  function buildMainMenuHtml() {
    return `<div class="rl-ui-panel">
      <h1 class="rl-ui-title">PIXEL ROGUELIKE</h1>
      <p class="rl-ui-subtitle">2D roguelike shooter · вид сверху · пиксельный мир</p>
      <div class="rl-ui-menu-buttons">
        ${uiButton('ИГРАТЬ', 'play', 'primary')}
        ${uiButton('ПЕРСОНАЖИ', 'characters')}
        ${uiButton('УСИЛЕНИЯ И СТАТИСТИКА', 'open-upgrades')}
      </div>
      <p class="rl-ui-note">Новые персонажи появятся в одном из следующих обновлений.<br>Управление: WASD · мышь · ЛКМ · R · Q/Й</p>
    </div>`;
  }

  function buildCharactersSoonHtml() {
    return `<div class="rl-ui-panel" style="width:min(520px,94vw);text-align:center">
      <h2 class="rl-ui-title">ПЕРСОНАЖИ</h2>
      <p class="rl-ui-subtitle" style="font-size:20px;color:#e0c4f8;margin:28px 0">СКОРО...</p>
      <p class="rl-ui-note">Сейчас доступен один персонаж. Новые герои появятся в будущих обновлениях.</p>
      <div class="rl-ui-footer">${uiButton('НАЗАД В МЕНЮ', 'back-menu', 'primary')}</div>
    </div>`;
  }

  function buildUpgradeMenuHtml() {
    const stats = [
      ['Здоровье', `${Math.round(player.hp)} / ${Math.round(player.maxHp)} HP`],
      ['Урон ружья', `${Math.round(player.bulletDamage)} HP`],
      ['Обойма', `${player.ammo} / ${player.maxAmmo}`],
      ['Перезарядка', `${player.reloadDuration.toFixed(2)} сек.`],
      ['Скорость', `${player.speed.toFixed(2)} блока/сек.`],
      ['Радиус сбора XP', `${player.pickupRadius.toFixed(2)} блока`],
      ['Снижение урона', `${Math.round(player.damageReduction * 100)}%`],
      ['Шанс уклонения', `${Math.round(player.dodgeChance * 100)}%`],
      ['Шанс крит. удара', `${Math.round(player.critChance * 100)}%`],
      ['Уровень', `${currentLevel}`],
      ['Убийства', `${kills}`],
      ['Всего опыта', `${totalXP} XP`]
    ];
    const statHtml = stats.map(([label, value]) => `<div class="rl-ui-stat"><span>${escapeUiText(label)}</span><strong>${escapeUiText(value)}</strong></div>`).join('');
    const upgradeHtml = upgradeDefinitions.map(def => {
      const level = getUpgradeLevel(def.id);
      const preview = def.description(Math.max(1, level));
      const color = upgradeRarityColors[def.rarity] || '#9b91a4';
      return `<div class="rl-ui-upgrade" style="--rarity:${color}"><strong>${escapeUiText(def.name)} <span style="color:${color};font-weight:normal">· ${escapeUiText(def.rarity)}</span></strong><small>Уровень: ${level}/${def.max}</small><small>${escapeUiText(preview)}</small></div>`;
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
      <p class="rl-ui-subtitle">Гоблин-подрывник проглотил динамит и сгорел.<br>Убийства: ${kills} · Опыт: ${totalXP} · Время: ${formatTime(elapsed)}</p>
      <div class="rl-ui-menu-buttons">${uiButton('ИГРАТЬ СНОВА', 'retry', 'primary')}${uiButton('ВЫХОД В МЕНЮ', 'exit-menu', 'muted')}</div>
    </div>`;
  }

  function updateUiOverlay() {
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
    if (mode === 'menu:main') uiOverlay.innerHTML = buildMainMenuHtml();
    else if (mode === 'menu:characters') uiOverlay.innerHTML = buildCharactersSoonHtml();
    else if (mode === 'menu:upgrades') uiOverlay.innerHTML = buildUpgradeMenuHtml();
    else uiOverlay.innerHTML = buildStatusOverlayHtml(mode);
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
    canvas.focus();
  }

  function onUiOverlayClick(event) {
    const button = event.target && event.target.closest ? event.target.closest('button[data-ui-action]') : null;
    if (!button || button.disabled) return;
    const action = button.getAttribute('data-ui-action');
    if (action === 'play' || action === 'retry') startNewRunFromMenu();
    else if (action === 'characters') { menuPage = 'characters'; uiOverlayMode = ''; updateUiOverlay(); }
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
    ctx.fillStyle = 'rgba(12, 13, 17, 0.93)';
    ctx.fillRect(14, 14, 330, 205);
    ctx.strokeStyle = '#5b5266'; ctx.lineWidth = 2;
    ctx.strokeRect(15, 15, 328, 203);

    ctx.fillStyle = '#d9c8e7'; ctx.font = 'bold 15px monospace';
    ctx.fillText('PIXEL ROGUELIKE — ЭТАП 4.1', 26, 38);
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
      ctx.fillStyle = '#aaa5b0'; ctx.fillText('РУЖЬЁ ГОТОВО', 178, 103);
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
    ctx.fillRect(screenW - infoW - 14, 14, infoW, 142);
    ctx.strokeStyle = '#494650'; ctx.strokeRect(screenW - infoW - 13.5, 14.5, infoW - 1, 141);
    ctx.fillStyle = '#d9c8e7'; ctx.font = 'bold 13px monospace';
    ctx.fillText(activeBoss ? 'АРЕНА БОССА' : sewerBiome ? 'КАНАЛИЗАЦИЯ' : 'ОБЫЧНАЯ АРЕНА', screenW - infoW, 36);
    ctx.fillStyle = '#bdb8c2'; ctx.font = '12px monospace';
    ctx.fillText(activeBoss ? '40 × 40 БЛОКОВ' : '200 × 200 БЛОКОВ', screenW - infoW, 57);
    ctx.fillText(activeBoss ? 'БОССОВОЕ СРАЖЕНИЕ' : sewerBiome ? 'ПОДЗЕМНЫЙ УРОВЕНЬ' : 'ЗОМБИ • МЫШИ • СКЕЛЕТЫ', screenW - infoW, 77);
    if (bloodMoonActive) { ctx.fillStyle = '#ff7884'; ctx.font = 'bold 11px monospace'; ctx.fillText('КРОВАВАЯ ЛУНА: +15% МОБАМ', screenW - infoW, 98); }
    if (explosiveReady) { ctx.fillStyle = '#f2ad69'; ctx.font = 'bold 11px monospace'; ctx.fillText('ВЗРЫВНАЯ ПУЛЯ ГОТОВА', screenW - infoW, bloodMoonActive ? 116 : 105); }
    if (player.impulseLevel > 0) { ctx.fillStyle = impulseCooldown <= 0 ? '#d9b5ff' : '#a89bb5'; ctx.font = 'bold 11px monospace'; ctx.fillText(`ИМПУЛЬС Q/Й: ${impulseCooldown <= 0 ? 'ГОТОВ' : impulseCooldown.toFixed(1) + 'с'}`, screenW - infoW, 132); }
    if (player.invulnerabilityTimer > 0 || energyShieldTimer > 0 || lastChanceShieldTimer > 0) {
      ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 11px monospace';
      const shieldText = energyShieldTimer > 0 ? `ЩИТ ${energyShieldTimer.toFixed(1)}с` : lastChanceShieldTimer > 0 ? `ПОГЛОЩЕНИЕ ${lastChanceShieldTimer.toFixed(1)}с` : `НЕУЯЗВИМОСТЬ ${player.invulnerabilityTimer.toFixed(1)}с`;
      ctx.fillText(shieldText, screenW - infoW, 151);
    }

    ctx.fillStyle = 'rgba(12, 13, 17, 0.84)';
    ctx.fillRect(14, screenH - 58, Math.min(680, screenW - 28), 44);
    ctx.strokeStyle = '#494650';
    ctx.strokeRect(14.5, screenH - 57.5, Math.min(680, screenW - 28) - 1, 43);
    ctx.fillStyle = '#d4cbdc'; ctx.font = '12px monospace';
    ctx.fillText('WASD — движение   МЫШЬ — прицел   ЛКМ — выстрел   R — перезарядка   Q/Й — импульс   ESC — пауза', 25, screenH - 31);

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
      ctx.fillText('Гоблин-подрывник проглотил динамит и сгорел.', screenW / 2, screenH / 2 + 2);
      ctx.fillText(`Убийства: ${kills}   Опыт: ${totalXP}   Время: ${formatTime(elapsed)}`, screenW / 2, screenH / 2 + 34);
      ctx.fillStyle = '#c5b2d4'; ctx.fillText('Нажми ENTER, чтобы начать заново', screenW / 2, screenH / 2 + 70);
      ctx.textAlign = 'left';
    }

    if (dead) {
      ctx.fillStyle = 'rgba(8, 5, 8, 0.78)'; ctx.fillRect(0, 0, screenW, screenH);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#edc5ca'; ctx.font = 'bold 40px monospace';
      ctx.fillText('ЗАБЕГ ОКОНЧЕН', screenW / 2, screenH / 2 - 28);
      ctx.fillStyle = '#e7e1e8'; ctx.font = '17px monospace';
      ctx.fillText(`Убийства: ${kills}   Опыт: ${totalXP}   Время: ${formatTime(elapsed)}`, screenW / 2, screenH / 2 + 10);
      ctx.fillStyle = '#c5b2d4';
      ctx.fillText('Нажми ENTER, чтобы начать заново', screenW / 2, screenH / 2 + 48);
      ctx.textAlign = 'left';
    }
  }

  function update(dt) {
    if (menuVisible || paused || dead || gameWon || upgradeSelection) return;
    elapsed += dt;
    updateWorldEvents();
    updateEnemyHpScaling();
    checkBossSchedule();
    updateSpawning();

    let dx = 0, dy = 0;
    if (keys.w || keys.arrowup) dy -= 1;
    if (keys.s || keys.arrowdown) dy += 1;
    if (keys.a || keys.arrowleft) dx -= 1;
    if (keys.d || keys.arrowright) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy); dx /= length; dy /= length;
      let moveSpeed = player.speed;
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

    updatePassiveAbilities(dt);
    const enemyDt = timeSlowTimer > 0 ? dt * 0.8 : dt;
    updateEnemies(enemyDt);
    updateBoss(dt);
    updateProjectiles(dt);
    updateCompanion(dt);
    updateXpOrbs(dt);
    updateMedkits();

    muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt);
    damageFlashTimer = Math.max(0, damageFlashTimer - dt);
    hitBannerTimer = Math.max(0, hitBannerTimer - dt);
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const item = damageNumbers[i]; item.life -= dt; item.y -= 0.65 * dt;
      if (item.life <= 0) damageNumbers.splice(i, 1);
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

    if (pointerInside && !paused && !dead) {
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
    uiOverlay.remove();
    canvas.remove();
    style.remove();
    delete window.__topdownRoguelike;
  }

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
    xpOrbs,
    upgradeLevels,
    get level() { return currentLevel; },
    get xpIntoLevel() { return xpIntoLevel; },
    get upgradeSelection() { return upgradeSelection; },
    get pickupRadius() { return player.pickupRadius; },
    get elapsed() { return elapsed; },
    get kills() { return kills; },
    get totalXP() { return totalXP; },
    get boss() { return activeBoss ? { name: activeBoss.name, kind: activeBoss.kind, hp: activeBoss.hp, phase: activeBoss.phase } : null; },
    get sewerBiome() { return sewerBiome; },
    get startTimeSeconds() { return START_TIME_SECONDS; },
    get bloodMoonActive() { return bloodMoonActive; },
    get enemyHpMultiplier() { return enemyHpMultiplier; },
    get impulseCooldown() { return impulseCooldown; },
    get menuVisible() { return menuVisible; },
    get goblinPhase2RateFactor() { return GOBLIN_PHASE2_RATE_FACTOR; },
    get goblinDamageFactor() { return GOBLIN_DAMAGE_FACTOR; }
  };

  resize();
  render();
  animationId = requestAnimationFrame(frame);
  canvas.focus();

  console.log(`Pixel Roguelike — этап 4.2 запущен. Стартовый таймер: ${formatTime(START_TIME_SECONDS)}. Босс 1 — 05:00, босс 2 — 10:00. Улучшение выбирается клавишами 1–3 или мышью. Для остановки: window.__topdownRoguelike.destroy()`);
})();
