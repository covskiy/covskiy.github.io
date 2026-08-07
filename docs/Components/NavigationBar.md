# NavigationBar

Адаптивная многофункциональная навигационная панель с четырьмя состояниями отображения,
автоматически переключаемыми через ScrollTrigger или вручную через кнопку toggle.

## Состояния

| Состояние    | Ширина  | Высота   | Где используется                                        |
| ------------ | ------- | -------- | ------------------------------------------------------- |
| `fullscreen` | `100vw` | `100dvh` | `/home` в начальной позиции, mobile toggle              |
| `standard`   | `25vw`  | `100dvh` | tablet/desktop после скролла, дефолт на других роутах   |
| `slim`       | `80px`  | `100dvh` | tablet по умолчанию, tablet при ручном toggle           |
| `invisible`  | `0px`   | `100dvh` | mobile по умолчанию (навбар скрыт, виден только toggle) |

Все состояния имеют `position: fixed`, `z-index: 1000` и прозрачный фон.

**Реализация ширины**: навбар всегда занимает `100vw` в раскладке, а видимая
ширина достигается трансформациями (GSAP твинит `x` на `.nav`).
Это держит анимацию на композиторе и не вызывает reflow при
60fps-обновлениях ScrollTrigger (scrub). Подробнее — в разделе
«Почему transforms вместо width».

## Поведение по устройствам

### Mobile (`< 768px`)

| Роут     | Начальное    | Скролл                     | Toggle                     |
| -------- | ------------ | -------------------------- | -------------------------- |
| `/home`  | `fullscreen` | `fullscreen` → `invisible` | `invisible` ↔ `fullscreen` |
| `/other` | `invisible`  | нет                        | `invisible` ↔ `fullscreen` |

Кнопка toggle фиксирована в левом верхнем углу экрана (`position: fixed; left: 20px; top: 20px`),
чтобы оставаться доступной даже когда навбар полностью скрыт.

**На `/home` toggle виден только когда навбар ушёл за экран** (`progress ≈ 1`): наверху
(fullscreen) и во время scrub-анимации спейсера кнопка скрыта (`autoAlpha: 0`), чтобы
пользователь не мог сломать scrub ручным кликом. Исключение — **ручное состояние**
(источник `toggle`): пока навбар вручную развёрнут (`fullscreen`, кнопка `←`) или вручную
свёрнут (`invisible`, кнопка `☰`), кнопка остаётся доступной, даже когда scroll пересекает
спейсер. Обратная прокрутка первым же кадром снова скрывает кнопку у «скролловых» состояний.
Когда навбар в `invisible` (из скролла), кнопка `☰` видна; при ручном
открытии навбара в `fullscreen` кнопка (`←`) остаётся доступной, чтобы вернуться
в `invisible`.

**Ручной `fullscreen` «держится» до верха страницы (mobile).** Если навбар вручную развёрнут
(клик `☰`) и пользователь скроллит вверх, при пересечении нижней границы спейсера scrub
НЕ схлопывает навбар и не берёт управление: scrub-таймлайн «запинен» к своему крайнему
положению (`progress = 0`, fullscreen). Переключение на scrub происходит только на самом
верху страницы (`progress ≈ 0`), где `applyState('fullscreen', 'scroll')` перезаписывает
источник на `scroll` и снимает пин — дальше обычный scrub `fullscreen → invisible` при
скролле вниз. Если навбар НЕ был вручную развёрнут (ушёл за экран скроллом, `invisible`),
при подъёме scrub ведёт его `invisible → fullscreen`, как и раньше.

### Tablet (`768 – 1024px`)

| Роут     | Начальное    | Скролл                    | Toggle              |
| -------- | ------------ | ------------------------- | ------------------- |
| `/home`  | `fullscreen` | `fullscreen` → `standard` | `standard` ↔ `slim` |
| `/other` | `slim`       | нет                       | `slim` ↔ `standard` |

**На `/home` поведение toggle идентично mobile**: кнопка скрыта в `fullscreen` и во время
scrub-анимации, видна в состояниях `standard` / `slim` (когда навбар дошёл до конца
спейсера или переключён вручную).

**Важно**: при скролле к началу страницы ScrollTrigger принудительно разворачивает навбар
в `fullscreen` — это имеет приоритет над ручным `slim` / `standard` состоянием. Однако
при обратной прокрутке вниз навбар возвращается в последний ручной выбор
(`slim`, если он был выставлен через toggle), а не всегда в `standard`.

**Персистентность ручного выбора**: ручной `slim` / `standard` на tablet сохраняется
между страницами. При переходе на другой роут `useNavbarLayout` использует сохранённое
состояние вместо роутового дефолта, чтобы не было «моргания» границы навбар/контент
(перескока `--nav-content-offset` между `80px` и `25vw`). На `/home` переход всегда
начинается с `fullscreen` (intro), а восстановление ручного состояния происходит
через scrub при прокрутке вниз. Scrub-таймлайн пересоздаёт свой nav-твин при каждом
изменении ручного выбора (GSAP вычисляет значения твина один раз при рендере),
иначе скролл к низу `/home` вёл бы навбар в устаревший `standard` вместо `slim`.
Ретаргет строится как `fromTo` со стартом `x: 0` и `immediateRender: false`
(иначе добавление твина в живой scrub-таймлайн мгновенно выставляло бы навбар
в fullscreen в момент toggle), а после kill+re-add вызывается
`tl.scrollTrigger?.refresh()` — пересоздание меняет `tl.duration()`, что
рассогласует scrub-маппинг ScrollTrigger.
На mobile и desktop предпочтение не хранится (на mobile отступа контента нет,
на desktop toggle отсутствует).

