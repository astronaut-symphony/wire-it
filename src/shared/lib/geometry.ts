import { Position } from '@xyflow/react';
import { MM, type Component, type Dir, type Pin } from '@/shared/types';

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
/** Wire vertex; wp = index into the user's waypoints, or -1 for generated ones. */
export type V = { p: Pt; wp: number };

export const STUB = 12; // px a wire runs straight out of a pin
const EPS = 0.5;

export const DIR_POS: Record<Dir, Position> = {
  up: Position.Top,
  down: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};
export const POS_VEC: Record<Position, Pt> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
};

export function autoDir(x: number, y: number, w: number, h: number): Dir {
  const d: [Dir, number][] = [['left', x * w], ['right', (1 - x) * w], ['up', y * h], ['down', (1 - y) * h]];
  return d.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}

export const pinDir = (p: Pin, c: Component): Dir => p.dir ?? autoDir(p.x, p.y, c.w, c.h);

// rotation is clockwise degrees (0/90/180/270) of the whole component
const ORDER: Dir[] = ['up', 'right', 'down', 'left'];
export const rotDir = (d: Dir, rot: number): Dir => ORDER[(ORDER.indexOf(d) + rot / 90) % 4];
/** A 0..1 point inside the component box after rotating the box. */
export const rotPt = (x: number, y: number, rot: number): [number, number] =>
  rot === 90 ? [1 - y, x] : rot === 180 ? [1 - x, 1 - y] : rot === 270 ? [y, 1 - x] : [x, y];
/** Node position that puts the component's `pin` (offset from its top-left) on the `grid` lattice. */
export const snapByPin = (pos: Pt, pin: Pt, grid: number): Pt => ({
  x: Math.round((pos.x + pin.x) / grid) * grid - pin.x,
  y: Math.round((pos.y + pin.y) / grid) * grid - pin.y,
});

/** Canvas size of a component, swapped for quarter turns. */
export function compSize(c: Component, rot = 0) {
  const w = c.mmW * MM;
  const h = (w * c.h) / c.w;
  return rot % 180 ? { w: h, h: w } : { w, h };
}

const same = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;

/**
 * Orthogonal wire from s (end of source stub) to e (end of target stub) through waypoints.
 * Corners are generated between waypoints so every leg is horizontal or vertical.
 */
export function elbowPath(s: Pt, sVec: Pt, wps: Pt[], e: Pt, eVec: Pt): V[] {
  const out: V[] = [{ p: s, wp: -1 }];
  const targets: V[] = [...wps.map((p, i) => ({ p, wp: i })), { p: e, wp: -1 }];
  let axis: 'h' | 'v' = sVec.x ? 'h' : 'v'; // axis of the last leg
  let cur = s;
  targets.forEach((t, k) => {
    const a = cur;
    const b = t.p;
    const alignedX = Math.abs(a.x - b.x) < EPS;
    const alignedY = Math.abs(a.y - b.y) < EPS;
    if (!alignedX && !alignedY) {
      let corner: Pt;
      if (k === targets.length - 1) {
        corner = eVec.x ? { x: a.x, y: b.y } : { x: b.x, y: a.y }; // arrive along the target stub
      } else if (k === 0) {
        const ahead = (b.x - a.x) * sVec.x + (b.y - a.y) * sVec.y > 0;
        const first = ahead ? axis : axis === 'h' ? 'v' : 'h'; // never double back through the pin
        corner = first === 'h' ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
      } else {
        corner = axis === 'h' ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
      }
      out.push({ p: corner, wp: -1 });
      axis = Math.abs(corner.x - b.x) < EPS ? 'v' : 'h';
    } else if (!(alignedX && alignedY)) {
      axis = alignedX ? 'v' : 'h';
    }
    const last = out[out.length - 1];
    if (same(last.p, b)) {
      if (t.wp >= 0 && last.wp < 0 && out.length > 1) last.wp = t.wp;
    } else out.push(t);
    cur = b;
  });
  return out;
}

export type Run = { a: number; b: number; o: 'h' | 'v' };

/** Drops repeated points so every leg has a direction; first and last stay exact (they are pins). */
export function dedupe(P: Pt[]): Pt[] {
  const out = [P[0]];
  for (let i = 1; i < P.length; i++) if (!same(P[i], out[out.length - 1])) out.push(P[i]);
  out[out.length - 1] = P[P.length - 1];
  return out;
}

/**
 * dedupe + removes spurs: a point where the wire runs out along a line and straight back again
 * (happens when a dragged run lines up with its neighbour and a corner ends up "behind" it).
 */
export function tidy(P: Pt[]): Pt[] {
  const out = dedupe(P);
  for (let i = 1; i < out.length - 1; ) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    const h = Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS;
    const v = Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS;
    if ((h && (b.x - a.x) * (c.x - b.x) < 0) || (v && (b.y - a.y) * (c.y - b.y) < 0)) {
      out.splice(i, 1);
      i = Math.max(1, i - 1);
    } else i++;
  }
  return dedupe(out);
}

/** SVG path through P with each corner rounded by up to r (less on short legs). Display only. */
export function roundedPath(P: Pt[], r: number): string {
  let d = `M${P[0].x},${P[0].y}`;
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1];
    const b = P[i];
    const c = P[i + 1];
    const l1 = Math.hypot(a.x - b.x, a.y - b.y);
    const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const k = Math.min(r, l1 / 2, l2 / 2);
    if (k < 0.5) d += ` L${b.x},${b.y}`;
    else {
      const f = (q: Pt, l: number) => `${b.x + ((q.x - b.x) / l) * k},${b.y + ((q.y - b.y) / l) * k}`;
      d += ` L${f(a, l1)} Q${b.x},${b.y} ${f(c, l2)}`;
    }
  }
  const z = P[P.length - 1];
  return `${d} L${z.x},${z.y}`;
}

/** Maximal straight stretches of an orthogonal chain: points a..b all lie on one horizontal/vertical line. */
export function runs(P: Pt[]): Run[] {
  const out: Run[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const o = Math.abs(P[i].y - P[i + 1].y) < EPS ? 'h' : 'v';
    const last = out[out.length - 1];
    if (last && last.o === o) last.b = i + 1;
    else out.push({ a: i, b: i + 1, o });
  }
  return out;
}

/**
 * Slides a straight run sideways to coordinate v (y for horizontal, x for vertical); its neighbours
 * stretch to follow, so the chain stays orthogonal. A run touching a pin (first/last point) can't
 * move it, so a jog is added there: the wire turns right at the pin's stub end instead.
 * jog.start/end = false: that end is a junction dot that moves with the run, so no jog.
 */
export function moveRun(P: Pt[], { a, b, o }: Run, v: number, jog = { start: true, end: true }): Pt[] {
  const k = o === 'h' ? 'y' : 'x';
  const out: Pt[] = [];
  P.forEach((p, i) => {
    if (i < a || i > b) out.push(p);
    else if (i === 0) out.push(...(jog.start ? [p, { ...p, [k]: v }] : [{ ...p, [k]: v }]));
    else if (i === P.length - 1) out.push(...(jog.end ? [{ ...p, [k]: v }, p] : [{ ...p, [k]: v }]));
    else out.push({ ...p, [k]: v });
  });
  return out;
}
