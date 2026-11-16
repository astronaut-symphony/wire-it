import type { Edge, Node } from '@xyflow/react';

export type Dir = 'up' | 'down' | 'left' | 'right';
// x,y: 0..1 of the image box; dir: side the wire leaves the pin (default: nearest image edge)
export type Pin = { id: string; name: string; label?: string; x: number; y: number; dir?: Dir };
/** What a pin is called on screen and in the CSV: number, plus label when it has one. */
export const pinText = (p: Pin) => (p.label ? `${p.name} ${p.label}` : p.name);
export type Component = {
  id: string;
  name: string;
  svg: string;
  w: number; // svg viewBox size, only the aspect matters
  h: number;
  mmW: number; // real-world width in mm
  pins: Pin[];
  builtin?: boolean;
};
export type Project = { version: 1; name?: string; components: Component[]; nodes: Node[]; edges: Edge[] };

export const PIN = 7.2; // size of a component's pin dot, px (kept in step with .pin in styles.css)
export const JR = 7; // half the size of a junction dot node
export const MM = 4; // canvas px per mm; 2.54mm pitch = ~10px
