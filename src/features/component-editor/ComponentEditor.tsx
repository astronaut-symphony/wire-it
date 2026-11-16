import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { PITCHES } from './pitches';
import { ROTATE, groupPins, snapOrigin, type Group, type GroupDir } from './pins';
import { importImage, svgUrl, type Imported } from '@/shared/lib/importImage';
import { autoDir } from '@/shared/lib/geometry';
import { sendComponent, takeDraft } from '@/shared/lib/inbox';
import type { Component, Dir } from '@/shared/types';
import './component-editor.css';

const BASE_W = 720; // image width on screen at 100% zoom, px
const DIRS: [Dir, string][] = [['up', '↑'], ['down', '↓'], ['left', '←'], ['right', '→']];
const ANGLE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };
const GROUP_DIRS: [GroupDir, string][] = [['right', 'right'], ['down', 'down'], ['left', 'left'], ['up', 'up']];
type Pt = { x: number; y: number };
type Ovr = { label?: string; dir?: Dir }; // per-pin edits, keyed `${groupId}:${k}`
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Component editor, opened in its own tab. The image stays the same size on screen; its real width in mm
 * (the scale) is what you adjust. Pin groups have a real pitch, so a wider image makes them look smaller
 * on it. Each group's first pin stays where it is on the image.
 */
