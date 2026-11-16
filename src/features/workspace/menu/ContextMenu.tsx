import { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import type { MenuItem, MenuState } from './menu';
import '@/features/workspace/workspace.css';

function Items({ items, close, flip }: { items: MenuItem[]; close: () => void; flip: boolean }) {
  return (
    <>
      {items.map((it) =>
        it.children ? (
          <div
            className="ctx-item"
            key={it.label}
            onMouseEnter={(e) => {
              // keep the submenu on screen: shift it up by however much it overflows the bottom
              const sub = e.currentTarget.querySelector<HTMLElement>('.sub');
              if (!sub) return;
              sub.style.top = '-5px';
              const over = sub.getBoundingClientRect().bottom - (innerHeight - 8);
              if (over > 0) sub.style.top = `${-5 - over}px`;
            }}
          >
            <button className="has-sub" disabled={it.disabled}>
              <span className="lbl">{it.icon}{it.label}</span>
              <ChevronRight size={14} />
            </button>
            <div className={`ctx sub${flip ? ' flip' : ''}`}>
              <Items items={it.children} close={close} flip={flip} />
            </div>
          </div>
        ) : (
          <button
            key={it.label}
            className={it.danger ? 'danger' : ''}
            disabled={it.disabled}
            onClick={() => {
              it.onClick?.();
              close();
            }}
          >
            {it.icon}
            {it.label}
          </button>
        ),
      )}
    </>
  );
}

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);
  const left = Math.min(menu.x, innerWidth - 200);
  return (
    <div
      ref={ref}
      className="ctx"
      style={{ left, top: Math.min(menu.y, innerHeight - menu.items.length * 32 - 12) }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Items items={menu.items} close={onClose} flip={left > innerWidth - 420} />
    </div>
  );
}
