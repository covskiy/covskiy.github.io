import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IntroAnimation, introStorage } from '../../components/IntroAnimation';
import { LandingSections } from '../../components';
import { useNavbar } from '../../components/NavigationBar';
import { useBreakpoint } from '../../utils/breakpoints';
import { logger } from '../../utils/logger';
import styles from './HomePage.module.css';

/**
 * HomePage — лендинг с ScrollTrigger-анимацией навбара.
 *
 * ## Что делает
 * - Создаёт невидимый спейсер (100dvh) для обеспечения длины скролла
 * - Регистрирует ScrollTrigger через `useNavbar().registerScrollTrigger` —
 *   сам NavigationBar создаёт таймлайн и обновляет своё состояние на границах
 * - При скролле к началу страницы NavigationBar принудительно разворачивается
 *   в fullscreen (приоритет автоскролла над ручным toggle)
 *
 * ## Почему не через React State
 * Прогресс скролла НЕ передаётся в React State — GSAP управляет DOM напрямую
 * через timeline + scrub. Состояние навбара синхронизируется только
 * в дискретных точках (progress 0 и 1) внутри NavigationBar.
 */
function HomePage() {
  const [showIntro, setShowIntro] = useState(
    () => !introStorage.getNeverShow() && !introStorage.getSessionSkip(),
  );
  const spacerRef = useRef<HTMLDivElement>(null);
  const bp = useBreakpoint();
  const { registerScrollTrigger } = useNavbar();

  /**
   * Блокирует скролл body во время показа IntroAnimation.
   * При скрытии интро или размонтировании компонента восстанавливает скролл.
   */
  useEffect(() => {
    if (showIntro) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [showIntro]);

  /**
   * Регистрирует ScrollTrigger на спейсере для любого breakpoint.
   *
   * Провайдер создаёт таймлайн (ширина навбара + margin-left контента
   * на tablet/desktop) и сам убивает его в cleanup при размонтировании
   * страницы или смене breakpoint.
   */
  useEffect(() => {
    if (!spacerRef.current) {
      logger.debug('HomePage', 'spacerRef.current отсутствует');
      return;
    }
    return registerScrollTrigger(spacerRef.current);
  }, [registerScrollTrigger, bp]);

  return (
    <>
      <div ref={spacerRef} className={styles.spacer} />
      <LandingSections />
      {showIntro &&
        createPortal(
          <IntroAnimation
            onComplete={() => setShowIntro(false)}
            skipDelay={800}
          />,
          document.body,
        )}
    </>
  );
}

export default HomePage;
