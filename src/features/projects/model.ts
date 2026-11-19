import type { Edge, Node, Viewport } from '@xyflow/react';
import { sanitizeSvg } from '@/shared/lib/importImage';
import type { Component, Project } from '@/shared/types';

/** One diagram. `view` (pan/zoom) only lives in memory, to come back to the same spot when switching tabs. */
export type Proj = { id: string; name: string; nodes: Node[]; edges: Edge[]; view?: Viewport; versions?: Record<string, number> };
/** Everything autosaved: the shared component library plus every open project (tab). */
export type Workspace = { version: 2; components: Component[]; projects: Proj[]; activeId: string };

/** The parts of nodes/edges worth saving (no selection, measurements, drag state). */
export const slim = (nodes: Node[], edges: Edge[]) => ({
  // movingLabel is a passing mode of the canvas, not part of the diagram
  nodes: nodes.map(({ id, type, position, data: { movingLabel: _m, ...data } }) => ({ id, type, position, data })),
  edges: edges.map(({ id, source, target, sourceHandle, targetHandle, type, label, style, data }) => ({
    id, source, target, sourceHandle, targetHandle, type, label, style, data,
  })),
});

/**
 * After a component is edited: a wire stays on its pin id (wherever the pin moved to), but a wire on a pin
 * that no longer exists goes with it.
 */
export function dropDeadWires(nodes: Node[], edges: Edge[], comp: Component): Edge[] {
  const alive = new Set(comp.pins.map((p) => p.id));
  const mine = new Set(nodes.filter((n) => n.type === 'comp' && (n.data as { componentId?: string }).componentId === comp.id).map((n) => n.id));
  const dead = (node: string, pin?: string | null) => mine.has(node) && !!pin && !alive.has(pin);
  const keep = edges.filter((e) => !dead(e.source, e.sourceHandle) && !dead(e.target, e.targetHandle));
  return keep.length === edges.length ? edges : keep;
}

const version = (c: Component) => c.version ?? 1;

/** The version of each library component the nodes use: the one the project already knew, else the current one. */
export function usedVersions(nodes: Node[], known: Record<string, number> | undefined, comps: Component[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of nodes) {
    const c = comps.find((x) => x.id === (n.data as { componentId?: string }).componentId);
    if (c) out[c.id] = known?.[c.id] ?? version(c);
  }
  return out;
}

export type Change = { id: string; name: string; from: number; to: number; lost: string[] };

/**
 * The components a project uses that were edited since it last saw them (its recorded version is not the library's).
 * `lost` lists the wired pins that no longer exist. Only the version is known about the old component, so a pin that
 * merely moved cannot be told apart: the dialog says wires may shift.
 */
export function changedComponents(nodes: Node[], edges: Edge[], known: Record<string, number> | undefined, comps: Component[]): Change[] {
  return comps.flatMap((c) => {
    const from = known?.[c.id];
    if (from === undefined || from === version(c)) return [];
    const alive = new Set(c.pins.map((p) => p.id));
    const mine = new Map(nodes.filter((n) => (n.data as { componentId?: string }).componentId === c.id).map((n) => [n.id, String((n.data as { label?: string }).label || c.label || c.name)]));
    const lost = edges
      .flatMap((e) => [[e.source, e.sourceHandle], [e.target, e.targetHandle]] as const)
      .filter(([n, h]) => mine.has(n) && h && !alive.has(h))
      .map(([n, h]) => `${mine.get(n)}: pin ${String(h).replace(/^p/, '')}`);
    return [{ id: c.id, name: c.name, from, to: version(c), lost: [...new Set(lost)] }];
  });
}

const cleanVersions = (v: unknown): Record<string, number> | undefined =>
  v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, n]) => Number.isInteger(n))) : undefined;

/** A component as it goes into a file: the definition only (the editor's state and the "imported" mark stay with the owner). */
const portable = ({ imported: _i, editor: _e, ...c }: Component): Component => c;

/** The single-project JSON file: one diagram plus the components it uses (not the whole library). */
export const serialize = (components: Component[], nodes: Node[], edges: Edge[], name?: string, known?: Record<string, number>): Project => {
  const versions = usedVersions(nodes, known, components);
  return { version: 1, name, components: components.filter((c) => c.id in versions).map(portable), versions, ...slim(nodes, edges) };
};

/** The components file: one or more components to share. Versioned so older files stay readable. */
export const serializeComponents = (components: Component[]) => ({
  app: 'tinker-part',
  version: 1,
  components: components.map(portable),
});

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const DIRS = ['up', 'down', 'left', 'right', 'free'];
/** An optional free-text field from a file: kept only when it is a non-empty string, cut to a sane length. */
const text = (k: string, v: unknown, max: number) => (typeof v === 'string' && v.trim() ? { [k]: v.trim().slice(0, max) } : {});

