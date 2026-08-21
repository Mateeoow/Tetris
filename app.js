'use strict';

const COLS = 10, ROWS = 20, BUFFER = 2, TOTAL_ROWS = ROWS + BUFFER;
const PIECE_TYPES = ['I','O','T','S','Z','J','L'];
const COLORS = { I:'#4f7f91', O:'#d2a642', T:'#806b8f', S:'#638667', Z:'#c95440', J:'#405f8d', L:'#c77b3b', garbage:'#77736b' };
const DARKER = { I:'#2f5360', O:'#8a6a25', T:'#51445c', S:'#3d5b40', Z:'#823326', J:'#283d5d', L:'#7e4b24', garbage:'#4b4944' };
const GHOST_ALPHA = 0.25;
const GRID_COLOR = '#30302c';
const GRID_BG = '#171715';
const SCORE_TABLE = { 1:100, 2:300, 3:500, 4:800 };
const SOFT_DROP_PTS = 1, HARD_DROP_PTS = 2, COMBO_BONUS = 50;
const GARBAGE_TABLE = { 2:1, 3:2, 4:4 };
const LINES_PER_LEVEL = 10;
const DAS_DELAY = 167, ARR_DELAY = 50;
const LOCK_DELAY = 500, MAX_LOCK_RESETS = 15;
const GARBAGE_DELAY = 600;
const LINE_CLEAR_MS = 360, LANDING_IMPACT_MS = 180, SOFT_DROP_INTERVAL = 40, MAX_FRAME_MS = 100;
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
    return this.grid.reduce((rows, row, index) => {
      if (row.every(cell => cell !== null)) rows.push(index);
      return rows;
    }, []);
  }
  removeRows(rows) {
    const rowsToRemove = new Set(rows);
    this.grid = this.grid.filter((_, index) => !rowsToRemove.has(index));
    while (this.grid.length < TOTAL_ROWS) this.grid.unshift(Array(COLS).fill(null));
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
    this.lastLockedCells = []; this.impactTimer = 0;
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
    const lockedPiece = {
      type: this.piece.type,
      rot: this.piece.rot,
      col: this.piece.col,
      row: this.piece.row
    };
    this.lastLockedCells = SHAPES[lockedPiece.type][lockedPiece.rot].map(([x, y]) => ({
      x: lockedPiece.col + x,
      y: lockedPiece.row + y
    }));
    this.board.lock(lockedPiece); this.piece = null;
    this.impactTimer = LANDING_IMPACT_MS;

    // Evaluate the entire grid once, before any row mutation. This preserves
    // simultaneous doubles, triples, and tetrises as one clear event.
    const full = this.board.fullRows();
    if (full.length > 0) {
      this.clearRows = full.slice(); this.clearing = true; this.clearTimer = LINE_CLEAR_MS;
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
        this.clearRows = []; this.clearing = false; this.lastLockedCells = [];
        this.spawn();
        if (this.alive) this._applyGarbage();
        return {cleared: n};
      }
      return null;
    }
    if (!this.piece) return null;
    this.impactTimer = Math.max(0, this.impactTimer - dt);
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
  drawBoard(ctx, board, piece, ghostY, cs, clearRows, clearT, lockedCells, impactT) {
    const w = COLS * cs, h = ROWS * cs;
    ctx.fillStyle = GRID_BG; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = GRID_COLOR; ctx.lineWidth = 0.65;
    ctx.globalAlpha = 0.75;
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * cs); ctx.lineTo(w, r * cs); ctx.stroke(); }
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * cs, 0); ctx.lineTo(c * cs, h); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const lockedSet = new Set((lockedCells || []).map(cell => cell.x + ':' + cell.y));
    for (let r = BUFFER; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = board.grid[r][c]; if (!v) continue;
        const vis = r - BUFFER;
        if (clearRows.indexOf(r) !== -1) {
          const progress = 1 - clearT / LINE_CLEAR_MS;
          const flash = Math.floor(clearT / 55) % 2 === 0;
          this._cell(ctx, c, vis, cs, flash ? '#f4f0e8' : '#c94d3b', '#171715', 1 - progress * 0.45, 1 + progress * 0.08);
        } else {
          const impact = lockedSet.has(c + ':' + r) ? Math.min(1, (impactT || 0) / LANDING_IMPACT_MS) : 0;
          this._cell(ctx, c, vis, cs, COLORS[v], DARKER[v], 1, 1, impact);
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
  _cell(ctx, col, row, s, fill, dark, alpha = 1, scale = 1, impact = 0) {
    const inset = Math.max(1, s * 0.055), size = s - inset * 2;
    const cx = col * s + s / 2, cy = row * s + s / 2;
    const width = size * scale, height = size * scale;
    const x = cx - width / 2, y = cy - height / 2, radius = Math.min(2, width * 0.08);
    ctx.save();
    ctx.globalAlpha = alpha;
    this._roundedRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = dark || '#171715'; ctx.lineWidth = Math.max(1, s * 0.045); ctx.stroke();
    if (impact > 0) {
      ctx.globalAlpha = alpha * impact * 0.55;
      ctx.fillStyle = '#f4f0e8';
      ctx.fillRect(x + 1, y + height - Math.max(2, height * 0.12), width - 2, Math.max(2, height * 0.12));
    }
    ctx.restore();
  },
  _roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
  },
  _ghost(ctx, col, row, s, color) {
    const inset = Math.max(1, s * 0.055), x = col * s + inset, y = row * s + inset, sz = s - inset * 2;
    ctx.save(); ctx.globalAlpha = GHOST_ALPHA; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.setLineDash([Math.max(3, s * 0.18), Math.max(2, s * 0.12)]);
    this._roundedRect(ctx, x, y, sz, sz, Math.min(2, sz * 0.08)); ctx.stroke(); ctx.restore();
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
      this._cell(ctx, (cells[i][0] * cs + ox) / cs, (cells[i][1] * cs + oy) / cs, cs, COLORS[type], DARKER[type]);
    }
  }
};

