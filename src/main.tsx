import '@mantine/core/styles.css';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import App from '@/app/App';
import { ComponentEditor } from '@/features/component-editor/ComponentEditor';
import { parsePage } from '@/features/projects/route';
import './app/styles.css';

const page = parsePage(location.pathname);

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={{ cursorType: 'pointer' }}>{page.kind === 'component' ? <ComponentEditor id={page.id} /> : <App />}</MantineProvider>,
);
