import { getNodesBounds, getViewportForBounds, type Edge, type Node, type Rect } from '@xyflow/react';
import { toPng } from 'html-to-image';

export function download(name: string, data: BlobPart, type = '') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Everything on the canvas: the nodes plus the wires as drawn, padded. React Flow's own fit-view only
 * looks at nodes, so wires that run well outside the components would be cut off.
 */
export function diagramBounds(nodes: Node[], edges: Edge[]): Rect {
  const b = getNodesBounds(nodes);
  let x1 = b.x;
  let y1 = b.y;
  let x2 = b.x + b.width;
  let y2 = b.y + b.height;
  const grow = (x: number, y: number, w = 0, h = 0) => {
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x + w);
    y2 = Math.max(y2, y + h);
  };
  // the drawn paths, in canvas coordinates. Stored bend points are not used
  // when paths exist: they can include points the drawing skips (e.g. a folded-back tip), which left an
  // empty band in the PNG.
  const paths = document.querySelectorAll<SVGGraphicsElement>('.react-flow__edges .react-flow__edge-path');
  if (paths.length) {
    paths.forEach((el) => {
      const q = el.getBBox();
      if (q.width || q.height) grow(q.x, q.y, q.width, q.height);
    });
  } else {
    for (const e of edges) for (const p of (e.data as { points?: { x: number; y: number }[] } | undefined)?.points ?? []) grow(p.x, p.y);
  }
  // a label moved away from its component can sit outside the node box (width is a rough guess from the text length)
  for (const n of nodes) {
    const d = n.data as { label?: string; value?: string; labelPos?: { x: number; y: number }; labelRot?: number };
    if (n.type !== 'comp' || !d.labelPos) continue;
    // the box hangs from its bottom-left corner (the pivot): x 0..w, y -h..0 before turning; an unnamed label is guessed at 12 characters
    const [w, h] = [Math.max(d.label?.length || 12, d.value?.length ?? 0) * 7, d.value ? 28 : 14];
    const t = ((d.labelRot ?? 0) * Math.PI) / 180;
    const [c, s] = [Math.round(Math.cos(t)), Math.round(Math.sin(t))]; // always a quarter turn, so exact
    const corners = [0, w].flatMap((x) => [-h, 0].map((y) => [x * c - y * s, x * s + y * c]));
    const [xs, ys] = [corners.map((p) => p[0]), corners.map((p) => p[1])];
    grow(n.position.x + d.labelPos.x + Math.min(...xs), n.position.y + d.labelPos.y + Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  }
  const pad = 30;
  return { x: x1 - pad, y: y1 - pad, width: x2 - x1 + 2 * pad, height: y2 - y1 + 2 * pad };
}

/** Wire edit handles are editor-only: hidden (CSS class + filter) while the PNG is drawn. */
export async function exportPng(b: Rect, name: string) {
  document.body.classList.add('exporting');
  try {
    await renderPng(b, name);
  } finally {
    document.body.classList.remove('exporting');
  }
}

async function renderPng(b: Rect, name: string) {
  const W = Math.ceil(b.width) + 80;
  const H = Math.ceil(b.height) + 80;
  const v = getViewportForBounds(b, W, H, 0.1, 4, 0.1);
  const el = document.querySelector<HTMLElement>('.react-flow__viewport')!;
  // sharp output: aim for ~6000px on the long side (at most 6x), never below 1x
  const pixelRatio = Math.max(1, Math.min(6, 6000 / Math.max(W, H)));
  const url = await toPng(el, {
    backgroundColor: '#fff',
    width: W,
    height: H,
    pixelRatio,
    filter: (n) => !(n instanceof Element && n.classList.contains('bendwrap')),
    style: { width: `${W}px`, height: `${H}px`, transform: `translate(${v.x}px,${v.y}px) scale(${v.zoom})` },
  });
  download(`${name}.png`, await (await fetch(url)).blob());
}
