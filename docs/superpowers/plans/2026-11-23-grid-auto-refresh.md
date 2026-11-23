# Grid auto-refresh implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement the tasks in this session. Steps use checkbox syntax for tracking.

**Goal:** Build the approved incident-grid demo with a random server simulation and protected refresh behavior.

**Architecture:** A pure local server owns immutable incidents and elapsed-time generation. A signal-based controller owns applied snapshots, polling, filters, selection and panel state. A standalone Angular view composes real Koobiq components and a virtualized AG Grid that incrementally displays the applied snapshot in blocks of 50.

**Tech Stack:** Angular 21, Koobiq 21.1, AG Grid 34, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-grid-auto-refresh-design.md` (approved in chat).

## Global Constraints

- Reuse this isolated checkout and the existing demo shell; add route `/demo/grid-auto-refresh` through the registry.
- Use actual Topbar, Overflow Items, Filter Bar, ActionsPanel and Content Panel; preserve light/dark tokens.
- No product sidebar, duplicate reset, lower demo control panel, flow chart or diagnostic counters.
- Random arrivals run independently from polling; 300 initial records, 50-row loading blocks, 15-second initial poll interval.
- Keep a compact persistent new-record toast immediately below the grid header without shifting rows.
- Preserve protected context until a successful explicit refresh/query change; restore selection all-or-nothing within the first loaded block.
- No real server, incident editing/deletion or backend pagination guarantees.

## Review Focus

- A request resolving after a newer query or component destruction must not replace current data.
- Loading another block while protected must use the applied snapshot and never expose pending arrivals.
- A failed manual refresh/query change must preserve rows, pending count, selection, card and scroll.
- Hidden-tab elapsed time must generate arrivals while polling remains paused; auto-off must remain off after return.
- Responsive overflow must preserve every setting and action, including when the content panel changes the available width.

## Task 1: Incident model and simulated server

**Files:** Create `src/demos/grid-auto-refresh/incident-model.ts`, `incident-server.ts`, `incident-server.spec.ts`.

**Interfaces:** `Incident` has `id`, `createdAt`, `name`, `severity`, `status`, `source`, `assignee`, `tags`, `description`. `IncidentQuery` has search/status/severity/assignee/period and `sort: {field, direction}`. `queryIncidents(rows, query, now)` returns a sorted filtered copy. `IncidentServer` accepts `{now, random, latencyMs}`, exposes `initialRows`, `catchUp()`, `read(): Promise<readonly Incident[]>`, and `offline`.

- [ ] Write tests: initial length 300 and unique IDs; sort and compound filters; zero-arrival periods and bounded quiet periods; generated timestamps/IDs increase; elapsed hidden-time catch-up; failed read leaves server generation running.
- [ ] Run `npm test -- --watch=false --include='src/demos/grid-auto-refresh/incident-server.spec.ts'`; confirm failure before implementation.
- [ ] Implement deterministic-in-tests random generation with five-second logical ticks and a maximum quiet period of 25 seconds; favor small packets, allow rare larger bursts.
- [ ] Run the same tests and confirm they pass; commit model/server/tests.

## Task 2: Refresh controller and scheduler

**Files:** Create `src/demos/grid-auto-refresh/auto-refresh-controller.ts`, `auto-refresh-controller.spec.ts`.

**Interfaces:** `AutoRefreshController(server, {now})` exposes signals `snapshot`, `visibleRows`, `query`, `selectedIds`, `card`, `pendingCount`, `exactCount`, `intervalMs`, `busy`, `error`, `lastChecked`, `lastApplied`, `nextCheckAt`, `protectedMode`, `reasons`, `revision`. Methods: `start()`, `destroy()`, `poll()`, `refresh()`, `setQuery(query)`, `loadMore()`, `protect(reason)`, `setSelection(ids)`, `openCard(incident)`, `closeCard()`, `setInterval(ms)`, `setVisibility(hidden)`.

- [ ] Write tests for safe automatic insertion; sticky protection; pending-ID deduplication and filter matching; frozen next-block loading; all-or-nothing selection recovery; open-card retention; non-time sort protection; failed manual refresh and query rollback; interval off/on; hidden tabs; exponential retry and restoration; concurrent request ordering; destruction.
- [ ] Run `npm test -- --watch=false --include='src/demos/grid-auto-refresh/auto-refresh-controller.spec.ts'`; confirm failure before implementation.
- [ ] Implement immutable applied snapshots, monotonic request IDs and a single request queue. Query changes invalidate older results. Scheduler checks elapsed generation independently, pauses polling when hidden/off, backs off to at most 120 seconds after errors, and restores the chosen interval after success.
- [ ] Run controller/server tests and confirm they pass; commit controller/tests.

## Task 3: Koobiq view, integration and browser verification

**Files:** Create `grid-auto-refresh.demo.ts`, `.html`, `.scss`, `incident-grid-cells.ts`, `incident-filters.ts`, `grid-auto-refresh.demo.spec.ts` in the demo directory. Modify `src/demos/demos.registry.ts`, `package.json`, `package-lock.json`, and `src/styles.scss` only for the official AG Grid theme.

**Interfaces:** Uses Task 2 controller. Custom AG Grid title/severity/status renderers and sortable headers receive callbacks through `context`; sort applies only after a successful controller query. Grid incrementally receives `visibleRows` with stable `getRowId`, reports user scroll/selection, opens the card from the title, and adds blocks at the loaded bottom. Programmatic row updates restore selection without creating user interactions.

- [ ] Add a registry integration test requiring the new demo and a view composition test for Koobiq components, Topbar-only controls, and no duplicate reset/diagnostic block; run and observe failure.
- [ ] Resolve theme dependency against the installed public package. Keep existing design-tokens 4; if needed, use a narrowly scoped npm peer override for the theme's older tokens-3 peer declaration and verify a clean install/build rather than globally ignoring peer dependencies.
- [ ] Implement the view from the approved Figma structure: 56 px Topbar, 40 px rows, 24 px side gutters, 480 px resizable Content Panel. Real Overflow Items moves controls into a Dropdown containing only hidden actions. Status details live in a Popover. Real ActionsPanel is scoped to the grid and uses its own Overflow Items.
- [ ] Implement a local persistent toast surface with Koobiq button/icon, positioned over the rows below the sticky grid header. Keep pending updates off the grid data binding and preserve focus on refresh. Use polite announcements for meaningful changes, not countdown ticks.
- [ ] Add removable Filter Bar pipes for status, severity, assignee, required period, plus text search. Revert the rendered filter state on failed query changes. Demo scenarios prepare observation/selection/card states without injecting arrivals.
- [ ] Run `npm test -- --watch=false`, `npm run test:scripts`, `npm run build`; resolve in-scope errors and inspect the logs.
- [ ] Start the actual Angular dev server and verify automatic arrivals, protected scroll including return-to-top, Show/Refresh, filters/sorting, selection restoration and reset, card retention, unknown count, off/on, errors/retry, infinite loading, theme switching and keyboard access. Verify overflow at narrow width and with the card open; restore temporary viewport changes.
- [ ] Commit the verified implementation. Request one fresh-context review against the spec and Review Focus. Fix important findings, repeat the relevant checks, and return the live demo link with the actual verification results.
