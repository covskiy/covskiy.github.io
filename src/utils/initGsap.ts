import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';

function initGsap() {
  gsap.registerPlugin(useGSAP);
  gsap.registerPlugin(SplitText);
  gsap.registerPlugin(ScrollTrigger);
  gsap.registerPlugin(MorphSVGPlugin);
}

export { initGsap };
