# Koobiq Demos

Каталог маленьких изолированных демо на Angular 21 и Koobiq 21. Главная страница — список демо, у каждого демо своя страница с шапкой: «Назад», ссылка на код в репозитории, скачивание zip и переключатель темы (светлая / тёмная / системная, по умолчанию системная).

## Запуск

```bash
npm install
npm start          # http://localhost:4200
npm test -- --watch=false
npm run test:scripts
npm run build
```

`npm start` и `npm run build` сначала собирают zip-архивы демо в `public/downloads/`.

## Как добавить демо

1. Создайте папку `src/demos/<slug>/` (slug — kebab-case) с корневым standalone-компонентом демо.
2. Добавьте одну запись в `src/demos/demos.registry.ts`: `slug`, `title`, `description`, `loadComponent` и, если нужно, `providers`.

Правила изоляции: демо не добавляет глобальных стилей. Стили — в компонентах демо (`ViewEncapsulation.Emulated`; `ShadowDom` не использовать: глобальные стили Koobiq и оверлеи не попадают внутрь shadow root), переопределения компонентов Koobiq — через CSS-переменные на собственном классе, провайдеры — в `providers` записи реестра.

## Устройство

- **Тема:** штатный `KbqThemeService` (`kbqThemeProvider` в `app.config.ts`), класс `kbq-light` / `kbq-dark` на `<body>`; переключатель — `ThemeToggleComponent`.
- **Маршруты:** `''` — каталог, `demo/<slug>` — оболочка `DemoShellComponent` + lazy-демо; неизвестный slug ведёт на каталог.
- **Ссылки на код:** `src/app/config.ts` (`REPO_URL`, `REPO_BRANCH`).
- **Zip:** `scripts/zip-demos.mjs` пакует `src/demos/<slug>` в `public/downloads/<slug>.zip`.
