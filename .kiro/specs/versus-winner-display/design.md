# Versus Winner Display Bugfix Design

## Overview

In 2-player (versus) mode, the game-over screen announces the wrong winner. The defect lives in `Game._gameOver()` in `app.js`, which derives the loser with an inverted expression:

```js
const loser = this.players[0].alive ? 0 : 1;
const winner = 1 - loser;
```

When player 1 (index 0) survives, `players[0].alive` is `true`, so `loser` is set to `0` (player 1) — the survivor is marked the loser. The winner label, win-counter increment, win display, and match-result text all then reflect the player who topped out instead of the survivor, corrupting the running best-of-5 score.

The fix strategy is minimal and targeted: correct the winner/loser derivation so the **surviving** player is always the winner, and define a deterministic tie rule for the edge case where both players top out on the same frame. All non-versus paths (solo mode) and all downstream match-scoring logic remain untouched.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — the game ends in versus mode with at least one player topped out, so the winner derivation is exercised (and currently inverted).
- **Property (P)**: The desired behavior — the surviving player is declared the winner, their win counter is incremented, and all game-over UI reflects the survivor. When both players top out, the outcome is resolved by a deterministic tie rule.
- **Preservation**: Existing behavior that must remain unchanged — solo-mode game-over display, match-done detection, match-result text, and the score/level/lines/match-score fields on the overlay.
- **`_gameOver()`**: The method in `app.js` (~line 506) that populates and shows the game-over overlay. In versus mode it derives the winner, increments the win counter, updates the win display, and detects match completion.
- **`players[i].alive`**: Boolean state per player. Becomes `false` when the player tops out (a new piece cannot spawn or the board is blocked). Index `0` is player 1, index `1` is player 2.
- **`p1Wins` / `p2Wins`**: Running win counters for the best-of-`BEST_OF` (5) series.
- **Top out**: A player loses when a piece can no longer spawn; the game loop (`_gameOver()` at ~line 604) triggers game over as soon as any player is not alive.

## Bug Details

### Bug Condition

The bug manifests whenever `_gameOver()` runs in versus mode with at least one player topped out. The winner/loser derivation is inverted: the surviving player (`alive === true`) is treated as the loser, and the topped-out player is declared the winner. In the tie case (both topped out on the same frame), the winner is derived from `players[0].alive` alone, producing an arbitrary, undefined outcome.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X = {mode, p0Alive, p1Alive}
  OUTPUT: boolean

  // The winner derivation is only exercised in versus mode when the game
  // ends, i.e. when at least one player has topped out.
  RETURN X.mode = 'versus'
         AND ((NOT X.p0Alive) OR (NOT X.p1Alive))
