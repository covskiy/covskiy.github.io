import { useRef, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface PageTransitionProps {
  children: ReactNode;
}

function PageTransition({ children }: PageTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useGSAP(
    () => {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          containerRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
        );
      }, containerRef);

      return () => ctx.revert();
    },
    { scope: containerRef, dependencies: [location.pathname] },
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return <div ref={containerRef}>{children}</div>;
}

export default PageTransition;
