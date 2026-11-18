import { describe, expect, it } from 'vitest';
import { rotateImage } from './importImage';

describe('rotateImage', () => {
  it('swaps the size and turns the content a quarter clockwise', () => {
    const r = rotateImage({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"></svg>', w: 40, h: 20 });
    expect([r.w, r.h]).toEqual([20, 40]);
    expect(r.svg).toContain('viewBox="0 0 20 40"');
    expect(r.svg).toContain('translate(20 0) rotate(90)');
    expect(r.svg).toContain('<svg width="40" height="20" xmlns');
  });
});
