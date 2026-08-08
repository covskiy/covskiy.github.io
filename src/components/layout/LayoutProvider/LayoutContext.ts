import { createContext, useContext } from 'react';
import type { LayoutChangeSource, LayoutMode } from '../machine/layoutMode';

/** Payload низкоуровневого канала прогресса скролла (60fps, scrub `/home`). */
export interface ScrollProgress {
  progress: number;
  direction: 1 | -1;
}

/** Listener канала прогресса скролла. */
export type ScrollProgressListener = (p: ScrollProgress) => void;

/** Listener канала видимости кнопки toggle (scrub-производная). */
export type ToggleVisibilityListener = (visible: boolean) => void;

/** Payload низкоуровневого канала смены состояния раскладки для `.nav`. */
export interface NavStateChange {
  prev: LayoutMode;
  next: LayoutMode;
  source: LayoutChangeSource;
}

/** Listener канала смены состояния раскладки. */
export type NavStateListener = (change: NavStateChange) => void;

/**
 * API, который `LayoutProvider` прокидывает страницам и дочерним компонентам
 * через React Context. Единственный источник состояния — `mode`; каждый
 * компонент сам строит свои GSAP-анимации из него (per-component animator).
 * Никакой pub/sub/шины/медиатора.
 */
export interface LayoutContextValue {
  /** Текущее состояние раскладки (single source of truth). */
  mode: LayoutMode;
  /** Признак свёрнутого навбара (`slim`/`invisible`). */
  isSlim: boolean;
  /** Доступна ли кнопка toggle (mobile/tablet). */
  hasToggle: boolean;
  /** Ручное переключение состояния (клик по ☰ / ←). */
  toggle: () => void;
  /**
   * Регистрирует ScrollTrigger, привязанный к элементу-триггеру со страницы
   * (контракт `HomePage`). Возвращает cleanup, убивающий триггер и таймлайн.
   */
  registerScrollTrigger: (trigger: HTMLElement) => () => void;
  /**
   * Подписка на прогресс скролла БЕЗ React-re-render. Listener вызывается
   * напрямую из `ScrollTrigger.onUpdate` (60fps). Возвращает unsubscribe.
   */
  onScrollProgress: (listener: ScrollProgressListener) => () => void;
  /**
   * Подписка на видимость кнопки toggle БЕЗ React-re-render. Listener
   * вызывается из `ScrollTrigger.onUpdate`. Возвращает unsubscribe.
   */
  onToggleVisibility: (listener: ToggleVisibilityListener) => () => void;
  /**
   * Низкоуровневый канал смены состояния раскладки для владельца позиции
   * `.nav` (единственный подписчик — `scenes/useNavPosition`). Срабатывает
   * в `applyState` на реальных переходах. Возвращает unsubscribe.
   */
  onNavState: (listener: NavStateListener) => () => void;
  /**
   * Эффективное конечное состояние навбара на `/home` (после скролла
   * спейсера). Читает `preferredRef` на лету: `mobile → invisible`,
   * `tablet` с ручным выбором → `slim`/`standard`, иначе `standard`.
   */
  getHomeEndState: () => LayoutMode;
  /**
   * Регистрация функции пересоздания scrub-твина позиции `.nav` под
   * актуальный ручной tablet-выбор. Владелец позиции (`useNavPosition`)
   * регистрирует свой `buildScrub`; провайдер дёргает его при toggle.
   * Возвращает cleanup, снимающий регистрацию.
   */
  registerRetargetScrub: (fn: (() => void) | null) => () => void;
}

export const LayoutContext = createContext<LayoutContextValue | null>(null);

/**
 * Доступ к API layout из любой страницы или компонента внутри
 * `LayoutProvider`. Бросает, если контекст отсутствует.
 */
export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return ctx;
}
