# Task Dependency Graph

## Execution Order

```
Phase 1: Setup (sequential — blocks everything)
  00-setup

Phase 2: Features (parallel — all depend only on 00-setup)
  ┌── 01-profiles
  ├── 02-tasks
  ├── 03-habits
  ├── 04-dashboard
  ├── 05-drag-drop
  ├── 06-realtime
  └── 07-platform

Phase 3: Integration (sequential — after all features)
  integration
```

## Dependency Matrix

| Task | Depends on | Interfaces consumed from setup |
|------|-----------|-------------------------------|
| 00-setup | — | — |
| 01-profiles | 00-setup | `Member`, `ThemeConfig` types; DB schema; layout shell |
| 02-tasks | 00-setup | `Task`, `DayData` types; DB schema; date utils |
| 03-habits | 00-setup | `Habit`, `HabitWithDays` types; DB schema; date utils |
| 04-dashboard | 00-setup | All types; date utils; layout shell |
| 05-drag-drop | 00-setup | `Task`, `Habit` types; reorder API contracts |
| 06-realtime | 00-setup | `WSMessage` type; DB connection |
| 07-platform | 00-setup | SvelteKit build output; server entry point |
| integration | all above | Everything |

## Notes on Parallelism

- **01-04** are the core features. They share no files but all render on the same page. Each feature builds its own components and API routes. The **dashboard (04)** composes them by importing from the stores created by 01-03.

- **05-drag-drop** creates the `DragHandle` component and reorder API endpoints. Feature tasks (02, 03) don't include drag handles — the **integration pass** adds drag handles into DayCard and HabitTracker, since those files are owned by 02 and 03 respectively and drag-drop can't modify them during parallel execution.

- **06-realtime** is fully independent: it creates the WebSocket server and client store. The integration pass wires each feature store to listen for WS messages.

- **07-platform** is independent: Tauri shell and PWA manifest. Integration verifies the Tauri build works end-to-end.

## Integration Pass Responsibilities

1. Wire drag handles into DayCard (from 05) and HabitTracker (from 05)
2. Wire WebSocket message dispatch into member/task/habit stores (from 06)
3. Wire all stores into the dashboard page (from 04)
4. Cross-day task drag (page-level, needs DayCard + task store + drag-drop)
5. Verify Tauri sidecar launches SvelteKit server correctly
6. End-to-end smoke test: create member, add tasks, toggle habits, navigate weeks, drag reorder, verify sync across two browser tabs
