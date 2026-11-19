import { ActionIcon, ColorSwatch, Menu } from '@mantine/core';
import { Angle, Download, FileJson, FileSpreadsheet, Image } from 'lucide-react';
import '@/features/workspace/workspace.css';

export const WIRE_COLORS = ['#e03131', '#f08c00', '#f2c200', '#2f9e44', '#0c8599', '#1c7ed6', '#7048e8', '#8d5524', '#868e96', '#111111'];

export const WIRE_COLOR_NAMES: Record<string, string> = {
  '#e03131': 'Red', '#f08c00': 'Orange', '#f2c200': 'Yellow', '#2f9e44': 'Green', '#0c8599': 'Teal',
  '#1c7ed6': 'Blue', '#7048e8': 'Purple', '#8d5524': 'Brown', '#868e96': 'Gray', '#111111': 'Black',
};

type Props = {
  /** colour of the selected wire, else the colour new wires get */
  color: string;
  onColor: (c: string) => void;
  ortho: boolean;
  onOrtho: (on: boolean) => void;
  onExportProject: () => void;
  onExportPng: () => void;
  onExportCsv: () => void;
  canExportPng: boolean;
  canExportCsv: boolean;
};

const SIZE = 28; // same height as the project name next to them

/** Wire look and export, as icon-only buttons in a row (placed beside the project name). */
export function Toolbar(p: Props) {
  return (
    <>
      <Menu position="bottom-start" clickOutsideEvents={['pointerdown']}>
        <Menu.Target>
          <ActionIcon size={SIZE} variant="subtle" color="gray" title="Wire color" aria-label="Wire color">
            <ColorSwatch color={p.color} size={14} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {WIRE_COLORS.map((c) => (
            <Menu.Item key={c} leftSection={<ColorSwatch color={c} size={14} />} onClick={() => p.onColor(c)}>
              {WIRE_COLOR_NAMES[c]}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <ActionIcon
        size={SIZE}
        variant="subtle"
        c={p.ortho ? 'blue' : 'gray.5'} // on = blue icon, off = light gray like a disabled one; no filled background
        aria-label="Right angles"
        aria-pressed={p.ortho}
        title="Right angles"
        onClick={() => p.onOrtho(!p.ortho)}
      >
        <Angle size={16} />
      </ActionIcon>
      <Menu position="bottom-start" clickOutsideEvents={['pointerdown']}>
        <Menu.Target>
          <ActionIcon size={SIZE} variant="subtle" color="gray" title="Export" aria-label="Export">
            <Download size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<Image size={14} />} disabled={!p.canExportPng} onClick={p.onExportPng}>
            Export image (PNG)
          </Menu.Item>
          <Menu.Item leftSection={<FileSpreadsheet size={14} />} disabled={!p.canExportCsv} onClick={p.onExportCsv}>
            Export wire connections
          </Menu.Item>
          <Menu.Item leftSection={<FileJson size={14} />} onClick={p.onExportProject}>
            Export project
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}
