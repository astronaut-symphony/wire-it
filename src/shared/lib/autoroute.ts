import { elbowPath, type Pt, type Rect } from './geometry';

const EPS = 0.5;
const CLEAR = 8; // px a wire keeps away from a component's box
const JOG = 24; // px a wire steps aside from the end of a stub when it has to turn away
const BEND = 40; // cost of a turn in px of wire: a route with fewer turns wins over a slightly shorter one
const DIRS: Pt[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
const idx = (v: Pt) => DIRS.findIndex((d) => d.x === Math.sign(v.x) && d.y === Math.sign(v.y));

const inflate = (r: Rect, m: number): Rect => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });
const inside = (p: Pt, r: Rect) => p.x > r.x + EPS && p.x < r.x + r.w - EPS && p.y > r.y + EPS && p.y < r.y + r.h - EPS;
const holds = (r: Rect, p: Pt) => p.x >= r.x - EPS && p.x <= r.x + r.w + EPS && p.y >= r.y - EPS && p.y <= r.y + r.h + EPS;

/** Does a horizontal or vertical leg a-b cut through the inside of r? (running along its edge is fine) */
function cuts(a: Pt, b: Pt, r: Rect) {
  const [x1, x2] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y1, y2] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return x2 > r.x + EPS && x1 < r.x + r.w - EPS && y2 > r.y + EPS && y1 < r.y + r.h - EPS;
}

/** Two legs in a row on one line, the second going back the way the first came: the wire doubles back on itself. */
export function doublesBack(P: Pt[]): boolean {
  const Q = P.filter((p, i) => i === 0 || Math.abs(p.x - P[i - 1].x) > EPS || Math.abs(p.y - P[i - 1].y) > EPS);
  for (let i = 0; i + 2 < Q.length; i++) {
    const [a, b, c] = [Q[i], Q[i + 1], Q[i + 2]];
    const h = Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS && (b.x - a.x) * (c.x - b.x) < 0;
    const v = Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS && (b.y - a.y) * (c.y - b.y) < 0;
    if (h || v) return true;
  }
  return false;
}

/** The boxes that matter for a wire from s to e: with clearance, and not the ones the wire starts or ends inside of. */
const obstacles = (boxes: Rect[], s: Pt, e: Pt) => boxes.map((r) => inflate(r, CLEAR)).filter((r) => !holds(r, s) && !holds(r, e));

/**
 * Cheapest right-angle route from s to e around the boxes: fewest turns first, then shortest. It never reverses,
 * so with a pin direction `sv` the first leg may go on or turn but not back, and the last leg may not be the one
 * that runs out of the pin's side (`ev`). Without a direction (junction dots, free pins) anything goes.
 * Returns the corners from s to e, or null when the boxes leave no way through.
 */
export function autoRoute(s: Pt, sv: Pt | null, e: Pt, ev: Pt | null, boxes: Rect[]): Pt[] | null {
  const obs = obstacles(boxes, s, e);
  const uniq = (v: number[]) => [...new Set(v)].sort((a, b) => a - b);
  // lines to run along: both ends, the edges of the boxes, and a step to either side of each end (room to turn aside)
  const xs = uniq([s.x, e.x, s.x - JOG, s.x + JOG, e.x - JOG, e.x + JOG, ...obs.flatMap((r) => [r.x, r.x + r.w])]);
  const ys = uniq([s.y, e.y, s.y - JOG, s.y + JOG, e.y - JOG, e.y + JOG, ...obs.flatMap((r) => [r.y, r.y + r.h])]);
  const nx = xs.length;
  const at = (n: number): Pt => ({ x: xs[n % nx], y: ys[Math.floor(n / nx)] });
  const near = (v: number, list: number[]) => list.findIndex((w) => Math.abs(w - v) < EPS);
  const start = near(s.y, ys) * nx + near(s.x, xs);
  const goal = near(e.y, ys) * nx + near(e.x, xs);
  if (start === goal) return [s, e];
  const sd = sv ? idx(sv) : 4; // 4 = no direction yet
  const into = ev ? idx(ev) : -1; // moving this way into e would turn straight back into the pin
  const out = ev ? (idx(ev) + 2) % 4 : -1; // the way the wire goes on from e (into the pin)

  const cost = new Map<number, number>([[start * 5 + sd, 0]]);
  const from = new Map<number, number>();
  const heap: [number, number][] = [[0, start * 5 + sd]]; // [cost, state]; state = node * 5 + last direction
  const push = (c: number, st: number) => {
    heap.push([c, st]);
    for (let i = heap.length - 1; i > 0 && heap[(i - 1) >> 1][0] > heap[i][0]; i = (i - 1) >> 1) [heap[i], heap[(i - 1) >> 1]] = [heap[(i - 1) >> 1], heap[i]];
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        let m = i;
        for (const c of [2 * i + 1, 2 * i + 2]) if (c < heap.length && heap[c][0] < heap[m][0]) m = c;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };

  while (heap.length) {
    const [c, st] = pop();
    if (c > (cost.get(st) ?? Infinity)) continue;
    const [n, d] = [Math.floor(st / 5), st % 5];
    if (n === goal) {
      const pts: Pt[] = [];
      for (let k: number | undefined = st; k !== undefined; k = from.get(k)) pts.unshift(at(Math.floor(k / 5)));
      return pts.filter((p, i) => i === 0 || i === pts.length - 1 || !(Math.abs(p.x - pts[i - 1].x) < EPS && Math.abs(p.x - pts[i + 1].x) < EPS) && !(Math.abs(p.y - pts[i - 1].y) < EPS && Math.abs(p.y - pts[i + 1].y) < EPS));
    }
    const [i, j] = [n % nx, Math.floor(n / nx)];
    for (let nd = 0; nd < 4; nd++) {
      if (d < 4 && nd === (d + 2) % 4) continue; // never turn straight back
      const [ni, nj] = [i + DIRS[nd].x, j + DIRS[nd].y];
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ys.length) continue;
      const next = nj * nx + ni;
      const [a, b] = [at(n), at(next)];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (obs.some((r) => inside(b, r) || inside(mid, r))) continue;
      if (next === goal && nd === into) continue;
      let nc = c + Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + (d < 4 && nd !== d ? BEND : 0);
      if (next === goal && ev && nd !== out) nc += BEND; // the turn into the pin's stub
      const ns = next * 5 + nd;
      if (nc < (cost.get(ns) ?? Infinity)) {
        cost.set(ns, nc);
        from.set(ns, st);
        push(nc, ns);
      }
    }
  }
  return null;
}

/**
 * The route a brand-new wire takes (no bend points yet). The plain elbow is kept when it is fine: it does not
 * double back through the pins (S, T are the pins, s, e the ends of their stubs) and stays clear of every box.
 * Otherwise the wire is routed around them, and if that is impossible the elbow stays.
 * `pinS` / `pinE`: that end is a real pin with a fixed direction (not a junction dot or a free pin).
 */
export function defaultRoute(S: Pt, s: Pt, sv: Pt, pinS: boolean, e: Pt, ev: Pt, pinE: boolean, T: Pt, boxes: Rect[]): Pt[] {
  const elbow = elbowPath(s, sv, [], e, ev).map((v) => v.p);
  const obs = obstacles(boxes, s, e);
  const clear = elbow.every((p, i) => i === 0 || !obs.some((r) => cuts(elbow[i - 1], p, r)));
  if (clear && !doublesBack([S, ...elbow, T])) return elbow;
  return autoRoute(s, pinS ? sv : null, e, pinE ? ev : null, boxes) ?? elbow;
}
