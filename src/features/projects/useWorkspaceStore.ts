import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { get, set } from 'idb-keyval';
import { CHANNEL, takeComponents } from '@/shared/lib/inbox';
import { sanitizeSvg } from '@/shared/lib/importImage';
import type { Component } from '@/shared/types';
import { fromLegacy, nextName, parseProject, parseWorkspace, slim, type Proj, type Workspace } from './model';
import { parseRoute, routeHash, type Route } from './route';

const LEGACY_KEY = 'wiring-project'; // single-project autosave from before there were several projects
const KEY = 'tinker-part-workspace';
const OLD_KEY = 'wiring-workspace'; // same format, from before the rename to Tinker part

/**
 * Everything that is saved: the shared component library and the list of projects, plus which page is open.
 * The open project's live nodes and edges belong to the canvas (react-flow state); they are handed in so they
 * can be saved, and swapped out when another project is opened.
 */
export function useWorkspaceStore(nodes: Node[], edges: Edge[], setNodes: (n: Node[]) => void, setEdges: (e: Edge[]) => void) {
  const [customs, setCustoms] = useState<Component[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [activeId, setActiveId] = useState<string>(''); // the project whose nodes / edges are on the canvas ('' = none)
  const [notice, setNotice] = useState(''); // message for the user, shown by the app (e.g. a file that would not open)
  const [ready, setReady] = useState(false); // saved workspace loaded
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const loaded = useRef(false);

  const absorb = useCallback(async () => {
    if (!loaded.current) return; // the saved library would overwrite them; they wait in the inbox until it is loaded
    const ok: Component[] = [];
    for (const c of await takeComponents()) {
      try {
        ok.push({ ...c, svg: sanitizeSvg(c.svg).svg });
      } catch {
        /* a broken svg is skipped rather than blocking the rest */
      }
    }
    if (ok.length) setCustoms((cs) => [...cs, ...ok.filter((c) => !cs.some((x) => x.id === c.id))]);
  }, []);

  const apply = useCallback(
    (ws: Workspace) => {
      setCustoms(ws.components);
      setProjects(ws.projects);
      setActiveId(ws.activeId);
      const a = ws.projects.find((p) => p.id === ws.activeId);
      setNodes(a?.nodes ?? []);
      setEdges(a?.edges ?? []);
    },
    [setNodes, setEdges],
  );

  useEffect(() => {
    (async () => {
      const raw = (await get(KEY)) ?? (await get(OLD_KEY));
      if (raw) return apply(parseWorkspace(raw));
      const old = await get(LEGACY_KEY); // the old single project becomes the first one
      if (old) apply(fromLegacy(parseProject(old)));
    })()
      .catch(() => {}) // corrupt autosave: start empty
      .finally(() => {
        loaded.current = true;
        setReady(true);
        void absorb();
      });
  }, [apply, absorb]);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // components finished in the component-editor tab arrive here (also on focus, in case the ping was missed)
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    const pull = () => void absorb();
    ch.onmessage = pull;
    window.addEventListener('focus', pull);
    return () => {
      ch.close();
      window.removeEventListener('focus', pull);
    };
  }, [absorb]);

  // The open project's live state is in `nodes` / `edges`; its entry in `projects` is only refreshed when switching or saving.
  const synced = () => projects.map((p) => (p.id === activeId ? { ...p, nodes, edges } : p));
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(
      () =>
        set(KEY, {
          version: 2,
          components: customs,
          activeId,
          projects: synced().map((p) => ({ id: p.id, name: p.name, ...slim(p.nodes, p.edges) })),
        }),
      500,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customs, nodes, edges, projects, activeId]);

  const go = (r: Route) => {
    location.hash = routeHash(r);
  };
  // Puts a project on the canvas, first saving the one that was there back into the list.
  function loadProject(id: string): boolean {
    const all = synced();
    const p = all.find((x) => x.id === id);
    if (!p) return false;
    setProjects(all);
    setNodes(p.nodes);
    setEdges(p.edges);
    setActiveId(id);
    return true;
  }
  // the address bar says which project to show (also after a refresh or the back button)
  useEffect(() => {
    if (!ready || route.kind !== 'project' || route.id === activeId) return;
    if (!loadProject(route.id)) go({ kind: 'home' }); // unknown id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, ready]);

  function newProject(name?: string, data?: { nodes: Node[]; edges: Edge[] }) {
    const all = synced();
    const p: Proj = { id: crypto.randomUUID(), name: name ?? nextName(all.map((x) => x.name)), nodes: data?.nodes ?? [], edges: data?.edges ?? [] };
    setProjects([...all, p]);
    go({ kind: 'project', id: p.id });
  }
  function deleteProject(id: string) {
    setProjects((ps) => ps.filter((p) => p.id !== id));
    if (id === activeId) {
      setActiveId('');
      setNodes([]);
      setEdges([]);
    }
  }
  function renameProject(id: string, name: string) {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
  }
  /** A saved JSON file opens as a new project; the components in it join the shared library. */
  async function importProject(f?: File) {
    if (!f) return;
    try {
      const p = parseProject(JSON.parse(await f.text()));
      setCustoms((cs) => [...cs, ...p.components.filter((c) => !cs.some((x) => x.id === c.id))]);
      newProject(p.name ?? f.name.replace(/\.[^.]+$/, ''), { nodes: p.nodes, edges: p.edges });
    } catch (e) {
      setNotice(`Could not open the file: ${(e as Error).message}`);
    }
  }

  // a component is "in use" if any project has it, not only the one on screen
  const usedIds = useMemo(
    () => new Set([...nodes, ...projects.filter((p) => p.id !== activeId).flatMap((p) => p.nodes)].map((n) => (n.data as { componentId?: string }).componentId)),
    [nodes, projects, activeId],
  );

  return {
    customs,
    setCustoms,
    projects,
    activeId,
    active: projects.find((p) => p.id === activeId),
    ready,
    route,
    go,
    synced,
    newProject,
    deleteProject,
    renameProject,
    importProject,
    notice,
    setNotice,
    usedIds,
  };
}
