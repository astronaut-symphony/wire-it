import { Anchor, Badge, Container, Divider, Group, Stack, Text } from '@mantine/core';
import { ExternalLink, GitPullRequest, Lightbulb } from 'lucide-react';
import { Brand } from '@/shared/components/Brand';

const REPO = 'https://github.com/astronaut-symphony/tinker-part';
const LINKS = [
  { href: REPO, icon: <ExternalLink size={14} />, text: 'View the source on GitHub' },
  { href: `${REPO}/issues`, icon: <Lightbulb size={14} />, text: 'Have an idea or found a bug? Let us know' },
  { href: `${REPO}/pulls`, icon: <GitPullRequest size={14} />, text: 'Want to help? Contribute to the project' },
];
const FEATURES = ['Custom parts', 'Wiring', 'Projects', 'Export', 'Share', 'Local only'];

/** Top of the home page: the logo, what the app is and where its source lives. Static on purpose: nothing is fetched from GitHub. */
export function RepoInfo() {
  return (
    <Container size="lg" pt="lg">
      <Group justify="space-between" align="flex-end" gap="xl">
        <Stack gap="md" maw={560}>
          <Brand big onClick={() => {}} />
          <Text c="dimmed">
            Wiring diagram sketcher built around custom components: draw your own part, drop it on a canvas, and wire it up. Everything is stored in this browser.
          </Text>
          <Group gap="xs">
            {FEATURES.map((s) => (
              <Badge key={s} variant="light" color="gray">{s}</Badge>
            ))}
          </Group>
        </Stack>
        <Stack gap="xs" align="flex-end">
          {LINKS.map(({ href, icon, text }) => (
            <Anchor key={href} href={href} target="_blank" rel="noopener noreferrer" size="sm">
              <Group gap={4} wrap="nowrap">
                {icon} {text}
              </Group>
            </Anchor>
          ))}
        </Stack>
      </Group>
      <Divider mt={40} />
    </Container>
  );
}
