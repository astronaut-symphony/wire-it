import { useState } from 'react';
import { Button, Group, Modal, TextInput } from '@mantine/core';

export type Ask = { title: string; label: string; initial: string; placeholder?: string; reset?: string; /* shows a Reset button that puts this text in the field */ onSubmit: (value: string) => void };

/** Asks for one line of text; replaces the browser's prompt(). Submitting with an empty field is up to onSubmit. */
export function PromptModal({ ask, onClose }: { ask: Ask | null; onClose: () => void }) {
  return (
    <Modal opened={!!ask} onClose={onClose} title={ask?.title} centered size="sm">
      {ask && <Form ask={ask} onClose={onClose} />}
    </Modal>
  );
}

// its own component so the field starts from `initial` each time the dialog opens
function Form({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const [v, setV] = useState(ask.initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        ask.onSubmit(v.trim());
        onClose();
      }}
    >
      <TextInput label={ask.label} placeholder={ask.placeholder} value={v} onChange={(e) => setV(e.currentTarget.value)} data-autofocus />
      <Group justify="flex-end" mt="md">
        {ask.reset !== undefined && (
          <Button variant="subtle" mr="auto" onClick={() => setV(ask.reset!)}>
            Reset
          </Button>
        )}
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">OK</Button>
      </Group>
    </form>
  );
}
