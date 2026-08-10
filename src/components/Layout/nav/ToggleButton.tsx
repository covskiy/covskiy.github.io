/**
 * ToggleButton — кнопка toggle (☰ / ←) для вертикального навбара.
 *
 * Декомпозиция (см. план §II.5):
 * - читает `useLayoutSnapshot()` для глифа/aria;
 * - `onClick` → `useLayoutSend()({ type: 'TOGGLE' })`;
 * - mobile-toggle видимость управляется через CSS (data-атрибут / class),
 *   либо явный GSAP-set, если потребуется 60fps.
 *
 * Placement: на mobile — fixed-сиблинг навбара (вне трансформированного
 * окна); на tablet — внутри навбара, едет с его краем.
 */

import { useBreakpoint } from '../../../utils/breakpoints';
import { useLayoutSend, useLayoutSnapshot } from '../context/layoutContexts';
import styles from './ToggleButton.module.css';

export interface ToggleButtonProps {
  isSlim: boolean;
  hasToggle: boolean;
}

export function ToggleButton({ isSlim, hasToggle }: ToggleButtonProps) {
  const snapshot = useLayoutSnapshot();
  const send = useLayoutSend();
  const bp = useBreakpoint();

  if (!hasToggle) return null;

  const positionClass =
    bp === 'mobile' ? styles.toggleBtnFixed : styles.toggleBtnAbsolute;

  const handleClick = () => {
    send({ type: 'TOGGLE' });
  };

  return (
    <button
      className={`${styles.toggleBtn} ${positionClass}`}
      onClick={handleClick}
      aria-label={isSlim ? 'Open navigation' : 'Close navigation'}
      type="button"
      data-layout-state={snapshot.value}
    >
      {isSlim ? '☰' : '←'}
    </button>
  );
}
