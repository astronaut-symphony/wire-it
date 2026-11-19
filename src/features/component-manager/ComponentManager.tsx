import { useRef, useState } from 'react';
import { ActionIcon, Badge, Button, Card, Container, Group, Menu, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { ArrowLeft, Download, Ellipsis, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { AppModal } from '@/shared/components/AppModal';
import { download } from '@/features/workspace/lib/export';
import { mergeImported, parseComponents, serializeComponents } from '@/features/projects/model';
import { routePath } from '@/features/projects/route';
import { NewComponentModal } from '@/features/workspace/NewComponentModal';
import { svgUrl } from '@/shared/lib/importImage';
import type { Component } from '@/shared/types';
import '@/features/home/home.css';
import './component-manager.css';

type Props = {
  customs: Component[];
  /** ids of components placed in any project; those cannot be deleted */
  used: Set<string | undefined>;
  onChange: (next: Component[]) => void;
  onBack: () => void;
};

/** Page listing the user's own and imported components: create, edit, export, delete, import. */
export function ComponentManager({ customs, used, onChange, onBack }: Props) {
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [deleting, setDeleting] = useState<Component | null>(null); // one of your own, waiting for the confirmation
  const [exporting, setExporting] = useState<Component | null>(null);
  const [author, setAuthor] = useState('');
  const [desc, setDesc] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function importFile(f?: File) {
    if (!f) return;
    try {
      if (f.size > 5_000_000) throw new Error('the file is too large');
      const { next, added, skipped } = mergeImported(customs, parseComponents(JSON.parse(await f.text())));
      onChange(next);
      setMsg(`${added} imported${skipped ? `, ${skipped} skipped (already in the library)` : ''}.`);
    } catch (e) {
      setMsg(`Could not import: ${(e as Error).message}`);
    }
  }

  /** Export asks who made it and what it is (both optional); they are kept on the component and travel in the file. */
  const startExport = (c: Component) => {
    setExporting(c);
    setAuthor(c.author ?? customs.find((x) => x.author)?.author ?? '');
    setDesc(c.description ?? '');
  };
  const doExport = () => {
    if (!exporting) return;
    const c = { ...exporting, author: author.trim() || undefined, description: desc.trim() || undefined };
    onChange(customs.map((x) => (x.id === c.id ? c : x)));
    download(`${c.name.trim() || 'component'}.wire-it.json`, JSON.stringify(serializeComponents([c])), 'application/json');
    setExporting(null);
  };

  const remove = (c: Component) => onChange(customs.filter((x) => x.id !== c.id));

  const section = (title: string, list: Component[], empty: string) => (
    <section>
      <Title order={5} mb="xs">
        {title} <Text span c="dimmed" size="sm">{list.length}</Text>
      </Title>
      {list.length ? (
        <div className="mgrid">
          {list.map((c) => (
            <Card key={c.id} withBorder radius="md" padding={6}>
              <Card.Section className="mthumb">
                <img src={svgUrl(c.svg)} alt="" />
              </Card.Section>
              <Text fw={600} size="xs" mt={6} truncate title={c.name}>{c.name}</Text>
              <Text size="xs" c="dimmed" truncate title={c.description}>{c.pins.length} pins · {c.mmW} mm{c.imported && c.author ? ` · ${c.author}` : ''}</Text>
              <Group justify="space-between" wrap="nowrap" mt={4} gap={4} h={22}>
                {used.has(c.id) ? <Badge variant="light" color="gray" size="xs">In use</Badge> : <span />}
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Actions for ${c.name}`}>
                      <Ellipsis size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {!c.imported && (
                      <Menu.Item leftSection={<Pencil size={14} />} onClick={() => window.open(routePath({ kind: 'component', id: c.id }), '_blank')}>
                        Edit
                      </Menu.Item>
                    )}
                    {!c.imported && (
                      <Menu.Item leftSection={<Upload size={14} />} onClick={() => startExport(c)}>
                        Export
                      </Menu.Item>
                    )}
                    <Menu.Item color="red" leftSection={<Trash2 size={14} />} disabled={used.has(c.id)} onClick={() => (c.imported ? remove(c) : setDeleting(c))}>
                      {used.has(c.id) ? 'Delete (in use)' : 'Delete'}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Card>
          ))}
        </div>
      ) : (
        <Text size="sm" c="dimmed">{empty}</Text>
      )}
    </section>
  );

  return (
    <div className="home">
      <Container size="lg" py="xl">
        <Group justify="space-between" align="flex-end" mb="lg">
          <Group gap="sm">
            <ActionIcon variant="default" size="lg" title="Back" aria-label="Back" onClick={onBack}>
              <ArrowLeft size={16} />
            </ActionIcon>
            <div>
              <Title order={2} c="var(--accent-text)">Manage components</Title>
            </div>
          </Group>
          <Group gap="xs">
            <Button variant="default" leftSection={<Download size={16} />} onClick={() => fileRef.current?.click()}>
              Import
            </Button>
            <Button leftSection={<Plus size={16} />} onClick={() => setCreating(true)}>
              Create
            </Button>
          </Group>
        </Group>
        {msg && <Text size="sm" mb="md">{msg}</Text>}
        <div className="manage">
          {section('My components', customs.filter((c) => !c.imported), 'None yet. Use Create to make one.')}
          {section('Imported', customs.filter((c) => c.imported), 'Nothing imported. Use Import to add a components file.')}
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => (void importFile(e.target.files?.[0]), (e.target.value = ''))} />
      </Container>
      <NewComponentModal opened={creating} onClose={() => setCreating(false)} />
      <AppModal
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete component"
        size="sm"
        footer={
          <>
            <Button variant="default" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              color="red"
              onClick={() => {
                if (deleting) remove(deleting);
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <Stack gap="sm">
          <Text size="sm">
            Delete <b>{deleting?.name}</b>? It is removed from this browser and cannot be brought back.
          </Text>
          <Text size="sm" c="dimmed">
            Even if you exported it first, importing the file again adds it as an <b>imported</b> component, not one of your own, so it can no longer be edited.
          </Text>
        </Stack>
      </AppModal>
      <AppModal
        opened={!!exporting}
        onClose={() => setExporting(null)}
        title={`Export ${exporting?.name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="default" onClick={() => setExporting(null)}>Cancel</Button>
            <Button onClick={doExport}>Export</Button>
          </>
        }
      >
        <Stack gap="sm">
          <TextInput data-autofocus label="Author" placeholder="Optional" value={author} onChange={(e) => setAuthor(e.currentTarget.value)} />
          <Textarea label="Description" placeholder="Optional" rows={4} resize="vertical" value={desc} onChange={(e) => setDesc(e.currentTarget.value)} />
        </Stack>
      </AppModal>
    </div>
  );
}
