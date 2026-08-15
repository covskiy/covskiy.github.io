# Тесты layout-движка, политик навбара и обвязки хуков: как читать

Юнит-тесты (`vitest`) покрывают:

- чистый слой: `machine/` + не-React `engine.ts`;
- чистые политики навбара: `machine/navPolicy.ts`;
- обвязку GSAP-хуков (`nav/`, `slots/`) через jsdom + моки GSAP.

Запуск — `npm run test`, прогоняется в pre-commit.

---

## 1. Словарь терминов

Имена тестов говорят на языке машины. Перевод в пользовательские термины:

| Термин машины        | Продукт-смысл                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TOGGLE`             | Нажатие кнопки-«бургера» переключения навбара                                                                                                                                |
| `REACH_TOP`          | Скролл дошёл до верхней границы спейсера на /home (progress ≈ 0)                                                                                                             |
| `REACH_BOTTOM`       | Скролл дошёл до нижней границы спейсера на /home (progress ≈ 1)                                                                                                              |
| `ROUTE_CHANGED`      | Переход на другой роут (страницу)                                                                                                                                            |
| `BREAKPOINT_CHANGED` | Поворот/изменение ширины вьюпорта (смена mobile/tablet/desktop)                                                                                                              |
| `INTRO_COMPLETE`     | Завершение intro-анимации при первом заходе                                                                                                                                  |
| `fullscreen`         | Навбар развёрнут на всю ширину                                                                                                                                               |
| `standard`           | Навбар в стандартной (широкой) колонке                                                                                                                                       |
| `slim`               | Навбар в узкой полосе (планшетный режим)                                                                                                                                     |
| `invisible`          | Навбар скрыт за краем экрана                                                                                                                                                 |
| `preferred`          | Ручной выбор пользователя на планшете (slim или standard)                                                                                                                    |
| `homeEndState`       | Во что сворачивается навбар, когда спейсер доскроллен до нижней границы на /home                                                                                             |
| `manualOverride`     | Ставится при ручном открытии навбара на mobile /home, снимается при ручном закрытии и reset-событиях (REACH_TOP/route/bp/REACH_BOTTOM без override)                          |
| `isManualToggle`     | Производный флаг снапшота: на mobile навбар открыт вручную (bp==='mobile' && manualOverride) — кнопка видна даже в scrub-зоне; недостижим с invisible после ручного закрытия |
| `isHome`             | Находимся ли на домашней странице (`/`, `/home`)                                                                                                                             |
| `bp` / `Breakpoint`  | Текущий тир брейкпоинта: mobile / tablet (768) / desktop (1024)                                                                                                              |

### Сайд-эффекты переходов (`LayoutAction`)

| Действие           | Что происходит                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOTIFY_NAV_STATE` | Состояние навбара изменилось — подписчиков уведомить                                                                                              |
| `SCROLL_TO_END`    | Скролл в конец scroll-области (на /home — конец спейсера); потребляется `GsapProvider` (`subscribeActions` → `gsap.to(window, scrollTo: st.end)`) |
| `RETARGET_SCRUB`   | Перецелить scroll-скраб на новую геометрию навбара                                                                                                |
| `NOOP`             | Переход без эффектов                                                                                                                              |

### Протокол `*After`-полей (`TransitionResult`)

Поля `preferredAfter` и `manualOverrideAfter` — это явный bool (или `null`/
`undefined`) на стороне reducer-а. Движок резолвит `undefined` через `??` в
текущее значение контекста. Таблица событий — в `docs/Components/Layout/README.md` §5.

---

## 2. Конвенция именования

Имя теста — поведение, а не список терминов. Формат — GWT-предложение на
русском, с маленькой буквы:

> когда <условие+действие>, <ожидаемый результат>

Технические термины можно добавлять в скобках в конце для точности.

**Меньше примеров:**

- `mobile /home: TOGGLE fullscreen → invisible (+SCROLL_TO_END)`
  → `когда на /home на mobile жмут бургер, навбар сворачивается и scroll-область доскролливается в конец`
- `REACH_BOTTOM запинен toggle-ом → noop`
  → `когда на mobile навбар запинен бургером, скролл спейсера до нижней границы ничего не меняет`
- `BREAKPOINT_CHANGED → non-home с preferred=slim переход на mobile (сброс)`
  → `когда non-home переезжает на mobile, предпочтение slim сбрасывается в default`

Имена `describe` осмысленные, сгруппированы по поведению; `it`/`Case.name` —
строки vitest-отчёта, их читает человек.

---

## 3. Структура — AAA

- **Табличные кейсы** (`it.each`): конфиг `Case` (bp/isHome/initialMode/
  preferred) = Arrange, `steps` (событие + ожидание) = Act + Assert.
