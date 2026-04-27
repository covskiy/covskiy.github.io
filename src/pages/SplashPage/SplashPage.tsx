import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import styles from './SplashPage.module.css';

gsap.registerPlugin(useGSAP);

interface SplashPageProps {
  onComplete: () => void;
}

function SplashPage({ onComplete }: SplashPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(localStorage.getItem('splashShown') === 'true');

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
          localStorage.setItem('splashShown', 'true');
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
        .to(`.${styles.intro}`, {
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
      <div className={styles.logo}>✦</div>
      <h1 className={styles.title}>Добро пожаловать</h1>
      <p className={styles.subtitle}>Загрузка...</p>
    </div>
  );
}

export default SplashPage;
