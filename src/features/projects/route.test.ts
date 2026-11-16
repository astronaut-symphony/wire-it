import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash } from './route';

describe('route', () => {
  it('no hash, or an unknown one, is the home page', () => {
    expect(parseRoute('')).toEqual({ kind: 'home' });
    expect(parseRoute('#/')).toEqual({ kind: 'home' });
    expect(parseRoute('#/whatever')).toEqual({ kind: 'home' });
  });
  it('#/p/<id> is a project, and the id survives a round trip', () => {
    expect(parseRoute('#/p/abc-123')).toEqual({ kind: 'project', id: 'abc-123' });
    const id = 'a b/c?d';
    expect(parseRoute(routeHash({ kind: 'project', id }))).toEqual({ kind: 'project', id });
    expect(routeHash({ kind: 'home' })).toBe('#/');
  });
});