- **Отдельные тесты**: явные секции `// Arrange` / `// Act` / `// Assert`.

Держим тело каждого теста ровно в этих трёх фазах, без логики в комментариях.

---

## 4. Что покрыто

| Файл                                            | Проверяет                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `machine/transition.test.ts`                    | Поведение reducer-а: события, actions, `preferredAfter`, `manualOverrideAfter`      |
| `machine/derive.test.ts`                        | Чистые хелперы (default state, валидность preferred, home-пути)                     |
| `machine/geometry.test.ts`                      | Числовая геометрия навбара (сдвиг, отступ контента)                                 |
| `machine/layoutSnapshot.test.ts`                | Иммутабельность и CSS-переменные снапшота                                           |
| `engine.test.ts`                                | Контракт движка: subscribe/notify, getSnapshot/getMode, viewport, manualOverride    |
| `machine/navPolicy.test.ts`                     | Чистые политики навбара: scrub-build, discrete-skip, resync-guard, видимость toggle |
| `nav/NavigationBar/useNavPosition.test.tsx`     | Обвязка: scrub-build/rebuild, discrete-skip, bus-подписка, resync (jsdom)           |
| `nav/ToggleButton/useToggleVisibility.test.tsx` | Обвязка: видимость кнопки по progress/manual (jsdom)                                |
| `slots/useLayoutApplier.test.tsx`               | Обвязка: gsap.to CSS-переменных, scroll-lock, ScrollTrigger.refresh (jsdom)         |

Ограничение покрытия — осознанное: без jsdom/happy-dom React-слой не
тестировался; с задачей 16 обвязка хуков тестируется в jsdom через моки GSAP,
но реальный DOM-рендер навбара и реальный ScrollTrigger/rAF — по-прежнему
ручная проверка в `npm run dev`.

---

## 5. Тестирование GSAP/DOM-слоя (хуки и applier)

Среда: `// @vitest-environment jsdom` per-file + `setupFiles` →
`src/test/setupGsapMock.ts` (моки `gsap`, `gsap/ScrollTrigger`, `@gsap/react`).

Render-хелпер: `src/test/renderHookLite.tsx` (0 новых рантайм-deps, только
`react` + `react-dom/client`). Провайдеры: `src/test/renderEngine.tsx`
(`makeRenderEnv`) — лёгкий движок + gsapBus + контексты.

> **Почему не `@testing-library/react` (renderHook):** решение осознанное —
> замена `renderHookLite` на RTL потребовала бы 2 новых devDeps
> (`@testing-library/react` v16 под React 19 + обязательный peer
> `@testing-library/dom`), а весь их инструментарий (`getBy*`, `fireEvent`,
> `waitFor`) для тестов хуков и провайдеров не нужен — сценарии синхронные,
> DOM-взаимодействия не тестируются. Это противоречит критерию плана 16:
> «0 новых devDeps, кроме jsdom». При расширении функций сохраняем
> совместимость по API с `renderHook` (`result` / `rerender` / `unmount`,
> см. `renderHookLite.tsx:15-19`), чтобы при появлении DOM-тестов (клики по
> toggle, рендер навбара) переход на RTL был точечной заменой файла.

Что покрываем:

- подписки и их cleanup (unmount → повторный `bus.emit` не дёргает твины);
- последовательность `kill → fromTo → progress(prev)` при пересборке scrub;
- `prevManualRef.current = manualNow` **после** skip-guard (E2.3);
- `lastProgressRef` после перезапуска эффекта (back-navigation на /home);
- scroll-lock на `documentElement.style.overflow` и `ScrollTrigger.refresh`
  в `onComplete`.

Что НЕ покрываем: реальный rAF, реальный ScrollTrigger, реальный DOM-рендер
навбара — для этого остаётся ручная проверка в `npm run dev`.

---

## 6. Глоссарий императивной логики

- `scrub-режим` — paused `fromTo`-твин на /home, ведомый `scroll:progress`;
- `discrete-режим` — `gsap.to` на смену mode (toggle/route/breakpoint);
- `prevProgress` — сохранённый прогресс при пересборке scrub-твина
  (`existingProgress` из `scrubTweenRef` — ref не обнуляется на смену deps,
  т.к. `useGSAP` с dependencies не зовёт cleanup, см. E1.2);
- `prevManualRef` — буфер «было ли manual в предыдущем snapshot»
  (skip-логика discrete);
- `lastProgressRef` — последний известный прогресс для `useToggleVisibility`
  (corner: back-nav на /home уже на дне);
- `EDGE_EPS` — граница включительности `progress >= 1 - EDGE_EPS`.
