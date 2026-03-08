---
"prosys": minor
---

Add task cancellation for past tasks with status tracking

- Added `cancel()` method to Task entity with `status` ('active' | 'cancelled') and `cancelledAt` fields
- Added `CancelTask` use case with validation (must be past, not already cancelled)
- Added `isTaskPast()` utility to check if a task's date is before today
- Updated `DeleteTask` to prevent deletion of past tasks (directs to cancel instead)
- Added `POST /api/tasks/:id/cancel` API endpoint with WebSocket broadcast
- Updated `TaskController.deleteOrCancel()` to route to correct action based on task date
- Updated `TaskRepository` with `updatePartial()` and status/cancelledAt field mapping
- Added DB migration for `status` and `cancelled_at` columns
- Updated DayCard and PlannerDayCard to filter cancelled tasks from progress and disable interactions
- Updated TaskContextMenu to hide actions for cancelled tasks
- Added vitest include pattern for `src/lib/utils/**/*.test.ts`