### Desktop (`>= 1024px`)

| Роут     | Начальное    | Скролл                    | Toggle |
| -------- | ------------ | ------------------------- | ------ |
| `/home`  | `fullscreen` | `fullscreen` → `standard` | нет    |
| `/other` | `standard`   | нет                       | нет    |

На desktop кнопка toggle не рендерится.

## Архитектура

```
src/components/NavigationBar/
├── index.ts                    # Barrel: NavigationBarProvider, NavigationBar, NavList,
│                               #   navItems, useNavbar, useNavbarEvent,
│                               #   useNavbarScrollProgress, useNavbarToggleVisibility,
│                               #   NavbarAPI, NavbarEventBus,
│                               #   NavbarSource, NavbarEventMap, getNavTransform, SLIM_WIDTH,
│                               #   NavState, NavTransform, NavbarLayout, NavbarLayoutRefs
├── NavigationBarProvider.tsx   # Диспетчер сцен: шина событий, реф nav,
│                               #   scrollListenersRef, toggleVisibilityListenersRef,
│                               #   useNavbarLayout, Context.Provider
├── NavigationBarProvider.module.css  # .app, .main (layout-обёртка)
├── NavigationBar.tsx           # Презентационный: <nav>, логотип, <ToggleButton>; пропсы
│                               #   isSlim/hasToggle (+ ref nav). Placement toggle по bp
├── NavigationBar.module.css    # .nav, .navInner, .logo
├── components/                 # Презентационные компоненты и конфиг
│   ├── ToggleButton.tsx            # Самостоятельная сцена ☰ / ←: своя нода, клик → bus
│   │                               #   'toggle:request', видимость через useNavbarToggleVisibility
│   ├── ToggleButton.module.css     # .toggleBtn + позиционные модификаторы
│   │                               #   --fixed (mobile) / --absolute (tablet)
│   ├── NavList.tsx                 # <ul>{items.map → NavItem}</ul>
│   ├── NavList.module.css          # .list
│   ├── NavItem.tsx                 # <li> + <NavLink>, иконка/текст в зависимости от isSlim
│   │                               #   + демо-сцена: fade-in иконки при входе в slim
│   ├── NavItem.module.css          # .link, .active, .icon, .label, .slim-стили
│   └── navItems.ts                 # Конфиг (path, label, icon), деривация от routes
├── hooks/                      # Сцены раскладки навбара
│   ├── useNavbarLayout.ts          # Композер корневой сцены: собирает 4 под-сцены
│   │                               #   и возвращает публичный API NavbarLayout
│   ├── useNavbarState.ts           # Сцена состояния: refs (stateRef/stateSourceRef/
│   │                               #   preferredRef/isHomeRef), applyState, getHomeEndState,
│   │                               #   recomputeTarget + подписки route/breakpoint/state:change
│   ├── useNavbarAnimation.ts       # Сцена дискретной анимации: animateNavbar (useGSAP)
│   │                               #   реакция на state:change (только nav.x)
│   ├── useNavbarScrubTrigger.ts    # Сцена scrub: registerScrollTrigger (ScrollTrigger +
│   │                               #   onUpdate), spacer:enter/leave, видимость toggle
│   │                               #   (notifyToggleVisibility), navScrubTween/retargetScrub
│   └── useNavbarToggle.ts          # Сцена ручного переключения: подписчик
│                                   #   на bus 'toggle:request'
└── core/                       # Чистая логика без React
    ├── navbarContext.ts            # createContext + useNavbar() + тип NavbarAPI
    │                               #   + хуки useNavbarEvent/useNavbarScrollProgress/
    │                               #   useNavbarToggleVisibility
    ├── navbarEventBus.ts           # createNavbarEventBus + NavbarEventMap + NavbarSource
    └── navbarStates.ts             # NavState, NavTransform, SLIM_WIDTH + чистые
                                    #   хелперы: getNavTransform/getDefaultState/getNextState
```

Barrel (`index.ts`) экспортирует `NavigationBarProvider` (основной компонент,
оборачивающий layout), `NavigationBar`, `NavList`, `navItems`, хук `useNavbar`,
геометрию `getNavTransform`/`SLIM_WIDTH` и типы `NavbarAPI`, `NavItemConfig`,
`NavState`, `NavTransform`.
`NavItem` и `ToggleButton` — внутренние компоненты, наружу не экспортируются.

### navItems.ts

Единственный источник правды для `path` и `label` — `routes.tsx`. `navItems.ts` импортирует `routes`, отфильтровывает `*` (NotFound) и навешивает `icon` через маппинг `Record<path, ReactNode>`:

```ts
// navItems.ts — схема
import { routes } from '../../routes';

const routeIcons: Record<string, ReactNode> = {
  '/': '🏠',
  '/about': 'ℹ️',
  '/services': '🛠️',
  '/contact': '📬',
};

export const navItems: NavItemConfig[] = routes
  .filter(
    (r): r is (typeof routes)[number] & { label: string } =>
      r.path !== '*' && typeof r.label === 'string',
  )
  .map((r) => ({
    path: r.path,
    label: r.label,
    icon: routeIcons[r.path] ?? '❓',
  }));
```

