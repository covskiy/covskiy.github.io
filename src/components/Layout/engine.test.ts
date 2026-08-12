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

function makeContext(
  bp: Breakpoint,
  isHome: boolean,
  preferred = null,
  manualOverride = false,
) {
  return {
    bp,
    isHome,
    preferred,
    lastSource: 'route' as const,
    source: 'route' as const,
    homeEndState: homeEndStateFor(bp, preferred),
    manualOverride,
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

describe('освобождение ресурсов', () => {
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

describe('проброс сайд-эффектов (subscribeActions)', () => {
  it('когда на mobile /home жмут TOGGLE из fullscreen, слушатель получает NOTIFY_NAV_STATE и SCROLL_TO_END', () => {
    // Arrange: движок на mobile /home, подписанный на actions.
    const engine = makeEngine('mobile', true);
    const fn = vi.fn<(actions: readonly { type: string }[]) => void>();
    engine.subscribeActions(fn);

    // Act: сворачивание навбара бургером.
    engine.send({ type: 'TOGGLE' });

    // Assert: опубликованы оба сайд-эффекта (SCROLL_TO_END — доскролл спейсера).
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].map((a) => a.type)).toEqual([
      'NOTIFY_NAV_STATE',
      'SCROLL_TO_END',
    ]);
    expect(engine.getMode()).toBe('invisible');
  });

  it('когда вне /home mobile разворачивают навбар, SCROLL_TO_END не эмитится', () => {
    // Arrange: mobile, не home.
    const engine = makeEngine('mobile', false);
    const fn = vi.fn<(actions: readonly { type: string }[]) => void>();
    engine.subscribeActions(fn);

    // Act: TOGGLE из invisible в fullscreen.
    engine.send({ type: 'TOGGLE' });

    // Assert: только уведомление о смене режима, без доскролла.
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].map((a) => a.type)).toEqual([
      'NOTIFY_NAV_STATE',
    ]);
  });

  it('когда desktop TOGGLE ничего не меняет, actions не диспатчатся', () => {
    // Arrange: desktop /home — бургера нет.
    const engine = makeEngine('desktop', true);
    const fn = vi.fn();
    engine.subscribeActions(fn);

    // Act: TOGGLE — no-op с пустым массивом actions.
    engine.send({ type: 'TOGGLE' });

    // Assert: пустые actions не публикуются.
    expect(fn).not.toHaveBeenCalled();
  });

  it('когда на tablet переключают колонку, слушатель получает RETARGET_SCRUB', () => {
    // Arrange: tablet, не home.
    const engine = makeEngine('tablet', false);
    const fn = vi.fn<(actions: readonly { type: string }[]) => void>();
    engine.subscribeActions(fn);

    // Act: TOGGLE standard → slim.
    engine.send({ type: 'TOGGLE' });

    // Assert: сайд-эффект ретаргета scrub-твина присутствует.
    expect(fn.mock.calls[0][0].map((a) => a.type)).toEqual([
      'NOTIFY_NAV_STATE',
      'RETARGET_SCRUB',
    ]);
  });

  it('когда отписку сняли или движок dispose-нут, actions больше не приходят', () => {
    // Arrange: движок с подписчиком actions.
    const engine = makeEngine('mobile', true);
    const fn = vi.fn();
    const off = engine.subscribeActions(fn);
    off();

    // Act: переход, который раньше опубликовал бы actions.
    engine.send({ type: 'TOGGLE' });

    // Assert: отписка сработала.
    expect(fn).not.toHaveBeenCalled();

    // Act: новый слушатель, затем dispose.
    const fn2 = vi.fn();
    engine.subscribeActions(fn2);
    engine.dispose();
    engine.send({ type: 'TOGGLE' });

    // Assert: dispose очистил слушателей actions.
    expect(fn2).not.toHaveBeenCalled();
  });
});

