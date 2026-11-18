const MAX = 800;

export type Imported = { svg: string; w: number; h: number };

export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Strips scripts/handlers. Rendering always goes through <img>, which also never runs scripts. */
export function sanitizeSvg(text: string): Imported {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.nodeName !== 'svg' || doc.querySelector('parsererror')) throw new Error('not a valid SVG');
  doc.querySelectorAll('script,foreignObject').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    }
  });
  const vb = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const hasVb = vb?.length === 4 && vb[2] > 0 && vb[3] > 0;
  const w = hasVb ? vb![2] : parseFloat(root.getAttribute('width') ?? '') || 100;
  const h = hasVb ? vb![3] : parseFloat(root.getAttribute('height') ?? '') || 100;
  if (!hasVb) root.setAttribute('viewBox', `0 0 ${w} ${h}`);
  root.removeAttribute('width');
  root.removeAttribute('height');
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return { svg: new XMLSerializer().serializeToString(root), w, h };
}

// Not real vectorization: the bitmap is embedded in an SVG so every format ends up as one type.
async function fromRaster(file: Blob): Promise<Imported> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  const url = c.toDataURL('image/webp', 0.9); // falls back to png where webp isn't encodable
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><image href="${url}" width="${w}" height="${h}"/></svg>`,
  };
}

export async function importImage(file: File): Promise<Imported> {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name) ? sanitizeSvg(await file.text()) : fromRaster(file);
}

/** The image turned 90 degrees clockwise: a point (x, y) lands at (h - y, x), so the size swaps. */
export const rotateImage = ({ svg, w, h }: Imported): Imported => ({
  w: h,
  h: w,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${h} ${w}"><g transform="translate(${h} 0) rotate(90)">${svg.replace(/^<svg /, `<svg width="${w}" height="${h}" `)}</g></svg>`,
});
