# Добавление новой сцены в навбар

Пошаговое руководство для случаев, когда в навбаре нужен новый
анимируемый элемент (логотип, индикатор активного пункта, badge,
parallax-фон и т. д.) с собственной GSAP-сценой.

## Прежде чем начать

Прежде чем писать новый компонент, проверьте:

1. Нужна ли анимация только в ответ на смену состояния навбара
   (fullscreen ↔ standard ↔ slim ↔ invisible) → достаточно подписки
   на `useNavbarEvent('state:change', ...)`.
2. Нужна ли анимация, привязанная к скроллу страницы (scrub)?
   → подписка на `useNavbarScrollProgress(...)`.
3. Нужна ли анимация и от того, и от другого?
   → оба хука, listener-ы изолированы, переподписка не нужна.
4. Нужно ли анимировать корневую позицию навбара (видимую ширину)?
   → это зона ответственности `useNavbarPosition` (владелец `.nav`). Не дублируйте —
   подпишитесь на `state:change` и используйте `getNavTransform`.
   (Событийную часть toggle уже берёт на себя сцена `ToggleButton` —
   см. «Чего НЕ делать».)

Если ваш случай — «просто показать/скрыть в slim-режиме» без анимации,
это **не сцена**. Используйте проп `isSlim` (как `NavItem`) и
стили/JSX — без подписки на шину.

## Шаги

### 1. Создать компонент

Создать папку `src/components/NavigationBar/<Name>/` и в ней
`<Name>.tsx` (+ `<Name>.module.css` + `index.ts` по конвенции). **Не трогать**
`NavigationBarProvider.tsx` и `useNavbarLayout.ts` — они про
раскладку, не про контент.

### 2. Получить API

```tsx
import { useRef } from 'react';
import { useNavbarEvent } from './navbarContext';

export function MyLogo() {
  const ref = useRef<HTMLDivElement>(null);
  // ...
}
```

### 3. Подписаться на нужные события

#### 3.1 Дискретные изменения состояния

```tsx
useNavbarEvent('state:change', ({ state, prev, source }) => {
  if (state === prev) return;
  // локальный твин
  gsap.fromTo(ref.current, { ... }, { ... });
});
```

Фильтруйте по `source`, если нужно реагировать только на конкретный
источник (`'toggle'`, `'route'`, `'breakpoint'`, `'scroll'`,
`'intro'` — последний зарезервирован под будущую интеграцию
с IntroAnimation).

Пример: реагировать только на ручной toggle, не на автоматический
скролл.

```tsx
useNavbarEvent('state:change', ({ state, prev, source }) => {
  if (state === prev || source !== 'toggle') return;
  // ...
});
```

#### 3.2 Scrub-прогресс (60fps)

```tsx
useNavbarScrollProgress(({ progress, direction }) => {
  // НЕ использовать setState — 60fps приведёт к ререндерам.
  // Только прямой gsap.set / gsap.to на DOM.
  gsap.set(ref.current, { x: progress * 100 });
});
```

#### 3.3 Смена роута / breakpoint (без анимации)

Если нужно просто знать pathname/bp (например, активировать ссылку,
подсветить активный пункт), подпишитесь на `route:change` или
`breakpoint:change`. Но для «активный пункт» обычно достаточно
`NavLink({ isActive })` из react-router.

### 4. Cleanup

`useNavbarEvent` и `useNavbarScrollProgress` сами отписываются
при размонтировании через `useEffect`. Ручной cleanup не нужен.

`gsap.killTweensOf(ref.current)` — **перед новым твином**, если вы
можете запустить его повторно до завершения предыдущего
(например, частые `state:change` при переключении):

```tsx
useNavbarEvent('state:change', ({ state, prev }) => {
  if (state === prev) return;
  const el = ref.current;
  if (!el) return;
  gsap.killTweensOf(el);
  gsap.fromTo(el, { ... }, { ..., overwrite: 'auto' });
});
```

### 5. Зарегистрировать в `<NavigationBar />` (если нужно)

Если ваш компонент — **часть корневого навбара** (логотип, бейдж),
добавьте его в `<NavigationBar />` и пробросьте рефы/пропсы по тем
же правилам, что и `<NavList />`. Если компонент — **самостоятельная
единица** (например, индикатор секции, живущий где-то ещё),
регистрируйте его в странице или в `<NavigationBarProvider>` как
самостоятельный компонент без трогания внутренней структуры
навбара.

