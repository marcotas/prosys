# Drag & Drop

- **Type**: feature
- **Depends on**: 00-setup
- **Files owned**: `src/lib/components/DragHandle.svelte`, `src/routes/api/tasks/reorder/+server.ts`, `src/routes/api/habits/reorder/+server.ts`
- **Interfaces exposed**: `DragHandle` component; reorder API endpoints; sortable action/utility
- **Interfaces consumed**: `Task`, `Habit` types from setup; DB connection + schema

## Description

Build the drag-and-drop reordering infrastructure:

1. **DragHandle component** — A small grip icon (`⠿` or 6-dot pattern) that acts as the drag initiator. Only touches starting on the handle trigger drag; all other touches keep existing behavior (swipe-to-delete, scroll, tap). Sized for touch targets (≥ 44px tap area).

2. **Reorder API** — `PUT /api/tasks/reorder` accepts `{ memberId, weekStart, dayIndex, taskIds[] }` and updates `sort_order` for all tasks in that day. `PUT /api/habits/reorder` accepts `{ memberId, habitIds[] }` and updates `sort_order` for all habits.

3. **Sortable utility** — A Svelte action or wrapper using `svelte-dnd-action` that:
   - Initiates drag only from the DragHandle
   - Supports vertical reordering within a list (tasks within a day, habits)
   - Supports cross-container drag for tasks (between day columns) on desktop
   - On mobile, cross-day moves use a "Move to..." option in the swipe-reveal menu instead of cross-container drag (avoids the horizontal gesture conflict with swipe-to-delete)

4. **Optimistic reorder** — On drop, immediately reorder the local array, fire the reorder API, revert on error.

## Acceptance Criteria

- Drag handle is visible on each task and each habit
- Dragging via the handle reorders tasks within a day (vertical)
- Dragging via the handle reorders habits in the habit list (vertical)
- Drag on desktop can move a task from one day column to another
- Mobile: swipe menu shows "Move to..." option for cross-day moves
- Reorder persists after page reload (sort_order saved to DB)
- Existing swipe-to-delete still works (no gesture conflict)
- Touch scrolling still works (no gesture conflict)
