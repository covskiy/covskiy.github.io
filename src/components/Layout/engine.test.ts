/**
 * Контракт внешнего layout-движка (не-React слой).
 *
 * Проверяет `createLayoutEngine()`:
 * - подписку и уведомления (`subscribe`/`notify`),
 * - снапшоты и режимы (`getSnapshot`/`getMode`),
 * - реакцию на ширину вьюпорта и признак home-страницы,
 * - регистрацию слотов и `dispose`.
 *
 * Термины: см. docs/Components/Layout/testing.md.
 */

import { describe, expect, it, vi } from 'vitest';
import { createLayoutEngine } from './engine';
import { homeEndStateFor } from './machine/derive';
import type { LayoutSnapshot } from './machine/layoutSnapshot';
import type { Breakpoint } from './machine/layoutMode';

function makeContext(bp: Breakpoint, isHome: boolean, preferred = null) {
  return {
    bp,
    isHome,
    preferred,
    lastSource: 'route' as const,
    source: 'route' as const,
    homeEndState: homeEndStateFor(bp, preferred),
  };
}

function makeEngine(bp: Breakpoint, isHome: boolean) {
  return createLayoutEngine({
    initialContext: makeContext(bp, isHome),
  });
}

describe('подписка и уведомления', () => {
  it('когда навбар реально меняет режим, подписчики получают снапшот с актуальным состоянием', () => {
    // Arrange: движок на /home в mobile, подписан listener.
    const engine = makeEngine('mobile', true);
    const fn = vi.fn<(snap: LayoutSnapshot) => void>();
    engine.subscribe(fn);

    // Act: бургер сворачивает навбар.
    engine.send({ type: 'TOGGLE' });

    // Assert: ровно одно уведомление с новым режимом и источником.
    expect(fn).toHaveBeenCalledTimes(1);
    const snap = fn.mock.calls[0][0];
    expect(snap?.value).toBe('invisible');
    expect(snap?.context.source).toBe('toggle');
    expect(engine.getMode()).toBe('invisible');
    expect(engine.getSnapshot().value).toBe('invisible');
  });

  it('когда событие не меняет ни состояние, ни источник, уведомлений нет', () => {
    // Arrange: mobile, не home, default-состояние скрыто (уже invisible).
    const engine = createLayoutEngine({
      initialContext: makeContext('mobile', false),
    });
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: смена роута, которая ничего не меняет.
    engine.send({ type: 'ROUTE_CHANGED' });

    // Assert: без уведомлений, режим прежний.
    expect(fn).not.toHaveBeenCalled();
    expect(engine.getMode()).toBe('invisible');
  });

  it('когда изменение отсутствует, но источник события сменился, уведомление всё равно приходит', () => {
    // Arrange: desktop, /home — бургера нет, TOGGLE не меняет режим.
    const engine = makeEngine('desktop', true);
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: TOGGLE на desktop (переход — «no-op»).
    engine.send({ type: 'TOGGLE' });

    // Assert: режим не изменился, но notify пришёл — из-за смены source (route → toggle).
    expect(engine.getMode()).toBe('fullscreen');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().value).toBe('fullscreen');
  });

  it('когда подписку отключили, дальнейшие события не уведомляют', () => {
    // Arrange: движок с подписчиком и отпиской.
    const engine = makeEngine('mobile', true);
    const fn = vi.fn();
    const off = engine.subscribe(fn);
    off();

    // Act: переход, который раньше уведомил бы.
    engine.send({ type: 'TOGGLE' });

    // Assert: без уведомлений.
    expect(fn).not.toHaveBeenCalled();
  });

  it('когда приходит событие, его источник и bp попадают в контекст снапшота', () => {
    // Arrange: tablet, не home.
    const engine = createLayoutEngine({
      initialContext: makeContext('tablet', false),
    });

    // Act: сообщение о смене брейкпоинта на mobile.
    engine.send({ type: 'BREAKPOINT_CHANGED', bp: 'mobile' });

    // Assert: снапшот несёт source и bp события.
    expect(engine.getSnapshot().context.source).toBe('breakpoint');
    expect(engine.getSnapshot().bp).toBe('mobile');
  });
});

describe('ширина вьюпорта', () => {
  it('когда меняется ширина вьюпорта, снапшот пересчитывается без перехода режима', () => {
    // Arrange: движок на tablet с подписчиком.
    const engine = makeEngine('tablet', false);
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: изменение ширины.
    engine.setViewport(800);

    // Assert: уведомление есть, режим прежний, transition мгновенный (без анимации).
    expect(fn).toHaveBeenCalledTimes(1);
    expect(engine.getMode()).toBe('slim');
    expect(engine.getSnapshot().transition.duration).toBe(0);
    expect(engine.getSnapshot().transition.ease).toBe('none');
  });

  it('когда вьюпорт не изменился, уведомлений нет', () => {
    // Arrange: движок на tablet (дефолтный вьюпорт 1024).
    const engine = makeEngine('tablet', false);
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: установка той же ширины.
    engine.setViewport(1024);

    // Assert: без уведомлений.
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('признак home-страницы', () => {
  it('когда меняется признак home, контекст обновляется и подписчики уведомляются', () => {
    // Arrange: движок настроен как «не home».
    const engine = makeEngine('mobile', false);
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: сайт перешли на /home.
    engine.setIsHome(true);

    // Assert: контекст обновлён, режим не тронут.
    expect(fn).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().context.isHome).toBe(true);
    expect(engine.getMode()).toBe('invisible');
  });

  it('когда признак home тот же, уведомлений нет', () => {
    // Arrange: движок уже «не home».
    const engine = makeEngine('mobile', false);
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: повторная установка того же значения.
    engine.setIsHome(false);

    // Assert: без уведомлений.
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('слоты и освобождение ресурсов', () => {
  it('когда регистрируют и снимают слот, движок не падает', () => {
    // Arrange: движок на tablet, fake-элемент слота.
    const engine = makeEngine('tablet', false);
    const el = {} as HTMLElement;

    // Act: регистрация, снятие и запрос несуществующего слота.
    expect(() => {
      engine.registerSlot('nav', el);
      engine.registerSlot('nav', null);
      engine.registerSlot('missing', null);
    }).not.toThrow();

    // Assert: не выброшено; ресурсы освобождаются в dispose.
    engine.dispose();
  });

  it('когда движок dispose-ни, подписчики больше не уведомляются', () => {
    // Arrange: движок с подписчиком.
    const engine = makeEngine('mobile', true);
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: dispose, затем событие, которое раньше уведомило бы.
    engine.dispose();
    engine.send({ type: 'TOGGLE' });

    // Assert: без уведомлений.
    expect(fn).not.toHaveBeenCalled();
  });
});
