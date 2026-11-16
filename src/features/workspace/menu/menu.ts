import { createContext, type ReactNode } from 'react';

// Kept apart from ContextMenu.tsx on purpose: a context created in a file that also holds a component can be
// re-created by hot reload, leaving the wires holding an old copy that nothing listens to.

/** An item with `children` opens a submenu to its right while hovered (to its left near the screen edge). */
export type MenuItem = { icon?: ReactNode; label: string; onClick?: () => void; disabled?: boolean; danger?: boolean; children?: MenuItem[] };
export type MenuState = { x: number; y: number; items: MenuItem[] };

/** Anything on the canvas (nodes, wires, pane) opens the one shared menu through this. */
export const MenuCtx = createContext<(m: MenuState | null) => void>(() => {});
