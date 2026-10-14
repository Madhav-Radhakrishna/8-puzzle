# AI 8-Puzzle Solver — Multiple Search Strategies

A browser-only application that solves the 3 x 3 sliding (8-) puzzle with six search strategies:
BFS, DFS (depth-limited), UCS, IDDFS, Greedy Best-First Search and A* (Manhattan or misplaced-tiles heuristic).
The page animates the real order of node expansion and then slides the tiles along the solution.

## Run
Open `index.html` in a current browser (Chrome, Edge or Firefox). No installation, server or internet connection is needed.

## Verify the algorithms from the command line (optional, Node.js 18+)
    node tests/run-tests.js

## Files
- `index.html` — complete application (HTML, CSS, JavaScript; algorithms inlined)
- `src/algorithms.js` — the search algorithms, heuristics, validation and built-in puzzles (same code as inlined in `index.html`)
- `tests/run-tests.js` — checks path validity, optimality, heuristic ordering and no-solution handling
