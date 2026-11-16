import { del, get, set, update } from 'idb-keyval';
import type { Imported } from '@/shared/lib/importImage';
import type { Component } from '@/shared/types';

// The component editor runs in its own tab and hands finished components to the canvas tab through
// IndexedDB (so nothing is lost if the canvas tab is closed meanwhile) plus a BroadcastChannel ping.
const KEY = 'tinker-part-inbox';
export const CHANNEL = 'tinker-part';

export async function sendComponent(c: Component) {
  await update<Component[]>(KEY, (v) => [...(v ?? []), c]);
  const ch = new BroadcastChannel(CHANNEL);
  ch.postMessage('inbox');
  ch.close();
}

/** Takes everything waiting in the inbox; a component sent while this runs stays for the next call. */
export async function takeComponents(): Promise<Component[]> {
  const items = (await get<Component[]>(KEY)) ?? [];
  if (items.length) await update<Component[]>(KEY, (v) => (v ?? []).filter((x) => !items.some((i) => i.id === x.id)));
  return items;
}

// The "new component" dialog on the canvas page hands its name and image to the editor tab the same way.
const DRAFT = 'tinker-part-draft';
export type Draft = { name: string; img: Imported };

export const stashDraft = (d: Draft) => set(DRAFT, d);

/** One-shot: the editor tab takes the draft when it opens, so a reload starts empty. */
export async function takeDraft(): Promise<Draft | undefined> {
  const d = await get<Draft>(DRAFT);
  if (d) await del(DRAFT);
  return d;
}
