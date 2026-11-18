import type { Edge, Node } from '@xyflow/react';
import { pinText, type Component } from '@/shared/types';

type Data = { componentId: string; label?: string };

export function wireRows(nodes: Node[], edges: Edge[], comps: Map<string, Component>): string[][] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const end = (id: string, pinId?: string | null) => {
    const node = byId.get(id);
    if (node?.type === 'junction') return String((node.data as { label?: string }).label ?? 'J');
    const d = node?.data as Data | undefined;
    const comp = d && comps.get(d.componentId);
    const pin = comp?.pins.find((p) => p.id === pinId);
    return `${d?.label || comp?.label || comp?.name || '?'}.${pin ? pinText(pin) : '?'}`; // no label: the component's own name
  };
  return [
    ['from', 'to', 'color'],
    ...edges.map((e) => [
      end(e.source, e.sourceHandle),
      end(e.target, e.targetHandle),
      String(e.style?.stroke ?? ''),
    ]),
  ];
}

export const toCsv = (rows: string[][]) =>
  rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
