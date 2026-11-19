import '@mantine/core/styles.css';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme, type MantineColorsTuple } from '@mantine/core';
import App from '@/app/App';
import { ComponentEditor } from '@/features/component-editor/ComponentEditor';
import { parsePage } from '@/features/projects/route';
import './app/styles.css';

// brand colours: the logo's orange as the main colour (shade 4 is the wire orange, 7 the darker "it" orange that white text reads on; 8 is the hover), Space Grotesk for headings
const theme = createTheme({
  cursorType: 'pointer',
  primaryColor: 'brand',
  primaryShade: 7,
  colors: { brand: ['#fff4e6', '#ffe6c7', '#fdd09b', '#f8ba6c', '#f2a33a', '#e08a22', '#d06a14', '#c2570c', '#a64708', '#843806'] satisfies MantineColorsTuple },
  headings: { fontFamily: "'Space Grotesk', system-ui, sans-serif" },
});

const page = parsePage(location.pathname);

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={theme}>{page.kind === 'component' ? <ComponentEditor id={page.id} /> : <App />}</MantineProvider>,
);
