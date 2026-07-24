# LandingSections

Основной контент HomePage, отображаемый после завершения IntroAnimation. Состоит
из двух секций: hero (приветствие) и features (преимущества).

## Архитектура

```
components/LandingSections/
├── index.ts                       # Barrel: LandingSections
├── LandingSections.tsx            # Компонент (named export)
└── LandingSections.module.css     # Стили (CSS Modules)
```

## Структура компонента

- `<main>` — корневой контейнер (`styles.home`)
- `<section className={styles.hero}>` — hero-секция с заголовком и описанием
- `<section className={styles.features}>` — секция преимуществ с карточками
  - `<div className={styles.grid}>` — grid-контейнер для карточек
  - Три карточки: Качество, Опыт, Результат

## Связь с IntroAnimation

`LandingSections` рендерится всегда (с первого рендера HomePage). IntroAnimation
отображается как overlay поверх него. После завершения анимации IntroAnimation
анмаунтится, открывая контент.

## Ключевые решения

- **Named export** — соответствует соглашению проекта (все компоненты используют named exports)
- **CSS Modules** — собственный модуль стилей, изолированный от HomePage
- **В `components/`** — переиспользуемый компонент, не привязанный к конкретной странице
