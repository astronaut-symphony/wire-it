# Wire it

Wiring diagram sketcher built around **custom components**: draw your own part
(any pin count, pitch, side, label, or imported SVG), drop it on a canvas, and
wire it up.

## Features

- Component editor: generate pins, set pitch/direction/rotation, import and sanitize SVG artwork
- Workspace canvas with wires, junctions, colors, and a context menu
- Multiple projects, stored locally in the browser (IndexedDB)
- Export the diagram as PNG, wire list as CSV
- Share components between tabs

## Development

```sh
npm install
npm run dev     # start the dev server
npm test        # vitest
npm run build   # typecheck + production build
```

Stack: React, TypeScript, Vite, Mantine, React Flow (`@xyflow/react`).