Поле `icon` типизировано как `ReactNode` — замена emoji на `<HomeIcon />` не потребует изменения интерфейсов, только замены значения в `routeIcons`.

### NavItem — поведение `isSlim`

- `isSlim === false`: рендерится `<span class="label">{label}</span>` + `<span class="icon">{icon}</span>`
- `isSlim === true`: текст `.label` не рендерится, иконка `.icon` центрируется
  (класс `styles.slim`), на `<NavLink>` вешается `tabIndex={-1}`, исключающий
  ссылку из Tab-навигации

Проп `isSlim` фактически означает «навбар в свёрнутом состоянии» — он `true` как для `slim`, так и для `invisible`.

### Зависимости

- `useBreakpoint` — `src/utils/breakpoints.ts`
- `useLocation` — `react-router`
- `gsap` + `useGSAP` — GSAP-анимации
- `logger` — `src/utils/logger.ts`
- `routes` — `src/routes.tsx` (через `navItems.ts`)

## Архитектура: Scene-Composition через EventBus

Навбар — это набор **сцен** (Scene-Composition): независимых подписчиков
на типизированную шину событий, каждый из которых владеет своими
DOM-нодами и GSAP-таймлайнами. Провайдер (`NavigationBarProvider`)
больше **не хранит все рефы** и **не владеет единой анимационной
последовательностью** — он только диспетчеризует события и держит
контракт для страниц.

### Слои

| Слой               | Что делает                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Шина**           | `createNavbarEventBus()` — типизированный pub/sub (`NavbarEventMap`)                                                                                                                                                                                                                                                                                                                                                                   |
| **Диспетчер**      | `NavigationBarProvider` — создаёт шину, держит рефы корневых нод, читает `useLocation`/`useBreakpoint` и публикует `route:change`/`breakpoint:change`, прокидывает API в context                                                                                                                                                                                                                                                       |
| **Корневая сцена** | `useNavbarLayout` — композер над четырьмя под-сценами (`useNavbarState` — состояние и подписки, `useNavbarAnimation` — дискретная анимация, `useNavbarScrubTrigger` — scrub/ScrollTrigger и видимость toggle, `useNavbarToggle` — ручное переключение). Единственная сцена, знающая о геометрии навбара: animateNavbar, applyState (единая точка записи state), `registerScrollTrigger` (scrub-таймлайн), подписка на `toggle:request` |
| **Дочерние сцены** | `ToggleButton` (self-нода, клик → `toggle:request`, видимость через `useNavbarToggleVisibility`), NavItem, логотип, будущие расширения — подписываются на шину через `useNavbarEvent` / `useNavbarScrollProgress` и анимируют свои DOM-ноды самостоятельно                                                                                                                                                                             |

### Поток данных

```
App.tsx
└── <NavigationBarProvider />              ← диспетчер
      │  (создаёт bus, scrollListenersRef, toggleVisibilityListenersRef, регистрирует useNavbarLayout)
      ├── <NavigationBar navRef isSlim hasToggle/>
      │     ├── <ToggleButton isSlim hasToggle/>   ← mobile: fixed-сиблинг вне <nav>;
      │     │     │                                  tablet: внутри <nav>
      │     │     └── onClick → useNavbar().events.emit('toggle:request')
      │     │     └── useNavbarToggleVisibility(v => gsap.set(ref, ...))  ← видимость на /home
      │     └── <NavList /> → <NavItem> × N
      │           └── useNavbarEvent('state:change', ...) — демо-сцена fade-in иконки
      ├── <main>                          ← контентная область (статичная правая колонка)
      │     └── <Routes>
      │           └── HomePage
      │                 ├── <div ref={spacerRef} />   ← 100dvh спейсер
      │                 └── <LandingSections />
      │                 └── useEffect:
      │                       registerScrollTrigger(spacerRef.current)
      └── Context API:
            ├── registerScrollTrigger(trigger) → () => void   (контракт для страниц)
            ├── getState() → NavState                          (синхронный snapshot)
            ├── events: NavbarEventBus                          (типизированная шина)
            ├── onScrollProgress(listener) → () => void         (60fps низкоуровневый канал)
            └── onToggleVisibility(listener) → () => void       (канал видимости toggle)

useNavbarLayout (композер корневой сцены; логика распределена по под-сценам):
  applyState(next, source):                       ← useNavbarState
    stateRef.current = next
    bus.emit('state:change', { state, prev, source })
  bus.on('route:change', { pathname }):          ← useNavbarState
    isHomeRef.current = isHomePath(pathname)
    recomputeTarget()                        ← пересчёт целевого состояния
  bus.on('breakpoint:change', { bp }):           ← useNavbarState
    recomputeTarget()
  bus.on('toggle:request'):                       ← useNavbarToggle
    getNextState(stateRef.current, bp) → applyState(next, 'toggle')
    (tablet) preferredRef.current = next + retargetScrub()
    (mobile /home) scrollTo конца спейсера при сворачивании в invisible
  bus.on('state:change'):                        ← useNavbarAnimation (animateNavbar)
    setCurrentState(state)                   ← useNavbarState (React-мост для isSlim/contentOffset)
    animateNavbar: gsap.to(nav / toggle) с overwrite: 'auto'
  (инициализация: recomputeTarget() один раз на монтировании)
  registerScrollTrigger(trigger):                ← useNavbarScrubTrigger
    gsap.timeline({ scrollTrigger: { ..., onUpdate } })
      onUpdate:
        listeners.forEach(l => l({ progress, direction }))   ← низкоуровневый канал
        isMobilePin = isMobile && source === 'toggle'
                      && state ∈ {fullscreen, invisible}    ← ручное состояние
        if progress === 0  → applyState('fullscreen', 'scroll')   (снимает пин)
        if progress === 1  → applyState(endState, 'scroll')  (пропускается при isMobilePin)
        if isMobilePin     → tl.progress(fullscreen ? 0 : 1) ← «пин» ручного состояния
        notifyToggleVisibility(progress === 1 || isMobilePin) ← через toggleVisibilityListenersRef;
                                                                применяет ToggleButton (gsap.set)
```

