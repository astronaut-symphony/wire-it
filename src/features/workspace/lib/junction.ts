import type { Edge, Node } from '@xyflow/react';
import { JR } from '@/shared/types';

type Pt = { x: number; y: number };
const pts = (e: Edge) => ((e.data as { points?: Pt[] } | undefined)?.points ?? []) as Pt[];
const touches = (e: Edge, id: string) => e.source === id || e.target === id;

/** How many wires meet at each junction dot. */
export const degrees = (nodes: Node[], edges: Edge[]) =>
  new Map(nodes.filter((n) => n.type === 'junction').map((n) => [n.id, edges.filter((e) => touches(e, n.id)).length]));

/**
 * Joins the two wires meeting at junction `jid` into one wire and drops the dot. The wires' bend points
 * are kept and the dot's spot becomes a corner (drawn rounded like any other corner).
 */
export function mergeAt(jid: string, nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const mine = edges.filter((e) => touches(e, jid));
  const J = nodes.find((n) => n.id === jid);
  if (mine.length !== 2 || !J) return { nodes, edges };
  const [x, y] = mine;
  // each wire seen from its far end towards the dot
  const toJ = (e: Edge) =>
    e.target === jid
      ? { far: e.source, handle: e.sourceHandle, pts: pts(e) }
      : { far: e.target, handle: e.targetHandle, pts: [...pts(e)].reverse() };
  const A = toJ(x);
  const B = toJ(y);
  const c = { x: J.position.x + JR, y: J.position.y + JR };
  const merged: Edge = {
    id: crypto.randomUUID(),
    source: A.far,
    sourceHandle: A.handle,
    target: B.far,
    targetHandle: B.handle,
    type: 'wire',
    style: x.style,
    data: { points: [...A.pts, c, ...[...B.pts].reverse()], ortho: (x.data as { ortho?: boolean } | undefined)?.ortho },
  };
  return { nodes: nodes.filter((n) => n.id !== jid), edges: [...edges.filter((e) => !touches(e, jid)), merged] };
}

/**
 * Cleans up junctions that just lost a wire (`prev` = wires per junction before): left with two wires they
 * are merged into one; left with one or none the dot goes (with its dangling wire). Cascades.
 * Junctions not in `prev` are new and left alone, so a fresh two-wire dot survives until it gets a third.
 */
export function normalizeJunctions(nodes: Node[], edges: Edge[], prev: Map<string, number>) {
  let ns = nodes;
  let es = edges;
  let changed = false;
  for (let again = true; again; ) {
    again = false;
    for (const [id, d] of degrees(ns, es)) {
      const was = prev.get(id);
      if (was === undefined || d >= was || d > 2) continue;
      if (d === 2) ({ nodes: ns, edges: es } = mergeAt(id, ns, es));
      else {
        ns = ns.filter((n) => n.id !== id);
        es = es.filter((e) => !touches(e, id));
      }
      changed = again = true;
      break;
    }
  }
  return { nodes: ns, edges: es, changed };
}
