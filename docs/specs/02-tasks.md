# Weekly Tasks

- **Type**: feature
- **Depends on**: 00-setup
- **Files owned**: `src/lib/stores/tasks.svelte.ts`, `src/lib/components/DayCard.svelte`, `src/lib/components/ProgressRing.svelte`, `src/routes/api/tasks/+server.ts`, `src/routes/api/tasks/[id]/+server.ts`, `src/routes/api/members/[id]/tasks/+server.ts`
- **Interfaces exposed**: `taskStore` — reactive store with `weekTasks` (map of dayIndex → Task[]), and methods (`loadWeek`, `create`, `update`, `delete`, `toggle`, `moveToDay`)
- **Interfaces consumed**: `Task`, `DayData` types from setup; DB connection + schema; date utils

## Description

Build the weekly task management feature end-to-end:

1. **API routes** — `GET /api/members/[id]/tasks?week=YYYY-MM-DD` returns tasks for a week grouped by day. `POST /api/tasks` creates a task with `memberId`, `weekStart`, `dayIndex`, `title`, optional `emoji`. `PATCH /api/tasks/[id]` updates any field (title, emoji, completed, dayIndex for cross-day moves, sortOrder). `DELETE /api/tasks/[id]` removes a task.

2. **Store** — `tasks.svelte.ts` holds per-week task data. `loadWeek(memberId, weekStart)` fetches and caches. Mutations are optimistic (update local state, fire API, revert on error).

3. **Components** — Port `DayCard` and `ProgressRing` from prototype. Replace fake data with store reads. Swipe-to-delete, inline editing, add-task input all wire to store methods. Remove the prototype's plain-JS cache — the store handles per-week caching.

4. **Per-week scoping** — Tasks are keyed by `(memberId, weekStart)`. Navigating weeks triggers `loadWeek` for the new week. Already-loaded weeks are served from the store cache.

## Acceptance Criteria

- Can add a task to any day of any week
- Can toggle task completion (checkbox works)
- Can inline-edit a task title
- Can swipe-to-delete a task
- Tasks persist across page reloads
- Navigating to a different week loads that week's tasks (or shows empty)
- Progress ring shows correct completion percentage per day
- Task counter in day card header updates correctly (e.g. "3/5")
