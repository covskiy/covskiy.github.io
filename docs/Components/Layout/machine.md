# machine — чистая логика раскладки

`src/components/layout/machine/` — слой **без React и GSAP**: только типы и
хелперы. НЕ импортирует React/GSAP/Context. Импортируется любым слоем.

## `layoutMode.ts`

- `LayoutMode` — `'fullscreen' | 'standard' | 'slim' | 'invisible'`.
- `LayoutChangeSource` — `'toggle' | 'route' | 'breakpoint' | 'scroll'`.
  Источник позволяет отличить автоматическое переключение (скролл, роут,
  breakpoint) от ручного (toggle) — в первую очередь для сцены-владельца
  позиции `.nav`.

## `geometry.ts`

- `SLIM_WIDTH = 80` — ширина slim-навбара (px).
- `getNavTransform(mode, viewport): NavTransform` — `navX` для GSAP-твинов:
  навбар всегда `100vw`, видимая ширина достигается сдвигом окна.
- `deriveMainOffset(mode, bp, isHome, homeEndState?): string` — отступ
  контентной области `<main>` (CSS-единица). `mobile → 0`, `/home`
  fullscreen маппится на `homeEndState`, иначе `25vw`/`80px`/`0px`.

## `derive.ts`

- `isHomePath(pathname)` — `/` или `/home`.
- `hasToggleFor(bp)` — toggle есть везде кроме desktop.
- `getDefaultState(bp, isHome)` — `/home` → fullscreen; иначе invisible/slim/standard.
- `getNextState(current, bp)` — ручное переключение (mobile invisible↔fullscreen,
  tablet standard↔slim, desktop → null).
- `homeEndStateFor(bp, preferred)` — конечное состояние на `/home` после скролла.
- `isManualMobileState(bp, source, mode)` — признак ручного mobile-состояния
  («пин» scrub-таймлайна).
- `isPreferredStateValid(state, bp)` — персистируем только tablet slim/standard.
