import { describe, expect, it } from 'vitest';
import { autoDir, compSize, snapByPin, dedupe, rotDir, rotPt, elbowPath, moveRun, roundedPath, runs, tidy, type Pt } from './geometry';

const axisAligned = (pts: Pt[]) =>
  pts.slice(1).every((p, i) => Math.abs(p.x - pts[i].x) < 0.5 || Math.abs(p.y - pts[i].y) < 0.5);

describe('autoDir', () => {
  it('picks the nearest image edge', () => {
    expect(autoDir(0.05, 0.5, 100, 100)).toBe('left');
    expect(autoDir(0.95, 0.5, 100, 100)).toBe('right');
    expect(autoDir(0.5, 0.02, 100, 100)).toBe('up');
    expect(autoDir(0.5, 0.98, 100, 100)).toBe('down');
  });
});

describe('runs / moveRun', () => {
  const P = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 40 }, { x: 100, y: 40 }];

  it('finds straight runs, merging collinear points', () => {
    expect(runs(P).map((r) => [r.a, r.b, r.o])).toEqual([[0, 1, 'h'], [1, 2, 'v'], [2, 3, 'h']]);
    const Q = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 40 }];
    expect(runs(Q).map((r) => [r.a, r.b, r.o])).toEqual([[0, 2, 'h'], [2, 3, 'v']]);
  });

  it('slides a middle run and keeps the pins fixed', () => {
    const r = moveRun(P, runs(P)[1], 70);
    expect(r).toEqual([{ x: 0, y: 0 }, { x: 70, y: 0 }, { x: 70, y: 40 }, { x: 100, y: 40 }]);
  });

  it('adds a jog when the run touches a pin', () => {
    const r = moveRun(P, runs(P)[0], 20);
    expect(r).toEqual([{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 50, y: 20 }, { x: 50, y: 40 }, { x: 100, y: 40 }]);
    expect(axisAligned(r)).toBe(true);
  });

  it('moves a junction end with the run instead of adding a jog', () => {
    const r = moveRun(P, runs(P)[0], 20, { start: false, end: true });
    expect(r).toEqual([{ x: 0, y: 20 }, { x: 50, y: 20 }, { x: 50, y: 40 }, { x: 100, y: 40 }]);
  });

  it('turns a straight pin-to-pin wire into a U', () => {
    const S = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const r = moveRun(S, runs(S)[0], 30);
    expect(r).toEqual([{ x: 0, y: 0 }, { x: 0, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 0 }]);
  });

  it('dedupe removes the jog again when dropped back in place', () => {
    const r = dedupe(moveRun(P, runs(P)[0], 0));
    expect(r).toEqual(P);
  });
});

describe('snapByPin', () => {
  it('puts the pin, not the top-left corner, on the grid', () => {
    const pin = { x: 12.5, y: 3.2 };
    const p = snapByPin({ x: 101, y: 52 }, pin, 5);
    expect((p.x + pin.x) % 5).toBeCloseTo(0);
    expect((p.y + pin.y) % 5).toBeCloseTo(0);
    expect(Math.abs(p.x - 101)).toBeLessThanOrEqual(2.5);
  });
  it('is the plain grid snap when the pin is at the corner, and stable once snapped', () => {
    expect(snapByPin({ x: 12, y: 13 }, { x: 0, y: 0 }, 5)).toEqual({ x: 10, y: 15 });
    const once = snapByPin({ x: 33.3, y: 47.7 }, { x: 7.7, y: 1.3 }, 5);
    expect(snapByPin(once, { x: 7.7, y: 1.3 }, 5)).toEqual(once);
  });
});

