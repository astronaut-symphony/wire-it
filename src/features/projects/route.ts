/** Where the user is on the canvas page: the home page (project list) or inside one project. Lives in the URL path so refresh and back work. */
export type Route = { kind: 'home' } | { kind: 'project'; id: string };
/** Every page the app has: also the component manager and the component editor (id 'new' = a new component). */
export type Page = Route | { kind: 'components' } | { kind: 'component'; id: string };

export function parsePage(path: string): Page {
  const m = /^\/(project|component)\/([^/]+)\/?$/.exec(path);
  if (m) return { kind: m[1] as 'project' | 'component', id: decodeURIComponent(m[2]) };
  return /^\/components\/?$/.test(path) ? { kind: 'components' } : { kind: 'home' };
}

export function parseRoute(path: string): Route {
  const p = parsePage(path);
  return p.kind === 'home' || p.kind === 'project' ? p : { kind: 'home' };
}

export function routePath(p: Page): string {
  switch (p.kind) {
    case 'home':
      return '/';
    case 'components':
      return '/components';
    default:
      return `/${p.kind}/${encodeURIComponent(p.id)}`;
  }
}