export function ComponentEditor() {
  const [name, setName] = useState('');
  const [img, setImg] = useState<Imported | null>(null);
  const [err, setErr] = useState('');
  const [imgW, setImgW] = useState(60); // real width of the image in mm = the scale
  const [groups, setGroups] = useState<Group[]>([]);
  const [ovr, setOvr] = useState<Record<string, Ovr>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [showIds, setShowIds] = useState(true);
  const [snapOn, setSnapOn] = useState(true);
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null); // matched coordinates while snapping
  const [widthText, setWidthText] = useState<string | null>(null); // what is being typed in the scale field
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const anchor = useRef<{ fx: number; fy: number; ox: number; oy: number } | null>(null);
  const compId = useRef(crypto.randomUUID());
  zoomRef.current = zoom;
  const boxW = BASE_W * zoom; // image size on screen now
  const aspect = img ? img.h / img.w : 1;
  const boxH = boxW * aspect;
  const sg = groups.find((g) => g.id === sel);

  useEffect(() => {
    document.title = 'New component';
    void takeDraft().then((d) => {
      if (!d) return;
      setName(d.name);
      setImg(d.img);
    });
  }, []);

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

  // every pin of every group, numbered 1..n in order: deleting one closes the gap automatically
  const pins = (img ? groups.flatMap((g) => groupPins(g, imgW, aspect).map((p) => ({ ...p, gid: g.id, key: `${g.id}:${p.k}`, horiz: g.dir === 'right' || g.dir === 'left' }))) : []).map(
    (p, i) => {
      const o = ovr[p.key];
      return { ...p, no: i + 1, label: o?.label ?? '', dir: o?.dir ?? autoDir(clamp01(p.x), clamp01(p.y), img!.w, img!.h) };
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
    if (!snapOn) return setGuides(null), edit((g) => ({ ...g, origin: p }));
    const r = snapOrigin(p, [{ x: 0, y: 0 }], pins.filter((q) => q.gid !== sg.id), 6 / boxW, 6 / boxH);
    setGuides(r.gx === undefined && r.gy === undefined ? null : { x: r.gx, y: r.gy });
    edit((g) => ({ ...g, origin: { x: clamp01(r.o.x), y: clamp01(r.o.y) } }));
  }
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
  const patch = (key: string, p: Ovr) => (setSaved(false), setOvr((o) => ({ ...o, [key]: { ...o[key], ...p } })));

  // Scale: a wider image makes the pins look smaller. Steps are 5% or 0.01 mm; the field takes any value.
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
    const comp: Component = {
      id: compId.current, // same id on a second save, so the canvas tab never gets two copies
      name: name.trim(),
      svg: img.svg,
      w: img.w,
      h: img.h,
      mmW: imgW,
      pins: pins.map((p) => ({
        id: `p${p.no}`,
        name: String(p.no),
        ...(p.label ? { label: p.label } : {}),
        x: clamp01(p.x),
        y: clamp01(p.y),
        dir: p.dir,
      })),
    };
    try {
      await sendComponent(comp);
      setSaved(true);
      setStatus('Saved to the library. You can close this tab.');
      window.close(); // only works for a tab the canvas opened; otherwise the message above stays
    } catch {
      setStatus('Could not save. Try again.');
    }
  }

  return (
    <div className="cepage">
      <div className="cebar">
        <label>
          Component name <input value={name} onChange={(e) => (setName(e.target.value), setSaved(false))} />
        </label>
        <label className="btn">
          {img ? 'Replace image' : 'Add image'}
          <input type="file" accept="image/*,.svg" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
        <button onClick={() => setAdding(true)} disabled={!img}>
          + Add pins
        </button>
        {err && <span className="err">{err}</span>}
      </div>

      {!img ? (
        <p className="hint">Add the component image first (PNG, JPG, WebP, GIF, BMP or SVG), then add pins.</p>
      ) : (
        <div className="cebody">
          <div className="cemain">
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
                      <b className="dir" style={{ transform: `rotate(${ANGLE[p.dir]}deg)` }} />
                      {showIds && <u className={`pno ${p.horiz ? 'h' : 'v'}`}>{p.no}</u>}
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

            <div className="cetools">
              <div className="cegroup">
                <span>Zoom</span>
                <button onClick={() => zoomTo(zoom / 1.25)} title="Zoom out (Ctrl + mouse wheel)">−</button>
                <span className="val">{Math.round(zoom * 100)}%</span>
                <button onClick={() => zoomTo(zoom * 1.25)} title="Zoom in (Ctrl + mouse wheel)">+</button>
                <label title="Show pin numbers on the image">
                  <input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} /> Pin no.
                </label>
              </div>
              <div className="cegroup">
                <span>Image scale</span>
                <button onClick={() => setW(imgW / 1.05)} title="Image 5% smaller: pins look bigger">−5%</button>
                <button onClick={() => step(-0.01)} title="Image 0.01 mm smaller">−0.01</button>
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
                <button onClick={() => step(0.01)} title="Image 0.01 mm larger">+0.01</button>
                <button onClick={() => setW(imgW * 1.05)} title="Image 5% larger: pins look smaller">+5%</button>
              </div>
              <div className="cegroup">
                <span>Move pins</span>
                <button disabled={!sg} onClick={() => nudge(-1, 0)} title="Move 1px left">←</button>
                <button disabled={!sg} onClick={() => nudge(0, -1)} title="Move 1px up">↑</button>
                <button disabled={!sg} onClick={() => nudge(0, 1)} title="Move 1px down">↓</button>
                <button disabled={!sg} onClick={() => nudge(1, 0)} title="Move 1px right">→</button>
                <label title="While dragging with the mouse, the first pin of the group lines up with existing pins (horizontally or vertically)">
                  <input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} /> Snap to align
                </label>
              </div>
              <div className="cegroup">
                <span>Pin</span>
                <button disabled={!sg} onClick={() => edit((g) => ({ ...g, dir: ROTATE[g.dir] }))} title="Rotate the pin group 90°">↻ Rotate</button>
                <button disabled={!sg} onClick={() => sel && dropGroup(sel)} title="Delete the selected pin group">Delete</button>
              </div>
            </div>
            <p className="hint">
              {groups.length === 0
                ? 'Click "+ Add pins" to place a pin group at its real size.'
                : sg
                  ? 'Pin group selected (blue). Drag the white circle or use the move buttons until the first pin sits on a hole in the image, then adjust Image scale until the pin spacing matches too. The image stays put; the pins change size.'
                  : 'Click a pin to select its group.'}
            </p>
          </div>

          <aside className="ceside">
            <h3>Pin ({pins.length})</h3>
            {pins.length === 0 ? (
              <p className="hint">Each pin's number, label and wire exit direction show up here.</p>
            ) : (
              <>
                <label className="bulk">
                  Wire direction for all pins
                  <select
                    value=""
                    onChange={(e) => {
                      const d = e.target.value as Dir;
                      if (d) pins.forEach((p) => patch(p.key, { dir: d }));
                    }}
                  >
                    <option value="">-</option>
                    {DIRS.map(([d, t]) => (
                      <option key={d} value={d}>{t}</option>
                    ))}
                  </select>
                </label>
                <p className="hint">The orange line on a pin = the direction the wire leaves it.</p>
                <div className="phead">
                  <span>No.</span>
                  <span>Label</span>
                  <span>Dir.</span>
                  <span />
                </div>
                {pins.map((p) => (
                  <div className={`prow${p.gid === sel ? ' sel' : ''}`} key={p.key} onClick={() => setSel(p.gid)}>
                    <span className="no">{p.no}</span>
                    <input value={p.label} placeholder="e.g. VCC" title="Pin label" onChange={(e) => patch(p.key, { label: e.target.value })} />
                    <select value={p.dir} title="Wire exit direction" onChange={(e) => patch(p.key, { dir: e.target.value as Dir })}>
                      {DIRS.map(([d, t]) => (
                        <option key={d} value={d}>{t}</option>
                      ))}
                    </select>
                    <button title="Delete this pin (other numbers adjust)" onClick={(e) => (e.stopPropagation(), dropPin(p.gid, p.k))}>x</button>
                  </div>
                ))}
              </>
            )}
          </aside>
        </div>
      )}

      <div className="cefooter">
        <span className="hint">{status}</span>
        <button className="primary" disabled={!img || !name.trim() || !pins.length || saved} onClick={save}>
          {saved ? 'Saved' : 'Save component'}
        </button>
      </div>

      {adding && (
        <AddPins
          onClose={() => setAdding(false)}
          onAdd={(g) => {
            const id = crypto.randomUUID().slice(0, 8);
            // starts in the middle of the image, selected, ready to be moved into place
            setGroups((gs) => [...gs, { ...g, id, skip: [], origin: { x: 0.5, y: 0.5 } }]);
            setSel(id);
            setSaved(false);
            setAdding(false);
          }}
        />
      )}
    </div>
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
    <div className="modal">
      <div className="dialog">
        <h2>Add pins</h2>
        <div className="fields">
          <label>
            Pin model (pitch)
            <select value={pitch} onChange={(e) => setPitch(Number(e.target.value))}>
              {PITCHES.map((p) => (
                <option key={p.mm} value={p.mm}>
                  {p.mm} mm - {p.note}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="fields">
          <label>
            Number of pins <input type="number" min={1} value={count} onChange={num(setCount)} />
          </label>
          <label>
            Rows <input type="number" min={1} value={rows} onChange={num(setRows)} />
          </label>
          <label>
            Direction
            <select value={dir} onChange={(e) => setDir(e.target.value as GroupDir)}>
              {GROUP_DIRS.map(([d, t]) => (
                <option key={d} value={d}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => onAdd({ pitch, count, rows, dir })}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
