import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { degrees, normalizeJunctions } from '../workspace/lib/junction';
import { changedComponents, dropDeadWires, fromLegacy, mergeImported, nextName, parseComponents, parseWorkspace, serialize, serializeComponents, slim, uniqueName, usedVersions } from './model';

vi.mock('@/shared/lib/importImage', () => ({ sanitizeSvg: (svg: string) => ({ svg }) })); // the real one needs a browser DOMParser

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

  it('a project file holds only the components it uses, without editor state', () => {
    const c = (id: string) => ({ id, name: id, svg: '', w: 1, h: 1, mmW: 1, pins: [], imported: true, editor: { groups: [], ovr: {} } });
    const p = serialize([c('c'), c('unused')], [node('a')], []);
    expect(p.components).toEqual([{ id: 'c', name: 'c', svg: '', w: 1, h: 1, mmW: 1, pins: [] }]);
  });

  it('an edit keeps wires on pins that still exist and drops the ones on deleted pins', () => {
    const comp = { id: 'c', name: 'c', svg: '', w: 1, h: 1, mmW: 1, pins: [{ id: 'p1', name: '1', x: 0, y: 0 }, { id: 'p3', name: '3', x: 1, y: 1 }] };
    const nodes = [node('a'), { ...node('b'), data: { componentId: 'other' } }];
    const e = (id: string, h1: string, h2: string): Edge => ({ id, source: 'a', sourceHandle: h1, target: 'b', targetHandle: h2 });
    const es = [e('keep', 'p3', 'p9'), e('dead', 'p2', 'p9'), e('other', 'p1', 'p9')];
    expect(dropDeadWires(nodes, es, comp).map((x) => x.id)).toEqual(['keep', 'other']); // p9 is on another component: untouched
    expect(dropDeadWires(nodes, [es[0]], comp)).toEqual([es[0]]);
  });

  it('a project notices components edited since it last saw them, and which wired pins are gone', () => {
    const comp = { id: 'c', name: 'LED', svg: '', w: 1, h: 1, mmW: 1, version: 3, pins: [{ id: 'p1', name: '1', x: 0, y: 0 }] };
    const nodes = [{ ...node('a'), data: { componentId: 'c', label: 'LED 1' } }, { ...node('b'), data: { componentId: 'other' } }];
    const edges: Edge[] = [{ id: 'e', source: 'a', sourceHandle: 'p2', target: 'b', targetHandle: 'x' }];
    expect(usedVersions(nodes, undefined, [comp])).toEqual({ c: 3 }); // never seen: the current version
    expect(usedVersions(nodes, { c: 1 }, [comp])).toEqual({ c: 1 }); // already known: kept
    expect(changedComponents(nodes, edges, { c: 3 }, [comp])).toEqual([]);
    expect(changedComponents(nodes, edges, undefined, [comp])).toEqual([]); // no record, nothing to compare
    expect(changedComponents(nodes, edges, { c: 1 }, [comp])).toEqual([{ id: 'c', name: 'LED', from: 1, to: 3, lost: ['LED 1: pin 2'] }]);
  });

  it('wires removed with a deleted pin leave no stray junction behind', () => {
    const comp = { id: 'c', name: 'c', svg: '', w: 1, h: 1, mmW: 1, pins: [{ id: 'p1', name: '1', x: 0, y: 0 }] };
    const j: Node = { id: 'j', type: 'junction', position: { x: 0, y: 0 }, data: { label: 'J1' } };
    const wire = (id: string, source: string, sh: string, target: string, th: string): Edge => ({ id, source, sourceHandle: sh, target, targetHandle: th });
    const run = (nodes: Node[], edges: Edge[]) => {
      const alive = dropDeadWires(nodes, edges, comp);
      return normalizeJunctions(nodes, alive, degrees(nodes, edges)); // what the canvas does after any wire goes
    };
    const other = { ...node('b'), data: { componentId: 'other' } };
    // three wires meet at the junction, one of them on the deleted pin 2: the other two become a single wire
    const three = run([node('a'), other, j], [wire('e1', 'a', 'p2', 'j', 'j'), wire('e2', 'j', 'j', 'b', 'h1'), wire('e3', 'j', 'j', 'b', 'h2')]);
    expect(three.nodes.some((n) => n.type === 'junction')).toBe(false);
    expect(three.edges).toHaveLength(1);
    // only two wires: the dot and the wire left dangling go as well
    const two = run([node('a'), other, j], [wire('e1', 'a', 'p2', 'j', 'j'), wire('e2', 'j', 'j', 'b', 'h1')]);
    expect(two.nodes.some((n) => n.type === 'junction')).toBe(false);
    expect(two.edges).toHaveLength(0);
  });

  it('slim leaves the label-moving mode out of what is saved', () => {
    const n = { ...node('a'), data: { componentId: 'c', movingLabel: true } };
    expect(slim([n], []).nodes[0].data).toEqual({ componentId: 'c' });
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

  it('a components file round-trips as imported, and bad or foreign data is rejected', () => {
    const c = { id: 'x', name: 'LED', svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', w: 10, h: 10, mmW: 5, pins: [{ id: 'p1', name: '1', x: 0.5, y: 0.5, dir: 'up' as const }] };
    const back = parseComponents(serializeComponents([{ ...c, imported: false }]));
    expect(back[0]).toMatchObject({ id: 'x', name: 'LED', imported: true });
    expect(back[0].pins[0]).toMatchObject({ id: 'p1', dir: 'up' });
    const file = (x: object) => ({ app: 'wire-it', version: 1, components: [x] });
    expect(parseComponents(file({ ...c, builtin: true }))[0].builtin).toBeUndefined(); // unknown fields are dropped
    const by = parseComponents(file({ ...c, author: '  Ana ', description: 'x'.repeat(900) }))[0];
    expect([by.author, by.description?.length]).toEqual(['Ana', 500]); // kept, trimmed and capped
    expect(parseComponents(file({ ...c, author: 5, description: '  ' }))[0]).not.toHaveProperty('author');
    const m = mergeImported([back[0]], [...back, { ...back[0], id: 'y' }, { ...back[0], id: 'builtin-uno' }]);
    expect([m.added, m.skipped, m.next.length]).toEqual([1, 2, 2]); // same id and built-in ids are skipped
    expect(() => parseComponents({ version: 1, components: [] })).toThrow();
    expect(() => parseComponents(file({ ...c, mmW: 0 }))).toThrow();
    expect(() => parseComponents(file({ ...c, pins: [{ id: 'p', name: '1', x: 'a', y: 0 }] }))).toThrow();
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

  it('uniqueName keeps a free name and numbers a taken one', () => {
    expect(uniqueName(['A'], 'B')).toBe('B');
    expect(uniqueName(['A', 'A (2)'], 'A')).toBe('A (3)');
  });
});
