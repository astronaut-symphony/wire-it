import { autoDir } from '@/shared/lib/geometry';
import type { Pin } from '@/shared/types';

export type GroupDir = 'right' | 'down' | 'left' | 'up';
const AXIS: Record<GroupDir, { x: number; y: number }> = {
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
};
export const ROTATE: Record<GroupDir, GroupDir> = { right: 'down', down: 'left', left: 'up', up: 'right' };

type PinGrid = {
  pitchMm: number;
  rowMm: number;
  pxPerMm: number; // image px per real mm
  w: number;
  h: number;
  count: number;
  rows: number;
  dir: GroupDir;
  flip?: boolean; // rows go to the other side of the run
  start: number; // number of the first pin name
};

/** Pins laid on a grid from origin (0..1 coords). `count` along `dir`, `rows` across it. */
export function genPins(origin: { x: number; y: number }, g: PinGrid): Pin[] {
  const out: Pin[] = [];
  for (let r = 0; r < g.rows; r++) {
    for (let i = 0; i < g.count; i++) {
      const along = i * g.pitchMm * g.pxPerMm;
      const across = (g.flip ? -1 : 1) * r * g.rowMm * g.pxPerMm;
      const a = AXIS[g.dir];
      const [dx, dy] = [a.x * along - a.y * across, a.y * along + a.x * across]; // rows = run turned 90deg clockwise
      const x = origin.x + dx / g.w;
      const y = origin.y + dy / g.h;
      out.push({
        id: crypto.randomUUID().slice(0, 8),
        name: String(g.start + r * g.count + i),
        x,
        y,
        dir: autoDir(x, y, g.w, g.h),
      });
    }
  }
  return out;
}

/** A header/connector placed in the editor. origin is on the image (0..1), so it follows the image. */
export type Group = {
  id: string;
  pitch: number;
  count: number;
  rows: number;
  dir: GroupDir;
  flip?: boolean;
  origin: { x: number; y: number };
  skip: number[]; // indices of pins the user deleted
};

const MIRROR = { h: { left: 'right', right: 'left' }, v: { up: 'down', down: 'up' } } as const;
/** Mirrors a direction across the vertical (h: left <-> right) or horizontal (v: up <-> down) axis. */
export const mirrorDir = <T extends string>(d: T, axis: 'h' | 'v'): T => ((MIRROR[axis] as Record<string, string>)[d] ?? d) as T;
/** Mirrors a group around its first pin. A mirror reverses handedness, so the rows swap sides too. */
export const mirror = (g: Group, axis: 'h' | 'v'): Group => ({ ...g, dir: mirrorDir(g.dir, axis), flip: !g.flip });

/**
 * Pins of a group on the image (0..1), in order, minus the deleted ones. k = index before deletions (stable key).
 * Spacing is the real pitch over the image's real width, so a wider image makes the same group look smaller.
 * aspect = image height / width.
 */
export function groupPins(g: Group, mmW: number, aspect: number): { k: number; x: number; y: number }[] {
  const grid = { pitchMm: g.pitch, rowMm: g.pitch, pxPerMm: 1 / mmW, w: 1, h: aspect, count: g.count, rows: g.rows, dir: g.dir, flip: g.flip, start: 1 };
  return genPins(g.origin, grid).flatMap((p, k) => (g.skip.includes(k) ? [] : [{ k, x: p.x, y: p.y }]));
}

/**
 * Snaps a dragged group so one of its pins lines up (same x, or same y) with a pin that is already there.
 * `offs` are the group's pins relative to its origin; tx/ty are the snap distances on each axis.
 * gx/gy report the coordinate that was matched, for drawing a guide.
 */
export function snapOrigin(
  o: { x: number; y: number },
  offs: { x: number; y: number }[],
  others: { x: number; y: number }[],
  tx: number,
  ty: number,
): { o: { x: number; y: number }; gx?: number; gy?: number } {
  let dx = 0;
  let dy = 0;
  let gx: number | undefined;
  let gy: number | undefined;
  let bx = tx;
  let by = ty;
  for (const a of offs) {
    for (const b of others) {
      const ex = b.x - (o.x + a.x);
      if (Math.abs(ex) < bx) [bx, dx, gx] = [Math.abs(ex), ex, b.x];
      const ey = b.y - (o.y + a.y);
      if (Math.abs(ey) < by) [by, dy, gy] = [Math.abs(ey), ey, b.y];
    }
  }
  return { o: { x: o.x + dx, y: o.y + dy }, gx, gy };
}
