import { useState } from 'react';
import { Text, TextInput } from '@mantine/core';
import '@/features/workspace/workspace.css';

/** The project name shown at the top left of the workspace; double-click to rename. */
export function ProjectTitle({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const commit = () => {
    const v = value.trim();
    if (v && v !== name) onRename(v);
    setEditing(false);
  };
  return (
    <div className="projname">
      {editing ? (
        <TextInput
          size="xs"
          w={220}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <Text
          fw={600}
          title="Double-click to rename"
          onDoubleClick={() => {
            setValue(name);
            setEditing(true);
          }}
        >
          {name}
        </Text>
      )}
    </div>
  );
}
