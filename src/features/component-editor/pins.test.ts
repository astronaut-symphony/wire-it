import { describe, expect, it } from 'vitest';
import { genPins, groupPins, snapOrigin } from './pins';

describe('genPins', () => {
  it('lays out count x rows at the given pitch', () => {
    const g = { pitchMm: 2.54, rowMm: 2.54, pxPerMm: 10, w: 100, h: 100, count: 3, rows: 2, dir: 'right' as const, start: 1 };
    const p = genPins({ x: 0.1, y: 0.1 }, g);
    expect(p).toHaveLength(6);
    expect(p[1].x).toBeCloseTo(0.1 + 0.254);
    expect(p[1].y).toBeCloseTo(0.1);
    expect(p[3].x).toBeCloseTo(0.1);
    expect(p[3].y).toBeCloseTo(0.1 + 0.254);
    expect(p.map((x) => x.name)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('goes down when dir is down', () => {
    const p = genPins({ x: 0, y: 0 }, { pitchMm: 1, rowMm: 1, pxPerMm: 10, w: 100, h: 200, count: 2, rows: 1, dir: 'down', start: 1 });
    expect(p[1].x).toBeCloseTo(0);
    expect(p[1].y).toBeCloseTo(10 / 200);
  });
});

describe('genPins directions', () => {
  const g = { pitchMm: 1, rowMm: 1, pxPerMm: 10, w: 100, h: 100, count: 2, rows: 2, start: 1 };
  const at = (dir: 'right' | 'down' | 'left' | 'up') => genPins({ x: 0.5, y: 0.5 }, { ...g, dir }).map((p) => [Math.round(p.x * 100), Math.round(p.y * 100)]);
  it('turns the whole group when rotated', () => {
    expect(at('right')).toEqual([[50, 50], [60, 50], [50, 60], [60, 60]]);
    expect(at('down')).toEqual([[50, 50], [50, 60], [40, 50], [40, 60]]);
    expect(at('left')).toEqual([[50, 50], [40, 50], [50, 40], [40, 40]]);
    expect(at('up')).toEqual([[50, 50], [50, 40], [60, 50], [60, 40]]);
  });
});

describe('groupPins', () => {
  const g = { id: 'g', pitch: 2.54, count: 4, rows: 1, dir: 'right' as const, origin: { x: 0.1, y: 0.05 }, skip: [] as number[] };
  it('spaces pins by the real pitch over the image width', () => {
    const p = groupPins(g, 100, 0.5); // image 100mm wide, half as tall
    expect(p).toHaveLength(4);
    expect(p[3].x).toBeCloseTo(0.1 + (3 * 2.54) / 100);
    expect(p[3].y).toBe(0.05);
  });
  it('vertical spacing accounts for the aspect ratio', () => {
    const p = groupPins({ ...g, dir: 'down' }, 100, 0.5);
    expect(p[1].y).toBeCloseTo(0.05 + 2.54 / 100 / 0.5);
  });
  it('a wider image makes the same group span less of it, first pin stays put', () => {
    const narrow = groupPins(g, 50, 1);
    const wide = groupPins(g, 100, 1);
    expect(wide[0]).toEqual(narrow[0]);
    expect(wide[3].x - wide[0].x).toBeCloseTo((narrow[3].x - narrow[0].x) / 2);
  });
  it('leaves out deleted pins but keeps the keys of the others', () => {
    expect(groupPins({ ...g, skip: [1] }, 60, 1).map((x) => x.k)).toEqual([0, 2, 3]);
  });
});

describe('snapOrigin', () => {
  const offs = [{ x: 0, y: 0 }, { x: 0.1, y: 0 }];
  const others = [{ x: 0.5, y: 0.3 }];
  it('lines a pin up horizontally and vertically with an existing pin', () => {
    const r = snapOrigin({ x: 0.403, y: 0.296 }, offs, others, 0.01, 0.01);
    expect(r.o.x).toBeCloseTo(0.4); // second pin (0.4 + 0.1) now over x = 0.5
    expect(r.o.y).toBeCloseTo(0.3);
    expect([r.gx, r.gy]).toEqual([0.5, 0.3]);
  });
  it('does nothing beyond the snap distance, and snaps each axis on its own', () => {
    expect(snapOrigin({ x: 0.2, y: 0.2 }, offs, others, 0.01, 0.01)).toEqual({ o: { x: 0.2, y: 0.2 }, gx: undefined, gy: undefined });
    const r = snapOrigin({ x: 0.2, y: 0.297 }, offs, others, 0.01, 0.01);
    expect(r.o.x).toBe(0.2);
    expect(r.o.y).toBeCloseTo(0.3);
  });
});