describe('rotation', () => {
  it('turns a 0..1 point and a direction clockwise', () => {
    expect(rotPt(0.2, 0.1, 90)).toEqual([0.9, 0.2]);
    expect(rotPt(0.2, 0.1, 180)).toEqual([0.8, 0.9]);
    expect(rotPt(0.2, 0.1, 270)).toEqual([0.1, 0.8]);
    expect(rotDir('up', 90)).toBe('right');
    expect(rotDir('left', 90)).toBe('up');
    expect(rotDir('down', 270)).toBe('right');
  });
  it('four quarter turns come back to the start', () => {
    let p: [number, number] = [0.3, 0.7];
    for (let i = 0; i < 4; i++) p = rotPt(p[0], p[1], 90);
    expect(p[0]).toBeCloseTo(0.3);
    expect(p[1]).toBeCloseTo(0.7);
  });
  it('swaps the box size on quarter turns', () => {
    const c = { w: 100, h: 50, mmW: 25 } as Parameters<typeof compSize>[0];
    expect(compSize(c, 0)).toEqual({ w: 100, h: 50 });
    expect(compSize(c, 90)).toEqual({ w: 50, h: 100 });
  });
});

describe('roundedPath', () => {
  it('rounds corners, caps the radius on short legs, keeps the end points', () => {
    const d = roundedPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 8);
    expect(d).toBe('M0,0 L92,0 Q100,0 100,8 L100,100');
    expect(roundedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 100 }], 8)).toContain('L5,0 Q10,0 10,5');
  });
  it('survives repeated points', () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }], 8)).toBe('M0,0 L0,0 L5,0');
  });
});

describe('elbowPath', () => {
  it('keeps every leg horizontal or vertical', () => {
    const s = { x: 10, y: 10 };
    const e = { x: 200, y: 120 };
    for (const sv of [{ x: 1, y: 0 }, { x: 0, y: -1 }]) {
      for (const ev of [{ x: -1, y: 0 }, { x: 0, y: 1 }]) {
        const v = elbowPath(s, sv, [{ x: 80, y: 40 }, { x: 150, y: 90 }], e, ev).map((x) => x.p);
        expect(axisAligned(v)).toBe(true);
        expect(v[0]).toEqual(s);
        expect(v[v.length - 1]).toEqual(e);
      }
    }
  });

  it('tags waypoints so they can be edited', () => {
    const v = elbowPath({ x: 0, y: 0 }, { x: 1, y: 0 }, [{ x: 50, y: 50 }], { x: 100, y: 0 }, { x: -1, y: 0 });
    expect(v.filter((x) => x.wp === 0).map((x) => x.p)).toEqual([{ x: 50, y: 50 }]);
  });
});

// two consecutive collinear legs going opposite ways = a spur
function spur(P: Pt[]) {
  for (let i = 0; i + 2 < P.length; i++) {
    const a = P[i], b = P[i + 1], c = P[i + 2];
    const h = Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5;
    const v = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5;
    if ((h && (b.x - a.x) * (c.x - b.x) < 0) || (v && (b.y - a.y) * (c.y - b.y) < 0)) return true;
  }
  return false;
}

describe('tidy', () => {
  it('removes a spur left by lining a run up with its neighbour', () => {
    const P = [{ x: 450, y: 388 }, { x: 450, y: 235 }, { x: 400, y: 235 }, { x: 768, y: 235 }];
    expect(spur(P)).toBe(true);
    expect(tidy(P)).toEqual([{ x: 450, y: 388 }, { x: 450, y: 235 }, { x: 768, y: 235 }]);
  });

  it('random run drags never leave a spur or a diagonal', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const s = { x: 450, y: 388 }, e = { x: 768, y: 235 };
    const sv = { x: 0, y: -1 }, ev = { x: 0, y: 1 };
    for (let trial = 0; trial < 300; trial++) {
      let points: Pt[] = [{ x: 450, y: 275 }, { x: 768, y: 275 }];
      for (let step = 0; step < 12; step++) {
        const P = tidy(elbowPath(s, sv, points, e, ev).map((v) => v.p));
        const rl = runs(P);
        const run = rl[Math.floor(rnd() * rl.length)];
        points = tidy(moveRun(P, run, Math.round((rnd() * 400) / 5) * 5 + 200)).slice(1, -1);
        const after = tidy(elbowPath(s, sv, points, e, ev).map((x) => x.p));
        expect(spur(after)).toBe(false);
        expect(after.slice(1).every((p, i) => Math.abs(p.x - after[i].x) < 0.5 || Math.abs(p.y - after[i].y) < 0.5)).toBe(true);
      }
    }
  });
});
