'use strict';
// Property 2: Preservation - Non-Buggy Paths Unchanged
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { runGameOver } = require('./harness');

const stats = fc.record({
  score: fc.integer({ min: 0, max: 10_000_000 }),
  level: fc.integer({ min: 1, max: 30 }),
  lines: fc.integer({ min: 0, max: 999 }),
});

test('Property 2a: solo game over shows GAME OVER with stats and leaves win counters untouched', () => {
  fc.assert(
    fc.property(stats, fc.nat(10), fc.nat(10), (p, p1Wins, p2Wins) => {
      const players = [{ alive: false, ...p }];
      const { game, el } = runGameOver({ mode: 'solo', players, p1Wins, p2Wins });
      assert.equal(el('goTitle').textContent, 'GAME OVER');
      assert.equal(el('goScore').textContent, p.score.toLocaleString());
      assert.equal(el('goLevel').textContent, p.level);
      assert.equal(el('goLines').textContent, p.lines);
      assert.equal(el('goWinner').textContent, '-');
      assert.equal(el('goMatchScore').textContent, '-');
      assert.equal(el('goMatchResult').textContent, '');
      assert.equal(game.p1Wins, p1Wins);
      assert.equal(game.p2Wins, p2Wins);
      assert.ok(el('gameoverOverlay').classList.contains('active'));
    })
  );
});

// For match-scoring preservation, both players are dead so the winner index (0 via the
// original implicit path and the tie rule) is the same before and after the fix.
test('Property 2b: match-done detection, match-result text, and overlay fields', () => {
  fc.assert(
    fc.property(stats, stats, fc.integer({ min: 0, max: 2 }), fc.integer({ min: 0, max: 2 }), (a, b, p1Wins, p2Wins) => {
      const players = [{ alive: false, ...a }, { alive: false, ...b }];
      const { game, el, BEST_OF } = runGameOver({ mode: 'versus', players, p1Wins, p2Wins });
      const need = Math.ceil(BEST_OF / 2);
      const newP1 = game.p1Wins, newP2 = game.p2Wins;
      assert.equal(newP1 + newP2, p1Wins + p2Wins + 1);

      assert.equal(el('goScore').textContent, a.score.toLocaleString());
      assert.equal(el('goLevel').textContent, a.level);
      assert.equal(el('goLines').textContent, a.lines);
      assert.equal(el('goMatchScore').textContent, newP1 + ' - ' + newP2);

      if (newP1 >= need || newP2 >= need) {
        assert.equal(el('goMatchResult').textContent, 'Player ' + (newP1 > newP2 ? '1' : '2') + ' wins the match!');
      } else {
        assert.equal(el('goMatchResult').textContent, '');
      }
      assert.ok(el('winDisplay').innerHTML.includes('>' + newP1 + '<'));
      assert.ok(el('winDisplay').innerHTML.includes('>' + newP2 + '<'));
      assert.ok(el('gameoverOverlay').classList.contains('active'));
    })
  );
});
