# Wire it

Wiring diagram sketcher built around **custom components**: draw your own part
(any pin count, pitch, side, label, or imported SVG), drop it on a canvas, and
wire it up. Everything is stored in your browser; there is no account and no server.

## Features

- **Component editor**: generate pins, set pitch/direction/rotation, label each pin, import and sanitize SVG artwork. Edit a component later and its pins keep their ids, so wires stay attached.
- **Workspace canvas**: drag parts in, wire pins together (right-angle wires route around components on their own), add junctions, color wires, rotate and label parts. Right-click anything for a menu, and open Properties for a part's details.
- **Multiple projects**, kept locally in the browser (IndexedDB) and autosaved. A project remembers which version of each component it was drawn with and asks before updating when a component has changed.
- **Share components**: export one of your components to a file (with an optional author and description) and import other people's. Imported ones are listed apart from your own.
- **Export** the diagram as PNG, the wire list as CSV, or a whole project as JSON.

## Development

```sh
npm install
npm run dev     # start the dev server
npm test        # vitest
npm run build   # typecheck + production build
```

Stack: React, TypeScript, Vite, Mantine, React Flow (`@xyflow/react`).

The app uses path-based URLs (`/project/<id>`, `/components`, `/component/<id>`), so a production host
needs a fallback to `index.html` for unknown paths, and the app must be served from the root of the domain.

## Contributing

Ideas, bug reports and pull requests are welcome.

- **Found a bug or have an idea?** Open an [issue](https://github.com/astronaut-symphony/wire-it/issues). For a bug, say what you did, what you expected and what happened; a screenshot or an exported project file helps.
- **Want to change something?** Fork the repo, create a branch, and open a pull request. For anything bigger than a small fix, open an issue first so we can agree on the approach.
- **Before you open the pull request**, run `npm test` and `npm run build`; both must pass. Add a test for new logic (parsing, routing, data handling), and keep the change small and focused.
- Match the style of the code around your change.

## License

[MIT](LICENSE)
