import { useContext } from 'react';
import { Comps } from '@/features/workspace/context/comps';
import { Handle, type NodeProps } from '@xyflow/react';
import { DIR_POS, compSize, pinDir, rotDir, rotPt } from '@/shared/lib/geometry';
import { pinText } from '@/shared/types';
import { svgUrl } from '@/shared/lib/importImage';
import '@/features/workspace/workspace.css';

export function ComponentNode({ data }: NodeProps) {
  const { componentId, label, rot = 0 } = data as { componentId: string; label: string; rot?: number };
  const c = useContext(Comps).get(componentId);
  if (!c) return <div className="missing">component missing: {componentId}</div>;
  const o = compSize(c); // unrotated size of the image
  const r = compSize(c, rot); // size of the node box after rotation
  return (
    <div style={{ width: r.w, height: r.h, position: 'relative' }}>
      <div className="cap">{label}</div>
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
