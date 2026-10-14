// ===== 8-Puzzle search algorithms (pure functions, no UI) =====
const GOAL = "123456780";
const ROWS = 3, COLS = 3;
const MAX_EXPANSIONS = 2000000;   // safety budget for DFS and IDDFS (keeps the browser responsive)

// ---- successor function (memoised; order of actions is fixed: Up, Right, Down, Left) ----
const NB_CACHE = new Map();
function neighbors(s) {
  let r = NB_CACHE.get(s);
  if (r) return r;
  const z = s.indexOf("0"), row = (z / 3) | 0, col = z % 3;
  r = [];
  const mk = (j, move) => {
    const a = s.split("");
    a[z] = a[j]; a[j] = "0";
    r.push({ s: a.join(""), move });
  };
  if (row > 0) mk(z - 3, "Up");
  if (col < 2) mk(z + 1, "Right");
  if (row < 2) mk(z + 3, "Down");
  if (col > 0) mk(z - 1, "Left");
  NB_CACHE.set(s, r);
  return r;
}

// ---- heuristics ----
function misplaced(s) {
  let n = 0;
  for (let i = 0; i < 9; i++) if (s[i] !== "0" && s[i] !== GOAL[i]) n++;
  return n;
}
function tileManhattan(s, i) {
  const t = +s[i];
  if (t === 0) return 0;
  const g = t - 1;
  return Math.abs(((i / 3) | 0) - ((g / 3) | 0)) + Math.abs((i % 3) - (g % 3));
}
function manhattan(s) {
  let n = 0;
  for (let i = 0; i < 9; i++) n += tileManhattan(s, i);
  return n;
}
const HEURISTICS = { manhattan, misplaced };

// ---- validity and solvability ----
function validate(s) {
  const e = [];
  if (typeof s !== "string" || s.length !== 9) { e.push("State must contain exactly 9 cells."); return e; }
  const seen = new Set(s.split(""));
  if (seen.size !== 9 || [...seen].some(ch => ch < "0" || ch > "8"))
    e.push("State must contain each of the digits 0 to 8 exactly once.");
  return e;
}
function inversions(s) {
  const a = s.split("").filter(c => c !== "0").map(Number);
  let inv = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) inv++;
  return inv;
}
function isSolvable(s) { return inversions(s) % 2 === 0; }

// ---- binary min-heap (ties broken by insertion order, so results are deterministic) ----
class Heap {
  constructor() { this.a = []; this.c = 0; }
  get size() { return this.a.length; }
  less(x, y) { return x.k < y.k || (x.k === y.k && x.c < y.c); }
  push(k, node) {
    const a = this.a; a.push({ k, c: this.c++, node });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        let l = 2 * i + 1, r = l + 1, m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top.node;
  }
}

// ---- common result builder ----
function newStats() {
  return { visitedOrder: [], depths: [], frontierSizes: [], generated: 1, maxFrontier: 1 };
}
function finish(id, label, goalNode, st, t0, extra) {
  const path = [], moves = [];
  if (goalNode) {
    for (let n = goalNode; n; n = n.p) { path.push(n.s); if (n.p) moves.push(n.move); }
    path.reverse(); moves.reverse();
  }
  const found = !!goalNode;
  return Object.assign({
    algorithm: id, label, found, path, moves,
    visitedOrder: st.visitedOrder, depths: st.depths, frontierSizes: st.frontierSizes,
    nodesExpanded: st.visitedOrder.length, nodesGenerated: st.generated, maxFrontier: st.maxFrontier,
    pathLength: found ? moves.length : 0, timeMs: performance.now() - t0,
    status: found ? "SOLVED" : "NO SOLUTION"
  }, extra || {});
}
function record(st, node, frontierSize) {
  st.visitedOrder.push(node.s); st.depths.push(node.d); st.frontierSizes.push(frontierSize);
}

