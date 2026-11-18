import { describe, expect, it } from 'vitest';
import { parsePage, parseRoute, routePath } from './route';

describe('route', () => {
  it('the root, or an unknown path, is the home page', () => {
    expect(parseRoute('')).toEqual({ kind: 'home' });
    expect(parseRoute('/')).toEqual({ kind: 'home' });
    expect(parseRoute('/whatever')).toEqual({ kind: 'home' });
  });
  it('/project/<id> is a project, and the id survives a round trip', () => {
    expect(parseRoute('/project/abc-123')).toEqual({ kind: 'project', id: 'abc-123' });
    const id = 'a b/c?d';
    expect(parseRoute(routePath({ kind: 'project', id }))).toEqual({ kind: 'project', id });
    expect(routePath({ kind: 'home' })).toBe('/');
  });
  it('component pages are not canvas routes', () => {
    expect(parsePage('/components')).toEqual({ kind: 'components' });
    expect(parsePage('/component/x1')).toEqual({ kind: 'component', id: 'x1' });
    expect(parsePage(routePath({ kind: 'component', id: 'new' }))).toEqual({ kind: 'component', id: 'new' });
    expect(parseRoute('/components')).toEqual({ kind: 'home' });
    expect(parseRoute('/component/x1')).toEqual({ kind: 'home' });
  });
});
