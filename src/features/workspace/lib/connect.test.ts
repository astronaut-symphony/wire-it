import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { connectPins } from './connect';
import { JR, PIN, type Component } from '@/shared/types';
import { STUB } from '@/shared/lib/geometry';

// a 100 x 50 component with pin p1 near the top (wire leaves upward) and p2 near the bottom
const comp: Component = {
  id: 'c', name: 'Board', svg: '', w: 100, h: 50, mmW: 25,
  pins: [{ id: 'p1', name: '1', x: 0.5, y: 0.1 }, { id: 'p2', name: '2', x: 0.5, y: 0.9 }],
};
const comps = new Map([['c', comp]]);
const node = (id: string, x = 0, y = 0): Node => ({ id, type: 'comp', position: { x, y }, data: { componentId: 'c', label: id } });
const nodes = [node('A', 0, 200), node('B', 300, 0), node('C', 600, 0), node('D', 900, 0)];
const look = { color: '#e03131', ortho: true };
const conn = (source: string, sourceHandle: string, target: string, targetHandle: string) => ({ source, sourceHandle, target, targetHandle });
const apply = (r: NonNullable<ReturnType<typeof connectPins>>, ns: Node[]) => ({ nodes: [...ns, ...r.newNodes], edges: r.edges });

describe('connectPins', () => {
  it('ignores a pin connected to itself', () => {
    expect(connectPins(conn('A', 'p1', 'A', 'p1'), nodes, [], comps, look)).toBeNull();
  });

  it('a plain connection is one new wire with the current look and no junction', () => {
    const r = connectPins(conn('A', 'p1', 'B', 'p2'), nodes, [], comps, look)!;
    expect(r.newNodes).toEqual([]);
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0]).toMatchObject({ source: 'A', sourceHandle: 'p1', target: 'B', targetHandle: 'p2', type: 'wire' });
    expect(r.edges[0].style).toMatchObject({ stroke: '#e03131' });
    expect((r.edges[0].data as { ortho: boolean }).ortho).toBe(true);
  });

  it('a wire onto a pin that already has one adds a junction at the stub end and re-hangs the old wire on it', () => {
    const existing: Edge = { id: 'old', source: 'A', sourceHandle: 'p1', target: 'B', targetHandle: 'p1', type: 'wire', style: { stroke: '#111111' } };
    const r = connectPins(conn('C', 'p2', 'A', 'p1'), nodes, [existing], comps, look)!;
    expect(r.newNodes).toHaveLength(1);
    const J = r.newNodes[0];
    expect(J.type).toBe('junction');
    // pin p1 of A is at (0.5 * 100, 0.1 * 50) = (50, 5) inside the node at (0, 200); it points up
    expect(J.position.x + JR).toBeCloseTo(50);
    expect(J.position.y + JR).toBeCloseTo(200 + 5 - (PIN / 2 + STUB));

    expect(r.edges).toHaveLength(3);
    const old = r.edges.find((e) => e.id === 'old')!;
    expect(old).toMatchObject({ source: J.id, sourceHandle: 'j', target: 'B', targetHandle: 'p1' }); // pin end moved to the dot
    expect(r.edges.some((e) => e.source === 'A' && e.sourceHandle === 'p1' && e.target === J.id)).toBe(true); // the pin's own short wire
    expect(r.edges.some((e) => e.source === 'C' && e.target === J.id)).toBe(true); // the new wire
    expect(r.edges.find((e) => e.source === 'A' && e.target === J.id)!.style).toMatchObject({ stroke: '#111111' }); // trunk keeps the old colour
  });

  it('a third wire on the same pin reuses the junction instead of adding another', () => {
    const existing: Edge = { id: 'old', source: 'A', sourceHandle: 'p1', target: 'B', targetHandle: 'p1', type: 'wire' };
    const first = apply(connectPins(conn('C', 'p2', 'A', 'p1'), nodes, [existing], comps, look)!, nodes);
    const second = connectPins(conn('D', 'p2', 'A', 'p1'), first.nodes, first.edges, comps, look)!;
    expect(second.newNodes).toEqual([]);
    expect(second.edges).toHaveLength(first.edges.length + 1);
    const J = first.nodes.find((n) => n.type === 'junction')!;
    expect(second.edges[second.edges.length - 1]).toMatchObject({ source: 'D', target: J.id, targetHandle: 'j' });
  });

  it('numbers junctions J1, J2 ... without reusing a name', () => {
    const extra: Node = { id: 'x', type: 'junction', position: { x: 0, y: 0 }, data: { label: 'J1' } };
    const existing: Edge = { id: 'old', source: 'A', sourceHandle: 'p1', target: 'B', targetHandle: 'p1', type: 'wire' };
    const r = connectPins(conn('C', 'p2', 'A', 'p1'), [...nodes, extra], [existing], comps, look)!;
    expect((r.newNodes[0].data as { label: string }).label).toBe('J2');
  });
});
