import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Background,
  ConnectionMode,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Lock, LockOpen, Maximize, Merge, Move, Pencil, RotateCcw, RotateCw, Tag, Trash2 } from 'lucide-react';
import { Home } from '@/features/home/Home';
import { serialize } from '@/features/projects/model';
import { useWorkspaceStore } from '@/features/projects/useWorkspaceStore';
import { Actions } from '@/features/workspace/context/actions';
import { Comps } from '@/features/workspace/context/comps';
import { WireEdge } from '@/features/workspace/edges/WireEdge';
import { connectPins } from '@/features/workspace/lib/connect';
import { toCsv, wireRows } from '@/features/workspace/lib/csv';
import { diagramBounds, download, exportPng } from '@/features/workspace/lib/export';
import { degrees, mergeAt, normalizeJunctions } from '@/features/workspace/lib/junction';
import { layerMenu, moveWithin, type Op } from '@/features/workspace/lib/layers';
import { BUILTINS } from '@/features/workspace/lib/library';
import { ContextMenu } from '@/features/workspace/menu/ContextMenu';
import { MenuCtx, type MenuState } from '@/features/workspace/menu/menu';
import { ComponentNode } from '@/features/workspace/nodes/ComponentNode';
import { JunctionNode } from '@/features/workspace/nodes/JunctionNode';
import { ProjectTitle } from '@/features/workspace/ProjectTitle';
import { Sidebar } from '@/features/workspace/Sidebar';
import { Button, Group, Modal, Text } from '@mantine/core';
import { PromptModal, type Ask } from '@/features/workspace/PromptModal';
import { Toolbar, WIRE_COLORS } from '@/features/workspace/Toolbar';
import { compSize, rotPt, snapByPin } from '@/shared/lib/geometry';

const GRID = 5; // components snap to this grid by their pin 1
const nodeTypes = { comp: ComponentNode, junction: JunctionNode };
const edgeTypes = { wire: WireEdge };

/**
 * Composition root: owns the canvas state (react-flow nodes / edges) and ties the features together. Which page shows
 * (home or a project) comes from the address bar; project list and saving live in useWorkspaceStore.
 */
