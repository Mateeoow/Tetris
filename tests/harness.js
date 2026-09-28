'use strict';
// Loads app.js (a browser script) into a Node vm sandbox with a stubbed DOM,
// and exposes helpers to run Game.prototype._gameOver() on a controlled state.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function makeDocument() {
  const elements = new Map();
  const getElementById = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        id,
        textContent: '',
        innerHTML: '',
        className: '',
        classList: {
          add: c => classes.add(c),
          remove: c => classes.delete(c),
          contains: c => classes.has(c),
        },
      });
    }
    return elements.get(id);
  };
  return { getElementById, addEventListener() {}, elements };
}

function loadApp() {
  const document = makeDocument();
  const sandbox = { document, window: {}, console, Math };
  vm.createContext(sandbox);
  // Class/const declarations are not placed on the global object, so export them explicitly.
  vm.runInContext(SRC + '\n;globalThis.__exports = { Game, BEST_OF };', sandbox);
  return { document, ...sandbox.__exports };
}

// Build a Game-like instance without running the constructor (which wires DOM/canvas).
function runGameOver({ mode, p0Alive, p1Alive, p1Wins = 0, p2Wins = 0, players }) {
  const { Game, document, BEST_OF } = loadApp();
  const g = Object.create(Game.prototype);
  g.mode = mode;
  g.p1Wins = p1Wins;
  g.p2Wins = p2Wins;
  g.players = players || [
    { alive: p0Alive, score: 0, level: 1, lines: 0 },
    { alive: p1Alive, score: 0, level: 1, lines: 0 },
  ];
  g._gameOver();
  const el = id => document.getElementById(id);
  return { game: g, el, BEST_OF };
}

module.exports = { loadApp, runGameOver };
