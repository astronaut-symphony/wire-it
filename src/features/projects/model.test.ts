import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { fromLegacy, nextName, parseWorkspace, serialize, slim } from './model';

const node = (id: string): Node => ({ id, type: 'comp', position: { x: 1, y: 2 }, data: { componentId: 'c', label: id }, selected: true, measured: { width: 5, height: 5 } });
const edge = (id: string): Edge => ({ id, source: 'a', target: 'b', type: 'smoothstep', selected: true });

describe('workspace', () => {
  it('slim keeps what is worth saving and drops selection and measurements', () => {
    const s = slim([node('a')], [edge('e')]);
    expect(s.nodes[0]).toEqual({ id: 'a', type: 'comp', position: { x: 1, y: 2 }, data: { componentId: 'c', label: 'a' } });
    expect(Object.keys(s.edges[0])).not.toContain('selected');
    expect(s.edges[0].id).toBe('e');
  });

  it('serialize carries the project name', () => {
    expect(serialize([], [], [], 'Lampu').name).toBe('Lampu');
    expect(serialize([], [], []).version).toBe(1);
  });

  it('a version-1 autosave becomes the first tab', () => {
    const ws = fromLegacy({ version: 1, components: [], nodes: [node('a')], edges: [] });
    expect(ws.projects).toHaveLength(1);
    expect(ws.projects[0].name).toBe('Untitled1');
    expect(ws.activeId).toBe(ws.projects[0].id);
    expect(ws.projects[0].nodes).toHaveLength(1);
    expect(fromLegacy({ version: 1, name: 'Lama', components: [], nodes: [], edges: [] }).projects[0].name).toBe('Lama');
  });

  it('default names from earlier versions become UntitledN', () => {
    const ws = parseWorkspace({
      version: 2, components: [], activeId: 'a',
      projects: [{ id: 'a', name: 'Proyek 3' }, { id: 'b', name: 'Project 2' }, { id: 'c', name: 'Lampu' }, { id: 'd' }, { id: 'e', name: 'Untitled(5)' }],
    });
    expect(ws.projects.map((p) => p.name)).toEqual(['Untitled3', 'Untitled2', 'Lampu', 'Untitled4', 'Untitled5']);
  });

  it('nextName takes the first free UntitledN', () => {
    expect(nextName([])).toBe('Untitled1');
    expect(nextName(['Untitled1'])).toBe('Untitled2');
    expect(nextName(['Untitled2', 'Lampu'])).toBe('Untitled3'); // length + 1 = 3 is free
    expect(nextName(['Untitled2', 'Untitled3'])).toBe('Untitled4');
  });

  it('an empty workspace is valid: no projects, no active one', () => {
    const ws = parseWorkspace({ version: 2, components: [], projects: [], activeId: 'x' });
    expect(ws.projects).toEqual([]);
    expect(ws.activeId).toBe('');
  });

  it('parseWorkspace rejects other formats and falls back to the first tab when the active id is unknown', () => {
    expect(() => parseWorkspace({ version: 1 })).toThrow();
    expect(() => parseWorkspace({ version: 2, components: [] })).toThrow();
    const ws = parseWorkspace({
      version: 2, components: [], activeId: 'gone',
      projects: [{ id: 'p1', name: 'A', nodes: [], edges: [edge('e')] }, { id: 'p2', name: 'B' }],
    });
    expect(ws.activeId).toBe('p1');
    expect(ws.projects[1]).toMatchObject({ name: 'B', nodes: [], edges: [] });
    expect(ws.projects[0].edges[0].type).toBe('wire'); // old edge types are converted
    expect((ws.projects[0].edges[0].data as { points: unknown }).points).toEqual([]);
  });
});