function Shell() {
  const { screenToFlowPosition, fitBounds } = useReactFlow();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [wireColor, setWireColor] = useState(WIRE_COLORS[0]);
  const [orthoDefault, setOrthoDefault] = useState(true);
  const [locked, setLocked] = useState(false); // canvas lock: no moving, connecting or selecting
  const [ask, setAsk] = useState<Ask | null>(null); // the one-line text dialog (rename, value)
  const views = useRef(new Map<string, Viewport>()); // pan / zoom per project, kept while the page stays open

  const { customs, setCustoms, activeId, active, ready, route, go, synced, newProject, deleteProject, renameProject, importProject, notice, setNotice, usedIds } =
    useWorkspaceStore(nodes, edges, setNodes, setEdges);
  const fileBase = (active?.name || 'tinker-part').replace(/[\\/:*?"<>|]/g, '_'); // export files are named after the project

  const comps = useMemo(() => new Map([...BUILTINS, ...customs].map((c) => [c.id, c])), [customs]);
  const selected = edges.filter((e) => e.selected);

  // a junction that lost a wire is merged away (see junction.ts); this runs after every deletion path
  const prevDeg = useRef(new Map<string, number>());
  useEffect(() => {
    const r = normalizeJunctions(nodes, edges, prevDeg.current);
    prevDeg.current = degrees(r.nodes, r.edges);
    if (r.changed) {
      setNodes(r.nodes);
      setEdges(r.edges);
    }
  }, [nodes, edges, setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => {
      const r = connectPins(c, nodes, edges, comps, { color: wireColor, ortho: orthoDefault });
      if (!r) return;
      if (r.newNodes.length) setNodes((ns) => [...ns, ...r.newNodes]);
      setEdges(r.edges);
    },
    [nodes, edges, comps, setNodes, setEdges, wireColor, orthoDefault],
  );

  // Layers, top to bottom: junction dots (5000), wires (1000 + their order), the component being dragged (999),
  // components (their order). Order = position in the list, which is what "place order" and drag change.
  const shownNodes = useMemo(() => {
    let rank = 0;
    return nodes.map((n) => {
      if (n.type === 'junction') return { ...n, zIndex: 5000, draggable: false };
      return { ...n, zIndex: n.dragging ? 999 : rank++ };
    });
  }, [nodes]);
  // wires ask for a re-stack through here (see context/actions.ts for why they cannot do it themselves)
  const actions = useMemo(() => ({ moveEdge: (id: string, op: Op) => setEdges((es) => moveWithin(es, id, op, () => true)) }), [setEdges]);
  // wires are drawn above every component (react-flow puts edges under nodes by default)
  const shownEdges = useMemo(() => edges.map((e, i) => ({ ...e, zIndex: 1000 + i })), [edges]);
  const patchData = (d: Record<string, unknown>) =>
    setEdges((es) => es.map((e) => (e.selected ? { ...e, data: { ...e.data, ...d } } : e)));
  const ortho = Boolean((selected[0]?.data as { ortho?: boolean } | undefined)?.ortho ?? (selected.length ? false : orthoDefault));
  const patchSelected = (patch: Partial<Edge>, style?: Edge['style']) =>
    setEdges((es) => es.map((e) => (e.selected ? { ...e, ...patch, style: { ...e.style, ...style } } : e)));

  // A component snaps to the grid by its first pin (pin 1), so the wires that start there sit on grid lines.
  const snapComp = (componentId: string, rot: number, pos: { x: number; y: number }) => {
    const c = comps.get(componentId);
    const p = c?.pins[0];
    if (!c || !p) return snapByPin(pos, { x: 0, y: 0 }, GRID);
    const [px, py] = rotPt(p.x, p.y, rot);
    const size = compSize(c, rot);
    return snapByPin(pos, { x: px * size.w, y: py * size.h }, GRID);
  };
  const onNodesChangeSnapped = (changes: NodeChange[]) =>
    onNodesChange(
      changes.map((ch) => {
        if (ch.type !== 'position' || !ch.position) return ch;
        const n = nodes.find((x) => x.id === ch.id);
        if (n?.type !== 'comp') return ch;
        const d = n.data as { componentId: string; rot?: number };
        return { ...ch, position: snapComp(d.componentId, d.rot ?? 0, ch.position) };
      }),
    );

  const onDrop = (e: DragEvent) => {
    const componentId = e.dataTransfer.getData('application/x-comp');
    const c = comps.get(componentId);
    if (!c) return;
    const position = snapComp(componentId, 0, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    setNodes((ns) => {
      const used = new Set(ns.map((n) => (n.data as { label: string }).label));
      let i = 1;
      while (used.has(`${c.name} ${i}`)) i++;
      return [...ns, { id: crypto.randomUUID(), type: 'comp', position, data: { componentId, label: `${c.name} ${i}` } }];
    });
  };

  const rotate = useCallback(
    (ids: string[], by: number) => {
      setNodes((ns) =>
        ns.map((n) => {
          const d = n.data as { componentId: string; rot?: number };
          const c = comps.get(d.componentId);
          if (!ids.includes(n.id) || !c) return n;
          const rot = ((((d.rot ?? 0) + by) % 360) + 360) % 360;
          const a = compSize(c, d.rot ?? 0);
          const b = compSize(c, rot);
          // turn around the centre, not the top-left corner
          const position = snapComp(d.componentId, rot, { x: n.position.x + (a.w - b.w) / 2, y: n.position.y + (a.h - b.h) / 2 });
          return { ...n, position, data: { ...d, rot } };
        }),
      );
      // pins moved: old bend points no longer make sense, back to the default wire shape
      setEdges((es) =>
        es.map((e) =>
          ids.includes(e.source) || ids.includes(e.target)
            ? {
                ...e,
                data: {
                  ...e.data,
                  points: [],
                  ...(ids.includes(e.source) ? { jS: undefined } : {}),
                  ...(ids.includes(e.target) ? { jT: undefined } : {}),
                },
              }
            : e,
        ),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comps, setNodes, setEdges],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
      const ids = nodes.filter((n) => n.selected && n.type === 'comp').map((n) => n.id);
      if (ids.length) rotate(ids, e.shiftKey ? -90 : 90);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodes, rotate]);

  const nodeMenu = (ev: ReactMouseEvent, n: Node) => {
    ev.preventDefault();
    setNodes((ns) => ns.map((x) => ({ ...x, selected: x.id === n.id })));
    const rename = (what: string) => () => {
      setAsk({
        title: `Rename ${what.toLowerCase()}`,
        label: 'Name',
        initial: String((n.data as { label: string }).label),
        onSubmit: (v) => v && setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, data: { ...x.data, label: v } } : x))),
      });
    };
    const remove = () => {
      setNodes((ns) => ns.filter((x) => x.id !== n.id));
      setEdges((es) => es.filter((x) => x.source !== n.id && x.target !== n.id));
    };
    if (n.type === 'junction') {
      const mine = edges.filter((x) => x.source === n.id || x.target === n.id);
      setMenu({
        x: ev.clientX,
        y: ev.clientY,
        items: [
          {
            icon: <Merge size={14} />,
            label: 'Merge wires',
            disabled: mine.length !== 2,
            onClick: () => {
              const r = mergeAt(n.id, nodes, edges);
              setNodes(r.nodes);
              setEdges(r.edges);
            },
          },
          { icon: <Pencil size={14} />, label: 'Rename', onClick: rename('Junction') },
          { icon: <Trash2 size={14} />, label: 'Delete junction', danger: true, onClick: remove },
        ],
      });
      return;
    }
    setMenu({
      x: ev.clientX,
      y: ev.clientY,
      items: [
        { icon: <RotateCw size={14} />, label: 'Rotate right 90° (R)', onClick: () => rotate([n.id], 90) },
        { icon: <RotateCcw size={14} />, label: 'Rotate left 90° (Shift+R)', onClick: () => rotate([n.id], -90) },
        layerMenu((op) => setNodes((ns) => moveWithin(ns, n.id, op, (x) => x.type === 'comp'))), // among components only
        { icon: <Pencil size={14} />, label: 'Rename', onClick: rename('Component') },
        {
          icon: <Tag size={14} />,
          label: 'Set value',
          onClick: () => {
            setAsk({
              title: 'Set value',
              label: 'Value (leave empty to remove)',
              placeholder: 'e.g. 10kΩ',
              initial: (n.data as { value?: string }).value ?? '',
              onSubmit: (v) => setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, data: { ...x.data, value: v || undefined } } : x))),
            });
          },
        },
        {
          icon: <RotateCw size={14} />,
          label: 'Rotate label',
          onClick: () =>
            setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, data: { ...x.data, labelRot: (((x.data as { labelRot?: number }).labelRot ?? 0) + 90) % 360 } } : x))),
        },
        {
          icon: <Move size={14} />,
          label: 'Move label',
          onClick: () => setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, data: { ...x.data, movingLabel: true } } : x))),
        },
        { icon: <Trash2 size={14} />, label: 'Delete component', danger: true, onClick: remove },
      ],
    });
  };

  const fit = useCallback(() => {
    if (nodes.length) fitBounds(diagramBounds(nodes, edges), { padding: 0.05 });
  }, [nodes, edges, fitBounds]);

  const inWorkspace = ready && route.kind === 'project' && route.id === activeId;

  return (
    <Comps.Provider value={comps}>
      <MenuCtx.Provider value={setMenu}>
        <Actions.Provider value={actions}>
          {route.kind === 'home' ? (
            ready && (
              <Home
                projects={synced().map((p) => ({
                  id: p.id,
                  name: p.name,
                  components: p.nodes.filter((n) => n.type === 'comp').length,
                  wires: p.edges.length,
                }))}
                onOpen={(id) => go({ kind: 'project', id })}
                onNew={() => newProject()}
                onRename={renameProject}
                onDelete={deleteProject}
                onImport={(f) => void importProject(f)}
              />
            )
          ) : (
            inWorkspace && (
              <div className="workspace">
                <Toolbar
                  onHome={() => go({ kind: 'home' })}
                  color={String(selected[0]?.style?.stroke ?? wireColor)}
                  onColor={(c) => {
                    setWireColor(c);
                    patchSelected({}, { stroke: c });
                  }}
                  ortho={ortho}
                  onOrtho={(on) => {
                    setOrthoDefault(on);
                    patchData({ ortho: on });
                  }}
                  onExportProject={() =>
                    download(`${fileBase}.json`, JSON.stringify(serialize(customs, nodes, edges, active?.name)), 'application/json')
                  }
                  onExportPng={() => exportPng(diagramBounds(nodes, edges), fileBase)}
                  onExportCsv={() => download(`${fileBase}.csv`, toCsv(wireRows(nodes, edges, comps)), 'text/csv')}
                  canExportPng={nodes.length > 0}
                  canExportCsv={edges.length > 0}
                />
                <Sidebar
                  customs={customs}
                  usedIds={usedIds}
                  onDeleteComponent={(id) => setCustoms((cs) => cs.filter((x) => x.id !== id))}
                />
                <main>
                  <div className="canvas" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
                    <ReactFlow
                      nodes={shownNodes}
                      elevateNodesOnSelect={false}
                      // opens where the project was left, or with the canvas origin in the middle (the size is known here)
                      onInit={(rf) => {
                        const v = views.current.get(activeId);
                        void (v ? rf.setViewport(v) : rf.setCenter(0, 0, { zoom: 1 }));
                      }}
                      onMoveEnd={(_, vp) => views.current.set(activeId, vp)}
                      onNodeContextMenu={nodeMenu}
                      // a component you move ends up on top of the other components (wires stay above all of them)
                      onNodeDragStop={(_, n) => n.type === 'comp' && setNodes((ns) => moveWithin(ns, n.id, 'front', (x) => x.type === 'comp'))}
                      onPaneContextMenu={(e) => e.preventDefault()} // no menu on empty canvas, and not the browser's either
                      edges={shownEdges}
                      nodeTypes={nodeTypes}
                      edgeTypes={edgeTypes}
                      zoomOnDoubleClick={false}
                      onNodesChange={onNodesChangeSnapped}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      connectionMode={ConnectionMode.Loose}
                      nodesDraggable={!locked}
                      nodesConnectable={!locked}
                      elementsSelectable={!locked}
                      minZoom={0.02}
                      maxZoom={4}
                      deleteKeyCode={['Delete', 'Backspace']}
                    >
                      <Background />
                      {/* zoom in, zoom out, fit, lock. The built-in fit button runs react-flow's own fitView (nodes only) first and can
                          overwrite ours, and the built-in lock would sit before our fit button, so both are replaced */}
                      <Controls showFitView={false} showInteractive={false}>
                        <ControlButton className="lucide-ctl" onClick={fit} title="Fit to screen" aria-label="Fit to screen">
                          <Maximize />
                        </ControlButton>
                        <ControlButton
                          className="lucide-ctl"
                          onClick={() => setLocked((l) => !l)}
                          title={locked ? 'Unlock canvas' : 'Lock canvas'}
                          aria-label={locked ? 'Unlock canvas' : 'Lock canvas'}
                        >
                          {locked ? <Lock /> : <LockOpen />}
                        </ControlButton>
                      </Controls>
                    </ReactFlow>
                    <ProjectTitle key={activeId} name={active?.name ?? ''} onRename={(n) => renameProject(activeId, n)} />
                  </div>
                </main>
                {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
              </div>
            )
          )}
          <PromptModal ask={ask} onClose={() => setAsk(null)} />
          <Modal opened={!!notice} onClose={() => setNotice('')} title="Something went wrong" centered size="sm">
            <Text size="sm">{notice}</Text>
            <Group justify="flex-end" mt="md">
              <Button onClick={() => setNotice('')}>OK</Button>
            </Group>
          </Modal>
        </Actions.Provider>
      </MenuCtx.Provider>
    </Comps.Provider>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Shell />
    </ReactFlowProvider>
  );
}