### Что знает каждый уровень

| Уровень                                        | Знает                                                                                                                       | НЕ знает                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `NavigationBarProvider`                        | Роут, breakpoint, рефы корневых нод (`nav`), шина, layout-сцена, каналы `scrollListenersRef`/`toggleVisibilityListenersRef` | DOM NavItem, иконки, логотип    |
| `useNavbarLayout`                              | Геометрия раскладки (`getNavTransform`), ScrollTrigger, scrub                                                               | Содержимое пунктов меню, иконки |
| Дочерняя сцена (ToggleButton, NavItem и т. д.) | Своя DOM-нода (у toggle — собственная), `prev → next` state через шину                                                      | DOM соседей, общую анимацию     |

### Контракты

**Для страниц** (через `useNavbar()`):

- `registerScrollTrigger(trigger: HTMLElement) => () => void` — контракт
  сохранён без изменений. Внутри — фасад над `useNavbarLayout`.

**Для дочерних сцен** (через `useNavbar()` или хуки):

- `getState()` — синхронный snapshot текущего состояния.
- `events.on(event, listener)` — низкоуровневая подписка на шину.
- `useNavbarEvent(event, listener, deps?)` — React-обёртка с latest-ref
  (listener всегда видит свежее замыкание, не нужно оборачивать
  в `useCallback`).
- `onScrollProgress(listener)` / `useNavbarScrollProgress(listener)` —
  низкоуровневый канал для 60fps scrub-подписчиков. Listener вызывается
  из `ScrollTrigger.onUpdate` напрямую, минуя React-рендер.
- `onToggleVisibility(listener)` / `useNavbarToggleVisibility(listener)` —
  низкоуровневый канал видимости кнопки toggle (scrub-производная `progress ≈ 1
|| manualState`). Scrub зовёт listener-ов из `ScrollTrigger.onUpdate`, а
  `ToggleButton` применяет `gsap.set` к своей ноде — без React-рендера.

### Принципы

1. **Шина scoped на провайдер** — `createNavbarEventBus()` вызывается
   один раз через `useMemo([])` в `NavigationBarProvider`. Если в
   будущем потребуется кросс-провайдерный доступ (например,
   `IntroAnimation` ↔ Navbar), переход на singleton возможен без
   изменения потребителей — они получают `events` через context.

2. **`applyState` — единственная точка записи состояния.** Любой
   источник (toggle/route/breakpoint/scroll) проходит через неё и
   публикует `state:change` с указанием `source` в payload. Это даёт
   подписчикам возможность фильтровать события по источнику.

3. **`scroll:progress` идёт через отдельный канал** — не через
   `events.emit`, чтобы 60fps события не попадали в React-шину.
   Провайдер владеет `scrollListenersRef: RefObject<Set<Listener>>`,
   layout-сцена дёргает listener-ов напрямую из `ScrollTrigger.onUpdate`.

4. **Видимость toggle — тоже канал, не bus** — решение о видимости
   (`progress ≈ 1 || manualState`) принимается в scrub-сцене, где и
   вычисляется прогресс. Scrub не владеет нодой кнопки, поэтому публикует
   видимость через `toggleVisibilityListenersRef` (владеет провайдер),
   а `ToggleButton` применяет её через `gsap.set` к своей ноде — по образцу
   `onScrollProgress` и без React-рендера.

5. **Дочерние сцены не знают о DOM корневого навбара** — они получают
   только логические события. Это означает, что появление нового
   элемента внутри навбара (логотип, badge, индикатор секции)
   реализуется как новая сцена, без изменения провайдера или
   layout-сцены.

6. **`NavItem` — демо-сцена end-to-end.** Фаза 1 проверяет пайплайн
   шины: при первом переходе навбара в `slim` иконка делает fade-in
   с подскоком через `gsap.fromTo`. Это дополняет существующее
   поведение (`isSlim` пропом) и легко откатывается удалением хука.

7. **Toggle — самостоятельная сцена `ToggleButton`.** Кнопка публикует
   системный интент `toggle:request` в шину (клик), обработчик состояния
   живёт в `useNavbarToggle` (layout-сцена). Рендер глифа/aria остаётся на
   React-пропе `isSlim` — по правилу «проп вместо шины для условного
   рендера». Сцена полностью владеет своей DOM-нодой: на mobile это
   `position: fixed`-сиблинг навбара (вне трансформированного `.nav`),
   на tablet — `position: absolute` внутри `.nav`; видимость на `/home`
   кнопка применяет к себе через `useNavbarToggleVisibility` (см. ниже).

