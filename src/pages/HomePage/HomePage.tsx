import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IntroAnimation, introStorage } from '../../components/IntroAnimation';
import { LandingSections } from '../../components';
import { useRegisterHomeSpacer } from '../../components/NewLayout/gsap/GsapLayoutBridge';
import { logger } from '../../utils/logger';
import styles from './HomePage.module.css';

/**
 * HomePage — лендинг с ScrollTrigger-анимацией навбара.
 *
 * Использует `useRegisterHomeSpacer` из нового движка: хук сам создаёт
 * ScrollTrigger на spacer-элементе и шлёт `REACH_TOP`/`REACH_BOTTOM`
 * в движок на границах прогресса.
 */
function HomePage() {
  const [showIntro, setShowIntro] = useState(
    () => !introStorage.getNeverShow() && !introStorage.getSessionSkip(),
  );
  const spacerRef = useRef<HTMLDivElement>(null);

  useRegisterHomeSpacer(spacerRef.current);

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

  useEffect(() => {
    if (!spacerRef.current) {
      logger.debug('HomePage', 'spacerRef.current отсутствует');
    }
  }, []);

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