### 6. Покрыть тестами (когда появятся)

- Изменение состояния через toggle → анимация стартует
- Изменение breakpoint → анимация пересоздаётся
- Размонтирование → нет утечек (gsap.context / регистрация cleanup)

Без тестов — хотя бы ручная проверка в браузере: DevTools →
Performance → записать 5 секунд цикла toggle + scroll. Никаких
setState в scrub-сценах не должно быть (видно по отсутствию
React-рендеров в flame chart).

## Чего НЕ делать

- **Не подписывайтесь на DOM-узлы корневого навбара** — ваши сцены
  не должны трогать `.nav`, `.navInner`, `<main>`, кнопку toggle.
  Это зона `useNavbarPosition`. Если нужно реагировать на «ширину»,
  подпишитесь на `state:change` и используйте
  `getNavTransform(state, window.innerWidth)`.

  Исключение — кнопка toggle: это полностью самостоятельная сцена
  `ToggleButton`, которая владеет своей DOM-нодой. На mobile она
  `position: fixed`-сиблинг навбара (вне трансформированного `.nav`),
  на tablet — `position: absolute` внутри `<nav>`; видимость на `/home`
  берёт через `useNavbarToggleVisibility`. **Не регистрируйте новые
  подписки на её ноду** — владение toggle целиком внутри сцены
  (см. `docs/Components/NavigationBar/ToggleButton.md`).

- **Не публикуйте «свою болтовню» в `bus`** — шина предназначена для
  **системных** событий навбара. Локальные взаимодействия между вашими
  компонентами делайте через React Context / props / refs. Исключение —
  системные интент-события: дочерняя сцена может публиковать намерение
  изменить состояние навбара (как `ToggleButton` шлёт `'toggle:request'`).
  Если вы сомневаетесь, является ли ваше событие «системным» — не
  публикуйте, а используйте локальный канал.

- **Не вызывайте `registerScrollTrigger`** из дочерних сцен —
  это контракт для **страниц**. Дочерние сцены подписываются на
  результат (`useNavbarScrollProgress`) или на `state:change`.

- **Не используйте `setState` внутри `useNavbarScrollProgress`** —
  это убьёт производительность. Только `gsap.set` / `gsap.to`.

- **Не дублируйте `isSlim`** — если всё, что вам нужно, это
  показать/скрыть элемент в зависимости от slim-режима, возьмите
  проп `isSlim` (как `NavItem`). Подписка на шину — для анимаций,
  не для условного рендера.

- **Не создавайте свои `useEffect` на `location.pathname` или
  `useBreakpoint()`** внутри компонента навбара — это уже
  делает `NavigationBarProvider` и публикует в шину. Подпишитесь
  на `route:change` / `breakpoint:change`.

## Чеклист перед коммитом

- [ ] Компонент лежит в `src/components/NavigationBar/<Name>/<Name>.tsx`
- [ ] Рефы на DOM-узлы компонента — внутри компонента, не в провайдере
- [ ] `useNavbarEvent` / `useNavbarScrollProgress` / `useNavbarToggleVisibility`
      импортированы из `./navbarContext`
- [ ] `gsap.killTweensOf` + `overwrite: 'auto'` для твинов, которые
      могут наложиться
- [ ] Нет `setState` в `useNavbarScrollProgress`
- [ ] Компонент не трогает `.nav` / `.navInner` / `<main>` / toggle
- [ ] Нет своих `useEffect` на pathname / breakpoint
- [ ] Нет публикации «болтовни» в `bus` (допустимы только системные
      интент-события вроде `toggle:request`)
- [ ] Нет своего `registerScrollTrigger` (только страницы)
- [ ] Линтер + типы + build проходят

## Связанные документы

- `docs/Components/NavigationBar/navbarEventBus.md` — полный API шины
- `docs/Components/NavigationBar/hooks.md` — сцены: «что знает каждый уровень»
- `src/components/NavigationBar/NavList/NavItem.tsx` — живой пример
  минимальной сцены (fade-in иконки при входе в slim)
- `src/components/NavigationBar/hooks/useNavbarPosition.ts` — единственный
  владелец позиции корневой ноды `.nav` (discrete + scrub)
