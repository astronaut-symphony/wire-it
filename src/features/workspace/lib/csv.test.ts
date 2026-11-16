import { describe, expect, it } from 'vitest';
import { toCsv, wireRows } from './csv';
import type { Component } from '@/shared/types';

describe('pin text', () => {
  it('shows number and label in the csv when a pin has both', () => {
    const comp: Component = {
      id: 'c', name: 'X', svg: '', w: 1, h: 1, mmW: 1,
      pins: [{ id: 'p0', name: '1', label: 'VCC', x: 0, y: 0 }, { id: 'p1', name: '2', x: 0, y: 0 }],
    };
    const nodes = [{ id: 'n', position: { x: 0, y: 0 }, data: { componentId: 'c', label: 'X 1' } }];
    const edges = [{ id: 'e', source: 'n', sourceHandle: 'p0', target: 'n', targetHandle: 'p1' }];
    expect(wireRows(nodes, edges, new Map([['c', comp]]))[1].slice(0, 2)).toEqual(['X 1.1 VCC', 'X 1.2']);
  });
});

describe('csv with a junction', () => {
  it('names the junction instead of a pin', () => {
    const comp: Component = {
      id: 'c', name: 'LED', svg: '', w: 1, h: 1, mmW: 1,
      pins: [{ id: 'p0', name: 'A', x: 0, y: 0 }],
    };
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: { componentId: 'c', label: 'LED 1' } },
      { id: 'j', type: 'junction', position: { x: 0, y: 0 }, data: { label: 'J1' } },
    ];
    const edges = [{ id: 'e', source: 'n1', sourceHandle: 'p0', target: 'j', targetHandle: 'j' }];
    expect(wireRows(nodes, edges, new Map([['c', comp]]))[1].slice(0, 2)).toEqual(['LED 1.A', 'J1']);
  });
});

describe('csv', () => {
  const comp: Component = {
    id: 'c', name: 'LED', svg: '', w: 1, h: 1, mmW: 1,
    pins: [{ id: 'p0', name: 'A', x: 0, y: 0 }, { id: 'p1', name: 'K', x: 0, y: 0 }],
  };
  it('maps edges to labelled pins and quotes commas', () => {
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: { componentId: 'c', label: 'LED 1' } },
      { id: 'n2', position: { x: 0, y: 0 }, data: { componentId: 'c', label: 'LED, 2' } },
    ];
    const edges = [{ id: 'e', source: 'n1', sourceHandle: 'p0', target: 'n2', targetHandle: 'p1', style: { stroke: '#f00' } }];
    const rows = wireRows(nodes, edges, new Map([['c', comp]]));
    expect(rows[1]).toEqual(['LED 1.A', 'LED, 2.K', '#f00']);
    expect(toCsv(rows).split('\n')[1]).toBe('LED 1.A,"LED, 2.K",#f00');
  });
});
