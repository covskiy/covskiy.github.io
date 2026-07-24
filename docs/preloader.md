# Preloader — Описание работы

## Обзор

Preloader — это легковесный HTML/CSS компонент, который отображается пользователю во время загрузки тяжёлых JavaScript-зависимостей (React, React Router, GSAP и др.). Он устраняет проблему «белого экрана», показывая пользователю анимацию загрузки и прогресс в виде счётчика загруженных ресурсов.

## Архитектура

Preloader состоит из трёх частей:

1. **HTML-разметка** — контейнер с анимацией и счётчиком
2. **CSS-стили** — оформление и анимация спиннера
3. **JavaScript-логика** — отслеживание ресурсов и управление видимостью

## Жизненный цикл работы

### 1. Инициализация (сразу после загрузки HTML)

```
HTML загружен → Preloader отображается → Начинается отслеживание ресурсов
```

- Прелоадер вставляется inline в `index.html` сразу после тега `<body>`
- CSS-стили также inline, поэтому стили применяются мгновенно без дополнительных запросов
- JavaScript-скрипт запускается немедленно и начинает подсчёт загруженных ресурсов

### 2. Ожидание загрузки ресурсов

```
Счётчик обновляется каждые 100ms → Пользователь видит прогресс
```

- Скрипт использует `performance.getEntriesByType('resource')` для получения количества загруженных ресурсов
- Счётчик обновляется каждые 100мс через `setInterval`
- Пользователь видит: `X / Y ресурсов загружено`

### 3. Загрузка и рендер React приложения

```
main.tsx загружен → Вызывается hidePreloader() → Рендер React
```

- Когда модуль `main.tsx` загружается и начинает выполняться, первым делом вызывается `window.hidePreloader()`
- Это происходит **до** `createRoot().render()`, то есть React ещё не начал рендерить

### 4. Скрытие прелоадера

```
hidePreloader() → Добавляется класс .hidden → Через 400ms удаляется из DOM
```

- Вызов `hidePreloader()` добавляет CSS-класс `.hidden` к прелоадеру
- CSS `transition` обеспечивает плавное затухание за 0.4 секунды
- После завершения анимации элемент полностью удаляется из DOM

## Детали реализации

### HTML-структура

```html
<div id="preloader">
  <div class="preloader-content">
    <div class="spinner"></div>
    <div class="preloader-text">
      <span id="resource-counter">0</span> /
      <span id="total-resources">0</span> ресурсов загружено
    </div>
  </div>
</div>
```

- `#preloader` — фиксированный контейнер на весь экран (`position: fixed`)
- `.spinner` — CSS-анимация вращения
- `#resource-counter` — текущее количество загруженных ресурсов
- `#total-resources` — общее количество обнаруженных ресурсов

### CSS-анимация

**Спиннер:**

```css
.spinner {
  width: 50px;
  height: 50px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #333;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
```

**Скрытие:**

```css
#preloader {
  transition:
    opacity 0.4s ease,
    visibility 0.4s ease;
}

#preloader.hidden {
  opacity: 0;
  visibility: hidden;
}
```

### JavaScript-логика

**Отслеживание ресурсов:**

```javascript
let loadedCount = 0;

// Обновление счётчика каждые 100мс
const updateInterval = setInterval(function () {
  const currentResources = performance.getEntriesByType('resource').length;
  loadedCount = Math.max(loadedCount, currentResources);
  updateCounter();
}, 100);
```

- `performance.getEntriesByType('resource')` — Performance API, возвращает все загруженные ресурсы (скрипты, стили, изображения и т.д.)
- `Math.max()` гарантирует, что счётчик не уменьшается

**Функция скрытия:**

```javascript
window.hidePreloader = function () {
  clearInterval(updateInterval);
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.classList.add('hidden');
    setTimeout(function () {
      preloader.remove();
    }, 400);
  }
};
```

- Останавливает `setInterval` для экономии ресурсов
- Добавляет CSS-класс для анимации затухания
- Через 400мс (после завершения CSS-transition) удаляет элемент из DOM

## Интеграция с React

В `src/main.tsx`:

```typescript
// Объявление типа для TypeScript
declare global {
  interface Window {
    hidePreloader?: () => void;
  }
}

// Вызов функции до рендера
if (typeof window.hidePreloader === 'function') {
  window.hidePreloader();
}

createRoot(document.getElementById('root')!).render(...);
```

- `declare global` — объявление глобальной функции для TypeScript
- Вызов происходит **до** `createRoot().render()`, что гарантирует отсутствие мерцания
- Проверка `typeof` обеспечивает безопасность, если прелоадер отсутствует

## Последовательность событий (Timeline)

```
Время →
|-----------------------------------------------------------|
[HTML загружен]
     |
     v
[Preloader показан]
     |
     v
[setInterval запущен → счётчик обновляется]
     |
     v
[Загрузка vendor скриптов...]
     |
     v
[main.tsx загружен]
     |
     v
[hidePreloader() вызван]
     |
     v
[.hidden добавлен → CSS transition 0.4s]
     |
     v
[createRoot().render() → React рендерит приложение]
     |
     v
[Preloader удалён из DOM]
```

## Преимущества

- **Мгновенный показ** — inline HTML/CSS, нет ожидания загрузки скриптов
- **Минимальный вес** — нет внешних зависимостей, только нативный JS
- **Визуальный прогресс** — счётчик ресурсов даёт пользователю ощущение прогресса
- **Плавное скрытие** — CSS transition без рывков
- **Автоматическая очистка** — элемент удаляется из DOM, не занимает память
- **TypeScript-совместимость** — корректное объявление глобальной функции

## Ограничения

- `performance.getEntriesByType('resource')` не включает модули, загруженные через `import()` динамически
- Счётчик обновляется каждые 100мс, что может быть не мгновенно при очень быстрой загрузке
- В режиме SSR требуется дополнительная настройка (текущая реализация клиентская)

## Файлы

| Файл           | Описание                                                  |
| -------------- | --------------------------------------------------------- |
| `index.html`   | Содержит HTML-разметку, CSS-стили и JavaScript прелоадера |
| `src/main.tsx` | Вызывает `hidePreloader()` перед рендером React           |
