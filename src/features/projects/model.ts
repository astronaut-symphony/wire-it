import type { Edge, Node, Viewport } from '@xyflow/react';
import { sanitizeSvg } from '@/shared/lib/importImage';
import type { Component, Project } from '@/shared/types';

/** One diagram. `view` (pan/zoom) only lives in memory, to come back to the same spot when switching tabs. */
export type Proj = { id: string; name: string; nodes: Node[]; edges: Edge[]; view?: Viewport };
/** Everything autosaved: the shared component library plus every open project (tab). */
export type Workspace = { version: 2; components: Component[]; projects: Proj[]; activeId: string };

/** The parts of nodes/edges worth saving (no selection, measurements, drag state). */
export const slim = (nodes: Node[], edges: Edge[]) => ({
  nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
  edges: edges.map(({ id, source, target, sourceHandle, targetHandle, type, label, style, data }) => ({
    id, source, target, sourceHandle, targetHandle, type, label, style, data,
  })),
});

/** The single-project JSON file: one diagram plus the library it uses. */
export const serialize = (components: Component[], nodes: Node[], edges: Edge[], name?: string): Project => ({
  version: 1,
  name,
  components,
  ...slim(nodes, edges),
});

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
