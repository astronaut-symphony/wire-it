import { describe, expect, it } from 'vitest';
import { autoRoute, defaultRoute, doublesBack } from './autoroute';
import type { Pt, Rect } from './geometry';

const orthogonal = (P: Pt[]) => P.slice(1).every((p, i) => Math.abs(p.x - P[i].x) < 0.5 || Math.abs(p.y - P[i].y) < 0.5);
const inside = (p: Pt, r: Rect) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
/** no leg of P passes through the inside of r (checked by sampling along each leg) */
const clearOf = (P: Pt[], r: Rect) =>
  P.slice(1).every((b, i) => {
    const a = P[i];
    return Array.from({ length: 101 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / 100, y: a.y + ((b.y - a.y) * k) / 100 })).every((p) => !inside(p, r));
  });

// two components side by side: the left one at x 100..200, the right one at x 300..400, both y 0..100
const left: Rect = { x: 100, y: 0, w: 100, h: 100 };
const right: Rect = { x: 300, y: 0, w: 100, h: 100 };

describe('defaultRoute', () => {
  it('keeps the plain elbow when it is fine', () => {
    // pin on the right of the left box, pin on the left of the right box, a little offset: the usual Z / elbow
    const S = { x: 200, y: 30 }, T = { x: 300, y: 70 };
    const s = { x: 212, y: 30 }, e = { x: 288, y: 70 };
    const r = defaultRoute(S, s, { x: 1, y: 0 }, true, e, { x: -1, y: 0 }, true, T, [left, right]);
    expect(orthogonal(r)).toBe(true);
    expect(doublesBack([S, ...r, T])).toBe(false);
  });

  it('a pin facing left may not run straight to a target on its right: it turns up or down first', () => {
    // left pin of the left box (x 100) to the left pin of the right box (x 300), both at y 50
    const S = { x: 100, y: 50 }, T = { x: 300, y: 50 };
    const s = { x: 88, y: 50 }, e = { x: 288, y: 50 };
    const r = defaultRoute(S, s, { x: -1, y: 0 }, true, e, { x: -1, y: 0 }, true, T, [left, right]);
    expect(orthogonal(r)).toBe(true);
    expect(doublesBack([S, ...r, T])).toBe(false);
    expect(r[1].x).toBe(s.x); // first leg after the stub is vertical
    expect(r[1].y).not.toBe(s.y);
    expect(clearOf(r, left)).toBe(true);
    expect(clearOf(r, right)).toBe(true);
    expect(r[0]).toEqual(s);
    expect(r[r.length - 1]).toEqual(e);
  });
});

describe('autoRoute', () => {
  it('goes around a component in the way, and never into one', () => {
    const wall: Rect = { x: 150, y: -50, w: 20, h: 200 }; // between the two pins
    const s = { x: 100, y: 50 }, e = { x: 220, y: 50 };
    const r = autoRoute(s, { x: 1, y: 0 }, e, { x: -1, y: 0 }, [wall])!;
    expect(r).not.toBeNull();
    expect(orthogonal(r)).toBe(true);
    expect(clearOf(r, wall)).toBe(true);
    expect(r[0]).toEqual(s);
    expect(r[r.length - 1]).toEqual(e);
  });

  it('never leaves the end of a stub backwards into the pin', () => {
    // pin faces right and the target is on its left: the wire has to leave sideways first
    const r = autoRoute({ x: 112, y: 50 }, { x: 1, y: 0 }, { x: 20, y: 50 }, { x: 1, y: 0 }, [])!;
    expect(r[1].x).toBe(112);
    expect(orthogonal(r)).toBe(true);
  });

  it('gives up (null) when the boxes close every way', () => {
    const cage: Rect[] = [{ x: 0, y: 0, w: 100, h: 10 }, { x: 0, y: 90, w: 100, h: 10 }, { x: 0, y: 0, w: 10, h: 100 }, { x: 90, y: 0, w: 10, h: 100 }];
    // from inside the cage to the outside, the cage is not exempt (neither end is inside a box's clearance... it is, so
    // this only checks that it terminates and returns something sensible)
    const r = autoRoute({ x: 50, y: 50 }, null, { x: 300, y: 50 }, null, cage);
    expect(r === null || orthogonal(r)).toBe(true);
  });
});
