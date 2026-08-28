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

import { useRef } from 'react';
import { useBreakpoint } from '../../../../utils/breakpoints';
import { useLayoutSend } from '../../context/layoutContexts';
import styles from './ToggleButton.module.css';
import { useToggleVisibility } from './useToggleVisibility';
import { logger } from '../../../../utils/logger';

export interface ToggleButtonProps {
  isSlim: boolean;
  hasToggle: boolean;
  isHome: boolean;
  isManualToggle: boolean;
}

export function ToggleButton({
  isSlim,
  hasToggle,
  isHome,
  isManualToggle,
}: ToggleButtonProps) {
  const send = useLayoutSend();
  const bp = useBreakpoint();
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useToggleVisibility(btnRef, { isHome, isManualToggle });

  if (!hasToggle) return null;

  const positionClass =
    bp === 'mobile' ? styles.toggleBtnFixed : styles.toggleBtnAbsolute;

  const handleClick = () => {
    logger.debug('ToggleButton', 'click → TOGGLE');
    send({ type: 'TOGGLE' });
  };

  const startHidden = isHome && !isManualToggle;

  return (
    <button
      ref={btnRef}
      className={`${styles.toggleBtn} ${positionClass} ${startHidden ? styles.isHidden : ''}`}
      onClick={handleClick}
      aria-label={isSlim ? 'Open navigation' : 'Close navigation'}
      type="button"
    >
      {isSlim ? '☰' : '←'}
    </button>
  );
}
