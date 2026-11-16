import { BringToFront, Layers, SendToBack } from 'lucide-react';
import type { MenuItem } from '@/features/workspace/menu/menu';

export type Op = 'front' | 'back' | 'up' | 'down';

/** ids bottom -> top; returns the order after moving `id` to the front/back or one step up/down. */
export function moveInOrder(order: string[], id: string, op: Op): string[] {
  const i = order.indexOf(id);
  if (i < 0) return order;
  const rest = order.filter((x) => x !== id);
  const to = op === 'front' ? rest.length : op === 'back' ? 0 : op === 'up' ? Math.min(i + 1, rest.length) : Math.max(i - 1, 0);
  rest.splice(to, 0, id);
  return rest;
}

/**
 * Re-stacks one item among the items that match `same`; everything else keeps its slot. Stacking is array
 * order (later = on top), so this is what "place order" changes. Components only move among components and
 * wires among wires: wires always sit above components.
 */
export function moveWithin<T extends { id: string }>(list: T[], id: string, op: Op, same: (x: T) => boolean): T[] {
  const group = list.filter(same);
  const byId = new Map(group.map((x) => [x.id, x]));
  const order = moveInOrder(group.map((x) => x.id), id, op);
  let k = 0;
  return list.map((x) => (same(x) ? byId.get(order[k++])! : x));
}

export const layerMenu = (move: (op: Op) => void): MenuItem => ({
  icon: <Layers size={14} />,
  label: 'Layer order',
  children: [
    { icon: <BringToFront size={14} />, label: 'Bring to front', onClick: () => move('front') },
    { icon: <SendToBack size={14} />, label: 'Send to back', onClick: () => move('back') },
  ],
});
