import { useState, type DragEvent } from 'react';
import { Button, Modal, Stack, Text, TextInput } from '@mantine/core';
import { ImagePlus } from 'lucide-react';
import { importImage, svgUrl, type Imported } from '@/shared/lib/importImage';
import { stashDraft } from '@/shared/lib/inbox';

/** Asks for a name and an image, then continues in the component editor, which opens in a new tab. */
export function NewComponentModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [img, setImg] = useState<Imported | null>(null);
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);

  const close = () => {
    setName('');
    setImg(null);
    setErr('');
    onClose();
  };

  async function pick(f?: File) {
    if (!f) return;
    try {
      setImg(await importImage(f));
      setErr('');
      setName((n) => n || f.name.replace(/\.[^.]+$/, ''));
    } catch {
      setErr('Could not read the image. Use PNG, JPG, WebP, GIF, BMP or SVG.');
    }
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void pick(e.dataTransfer.files[0]);
  };

  async function create() {
    if (!img || !name.trim()) return;
    await stashDraft({ name: name.trim(), img });
    window.open(`${location.pathname}?editor=1`, '_blank');
    close();
  }

  return (
    <Modal opened={opened} onClose={close} title="New component" centered>
      <Stack gap="sm">
        <TextInput label="Component name" value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        <label
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 140, padding: 12,
            border: `2px dashed ${over ? '#228be6' : '#ced4da'}`, borderRadius: 8, background: over ? '#e7f5ff' : '#f8f9fa', cursor: 'pointer',
          }}
        >
          {img ? (
            <img src={svgUrl(img.svg)} alt="" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
          ) : (
            <ImagePlus size={28} color="#868e96" />
          )}
          <Text size="sm" c="dimmed" ta="center">
            {img ? 'Drop or click to choose another image' : 'Drop an image here, or click to browse (PNG, JPG, WebP, GIF, BMP, SVG)'}
          </Text>
          <input type="file" accept="image/*,.svg" hidden onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
        {err && (
          <Text size="xs" c="red">
            {err}
          </Text>
        )}
        <Button disabled={!img || !name.trim()} onClick={() => void create()}>
          Create
        </Button>
      </Stack>
    </Modal>
  );
}
