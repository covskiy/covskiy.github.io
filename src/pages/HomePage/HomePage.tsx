import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { IntroAnimation, introStorage } from '../../components/IntroAnimation';
import { LandingSections } from '../../components';
import { useBreakpoint } from '../../utils/breakpoints';
import { logger } from '../../utils/logger';
import styles from './HomePage.module.css';

gsap.registerPlugin(ScrollTrigger);

/**
 * Имя кастомного события для синхронизации состояния навбара.
 *
 * NavigationBar слушает это событие и анимирует ширину/отступ,
 * когда ScrollTrigger фиксирует progress = 0 (верх) или progress = 1 (конец спейсера).
 *
 * @see {@link import('../../components/NavigationBar').NavigationBar}
 */
const STATE_EVENT = 'navbar:setstate';

/**
 * HomePage — лендинг с ScrollTrigger-анимацией навбара.
 *
 * ## Что делает
 * - Создаёт невидимый спейсер (100dvh) для обеспечения длины скролла
 * - ScrollTrigger с scrub синхронизирует ширину навбара с позицией скролла
 * - На tablet/desktop дополнительно анимирует margin-left контента
 * - При скролле к началу страницы принудительно разворачивает навбар в fullscreen
 *   (диспатчит custom event, который перехватывает NavigationBar)
 *
 * ## Почему не через React State
 * Прогресс скролла НЕ передаётся в React State — GSAP управляет DOM напрямую
 * через timeline + scrub. Состояние навбара (fullscreen / standard / slim)
 * синхронизируется только в дискретных точках (progress 0 и 1) через custom event.
 */
function HomePage() {
  const [showIntro, setShowIntro] = useState(
    () => !introStorage.getNeverShow() && !introStorage.getSessionSkip(),
  );
  const spacerRef = useRef<HTMLDivElement>(null);
  const bp = useBreakpoint();

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
   * ScrollTrigger для анимации навбара при скролле.
   *
   * Создаётся для любого breakpoint. Пересоздаётся только при смене bp
   * (например, поворот планшета).
   *
   * Анимации внутри timeline:
   * 1. `[data-navbar]` — ширина от 100vw до targetWidth
   * 2. `[data-content]` — margin-left от 0 до targetMargin (только tablet/desktop)
   *
   * @edge При быстром скролле `overwrite: 'auto'` гарантирует,
   *   что новый tween прерывает предыдущие конфликты.
   * @edge При скролле к началу (progress = 0) диспатчится событие
   *   `navbar:setstate` → NavigationBar принудительно разворачивается.
   */
  useGSAP(
    () => {
      if (!spacerRef.current) {
        logger.debug('HomePage', 'spacerRef.current отсутствует');
        return;
      }

      const isMobile = bp === 'mobile';
      const targetWidth = isMobile ? '0px' : '25vw';
      const targetMargin = isMobile ? '0px' : '25vw';
      const endState = isMobile ? 'invisible' : 'standard';

      logger.info('HomePage', 'Создание ScrollTrigger', {
        bp,
        targetWidth,
        targetMargin,
        endState,
      });

      const scrollConfig = {
        trigger: spacerRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self: ScrollTrigger) => {
          logger.trace(
            'HomePage',
            `ScrollTrigger.onUpdate progress=${self.progress.toFixed(4)}, direction=${self.direction}`,
          );

          if (self.progress === 0) {
            logger.info(
              'HomePage',
              'Скролл к началу — принудительный fullscreen',
            );
            window.dispatchEvent(
              new CustomEvent(STATE_EVENT, { detail: 'fullscreen' }),
            );
          } else if (self.progress >= 1) {
            logger.debug('HomePage', `Скролл к концу спейсера → ${endState}`);
            window.dispatchEvent(
              new CustomEvent(STATE_EVENT, { detail: endState }),
            );
          }
        },
      } satisfies ScrollTrigger.StaticVars;

      const tl = gsap.timeline({ scrollTrigger: scrollConfig });

      tl.to('[data-navbar]', {
        width: targetWidth,
        ease: 'none',
        overwrite: 'auto',
      });

      if (!isMobile) {
        tl.to(
          '[data-content]',
          {
            marginLeft: targetMargin,
            ease: 'none',
            overwrite: 'auto',
          },
          0,
        );
      }
    },
    { dependencies: [bp] },
  );

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
