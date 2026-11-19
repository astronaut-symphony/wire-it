/** Where the user is on the canvas page: the project list, the component manager, or inside one project. Lives in the URL path so refresh and back work. */
export type Route = { kind: 'home' } | { kind: 'components' } | { kind: 'project'; id: string };
/** Every page the app has: also the component editor (its own tab; id 'new' = a new component). */
export type Page = Route | { kind: 'component'; id: string };

export function parsePage(path: string): Page {
  const m = /^\/(project|component)\/([^/]+)\/?$/.exec(path);
  if (m) return { kind: m[1] as 'project' | 'component', id: decodeURIComponent(m[2]) };
  return /^\/components\/?$/.test(path) ? { kind: 'components' } : { kind: 'home' };
}

export function parseRoute(path: string): Route {
  const p = parsePage(path);
  return p.kind === 'component' ? { kind: 'home' } : p;
}

export function routePath(p: Page): string {
  return p.kind === 'home' ? '/' : p.kind === 'components' ? '/components' : `/${p.kind}/${encodeURIComponent(p.id)}`;
}
