import { JR, type Component } from '@/shared/types';
import { DIR_POS, POS_VEC, STUB, compSize, elbowPath, isFree, pinDir, rotDir, rotPt, roundedPath, tidy, type Pt, type Rect } from '@/shared/lib/geometry';
import { defaultRoute } from '@/shared/lib/autoroute';
import { svgUrl } from '@/shared/lib/importImage';
import type { Edge, Node } from '@xyflow/react';

type NodeData = { componentId?: string; rot?: number };
type EdgeData = { points?: Pt[]; ortho?: boolean };

/** A small picture of a diagram for the project list: components in place, wires as straight or bent lines (auto-routing is not repeated here). */
export function ProjectPreview({ nodes, edges, comps }: { nodes: Node[]; edges: Edge[]; comps: Map<string, Component> }) {
  // top-left, size and component of every drawable node
  const boxes = new Map<string, { x: number; y: number; w: number; h: number; c?: Component; rot: number }>();
  for (const n of nodes) {
    const d = n.data as NodeData;
    if (n.type === 'junction') boxes.set(n.id, { x: n.position.x, y: n.position.y, w: 2 * JR, h: 2 * JR, rot: 0 });
    else {
      const c = comps.get(d.componentId ?? '');
      if (c) boxes.set(n.id, { x: n.position.x, y: n.position.y, ...compSize(c, d.rot ?? 0), c, rot: d.rot ?? 0 });
    }
  }
  if (!boxes.size) return null;
  // where a wire ends: the pin's centre and the way it leaves; a junction dot or a free pin has no stub (same rules as WireEdge)
  const end = (id: string, pin?: string | null) => {
    const b = boxes.get(id);
    if (!b) return undefined;
    const p = b.c?.pins.find((q) => q.id === pin);
    if (!p || !b.c) return { S: { x: b.x + b.w / 2, y: b.y + b.h / 2 }, vec: { x: 0, y: 0 }, bare: true };
    const [x, y] = rotPt(p.x, p.y, b.rot);
    return { S: { x: b.x + x * b.w, y: b.y + y * b.h }, vec: POS_VEC[DIR_POS[rotDir(pinDir(p, b.c), b.rot)]], bare: isFree(p) };
  };
  const toward = (from: Pt, to: Pt): Pt => (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? { x: Math.sign(to.x - from.x) || 1, y: 0 } : { x: 0, y: Math.sign(to.y - from.y) });
  const obstacles: Rect[] = [...boxes.values()].filter((b) => b.c).map(({ x, y, w, h }) => ({ x, y, w, h }));
  const lines = edges.flatMap((e) => {
    const [a, z] = [end(e.source, e.sourceHandle), end(e.target, e.targetHandle)];
    if (!a || !z) return [];
    const { points = [], ortho = false } = (e.data ?? {}) as EdgeData;
    const [S, T] = [a.S, z.S];
    const sv = a.bare ? toward(S, points[0] ?? T) : a.vec;
    const ev = z.bare ? toward(T, points[points.length - 1] ?? S) : z.vec;
    const s = { x: S.x + sv.x * (a.bare ? 0 : STUB), y: S.y + sv.y * (a.bare ? 0 : STUB) };
    const t = { x: T.x + ev.x * (z.bare ? 0 : STUB), y: T.y + ev.y * (z.bare ? 0 : STUB) };
    const inner = !ortho
      ? [s, ...points, t]
      : tidy((!points.length && defaultRoute(S, s, sv, !a.bare, t, ev, !z.bare, T, obstacles)) || elbowPath(s, sv, points, t, ev).map((v) => v.p));
    const pts = [S, ...inner, T];
    return [{ id: e.id, pts, d: roundedPath(pts, 8), color: String(e.style?.stroke ?? '#111') }];
  });
  const all = [...boxes.values()].flatMap((b) => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h }]).concat(lines.flatMap((l) => l.pts));
  const [x1, x2] = [Math.min(...all.map((p) => p.x)), Math.max(...all.map((p) => p.x))];
  const [y1, y2] = [Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y))];
  const pad = 20;
  return (
    <svg viewBox={`${x1 - pad} ${y1 - pad} ${x2 - x1 + 2 * pad} ${y2 - y1 + 2 * pad}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {[...boxes.entries()].map(([id, b]) =>
        b.c ? (
          <image
            key={id}
            href={svgUrl(b.c.svg)}
            x={b.x + (b.w - compSize(b.c).w) / 2}
            y={b.y + (b.h - compSize(b.c).h) / 2}
            width={compSize(b.c).w}
            height={compSize(b.c).h}
            transform={b.rot ? `rotate(${b.rot} ${b.x + b.w / 2} ${b.y + b.h / 2})` : undefined}
          />
        ) : (
          <circle key={id} cx={b.x + JR} cy={b.y + JR} r={3} fill="#111" />
        ),
      )}
      {lines.map((l) => (
        <path key={l.id} d={l.d} fill="none" stroke={l.color} strokeWidth={2} />
      ))}
    </svg>
  );
}
