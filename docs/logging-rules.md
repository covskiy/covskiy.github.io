# Правила логирования (Logging Convention)

## Цель

Единый стиль вызовов логгера во всех компонентах — предсказуемая и читаемая консоль при дебаге анимаций и lifecycle.

---

## 1. Первый аргумент — module tag

Всегда передавай название модуля первым строковым аргументом. Это тег, который отображается цветом в консоли.

```ts
logger.info('IntroAnimation', 'Master timeline created');   // ✓
logger.info('master timeline created');                      // ✗ — нет тега
```

**Соглашение по именованию тегов:**
- Компоненты: `PascalCase` — `IntroAnimation`, `PageTransition`, `LogoText`
- Утилиты: `camelCase` или как название файла — `introStorage`, `initGsap`
- Роуты: как путь — `/about`, `/home`

> Если имя модуля не зарегистрировано в палитре цветов логгера (`src/utils/logger.ts` — `MODULE_COLORS`), при первом вызове появится `console.warn` с сообщением, и цвет будет сгенерирован автоматически (детерминированный HSL от хэша имени). Для кастомного цвета — добавь запись в `MODULE_COLORS`.

---

## 2. Когда какой уровень использовать

| Уровень | Когда использовать | Пример |
|---------|-------------------|--------|
| `error` | GSAP-коллбек с ошибкой, исключение в useGSAP, сбой анимации | `logger.error('IntroAnimation', 'onComplete was not called')` |
| `warn` | Условный байпас, fallback-состояние, missing ref | `logger.warn('LogoText', 'containerRef is null, skipping animation')` |
| `info` | Lifecycle: монтирование, onComplete таймлайна, смена роута | `logger.info('IntroAnimation', 'Master timeline complete')` |
| `debug` | Параметры анимаций: start, duration, position, easing | `logger.debug('LogoText', 'C phaseShoe', { x: -45, duration: 0.5 })` |
| `trace` | Массовые события, циклические вызовы (только при diagnose) | Включать только через `localStorage.setItem('loggerLevel', 'trace')` |

**Если сомневаешься** — используй `debug`. `info` — только для значимых точек.

---

## 3. Структура сообщения

```
logger.<level>('<ModuleTag>', '<action>', <data?>)
```

- `<action>` — краткий глагол или описание (на английском или русском, единообразно в рамках модуля)
- `<data>` — опциональный объект с контекстом

```ts
// Хорошо:
logger.debug('LogoText', 'C phaseShoe', { x: -45, rotate: -90, duration: 0.5 });

// Плохо — информация в строке без структуры:
logger.debug('LogoText', 'C phaseShoe x=-45 rotate=-90 duration=0.5');
```

---

## 4. Чего НЕ делать

- **НЕ логировать onUpdate GSAP-анимаций** — зашумляет консоль до бесполезности
- **НЕ использовать logger в import.meta.env.PROD путях** — ранний return экономит байты в бандле
- **НЕ передавать секреты, токены, localStorage-ключи**
- **НЕ мешать с raw console.log** — либо logger, либо console, не оба в одном файле
- **НЕ использовать logger.trace без явного включения** — `trace` по умолчанию выключен, писать `trace` имеет смысл только если ты знаешь, что включишь его через localStorage при диагностике

---

## 5. Когда добавлять логирование в код

| Ситуация | Уровень |
|----------|---------|
| Новый анимированный компонент | `debug` для каждой фазы анимации |
| Новый компонент с роутингом | `info` при монтировании/размонтировании |
| Компонент с async-операциями | `warn` для fallback, `error` для ошибок |
| Рефакторинг существующей анимации | `debug` для start/duration ключевых точек |
| Исправление бага с таймингом | временно поднять до `trace` affected-модуль |

---

## 6. Примеры для каждого уровня

```ts
// error — анимация не запустилась
try {
  master.play();
} catch (e) {
  logger.error('IntroAnimation', 'Failed to play master timeline', e);
}

// warn — пропуск анимации
if (!containerRef.current) {
  logger.warn('PageTransition', 'containerRef is null, skipping entrance');
  return;
}

// info — ключевая точка lifecycle
logger.info('IntroAnimation', 'Master timeline complete, redirecting to /home');

// debug — фаза анимации
logger.debug('LogoText', 'Cursor phaseMoving', {
  xPosition: 106,
  duration: 1.6,
});

// trace — диагностика (включить через localStorage)
logger.trace('IntroAnimation', 'Master timeline progress', master.time());
```

---

## 7. Соблюдение в команде / code review

При code review обращай внимание на:
- Передачу module-тега первым аргументом
- Соответствие уровня ситуации (не `info` для мелочей, не `trace` для обычного дебага)
- Отсутствие `onUpdate`-логов в ревью
- Отсутствие raw `console.log` рядом с `logger.*`
