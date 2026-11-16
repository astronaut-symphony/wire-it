import { MM, type Component } from '@/shared/types';

type P = [name: string, x: number, y: number]; // x,y in svg px (MM px per mm)

const row = (names: string[], x0: number, y: number, step = 10): P[] => names.map((n, i) => [n, x0 + i * step, y]);
const col = (names: string[], x: number, y0: number, step = 10): P[] => names.map((n, i) => [n, x, y0 + i * step]);

function make(id: string, name: string, w: number, h: number, body: string, pins: P[]): Component {
  return {
    id,
    name,
    w,
    h,
    mmW: w / MM,
    builtin: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`,
    pins: pins.map(([n, x, y], i) => ({ id: `p${i}`, name: n, x: x / w, y: y / h })),
  };
}

const label = (x: number, y: number, t: string, size = 12, fill = '#fff') =>
  `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" fill="${fill}" text-anchor="middle">${t}</text>`;

export const BUILTINS: Component[] = [
  make(
    'builtin-uno',
    'Arduino Uno',
    274,
    213,
    `<rect width="274" height="213" rx="8" fill="#0b7a8a"/>${label(137, 110, 'Arduino Uno', 18)}`,
    [
      ...row(['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'], 62, 10),
      ...row(['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'], 172, 10),
      ...row(['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND2', 'VIN'], 62, 203),
      ...row(['A0', 'A1', 'A2', 'A3', 'A4', 'A5'], 152, 203),
    ],
  ),
  make(
    'builtin-esp32',
    'ESP32 DevKit',
    112,
    206,
    `<rect width="112" height="206" rx="6" fill="#222"/><rect x="26" y="8" width="60" height="50" fill="#999"/>${label(56, 120, 'ESP32', 14)}`,
    [
      ...col(['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND', 'VIN'], 8, 30),
      ...col(['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND2', '3V3'], 104, 30),
    ],
  ),
  make(
    'builtin-led',
    'LED 5mm',
    40,
    80,
    `<line x1="15" y1="40" x2="15" y2="78" stroke="#888" stroke-width="2"/><line x1="25" y1="40" x2="25" y2="78" stroke="#888" stroke-width="2"/><circle cx="20" cy="25" r="18" fill="#ff4d4d" fill-opacity=".85" stroke="#900"/>`,
    [['A', 15, 78], ['K', 25, 78]],
  ),
  make(
    'builtin-resistor',
    'Resistor',
    120,
    30,
    `<line x1="4" y1="15" x2="116" y2="15" stroke="#888" stroke-width="2"/><rect x="28" y="6" width="64" height="18" rx="4" fill="#d9b779" stroke="#8a6d2f"/>`,
    [['1', 4, 15], ['2', 116, 15]],
  ),
  make(
    'builtin-button',
    'Push button',
    40,
    40,
    `<rect x="2" y="2" width="36" height="36" rx="4" fill="#333"/><circle cx="20" cy="20" r="10" fill="#999"/>`,
    [['1a', 6, 6], ['1b', 34, 6], ['2a', 6, 34], ['2b', 34, 34]],
  ),
];
