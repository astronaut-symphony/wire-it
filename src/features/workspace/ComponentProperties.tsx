import { Button, Text } from '@mantine/core';
import { AppModal } from '@/shared/components/AppModal';
import type { Component } from '@/shared/types';

/** Read-only details of a component, opened from its right-click menu. */
export function ComponentProperties({ comp, onClose }: { comp: Component | null; onClose: () => void }) {
  const rows: [string, string | undefined][] = comp
    ? [
        ['Name', comp.name],
        ['Label', comp.label],
        ['Source', comp.builtin ? 'Built-in' : comp.imported ? 'Imported' : 'Mine'],
        ['Author', comp.author],
        ['Pins', String(comp.pins.length)],
        ['Version', String(comp.version ?? 1)],
        ['Description', comp.description],
      ]
    : [];
  return (
    <AppModal opened={!!comp} onClose={onClose} title="Properties" size="sm" footer={<Button onClick={onClose}>Close</Button>}>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0 }}>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <Text component="dt" size="sm" c="dimmed">{k}</Text>
            <Text component="dd" size="sm" m={0} style={{ overflowWrap: 'anywhere' }}>{v}</Text>
          </div>
        ))}
      </dl>
    </AppModal>
  );
}