class Game {
  constructor() {
    this.state = 'menu'; this.mode = 'solo';
    this.speedMul = 1; this.soloControl = 'wasd';
    this.players = []; this.input = new Input();
    this.p1Wins = 0; this.p2Wins = 0; this.gameNum = 0;
    this.highScore = this._loadHighScore();
    this.lastT = 0; this.cvs = {}; this.ctx = {};
    this._bgCvs = document.getElementById('bgCanvas');
    this._bgCtx = this._bgCvs.getContext('2d');
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
  }
  _resizeBG() {
    this._bgCvs.width = window.innerWidth;
    this._bgCvs.height = window.innerHeight;
    this._drawBG();
  }
  _loadHighScore() {
    try {
      return Number(localStorage.getItem('stack-high-score') || localStorage.getItem('neon-tetris-high-score')) || 0;
    }
    catch (_) { return 0; }
  }
  _saveHighScore(score) {
    if (score <= this.highScore) return;
    this.highScore = score;
    try { localStorage.setItem('stack-high-score', String(score)); }
    catch (_) { /* Storage may be unavailable when opened from a local file. */ }
  }
  _drawBG() {
    const ctx = this._bgCtx, w = this._bgCvs.width, h = this._bgCvs.height;
    ctx.fillStyle = '#e7e2d8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c94d3b'; ctx.fillRect(0, 0, w, 7);
    ctx.strokeStyle = 'rgba(23, 23, 19, 0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(48.5, 7); ctx.lineTo(48.5, h); ctx.stroke();
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
    Renderer.drawBoard(this.ctx['gameCanvas'], p.board, p.piece, p.ghostRow(), cs, p.clearRows, p.clearTimer, p.lastLockedCells, p.impactTimer);
    Renderer.drawPreview(this.ctx['holdCanvas1'], p.holdType, 28, 120, 120);
    Renderer.drawPreview(this.ctx['nextCanvas1'], p.nextPreview(), 28, 120, 120);
    this._saveHighScore(p.score);
    document.getElementById('score').textContent = p.score.toLocaleString();
    document.getElementById('highScore').textContent = this.highScore.toLocaleString();
    document.getElementById('lines').textContent = p.lines;
    document.getElementById('level').textContent = p.level;
    document.getElementById('comboVal').textContent = p.combo > 0 ? 'x' + (p.combo + 1) : '—';
    document.getElementById('attackVal').textContent = p.pendingGarbage;
  }
  _renderVersus() {
    for (let i = 0; i < 2; i++) {
      const p = this.players[i]; if (!p) continue;
      const boardId = i === 0 ? 'gameCanvasV1' : 'gameCanvasV2';
      const holdId = i === 0 ? 'holdCanvasV1' : 'holdCanvasV2';
      const nextId = i === 0 ? 'nextCanvasV1' : 'nextCanvasV2';
      const cs = this._cs(boardId);
      Renderer.drawBoard(this.ctx[boardId], p.board, p.piece, p.ghostRow(), cs, p.clearRows, p.clearTimer, p.lastLockedCells, p.impactTimer);
      Renderer.drawPreview(this.ctx[holdId], p.holdType, 18, 90, 90);
      Renderer.drawPreview(this.ctx[nextId], p.nextPreview(), 18, 90, 90);
      this._saveHighScore(p.score);
      if (i === 0) {
        document.getElementById('scoreV1').textContent = p.score.toLocaleString();
        document.getElementById('highScoreV1').textContent = this.highScore.toLocaleString();
        document.getElementById('linesV1').textContent = p.lines;
        document.getElementById('levelV1').textContent = p.level;
      } else {
        document.getElementById('scoreV2').textContent = p.score.toLocaleString();
        document.getElementById('highScoreV2').textContent = this.highScore.toLocaleString();
        document.getElementById('linesV2').textContent = p.lines;
        document.getElementById('levelV2').textContent = p.level;
      }
    }
  }
  _loop(t) {
    if (this.lastT === 0) this.lastT = t;
    const dt = Math.min(t - this.lastT, MAX_FRAME_MS); this.lastT = t;
    if (this.state === 'playing') { this._handleInput(dt); this._update(dt); }
    this._render();
    this.input.endFrame();
    requestAnimationFrame(this._loop);
  }
}

document.addEventListener('DOMContentLoaded', () => { new Game(); });