### Будущая интеграция с IntroAnimation (задел)

`NavbarSource` уже включает вариант `'intro'`, зарезервированный под
сценарий, когда IntroAnimation завершается и инициирует «вход» навбара.

Сейчас `applyState` всегда получает source из контекста NavigationBarProvider
(`'toggle' | 'route' | 'breakpoint' | 'scroll'`). При появлении интеграции:

1. IntroAnimation `onComplete` либо вызовет
   `useNavbar().events.emit('state:change', { state, prev, source: 'intro' })`,
   либо (если у IntroAnimation появится свой контракт через context)
   напрямую через низкоуровневый API.
2. Дочерние сцены, желающие отреагировать именно на завершение intro,
   фильтруют: `useNavbarEvent('state:change', (p) => p.source === 'intro' && run())`.

Для этого потребуется поднять bus до singleton (отдельная задача фазы 2) —
контракт API уже зафиксирован.

### Задел: fixed-сиблинг вместо противофазы

На mobile кнопка toggle — настоящий `position: fixed` элемент, рендерящийся
**сиблингом** навбара (вне трансформированного `.nav`). Трансформация на
`.nav` создаёт containing block, из-за которого `position: fixed` у потомка
не срабатывал — поэтому раньше кнопка компенсировалась GSAP-противофазой
(`toggleX = -navX`). Теперь противофазы нет вовсе:

- дискретный `toggleX` — удалён из `useNavbarAnimation` (твиним только `nav.x`);
- scrub `toggleX` — удалён из scrub-таймлайна `useNavbarScrubTrigger`;
- поле `toggleX` — удалено из `NavTransform`, `getNavTransform(state, viewport)`
  возвращает только `navX`;
- `toggleRef` исчез из провайдера/layout/animation/scrub — нодой владеет сам
  `ToggleButton` (собственный `ref`);
- mobile `.nav { overflow: visible }` вернулся к `overflow: hidden` на всех bp.

Placement кнопки определяет `NavigationBar` по breakpoint: на mobile —
`{hasToggle && isMobile && <ToggleButton/>}` как сиблинг после `</nav>`,
на tablet — внутри `<nav>`. Позиция задаётся CSS-модификатором сцены
(`--fixed` / `--absolute`), а видимость на `/home` — через низкоуровневый
канал `onToggleVisibility` (решение остаётся в scrub-сцене).

## Стили позиционирования

Базовое позиционирование и отступы живут в CSS Modules

```css
/* NavigationBar.module.css — фиксированное позиционирование; GSAP анимирует трансформации */
.nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh;
  z-index: var(--z-nav-overlay, 1000);
  will-change: transform;
}

/* NavigationBarProvider.module.css — статичная правая колонка через CSS-переменную */
.main {
  margin-left: var(--nav-content-offset, 0px);
  width: calc(100% - var(--nav-content-offset, 0px));
  transition:
    margin-left var(--transitions-duration-medium)
      var(--transitions-easing-ease-in-out),
    width var(--transitions-duration-medium)
      var(--transitions-easing-ease-in-out);
}
```

Навбар всегда `width: 100vw` в раскладке; видимая ширина (25vw / 80px / 0)
достигается сдвигом окна через `transform: translateX`, а не `width` — это не
вызывает reflow при обновлении ScrollTrigger до 60 раз в секунду.

`<main>` не твинится вообще: `--nav-content-offset` выставляет провайдер
(`getContentOffset`), ширина сразу ориентирована на конечное значение
(`100% − offset`), поэтому при скролле на `/home` контент не едет по диагонали.
CSS-transition срабатывает только на дискретных изменениях offset (tablet-тоггл
slim ↔ standard, смена роута/breakpoint) — разовый reflow, не 60fps-scrub.

## Управление состоянием

| Сущность                   | Где живёт                         | Назначение                                                                            |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| `currentState`             | `useNavbarLayout` (state)         | UI-состояние для пропа `isSlim` в NavigationBar                                       |
| `stateRef`                 | `useNavbarLayout` (ref)           | Актуальное состояние для логики toggle (без stale closure)                            |
| `applyState(next, source)` | `useNavbarLayout`                 | **Единственная точка записи state.** Публикует `state:change` в шину                  |
| `recomputeTarget()`        | `useNavbarLayout`                 | Пересчёт целевого состояния из `route:change` / `breakpoint:change` и на монтировании |
| `isHomeRef`                | `useNavbarLayout` (ref)           | Признак `/home`; обновляется из `route:change`, инициализируется провайдером          |
| `registerScrollTrigger`    | `useNavbarLayout` (через API)     | Функция из Context API: регистрирует ScrollTrigger страницы                           |
| `scrollListenersRef`       | `NavigationBarProvider` (ref)     | Низкоуровневый канал для 60fps scrub-подписчиков                                      |
| `bus: NavbarEventBus`      | `NavigationBarProvider` (useMemo) | Типизированная шина событий                                                           |

**NavState**: `'fullscreen' | 'standard' | 'slim' | 'invisible'` — тип и геометрия
состояний вынесены в `navbarStates.ts` (чистая логика, без React). Провайдер
использует `getDefaultState`/`getNextState` для пересчёта состояний,
`getNavTransform(state, viewport)` для GSAP-анимаций трансформаций навбара
и `getContentOffset(state, bp, isHome)` для статичного отступа `<main>`.

