# prosys

## 0.8.1

### Patch Changes

- 62bb632: Fix drag and drop not working in the Tauri desktop app

## 0.8.0

### Minor Changes

- d309f20: Centralized API error handling with domain-driven error types and client-side toast notifications

  - Added `apiHandler` wrapper to eliminate repetitive try-catch boilerplate across all 13 API route handlers
  - Added `ConflictError` domain error type (409) and `SyntaxError` handling for malformed JSON (400)
  - Expanded `handleDomainError` to map all domain errors to proper HTTP status codes including a catch-all for the base `DomainError` class
  - Added svelte-sonner toast notifications so API errors are surfaced to users instead of being silently swallowed
  - Stores now parse server error responses via `ApiError`/`throwApiError` and show toasts after optimistic rollback

- 77af6a4: Migrate HabitStore and MemberStore to controller architecture (F-172)

  - Added HabitController with HabitWeekCache domain class, replacing the Svelte 5 rune-based HabitStore
  - Added MemberController with MemberCollection, replacing the Svelte 5 rune-based MemberStore
  - Controllers self-register WebSocket handlers (no manual wiring in layout)
  - All mutations use optimisticAction for offline-first support
  - Deleted legacy stores (habits.svelte.ts, members.svelte.ts, profiles.svelte.ts) and stores/ directory
  - 810 unit tests, 24 e2e tests all passing

- b72a132: Add task cancellation for past tasks with status tracking

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

- 0fcdbc7: Add task rescheduling with history tracking (F-165)

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

- 39401b7: Add undo toast for task deletion and cancellation (F-167)

  - Swipe-to-delete and context menu delete/cancel now show an undo toast for 5 seconds
  - Clicking Undo restores the task; letting the toast expire commits the API call
  - Offline queue support: if offline when timeout fires, the mutation is queued for replay

### Patch Changes

- 57def5f: Fix task deletion not syncing to other devices (F-170)

  - Added `onNotFound` callback to `optimisticAction` — when server returns 404, gracefully removes stale tasks instead of rolling back (which left tasks stuck in UI)
  - Added `visibilitychange` listener on both dashboard and planner pages — refreshes tasks, habits, and members when PWA returns to foreground (catches missed WebSocket broadcasts on mobile)

## 0.7.0

### Minor Changes

- 87bf5dd: Add task reschedule modal with month calendar for cross-week task moves. Replace inline 7-day picker with a full calendar view, add desktop right-click context menu for reschedule/delete, and fix week highlight to use today's date.

## 0.6.1

### Patch Changes

- ab7e020: Fix task reassignment not reflecting in real-time across member views. When reassigning a task on the family planner, it now correctly disappears from the old member's board and appears on the new member's board without requiring a page refresh.

## 0.6.0

### Minor Changes

- 91a75f3: Add mobile member dropdown for better profile identification. On screens below 768px, the horizontal badge row is replaced with a Popover dropdown showing each member's badge and full name, solving the issue where members sharing the same initials were indistinguishable.

## 0.5.0

### Minor Changes

- 69041f0: fix: resolve stale UI after app update and eliminate port conflicts

  - Fix WKWebView cache directory path (was targeting `com.prosys.app` instead of `prosys`)
  - Add `Cache-Control: no-store` on HTML responses as defense-in-depth
  - Hide window during startup to prevent "file not found" flash (Tauri splashscreen pattern)
  - Replace hardcoded port 3000 with dynamic OS-assigned port, persisted across restarts

## 0.4.0

### Minor Changes

- b7a38f3: Persist window size and position across app launches using tauri-plugin-window-state

## 0.3.3

### Patch Changes

- 33cfb99: fix: kill Node.js server before relaunch to prevent stale assets after update

## 0.3.2

### Patch Changes

- 76e7cb6: Clear WKWebView HTTP disk cache on version upgrade via filesystem deletion in Rust, fixing stale assets persisting after app updates.

## 0.3.1

### Patch Changes

- d761f76: Fix Tauri updater not showing update banner: use correct Tauri v2 IPC detection (`__TAURI_INTERNALS__` instead of `__TAURI__`) and add remote capability for localhost to allow updater/process plugin IPC from the production Node.js server URL.

## 0.3.0

### Minor Changes

- 404013f: Add Family Planner page with holistic family overview, unassigned tasks, and task assignment

### Patch Changes

- 42d216d: Responsive task assignment: popover on desktop, bottom sheet on mobile. Fix stale family habit cache after member mutations.

## 0.2.5

### Patch Changes

- b7dd4c4: Codesign native .node binaries in server bundle for Apple notarization

## 0.2.4

### Patch Changes

- 11a10f5: Add macOS code signing and notarization to release workflow

## 0.2.3

### Patch Changes

- 5c69469: Add esbuild as explicit devDependency for CI builds

## 0.2.2

### Patch Changes

- be94110: Add copyright notice to app footer

## 0.2.1

### Patch Changes

- 9919bd6: Fix release pipeline: use PAT for tag push and include changelog in draft release

  - Tags pushed by GITHUB_TOKEN don't trigger other workflows — switched to RELEASE_TOKEN (PAT)
  - Draft releases now include the CHANGELOG.md content for the version

- 4fc041e: Add app name to version footer

## 0.2.0

### Minor Changes

- f2879d2: Add update notifications and version display

  - Tauri updater: checks GitHub Releases on launch, shows banner to download and restart
  - PWA update detection: listens for service worker changes, shows refresh banner for mobile clients
  - CI release pipeline: GitHub Actions workflows for automated versioning and Tauri builds
  - App version displayed in footer, injected at build time from package.json
