# Habit Tracking

- **Type**: feature
- **Depends on**: 00-setup
- **Files owned**: `src/lib/stores/habits.svelte.ts`, `src/lib/components/HabitTracker.svelte`, `src/routes/api/habits/+server.ts`, `src/routes/api/habits/[id]/+server.ts`, `src/routes/api/habits/[id]/toggle/+server.ts`, `src/routes/api/members/[id]/habits/+server.ts`
- **Interfaces exposed**: `habitStore` — reactive store with `habits` (Habit[]) and `weekCompletions` (map), and methods (`load`, `loadWeek`, `create`, `update`, `delete`, `toggle`)
- **Interfaces consumed**: `Habit`, `HabitWithDays` types from setup; DB connection + schema; date utils

## Description

Build the habit tracking feature end-to-end:

1. **API routes** — `GET /api/members/[id]/habits?week=YYYY-MM-DD` returns habits with their completion states for the given week. `POST /api/habits` creates a habit. `PATCH /api/habits/[id]` updates name/emoji. `DELETE /api/habits/[id]` cascades completions. `PUT /api/habits/[id]/toggle` toggles a completion for a specific `(weekStart, dayIndex)` — inserts or deletes the `habit_completions` row.

2. **Store** — `habits.svelte.ts` holds habit definitions (shared across weeks) and per-week completion maps. `loadWeek(memberId, weekStart)` fetches completions for that week. Exposes a derived `habitsWithDays` that merges definitions with the current week's completions.

3. **Component** — Port `HabitTracker` from prototype. Replace fake data with store reads. Collapsible header, 7-column checkbox grid, progress bars, swipe-to-delete, inline editing, and add-habit input all wire to store methods.

4. **Per-week scoping** — Habit definitions are global to a member. Completion states are per-week. Navigating weeks triggers `loadWeek` for the new completions.

## Acceptance Criteria

- Can add a new habit
- Can inline-edit a habit name
- Can swipe-to-delete a habit (removes all its completions too)
- Can toggle a habit checkbox for any day
- Habit completion states are per-week (different weeks show different checks)
- Habit definitions (name, emoji) are shared across all weeks
- Progress bars show correct weekly percentage per habit
- Habit count in collapsible header updates correctly
