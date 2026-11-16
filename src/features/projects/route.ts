/** Where the user is: the home page (project list) or inside one project. Lives in the URL hash so refresh and back work. */
export type Route = { kind: 'home' } | { kind: 'project'; id: string };

export function parseRoute(hash: string): Route {
  const m = /^#\/p\/(.+)$/.exec(hash);
  return m ? { kind: 'project', id: decodeURIComponent(m[1]) } : { kind: 'home' };
}

export const routeHash = (r: Route): string => (r.kind === 'home' ? '#/' : `#/p/${encodeURIComponent(r.id)}`);
