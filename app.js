'use strict';

const COLS = 10, ROWS = 20, BUFFER = 2, TOTAL_ROWS = ROWS + BUFFER;
const PIECE_TYPES = ['I','O','T','S','Z','J','L'];
const COLORS = { I:'#00f5ff', O:'#ffe600', T:'#b537f2', S:'#39ff14', Z:'#ff2a6d', J:'#4488ff', L:'#ff8800', garbage:'#555566' };
const DARKER = { I:'#009daa', O:'#b3a100', T:'#7a22a0', S:'#22aa0c', Z:'#b31c4b', J:'#2d55aa', L:'#aa5500', garbage:'#3a3a44' };
const GHOST_ALPHA = 0.25;
const GRID_COLOR = '#1c1c2a';
const GRID_BG = '#0e0e1a';
const SCORE_TABLE = { 1:100, 2:300, 3:500, 4:800 };
const SOFT_DROP_PTS = 1, HARD_DROP_PTS = 2, COMBO_BONUS = 50;
const GARBAGE_TABLE = { 2:1, 3:2, 4:4 };
const LINES_PER_LEVEL = 10;
const DAS_DELAY = 167, ARR_DELAY = 50;
const LOCK_DELAY = 500, MAX_LOCK_RESETS = 15;
const GARBAGE_DELAY = 600;
const LINE_CLEAR_MS = 300, SOFT_DROP_INTERVAL = 40, MAX_FRAME_MS = 100;
const BEST_OF = 5;

function getDropInterval(level, speedMul) {
  speedMul = speedMul || 1;
  return Math.max(30, (1000 - (level - 1) * 75) / speedMul);
}

const SHAPES = {
  I:[ [[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]], [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]] ],
  O:[ [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[0,1],[1,1]] ],
  T:[ [[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]] ],
  S:[ [[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]], [[1,1],[2,1],[0,2],[1,2]], [[0,0],[0,1],[1,1],[1,2]] ],
  Z:[ [[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[0,2]] ],
  J:[ [[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]] ],
  L:[ [[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]] ]
};

const KICKS = {
  JLSTZ:{
    '01':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]], '12':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '23':[[0,0],[1,0],[1,-1],[0,2],[1,2]], '30':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '10':[[0,0],[1,0],[1,-1],[0,2],[1,2]], '21':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '32':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]], '03':[[0,0],[1,0],[1,1],[0,-2],[1,-2]]
  },
  I:{
    '01':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]], '12':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '23':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]], '30':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '10':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]], '21':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '32':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]], '03':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
  }
};

class Board {
  constructor() { this.grid = this._empty(); }
  _empty() { return Array.from({length:TOTAL_ROWS}, () => Array(COLS).fill(null)); }
  reset() { this.grid = this._empty(); }
  isValid(type, rot, col, row) {
    const cells = SHAPES[type][rot];
    for (let i = 0; i < cells.length; i++) {
      const x = col + cells[i][0], y = row + cells[i][1];
      if (x < 0 || x >= COLS || y >= TOTAL_ROWS) return false;
      if (y < 0) continue;
      if (this.grid[y][x] !== null) return false;
    }
    return true;
  }
  lock(piece) {
    const cells = SHAPES[piece.type][piece.rot];
    for (let i = 0; i < cells.length; i++) {
      const x = piece.col + cells[i][0], y = piece.row + cells[i][1];
      if (y >= 0 && y < TOTAL_ROWS && x >= 0 && x < COLS) this.grid[y][x] = piece.type;
    }
  }
  fullRows() {
    const rows = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
      let full = true;
      for (let c = 0; c < COLS; c++) { if (this.grid[r][c] === null) { full = false; break; } }
      if (full) rows.push(r);
    }
    return rows;
  }
  removeRows(rows) {
    for (let i = rows.length - 1; i >= 0; i--) { this.grid.splice(rows[i], 1); this.grid.unshift(Array(COLS).fill(null)); }
  }
  addGarbage(count) {
    const gap = Math.floor(Math.random() * COLS);
    for (let i = 0; i < count; i++) {
      this.grid.shift();
      const row = Array(COLS).fill('garbage'); row[gap] = null;
      this.grid.push(row);
    }
  }
  isBlocked() {
    for (let r = 0; r < BUFFER; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c] !== null) return true;
    return false;
  }
}

