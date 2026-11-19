import { useEffect, useState, type ReactNode } from 'react';
import { Center, Stack, Text, Title } from '@mantine/core';
import { Brand } from '@/shared/components/Brand';

const LOCK = 'wire-it-workspace';

/**
 * Lets only one tab run the workspace at a time. Every tab autosaves the whole workspace to the same place, so a
 * second tab with stale data would overwrite the first one's work. The second tab waits (and starts by itself
 * when the first one closes). The lock is held until the tab is closed or navigates away.
 */
export function SingleTab({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'taken'>(navigator.locks ? 'checking' : 'ok'); // shortcut: no Web Locks (old browsers) = no guard
  useEffect(() => {
    if (!navigator.locks) return;
    const wait = new AbortController();
    let release = () => {};
    const hold = () => new Promise<void>((done) => (release = done));
    navigator.locks.request(LOCK, { ifAvailable: true }, (lock) => {
      if (lock) {
        setState('ok');
        return hold();
      }
      setState('taken');
      // queue up: granted as soon as the other tab lets go
      return navigator.locks
        .request(LOCK, { signal: wait.signal }, () => {
          setState('ok');
          return hold();
        })
        .catch(() => {}); // aborted when this tab unmounts
    });
    return () => {
      wait.abort();
      release();
    };
  }, []);

  if (state === 'ok') return <>{children}</>;
  if (state === 'checking') return null;
  return (
    <Center h="100vh" p="md">
      <Stack align="center" gap="sm" maw={420} ta="center">
        <Brand onClick={() => {}} big />
        <Title order={4}>Wire it is open in another tab</Title>
        <Text size="sm" c="dimmed">
          Two tabs would overwrite each other's changes, so only one can be used at a time. Close the other tab and this one starts by itself.
        </Text>
      </Stack>
    </Center>
  );
}
