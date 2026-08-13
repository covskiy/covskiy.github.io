import { createContext, useContext } from 'react';

export interface RegisterSpacerScrollTriggerValue {
  registerSpacerScrollTrigger: (el: HTMLElement) => () => void;
  getSpacerScrollProgress: () => number;
}

export const RegisterSpacerScrollTriggerContext =
  createContext<RegisterSpacerScrollTriggerValue | null>(null);

export function useRegisterSpacerScrollTrigger(): RegisterSpacerScrollTriggerValue {
  const value = useContext(RegisterSpacerScrollTriggerContext);
  if (!value) {
    throw new Error(
      'useRegisterSpacerScrollTrigger must be used inside <GsapProvider>',
    );
  }
  return value;
}
