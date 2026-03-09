---
"prosys": patch
---

Fix task deletion not syncing to other devices (F-170)

- Added `onNotFound` callback to `optimisticAction` — when server returns 404, gracefully removes stale tasks instead of rolling back (which left tasks stuck in UI)
- Added `visibilitychange` listener on both dashboard and planner pages — refreshes tasks, habits, and members when PWA returns to foreground (catches missed WebSocket broadcasts on mobile)
