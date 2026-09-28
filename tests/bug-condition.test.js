'use strict';
// Property 1: Bug Condition - Survivor Is Declared Winner
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**
const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { runGameOver } = require('./harness');

// isBugCondition: versus mode with at least one player topped out.
const bugState = fc
  .record({ p0Alive: fc.boolean(), p1Alive: fc.boolean() })
  .filter(s => !s.p0Alive || !s.p1Alive);

// Keep prior wins below the match threshold so a round can still be played.
const priorWins = fc.integer({ min: 0, max: 2 });

test('Property 1: survivor is declared winner and correct counter increments', () => {
  fc.assert(
    fc.property(bugState, priorWins, priorWins, ({ p0Alive, p1Alive }, p1Wins, p2Wins) => {
      const { game, el } = runGameOver({ mode: 'versus', p0Alive, p1Alive, p1Wins, p2Wins });
      // Survivor wins; both dead -> tie rule: player 1 (index 0).
      const expected = p0Alive ? 0 : (p1Alive ? 1 : 0);

      assert.equal(el('goTitle').textContent, 'PLAYER ' + (expected + 1) + ' WINS!');
      assert.equal(el('goWinner').textContent, 'Player ' + (expected + 1));
      assert.equal(el('goWinner').className, expected === 0 ? 'p1-color' : 'p2-color');
      assert.equal(game.p1Wins, p1Wins + (expected === 0 ? 1 : 0));
      assert.equal(game.p2Wins, p2Wins + (expected === 1 ? 1 : 0));
    }),
    { numRuns: 100 }
  );
});
