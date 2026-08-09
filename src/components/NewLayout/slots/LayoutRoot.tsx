/**
 * LayoutRoot — корневая нода, на которой живут CSS-переменные layout-а.
 *
 * Использование:
 *   <NewLayoutProvider>
 *     <GsapProvider>
 *       <GsapLayoutBridge />
 *       <LayoutRoot>
 *         <LayoutSlot id="navbar">...</LayoutSlot>
 *         <LayoutSlot id="content">...</LayoutSlot>
 *       </LayoutRoot>
 *     </GsapProvider>
 *   </NewLayoutProvider>
 */

import { useRef, type PropsWithChildren } from 'react';
import { useLayoutApplier } from './useLayoutApplier';

export function LayoutRoot({ children }: PropsWithChildren) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useLayoutApplier(rootRef);

  return (
    <div ref={rootRef} className="layout-root">
      {children}
    </div>
  );
}
