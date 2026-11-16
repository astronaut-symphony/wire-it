import '@mantine/core/styles.css';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import App from '@/app/App';
import { ComponentEditor } from '@/features/component-editor/ComponentEditor';
import './app/styles.css';

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={{ cursorType: 'pointer' }}>{new URLSearchParams(location.search).has('editor') ? <ComponentEditor /> : <App />}</MantineProvider>,
);
