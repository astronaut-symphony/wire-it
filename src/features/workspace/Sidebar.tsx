import { useState } from 'react';
import { ActionIcon, Text } from '@mantine/core';
import { ChevronDown, Plus, Settings } from 'lucide-react';
import '@/features/workspace/workspace.css';
import { svgUrl } from '@/shared/lib/importImage';
import type { Component } from '@/shared/types';
import { routePath } from '@/features/projects/route';
import { NewComponentModal } from './NewComponentModal';
import { BUILTINS } from './lib/library';

/** Left column: the component library to drag onto the canvas, and the copyright at the bottom. */
export function Sidebar({ customs }: { customs: Component[] }) {
  const [creating, setCreating] = useState(false);
  const row = (c: Component) => (
    <div key={c.id} className="item" draggable onDragStart={(e) => e.dataTransfer.setData('application/x-comp', c.id)}>
      <img src={svgUrl(c.svg)} alt="" />
      <span>{c.name}</span>
    </div>
  );
  const groups: { title: string; list: Component[]; empty: string; add?: () => void }[] = [
    { title: 'Built-in', list: BUILTINS, empty: '' },
    { title: 'My components', list: customs.filter((c) => !c.imported), empty: 'None yet', add: () => setCreating(true) },
    { title: 'Imported', list: customs.filter((c) => c.imported), empty: 'Import components in Manage' },
  ];
  return (
    <aside>
      <div className="libhead">
        Components
        <ActionIcon
          size="sm"
          variant="subtle"
          title="Manage components"
          aria-label="Manage components"
          onClick={() => window.open(routePath({ kind: 'components' }), '_blank')}
        >
          <Settings size={14} />
        </ActionIcon>
      </div>
      <div className="lib">
        {groups.map(({ title, list, empty, add }) => (
          <details key={title} open>
            <summary>
              <ChevronDown size={14} />
              {title}
              {add && (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  ml="auto"
                  title="Add component"
                  aria-label="Add component"
                  onClick={(e) => {
                    e.preventDefault(); // inside <summary>: do not toggle the group
                    add();
                  }}
                >
                  <Plus size={14} />
                </ActionIcon>
              )}
            </summary>
            <div className="group">
              {list.length ? list.map(row) : <Text size="xs" c="dimmed">{empty}</Text>}
            </div>
          </details>
        ))}
      </div>
      <Text size="xs" c="dimmed">
        © {new Date().getFullYear()} Tinker part
      </Text>
      <NewComponentModal opened={creating} onClose={() => setCreating(false)} />
    </aside>
  );
}
