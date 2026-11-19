import { Anchor, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import pkg from '../../../package.json';

/** The logo: two pins joined by a wire, the name and the version under it. Clicking the logo or name always goes back to the home page. */
export function Brand({ onClick, big, versionHref }: { onClick: () => void; big?: boolean; /** makes the version a link (e.g. to the changelog) */ versionHref?: string }) {
  const size = big ? 42 : 30;
  const version = `v${pkg.version}`;
  return (
    <Group gap={10} wrap="nowrap">
      <UnstyledButton onClick={onClick} aria-label="Wire it, go to the home page" title="Home" style={{ display: 'flex' }}>
        <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden>
          <rect width="96" height="96" rx="22" fill="#0F1B2D" />
          <path d="M26 32H50V64H70" fill="none" stroke="#F2A33A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="26" cy="32" r="8" fill="#F5F7FA" />
          <circle cx="26" cy="32" r="3" fill="#0F1B2D" />
          <circle cx="70" cy="64" r="8" fill="#2EC4B6" />
          <circle cx="70" cy="64" r="3" fill="#0F1B2D" />
        </svg>
      </UnstyledButton>
      <Stack gap={0}>
        <UnstyledButton onClick={onClick} title="Home">
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: big ? 28 : 20, lineHeight: 1, letterSpacing: '-0.03em', color: '#0F1B2D' }}>
            Wire <span style={{ color: '#C2570C' }}>it</span>
          </span>
        </UnstyledButton>
        {versionHref ? (
          <Anchor href={versionHref} target="_blank" rel="noopener noreferrer" size="xs" lh={1} mt={2} c="var(--accent-text)" title="See what changed in this version">
            {version}
          </Anchor>
        ) : (
          <Text size="xs" lh={1} mt={2} c="dimmed">{version}</Text>
        )}
      </Stack>
    </Group>
  );
}
