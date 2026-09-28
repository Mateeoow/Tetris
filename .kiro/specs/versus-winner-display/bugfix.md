# Bugfix Requirements Document

## Introduction

In 2-player (versus) mode, the game-over screen announces the wrong winner. The player who actually survived (did not top out) is reported as the loser, and the player who topped out is displayed as the winner. As a consequence, the announced winner label, the winning-player title, and the incremented win counter all reflect the opposite player, which corrupts the running match score across a best-of-5 series.

The defect originates in `Game._gameOver()`, which infers the loser solely from `this.players[0].alive`. When player 1 (index 0) tops out, `players[0].alive` is `false`, so the loser is computed as player 2 and player 1 is declared the winner — the inverse of the true outcome. The surviving player should always be declared and displayed as the winner, and their win counter should be incremented. The fix must also define behavior for the edge case where both players top out on the same frame.

## Bug Analysis

### Current Behavior (Defect)

The winner/loser derivation is inverted, so the dead player is treated as the winner.

1.1 WHEN player 1 (index 0) tops out and player 2 (index 1) is still alive THEN the system declares player 2 the loser and player 1 the winner, incrementing player 1's win counter and displaying "PLAYER 1 WINS!"
1.2 WHEN player 2 (index 1) tops out and player 1 (index 0) is still alive THEN the system declares player 1 the loser and player 2 the winner, incrementing player 2's win counter and displaying "PLAYER 2 WINS!"
1.3 WHEN a player tops out THEN the winner label (`goWinner`), the win counter (`p1Wins`/`p2Wins`), the win display, and the match result text all reflect the player who topped out rather than the survivor
1.4 WHEN both players top out on the same frame THEN the system derives the winner from `players[0].alive` alone, producing an arbitrary and undefined outcome for the tie

### Expected Behavior (Correct)

The surviving player is always the winner.

2.1 WHEN player 1 (index 0) tops out and player 2 (index 1) is still alive THEN the system SHALL declare player 2 the winner, increment player 2's win counter, and display "PLAYER 2 WINS!"
2.2 WHEN player 2 (index 1) tops out and player 1 (index 0) is still alive THEN the system SHALL declare player 1 the winner, increment player 1's win counter, and display "PLAYER 1 WINS!"
2.3 WHEN a player tops out THEN the winner label (`goWinner`), the winning-player color class, the incremented win counter, the win display, and the match result text SHALL all reflect the surviving player
2.4 WHEN both players top out on the same frame THEN the system SHALL resolve the outcome deterministically (as a defined tie rule) rather than producing an arbitrary winner

### Unchanged Behavior (Regression Prevention)

Behavior for non-defective paths must be preserved.

3.1 WHEN the game is in solo mode and the player tops out THEN the system SHALL CONTINUE TO display "GAME OVER" with the player's score, level, and lines, and SHALL NOT modify the versus win counters
3.2 WHEN a versus game ends and a player has reached ceil(BEST_OF / 2) = 3 wins THEN the system SHALL CONTINUE TO mark the match done and display the correct match-winning player
3.3 WHEN a versus game ends without a player reaching 3 wins THEN the system SHALL CONTINUE TO leave the match result text empty and continue the series
3.4 WHEN the game-over overlay is shown THEN the system SHALL CONTINUE TO display the score, level, and lines fields and the running match score (`p1Wins - p2Wins`)

## Bug Condition and Property

### Key Definitions

- **F**: The original (unfixed) `_gameOver()` function.
- **F'**: The fixed `_gameOver()` function.
- **Input X**: The alive-state of both players at game over, represented as `X = {p0Alive, p1Alive}` where `p0Alive = players[0].alive` and `p1Alive = players[1].alive`, evaluated in versus mode.

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X = {p0Alive, p1Alive} in versus mode
  OUTPUT: boolean

  // The bug manifests whenever the game ends in versus mode with at least
  // one player topped out. The derived winner may be inverted or undefined.
  RETURN (NOT X.p0Alive) OR (NOT X.p1Alive)
END FUNCTION
```

### Property Specification (Fix Checking)

```pascal
// Property: Fix Checking - The survivor is the winner
FOR ALL X WHERE isBugCondition(X) DO
  result ← gameOver'(X)
  IF X.p0Alive AND (NOT X.p1Alive) THEN
    ASSERT result.winner = 0        // player 1 survives -> player 1 wins
  ELSE IF X.p1Alive AND (NOT X.p0Alive) THEN
    ASSERT result.winner = 1        // player 2 survives -> player 2 wins
  ELSE
    ASSERT result.winner IS DEFINED // both topped out -> deterministic tie rule
  END IF
END FOR
```

### Preservation Goal (Preservation Checking)

```pascal
// Property: Preservation Checking - Non-buggy paths unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

For all inputs that do not trigger the bug (solo mode, and any state where the
versus winner derivation is not exercised), the fixed function behaves
identically to the original.

### Counterexample

`_gameOver()` invoked in versus mode with `players[0].alive = false` and
`players[1].alive = true` (player 1 topped out, player 2 survived) currently
declares player 1 the winner and increments `p1Wins`, when player 2 should win.
