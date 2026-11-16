import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { degrees, mergeAt, normalizeJunctions } from './junction';
import { JR } from '@/shared/types';

const comp = (id: string): Node => ({ id, type: 'comp', position: { x: 0, y: 0 }, data: {} });
const junction = (id: string, x: number, y: number): Node => ({ id, type: 'junction', position: { x: x - JR, y: y - JR }, data: { label: id } });
const wire = (id: string, source: string, target: string, points: { x: number; y: number }[] = []): Edge => ({
  id, source, target, sourceHandle: 'p', targetHandle: 'p', type: 'wire', data: { points, ortho: true },
});

describe('junction clean-up', () => {
  // A --e1--> J --e2--> B, plus a branch J --e3--> C
  const nodes = [comp('A'), comp('B'), comp('C'), junction('J', 100, 50)];
  const e1 = wire('e1', 'A', 'J', [{ x: 10, y: 50 }]);
  const e2 = wire('e2', 'J', 'B', [{ x: 200, y: 50 }]);
  const e3 = wire('e3', 'J', 'C');

  it('merges into one wire when the branch is deleted, keeping bends and the corner', () => {
    const prev = degrees(nodes, [e1, e2, e3]);
    const r = normalizeJunctions(nodes, [e1, e2], prev);
    expect(r.changed).toBe(true);
    expect(r.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C']);
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0]).toMatchObject({ source: 'A', target: 'B' });
    expect((r.edges[0].data as { points: unknown }).points).toEqual([{ x: 10, y: 50 }, { x: 100, y: 50 }, { x: 200, y: 50 }]);
  });

  it('orients the merged wire whichever way the two wires pointed', () => {
    const rev = wire('r', 'B', 'J', [{ x: 200, y: 50 }]); // B -> J instead of J -> B
    const m = mergeAt('J', nodes, [e1, rev]);
    expect(m.edges[0]).toMatchObject({ source: 'A', target: 'B' });
    expect((m.edges[0].data as { points: unknown }).points).toEqual([{ x: 10, y: 50 }, { x: 100, y: 50 }, { x: 200, y: 50 }]);
  });

  it('wires without bend points still keep the dot position as a corner', () => {
    const m = mergeAt('J', nodes, [wire('a', 'A', 'J'), wire('b', 'J', 'B')]);
    expect((m.edges[0].data as { points: unknown }).points).toEqual([{ x: 100, y: 50 }]);
  });

  it('removes the dot and the dangling wire when only one wire is left', () => {
    const prev = degrees(nodes, [e1, e2, e3]);
    const r = normalizeJunctions(nodes, [e1], prev);
    expect(r.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C']);
    expect(r.edges).toHaveLength(0);
  });

  it('leaves a new two-wire dot alone, and a dot that did not lose a wire', () => {
    expect(normalizeJunctions(nodes, [e1, e2], new Map()).changed).toBe(false);
    const prev = degrees(nodes, [e1, e2, e3]);
    expect(normalizeJunctions(nodes, [e1, e2, e3], prev).changed).toBe(false);
  });

  it('cascades when the dangling wire ends at another junction', () => {
    const ns = [comp('A'), comp('B'), comp('C'), junction('J1', 50, 50), junction('J2', 150, 50)];
    // A-J1, J1-B, J1-J2, J2-C, J2-?  (J2 has 3: J1, C, B2)
    const ex = [wire('a', 'A', 'J1'), wire('b', 'J1', 'B'), wire('c', 'J1', 'J2'), wire('d', 'J2', 'C'), wire('e', 'J2', 'B')];
    const prev = degrees(ns, ex);
    // delete wire a and wire b: J1 is left with only J1-J2, J2 then has a wire to nowhere
    const r = normalizeJunctions(ns, ex.filter((x) => x.id !== 'a' && x.id !== 'b'), prev);
    expect(r.nodes.filter((n) => n.type === 'junction')).toHaveLength(0);
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0]).toMatchObject({ source: 'C', target: 'B' });
  });
});
