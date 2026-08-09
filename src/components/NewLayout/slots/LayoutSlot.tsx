/**
 * LayoutSlot — контейнер слота layout-а.
 *
 * Регистрирует DOM-элемент в `engine.registerSlot(id, el)` через callback-ref.
 * Позиция/размеры применяются через CSS-переменные с root (см. `LayoutRoot`).
 *
 * Вертикальная модель (D5): inner-обёртка не нужна — высота навбара
 * не входит в расчёт (отступы только по X).
 */

import type { ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';
import { useLayoutEngine } from '../context/layoutContexts';

export type LayoutSlotId = 'navbar' | 'content';

export function LayoutSlot({
  id,
  children,
  className,
}: {
  id: LayoutSlotId;
  children: ReactNode;
  className?: string;
}) {
  const engine = useLayoutEngine();
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    engine.registerSlot(id, ref.current);
    return () => {
      engine.registerSlot(id, null);
    };
  }, [engine, id]);

  return (
    <div
      ref={ref}
      data-layout-slot={id}
      className={className ?? `layout-${id}`}
    >
      {children}
    </div>
  );
}
