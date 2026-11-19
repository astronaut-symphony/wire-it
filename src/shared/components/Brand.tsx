import { Group, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { Cable } from 'lucide-react';

/** The logo. Clicking it always goes back to the home page. */
export function Brand({ onClick, big }: { onClick: () => void; big?: boolean }) {
  return (
    <UnstyledButton onClick={onClick} aria-label="Tinker part, go to the home page" title="Home">
      <Group gap={8} wrap="nowrap">
        <ThemeIcon size={big ? 42 : 30} radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan', deg: 135 }}>
          <Cable size={big ? 26 : 18} />
        </ThemeIcon>
        <Text fw={700} size={big ? 'xl' : 'lg'} style={{ letterSpacing: '-0.01em' }}>
          Tinker part
        </Text>
      </Group>
    </UnstyledButton>
  );
}