END FUNCTION
```

### Examples

- **Player 1 tops out, player 2 survives** (`p0Alive = false`, `p1Alive = true`): Expected "PLAYER 2 WINS!" and `p2Wins++`. Actual: declares player 1 winner, `p1Wins++`, "PLAYER 1 WINS!".
- **Player 2 tops out, player 1 survives** (`p0Alive = true`, `p1Alive = false`): Expected "PLAYER 1 WINS!" and `p1Wins++`. Actual: declares player 2 winner, `p2Wins++`, "PLAYER 2 WINS!".
- **Both top out on the same frame** (`p0Alive = false`, `p1Alive = false`): Expected a deterministic, defined outcome. Actual: `loser = players[0].alive ? 0 : 1` evaluates to `1` (player 2 loser), so player 1 is arbitrarily declared winner with no defined tie rule.
- **Solo mode, player tops out** (`mode = 'solo'`): Not a bug condition — must continue to show "GAME OVER" with score/level/lines and leave win counters untouched.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Solo-mode game over must continue to display "GAME OVER" with the player's score, level, and lines, and must not modify the versus win counters (Requirement 3.1).
- Match-done detection — a player reaching `ceil(BEST_OF / 2) = 3` wins marks the match done and displays the correct match-winning player (Requirement 3.2).
- When no player has reached 3 wins, the match result text stays empty and the series continues (Requirement 3.3).
- The game-over overlay continues to display score, level, and lines fields and the running match score `p1Wins - p2Wins` (Requirement 3.4).

**Scope:**
All inputs that do NOT trigger the bug condition should be completely unaffected by this fix. This includes:
- Solo mode game over (`mode = 'solo'`).
- Any code path that does not exercise the versus winner derivation.
- All downstream match-scoring, win-display rendering, and overlay-field population, which continue to operate on the (now correctly derived) winner.

**Note:** The expected correct behavior for buggy inputs is defined in the Correctness Properties section (Property 1). This section focuses on what must NOT change.

## Hypothesized Root Cause

Based on the bug description and confirmed inspection of `app.js`, the root cause is:

1. **Inverted loser derivation (confirmed)**: Line ~520 reads `const loser = this.players[0].alive ? 0 : 1;`. This assigns the loser to be player 1 when player 1 is *alive*, which is backwards. It should assign the loser to be the player who is *not* alive. Because `winner = 1 - loser`, the winner is consequently the topped-out player.
   - `winner` then drives `goTitle`, `goWinner` text and color class, and the `p1Wins`/`p2Wins` increment — so a single inverted expression propagates to every winner-dependent output.

2. **Undefined tie handling**: The single-boolean derivation (`players[0].alive ? 0 : 1`) collapses the both-dead case into "player 1 wins" implicitly, with no explicit, documented tie rule. Requirement 2.4 requires a deterministic resolution.

3. **Not a rendering or DOM issue**: The overlay elements (`goTitle`, `goWinner`, `winDisplay`, etc.) are populated correctly given a `winner` value; the defect is purely in the value of `winner`, not in how it is displayed.

## Correctness Properties

Property 1: Bug Condition - Survivor Is Declared Winner

_For any_ input where the bug condition holds (versus mode with at least one player topped out), the fixed `_gameOver()` SHALL declare the surviving player the winner, increment that player's win counter, and set the winner label, color class, title, win display, and match-result text to reflect the survivor. Specifically: if only player 1 survives, `winner = 0`; if only player 2 survives, `winner = 1`; if both players topped out on the same frame, `winner` SHALL be resolved deterministically by the defined tie rule (player 1, index 0) and MUST be a defined value.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-Buggy Paths Unchanged

_For any_ input where the bug condition does NOT hold (solo mode, or any state that does not exercise the versus winner derivation), the fixed `_gameOver()` SHALL produce the same result as the original function, preserving solo-mode display, match-done detection, match-result text, and the score/level/lines/match-score overlay fields.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct, the change is confined to the versus branch of `_gameOver()`.

**File**: `app.js`

**Function**: `Game._gameOver()`

**Specific Changes**:
1. **Correct the winner derivation**: Replace the inverted loser expression with a survivor-based winner derivation.
   - Current: `const loser = this.players[0].alive ? 0 : 1; const winner = 1 - loser;`
   - Fixed: derive the winner as the player who is still alive. If player 1 (index 0) is alive, `winner = 0`; otherwise `winner = 1`.

2. **Add a deterministic tie rule**: When neither player is alive (both topped out on the same frame), resolve deterministically to player 1 (index 0) as the winner. This is a documented, defined rule that removes the arbitrary/undefined outcome. Example derivation:
   - `const winner = this.players[0].alive ? 0 : (this.players[1].alive ? 1 : 0);`
   - This yields: only P1 alive → 0; only P2 alive → 1; both dead → 0 (tie goes to player 1).

3. **Leave downstream logic untouched**: The `winner` value continues to feed the existing `p1Wins`/`p2Wins` increment, `_updateWinDisplay()`, `matchDone` computation, `goTitle`/`goWinner`/color-class assignment, and match-result text — all unchanged.

4. **Leave the solo branch untouched**: The `if (this.mode === 'solo')` branch is not modified, preserving solo-mode behavior.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on the unfixed code, then verify the fix works correctly and preserves existing behavior. Because `_gameOver()` reads instance state (`this.players`, `this.mode`, `this.p1Wins`, `this.p2Wins`) and writes to DOM elements, tests set up a minimal `Game`-like context and assert on the winner-dependent outputs (`p1Wins`/`p2Wins` deltas, `goTitle`, `goWinner` text/class).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis (inverted derivation). If refuted, re-hypothesize.

**Test Plan**: Invoke `_gameOver()` in versus mode with controlled `players[].alive` states and assert which player is declared the winner and which win counter increments. Run against the UNFIXED code to observe the inversion.

**Test Cases**:
1. **Player 1 tops out, P2 survives**: `p0Alive = false, p1Alive = true` — expect winner = P2 (will fail on unfixed code; unfixed declares P1).
2. **Player 2 tops out, P1 survives**: `p0Alive = true, p1Alive = false` — expect winner = P1 (will fail on unfixed code; unfixed declares P2).
3. **Win-counter correctness**: Assert `p2Wins` increments in case 1 and `p1Wins` in case 2 (will fail on unfixed code).
4. **Both top out (tie)**: `p0Alive = false, p1Alive = false` — assert a defined winner (may be arbitrary/undefined on unfixed code).

**Expected Counterexamples**:
- The topped-out player is declared the winner and the wrong counter increments.
- Root cause: inverted `loser` derivation at `_gameOver()` line ~520.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior (survivor wins, correct counter increments, deterministic tie).

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := gameOver_fixed(X)
  IF X.p0Alive AND (NOT X.p1Alive) THEN
    ASSERT result.winner = 0
  ELSE IF X.p1Alive AND (NOT X.p0Alive) THEN
    ASSERT result.winner = 1
  ELSE
    ASSERT result.winner = 0        // deterministic tie rule: player 1
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT gameOver_original(X) = gameOver_fixed(X)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (modes, scores, win counts).
- It catches edge cases that manual unit tests might miss.
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on UNFIXED code first for solo mode and match-scoring paths, then write property-based tests capturing that behavior and re-run against the fixed code.

**Test Cases**:
1. **Solo-mode preservation**: Observe that solo game over shows "GAME OVER" with score/level/lines and does not touch win counters on unfixed code; verify unchanged after fix.
2. **Match-done preservation**: Observe that reaching 3 wins marks the match done with the correct match-winning player on unfixed code; verify unchanged after fix.
3. **Series-continues preservation**: Observe that below 3 wins leaves match-result text empty; verify unchanged after fix.
4. **Overlay-fields preservation**: Observe that score/level/lines and `p1Wins - p2Wins` match score render correctly; verify unchanged after fix.

### Unit Tests

- Versus winner derivation for each single-survivor case (P1 survives, P2 survives).
- Correct win-counter increment per survivor.
- Deterministic tie resolution when both players top out.
- Solo-mode game over shows "GAME OVER" and leaves win counters unchanged.

### Property-Based Tests

- Generate random `{p0Alive, p1Alive}` versus states with at least one dead player and assert the survivor (or tie-rule player) is the winner and the correct counter increments.
- Generate random pre-existing `p1Wins`/`p2Wins` values and assert only the winner's counter increments by exactly one.
- Generate random non-buggy inputs (solo mode) and assert output equivalence with the original function.

### Integration Tests

- Full versus round flow: play until one player tops out and confirm the correct winner is announced and scored.
- Best-of-5 series flow: confirm the running match score reflects real survivors across multiple rounds and that match completion is announced for the correct player.
- Visual feedback: confirm `goWinner` color class and title correspond to the surviving player.
