/**
 * renderHookLite — минимальный рендер-хелпер для хуков без
 * `@testing-library/react` (0 новых devDeps, только `react` + `react-dom/client`).
 *
 * Специфичен для мок-инфраструктуры тестов layout-движка: реальный
 * `createRoot` + `act` из `react` (React 19). Жизненный цикл useGSAP
 * (вызов колбэка + cleanup при смене deps/unmount) обрабатывает сам мок
 * `@gsap/react` из `setupGsapMock` через настоящий `useLayoutEffect` —
 * renderHookLite лишь рендерит и перерисовывает компонент-обёртку.
 */

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

export interface RenderHookResult<TResult> {
  result: { current: TResult };
  rerender: (hookFn: () => TResult) => void;
  unmount: () => void;
}

export function renderHookLite<TResult>(
  hookFn: () => TResult,
  options?: {
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
    onMount?: (root: HTMLElement) => void;
  },
): RenderHookResult<TResult> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const result: { current: TResult } = { current: undefined as TResult };
  let root: Root | null = null;
  let currentHookFn = hookFn;
  const Wrapper = options?.wrapper ?? (({ children }) => <>{children}</>);

  function Probe() {
    result.current = currentHookFn();
    return null;
  }

  act(() => {
    root = createRoot(container);
    root.render(
      <Wrapper>
        <Probe />
      </Wrapper>,
    );
  });
  options?.onMount?.(container);

  return {
    result,
    rerender(next) {
      currentHookFn = next;
      act(() => {
        root!.render(
          <Wrapper>
            <Probe />
          </Wrapper>,
        );
      });
    },
    unmount() {
      act(() => {
        root!.unmount();
      });
      container.remove();
    },
  };
}
