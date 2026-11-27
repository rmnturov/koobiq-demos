# Статья в гриде — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в конец полигона настольный грид, из которого открывается компактная Markdown-статья.

**Architecture:** Локальный компонент отвечает за таблицу, выбор записи и контентную панель. Шаблон статьи объявлен в полигоне и передаётся в компонент через Angular TemplateRef. Поэтому у статьи та же область действия стилей, что и у других примеров, а шкала H1 наследуется от общих ползунков.

**Tech Stack:** Angular 21, AG Grid Community, компоненты и тема Koobiq, SCSS, Vitest.

**Spec:** [Статья Markdown в контентной панели грида](../specs/2026-11-27-markdown-in-grid-design.md)

## Global Constraints

- Один настольный пример во всю ширину после последней секции. На узком экране прокручивается область примера.
- Вверху грида — топ-бар. Статья в панели начинается с H1, совпадающего с названием выбранной строки.
- Текст 14/20. Пресеты H1, регулировка пар и сброс используют существующие контролы.

## Review Focus

Проверить первое открытие, смену строки при открытой панели, выбор клавиатурой, сохранение выбора при сбросе шкалы и настольную типографику при включённом мобильном предпросмотре.

### 1. Грид и выбор статьи

Файлы в `src/demos/markdown-playground/`: создать `incident-articles.ts`, `article-grid.component.ts`, `article-grid.component.html`, `article-grid.component.scss` и `article-grid.component.spec.ts`.

- [x] Добавить тест открытия и смены двух записей. Начальное состояние панели закрыто. Клик по строке и Enter на ячейке выбирают запись по стабильному идентификатору.
- [x] Описать небольшой набор записей с названием, статусом, временем обновления и текстом. Получать Markdown статьи как `# ${record.name}\n\n${record.body}`. В первой статье предусмотреть два абзаца, соседние H2 и H3 и блок кода.
- [x] Собрать `ArticleGridComponent` из `kbq-top-bar`, `ag-grid-angular` с темой Koobiq и `kbq-content-panel`. Использовать оформление контейнера из `grid-auto-refresh.demo.scss`. В теле панели выводить переданный шаблон с Markdown выбранной записи.
- [x] Запустить `npm test -- --watch=false --include='src/demos/markdown-playground/article-grid.component.spec.ts'` и проверить открытие, смену статьи и закрытие.

### 2. Интеграция в полигон

Файлы в той же папке: `markdown-playground.demo.ts`, `markdown-playground.demo.html`, `markdown-playground.demo.spec.ts`. Использовать `ArticleGridComponent` из первого шага.

- [x] Проверить тестом, что ссылка «Статья в интерфейсе» ведёт на последнюю секцию `#article-in-grid`.
- [x] Поместить отдельный пример внутри существующей `.layout`, после парных образцов. В передаваемом шаблоне использовать `.markdown-desktop`, `.markdown-compact` и `kbq-markdown[markdownScrollableBlocks]`.
- [x] Проверить в браузере, что название первой и второй выбранных строк совпадает с H1. С открытой статьёй выбрать Title, изменить отступ H2–H3 и нажать «Сбросить». Ожидаемые метрики H1 — 20/28 при Title и 28/32 после сброса. Абзацы — 14/20 в обоих случаях.
- [x] Включить мобильный предпросмотр при открытой статье и проверить сохранение настольной шкалы и грида рядом с панелью. На узком экране проверить границы прокрутки.
- [x] Запустить `npm test -- --watch=false --include='src/demos/markdown-playground/*.spec.ts'` и `npm run build`. Проверить сборку демо и включение новых файлов в его ZIP.
