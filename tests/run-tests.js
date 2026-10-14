// Command-line verification of the search algorithms (Node.js >= 18).  Run:  node tests/run-tests.js
const A = require("../src/algorithms.js");
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name); } }
function validPath(r, start) {
  if (!r.found) return false;
  if (r.path[0] !== start || r.path[r.path.length - 1] !== A.GOAL) return false;
  for (let i = 0; i < r.path.length - 1; i++)
    if (!A.neighbors(r.path[i]).some(x => x.s === r.path[i + 1])) return false;
  return r.moves.length === r.path.length - 1;
}
const optimal = { easy: 4, medium: 12, hard: 20, expert: 26, worst: 31, solved: 0 };
for (const p of A.PUZZLES) {
  console.log("\n" + p.name + "  (" + p.state + ")");
  if (p.id === "nosol") {
    check("parity test reports unsolvable", !A.isSolvable(p.state));
    for (const k of ["bfs", "ucs", "greedy", "astar"]) {
      const r = A.ALGORITHMS[k].fn(p.state, { heuristic: "manhattan" });
      check(k + " ends with NO SOLUTION after expanding all 181440 states", !r.found && r.status === "NO SOLUTION" && r.nodesExpanded === 181440);
    }
    continue;
  }
  check("parity test reports solvable", A.isSolvable(p.state));
  const opt = optimal[p.id];
  const rb = A.bfs(p.state), ru = A.ucs(p.state), ra = A.astar(p.state, { heuristic: "manhattan" }), rm = A.astar(p.state, { heuristic: "misplaced" });
  check("BFS path valid and optimal (" + opt + ")", validPath(rb, p.state) && rb.pathLength === opt);
  check("UCS path valid and optimal", validPath(ru, p.state) && ru.pathLength === opt);
  check("A* Manhattan path valid and optimal", validPath(ra, p.state) && ra.pathLength === opt);
  check("A* Misplaced path valid and optimal", validPath(rm, p.state) && rm.pathLength === opt);
  check("A* Manhattan expands <= A* Misplaced <= BFS", ra.nodesExpanded <= rm.nodesExpanded && rm.nodesExpanded <= rb.nodesExpanded);
  const rg = A.greedy(p.state, { heuristic: "manhattan" });
  check("Greedy path valid and not shorter than optimal", validPath(rg, p.state) && rg.pathLength >= opt);
  const rd = A.dfs(p.state, { depthLimit: 50 });
  check("DFS (limit 50) path valid", validPath(rd, p.state));
  if (p.id !== "expert" && p.id !== "worst") { const ri = A.iddfs(p.state); check("IDDFS path valid and optimal", validPath(ri, p.state) && ri.pathLength === opt); }
}
console.log("\nHeuristic checks");
check("Manhattan of goal is 0", A.manhattan(A.GOAL) === 0);
check("Misplaced of goal is 0", A.misplaced(A.GOAL) === 0);
check("invalid state is rejected", A.validate("112345678").length > 0 && A.validate("12345678").length > 0);
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