class Bag {
  constructor() { this.q = []; this._fill(); }
  _fill() {
    const a = [...PIECE_TYPES];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    this.q = a.concat(this.q);
  }
  next() { if (this.q.length === 0) this._fill(); return this.q.pop(); }
}

class Player {
  constructor(id, speedMul) {
    this.id = id;
    this.speedMul = speedMul || 1;
    this.board = new Board();
    this.bag = new Bag();
    this.score = 0; this.lines = 0; this.level = 1; this.combo = -1;
    this.piece = null; this.holdType = null; this.held = false; this.nextQ = [];
    this.dropAccum = 0; this.dropInterval = getDropInterval(1, this.speedMul);
    this.lockTimer = 0; this.lockResets = 0; this.onGround = false;
    this.clearRows = []; this.clearTimer = 0; this.clearing = false;
    this.pendingGarbage = 0; this.garbageTimer = 0; this.garbageQueued = false;
    this.alive = true;
    this._fillQ();
  }
  _fillQ() { while (this.nextQ.length < 5) this.nextQ.push(this.bag.next()); }
  spawn() {
    const type = this.nextQ.shift(); this._fillQ();
    const col = type === 'O' ? 4 : 3;
    if (!this.board.isValid(type, 0, col, BUFFER)) { this.alive = false; return; }
    this.piece = {type, rot:0, col, row:BUFFER};
    this.held = false; this.dropAccum = 0;
    this.dropInterval = getDropInterval(this.level, this.speedMul);
    this.lockTimer = 0; this.lockResets = 0; this.onGround = false;
  }
  ghostRow() {
    if (!this.piece) return 0;
    let r = this.piece.row;
    while (this.board.isValid(this.piece.type, this.piece.rot, this.piece.col, r + 1)) r++;
    return r;
  }
  move(dx) {
    if (!this.piece || this.clearing) return false;
    if (this.board.isValid(this.piece.type, this.piece.rot, this.piece.col + dx, this.piece.row)) {
      this.piece.col += dx; this._resetLock(); return true;
    }
    return false;
  }
  rotate() {
    if (!this.piece || this.clearing) return false;
    const t = this.piece.type;
    if (t === 'O') return false;
    const from = this.piece.rot, to = (from + 1) % 4;
    const table = t === 'I' ? KICKS.I : KICKS.JLSTZ;
    const kicks = table[from + '' + to];
    if (!kicks) return false;
    for (let i = 0; i < kicks.length; i++) {
      const dx = kicks[i][0], dy = kicks[i][1];
      if (this.board.isValid(t, to, this.piece.col + dx, this.piece.row + dy)) {
        this.piece.col += dx; this.piece.row += dy; this.piece.rot = to; this._resetLock(); return true;
      }
    }
    return false;
  }
  softDrop() {
    if (!this.piece || this.clearing) return false;
    if (this.board.isValid(this.piece.type, this.piece.rot, this.piece.col, this.piece.row + 1)) {
      this.piece.row++; this.dropAccum = 0; return true;
    }
    return false;
  }
  hardDrop() {
    if (!this.piece || this.clearing) return;
    let n = 0;
    while (this.board.isValid(this.piece.type, this.piece.rot, this.piece.col, this.piece.row + 1)) { this.piece.row++; n++; }
    this.score += n * HARD_DROP_PTS;
    this._lock();
  }
  hold() {
    if (!this.piece || this.held || this.clearing) return;
    this.held = true;
    const cur = this.piece.type;
    if (this.holdType) {
      const h = this.holdType; this.holdType = cur;
      const col = h === 'O' ? 4 : 3;
      if (!this.board.isValid(h, 0, col, 0)) { this.alive = false; return; }
      this.piece = {type:h, rot:0, col, row:BUFFER};
    } else {
      this.holdType = cur; this.spawn();
    }
    this.dropAccum = 0; this.lockTimer = 0; this.lockResets = 0; this.onGround = false;
  }
  _resetLock() {
    if (this.onGround && this.lockResets < MAX_LOCK_RESETS) { this.lockTimer = 0; this.lockResets++; }
  }
  _lock() {
    if (!this.piece) return;
    this.board.lock(this.piece); this.piece = null;
    const full = this.board.fullRows();
    if (full.length > 0) {
      this.clearRows = full; this.clearing = true; this.clearTimer = LINE_CLEAR_MS;
      this.combo++;
      this.score += (SCORE_TABLE[full.length] || 0) * this.level;
      if (this.combo > 0) this.score += COMBO_BONUS * this.combo * this.level;
      this.lines += full.length;
      this.level = Math.floor(this.lines / LINES_PER_LEVEL) + 1;
      this.dropInterval = getDropInterval(this.level, this.speedMul);
    } else {
      this.combo = -1; this.spawn();
      if (this.alive) this._applyGarbage();
    }
  }
  _applyGarbage() {
    if (this.pendingGarbage > 0) {
      this.board.addGarbage(this.pendingGarbage);
      this.pendingGarbage = 0; this.garbageQueued = false;
      if (this.board.isBlocked()) this.alive = false;
    }
  }
  queueGarbage(count) { this.pendingGarbage += count; this.garbageQueued = true; this.garbageTimer = 0; }
  update(dt) {
    if (!this.alive) return null;
    if (this.clearing) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        const n = this.clearRows.length;
        this.board.removeRows(this.clearRows);
        this.clearRows = []; this.clearing = false; this.spawn();
        if (this.alive) this._applyGarbage();
        return {cleared: n};
      }
      return null;
    }
    if (!this.piece) return null;
    if (this.garbageQueued && this.pendingGarbage > 0) {
      this.garbageTimer += dt;
      if (this.garbageTimer >= GARBAGE_DELAY) { this._applyGarbage(); this.garbageTimer = 0; }
    }
    const grounded = !this.board.isValid(this.piece.type, this.piece.rot, this.piece.col, this.piece.row + 1);
    if (grounded) {
      if (!this.onGround) { this.onGround = true; this.lockTimer = 0; }
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY) { this._lock(); return null; }
    } else { this.onGround = false; this.lockTimer = 0; }
    this.dropAccum += dt;
    while (this.dropAccum >= this.dropInterval) {
      this.dropAccum -= this.dropInterval;
      if (this.board.isValid(this.piece.type, this.piece.rot, this.piece.col, this.piece.row + 1)) this.piece.row++;
    }
    return null;
  }
  nextPreview() { return this.nextQ.length > 0 ? this.nextQ[0] : null; }
}

