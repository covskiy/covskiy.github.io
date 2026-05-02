import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

function initGsap() {
  gsap.registerPlugin(useGSAP);
  gsap.registerPlugin(SplitText);
  gsap.registerPlugin(ScrollTrigger);
}

export { initGsap };
