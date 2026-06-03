# LogoText — Архитектура компонента

## Обзор

Анимированный SVG-логотип для сплэш-экрана. Две начальные фигуры (подкова + гвоздь) морфируют в слово **COVSKIY** с помощью GSAP `MorphSVGPlugin`. Курсороподобный элемент последовательно открывает буквы.

## Файлы

| Файл                  | Назначение                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `LogoText.tsx`        | Логика компонента — GSAP timeline + импорт SVG                          |
| `LogoText.svg`        | Исходный SVG с двумя слоями (исходные фигуры + пути букв)               |
| `LogoText.module.css` | Контейнер + глобальные CSS-переопределения для начального состояния SVG |

## Структура SVG

Два слоя внутри `viewBox="0 0 200 150"`:

### `#layer1` (скрыт, `style="display:none"`) — Финальные пути букв

```
path.letter-c — контур "C"
path.letter-o — контур "O"
path.letter-v — контур "V"
path.letter-s — контур "S"
path.letter-k — контур "K"
path.letter-i — контур "I"
path.letter-y — контур "Y"
```

### `#layer2` (видим) — Исходные фигуры

```
path.img-orig.img-c   — подкова (видна изначально)
path.img-nail          — гвоздь (виден изначально, за экраном)
rect.img-orig.img-cur  — курсор/каретка (скрыт изначально)
rect.img-orig.img-o    — маркер позиции O (скрыт изначально)
rect.img-orig.img-v    — маркер позиции V (скрыт изначально)
rect.img-orig.img-s    — маркер позиции S (скрыт изначально)
rect.img-orig.img-k    — маркер позиции K (скрыт изначально)
rect.img-orig.img-i    — маркер позиции I (скрыт изначально)
```

## Интерфейс компонента

```tsx
type RegisterTimelineFn = (tl: gsap.core.Timeline, position?: number) => void;

type AnimationComponentProps = {
  onRegisterTimeline: RegisterTimelineFn;
};
```

Получает колбэк `onRegisterTimeline`, создаёт свой внутренний таймлайн и регистрирует его через колбэк. Родитель (SplashPage) сам добавляет его в мастер-таймлайн.

## Последовательность анимации

Все тайминги на **общем `timeline`** (позиционные, не абсолютное время).

| Позиция на timeline                              | Фаза                                 | Что происходит                                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0s**                                           | Начальный `gsap.set`                 | `.img-c` видна; `.img-nail` смещён вправо-вверх `(x:300, y:-150, rot:540)`; все `.img-orig` скрыты                                                              |
| **0s → 1.2s**                                    | Гвоздь прилетает                     | `gsap.from('.img-nail', { x:300, y:-150, rotation:540 })` — дуга с 1.5 оборотами                                                                                |
| **1.2s → 1.7s**                                  | Гвоздь → img-o                       | `gsap.to('.img-nail', { morphSVG: '.img-o', x: dx, y: dy })` — гвоздь сжимается в тонкий прямоугольник на позиции O. On complete: скрыть nail, показать `img-o` |
| **1.7s → 4.7s**                                  | Курсор движется                      | `gsap.to('.img-cur', { x: deltaX })` — курсор скользит вправо 3s, `ease: 'none'`                                                                                |
| **1.7s** (старт курсора)                         | Подкова → C                          | `morphSVG: letter-c` на `.img-c`                                                                                                                                |
| **прогрессивно** (курсор проходит каждый маркер) | img-{o,v,s,k,i} → letter-{o,v,s,k,i} | `onUpdate` проверяет `cursorCenter >= markerX`; запускает `morphSVG` + видимость для каждой буквы                                                               |
| **4.7s** (конец курсора)                         | Курсор → Y                           | `morphSVG: letter-y` на `.img-cur`                                                                                                                              |

## Архитектура регистрации

Компонент не получает мастер-таймлайн напрямую. Через колбэк `onRegisterTimeline` он сообщает родителю (SplashPage): «вот мой локальный таймлайн, добавь его в мастер». Это обеспечивает слабую связанность: дети не знают о структуре мастер-таймлайна и не мутируют его напрямую.

```tsx
// внутри useGSAP
const tl = gsap.timeline({ id: 'Logo.tsx tl' });
// наполнение tl анимациями...
onRegisterTimeline(tl); // регистрация без позиции (по умолчанию 0)
```

## Ключевые технические решения

### Извлечение данных путей

`#layer1` имеет `display:none`. Данные путей букв извлекаются через `getAttribute('d')` и сохраняются как строки:

```ts
const ltr = {
  c: svg.querySelector('.letter-c')?.getAttribute('d') ?? '',
};
```

Строки передаются в `morphSVG` для обхода проблем с `display:none`.

### Определение позиции

Эффективная позиция курсора в SVG: `curBBox.x + gsap.getProperty('.img-cur', 'x')`. Порог срабатывания — центр курсора:

```ts
const cursorCenter = curBBox.x + gsapX + curBBox.width / 2;
if (cursorCenter >= positions[letter] && !morphed[letter]) { ... }
```

### CSS module — начальное состояние

```css
:global(#layer1) {
  display: block !important;
  visibility: hidden;
  opacity: 0;
}

:global(.img-orig:not(.img-c)) {
  opacity: 0;
  visibility: hidden;
}
```

Все правила `:global()` нацелены на внутренние классы SVG (не изменяются SVGR). `.img-orig:not(.img-c)` скрывает все исходные фигуры кроме подковы.

### Переход гвоздь → img-o

```
morphSVG: { shape: '.img-o' }  — MorphSVGPlugin конвертирует <rect> в path
x: imgOBBox.x - nailBBox.x     — смещение к позиции маркера O
y: imgOBBox.y - nailBBox.y
```

После морфа: `.img-nail` скрыт, `.img-o` показан (та же позиция, та же форма → бесшовно).

### Морф курсора в Y

В `onComplete` tween'а курсора, не через триггер позиции.

## Зависимости

- `gsap` (MorphSVGPlugin — зарегистрирован в `initGsap.ts`)
- `@gsap/react` (хук `useGSAP` — автоочистка)
- Vite SVGR (суффикс `?react` для импорта SVG)