// ---- BFS: FIFO queue ----
function bfs(start) {
  const t0 = performance.now(), st = newStats();
  const root = { s: start, p: null, d: 0, move: null };
  const seen = new Set([start]), q = [root]; let qi = 0, goal = null;
  while (qi < q.length) {
    const n = q[qi++]; record(st, n, q.length - qi + 1);
    if (n.s === GOAL) { goal = n; break; }
    for (const x of neighbors(n.s)) {
      if (seen.has(x.s)) continue;
      seen.add(x.s); q.push({ s: x.s, p: n, d: n.d + 1, move: x.move }); st.generated++;
      st.maxFrontier = Math.max(st.maxFrontier, q.length - qi);
    }
  }
  return finish("bfs", "BFS", goal, st, t0);
}

// ---- depth-limited DFS: LIFO stack (graph search, a state is re-expanded only if reached at smaller depth) ----
function dfs(start, opts) {
  const limit = (opts && opts.depthLimit) || 30;
  const t0 = performance.now(), st = newStats();
  const stack = [{ s: start, p: null, d: 0, move: null }], done = new Map();
  let goal = null, cutoff = false, budget = false;
  while (stack.length) {
    const n = stack.pop();
    if (done.has(n.s) && done.get(n.s) <= n.d) continue;
    done.set(n.s, n.d); record(st, n, stack.length + 1);
    if (n.s === GOAL) { goal = n; break; }
    if (st.visitedOrder.length >= MAX_EXPANSIONS) { budget = true; break; }
    if (n.d >= limit) { cutoff = true; continue; }
    const nb = neighbors(n.s);
    for (let i = nb.length - 1; i >= 0; i--) {          // reversed, so that Up is tried first
      const x = nb[i];
      if (done.has(x.s) && done.get(x.s) <= n.d + 1) continue;
      stack.push({ s: x.s, p: n, d: n.d + 1, move: x.move }); st.generated++;
    }
    st.maxFrontier = Math.max(st.maxFrontier, stack.length);
  }
  const r = finish("dfs", "DFS", goal, st, t0, { depthLimit: limit });
  if (!goal && budget) { r.status = "NODE LIMIT REACHED"; r.limitHit = true; }
  else if (!goal && cutoff) { r.status = "NOT FOUND WITHIN DEPTH LIMIT"; r.limitHit = true; }
  return r;
}

// ---- UCS: priority queue on g(n) ----
function ucs(start) {
  const t0 = performance.now(), st = newStats(), h = new Heap();
  const root = { s: start, p: null, d: 0, g: 0, move: null };
  h.push(0, root); const best = new Map([[start, 0]]), closed = new Set(); let goal = null;
  while (h.size) {
    const n = h.pop(); if (closed.has(n.s)) continue;
    closed.add(n.s); record(st, n, h.size + 1);
    if (n.s === GOAL) { goal = n; break; }
    for (const x of neighbors(n.s)) {
      const g = n.g + 1;
      if (closed.has(x.s) || (best.has(x.s) && best.get(x.s) <= g)) continue;
      best.set(x.s, g); h.push(g, { s: x.s, p: n, d: n.d + 1, g, move: x.move }); st.generated++;
    }
    st.maxFrontier = Math.max(st.maxFrontier, h.size);
  }
  return finish("ucs", "UCS", goal, st, t0);
}

// ---- IDDFS: repeated depth-limited DFS with growing limit ----
function iddfs(start) {
  const t0 = performance.now(), st = newStats();
  let goal = null, iterations = 0, budget = false;
  for (let limit = 0; limit <= 40 && !goal && !budget; limit++) {
    iterations++;
    const stack = [{ s: start, p: null, d: 0, move: null }], done = new Map(); let cutoff = false;
    while (stack.length) {
      const n = stack.pop();
      if (done.has(n.s) && done.get(n.s) <= n.d) continue;
      done.set(n.s, n.d); record(st, n, stack.length + 1);
      if (n.s === GOAL) { goal = n; break; }
      if (st.visitedOrder.length >= MAX_EXPANSIONS) { budget = true; break; }
      if (n.d >= limit) { cutoff = true; continue; }
      const nb = neighbors(n.s);
      for (let i = nb.length - 1; i >= 0; i--) {
        const x = nb[i];
        if (done.has(x.s) && done.get(x.s) <= n.d + 1) continue;
        stack.push({ s: x.s, p: n, d: n.d + 1, move: x.move }); st.generated++;
      }
      st.maxFrontier = Math.max(st.maxFrontier, stack.length);
    }
    if (!goal && !budget && !cutoff) break;    // whole reachable space searched: no solution
  }
  const r = finish("iddfs", "IDDFS", goal, st, t0, { iterations });
  if (!goal && budget) { r.status = "NODE LIMIT REACHED"; r.limitHit = true; }
  return r;
}

