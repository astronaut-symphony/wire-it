import { ActionIcon, Text } from '@mantine/core';
import { ChevronDown, SquareArrowUpRightExit } from 'lucide-react';
import '@/features/workspace/workspace.css';
import { svgUrl } from '@/shared/lib/importImage';
import type { Component } from '@/shared/types';
import { routePath } from '@/features/projects/route';
import { BUILTINS } from './lib/library';

/** Left column: the component library to drag onto the canvas, and the copyright at the bottom. */
export function Sidebar({ customs }: { customs: Component[] }) {
  const row = (c: Component) => (
    <div key={c.id} className="item" draggable onDragStart={(e) => e.dataTransfer.setData('application/x-comp', c.id)}>
      <img src={svgUrl(c.svg)} alt="" />
      <span>{c.name}</span>
    </div>
  );
  // a group with nothing in it is not shown; components are made and imported in the manage page
  const groups = [
    { title: 'Built-in', list: BUILTINS },
    { title: 'My components', list: customs.filter((c) => !c.imported) },
    { title: 'Imported', list: customs.filter((c) => c.imported) },
  ].filter((g) => g.list.length);
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
          <SquareArrowUpRightExit size={14} />
        </ActionIcon>
      </div>
      <div className="lib">
        {groups.map(({ title, list }) => (
          <details key={title} open>
            <summary>
              <ChevronDown size={14} />
              {title}
            </summary>
            <div className="group">{list.map(row)}</div>
          </details>
        ))}
      </div>
      <Text size="xs" c="dimmed">
        © {new Date().getFullYear()} Tinker part
      </Text>
    </aside>
  );
}
