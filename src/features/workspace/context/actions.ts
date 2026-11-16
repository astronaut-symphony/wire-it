import { createContext } from 'react';
import type { Op } from '@/features/workspace/lib/layers';

/**
 * Things a wire can ask the app to do that need the app's own state. Re-stacking is one: react-flow's
 * setEdges (the one a wire gets from useReactFlow) only applies per-edge changes and keeps the list order,
 * so the order has to be changed on the state that owns the list.
 */
export const Actions = createContext<{ moveEdge: (id: string, op: Op) => void }>({ moveEdge: () => {} });