class Input {
  constructor() {
    this.keys = new Set(); this.newKeys = new Set(); this.das = {};
    this._kd = this._kd.bind(this); this._ku = this._ku.bind(this);
    document.addEventListener('keydown', this._kd);
    document.addEventListener('keyup', this._ku);
  }
  _kd(e) {
    if (e.repeat) return;
    const k = e.code;
    this.keys.add(k); this.newKeys.add(k);
    this.das[k] = {t:0, fire:false};
    if (this._isGame(k)) e.preventDefault();
  }
  _ku(e) { this.keys.delete(e.code); delete this.das[e.code]; }
  _isGame(k) {
    return ['KeyA','KeyD','KeyS','KeyW','KeyC','ShiftLeft','ShiftRight',
      'Space','ArrowLeft','ArrowRight','ArrowDown','ArrowUp',
      'Enter','Numpad0','ControlRight','NumpadDecimal','Escape','KeyP'].includes(k);
  }
  pressed(k) { return this.newKeys.has(k); }
  down(k) { return this.keys.has(k); }
  dasTick(k, dt) {
    const d = this.das[k];
    if (!d) return false;
    d.t += dt;
    if (!d.fire) { if (d.t >= DAS_DELAY) { d.fire = true; d.t = 0; return true; } }
    else { if (d.t >= ARR_DELAY) { d.t -= ARR_DELAY; return true; } }
    return false;
  }
  endFrame() { this.newKeys.clear(); }
}

