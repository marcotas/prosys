---
"prosys": minor
---

Add task rescheduling with history tracking (F-165)

- Added `reschedule(today)` method to Task entity with `rescheduled` status, `rescheduleCount`, and `rescheduledFromId` fields
- Added `RescheduleTask` use case: marks original as rescheduled, creates new task with incremented reschedule count
- Added `POST /api/tasks/:id/reschedule` API endpoint with WebSocket broadcast (`task:rescheduled`)
- Updated `DeleteTask` to cancel (instead of delete) tasks that have been rescheduled before
- Added `TaskController.reschedule()` with optimistic UI and `moveToDate()` delegation for past tasks
- Added DB migration for `reschedule_count`, `rescheduled_from_id` columns
- Updated DayCard/PlannerDayCard: rescheduled tasks show clock icon, dimmed/line-through, excluded from progress
- Updated TaskContextMenu to hide actions for rescheduled tasks
- Added ReschedulePicker date constraint: past dates disabled when rescheduling past tasks
- Fixed week navigation bug: planner page no longer shows stale SSR tasks when navigating to empty weeks
- Added SSR loader support for new status/reschedule fields
