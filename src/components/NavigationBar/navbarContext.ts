import { createContext, useContext } from 'react';

/**
 * API управления навбаром, который NavigationBarProvider прокидывает
 * страницам через React Context.
 *
 * Страница не знает о DOM-нодах навбара и его анимациях — она вызывает
 * `registerScrollTrigger` со своим элементом-триггером и получает cleanup.
 */
export interface NavbarAPI {
  /**
   * Регистрирует ScrollTrigger, привязанный к элементу-триггеру со страницы.
   *
   * NavigationBar сам создаёт таймлайн (width навбара + margin-left контента)
   * и обновляет своё React-состояние на границах спейсера.
   * Возвращает функцию, убивающую триггер и таймлайн (вызывается в cleanup
   * вызывающей страницы).
   */
  registerScrollTrigger: (trigger: HTMLElement) => () => void;
}

export const NavbarContext = createContext<NavbarAPI | null>(null);

/** Доступ к API навбара из любой страницы внутри NavigationBarProvider. */
export function useNavbar(): NavbarAPI {
  const ctx = useContext(NavbarContext);
  if (!ctx) {
    throw new Error('useNavbar must be used within NavigationBarProvider');
  }
  return ctx;
}
