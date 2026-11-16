import { Handle, Position, useEdges, type NodeProps } from '@xyflow/react';
import '@/features/workspace/workspace.css';

/**
 * A branch point on a wire: a small dot in the colour of the wires meeting here. Drag from it to start a
 * wire, drop a wire on it to end one here. It moves when the wire leaving it sideways is dragged
 * (see WireEdge). The handle is bigger than the dot so it is easy to grab.
 */
export function JunctionNode({ id, data }: NodeProps) {
  const edges = useEdges();
  const color = String(edges.find((e) => e.source === id || e.target === id)?.style?.stroke ?? '#111');
  return (
    <div className="jnode" title={String((data as { label?: string }).label ?? '')}>
      <Handle
        id="j"
        type="source"
        position={Position.Top}
        className="jhandle"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
      />
      <i className="jcore" style={{ background: color }} />
    </div>
  );
}
