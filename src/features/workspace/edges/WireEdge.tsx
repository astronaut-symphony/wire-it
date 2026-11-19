import { useContext, useMemo, useRef, type PointerEvent, type MouseEvent } from 'react';
import { BaseEdge, useNodes, useReactFlow, type EdgeProps, type Position } from '@xyflow/react';
import { MenuCtx } from '@/features/workspace/menu/menu';
import { Angle, GitBranch, Palette, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { WIRE_COLORS, WIRE_COLOR_NAMES } from '@/features/workspace/Toolbar';
import { layerMenu } from '@/features/workspace/lib/layers';
import { Actions } from '@/features/workspace/context/actions';
import { Comps } from '@/features/workspace/context/comps';
import { JR, PIN } from '@/shared/types';
import {
  POS_VEC, STUB, compSize, isFree, elbowPath, moveRun, roundedPath, runs, tidy,
  type Pt, type Rect, type Run, type V,
} from '@/shared/lib/geometry';
import { defaultRoute } from '@/shared/lib/autoroute';
import '@/features/workspace/workspace.css';

const RADIUS = 8; // corner rounding in px

const snap = (n: number) => Math.round(n / 5) * 5;
const ALIGN = 8; // px within which a dragged line/point sticks to an existing pin/corner coordinate
// pins are rarely on the 5px grid, so stick to their exact coordinate first or the wire gets a tiny jog
const near = (v: number, anchors: number[]) => {
  let best = snap(v);
  let d = ALIGN;
  for (const a of anchors) if (Math.abs(a - v) < d) [best, d] = [a, Math.abs(a - v)];
  return best;
};
const key = (o: Run['o']) => (o === 'h' ? 'y' : 'x'); // the coordinate a run is moved along

// distance from p to segment a-b
function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = dx || dy ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Wire that leaves each pin straight along its fixed direction, then runs through bend points.
 * ortho: only horizontal/vertical legs, a simple elbow shape until edited; each straight
 * stretch has a handle to slide it sideways. Otherwise each bend is a free point.
 * Right-click for the menu.
 */
export function WireEdge({
  id, source, target, sourceHandleId, targetHandleId, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  data, selected, style,
}: EdgeProps) {
  const { screenToFlowPosition, setEdges, setNodes } = useReactFlow();
  const openMenu = useContext(MenuCtx);
  const { moveEdge } = useContext(Actions);
  const nodes = useNodes();
  const comps = useContext(Comps);
  const { points = [], ortho = false } = (data ?? {}) as { points?: Pt[]; ortho?: boolean };
  // chain at pointerdown + run being moved; a ref so pointermoves work from the original shape
  const dragRef = useRef<{ P: Pt[]; run: Run; idx: number; v: number; at: Pt; jv: number } | null>(null);

  // a junction dot has no pin direction or stub: wires start at its centre and head straight for the other end
  const center = (nid: string) => {
    const n = nodes.find((x) => x.id === nid);
    return n?.type === 'junction' ? { x: n.position.x + JR, y: n.position.y + JR } : null;
  };
  const toward = (from: Pt, to: Pt): Pt =>
    Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
      ? { x: Math.sign(to.x - from.x) || 1, y: 0 }
      : { x: 0, y: Math.sign(to.y - from.y) };
  // a free pin, like a junction dot, has no stub: the wire leaves it straight towards the other end
  const free = (nid: string, h?: string | null) => {
    const d = nodes.find((x) => x.id === nid)?.data as { componentId?: string } | undefined;
    return isFree(comps.get(d?.componentId ?? '')?.pins.find((p) => p.id === h));
  };
  const fS = free(source, sourceHandleId);
  const fT = free(target, targetHandleId);
  const cS = center(source);
  const cT = center(target);
  // react-flow reports the edge of the pin handle facing its side; the pin's centre is half a handle back
  const centre = (x: number, y: number, pos: Position) => ({ x: x - (POS_VEC[pos].x * PIN) / 2, y: y - (POS_VEC[pos].y * PIN) / 2 });
  const pinS = cS ? null : centre(sourceX, sourceY, sourcePosition);
  const pinT = cT ? null : centre(targetX, targetY, targetPosition);
  const S = cS ?? (fS ? pinS! : { x: sourceX, y: sourceY });
  const T = cT ?? (fT ? pinT! : { x: targetX, y: targetY });
  const sv0 = cS || fS ? toward(S, points[0] ?? T) : POS_VEC[sourcePosition];
  const ev0 = cT || fT ? toward(T, points[points.length - 1] ?? S) : POS_VEC[targetPosition];
  const sv = sv0;
  const ev = ev0;
  // s / e: where the wire's own, editable part starts and ends (pin stub end, or the junction dot itself)
  const s = { x: S.x + sv.x * (cS || fS ? 0 : STUB), y: S.y + sv.y * (cS || fS ? 0 : STUB) };
  const e = { x: T.x + ev.x * (cT || fT ? 0 : STUB), y: T.y + ev.y * (cT || fT ? 0 : STUB) };

  // A new wire (no bend points yet) is routed on its own: out of each pin along its direction without doubling
  // back, and around the components. Once the user shapes it, `points` take over and this is not used.
  const boxes: Rect[] = nodes.flatMap((n) => {
    const d = n.data as { componentId?: string; rot?: number };
    const c = n.type === 'comp' ? comps.get(d.componentId ?? '') : undefined;
    return c ? [{ x: n.position.x, y: n.position.y, ...compSize(c, d.rot ?? 0) }] : [];
  });
  const sig = boxes.map((b) => `${b.x},${b.y},${b.w},${b.h}`).join('|');
  const auto = useMemo(
    () => (ortho && !points.length ? defaultRoute(S, s, sv, !(cS || fS), e, ev, !(cT || fT), T, boxes) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ortho, points.length, sig, S.x, S.y, s.x, s.y, e.x, e.y, T.x, T.y, sv.x, sv.y, ev.x, ev.y, !!cS, !!cT, fS, fT],
  );

  let mid: V[]; // s ... e
  if (!ortho) mid = [s, ...points, e].map((p, i, a) => ({ p, wp: i === 0 || i === a.length - 1 ? -1 : i - 1 }));
  else mid = tidy(auto ?? elbowPath(s, sv, points, e, ev).map((v) => v.p)).map((p) => ({ p, wp: -1 }));
  const pre: V[] = [{ p: S, wp: -1 }];
  const post: V[] = [{ p: T, wp: -1 }];
  const verts: V[] = [...pre, ...mid, ...post];
  // every corner of the wire's own part; in ortho mode this includes generated ones
  const corners = mid.slice(1, -1).map((v) => v.p);

  // the edit handles take the wire's own colour (see .bend in workspace.css)
  const wireVar = { '--wire': String(style?.stroke ?? '#111') } as React.CSSProperties;
  const path = roundedPath(verts.map((v) => v.p), RADIUS);

  const P = tidy([s, ...corners, e]);
  const runList = ortho ? runs(P) : [];
  const drag = dragRef.current;
  // while dragging, only the moved run's handle is drawn (indices shift when a jog is inserted, and
  // the run can merge into a neighbour, so fall back to the pointer position rather than unmount it)
  const segs = (
    drag
      ? [(() => {
          const r = runList.find((x) => x.o === drag.run.o && Math.abs(P[x.a][key(x.o)] - drag.v) < 0.5);
          return r ? { k: drag.idx, o: r.o, cx: (P[r.a].x + P[r.b].x) / 2, cy: (P[r.a].y + P[r.b].y) / 2 } : { k: drag.idx, o: drag.run.o, cx: drag.at.x, cy: drag.at.y };
        })()]
      : runList.map((r, k) => ({ k, o: r.o, cx: (P[r.a].x + P[r.b].x) / 2, cy: (P[r.a].y + P[r.b].y) / 2 }))
  );

  const setData = (d: Record<string, unknown>) =>
    setEdges((es) => es.map((x) => (x.id === id ? { ...x, data: { ...x.data, ...d } } : x)));
  const setPoints = (pts: Pt[]) => setData({ points: pts });
  const flowPos = (p: { clientX: number; clientY: number }) => screenToFlowPosition({ x: p.clientX, y: p.clientY });

  function addPointAt(p: Pt) {
    let k = 0;
    let best = Infinity;
    for (let i = 0; i < verts.length - 1; i++) {
      const d = segDist(p, verts[i].p, verts[i + 1].p);
      if (d < best) [k, best] = [i, d];
    }
    if (k < pre.length || k > pre.length + mid.length - 2) return; // pin stubs and shared trunks stay as they are
    const at = k - pre.length;
    setPoints([...corners.slice(0, at), { x: snap(p.x), y: snap(p.y) }, ...corners.slice(at)]);
  }

  /** Split this wire at p with a junction dot; more wires can then start or end on the dot. */
  function branchAt(p: Pt) {
    let k = pre.length;
    let best = Infinity;
    for (let i = pre.length; i <= pre.length + mid.length - 2; i++) {
      const d = segDist(p, verts[i].p, verts[i + 1].p);
      if (d < best) [k, best] = [i, d];
    }
    const a = verts[k].p;
    const b = verts[k + 1].p;
    const clamp = (v: number, u: number, w: number) => Math.max(Math.min(u, w), Math.min(Math.max(u, w), v));
    let q: Pt;
    if (Math.abs(a.y - b.y) < 0.5) q = { x: clamp(snap(p.x), a.x, b.x), y: a.y };
    else if (Math.abs(a.x - b.x) < 0.5) q = { x: a.x, y: clamp(snap(p.y), a.y, b.y) };
    else {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      q = { x: a.x + t * dx, y: a.y + t * dy };
    }
    const at = k - pre.length;
    const used = new Set(nodes.filter((n) => n.type === 'junction').map((n) => String((n.data as { label?: string }).label)));
    let i = 1;
    while (used.has(`J${i}`)) i++;
    const jid = crypto.randomUUID();
    setNodes((ns) => [
      ...ns,
      { id: jid, type: 'junction', position: { x: q.x - JR, y: q.y - JR }, data: { label: `J${i}` } },
    ]);
    setEdges((es) => [
      ...es.filter((x) => x.id !== id),
      {
        id: crypto.randomUUID(), source, sourceHandle: sourceHandleId, target: jid, targetHandle: 'j',
        type: 'wire', style, data: { points: corners.slice(0, at), ortho },
      },
      {
        id: crypto.randomUUID(), source: jid, sourceHandle: 'j', target, targetHandle: targetHandleId,
        type: 'wire', style, data: { points: corners.slice(at), ortho },
      },
    ]);
  }

  function openWireMenu(ev: MouseEvent, bend?: number) {
    ev.preventDefault();
    ev.stopPropagation();
    setEdges((es) => es.map((x) => ({ ...x, selected: x.id === id })));
    const at = flowPos(ev);
    const color = {
      icon: <Palette size={14} />,
      label: 'Change color',
      children: WIRE_COLORS.map((c) => ({
        icon: <span style={{ width: 14, height: 14, borderRadius: 3, background: c, display: 'inline-block' }} />,
        label: WIRE_COLOR_NAMES[c],
        onClick: () => setEdges((es) => es.map((x) => (x.id === id ? { ...x, style: { ...x.style, stroke: c } } : x))),
      })),
    };
    const toggle = { icon: <Angle size={14} />, label: ortho ? 'Turn off right angles' : 'Turn on right angles', onClick: () => setData({ ortho: !ortho }) };
    const layers = layerMenu((op) => moveEdge(id, op)); // among wires only
    const del = { icon: <Trash2 size={14} />, label: 'Delete wire', danger: true, onClick: () => setEdges((es) => es.filter((x) => x.id !== id)) };
    openMenu({
      x: ev.clientX,
      y: ev.clientY,
      items: ortho
        ? [
            { icon: <GitBranch size={14} />, label: 'Branch here', onClick: () => branchAt(at) },
            toggle,
            { icon: <RotateCcw size={14} />, label: 'Reset wire shape', onClick: () => setPoints([]), disabled: !points.length },
            color,
            layers,
            del,
          ]
        : [
            { icon: <GitBranch size={14} />, label: 'Branch here', onClick: () => branchAt(at) },
            bend === undefined
              ? { icon: <Plus size={14} />, label: 'Add bend point here', onClick: () => addPointAt(at) }
              : { icon: <X size={14} />, label: 'Delete bend point', onClick: () => setPoints(corners.filter((_, j) => j !== bend)) },
            toggle,
            { icon: <RotateCcw size={14} />, label: 'Delete all bend points', onClick: () => setPoints([]), disabled: !points.length },
            color,
            layers,
            del,
          ],
    });
  }

  function dragPoint(i: number, ev: PointerEvent<SVGCircleElement>) {
    if (!ev.currentTarget.hasPointerCapture(ev.pointerId)) return;
    const p = flowPos(ev);
    const others = [s, e, ...corners.filter((_, j) => j !== i)];
    const q = { x: near(p.x, others.map((o) => o.x)), y: near(p.y, others.map((o) => o.y)) };
    setPoints(corners.map((o, j) => (j === i ? q : o)));
  }

  function dragRun(ev: PointerEvent<SVGCircleElement>) {
    const d = dragRef.current;
    if (!d || !ev.currentTarget.hasPointerCapture(ev.pointerId)) return;
    const p = flowPos(ev);
    const k = key(d.run.o);
    d.v = near(d.run.o === 'h' ? p.y : p.x, d.P.map((q) => q[k]));
    d.at = d.run.o === 'h' ? { x: p.x, y: d.v } : { x: d.v, y: p.y };
    setPoints(tidy(moveRun(d.P, d.run, d.v, { start: !cS, end: !cT })).slice(1, -1));
    // a run that leaves a junction dot drags the dot along with it
    const dots = [d.run.a === 0 && cS ? source : null, d.run.b === d.P.length - 1 && cT ? target : null];
    for (const jid of dots) if (jid) shiftJunction(jid, k, d.jv, d.v);
    d.jv = d.v;
  }

  /**
   * Moves a junction dot along `k` from `from` to `to`, and the other wires leaving it with it: the
   * bend points they have on the dot's old line move too, so those wires stay straight.
   */
  function shiftJunction(jid: string, k: 'x' | 'y', from: number, to: number) {
    setNodes((ns) =>
      ns.map((x) => (x.id === jid ? { ...x, position: { ...x.position, [k]: to - JR } } : x)),
    );
    setEdges((es) =>
      es.map((x) => {
        if (x.id === id || (x.source !== jid && x.target !== jid)) return x;
        const pts = ((x.data as { points?: Pt[] } | undefined)?.points ?? []).map((p) => ({ ...p }));
        const on = (p: Pt) => Math.abs(p[k] - from) < 0.5;
        if (x.source === jid) for (let i = 0; i < pts.length && on(pts[i]); i++) pts[i][k] = to;
        if (x.target === jid) for (let i = pts.length - 1; i >= 0 && on(pts[i]); i--) pts[i][k] = to;
        return { ...x, data: { ...x.data, points: pts } };
      }),
    );
  }

  // a free pin's wire starts on the pin itself, so the hit area starts one handle away from it to keep the pin clickable
  const hit = verts.slice(1, -1).map((v) => v.p);
  const back = (a: Pt, b?: Pt) => {
    const d = b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
    return d > PIN * 2 ? { x: a.x + ((b!.x - a.x) / d) * PIN, y: a.y + ((b!.y - a.y) / d) * PIN } : a;
  };
  if (fS && !cS) hit[0] = back(hit[0], hit[1]);
  if (fT && !cT) hit[hit.length - 1] = back(hit[hit.length - 1], hit[hit.length - 2]);

  return (
    <>
      <BaseEdge
        path={path}
        style={style}
        interactionWidth={0}
      />
      {/* Wires sit above components, so the hit area stops at the stub ends: pins stay clickable to start a new wire */}
      <path
        d={roundedPath(hit, RADIUS)}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onContextMenu={(ev) => openWireMenu(ev)}
      />
      {/* the pin dots are drawn again here so they sit on top of the wire, not under it */}
      {[pinS, pinT].map((c, i) => c && <circle key={i} cx={c.x} cy={c.y} r={PIN / 2} fill="#f5b700" stroke="#333" strokeWidth={1} pointerEvents="none" />)}
      {selected &&
        !ortho &&
        corners.map((p, i) => (
          <g key={i} className="bendwrap nodrag nopan" style={wireVar}>
            <circle cx={p.x} cy={p.y} r={5} className="bend" />
            <circle
              cx={p.x}
              cy={p.y}
              r={12}
              className="bendhit"
              fill="transparent"
              onPointerDown={(ev) => {
                ev.stopPropagation();
                ev.currentTarget.setPointerCapture(ev.pointerId);
              }}
              onPointerMove={(ev) => dragPoint(i, ev)}
              onPointerUp={(ev) => ev.currentTarget.releasePointerCapture(ev.pointerId)}
              onContextMenu={(ev) => openWireMenu(ev, i)}
            />
          </g>
        ))}
      {selected &&
        segs.map(({ k, o, cx, cy }) => {
          return (
            <g key={k} className="bendwrap nodrag nopan" style={wireVar}>
              <rect
                x={cx - (o === 'h' ? 9 : 3)}
                y={cy - (o === 'h' ? 3 : 9)}
                width={o === 'h' ? 18 : 6}
                height={o === 'h' ? 6 : 18}
                rx={3}
                className="bend"
              />
              <circle
                cx={cx}
                cy={cy}
                r={12}
                className={`bendhit ${o}`}
                fill="transparent"
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  ev.currentTarget.setPointerCapture(ev.pointerId);
                  const run = runList[k];
                  dragRef.current = { P, run, idx: k, v: P[run.a][key(run.o)], at: { x: cx, y: cy }, jv: P[run.a][key(run.o)] };
                  setPoints(P.slice(1, -1)); // freeze generated corners so the shape can be edited
                }}
                onPointerMove={dragRun}
                onPointerUp={(ev) => {
                  ev.currentTarget.releasePointerCapture(ev.pointerId);
                  dragRef.current = null;
                  setData({}); // re-render so every handle is shown again
                }}
                onContextMenu={(ev) => openWireMenu(ev)}
              />
            </g>
          );
        })}
    </>
  );
}
