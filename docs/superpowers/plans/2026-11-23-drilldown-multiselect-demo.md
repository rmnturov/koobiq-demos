# Drilldown Multiselect Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal** — Add the searchable incident-field multiselect to the end of «Параметры таблицы».

**Architecture** — Keep the test screen and its state in `DrilldownMenuDemo`. Give the existing shell optional `beforeContent` and `footer` templates outside its scrollbar viewport and let it reveal an active option within the viewport.

**Tech Stack** — Angular signals and templates, Koobiq, Angular CDK and Vitest.

**Spec** — [`docs/superpowers/specs/2026-11-23-drilldown-multiselect-demo-design.md`](../specs/2026-11-23-drilldown-multiselect-demo-design.md)

## Global Constraints

- Use four groups and Russian incident fields. Filter by case-insensitive substring and use Koobiq's background highlight for matches.
- Keep the query and results in one tab stop. Preserve text editing and let Arrow Up, Arrow Down and Enter control the active option.
- Keep selected values across filters and menu sessions. Clear the query on close. Reset clears the query and restores default values.

## Review Focus

- Cyrillic and literal punctuation are valid searches. Test a mixed-case query and an unmatched metacharacter.
- Active descendants must exist after filtering. Test an empty result after using arrows.
- Moving with arrows preserves selection and yields one tab stop. Test Enter, Space, Tab and Shift+Tab.
- Returning to the root restores its opener. Reopening the whole menu clears the query and leaves selection intact. Test both transitions.
- Short and scrolling result sets keep the search and footer outside the scrolling area. Verify geometry in Chromium with a constrained menu and a no-match query.

## Task 1 — Searchable menu screen

**Files**

- Modify `src/demos/drilldown-menu/drilldown-menu.demo.{ts,html,scss}` for incident data, controls and styling.
- Modify `src/demos/drilldown-menu/menu/drilldown-menu-screen.ts` and `drilldown-menu.{ts,html,scss}` for optional fixed content.
- Test `src/demos/drilldown-menu/drilldown-menu.demo.spec.ts`.

**Interfaces** — `beforeContent` and `footer` are optional `TemplateRef<unknown>` inputs with the menu exposed as `$implicit`. `DrilldownMenu.revealTarget(target: HTMLElement): void` reveals only content in the active viewport. The input owns focus and refers to the results by ID. Options report their selection state and do not enter the tab order.

- [x] Add a demo test that opens «Мультивыбор с поиском», expects the combobox to be focused, enters «дАтА» and checks marked text. Navigate to two results and toggle them, verify the input remains focused and Tab goes to «Сбросить по умолчанию». Enter `[` and verify the empty state and cleared active-descendant reference.
- [x] Add a demo test that searches for «закрытия», clicks the matching option, returns by Esc and verifies root focus. Check query reset after closing and opening the menu, then restore defaults and verify the option is unmarked.
- [x] Run `npm test -- --watch=false --include=src/demos/drilldown-menu/drilldown-menu.demo.spec.ts`. Expect both new tests to fail because the test section is missing.
- [x] Render the fixed slots and include their heights in shell layout. Resolve `initialFocus` across the screen. Only reveal targets inside the scrolling viewport.
- [x] Add the screen in the demo. Bind case-insensitive filtering and Koobiq match highlighting to the query, use `aria-controls` and `aria-activedescendant` for the editable input, and keep selection in the demo outside the lifetime of the screen. The query «дата» matches «Дата обнаружения», «Дата регистрации» and «Дата закрытия».
- [x] Run `npm test -- --watch=false --include=src/demos/drilldown-menu/**/*.spec.ts` and `npm run build`. Verify the focus sequence, filtering, empty state and fixed controls in Chromium. Expect the drilldown tests and build to pass.
- [x] Commit the tested changes in the worktree.
