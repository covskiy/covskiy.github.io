import { createContext, useContext } from 'react';

export const RegisterScrollTriggerContext = createContext<
  ((el: HTMLElement) => () => void) | null
>(null);

export function useRegisterScrollTrigger(): (el: HTMLElement) => () => void {
  const fn = useContext(RegisterScrollTriggerContext);
  if (!fn) {
    throw new Error(
      'useRegisterScrollTrigger must be used inside <GsapProvider>',
    );
  }
  return fn;
}