const Renderer = {
  drawBoard(ctx, board, piece, ghostY, cs, clearRows, clearT) {
    const w = COLS * cs, h = ROWS * cs;
    ctx.fillStyle = GRID_BG; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = GRID_COLOR; ctx.lineWidth = 0.5;
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * cs); ctx.lineTo(w, r * cs); ctx.stroke(); }
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * cs, 0); ctx.lineTo(c * cs, h); ctx.stroke(); }
    for (let r = BUFFER; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = board.grid[r][c]; if (!v) continue;
        const vis = r - BUFFER;
        if (clearRows.indexOf(r) !== -1) {
          const flash = Math.floor(clearT / 50) % 2 === 0;
          this._cell(ctx, c, vis, cs, flash ? '#ffffff' : COLORS[v], flash ? '#cccccc' : DARKER[v]);
        } else {
          this._cell(ctx, c, vis, cs, COLORS[v], DARKER[v]);
        }
      }
    }
    if (piece && ghostY !== undefined) {
      const cells = SHAPES[piece.type][piece.rot];
      for (let i = 0; i < cells.length; i++) {
        const gx = piece.col + cells[i][0], gy = ghostY + cells[i][1] - BUFFER;
        if (gy >= 0 && gy < ROWS) this._ghost(ctx, gx, gy, cs, COLORS[piece.type]);
      }
    }
    if (piece) {
      const cells = SHAPES[piece.type][piece.rot];
      for (let i = 0; i < cells.length; i++) {
        const px = piece.col + cells[i][0], py = piece.row + cells[i][1] - BUFFER;
        if (py >= 0 && py < ROWS) this._cell(ctx, px, py, cs, COLORS[piece.type], DARKER[piece.type]);
      }
    }
  },
  _cell(ctx, col, row, s, fill, dark) {
    const x = col * s + 1, y = row * s + 1, sz = s - 2;
    ctx.fillStyle = fill; ctx.fillRect(x, y, sz, sz);
    ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(x, y, sz, 2); ctx.fillRect(x, y, 2, sz);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + sz - 2, sz, 2); ctx.fillRect(x + sz - 2, y, 2, sz);
    if (dark) { ctx.fillStyle = dark; ctx.fillRect(x + 2, y + sz - 4, sz - 4, 2); ctx.fillRect(x + sz - 4, y + 2, 2, sz - 4); }
  },
  _ghost(ctx, col, row, s, color) {
    const x = col * s + 1, y = row * s + 1, sz = s - 2;
    ctx.globalAlpha = GHOST_ALPHA; ctx.fillStyle = color; ctx.fillRect(x, y, sz, sz);
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, sz - 1, sz - 1);
    ctx.globalAlpha = 1;
  },
  drawPreview(ctx, type, cs, cw, ch) {
    ctx.clearRect(0, 0, cw, ch);
    if (!type) return;
    const cells = SHAPES[type][0];
    let mnC = 9, mxC = 0, mnR = 9, mxR = 0;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i][0] < mnC) mnC = cells[i][0]; if (cells[i][0] > mxC) mxC = cells[i][0];
      if (cells[i][1] < mnR) mnR = cells[i][1]; if (cells[i][1] > mxR) mxR = cells[i][1];
    }
    const pw = (mxC - mnC + 1) * cs, ph = (mxR - mnR + 1) * cs;
    const ox = (cw - pw) / 2 - mnC * cs, oy = (ch - ph) / 2 - mnR * cs;
    for (let i = 0; i < cells.length; i++) {
      const cx = cells[i][0] * cs + ox + 1, cy = cells[i][1] * cs + oy + 1, sz = cs - 2;
      ctx.fillStyle = COLORS[type]; ctx.fillRect(cx, cy, sz, sz);
      ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(cx, cy, sz, 2); ctx.fillRect(cx, cy, 2, sz);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx, cy + sz - 2, sz, 2); ctx.fillRect(cx + sz - 2, cy, 2, sz);
    }
  }
};