/** A components file from someone else is untrusted: every field is checked and only known fields are kept. */
export function parseComponents(raw: unknown): Component[] {
  const f = raw as { app?: string; version?: number; components?: unknown[] };
  if (f?.app !== 'tinker-part' || f.version !== 1 || !Array.isArray(f.components)) throw new Error('not a Tinker part components file');
  return f.components.map((c) => {
    const x = c as Component;
    if (typeof x?.id !== 'string' || typeof x.name !== 'string' || typeof x.svg !== 'string') throw new Error('a component is incomplete');
    if (!(num(x.w) && num(x.h) && num(x.mmW) && x.w > 0 && x.h > 0 && x.mmW > 0) || !Array.isArray(x.pins)) throw new Error(`"${x.name}" has bad sizes or pins`);
    const pins = x.pins.map((p) => {
      if (typeof p?.id !== 'string' || typeof p.name !== 'string' || !num(p.x) || !num(p.y)) throw new Error(`"${x.name}" has a bad pin`);
      return { id: p.id, name: p.name, label: typeof p.label === 'string' ? p.label : undefined, x: p.x, y: p.y, dir: DIRS.includes(p.dir as string) ? p.dir : undefined };
    });
    return { id: x.id, name: x.name, ...(typeof x.label === 'string' && x.label ? { label: x.label } : {}), ...text('author', x.author, 80), ...text('description', x.description, 500), ...(Number.isInteger(x.version) && x.version! > 0 ? { version: x.version } : {}), svg: sanitizeSvg(x.svg).svg, w: x.w, h: x.h, mmW: x.mmW, pins, imported: true };
  });
}

/** Components from a file join the library, unless the id is taken or belongs to a built-in (those are looked up by id). */
export function mergeImported(have: Component[], list: Component[]) {
  const fresh = list.filter((c) => !c.id.startsWith('builtin-') && !have.some((x) => x.id === c.id));
  return { next: [...have, ...fresh], added: fresh.length, skipped: list.length - fresh.length };
}

/** Default project name: Untitled1, Untitled2 ... the first one not taken yet. */
export function nextName(names: string[]): string {
  let n = names.length + 1;
  while (names.includes(`Untitled${n}`)) n++;
  return `Untitled${n}`;
}

const fixEdges = (es: Edge[]): Edge[] => es.map((e) => ({ ...e, type: 'wire', data: { points: [], ...e.data } })); // older files used smoothstep

export function parseProject(raw: unknown): Project {
  const p = raw as Project;
  if (p?.version !== 1 || ![p.components, p.nodes, p.edges].every(Array.isArray)) throw new Error('unrecognized format');
  // file is untrusted input: re-sanitize embedded svgs
  return {
    ...p,
    components: p.components.map((c) => ({ ...c, svg: sanitizeSvg(c.svg).svg })),
    edges: fixEdges(p.edges),
    versions: cleanVersions(p.versions),
  };
}

export function parseWorkspace(raw: unknown): Workspace {
  const w = raw as Workspace;
  if (w?.version !== 2 || !Array.isArray(w.components) || !Array.isArray(w.projects)) {
    throw new Error('unrecognized format');
  }
  const projects = w.projects.map((p, i) => ({
    id: String(p.id ?? crypto.randomUUID()),
    // default names from earlier versions ("Proyek 2", "Project 2", "Untitled(2)") become "Untitled2"
    name: String(p.name ?? `Untitled${i + 1}`).replace(/^(?:(?:Proyek|Project) (\d+)|Untitled\((\d+)\))$/, (_, a, b) => `Untitled${a ?? b}`),
    nodes: Array.isArray(p.nodes) ? p.nodes : [],
    edges: fixEdges(Array.isArray(p.edges) ? p.edges : []),
    versions: cleanVersions(p.versions),
  }));
  return {
    version: 2,
    components: w.components.map((c) => ({ ...c, svg: sanitizeSvg(c.svg).svg })),
    projects,
    activeId: projects.some((p) => p.id === w.activeId) ? w.activeId : (projects[0]?.id ?? ''),
  };
}

/** The old autosave held one project; it becomes the first tab. */
export function fromLegacy(p: Project): Workspace {
  const id = crypto.randomUUID();
  return { version: 2, components: p.components, projects: [{ id, name: p.name ?? 'Untitled1', nodes: p.nodes, edges: p.edges }], activeId: id };
}
