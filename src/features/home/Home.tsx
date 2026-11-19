import { useState, type ReactNode } from 'react';
import { ActionIcon, Button, Card, Container, FileButton, Group, Menu, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { Cpu, Ellipsis, FileInput, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppModal } from '@/shared/components/AppModal';
import { RepoInfo } from './RepoInfo';
import './home.css';

type ProjectInfo = { id: string; name: string; components: number; wires: number; preview: ReactNode };

type Props = {
  projects: ProjectInfo[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onImport: (file: File) => void;
};

/** Home page: the list of projects. */
export function Home({ projects, onOpen, onNew, onRename, onDelete, onImport }: Props) {
  // with nothing saved yet (a first visit) the first new project comes with a warning about where it is kept
  const [warn, setWarn] = useState(false);
  const startNew = () => (projects.length ? onNew() : setWarn(true));
  const [dialog, setDialog] = useState<{ kind: 'rename' | 'delete'; id: string } | null>(null);
  const [text, setText] = useState('');
  const target = projects.find((p) => p.id === dialog?.id);
  const close = () => setDialog(null);
  const commitRename = () => {
    const v = text.trim();
    if (dialog && v) onRename(dialog.id, v);
    close();
  };

  return (
    <div className="home">
      <RepoInfo />
      <Container size="lg" py="xl">
        <div>
        <Group justify="space-between" align="flex-end" mb="lg">
          <Title order={2} c="var(--accent-text)">Your projects</Title>
          <Group gap="xs">
            <FileButton onChange={(f) => f && onImport(f)} accept="application/json,.json">
              {(props) => (
                <Button {...props} variant="default" leftSection={<FileInput size={16} />}>
                  Open JSON
                </Button>
              )}
            </FileButton>
            <Button leftSection={<Plus size={16} />} onClick={startNew}>
              New project
            </Button>
          </Group>
        </Group>

        {projects.length === 0 ? (
          <Card withBorder radius="md" padding="xl" ta="center">
            <Stack align="center" gap="xs">
              <Cpu size={36} strokeWidth={1.4} />
              <Text fw={600}>No projects yet</Text>
              <Text c="dimmed" size="sm">
                Create your first project to start placing components and wiring them up.
              </Text>
              <Button mt="xs" leftSection={<Plus size={16} />} onClick={startNew}>
                New project
              </Button>
            </Stack>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
            {projects.map((p) => (
              <Card
                key={p.id}
                withBorder
                radius="md"
                padding="sm"
                className="projcard"
                role="button"
                tabIndex={0}
                aria-label={`Open ${p.name}`}
                onClick={() => onOpen(p.id)}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onOpen(p.id)}
              >
                <Card.Section className="projthumb">{p.preview}</Card.Section>
                <Group justify="space-between" wrap="nowrap" align="flex-start" mt="sm">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>
                      {p.name}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {p.components} {p.components === 1 ? 'component' : 'components'} · {p.wires} {p.wires === 1 ? 'wire' : 'wires'}
                    </Text>
                  </div>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${p.name}`} onClick={(e) => e.stopPropagation()}>
                        <Ellipsis size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                      <Menu.Item
                        leftSection={<Pencil size={14} />}
                        onClick={() => {
                          setText(p.name);
                          setDialog({ kind: 'rename', id: p.id });
                        }}
                      >
                        Rename
                      </Menu.Item>
                      <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => setDialog({ kind: 'delete', id: p.id })}>
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
        </div>
      </Container>

      <AppModal
        opened={warn}
        onClose={() => setWarn(false)}
        title="Before you start"
        size="md"
        footer={
          <Button
            onClick={() => {
              setWarn(false);
              onNew();
            }}
          >
            I understand
          </Button>
        }
      >
        <Stack gap="sm">
          <Text size="sm">
            Your projects are saved only in this browser, on this device. Nothing is uploaded, and nobody, including us, can get it back for you.
          </Text>
          <Text size="sm">They are lost if you:</Text>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>
              clear your browsing data:
              <ul style={{ margin: '4px 0 6px', paddingLeft: 18 }}>
                <li>
                  <b>Chrome / Edge:</b> Settings, Privacy, Delete browsing data, then tick "Cookies and other site data"
                </li>
                <li>
                  <b>Firefox:</b> Settings, Privacy &amp; Security, Cookies and Site Data, Clear Data
                </li>
                <li>
                  <b>Safari:</b> Settings, Privacy, Manage Website Data
                </li>
              </ul>
            </li>
            <li>work in a private or incognito window (it forgets everything when closed).</li>
            <li>switch to another browser or device, or reinstall or reset your browser.</li>
          </ul>
          <Text size="sm">
            So keep a copy: use the export button (download icon) in a project to save it as a <b>JSON</b> file you can open again later, or as a <b>PNG</b> picture of the diagram.
          </Text>
        </Stack>
      </AppModal>

      <AppModal
        opened={dialog?.kind === 'rename'}
        onClose={close}
        title="Rename project"
        footer={
          <>
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button onClick={commitRename} disabled={!text.trim()}>
              Save
            </Button>
          </>
        }
      >
        <TextInput
          data-autofocus
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitRename()}
        />
      </AppModal>

      <AppModal
        opened={dialog?.kind === 'delete'}
        onClose={close}
        title="Delete project"
        footer={
          <>
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (dialog) onDelete(dialog.id);
                close();
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <Text size="sm">
          Delete <b>{target?.name}</b>? Its components and wires are removed from this browser. Save it to JSON first if you still need it.
        </Text>
      </AppModal>
    </div>
  );
}