class Game {
  constructor() {
    this.state = 'menu'; this.mode = 'solo';
    this.speedMul = 1; this.soloControl = 'wasd';
    this.players = []; this.input = new Input();
    this.p1Wins = 0; this.p2Wins = 0; this.gameNum = 0;
    this.lastT = 0; this.cvs = {}; this.ctx = {};
    this._bgCvs = document.getElementById('bgCanvas');
    this._bgCtx = this._bgCvs.getContext('2d');
    this._particles = [];
    this._initCanvases(); this._initBG(); this._initUI();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }
  _initCanvases() {
    ['gameCanvas','gameCanvasV1','gameCanvasV2','holdCanvas1','holdCanvas2','holdCanvasV1','holdCanvasV2','nextCanvas1','nextCanvas2','nextCanvasV1','nextCanvasV2'].forEach(id => {
      const c = document.getElementById(id);
      if (c) { this.cvs[id] = c; this.ctx[id] = c.getContext('2d'); }
    });
  }
  _cs(boardId) { const c = this.cvs[boardId]; return c ? c.width / COLS : 30; }
  _initBG() {
    this._resizeBG();
    window.addEventListener('resize', () => this._resizeBG());
    for (let i = 0; i < 60; i++) {
      this._particles.push({
        x: Math.random() * this._bgCvs.width, y: Math.random() * this._bgCvs.height,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.8 + 0.5, a: Math.random() * 0.25 + 0.05,
        color: ['#00f5ff','#b537f2','#ff2a6d'][Math.floor(Math.random()*3)]
      });
    }
  }
  _resizeBG() { this._bgCvs.width = window.innerWidth; this._bgCvs.height = window.innerHeight; }
  _drawBG() {
    const ctx = this._bgCtx, w = this._bgCvs.width, h = this._bgCvs.height;
    ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.globalAlpha = p.a; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  _initUI() {
    const $ = id => document.getElementById(id);
    $('btnSolo').onclick = () => this._start('solo');
    $('btnVersus').onclick = () => this._start('versus');
    $('btnControls').onclick = () => { $('menuOverlay').classList.remove('active'); $('controlsOverlay').classList.add('active'); };
    $('btnBackMenu').onclick = () => { $('controlsOverlay').classList.remove('active'); $('menuOverlay').classList.add('active'); };
    $('pauseBtn').onclick = () => this._pause();
    $('btnPauseResume').onclick = () => this._resume();
    $('btnPauseRestart').onclick = () => this._restart();
    $('btnPauseQuit').onclick = () => this._menu();
    $('btnGoRetry').onclick = () => this._restart();
    $('btnGoMenu').onclick = () => this._menu();
    $('btnMatchMenu').onclick = () => { this.p1Wins = 0; this.p2Wins = 0; this._menu(); };
    const slider = $('speedSlider');
    const display = $('speedDisplay');
    if (slider && display) {
      slider.addEventListener('input', () => { display.textContent = parseFloat(slider.value).toFixed(1) + 'x'; });
    }
  }
  _show(id) { document.getElementById(id).classList.add('active'); }
  _hide(id) { document.getElementById(id).classList.remove('active'); }
  _start(mode) {
    this.mode = mode; this.p1Wins = 0; this.p2Wins = 0; this.gameNum++;
    const slider = document.getElementById('speedSlider');
    this.speedMul = slider ? parseFloat(slider.value) : 1;
    const ctrlRadio = document.querySelector('input[name="soloControl"]:checked');
    this.soloControl = ctrlRadio ? ctrlRadio.value : 'wasd';
    this.players = [new Player(1, this.speedMul)];
    if (mode === 'versus') this.players.push(new Player(2, this.speedMul));
    this.players.forEach(p => p.spawn());
    this._hide('menuOverlay'); this._hide('gameoverOverlay'); this._hide('matchOverOverlay');
    document.getElementById('soloArea').classList.toggle('hidden', mode !== 'solo');
    document.getElementById('versusArea').classList.toggle('hidden', mode !== 'versus');
    if (mode === 'versus') this._updateWinDisplay();
    this.state = 'playing'; this.lastT = 0;
  }
  _pause() { if (this.state === 'playing') { this.state = 'paused'; this._show('pauseOverlay'); } }
  _resume() { if (this.state === 'paused') { this.state = 'playing'; this._hide('pauseOverlay'); this.lastT = 0; } }
  _restart() { this._hide('pauseOverlay'); this._hide('gameoverOverlay'); this._hide('matchOverOverlay'); this._start(this.mode); }
  _menu() {
    this.state = 'menu';
    ['pauseOverlay','gameoverOverlay','matchOverOverlay'].forEach(id => this._hide(id));
    document.getElementById('soloArea').classList.add('hidden');
    document.getElementById('versusArea').classList.add('hidden');
    this._show('menuOverlay');
  }
  _gameOver() {
    this.state = 'gameover';
    const $ = id => document.getElementById(id);
    if (this.mode === 'solo') {
      const p = this.players[0];
      $('goTitle').textContent = 'GAME OVER';
      $('goScore').textContent = p.score.toLocaleString();
      $('goLevel').textContent = p.level;
      $('goLines').textContent = p.lines;
      $('goWinner').textContent = '-';
      $('goWinner').className = '';
      $('goMatchScore').textContent = '-';
      $('goMatchResult').textContent = '';
    } else {
      const loser = this.players[0].alive ? 0 : 1;
      const winner = 1 - loser;
      if (winner === 0) this.p1Wins++; else this.p2Wins++;
      this._updateWinDisplay();
      const matchDone = this.p1Wins >= Math.ceil(BEST_OF / 2) || this.p2Wins >= Math.ceil(BEST_OF / 2);
      $('goTitle').textContent = 'PLAYER ' + (winner + 1) + ' WINS!';
      $('goScore').textContent = this.players[0].score.toLocaleString();
      $('goLevel').textContent = this.players[0].level;
      $('goLines').textContent = this.players[0].lines;
      $('goWinner').textContent = 'Player ' + (winner + 1);
      $('goWinner').className = winner === 0 ? 'p1-color' : 'p2-color';
      $('goMatchScore').textContent = this.p1Wins + ' - ' + this.p2Wins;
      if (matchDone) {
        $('goMatchResult').textContent = 'Player ' + (this.p1Wins > this.p2Wins ? '1' : '2') + ' wins the match!';
      } else {
        $('goMatchResult').textContent = '';
      }
    }
    this._show('gameoverOverlay');
  }
  _updateWinDisplay() {
    document.getElementById('winDisplay').innerHTML =
      '<span class="p1-color win-counter">' + this.p1Wins + '</span>' +
      '<span class="win-sep">-</span>' +
      '<span class="p2-color win-counter">' + this.p2Wins + '</span>';
  }
  _handleInput(dt) {
    if (this.state !== 'playing') return;
    const inp = this.input;
    if (inp.pressed('Escape') || inp.pressed('KeyP')) { this._pause(); return; }
    if (this.mode === 'solo') {
      this._handleSolo(inp, this.players[0], dt);
    } else {
      this._handleP(inp, this.players[0], dt, 1);
      if (this.players.length > 1) this._handleP(inp, this.players[1], dt, 2);
    }
  }
  _handleSolo(inp, pl, dt) {
    if (!pl.alive) return;
    let lk, rk, dk, uk, hk, sk;
    if (this.soloControl === 'wasd') { lk='KeyA'; rk='KeyD'; dk='KeyS'; uk='KeyW'; hk='Space'; sk='KeyC'; }
    else { lk='ArrowLeft'; rk='ArrowRight'; dk='ArrowDown'; uk='ArrowUp'; hk='Enter'; sk='NumpadDecimal'; }
    if (inp.pressed(lk)) pl.move(-1); else if (inp.down(lk) && inp.dasTick(lk, dt)) pl.move(-1);
    if (inp.pressed(rk)) pl.move(1); else if (inp.down(rk) && inp.dasTick(rk, dt)) pl.move(1);
    if (inp.pressed(uk)) pl.rotate();
    if (inp.down(dk)) {
      pl.dropAccum += dt;
      while (pl.dropAccum >= SOFT_DROP_INTERVAL) { pl.dropAccum -= SOFT_DROP_INTERVAL; if (pl.softDrop()) { pl.score += SOFT_DROP_PTS; } else break; }
    }
    if (inp.pressed(hk)) pl.hardDrop();
    if (inp.pressed(sk)) pl.hold();
  }
  _handleP(inp, pl, dt, num) {
    if (!pl.alive) return;
    let lk, rk, dk, uk, hk1, hk2, sk1, sk2;
    if (num === 1) { lk='KeyA'; rk='KeyD'; dk='KeyS'; uk='KeyW'; hk1='Space'; hk2=''; sk1='KeyC'; sk2='ShiftLeft'; }
    else { lk='ArrowLeft'; rk='ArrowRight'; dk='ArrowDown'; uk='ArrowUp'; hk1='Enter'; hk2='Numpad0'; sk1='ControlRight'; sk2='NumpadDecimal'; }
    if (inp.pressed(lk)) pl.move(-1); else if (inp.down(lk) && inp.dasTick(lk, dt)) pl.move(-1);
    if (inp.pressed(rk)) pl.move(1); else if (inp.down(rk) && inp.dasTick(rk, dt)) pl.move(1);
    if (inp.pressed(uk)) pl.rotate();
    if (inp.down(dk)) {
      pl.dropAccum += dt;
      while (pl.dropAccum >= SOFT_DROP_INTERVAL) { pl.dropAccum -= SOFT_DROP_INTERVAL; if (pl.softDrop()) { pl.score += SOFT_DROP_PTS; } else break; }
    }
    if (inp.pressed(hk1) || (hk2 && inp.pressed(hk2))) pl.hardDrop();
    if (inp.pressed(sk1) || inp.pressed(sk2) || (num === 1 && inp.pressed('ShiftRight'))) pl.hold();
  }
  _update(dt) {
    if (this.state !== 'playing') return;
    const results = this.players.map(p => p.update(dt));
    if (this.mode === 'versus') {
      for (let i = 0; i < results.length; i++) {
        if (results[i] && results[i].cleared) {
          const g = GARBAGE_TABLE[results[i].cleared] || 0;
          if (g > 0) {
            const opp = this.players[1 - i];
            const cancel = Math.min(opp.pendingGarbage, g);
            opp.pendingGarbage -= cancel;
            const remain = g - cancel;
            if (remain > 0) opp.queueGarbage(remain);
          }
        }
      }
    }
    for (const p of this.players) { if (!p.alive) { this._gameOver(); return; } }
  }
  _render() {
    if (this.state === 'menu') return;
    if (this.mode === 'solo') this._renderSolo(); else this._renderVersus();
  }
  _renderSolo() {
    const p = this.players[0]; if (!p) return;
    const cs = this._cs('gameCanvas');
    Renderer.drawBoard(this.ctx['gameCanvas'], p.board, p.piece, p.ghostRow(), cs, p.clearRows, p.clearTimer);
    Renderer.drawPreview(this.ctx['holdCanvas1'], p.holdType, 28, 120, 120);
    Renderer.drawPreview(this.ctx['nextCanvas1'], p.nextPreview(), 28, 120, 120);
    document.getElementById('score').textContent = p.score.toLocaleString();
    document.getElementById('lines').textContent = p.lines;
    document.getElementById('level').textContent = p.level;
  }
  _renderVersus() {
    for (let i = 0; i < 2; i++) {
      const p = this.players[i]; if (!p) continue;
      const boardId = i === 0 ? 'gameCanvasV1' : 'gameCanvasV2';
      const holdId = i === 0 ? 'holdCanvasV1' : 'holdCanvasV2';
      const nextId = i === 0 ? 'nextCanvasV1' : 'nextCanvasV2';
      const cs = this._cs(boardId);
      Renderer.drawBoard(this.ctx[boardId], p.board, p.piece, p.ghostRow(), cs, p.clearRows, p.clearTimer);
      Renderer.drawPreview(this.ctx[holdId], p.holdType, 18, 90, 90);
      Renderer.drawPreview(this.ctx[nextId], p.nextPreview(), 18, 90, 90);
      if (i === 0) {
        document.getElementById('scoreV1').textContent = p.score.toLocaleString();
        document.getElementById('linesV1').textContent = p.lines;
        document.getElementById('levelV1').textContent = p.level;
      } else {
        document.getElementById('scoreV2').textContent = p.score.toLocaleString();
        document.getElementById('linesV2').textContent = p.lines;
        document.getElementById('levelV2').textContent = p.level;
      }
    }
  }
  _loop(t) {
    if (this.lastT === 0) this.lastT = t;
    const dt = Math.min(t - this.lastT, MAX_FRAME_MS); this.lastT = t;
    this._drawBG();
    if (this.state === 'playing') { this._handleInput(dt); this._update(dt); }
    this._render();
    this.input.endFrame();
    requestAnimationFrame(this._loop);
  }
}

document.addEventListener('DOMContentLoaded', () => { new Game(); });
