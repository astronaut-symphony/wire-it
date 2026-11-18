import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionIcon, Badge, Button, Group, Text, Title } from '@mantine/core';
import { Download, Pencil, Trash2, Upload } from 'lucide-react';
import { update } from 'idb-keyval';
import { CHANNEL } from '@/shared/lib/inbox';
import { download } from '@/features/workspace/lib/export';
import { mergeImported, parseComponents, serializeComponents } from '@/features/projects/model';
import { KEY, readWorkspace } from '@/features/projects/useWorkspaceStore';
import { routePath } from '@/features/projects/route';
import { svgUrl } from '@/shared/lib/importImage';
import type { Component } from '@/shared/types';
import './component-manager.css';

/**
 * Runs in its own tab (?manage=1): lists the user's own and imported components, and exports, deletes or imports them.
 * Changes are saved straight into the workspace and sent to the canvas tab, which swaps in the new library.
 * shortcut: a component finished in the editor within the last half second can be lost if it is not saved yet; fine for now.
 */
export function ComponentManager() {
  const [customs, setCustoms] = useState<Component[]>([]);
  const [used, setUsed] = useState(new Set<string | undefined>());
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const ws = await readWorkspace();
    if (!ws) return;
    setCustoms(ws.components);
    // in use = placed in any project; those cannot be deleted
    setUsed(new Set(ws.projects.flatMap((p) => p.nodes).map((n) => (n.data as { componentId?: string }).componentId)));
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener('focus', load); // the canvas tab may have changed things meanwhile
    return () => window.removeEventListener('focus', load);
  }, [load]);

  async function commit(next: Component[]) {
    await update<{ components: Component[] } | undefined>(KEY, (ws) => ws && { ...ws, components: next });
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ components: next });
    ch.close();
    setCustoms(next);
  }

  async function importFile(f?: File) {
    if (!f) return;
    try {
      if (f.size > 5_000_000) throw new Error('the file is too large');
      const { next, added, skipped } = mergeImported(customs, parseComponents(JSON.parse(await f.text())));
      await commit(next);
      setMsg(`${added} imported${skipped ? `, ${skipped} skipped (already in the library)` : ''}.`);
    } catch (e) {
      setMsg(`Could not import: ${(e as Error).message}`);
    }
  }

  const section = (title: string, list: Component[], empty: string) => (
    <section>
      <Title order={5} mb="xs">
        {title} <Text span c="dimmed" size="sm">{list.length}</Text>
      </Title>
      {list.length ? (
        list.map((c) => (
          <Group key={c.id} className="mrow" wrap="nowrap">
            <img src={svgUrl(c.svg)} alt="" />
            <Text style={{ flex: 1 }} truncate>{c.name}</Text>
            <Text size="xs" c="dimmed">{c.pins.length} pins · {c.mmW} mm</Text>
            {used.has(c.id) && <Badge variant="light" color="gray">In use</Badge>}
            {!c.imported && (
              <ActionIcon variant="subtle" title="Edit" aria-label={`Edit ${c.name}`} onClick={() => window.open(routePath({ kind: 'component', id: c.id }), '_blank')}>
                <Pencil size={16} />
              </ActionIcon>
            )}
            <ActionIcon variant="subtle" title="Export to a file" aria-label={`Export ${c.name}`} onClick={() => download(`${c.name.trim() || 'component'}.tinker.json`, JSON.stringify(serializeComponents([c])), 'application/json')}>
              <Download size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" disabled={used.has(c.id)} title={used.has(c.id) ? 'In use in a project' : 'Delete'} aria-label={`Delete ${c.name}`} onClick={() => void commit(customs.filter((x) => x.id !== c.id))}>
              <Trash2 size={16} />
            </ActionIcon>
          </Group>
        ))
      ) : (
        <Text size="sm" c="dimmed">{empty}</Text>
      )}
    </section>
  );

  return (
    <div className="manage">
      <Group justify="space-between" mb="md">
        <Title order={3}>Manage components</Title>
        <Button leftSection={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
          Import
        </Button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => (void importFile(e.target.files?.[0]), (e.target.value = ''))} />
      </Group>
      {msg && <Text size="sm" mb="md">{msg}</Text>}
      {section('My components', customs.filter((c) => !c.imported), 'None yet. Create one from the Components panel.')}
      {section('Imported', customs.filter((c) => c.imported), 'Nothing imported. Use Import to add a components file.')}
    </div>
  );
}