**NavbarSource** (источник `state:change`):

| Значение     | Когда                                                     |
| ------------ | --------------------------------------------------------- |
| `toggle`     | Клик по ☰ / ← (ручной toggle)                            |
| `route`      | Смена pathname через react-router                         |
| `breakpoint` | Смена breakpoint (mobile / tablet / desktop)              |
| `scroll`     | ScrollTrigger на спейсере достиг границы (progress 0 / 1) |
| `intro`      | Зарезервировано для будущей интеграции с IntroAnimation   |

**NavTransform** (px, от `viewport = window.innerWidth`):

| Состояние    | `navX`     |
| ------------ | ---------- |
| `fullscreen` | `0`        |
| `standard`   | `-0.75·vp` |
| `slim`       | `-(vp-80)` |
| `invisible`  | `-vp`      |

- **Модель окна**: навбар всегда `100vw`, видимая ширина — сдвиг окна `navX`.
  Counter-translate контента убран: `.navInner` движется вместе с окном и на
  tablet/desktop в `standard`/`slim` обрезается `overflow: hidden` (промежуточное
  состояние до новой модели layout).
- **Mobile invisible**: `.nav` имеет `overflow: hidden` на всех bp (контент
  обрезается окном). Кнопка toggle — `position: fixed`-сиблинг навбара (вне
  трансформированного `.nav`), поэтому остаётся фиксированной в `left: 20`,
  даже когда окно навбара уезжает за экран. Никакой компенсации `toggleX`
  не требуется.

**`<main>` — статичная колонка, `getContentOffset`**:

| Контекст                                        | Отступ (`--nav-content-offset`) |
| ----------------------------------------------- | ------------------------------- |
| mobile (любой роут)                             | `0` (полная ширина)             |
| `/home` tablet/desktop, `standard`/`fullscreen` | `25vw`                          |
| `/home` tablet, `slim` (после toggle)           | `80px`                          |
| `/other` tablet/desktop, `standard`             | `25vw`                          |
| `/other` tablet, `slim`                         | `80px`                          |

На `/home` `fullscreen` маппится на **эффективное конечное состояние**
(`getHomeEndState`): `standard`, если ручного выбора нет, или `slim`, если
он выставлен через toggle. Контент сразу ориентирован на ширину, в которую
навбар придёт после скролла спейсера, и не двигается при скролле — в том
числе не расширяется в конце, когда навбар уходит в `slim`.

### Триггеры изменения состояния

1. **Смена роута** — провайдер эмитит `route:change` в шину; layout-сцена
   обновляет `isHomeRef` и вызывает `recomputeTarget()`
2. **Смена breakpoint** — провайдер эмитит `breakpoint:change` в шину;
   layout-сцена вызывает `recomputeTarget()`
3. **Ручной toggle** — сцена `ToggleButton` по клику публикует `toggle:request`
   в шину; обработчик `useNavbarToggle` применяет следующее состояние
4. **Событие ScrollTrigger** — страница вызывает `registerScrollTrigger` в `useEffect`;
   границы спейсера (progress 0 / 1) обновляют состояние внутри провайдера

> Шина — единственный источник триггеров смены роута/устройства: layout НЕ читает
> `useLocation`/`useBreakpoint` для пересчёта состояния. Провайдер держит
> `useLocation`/`useBreakpoint` только для эмиссии событий и отступа `<main>`,
> а стартовый `isHome` передаёт в layout через `initialIsHome` (на первом рендере
> шина событий не эмитит).

### Поток `currentState → isSlim`

```tsx
// NavigationBarProvider.tsx
const isSlim = currentState === 'slim' || currentState === 'invisible';

<NavigationBar navRef={navRef} isSlim={isSlim} hasToggle={hasToggle} />;
```

`isSlim` прокидывается пропсом в `NavigationBar` (не через контекст) и дальше —
в `NavList` → `NavItem`, где:

- Управляет видимостью текста/иконки
- Выставляет `tabIndex={-1}` на `<NavLink>`
- Добавляет класс `styles.slim` для CSS-селекторов

### Позиционирование toggle

Кнопка toggle (`ToggleButton`) — самостоятельная сцена, владеет своей DOM-нодой.
Lifecycle placement задаёт `NavigationBar` по breakpoint:

- **Tablet**: кнопка рендерится **внутри** `<nav>`, позиция `position: absolute;
top: 20px; right: 20px` (модификатор `--absolute`) — в правом верхнем углу
  навбара. Кнопка — дочерний элемент сдвигаемого навбара, поэтому «едет»
  вместе с правым краем окна при slim↔standard.
- **Mobile**: кнопка рендерится **сиблингом** после `</nav>`, `position: fixed;
top: 20px; left: 20px` (модификатор `--fixed`) — в левом верхнем углу экрана.
  Это настоящий fixed-элемент вне трансформированного `.nav` (трансформация
  создаёт containing block для потомков, из-за которого fixed у потомка не
  работает), поэтому не «едет» с окном и виден, даже когда навбар ушёл
  за экран (invisible).

`.nav` имеет `overflow: hidden` на всех bp: контент (логотип, ссылки)
обрезается окном навбара в свёрнутых состояниях, а fixed-сиблинг toggle —
вне клапа.

