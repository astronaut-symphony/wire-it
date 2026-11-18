import { useEffect, useState } from 'react';
import { Button, TextInput } from '@mantine/core';
import { AppModal } from '@/shared/components/AppModal';

export type Ask = { title: string; label: string; initial: string; placeholder?: string; reset?: string; /* shows a Reset button that puts this text in the field */ onSubmit: (value: string) => void };

/** Asks for one line of text; replaces the browser's prompt(). Submitting with an empty field is up to onSubmit. */
export function PromptModal({ ask, onClose }: { ask: Ask | null; onClose: () => void }) {
  const [v, setV] = useState('');
  useEffect(() => setV(ask?.initial ?? ''), [ask]); // the field starts from `initial` each time the dialog opens
  const submit = () => {
    ask?.onSubmit(v.trim());
    onClose();
  };
  return (
    <AppModal
      opened={!!ask}
      onClose={onClose}
      title={ask?.title}
      size="sm"
      footer={
        <>
          {ask?.reset !== undefined && (
            <Button variant="subtle" mr="auto" onClick={() => setV(ask.reset!)}>
              Reset
            </Button>
          )}
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>OK</Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextInput label={ask?.label} placeholder={ask?.placeholder} value={v} onChange={(e) => setV(e.currentTarget.value)} data-autofocus />
      </form>
    </AppModal>
  );
}
