import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IntroAnimation, introStorage } from '../../components/IntroAnimation';
import { LandingSections } from '../../components';
import { useRegisterSpacerScrollTrigger } from '../../components/Layout/gsap/useRegisterSpacerScrollTrigger';
import styles from './HomePage.module.css';

function HomePage() {
  const [showIntro, setShowIntro] = useState(
    () => !introStorage.getNeverShow() && !introStorage.getSessionSkip(),
  );
  const spacerRef = useRef<HTMLDivElement>(null);
  const { registerSpacerScrollTrigger } = useRegisterSpacerScrollTrigger();

  useEffect(() => {
    if (spacerRef.current) {
      return registerSpacerScrollTrigger(spacerRef.current);
    }
  }, [registerSpacerScrollTrigger]);

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
