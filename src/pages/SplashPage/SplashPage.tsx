import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import styles from './SplashPage.module.css';
import Keyboard from '../../assets/keyboard.svg?react';

// gsap.registerPlugin(useGSAP);

interface SplashPageProps {
  onComplete: () => void;
}

// interface LogoProps {
//   timeline: GSAPTimeline;
// }

// function Logo({ timeline }: LogoProps) {
//   return (
//     <>

//     </>
//   );
// }

function SplashPage({ onComplete }: SplashPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // const hasAnimatedRef = useRef(localStorage.getItem('splashShown') === 'true');
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (hasAnimatedRef.current) {
      onComplete();
    }
  }, [onComplete]);

  useGSAP(
    () => {
      if (hasAnimatedRef.current) return;

      const tl = gsap.timeline({
        onComplete: () => {
          // localStorage.setItem('splashShown', 'true');
          onComplete();
        },
      });

      tl.fromTo(
        `.${styles.logo}`,
        { opacity: 0, scale: 0.5, rotation: -45 },
        {
          opacity: 1,
          scale: 1,
          rotation: 0,
          duration: 0.8,
          ease: 'back.out(1.7)',
        },
      )
        .fromTo(
          `.${styles.title}`,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' },
          '-=0.3',
        )
        .fromTo(
          `.${styles.subtitle}`,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
          '-=0.2',
        )
        // .to(`.${styles.intro}`, {
        .to(containerRef.current, {
          opacity: 0,
          duration: 0.5,
          delay: 0.3,
          ease: 'power2.inOut',
        });
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className={styles.intro}>
      <h1 className={styles.logo}>Covsky</h1>
      <Keyboard />
      {/* <div className={styles.logo}>✦</div> */}
      <h1 className={styles.title}>Добро пожаловать</h1>
      <p className={styles.subtitle}>Загрузка...</p>
    </div>
  );
}

export default SplashPage;
