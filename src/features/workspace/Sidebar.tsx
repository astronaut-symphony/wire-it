import { useState } from 'react';
import { ActionIcon, Text } from '@mantine/core';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import '@/features/workspace/workspace.css';
import { svgUrl } from '@/shared/lib/importImage';
import type { Component } from '@/shared/types';
import { NewComponentModal } from './NewComponentModal';
import { BUILTINS } from './lib/library';

type Props = {
  customs: Component[];
  /** ids of components placed in any project; those cannot be deleted from the library */
  usedIds: Set<string | undefined>;
  onDeleteComponent: (id: string) => void;
};

/** Left column: the component library to drag onto the canvas, and the copyright at the bottom. */
export function Sidebar({ customs, usedIds, onDeleteComponent }: Props) {
  const [creating, setCreating] = useState(false);
  const row = (c: Component) => (
    <div key={c.id} className="item" draggable onDragStart={(e) => e.dataTransfer.setData('application/x-comp', c.id)}>
      <img src={svgUrl(c.svg)} alt="" />
      <span>{c.name}</span>
      {!c.builtin && (
        <ActionIcon
          size="sm"
          variant="subtle"
          color="red"
          title={usedIds.has(c.id) ? 'In use' : 'Delete'}
          aria-label={`Delete ${c.name}`}
          disabled={usedIds.has(c.id)}
          onClick={() => onDeleteComponent(c.id)}
        >
          <Trash2 size={14} />
        </ActionIcon>
      )}
    </div>
  );
  // Community will hold components other users published; there is no publishing yet, so it stays empty
  const groups: { title: string; list: Component[]; empty: string; add?: () => void; addLabel: string }[] = [
    { title: 'Built-in', list: BUILTINS, empty: '', addLabel: '' },
    { title: 'My components', list: customs, empty: 'None yet', add: () => setCreating(true), addLabel: 'Add component' },
    { title: 'Community', list: [], empty: 'Components published by other users will show up here', addLabel: 'Publish (coming soon)' },
  ];
  return (
    <aside>
      <div className="lib">
        {groups.map(({ title, list, empty, add, addLabel }) => (
          <details key={title} open>
            <summary>
              <ChevronDown size={14} />
              {title}
              {addLabel && (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  ml="auto"
                  title={addLabel}
                  aria-label={addLabel}
                  disabled={!add}
                  onClick={(e) => {
                    e.preventDefault(); // inside <summary>: do not toggle the group
                    add?.();
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
