import type { Connection, Edge, Node } from '@xyflow/react';
import { DIR_POS, POS_VEC, STUB, compSize, isFree, pinDir, rotDir, rotPt } from '@/shared/lib/geometry';
import { JR, PIN, type Component } from '@/shared/types';

const same = (a?: string | null, b?: string | null) => (a ?? null) === (b ?? null);

type Look = { color: string; ortho: boolean };

/**
 * Adds the wire for a new connection. A wire onto a pin that already has wires gets a junction dot at the pin's
 * stub end, exactly like right-click > branch: the pin's wire(s) are re-hung on the dot, then the new wire starts there.
 * Returns the new edge list and any junction nodes to add, or null when the connection is pointless (a pin to itself).
 */
export function connectPins(
  c: Connection,
  nodes: Node[],
  edges: Edge[],
  comps: Map<string, Component>,
  look: Look,
): { edges: Edge[]; newNodes: Node[] } | null {
  if (c.source === c.target && c.sourceHandle === c.targetHandle) return null;
  const wire = (source: string, sourceHandle: string | null | undefined, target: string, targetHandle: string | null | undefined, style?: Edge['style']): Edge => ({
    id: crypto.randomUUID(), source, sourceHandle, target, targetHandle, type: 'wire',
    data: { points: [], ortho: look.ortho }, style: style ?? { stroke: look.color, strokeWidth: 2 },
  });
  const made: Node[] = [];
  let es = [...edges];
  const used = new Set(nodes.filter((n) => n.type === 'junction').map((n) => String((n.data as { label?: string }).label)));

  // the end of the new wire at one pin: the pin itself, or a junction dot if the pin already has wires
  const hook = (n: string, h?: string | null): { n: string; h?: string | null } => {
    const node = nodes.find((x) => x.id === n);
    if (node?.type !== 'comp') return { n, h };
    const at = es.filter((x) => (x.source === n && same(x.sourceHandle, h)) || (x.target === n && same(x.targetHandle, h)));
    if (!at.length) return { n, h };
    for (const x of at) {
      const far = x.source === n ? x.target : x.source;
      if (nodes.find((y) => y.id === far)?.type === 'junction') return { n: far, h: 'j' }; // already branched here
    }
    const d = node.data as { componentId: string; rot?: number };
    const comp = comps.get(d.componentId);
    const pin = comp?.pins.find((p) => p.id === h);
    if (!comp || !pin) return { n, h };
    const rot = d.rot ?? 0;
    const [px, py] = rotPt(pin.x, pin.y, rot);
    const size = compSize(comp, rot);
    const v = isFree(pin) ? { x: 0, y: 0 } : POS_VEC[DIR_POS[rotDir(pinDir(pin, comp), rot)]];
    const reach = PIN / 2 + STUB; // half the pin handle + the wire's straight stub (a free pin has no stub: the dot sits on it)
    const jx = node.position.x + px * size.w + v.x * reach;
    const jy = node.position.y + py * size.h + v.y * reach;
    let i = 1;
    while (used.has(`J${i}`)) i++;
    used.add(`J${i}`);
    const J: Node = { id: crypto.randomUUID(), type: 'junction', position: { x: jx - JR, y: jy - JR }, data: { label: `J${i}` } };
    made.push(J);
    es = es.map((x) => {
      if (!at.includes(x)) return x;
      return {
        ...x,
        ...(x.source === n && same(x.sourceHandle, h) ? { source: J.id, sourceHandle: 'j' } : {}),
        ...(x.target === n && same(x.targetHandle, h) ? { target: J.id, targetHandle: 'j' } : {}),
      };
    });
    es.push(wire(n, h, J.id, 'j', at[0].style)); // the pin's own short wire to the dot
    return { n: J.id, h: 'j' };
  };

  const a = hook(c.source, c.sourceHandle);
  const b = hook(c.target, c.targetHandle);
  es.push(wire(a.n, a.h, b.n, b.h));
  return { edges: es, newNodes: made };
}