describe('ручной override manualOverride', () => {
  it('когда на mobile /home жмут TOGGLE из fullscreen, навбар сворачивается и ручной флаг снимается', () => {
    // Arrange: движок на mobile /home, подписчик.
    const engine = makeEngine('mobile', true);
    const fn = vi.fn<(snap: LayoutSnapshot) => void>();
    engine.subscribe(fn);

    // Act: TOGGLE из fullscreen.
    engine.send({ type: 'TOGGLE' });

    // Assert: контекст и снапшот публикуют снятый manualOverride / isManualToggle.
    const snap = engine.getSnapshot();
    expect(snap.context.manualOverride).toBe(false);
    expect(snap.isManualToggle).toBe(false);
    expect(snap.value).toBe('invisible');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('когда после ручного закрытия навбара приходит REACH_BOTTOM, state и флаг не меняются', () => {
    // Arrange: движок на mobile /home с вручную открытым навбаром
    // (fullscreen + manualOverride=true) и подписчиком.
    const engine = createLayoutEngine({
      initialContext: makeContext('mobile', true, null, true),
      initialMode: 'fullscreen',
    });
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: ручное закрытие бургером, затем REACH_BOTTOM (подтяжка контента).
    engine.send({ type: 'TOGGLE' });
    engine.send({ type: 'REACH_BOTTOM' });

    // Assert: навбар закрыт, ручной флаг снят и не «держится» на дне.
    expect(engine.getMode()).toBe('invisible');
    expect(engine.getSnapshot().context.manualOverride).toBe(false);
    expect(engine.getSnapshot().isManualToggle).toBe(false);
  });

  it('когда после ручного override приходит REACH_TOP, флаг сбрасывается в false', () => {
    // Arrange: движок на mobile /home с manualOverride=true.
    const engine = createLayoutEngine({
      initialContext: makeContext('mobile', true, null, true),
    });
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: REACH_TOP.
    engine.send({ type: 'REACH_TOP' });

    // Assert: флаг сброшен, снапшот пересчитан.
    expect(engine.getSnapshot().context.manualOverride).toBe(false);
    expect(engine.getSnapshot().isManualToggle).toBe(false);
    expect(engine.getMode()).toBe('fullscreen');
  });

  it('corner: manual mobile fullscreen + 2× REACH_BOTTOM — state и override сохраняются', () => {
    // Arrange: движок с manualOverride=true, режим fullscreen.
    const engine = createLayoutEngine({
      initialContext: makeContext('mobile', true, null, true),
      initialMode: 'fullscreen',
    });
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: двойной REACH_BOTTOM — первый меняет source (route→scroll),
    // второй уже source=scroll и state не меняется.
    engine.send({ type: 'REACH_BOTTOM' });
    const callsAfterFirst = fn.mock.calls.length;
    engine.send({ type: 'REACH_BOTTOM' });

    // Assert: после обоих событий режим и флаг сохранились; второй вызов
    // не уведомляет (state/source/manual неизменны).
    expect(engine.getMode()).toBe('fullscreen');
    expect(engine.getSnapshot().context.manualOverride).toBe(true);
    expect(fn.mock.calls.length - callsAfterFirst).toBe(0);
  });

  it('когда флаг сбрасывается false→false, но source/bp поменялись, уведомление всё равно приходит', () => {
    // Arrange: mobile /home, manualOverride=false, подписчик.
    const engine = makeEngine('mobile', true);
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: REACH_TOP — флаг сбросится в false (false→false), но state поменяется.
    engine.send({ type: 'REACH_TOP' });

    // Assert: уведомление есть (state changed).
    expect(fn).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().context.manualOverride).toBe(false);
  });

  it('когда флаг true→true и state/bp/source не меняются на повторном REACH_BOTTOM, второго уведомления нет', () => {
    // Arrange: mobile /home, manualOverride=true, режим invisible.
    const engine = createLayoutEngine({
      initialContext: makeContext('mobile', true, null, true),
      initialMode: 'invisible',
    });
    const fn = vi.fn();
    engine.subscribe(fn);

    // Act: первый REACH_BOTTOM — preserve true (true→true), state=invisible (не меняется).
    engine.send({ type: 'REACH_BOTTOM' });
    const callsAfterFirst = fn.mock.calls.length;

    // Act: второй REACH_BOTTOM — тот же сценарий.
    engine.send({ type: 'REACH_BOTTOM' });

    // Assert: первый вызов уведомил (source route→scroll), второй — нет
    // (source остаётся scroll, mode остаётся invisible, manual true→true).
    expect(fn.mock.calls.length - callsAfterFirst).toBe(0);
    expect(engine.getSnapshot().context.manualOverride).toBe(true);
    expect(engine.getMode()).toBe('invisible');
  });
});