**Видимость на `/home`** управляется из `registerScrollTrigger.onUpdate` через
`notifyToggleVisibility` (решение `progress ≈ 1 || manualState`), публикуется
в низкоуровневый канал `toggleVisibilityListenersRef`, а применяет её сам
`ToggleButton` (`gsap.set` с `autoAlpha` + `pointerEvents`), без React-рендера:
кнопка скрыта наверху (fullscreen) и во время scrub-анимации, видна когда
навбар ушёл за экран (`progress ≈ 1`) или пока состояние задано вручную
(`source === 'toggle'` — ручной fullscreen → `←`, ручной invisible → `☰`).
Cleanup триггера сбрасывает видимость в исходную при уходе с `/home`.

## CSS-классы slim-режима

В `NavItem.module.css` переключение происходит через условный класс `styles.slim`,
который добавляется при `isCollapsed === true` (то есть в состояниях `slim` и `invisible`):

```css
.slim {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
}

.slim .icon {
  font-size: var(--font-sizes-xl);
}
```

Текстовая метка `.label` не скрывается CSS — она просто не рендерится в JSX
(`{!isSlim && <span className={styles.label}>...}`).

## Замена иконок (emoji → React-компоненты)

Достаточно отредактировать `navItems.ts` — поле `icon` имеет тип `ReactNode`:

```ts
const routeIcons: Record<string, ReactNode> = {
  '/':        <HomeIcon />,
  '/about':   <InfoIcon />,
  '/services':<ToolsIcon />,
  '/contact': <MailIcon />,
};
```

Остальные компоненты (NavItem, NavList, NavigationBar) изменений не требуют.

## Почему transforms вместо width

`width` и `marginLeft` — layout-свойства: их изменение заставляет браузер
пересчитывать раскладку (reflow) и красить заново. ScrollTrigger с `scrub`
обновляет свойства твина до 60 раз в секунду — анимация ширины превращается
в reflow на каждом кадре, что даёт jank на слабых устройствах.

Трансформации (`translateX`) обрабатываются на композиторе GPU и не трогают
раскладку. Поэтому:

- `.nav` всегда занимает `100vw` в раскладке, видимая ширина задаётся сдвигом
  окна `nav.x` (тот же эффект, что у `width`, но без reflow);
- контент `.navInner` движется вместе с окном; counter-translate убран, поэтому
  на tablet/desktop в `standard`/`slim` он обрезается `overflow: hidden`
  (промежуточное состояние до новой модели layout);
- `<main>` вообще не твинится — это статичная правая колонка:
  отступ задаётся CSS-переменной `--nav-content-offset`, ширина сразу
  ориентирована на конечное значение (`100% − offset`), поэтому контент не едет
  по диагонали при скролле на `/home`;
- на mobile кнопка toggle — `position: fixed`-сиблинг навбара (вне
  трансформированного `.nav`), компенсация `toggleX` не нужна.

Единственная плата — px-значения геометрии навбара запекаются при создании
твина (как и раньше для `25vw`). `invalidateOnRefresh` пересчитывает позиции
скролла, а смена breakpoint пересоздаёт анимацию, поэтому при повороте/ресайзе
поведение не регрессирует. Отступ `<main>` задаётся в `vw`/`px` — он и так
отзывчив к ресайзу.

## Ключевые решения

- **CSS Modules + transforms вместо width/margin** — вместо переключения
  CSS-классов GSAP анимирует композитные трансформации (`x`) напрямую.
  `width`/`marginLeft` — layout-свойства: при scrub ScrollTrigger обновляет их
  до 60 раз в секунду, заставляя браузер пересчитывать раскладку на каждом
  кадре. Трансформации живут на композиторе и не вызывают reflow. Это упрощает
  интеграцию со ScrollTrigger и избегает проблем с хешированными именами CSS Modules.

- **`<main>` — статичная колонка, не твинится** — отступ задаётся
  через CSS-переменную `--nav-content-offset` (`getContentOffset`), а ширина —
  `calc(100% − offset)`. На `/home` `fullscreen` маппится на эффективное конечное
  состояние (`getHomeEndState`), поэтому контент сразу ориентирован на ширину,
  в которую навбар придёт после скролла спейсера, и при скролле не едет по
  диагонали и не расширяется в конце (в т. ч. при ручном `slim`).
  Плавность tablet-тоггла slim ↔ standard — через CSS-transition на
  `margin-left`/`width` (разовый reflow, не 60fps-scrub).

- **`overwrite: 'auto'` только в `animateNavbar`** — прямые `gsap.to()` прерывают
  конфликтующие твины (включая твины от ScrollTrigger). Твины scrub-таймлайна
  в `registerScrollTrigger` пишутся без `overwrite` — они привязаны к своему
  timeline и не конкурируют с внешними твинами.

- **Toggle скрыт во время scrub на `/home`** — видимость вычисляется в
  `registerScrollTrigger.onUpdate` (`progress ≈ 1 || manualState`) и публикуется
  через низкоуровневый канал `toggleVisibilityListenersRef`. Применяет её сам
  `ToggleButton` (`gsap.set` с `autoAlpha` + `pointerEvents`, без React-рендера).
  Кнопка видна когда навбар ушёл за экран (`progress ≈ 1`); наверху (fullscreen)
  и в полёте scrub-анимации (в обе стороны) скрыта, чтобы пользователь не мог
  сломать анимацию ручным кликом. Исключение (mobile): пока состояние задано
  вручную (`source === 'toggle'`), кнопка видна и в полёте — ручной fullscreen
  показывает `←`, ручной invisible — `☰`. Cleanup триггера сбрасывает видимость
  при уходе с `/home`. Поведение идентично для mobile и tablet.

