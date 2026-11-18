import type { ReactNode } from 'react';
import { Modal } from '@mantine/core';
import './app-modal.css';

type Props = { opened: boolean; onClose: () => void; title: ReactNode; size?: string; footer?: ReactNode; children: ReactNode };

/** Every dialog in the app: a header (title), the content and a footer (the buttons), with a line between each. */
export function AppModal({ opened, onClose, title, size, footer, children }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size={size} centered padding={0} classNames={{ header: 'amodal-head', title: 'amodal-title' }}>
      <div className="amodal-content">{children}</div>
      {footer && <div className="amodal-foot">{footer}</div>}
    </Modal>
  );
}
