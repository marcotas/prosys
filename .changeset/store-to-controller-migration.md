---
"prosys": minor
---

Migrate HabitStore and MemberStore to controller architecture (F-172)

- Added HabitController with HabitWeekCache domain class, replacing the Svelte 5 rune-based HabitStore
- Added MemberController with MemberCollection, replacing the Svelte 5 rune-based MemberStore
- Controllers self-register WebSocket handlers (no manual wiring in layout)
- All mutations use optimisticAction for offline-first support
- Deleted legacy stores (habits.svelte.ts, members.svelte.ts, profiles.svelte.ts) and stores/ directory
- 810 unit tests, 24 e2e tests all passing
