import type { Edge, Node } from '@xyflow/react';
import type { Group } from '@/features/component-editor/pins';

export type Dir = 'up' | 'down' | 'left' | 'right';
/** 'free': the wire may leave the pin in any direction (no straight stub). */
export type PinDir = Dir | 'free';
// x,y: 0..1 of the image box; dir: side the wire leaves the pin (default: nearest image edge)
export type Pin = { id: string; name: string; label?: string; x: number; y: number; dir?: PinDir };
/** What a pin is called on screen and in the CSV: number, plus label when it has one. */
export const pinText = (p: Pin) => (p.label ? `${p.name} ${p.label}` : p.name);
export type Component = {
  id: string;
  name: string;
  label?: string; // optional short name shown on the canvas instead of `name`
  version?: number; // goes up by one each time the component is edited and saved; none = 1
  svg: string;
  w: number; // svg viewBox size, only the aspect matters
  h: number;
  mmW: number; // real-world width in mm
  pins: Pin[];
  builtin?: boolean;
  imported?: boolean; // came from someone else's file; listed apart from the user's own
  editor?: { groups: Group[]; next?: number; ovr: Record<string, { label?: string; dir?: PinDir; id?: string }> }; // the editor's state, so the component can be edited again
};
/** `versions`: the version of each component (by id) that the diagram was last drawn with. */
export type Project = { version: 1; name?: string; components: Component[]; nodes: Node[]; edges: Edge[]; versions?: Record<string, number> };

export const PIN = 7.2; // size of a component's pin dot, px (kept in step with .pin in styles.css)
export const JR = 7; // half the size of a junction dot node
export const LABEL_HOME = { x: 0, y: -10 }; // where a component's name/value box hangs from (its bottom-left corner) until moved: above the 6px selection frame
export const MM = 4; // canvas px per mm; 2.54mm pitch = ~10px
