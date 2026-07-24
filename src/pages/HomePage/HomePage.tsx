import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IntroAnimation, introStorage } from '../../components/IntroAnimation';
import { LandingSections } from '../../components';

function HomePage() {
  const [showIntro, setShowIntro] = useState(
    () => !introStorage.getNeverShow() && !introStorage.getSessionSkip(),
  );

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
