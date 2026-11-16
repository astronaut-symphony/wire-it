import { describe, expect, it } from 'vitest';
import { moveInOrder, moveWithin } from './layers';

describe('moveInOrder', () => {
  const o = ['a', 'b', 'c', 'd'];
  it('front / back', () => {
    expect(moveInOrder(o, 'b', 'front')).toEqual(['a', 'c', 'd', 'b']);
    expect(moveInOrder(o, 'c', 'back')).toEqual(['c', 'a', 'b', 'd']);
  });
  it('one step up / down, and no change at the ends', () => {
    expect(moveInOrder(o, 'a', 'up')).toEqual(['b', 'a', 'c', 'd']);
    expect(moveInOrder(o, 'd', 'down')).toEqual(['a', 'b', 'd', 'c']);
    expect(moveInOrder(o, 'd', 'up')).toEqual(o);
    expect(moveInOrder(o, 'a', 'down')).toEqual(o);
  });
  it('ignores an unknown id', () => {
    expect(moveInOrder(o, 'zzz', 'front')).toEqual(o);
  });
});

describe('moveWithin', () => {
  const items = [
    { id: 'c1', t: 'comp' },
    { id: 'j1', t: 'junction' },
    { id: 'c2', t: 'comp' },
    { id: 'c3', t: 'comp' },
  ];
  const comp = (x: { t: string }) => x.t === 'comp';
  it('re-stacks only among the matching items and keeps the others where they are', () => {
    expect(moveWithin(items, 'c1', 'front', comp).map((x) => x.id)).toEqual(['c2', 'j1', 'c3', 'c1']);
    expect(moveWithin(items, 'c3', 'back', comp).map((x) => x.id)).toEqual(['c3', 'j1', 'c1', 'c2']);
  });
  it('one step up skips over a non-matching neighbour instead of swapping with it', () => {
    expect(moveWithin(items, 'c1', 'up', comp).map((x) => x.id)).toEqual(['c2', 'j1', 'c1', 'c3']);
  });
});