// ---- Greedy best-first: priority queue on h(n) ----
function greedy(start, opts) {
  const hname = (opts && opts.heuristic) || "manhattan", H = HEURISTICS[hname];
  const t0 = performance.now(), st = newStats(), hp = new Heap();
  hp.push(H(start), { s: start, p: null, d: 0, move: null });
  const seen = new Set([start]); let goal = null;
  while (hp.size) {
    const n = hp.pop(); record(st, n, hp.size + 1);
    if (n.s === GOAL) { goal = n; break; }
    for (const x of neighbors(n.s)) {
      if (seen.has(x.s)) continue;
      seen.add(x.s); hp.push(H(x.s), { s: x.s, p: n, d: n.d + 1, move: x.move }); st.generated++;
    }
    st.maxFrontier = Math.max(st.maxFrontier, hp.size);
  }
  return finish("greedy", "Greedy", goal, st, t0, { heuristic: hname });
}

// ---- A*: priority queue on f(n) = g(n) + h(n) ----
function astar(start, opts) {
  const hname = (opts && opts.heuristic) || "manhattan", H = HEURISTICS[hname];
  const t0 = performance.now(), st = newStats(), hp = new Heap();
  hp.push(H(start), { s: start, p: null, d: 0, g: 0, move: null });
  const best = new Map([[start, 0]]), closed = new Set(); let goal = null;
  while (hp.size) {
    const n = hp.pop(); if (closed.has(n.s)) continue;
    closed.add(n.s); record(st, n, hp.size + 1);
    if (n.s === GOAL) { goal = n; break; }
    for (const x of neighbors(n.s)) {
      const g = n.g + 1;
      if (closed.has(x.s) || (best.has(x.s) && best.get(x.s) <= g)) continue;
      best.set(x.s, g); hp.push(g + H(x.s), { s: x.s, p: n, d: n.d + 1, g, move: x.move }); st.generated++;
    }
    st.maxFrontier = Math.max(st.maxFrontier, hp.size);
  }
  return finish("astar", "A*", goal, st, t0, { heuristic: hname });
}

// ---- registry ----
const ALGORITHMS = {
  bfs:    { label: "Breadth-First Search (BFS)", short: "BFS", fn: bfs, informed: false },
  dfs:    { label: "Depth-First Search (DFS)", short: "DFS", fn: dfs, informed: false },
  ucs:    { label: "Uniform Cost Search (UCS)", short: "UCS", fn: ucs, informed: false },
  iddfs:  { label: "Iterative Deepening DFS (IDDFS)", short: "IDDFS", fn: iddfs, informed: false },
  greedy: { label: "Greedy Best-First Search", short: "Greedy", fn: greedy, informed: true },
  astar:  { label: "A* Search", short: "A*", fn: astar, informed: true }
};

// ---- built-in puzzles ----
const PUZZLES = [
  { id: "easy",   name: "1 Easy",       state: "123746058" },
  { id: "medium", name: "2 Medium",     state: "530124786" },
  { id: "hard",   name: "3 Hard",       state: "265108743" },
  { id: "expert", name: "4 Expert",     state: "862753041" },
  { id: "worst",  name: "5 Worst Case", state: "867254301" },
  { id: "solved", name: "6 Already Solved", state: "123456780" },
  { id: "nosol",  name: "7 No Solution", state: "123456870" }
];

if (typeof module !== "undefined") module.exports = { MAX_EXPANSIONS, GOAL, neighbors, misplaced, manhattan, tileManhattan, validate, inversions, isSolvable, ALGORITHMS, PUZZLES, bfs, dfs, ucs, iddfs, greedy, astar, HEURISTICS };
