# Logger — Система логирования (v1)

## Обзор

Лёгкая система логирования для отладки GSAP-анимаций и отслеживания lifecycle компонентов. Работает только в dev-режиме (за исключением `error` и `warn` в production).

## Быстрый старт

```ts
import { logger } from '../utils/logger';

logger.info('IntroAnimation', 'Master timeline created');
logger.debug('LogoText', 'C phaseShoe', { x: -45, duration: 0.5 });
```

## API

### `createLogger(level: LogLevel): Logger`

Создаёт инстанс логгера с указанным порогом.

### `logger.*`

Пять методов, каждый принимает `module` (первый аргумент — строковый тег) и произвольное количество аргументов:

```ts
logger.error(module: string, ...args: unknown[]): void
logger.warn(module: string, ...args: unknown[]): void
logger.info(module: string, ...args: unknown[]): void
logger.debug(module: string, ...args: unknown[]): void
logger.trace(module: string, ...args: unknown[]): void
```

## Уровни логирования

| Уровень | Числовой вес | Дефолт DEV | Дефолт PROD |
|---------|-------------|------------|-------------|
| error   | 0           | ✓          | ✓           |
| warn    | 1           | ✓          | ✓           |
| info    | 2           | ✓          | ✗           |
| debug   | 3           | ✓          | ✗           |
| trace   | 4           | ✗          | ✗           |

Вызов метода срабатывает, если его числовой вес ≤ порогу.

## Конфигурация через localStorage

Управление порогом в рантайме без пересборки:

```js
// В консоли браузера:
localStorage.setItem('loggerLevel', 'trace');  // максимум деталей
localStorage.setItem('loggerLevel', 'info');    // только важное
localStorage.removeItem('loggerLevel');         // сброс к дефолту
```

Доступные значения: `error`, `warn`, `info`, `debug`, `trace`.

## Dev-хелпер в консоли (только DEV)

В dev-режиме на `window` доступен объект `loggerDebug` для удобного управления уровнем без ручной работы с `localStorage`:

```js
loggerDebug.setLevel('trace');   // Установить уровень + запись в localStorage
loggerDebug.status();            // Показать текущий уровень и значение в localStorage
loggerDebug.reset();             // Сброс на debug (по умолчанию)
loggerDebug.levels();            // Список доступных уровней с весами
```

> `setLevel()` применяет уровень мгновенно (без перезагрузки страницы). При reload значение подхватывается из `localStorage`.

## Цветовые теги

Первый аргумент (`module`) отображается цветным тегом в квадратных скобках для визуального разделения сообщений.

Пример вывода в консоль:
```
[PageTransition] Entering /about
[IntroAnimation]  Master timeline created
[LogoText]       C morph start: 0s, duration: 0.5s
```

Цвета модулей заданы статической палитрой в `logger.ts`.

## Производственный режим

В production (`import.meta.env.PROD`):
- Вызовы `info`, `debug`, `trace` завершаются мгновенно (ранний return)
- `error` и `warn` работают как обычно
- Дополнительные байты в бандле: ~300 gzip (все 5 методов, но три из них — пустышки)

## Будущее: транспорты

Архитектура допускает добавление транспортов без изменения API вызова:

```ts
interface LogTransport {
  log(entry: LogEntry): void;
}

// ConsoleTransport — всегда включён
// ApiTransport — заглушка, будет подключена при появлении backend API
```

## Примеры использования

**IntroAnimation:**
```ts
logger.info('IntroAnimation', 'Master timeline building');
const master = gsap.timeline({
  onComplete: () => {
    logger.debug('IntroAnimation', `Master complete @ ${master.time()}s`);
    onComplete?.();
  },
});
```

**PageTransition:**
```ts
logger.debug('PageTransition', `Entering ${location.pathname}`);
useGSAP(() => {
  logger.info('PageTransition', 'Entrance animation started');
  // ... GSAP анимация
}, { dependencies: [location.pathname] });
```

**LogoText — фазы анимации:**
```ts
logger.debug('LogoText', 'C phaseShoe', {
  x: letterC.phaseShoe.xPosition,
  rotate: letterC.phaseShoe.rotate,
  duration: letterC.phaseShoe.duration,
});
```
