const SAVE_KEY = 'skateXP_v2';

const DEFAULT_SAVE = () => ({
  
  username:      'SKATER',
  avatar:        '🛹',
  
  money:         0,
  level:         1,
  xp:            0,
  nextXP:        100,
  lifetimeTricks: 0,
  highestCombo:  0,
  
  boardIndex:    0,          
  
  created:       Date.now(),
  lastPlayed:    Date.now(),
});

function saveGet() {
  try {
    return Object.assign(DEFAULT_SAVE(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
  } catch { return DEFAULT_SAVE(); }
}

function saveSet(data) {
  data.lastPlayed = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function saveReset() {
  localStorage.removeItem(SAVE_KEY);
}

const BOARDS = [
  { name: 'Starter Board',  cost: 0,      multiplier: 1,  accel: 0.22, color: '#888888' },
  { name: 'Street Board',   cost: 250,    multiplier: 2,  accel: 0.30, color: '#ff3c6e' },
  { name: 'Pro Board',      cost: 1000,   multiplier: 4,  accel: 0.40, color: '#00f0ff' },
  { name: 'Legend Board',   cost: 5000,   multiplier: 8,  accel: 0.55, color: '#ffcc00' },
  { name: 'Galaxy Board',   cost: 25000,  multiplier: 15, accel: 0.75, color: '#cc88ff' },
];

const TRICKS = [
  { key: 'q', name: 'Kickflip',    base: 100, xp: 25,  spin: 0 },
  { key: 'e', name: 'Heelflip',    base: 150, xp: 40,  spin: 0 },
  { key: 'r', name: '360 Spin',    base: 250, xp: 75,  spin: 360 },
  { key: 'f', name: 'Hardflip',    base: 350, xp: 100, spin: 0 },
  { key: 'g', name: 'McTwist',     base: 500, xp: 150, spin: 540 },
];

function addXP(save, amount, onLevelUp) {
  save.xp += amount;
  while (save.xp >= save.nextXP) {
    save.xp -= save.nextXP;
    save.level++;
    save.nextXP = Math.floor(save.nextXP * 1.4);
    if (onLevelUp) onLevelUp(save.level);
  }
}

let _toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

(function initGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  
  let save = saveGet();
  let combo    = 0;
  let airTricks = 0; 
  let boardFlipAngle = 0;
  let boardFlipTarget = 0;
  let boardFlipSpeed  = 0;
  let particleList = [];
  let comboPopupTimer = 0;
  let trickPopupTimer = 0;
  let trickPopupText  = '';

  
  const player = {
    x: 200, y: 500,
    vx: 0,  vy: 0,
    w: 36,  h: 18,
    grounded: true,
    angle: 0, 
  };

  
  const GROUND_Y = () => canvas.height * 0.72;

  function genRamps(count) {
    const ramps = [];
    for (let i = 0; i < count; i++) {
      const x = 600 + i * 480 + Math.random() * 100;
      const h = 130 + Math.random() * 180;
      const w = 220 + Math.random() * 180;
      const style = Math.random() > 0.6 ? 'quarter' : 'wedge';
      ramps.push({ x, y: GROUND_Y() - h, w, h, style });
    }
    return ramps;
  }

  function genRails(count, ramps) {
    return ramps
      .filter((_, i) => i % 2 === 1)
      .slice(0, count)
      .map(r => ({
        x: r.x + r.w * 0.1,
        y: r.y - 8,
        w: r.w * 0.8,
      }));
  }

  const ramps = genRamps(35);
  const rails = genRails(12, ramps);

  
  const keys = {};
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (e.code === 'Space' && player.grounded) {
      player.vy = -15;
      player.grounded = false;
      e.preventDefault();
    }

    if (!player.grounded) {
      const trick = TRICKS.find(t => t.key === k);
      if (trick) doTrick(trick);
    }
  });
  document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  function doTrick(trick) {
    const mult = BOARDS[save.boardIndex].multiplier;
    const pts  = trick.base * mult * (1 + airTricks * 0.5); 
    combo += pts;
    airTricks++;
    save.lifetimeTricks++;

    
    if (trick.spin) {
      boardFlipTarget += trick.spin;
      boardFlipSpeed   = 12;
    } else {
      boardFlipTarget += 360;
      boardFlipSpeed   = 16;
    }

    spawnTrickParticles(player.x + player.w / 2, player.y + player.h / 2, trick);

    trickPopupText  = `${trick.name}  +${Math.floor(pts).toLocaleString()}`;
    trickPopupTimer = 60;

    addXP(save, trick.xp, lvl => {
      toast(`⬆ LEVEL UP — Level ${lvl}!`);
    });

    refreshHUD();
  }

  
  function spawnTrickParticles(x, y, trick) {
    const colors = ['#ff3c6e','#00f0ff','#ffcc00','#cc88ff','#ffffff'];
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particleList.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        radius: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function updateParticles() {
    particleList = particleList.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= p.decay;
      return p.life > 0;
    });
  }

  function drawParticles() {
    particleList.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  
  function update() {
    const board = BOARDS[save.boardIndex];
    const gnd   = GROUND_Y();

    if (keys['w'] || keys['arrowup']) player.vx += board.accel;
    if (keys['a'] || keys['arrowleft']) player.vx -= 0.18;
    if (keys['d'] || keys['arrowright']) player.vx += 0.18;

    player.vx *= 0.985;
    player.x  += player.vx;
    player.vy += 0.65;
    player.y  += player.vy;

    
    if (Math.abs(boardFlipAngle - boardFlipTarget) > 1) {
      boardFlipAngle += (boardFlipTarget - boardFlipAngle) * 0.18;
    } else {
      boardFlipAngle = boardFlipTarget % 360;
      boardFlipTarget = boardFlipAngle;
    }

    
    let groundLevel = gnd;

    ramps.forEach(r => {
      if (player.x + player.w > r.x && player.x < r.x + r.w) {
        const progress = (player.x - r.x) / r.w;
        let surface;

        if (r.style === 'quarter') {
          
          const t = 1 - progress;
          surface = r.y + r.h * (1 - Math.sin(t * Math.PI / 2));
        } else {
          
          surface = r.y + r.h - progress * r.h;
        }

        if (player.y + player.h > surface) {
          groundLevel = Math.min(groundLevel, surface - player.h);
        }
      }
    });

    if (player.y > groundLevel) {
      
      if (!player.grounded) {
        if (combo > 0) {
          if (combo > save.highestCombo) save.highestCombo = combo;
          save.money += combo;
          toast(`LANDED +$${Math.floor(combo).toLocaleString()}`);
          comboPopupTimer = 90;
        }
        combo = 0;
        airTricks = 0;
        boardFlipTarget = Math.round(boardFlipAngle / 360) * 360;
      }

      player.y       = groundLevel;
      player.vy      = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }

    
    player.angle = Math.max(-18, Math.min(18, player.vx * 1.2));

    
    cameraX = player.x - canvas.width / 3;

    
    if (trickPopupTimer > 0) trickPopupTimer--;
    if (comboPopupTimer > 0) comboPopupTimer--;

    updateParticles();

    
    if (Math.floor(Date.now() / 5000) !== lastSaveSlot) {
      lastSaveSlot = Math.floor(Date.now() / 5000);
      saveSet(save);
    }

    refreshHUD();
  }

  let cameraX = 0;
  let lastSaveSlot = Math.floor(Date.now() / 5000);

  
  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const gnd = GROUND_Y();

    
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0a0a1a');
    sky.addColorStop(0.6, '#0f0f25');
    sky.addColorStop(1, '#15152f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    
    ctx.strokeStyle = 'rgba(0,240,255,0.04)';
    ctx.lineWidth = 1;
    for (let gx = (-cameraX % 100); gx < w; gx += 100) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 80) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    ctx.save();
    ctx.translate(-cameraX, 0);

    
    const groundGrad = ctx.createLinearGradient(0, gnd, 0, h);
    groundGrad.addColorStop(0, '#1a1a35');
    groundGrad.addColorStop(1, '#0a0a15');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(cameraX - 200, gnd, w + 400, h - gnd + 60);

    
    ctx.strokeStyle = 'rgba(0,240,255,0.3)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cameraX - 200, gnd);
    ctx.lineTo(cameraX + w + 200, gnd);
    ctx.stroke();
    ctx.shadowBlur = 0;

    
    for (let mx = 0; mx < 30000; mx += 500) {
      if (mx > cameraX - 100 && mx < cameraX + w + 100) {
        ctx.fillStyle = 'rgba(0,240,255,0.15)';
        ctx.font = '10px Share Tech Mono';
        ctx.fillText(`${mx}m`, mx, gnd - 8);
        ctx.strokeStyle = 'rgba(0,240,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx, gnd - 4); ctx.lineTo(mx, gnd); ctx.stroke();
      }
    }

    
    ramps.forEach(r => {
      const visible = r.x + r.w > cameraX - 50 && r.x < cameraX + canvas.width + 50;
      if (!visible) return;

      ctx.shadowColor = '#ff3c6e';
      ctx.shadowBlur = 6;

      const grad = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
      grad.addColorStop(0, '#2a1a3a');
      grad.addColorStop(1, '#1a0a2a');

      ctx.fillStyle = grad;
      ctx.beginPath();

      if (r.style === 'quarter') {
        
        ctx.moveTo(r.x, r.y + r.h);
        ctx.lineTo(r.x + r.w, r.y + r.h);
        ctx.lineTo(r.x + r.w, r.y);
        
        const cp1x = r.x + r.w * 0.5;
        const cp1y = r.y;
        ctx.quadraticCurveTo(cp1x, r.y + r.h * 0.4, r.x, r.y + r.h);
      } else {
        ctx.moveTo(r.x, r.y + r.h);
        ctx.lineTo(r.x + r.w, r.y + r.h);
        ctx.lineTo(r.x + r.w, r.y);
      }

      ctx.closePath();
      ctx.fill();

      
      ctx.strokeStyle = 'rgba(255,60,110,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    
    rails.forEach(rail => {
      const visible = rail.x + rail.w > cameraX - 50 && rail.x < cameraX + canvas.width + 50;
      if (!visible) return;

      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 10;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(rail.x, rail.y);
      ctx.lineTo(rail.x + rail.w, rail.y);
      ctx.stroke();

      
      ctx.fillStyle = '#888';
      ctx.shadowBlur = 0;
      for (let bx = rail.x + 20; bx < rail.x + rail.w - 10; bx += 40) {
        ctx.beginPath(); ctx.arc(bx, rail.y, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
    });

    
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((player.angle * Math.PI) / 180);

    
    ctx.save();
    ctx.rotate((boardFlipAngle * Math.PI) / 180);

    const boardW = player.w + 16;
    const boardH = 7;
    const boardColor = BOARDS[save.boardIndex].color;

    
    ctx.shadowColor = boardColor;
    ctx.shadowBlur = 12;

    
    ctx.fillStyle = boardColor;
    ctx.beginPath();
    ctx.roundRect(-boardW / 2, player.h / 2 - 3, boardW, boardH, 3);
    ctx.fill();

    
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-boardW / 2 + 4, player.h / 2 - 1, boardW - 8, 3);

    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#333';
    [[-boardW / 2 + 5, player.h / 2 + 2], [boardW / 2 - 5, player.h / 2 + 2]].forEach(([wx, wy]) => {
      ctx.beginPath();
      ctx.arc(wx, wy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(wx, wy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
    });

    ctx.restore(); 

    
    ctx.shadowColor = 'rgba(255,60,110,0.3)';
    ctx.shadowBlur = 8;

    
    ctx.fillStyle = '#cc2244';
    ctx.fillRect(-8, -player.h / 2, 16, player.h * 0.7);

    
    ctx.fillStyle = '#f4c584';
    ctx.beginPath();
    ctx.arc(0, -player.h / 2 - 8, 9, 0, Math.PI * 2);
    ctx.fill();

    
    ctx.fillStyle = '#ff3c6e';
    ctx.beginPath();
    ctx.arc(0, -player.h / 2 - 8, 9, Math.PI, 0);
    ctx.fill();

    
    ctx.strokeStyle = '#cc2244';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const armAnim = Math.sin(Date.now() / 150) * (player.grounded ? 15 : 30);
    ctx.beginPath();
    ctx.moveTo(-8, -player.h / 2 + 4);
    ctx.lineTo(-16, -player.h / 2 + 4 + armAnim / 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, -player.h / 2 + 4);
    ctx.lineTo(16, -player.h / 2 + 4 - armAnim / 4);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore(); 

    
    drawParticles();

    ctx.restore(); 

    

    
    if (combo > 0 || comboPopupTimer > 0) {
      const alpha = combo > 0 ? 1 : comboPopupTimer / 60;
      ctx.globalAlpha = alpha;
      ctx.font = `bold 42px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffcc00';
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 20;
      ctx.fillText(`$${Math.floor(combo > 0 ? combo : save.money - combo).toLocaleString()}`, w / 2, h / 2 - 20);
      if (combo > 0) {
        ctx.font = '14px Share Tech Mono';
        ctx.fillStyle = 'rgba(255,204,0,0.7)';
        ctx.shadowBlur = 0;
        ctx.fillText('LAND TO BANK', w / 2, h / 2 + 8);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }

    
    if (trickPopupTimer > 0) {
      const alpha = Math.min(1, trickPopupTimer / 20);
      const yOff  = (60 - trickPopupTimer) * 0.6;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 20px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.fillText(trickPopupText, w / 2, h / 2 - 80 - yOff);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }
  }

  
  function refreshHUD() {
    const board = BOARDS[save.boardIndex];
    setText('hud-money',  `$${Math.floor(save.money).toLocaleString()}`);
    setText('hud-level',  save.level);
    setText('hud-board',  board.name);
    setText('hud-combo',  Math.floor(combo).toLocaleString());
    setText('hud-tricks', save.lifetimeTricks.toLocaleString());

    const xpPct = (save.xp / save.nextXP * 100).toFixed(1);
    const bar = document.getElementById('xp-bar');
    if (bar) bar.style.width = xpPct + '%';
    setText('hud-xp', `${save.xp} / ${save.nextXP}`);

    
    BOARDS.forEach((b, i) => {
      const btn = document.getElementById(`buy-board-${i}`);
      if (!btn) return;
      if (i <= save.boardIndex) {
        btn.textContent = 'OWNED';
        btn.disabled = true;
        btn.classList.add('owned');
      } else if (save.money >= b.cost) {
        btn.disabled = false;
      } else {
        btn.disabled = true;
      }
    });
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  
  window.buyBoard = function(index) {
    const b = BOARDS[index];
    if (index <= save.boardIndex) return toast('Already owned!');
    if (save.money < b.cost) return toast(`Need $${b.cost.toLocaleString()}`);
    save.money -= b.cost;
    save.boardIndex = index;
    saveSet(save);
    toast(`Got ${b.name}! Multiplier: ${b.multiplier}x`);
    refreshHUD();
  };

  window.resetSave = function() {
    if (confirm('Delete all save data?')) { saveReset(); location.reload(); }
  };

  
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  refreshHUD();
  loop();
})();

(function initProfile() {
  if (!document.getElementById('profile-page')) return;

  let save = saveGet();
  let selectedAvatar = save.avatar || '🛹';

  
  document.querySelectorAll('.avatar-opt').forEach(el => {
    if (el.dataset.avatar === selectedAvatar) el.classList.add('selected');
    el.addEventListener('click', () => {
      document.querySelectorAll('.avatar-opt').forEach(a => a.classList.remove('selected'));
      el.classList.add('selected');
      selectedAvatar = el.dataset.avatar;
      document.getElementById('avatar-display').textContent = selectedAvatar;
    });
  });

  
  const nameInput = document.getElementById('username-input');
  if (nameInput) nameInput.value = save.username !== 'SKATER' ? save.username : '';
  document.getElementById('avatar-display').textContent = selectedAvatar;

  
  renderProfileStats(save);

  document.getElementById('save-profile-btn')?.addEventListener('click', () => {
    const name = nameInput?.value.trim();
    if (!name) return toast('Enter a username!');
    save.username = name;
    save.avatar   = selectedAvatar;
    saveSet(save);
    renderProfileStats(save);
    toast('Profile saved!');
  });

  document.getElementById('reset-profile-btn')?.addEventListener('click', () => {
    if (confirm('Delete all save data? This cannot be undone.')) {
      saveReset();
      location.reload();
    }
  });

  function renderProfileStats(s) {
    const board = BOARDS[s.boardIndex] || BOARDS[0];
    setText('stat-level',  s.level);
    setText('stat-xp',     `${s.xp} / ${s.nextXP}`);
    setText('stat-money',  `$${Math.floor(s.money).toLocaleString()}`);
    setText('stat-tricks', s.lifetimeTricks.toLocaleString());
    setText('stat-combo',  `$${Math.floor(s.highestCombo).toLocaleString()}`);
    setText('stat-board',  board.name);
    setText('display-name', s.username);
    setText('display-avatar', s.avatar);
    const xpBar = document.getElementById('profile-xp-bar');
    if (xpBar) xpBar.style.width = ((s.xp / s.nextXP) * 100) + '%';
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
})();

(function initAchievements() {
  if (!document.getElementById('ach-grid')) return;

  const ACHIEVEMENTS = [
    { id: 'first_trick',   icon: '🛹', title: 'First Trick',       desc: 'Land your first trick',           check: s => s.lifetimeTricks >= 1 },
    { id: 'tricks_50',     icon: '🔥', title: 'On Fire',           desc: 'Land 50 tricks',                  check: s => s.lifetimeTricks >= 50 },
    { id: 'tricks_250',    icon: '💥', title: 'Trick Machine',     desc: 'Land 250 tricks',                 check: s => s.lifetimeTricks >= 250 },
    { id: 'tricks_1000',   icon: '🌀', title: 'Untouchable',       desc: 'Land 1,000 tricks',               check: s => s.lifetimeTricks >= 1000 },
    { id: 'money_500',     icon: '💸', title: 'Lunch Money',       desc: 'Earn $500',                       check: s => s.money >= 500 },
    { id: 'money_5000',    icon: '💰', title: 'Stacked',           desc: 'Earn $5,000',                     check: s => s.money >= 5000 },
    { id: 'money_50000',   icon: '💵', title: 'Rich Skater',       desc: 'Earn $50,000',                    check: s => s.money >= 50000 },
    { id: 'money_1m',      icon: '💎', title: 'Millionaire',       desc: 'Earn $1,000,000',                 check: s => s.money >= 1000000 },
    { id: 'combo_1000',    icon: '⚡', title: 'Combo Rookie',      desc: 'Reach a $1,000 combo',            check: s => s.highestCombo >= 1000 },
    { id: 'combo_10000',   icon: '🌪️', title: 'Combo King',        desc: 'Reach a $10,000 combo',           check: s => s.highestCombo >= 10000 },
    { id: 'combo_50000',   icon: '🏆', title: 'Combo Legend',      desc: 'Reach a $50,000 combo',           check: s => s.highestCombo >= 50000 },
    { id: 'level_5',       icon: '⭐', title: 'Getting There',     desc: 'Reach level 5',                   check: s => s.level >= 5 },
    { id: 'level_15',      icon: '🌟', title: 'Rising Star',       desc: 'Reach level 15',                  check: s => s.level >= 15 },
    { id: 'level_30',      icon: '🔱', title: 'Legend',            desc: 'Reach level 30',                  check: s => s.level >= 30 },
    { id: 'street_board',  icon: '🛹', title: 'Upgraded',          desc: 'Buy the Street Board',            check: s => s.boardIndex >= 1 },
    { id: 'pro_board',     icon: '👟', title: 'Going Pro',         desc: 'Buy the Pro Board',               check: s => s.boardIndex >= 2 },
    { id: 'legend_board',  icon: '👑', title: 'Legend Rider',      desc: 'Buy the Legend Board',            check: s => s.boardIndex >= 3 },
    { id: 'galaxy_board',  icon: '🌌', title: 'Galaxy Brain',      desc: 'Buy the Galaxy Board',            check: s => s.boardIndex >= 4 },
  ];

  const save = saveGet();
  const grid = document.getElementById('ach-grid');
  let unlocked = 0;

  ACHIEVEMENTS.forEach(a => {
    const earned = a.check(save);
    if (earned) unlocked++;

    const card = document.createElement('div');
    card.className = `ach-card ${earned ? 'unlocked' : 'locked'}`;
    card.innerHTML = `
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-info">
        <div class="ach-title">${a.title}</div>
        <div class="ach-desc">${a.desc}</div>
        <div class="ach-status">${earned ? '✦ UNLOCKED' : '⬡ LOCKED'}</div>
      </div>
    `;
    grid.appendChild(card);
  });

  const pct = Math.floor((unlocked / ACHIEVEMENTS.length) * 100);
  const bar = document.getElementById('ach-progress-bar');
  if (bar) bar.style.width = pct + '%';

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('ach-unlocked-count', unlocked);
  setText('ach-total-count', ACHIEVEMENTS.length);
  setText('ach-pct', `${pct}% complete`);

  document.getElementById('demo-data-btn')?.addEventListener('click', () => {
    const s = saveGet();
    s.level = 35; s.money = 75000; s.lifetimeTricks = 350;
    s.highestCombo = 15000; s.boardIndex = 3;
    saveSet(s);
    location.reload();
  });

  document.getElementById('reset-ach-btn')?.addEventListener('click', () => {
    if (confirm('Reset all progress?')) { saveReset(); location.reload(); }
  });
})();
