---
"prosys": minor
---

Add undo toast for task deletion and cancellation (F-167)

- Swipe-to-delete and context menu delete/cancel now show an undo toast for 5 seconds
- Clicking Undo restores the task; letting the toast expire commits the API call
- Offline queue support: if offline when timeout fires, the mutation is queued for replay