- **Ручной fullscreen «держится» до верха (mobile)** — scrub-таймлайн
  «запинен» к своему крайнему положению, пока состояние задано вручную:
  `fullscreen` → `tl.progress(0)`, `invisible` → `tl.progress(1)`. Скролл
  (в любую сторону) не схлопывает навбар и не ведёт его через scrub —
  переключение на scrub происходит только на самом верху страницы
  (`progress ≈ 0`), где `applyState('fullscreen', 'scroll')` перезаписывает
  источник и снимает пин. Источник состояния отслеживается в
  `stateSourceRef` и фиксируется в `applyState` даже при `prev === next`.

- **Context-Driven Animation Factory вместо custom event** — NavigationBar
  инкапсулирует DOM и анимацию, а страница делегирует управление через
  `registerScrollTrigger` (React Context). Прогресс скролла НЕ передаётся
  через React State (запрещено архитектурой) — ScrollTrigger обновляет
  состояние навбара только в дискретных точках (progress 0 / 1) на границах
  спейсера. Магическая строка `navbar:setstate` + `window.dispatchEvent`
  удалены.

- **Сценовая композиция через типизированный EventBus** — навбар
  разделён на корневую сцену раскладки (`useNavbarLayout`) и
  дочерние сцены (`ToggleButton`, `NavItem`, будущие расширения). Все сцены
  подписаны на `NavbarEventBus` через `useNavbarEvent` и реагируют
  на изменения состояния самостоятельно, не уведомляя провайдер.
  Это устраняет «толстый scrub-таймлайн» и регистрацию всех
  анимируемых DOM-узлов через рефы в родителе.

- **Toggle — сцена, а не проп-кнопка** — `ToggleButton` сам публикует
  системный интент `toggle:request` в шину по клику, а обработчик состояния
  (`useNavbarToggle`) живёт в layout-сцене и применяет `getNextState`
  через `applyState(next, 'toggle')`. Это убирает `handleToggle` из пропсов
  `NavigationBar` и завершает сценовую модель: ручное переключение проходит
  через ту же шину, что и `route`/`breakpoint`/`scroll`. Рендер глифа/aria
  оставлен на React-пропе `isSlim` (по правилу «проп вместо шины для
  условного рендера»). Сцена полностью владеет своей DOM-нодой
  (см. «Позиционирование toggle»): `toggleRef` убран из провайдера,
  layout и scrub.

- **Двухканальная публикация прогресса скролла** — дискретные события
  идут через `events.emit` (`'state:change'`, `'route:change'`,
  `'breakpoint:change'`), непрерывный scrub-прогресс — через
  низкоуровневый канал `onScrollProgress` напрямую из
  `ScrollTrigger.onUpdate`. Это исключает 60fps события из React-шины
  и сохраняет предсказуемую производительность для scrub-сцен
  (бегущая подсветка активной ссылки и т. п.).

- **`useBreakpoint` через `matchMedia`** — в отличие от `resize`,
  `matchMedia` не срабатывает на каждом пикселе и корректно реагирует
  на поворот экрана на планшетах.

- **Приоритет: автоскролл > ручное переключение** — при скролле к началу
  страницы ScrollTrigger принудительно разворачивает навбар в `fullscreen`,
  переопределяя предыдущее ручное `slim` или `invisible` состояние. На mobile
  ручной `fullscreen` уступает автоскроллу только на самом верху страницы:
  до `progress ≈ 0` scrub-таймлайн запинен и не переопределяет ручное состояние.
  На tablet обратная прокрутка к низу спейсера восстанавливает последний ручной
  выбор (`slim`/`standard`), а не всегда `standard` — предпочтение хранится в
  `preferredRef` и персистится между роутами (см. «Персистентность ручного выбора»).

- **`tabIndex={-1}` в slim/invisible** — ссылки навбара получают `tabIndex = -1`
  в свёрнутых состояниях, исключая их из фокуса при навигации Tab.

- **Toggle — fixed-сиблинг на mobile, absolute на tablet** — позиция кнопки
  задаётся CSS-модификатором сцены, а не GSAP-противофазой. На tablet кнопка
  внутри `<nav>` (`position: absolute`) и «едет» с его краем; на mobile —
  `position: fixed`-сиблинг вне трансформированного `.nav` (иначе transform
  создаёт containing block и ломает fixed). `.nav` имеет `overflow: hidden`
  на всех bp — контент обрезается окном, а fixed-кнопка остаётся доступной,
  даже когда навбар ушёл за экран (invisible).

- **Spacer в HomePage, а не в NavigationBar** — невидимый div `100dvh`
  создаётся внутри HomePage, а не в NavigationBar. Это гарантирует,
  что ScrollTrigger анимирует навбар только на `/home`, и не мешает
  на других роутах.

- **Жизненный цикл триггера — на стороне страницы** — страница вызывает
  `registerScrollTrigger` в `useEffect` и получает cleanup, который убивает
  ScrollTrigger и таймлайн (`kill()`) при размонтировании. Никаких утечек
  при переходах между роутами; навбар остаётся независимым модулем.
