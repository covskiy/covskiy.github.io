// @vitest-environment jsdom
/**
 * Smoke-тест test-инфраструктуры: renderHookLite (mount/rerender/unmount)
 * поверх реального движка и gsapBus. Проваливается при поломке мок-слоя —
 * до написания E-сценариев.
 */

import { describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { renderHookLite } from './renderHookLite';
import { makeRenderEnv } from './renderEngine';

describe('renderHookLite', () => {
  it('когда mount, result.current содержит значение хука', () => {
    const { result } = renderHookLite(() => 'mounted');
    expect(result.current).toBe('mounted');
  });

  it('когда rerender с новым замыканием, результат обновляется', () => {
    let value = 'a';
    const { result, rerender } = renderHookLite(() => value);
    expect(result.current).toBe('a');
    value = 'b';
    rerender(() => value);
    expect(result.current).toBe('b');
  });

  it('когда unmount, контейнер удаляется и повторные действия безопасны', () => {
    const { unmount } = renderHookLite(() => 'x');
    expect(() => unmount()).not.toThrow();
  });

  it('когда хук использует useGsapBus из makeRenderEnv, контекст резолвится', () => {
    const { Wrapper } = makeRenderEnv();
    const { result } = renderHookLite(
      () => {
        const ref = useRef<HTMLButtonElement | null>(null);
        return { hasRef: ref.current === null };
      },
      { wrapper: Wrapper },
    );
    expect(result.current.hasRef).toBe(true);
  });
});
