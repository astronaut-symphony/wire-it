import { Fragment, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, GripVertical, ChevronDown, ArrowLeft, ArrowRight, ArrowUp, FlipHorizontal, FlipVertical, ImagePlus, Minus, Move, Plus, RotateCw, Save, Trash2, X } from 'lucide-react';
import { Button, Menu, Text } from '@mantine/core';
import { AppModal } from '@/shared/components/AppModal';
import { PITCHES } from './pitches';
import { ROTATE, groupPins, mirror, mirrorDir, snapOrigin, type Group, type GroupDir } from './pins';
import { importImage, rotateImage, svgUrl, type Imported } from '@/shared/lib/importImage';
import { autoDir, rotDir } from '@/shared/lib/geometry';
import { sendComponent, takeDraft } from '@/shared/lib/inbox';
import { readWorkspace } from '@/features/projects/useWorkspaceStore';
import type { Component, Dir, PinDir } from '@/shared/types';
import './component-editor.css';

const BASE_W = 720; // image width on screen at 100% zoom, px
// icons, not arrow characters: those draw at different sizes for horizontal and vertical
const DIRS: [PinDir, string, ReactNode][] = [
  ['up', 'Up', <ArrowUp size={14} />],
  ['down', 'Down', <ArrowDown size={14} />],
  ['left', 'Left', <ArrowLeft size={14} />],
  ['right', 'Right', <ArrowRight size={14} />],
  ['free', 'Free', <Move size={14} />],
];
const ANGLE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };
const GROUP_DIRS: [GroupDir, string, ReactNode][] = [
  ['right', 'Right', <ArrowRight size={14} />],
  ['down', 'Down', <ArrowDown size={14} />],
  ['left', 'Left', <ArrowLeft size={14} />],
  ['up', 'Up', <ArrowUp size={14} />],
];
type Pt = { x: number; y: number };
// per-pin edits, keyed `${groupId}:${k}`; `id` is the pin's hidden id in the saved component ("p3"). It is given when the
// pin is added and never changes or gets reused, so wires on the canvas stay on their pin even when the numbers shift
type Ovr = { label?: string; dir?: PinDir; id?: string };
const pinNo = (id?: string) => {
  const m = /^p(\d+)$/.exec(id ?? '');
  return m ? Number(m[1]) : undefined;
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Component editor, opened in its own tab. The image stays the same size on screen; its real width in mm
 * (the scale) is what you adjust. Pin groups have a real pitch, so a wider image makes them look smaller
 * on it. Each group's first pin stays where it is on the image.
 */
export function ComponentEditor({ id }: { id: string }) { // id 'new' starts from the draft; any other id edits that component
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [nextNo, setNextNo] = useState(1); // the id number the next new pin gets
  const [img, setImg] = useState<Imported | null>(null);
  const [err, setErr] = useState('');
  const [imgW, setImgW] = useState(60); // real width of the image in mm = the scale
  const [groups, setGroups] = useState<Group[]>([]);
  const [ovr, setOvr] = useState<Record<string, Ovr>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState('');
  const [folded, setFolded] = useState<Set<string>>(new Set()); // sidebar headers that are collapsed
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null); // matched coordinates while snapping
  const [widthText, setWidthText] = useState<string | null>(null); // what is being typed in the scale field
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const anchor = useRef<{ fx: number; fy: number; ox: number; oy: number } | null>(null);
  const compId = useRef(id === 'new' ? crypto.randomUUID() : id);
  const ver = useRef<number | undefined>(undefined); // the version in the library; none yet for a brand new component
  zoomRef.current = zoom;
  const boxW = BASE_W * zoom; // image size on screen now
  const aspect = img ? img.h / img.w : 1;
  const boxH = boxW * aspect;
  const sg = groups.find((g) => g.id === sel);

  useEffect(() => {
    const edit = name.trim() ? `Edit ${name.trim()}` : 'Edit component';
    document.title = `Wire it | ${id === 'new' ? 'New component' : edit}`;
  }, [id, name]);

  useEffect(() => {
    if (id === 'new') {
      void takeDraft().then((d) => {
        if (!d) return;
        setName(d.name);
        setImg(d.img);
      });
      return;
    }
    void readWorkspace().then((ws) => {
      const c = ws?.components.find((x) => x.id === id);
      if (!c) return setErr('Component not found. It may have been deleted.');
      setName(c.name);
      setLabel(c.label ?? '');
      ver.current = c.version ?? 1;
      setImg({ svg: c.svg, w: c.w, h: c.h });
      setImgW(c.mmW);
      // made before editing existed: the pin groups are gone, so every pin becomes a group of its own
      const gs: Group[] = c.editor?.groups ?? c.pins.map((p, i) => ({ id: `g${i}`, pitch: 2.54, count: 1, rows: 1, dir: 'right', origin: { x: p.x, y: p.y }, skip: [] }));
      const base: Record<string, Ovr> = c.editor?.ovr ?? Object.fromEntries(c.pins.map((p, i) => [`g${i}:0`, { label: p.label, dir: p.dir }]));
      // the pins come out of the groups in the order they were saved: each keeps the id it already has on the canvas
      const keys = gs.flatMap((g) => groupPins(g, c.mmW, c.h / c.w).map((p) => `${g.id}:${p.k}`));
      let next = c.editor?.next ?? Math.max(0, ...c.pins.map((p) => pinNo(p.id) ?? 0)) + 1;
      setGroups(gs);
      setOvr(Object.fromEntries(keys.map((k, i) => [k, { ...base[k], id: c.pins[i]?.id ?? `p${next++}` }])));
      setNextNo(next);
    });
  }, [id]);

  async function onFile(f?: File) {
    if (!f) return;
    try {
      setImg(await importImage(f));
      setErr('');
      setSaved(false);
      if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
    } catch {
      setErr('Could not read the image. Use PNG, JPG, WebP, GIF, BMP or SVG.');
    }
  }

  // zoom keeps the point under the cursor (or the view centre) where it is
  function zoomTo(nz: number, cx?: number, cy?: number) {
    const v = viewRef.current;
    const s = boxRef.current;
    if (v && s) {
      const vr = v.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      const px = cx ?? vr.left + vr.width / 2;
      const py = cy ?? vr.top + vr.height / 2;
      anchor.current = { fx: (px - sr.left) / sr.width, fy: (py - sr.top) / sr.height, ox: px - vr.left, oy: py - vr.top };
    }
    setZoom(Math.min(8, Math.max(0.5, nz)));
  }
  useLayoutEffect(() => {
    const a = anchor.current;
    const v = viewRef.current;
    const s = boxRef.current;
    anchor.current = null;
    if (a && v && s) {
      v.scrollLeft = s.offsetLeft + a.fx * s.offsetWidth - a.ox;
      v.scrollTop = s.offsetTop + a.fy * s.offsetHeight - a.oy;
    }
  }, [zoom]);
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    // React's onWheel is passive, so Ctrl+wheel needs a native listener to stop the page zooming
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomTo(zoomRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
    };
    v.addEventListener('wheel', onWheel, { passive: false });
    return () => v.removeEventListener('wheel', onWheel);
  }, [img === null]); // the view only exists once an image is loaded

  // every pin of every group, numbered 1..n in order (no gaps: deleting one renumbers the rest). The number is only
  // what is shown and saved as the pin's name; wires on the canvas hold on to the hidden id (see Ovr)
  const pins = (img ? groups.flatMap((g) => groupPins(g, imgW, aspect).map((p) => ({ ...p, gid: g.id, key: `${g.id}:${p.k}`, run: g.dir }))) : []).map(
    (p, i) => {
      const o = ovr[p.key];
      const dir = o?.dir ?? autoDir(clamp01(p.x), clamp01(p.y), img!.w, img!.h);
      // the label of a free pin has no wire direction to follow: it goes across the header's run, out of the component
      const across: Dir = p.run === 'right' || p.run === 'left' ? (p.y < 0.5 ? 'up' : 'down') : p.x < 0.5 ? 'left' : 'right';
      return { ...p, id: o?.id ?? p.key, no: i + 1, label: o?.label ?? '', dir, lbl: dir === 'free' ? across : dir };
    },
  );

  const toNorm = (e: { clientX: number; clientY: number }): Pt => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  };
  const edit = (fn: (g: Group) => Group) => sel && (setSaved(false), setGroups((gs) => gs.map((g) => (g.id === sel ? fn(g) : g))));
  const nudge = (dx: number, dy: number) =>
    edit((g) => ({ ...g, origin: { x: clamp01(g.origin.x + dx / boxW), y: clamp01(g.origin.y + dy / boxH) } })); // 1 screen px
  // mouse drag of the selected group: its first pin (the one under the handle) lines up with the other groups' pins, within 6 screen px
  function dragOrigin(p: Pt) {
    if (!sg) return;
    const r = snapOrigin(p, [{ x: 0, y: 0 }], pins.filter((q) => q.gid !== sg.id), 6 / boxW, 6 / boxH);
    setGuides(r.gx === undefined && r.gy === undefined ? null : { x: r.gx, y: r.gy });
    edit((g) => ({ ...g, origin: { x: clamp01(r.o.x), y: clamp01(r.o.y) } }));
  }
  // turns the whole component a quarter turn clockwise: the image, and the pin groups and wire directions with it
  function rotateComponent() {
    if (!img) return;
    setImg(rotateImage(img));
    setImgW(imgW * aspect); // the old height is the new width, in mm
    setGroups((gs) => gs.map((g) => ({ ...g, dir: ROTATE[g.dir], origin: { x: 1 - g.origin.y, y: g.origin.x } })));
    setOvr((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.dir && v.dir !== 'free' ? { ...v, dir: rotDir(v.dir, 90) } : v])));
    setGuides(null);
    setSaved(false);
  }
  // mirrors the selected group and the wire directions set by hand on its pins, so they still point the same way on the image
  const flip = (axis: 'h' | 'v') => {
    edit((g) => mirror(g, axis));
    setOvr((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k.startsWith(`${sel}:`) && v.dir ? { ...v, dir: mirrorDir(v.dir, axis) } : v])));
  };
  const dropGroup = (id: string) => {
    setGroups((gs) => gs.filter((g) => g.id !== id));
    setOvr((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith(`${id}:`))));
    setSel((s) => (s === id ? null : s));
    setSaved(false);
  };
  function dropPin(gid: string, k: number) {
    const g = groups.find((x) => x.id === gid);
    if (!g) return;
    if (g.skip.length + 1 >= g.count * g.rows) return dropGroup(gid);
    setGroups((gs) => gs.map((x) => (x.id === gid ? { ...x, skip: [...x.skip, k] } : x)));
    setSaved(false);
  }
  // one more pin right after the last pin of every row. A slot freed by deleting pins at the end of a row is used again
  // (the new pin does not jump over it); the group only gets longer when a row has no free slot at its end. Pins are keyed
  // by row * count + index, so when the count grows the keys after the first row move along with it.
  function addPin(gid: string) {
    const g = groups.find((x) => x.id === gid);
    if (!g) return;
    const at = Array.from({ length: g.rows }, (_, r) => {
      let last = -1;
      for (let i = 0; i < g.count; i++) if (!g.skip.includes(r * g.count + i)) last = i;
      return last + 1; // index of the new pin in this row
    });
    const count = at.some((i) => i === g.count) ? g.count + 1 : g.count;
    const moved = (k: number) => Math.floor(k / g.count) * count + (k % g.count);
    let skip = g.skip.map(moved);
    const fresh: Record<string, Ovr> = {};
    at.forEach((i, r) => {
      skip = skip.filter((k) => k !== r * count + i); // a freed slot comes back
      fresh[`${gid}:${r * count + i}`] = { id: `p${nextNo + r}` };
      if (count > g.count && i < g.count) skip.push(r * count + g.count); // this row does not need the new column
    });
    setGroups((gs) => gs.map((x) => (x.id === gid ? { ...x, count, skip } : x)));
    setOvr((o) => {
      const out: Record<string, Ovr> = {};
      for (const [key, v] of Object.entries(o)) {
        const [owner, k] = key.split(':');
        out[owner === gid ? `${owner}:${moved(Number(k))}` : key] = v;
      }
      return { ...out, ...fresh };
    });
    setNextNo(nextNo + g.rows);
    setSaved(false);
  }
  // headers can be dragged up or down by their grip; the pin numbers follow the new order
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function moveHeader({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setGroups((gs) => arrayMove(gs, gs.findIndex((g) => g.id === active.id), gs.findIndex((g) => g.id === over.id)));
    setSaved(false);
  }
  const patch = (key: string, p: Ovr) => (setSaved(false), setOvr((o) => ({ ...o, [key]: { ...o[key], ...p } })));

  // Scale: a wider image makes the pins look smaller. Steps are 5% or 0.1 mm; the field takes any value.
  const setW = (w: number) => {
    setImgW(Math.min(1000, Math.max(1, w)));
    setSaved(false);
  };
  const step = (d: number) => setW(Math.round((imgW + d) * 100) / 100);

  const grab = (move: (p: Pt) => void, end?: () => void) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => e.currentTarget.hasPointerCapture(e.pointerId) && move(toNorm(e)),
    onPointerUp: (e: PointerEvent<HTMLElement>) => (e.currentTarget.releasePointerCapture(e.pointerId), end?.()),
    onClick: (e: MouseEvent) => e.stopPropagation(),
  });

  async function save() {
    if (!img || !name.trim() || !pins.length) return;
    const version = (ver.current ?? 0) + 1; // every save of an existing component is a new version
    const comp: Component = {
      version,
      id: compId.current, // same id on a second save: the canvas tab replaces the component instead of adding a copy
      name: name.trim(),
      ...(label.trim() ? { label: label.trim() } : {}),
      svg: img.svg,
      w: img.w,
      h: img.h,
      mmW: imgW,
      pins: pins.map((p) => ({
        id: p.id,
        name: String(p.no),
        ...(p.label ? { label: p.label } : {}),
        x: clamp01(p.x),
        y: clamp01(p.y),
        dir: p.dir,
      })),
      editor: { groups, ovr, next: nextNo },
    };
    try {
      await sendComponent(comp);
      ver.current = version;
      setSaved(true);
      setStatus('Saved to the library. You can close this tab.');
      window.close(); // only works for a tab the canvas opened; otherwise the message above stays
    } catch {
      setStatus('Could not save. Try again.');
    }
  }

  return (
    <div className="cepage">
      <header className="cebar">
        <input className="ceinput name" value={name} placeholder="Component name" aria-label="Component name" onChange={(e) => (setName(e.target.value), setSaved(false))} />
        <input className="ceinput name opt" value={label} placeholder="Add label (optional)" aria-label="Component label" title="Shown on the canvas instead of the name" onChange={(e) => (setLabel(e.target.value), setSaved(false))} />
        <label className="btn">
          <ImagePlus size={14} />
          {img ? 'Replace image' : 'Add image'}
          <input type="file" accept="image/*,.svg" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
        <button className="btn" onClick={rotateComponent} disabled={!img} title="Turn the image and its pins 90° clockwise">
          <RotateCw size={14} /> Rotate component
        </button>
        <button className="btn" onClick={() => setAdding(true)} disabled={!img}>
          <Plus size={14} /> Add pins
        </button>
        {err && <span className="err">{err}</span>}
        <span className="spacer" />
        {status && <span className="hint">{status}</span>}
        <button className="btn primary" disabled={!img || !name.trim() || !pins.length || saved} onClick={() => setConfirming(true)}>
          <Save size={14} /> {saved ? 'Saved' : 'Save component'}
        </button>
      </header>

      <div className="cebody">
        <div className="cemain">
          <div className="cecanvas">
            {!img ? (
              <p className="ceempty">Add the component image first (PNG, JPG, WebP, GIF, BMP or SVG), then add pins.</p>
            ) : (
              <>
                <div className="ceview" ref={viewRef}>
                  <div className="cepad">
                    <div ref={boxRef} className="cestage" style={{ width: boxW, height: boxH }} onClick={() => setSel(null)}>
                      <img src={svgUrl(img.svg)} draggable={false} alt="" style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
                      {pins.map((p) => (
                        <i
                          key={p.key}
                          className={`pdot${p.gid === sel ? ' sel' : ''}`}
                          title={`${p.no}${p.label ? ' ' + p.label : ''}`}
                          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                          onClick={(e) => (e.stopPropagation(), setSel(p.gid))}
                        >
                          {p.dir !== 'free' && <b className="dir" style={{ transform: `rotate(${ANGLE[p.dir]}deg)` }} />}
                          {p.label && <u className={`plbl ${p.lbl}`}>{p.label}</u>}
                        </i>
                      ))}
                      {guides?.x !== undefined && <div className="guide v" style={{ left: `${guides.x * 100}%` }} />}
                      {guides?.y !== undefined && <div className="guide h" style={{ top: `${guides.y * 100}%` }} />}
                      {sg && (
                        <i
                          className="grab"
                          title="Drag to move this pin group"
                          style={{ left: `${sg.origin.x * 100}%`, top: `${sg.origin.y * 100}%` }}
                          {...grab(dragOrigin, () => setGuides(null))}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {img && (
            <>
            <div className="cechip">
              {groups.length === 0
                ? 'Click "Add pins" to place a pin header.'
                : sg
                  ? 'Drag the circle to put pin 1 on a hole, then adjust Image scale until the pin spacing fits.'
                  : 'Click a pin to select its header.'}
            </div>
            <div className="cetools">
              <div className="cegroup">
                <span>Zoom</span>
                <button onClick={() => zoomTo(zoom / 1.25)} title="Zoom out (Ctrl + mouse wheel)"><Minus size={12} /></button>
                <span className="val">{Math.round(zoom * 100)}%</span>
                <button onClick={() => zoomTo(zoom * 1.25)} title="Zoom in (Ctrl + mouse wheel)"><Plus size={12} /></button>
              </div>
              <div className="cegroup">
                <span>Image scale</span>
                <button onClick={() => setW(imgW / 1.05)} title="Image 5% smaller: pins look bigger">−5%</button>
                <button onClick={() => step(-0.1)} title="Image 0.1 mm smaller">−0.1</button>
                <input
                  className="mm"
                  type="number"
                  step="0.01"
                  min="1"
                  max="1000"
                  title="Real width of the image (mm); type a value directly"
                  value={widthText ?? imgW.toFixed(2)}
                  onChange={(e) => {
                    setWidthText(e.target.value);
                    const v = Number(e.target.value);
                    if (v >= 1) setW(v);
                  }}
                  onBlur={() => setWidthText(null)}
                />
                <span>mm</span>
                <button onClick={() => step(0.1)} title="Image 0.1 mm larger">+0.1</button>
                <button onClick={() => setW(imgW * 1.05)} title="Image 5% larger: pins look smaller">+5%</button>
              </div>
              <div className="cegroup">
                <span>Move pins</span>
                <button disabled={!sg} onClick={() => nudge(-1, 0)} title="Move 1px left"><ArrowLeft size={12} /></button>
                <button disabled={!sg} onClick={() => nudge(0, -1)} title="Move 1px up"><ArrowUp size={12} /></button>
                <button disabled={!sg} onClick={() => nudge(0, 1)} title="Move 1px down"><ArrowDown size={12} /></button>
                <button disabled={!sg} onClick={() => nudge(1, 0)} title="Move 1px right"><ArrowRight size={12} /></button>
              </div>
              <div className="cegroup">
                <span>Pin</span>
                <button disabled={!sg} onClick={() => edit((g) => ({ ...g, dir: ROTATE[g.dir] }))} title="Rotate the pin group 90°" aria-label="Rotate pin group"><RotateCw size={14} /></button>
                <button disabled={!sg} onClick={() => flip('h')} title="Mirror horizontally" aria-label="Mirror horizontally"><FlipHorizontal size={14} /></button>
                <button disabled={!sg} onClick={() => flip('v')} title="Mirror vertically" aria-label="Mirror vertically"><FlipVertical size={14} /></button>
                <button className="danger" disabled={!sg} onClick={() => sel && dropGroup(sel)} title="Delete the selected pin group" aria-label="Delete pin group"><Trash2 size={14} /></button>
              </div>
            </div>
            </>
          )}
        </div>

        <aside className="ceside">
          <h3>
            Pins <span className="count">{pins.length}</span>
          </h3>
          <div className="ceside-body">
            {pins.length === 0 ? (
              <p className="hint">Each pin's number, label and wire exit direction show up here.</p>
            ) : (
              <>
                <p className="hint">The orange line on a pin = the direction the wire leaves it. Free = any direction.</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={moveHeader}>
                <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                {groups.map((g, i) => {
                  const gp = pins.filter((p) => p.gid === g.id);
                  if (!gp.length) return null;
                  const open = !folded.has(g.id);
                  return (
                    <SortableSection key={g.id} id={g.id} className={`pgroup${g.id === sel ? ' sel' : ''}`} onClick={() => setSel(g.id)}>
                    {(grip) => (<>
                      <div className="pghead">
                        {grip}
                        <span className="pgtitle">
                          <b>Header {i + 1}</b>
                          <span className="hint">{gp.length} pins</span>
                          <button
                            className="add"
                            title={g.rows > 1 ? 'Add a pin at the end of every row' : 'Add a pin at the end'}
                            aria-label={`Add a pin to Header ${i + 1}`}
                            onClick={(e) => (e.stopPropagation(), addPin(g.id))}
                          >
                            <Plus size={14} />
                          </button>
                        </span>
                        <DirSelect label="Dir." list={gp} onPick={(d) => gp.forEach((p) => patch(p.key, { dir: d }))} />
                        <button
                          className="x"
                          title={open ? 'Collapse' : 'Expand'}
                          aria-expanded={open}
                          onClick={(e) => (e.stopPropagation(), setFolded((f) => (f.delete(g.id) || f.add(g.id), new Set(f))))}
                        >
                          <ChevronDown size={14} style={{ transform: open ? undefined : 'rotate(-90deg)' }} />
                        </button>
                      </div>
                      {open && <div className="phead">
                        <span>Label</span>
                        <span>Dir.</span>
                        <span />
                      </div>}
                      {open &&
                        Array.from({ length: g.rows }, (_, row) => ({ row, list: gp.filter((p) => Math.floor(p.k / g.count) === row) }))
                          .filter((r) => r.list.length)
                          .map(({ row, list }) => (
                            <Fragment key={row}>
                              {g.rows > 1 && (
                                <div className="prhead">
                                  <span>Row {row + 1}</span>
                                  <DirSelect label="Dir." list={list} onPick={(d) => list.forEach((p) => patch(p.key, { dir: d }))} />
                                  <span />
                                </div>
                              )}
                              {list.map((p) => (
                                <div className="prow" key={p.key}>
                                  <input
                                    className="ceinput plabel"
                                    value={p.label}
                                    placeholder="Add label (optional)"
                                    title="Pin label"
                                    onChange={(e) => patch(p.key, { label: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                                      e.preventDefault(); // Enter goes to the next pin's label (in the order shown, across headers)
                                      const all = [...e.currentTarget.closest('.ceside-body')!.querySelectorAll<HTMLInputElement>('input.plabel')];
                                      const next = all[all.indexOf(e.currentTarget) + 1];
                                      next?.focus();
                                      next?.select();
                                    }}
                                  />
                                  <DirPick value={p.dir} title="Wire exit direction" onPick={(d) => patch(p.key, { dir: d })} />
                                  <button className="x" title="Delete this pin (the numbers after it move up)" onClick={(e) => (e.stopPropagation(), dropPin(p.gid, p.k))}><X size={14} /></button>
                                </div>
                              ))}
                            </Fragment>
                          ))}
                    </>)}
                    </SortableSection>
                  );
                })}
                </SortableContext>
                </DndContext>
              </>
            )}
          </div>
        </aside>
      </div>

      <AppModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title="Save component?"
        size="sm"
        footer={
          <>
            <Button variant="default" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              data-autofocus
              onClick={() => {
                setConfirming(false);
                void save();
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Text size="sm">
          <b>{name.trim()}</b> with {pins.length} pins will be {id === 'new' ? 'added to' : 'updated in'} your components.
        </Text>
      </AppModal>

      {adding && (
        <AddPins
          onClose={() => setAdding(false)}
          onAdd={(g) => {
            const id = crypto.randomUUID().slice(0, 8);
            // starts in the middle of the image, selected, ready to be moved into place
            setGroups((gs) => [...gs, { ...g, id, skip: [], origin: { x: 0.5, y: 0.5 } }]);
            // every pin of the group gets its id number now, in order, so it never changes later
            const n = g.count * g.rows;
            setOvr((o) => ({ ...o, ...Object.fromEntries(Array.from({ length: n }, (_, k) => [`${id}:${k}`, { id: `p${nextNo + k}` }])) }));
            setNextNo(nextNo + n);
            setSel(id);
            setSaved(false);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

/** A direction dropdown with icons; value '' (pins that differ) shows "-". */
function DirPick({ value, title, onPick }: { value: PinDir | ''; title: string; onPick: (d: PinDir) => void }) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <button className="ceinput dirpick" title={title}>
          {DIRS.find(([d]) => d === value)?.[2] ?? '-'}
          <ChevronDown size={12} />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        {DIRS.map(([d, name, icon]) => (
          <Menu.Item key={d} leftSection={icon} onClick={() => onPick(d)}>
            {name}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/** Sets one wire direction for a set of pins; shows it when they all agree, else "-". Pins can still be changed one by one. */
function DirSelect({ label, list, onPick }: { label: string; list: { dir: PinDir }[]; onPick: (d: PinDir) => void }) {
  const same = list.every((p) => p.dir === list[0].dir) ? list[0].dir : '';
  // two cells of the header's grid, so the dropdown sits in the same column as the ones in the pin rows
  return (
    <>
      <span className="dirlbl">{label}</span>
      <DirPick value={same} title="Sets the wire exit direction of all these pins; each pin can still be changed below" onPick={onPick} />
    </>
  );
}

/** A pin header card that can be dragged by its grip (passed to `children`) to change the order. */
function SortableSection({ id, className, onClick, children }: { id: string; className: string; onClick: () => void; children: (grip: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const grip = (
    <button className="x grip" title="Drag to move this header up or down" aria-label="Move header" onClick={(e) => e.stopPropagation()} {...attributes} {...listeners}>
      <GripVertical size={14} />
    </button>
  );
  // Translate, not Transform: the card must not be scaled to the height of the one it passes over
  return (
    <section ref={setNodeRef} className={className} style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} onClick={onClick}>
      {children(grip)}
    </section>
  );
}

function AddPins({ onAdd, onClose }: { onAdd: (g: Pick<Group, 'pitch' | 'count' | 'rows' | 'dir'>) => void; onClose: () => void }) {
  const [pitch, setPitch] = useState(2.54);
  const [count, setCount] = useState(8);
  const [rows, setRows] = useState(1);
  const [dir, setDir] = useState<GroupDir>('right');
  const num = (set: (n: number) => void) => (e: { target: { value: string } }) =>
    set(Math.max(1, Math.floor(Number(e.target.value)) || 1));
  return (
    <AppModal
      opened
      onClose={onClose}
      title="Add pins"
      footer={
        <>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onAdd({ pitch, count, rows, dir })}>Add</Button>
        </>
      }
    >
      <div className="addpins">
        <label className="field">
          <span className="flabel">Pin model (pitch)</span>
          <select value={pitch} onChange={(e) => setPitch(Number(e.target.value))}>
            {PITCHES.map((p) => (
              <option key={p.mm} value={p.mm}>
                {p.mm} mm - {p.note}
              </option>
            ))}
          </select>
        </label>
        <div className="frow">
          <label className="field">
            <span className="flabel">Number of pins</span>
            <input type="number" min={1} value={count} onChange={num(setCount)} />
          </label>
          <label className="field">
            <span className="flabel">Rows</span>
            <input type="number" min={1} value={rows} onChange={num(setRows)} />
          </label>
        </div>
        <div className="field">
          <span className="flabel">Direction</span>
          <div className="seg" role="radiogroup" aria-label="Direction">
            {GROUP_DIRS.map(([d, t, icon]) => (
              <button key={d} role="radio" aria-checked={dir === d} className={dir === d ? 'on' : ''} onClick={() => setDir(d)}>
                {icon}
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppModal>
  );
}
