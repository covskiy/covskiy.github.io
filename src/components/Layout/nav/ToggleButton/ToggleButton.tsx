/**
 * ToggleButton — кнопка toggle (☰ / ←) для вертикального навбара.
 *
 * Декомпозиция (см. план §II.5):
 * - `onClick` → `useLayoutSend()({ type: 'TOGGLE' })`;
 * - глиф и aria зависят от `isSlim` из пропсов;
 * - mobile-toggle видимость управляется через CSS-класс позиционирования,
 *   либо явный GSAP-set, если потребуется 60fps.
 *
 * Placement: на mobile — fixed-сиблинг навбара (вне трансформированного
 * окна); на tablet — внутри навбара, едет с его краем.
 */

import { useBreakpoint } from '../../../../utils/breakpoints';
import { useLayoutSend } from '../../context/layoutContexts';
import styles from './ToggleButton.module.css';

export interface ToggleButtonProps {
  isSlim: boolean;
  hasToggle: boolean;
}

export function ToggleButton({ isSlim, hasToggle }: ToggleButtonProps) {
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
    >
      {isSlim ? '☰' : '←'}
    </button>
  );
}
