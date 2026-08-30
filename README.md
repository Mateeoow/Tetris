<div align="center">

  # STACK

  **A polished browser falling-block game with solo and local two-player competition.**

  ![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?logo=javascript&logoColor=000)
  ![HTML5](https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5&logoColor=white)
  ![CSS3](https://img.shields.io/badge/CSS3-Responsive-1572B6?logo=css3&logoColor=white)
</div>

## Overview

STACK is a dependency-free JavaScript recreation of the classic falling-block format. It includes a complete solo loop and a best-of-five local versus mode rendered with the HTML Canvas API.

## Features

- Standard 10 × 20 visible playfield.
- Seven-piece bag randomizer.
- Ghost-piece landing preview.
- Hold slot and next-piece preview.
- Soft and hard drops with score bonuses.
- Line-clear, combo, level, and speed progression systems.
- High score saved in `localStorage`.
- Solo controls selectable between WASD and arrow keys.
- Local two-player versus mode on one keyboard.
- Garbage attacks for multi-line clears, including pending-garbage cancellation.
- Best-of-five match scoring.
- Pause, restart, rematch, and main-menu flows.
- Light/dark theme preference and responsive layouts.

## Controls

### Solo

| Action | WASD layout | Arrow layout |
| --- | --- | --- |
| Move | `A` / `D` | `←` / `→` |
| Soft drop | `S` | `↓` |
| Rotate clockwise | `W` | `↑` |
| Hard drop | `Space` or `Enter` | `Space` or `Enter` |
| Hold | `C` | `C` |
| Pause | `Esc` or `P` | `Esc` or `P` |

### Versus

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | `A` / `D` | `←` / `→` |
| Soft drop | `S` | `↓` |
| Rotate | `W` | `↑` |
| Hard drop | `Space` | `Enter` |
| Hold | `C` | `Num 0` |

## Run locally

No build step or package installation is required.

```bash
git clone https://github.com/Mateeoow/Tetris.git
cd Tetris
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). You can also open `index.html` directly in a modern browser.

## Project structure

```text
index.html   Menus, game HUDs, dialogs, and canvas elements
styles.css   Themes, layout, responsive behavior, and animation
app.js       Board, pieces, input, scoring, rendering, and match logic
```

## Implementation notes

- `Board` manages occupied cells, line clearing, and garbage rows.
- `Bag` provides shuffled seven-piece distribution.
- `Player` owns a board, active piece, score, level, hold state, and pending attacks.
- `Input` handles edge presses and repeated movement.
- `Renderer` draws boards, active pieces, ghost pieces, and previews.
- `Game` coordinates menus, players, matches, timing, and the animation loop.

## Author

Built by [Martin Gayem](https://github.com/Mateeoow) as a JavaScript game-development project.
