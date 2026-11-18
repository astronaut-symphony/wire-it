import { useContext, useEffect, useRef, type PointerEvent } from 'react';
import { Comps } from '@/features/workspace/context/comps';
import { Handle, useReactFlow, type NodeProps } from '@xyflow/react';
import { DIR_POS, compSize, pinDir, rotDir, rotPt } from '@/shared/lib/geometry';
import { pinText } from '@/shared/types';
import { svgUrl } from '@/shared/lib/importImage';
import '@/features/workspace/workspace.css';

type Pos = { x: number; y: number };
// the name + value box is anchored by its bottom-left corner, so a value grows it upwards; home = just above the top-left corner
const LABEL_HOME: Pos = { x: 0, y: -2 };

export function ComponentNode({ id, data }: NodeProps) {
  const { componentId, label, value, rot = 0, labelRot = 0, labelPos = LABEL_HOME, movingLabel } = data as {
    componentId: string; label?: string; value?: string; rot?: number; labelRot?: number; labelPos?: Pos; movingLabel?: boolean;
  };
  const { setNodes, screenToFlowPosition } = useReactFlow();
  const drag = useRef<{ from: Pos; start: Pos } | null>(null);
  const patch = (d: Record<string, unknown>) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...d } } : n)));
  // "Move label" from the right-click menu: drag the name, and the mode ends when the drag does or on a click anywhere else
  const capRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!movingLabel) return;
    const off = (e: globalThis.PointerEvent) => !capRef.current?.contains(e.target as Node) && patch({ movingLabel: false });
    window.addEventListener('pointerdown', off, true);
    return () => window.removeEventListener('pointerdown', off, true);
  });
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { from: screenToFlowPosition({ x: e.clientX, y: e.clientY }), start: labelPos };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    patch({ labelPos: { x: Math.round(d.start.x + p.x - d.from.x), y: Math.round(d.start.y + p.y - d.from.y) } });
  };
  const up = () => {
    drag.current = null;
    patch({ movingLabel: false });
  };
  const c = useContext(Comps).get(componentId);
  if (!c) return <div className="missing">component missing: {componentId}</div>;
  const o = compSize(c); // unrotated size of the image
  const r = compSize(c, rot); // size of the node box after rotation
  return (
    <div style={{ width: r.w, height: r.h, position: 'relative' }}>
      <div
        ref={capRef}
        className={`cap${movingLabel ? ' moving nodrag nopan' : ''}`}
        // turns around the bottom-left corner, the anchor
        style={{ left: labelPos.x, bottom: r.h - labelPos.y, transformOrigin: '0 100%', transform: labelRot ? `rotate(${labelRot}deg)` : undefined }}
        {...(movingLabel ? { onPointerDown: down, onPointerMove: move, onPointerUp: up } : {})}
      >
        {label || c.label || c.name}
        {value && <div className="capval">{value}</div>}
      </div>
      <img
        src={svgUrl(c.svg)}
        width={o.w}
        height={o.h}
        draggable={false}
        alt={c.name}
        style={{ position: 'absolute', left: (r.w - o.w) / 2, top: (r.h - o.h) / 2, transform: `rotate(${rot}deg)` }}
      />
      {c.pins.map((p) => {
        const [x, y] = rotPt(p.x, p.y, rot);
        return (
          <Handle
            key={p.id}
            id={p.id}
            type="source"
            position={DIR_POS[rotDir(pinDir(p, c), rot)]}
            title={pinText(p)}
            className="pin"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: 'translate(-50%,-50%)' }}
          />
        );
      })}
    </div>
  );
}
