# Directory Structure

```
prosys/
├── docs/
│   ├── brief.md
│   ├── plan/
│   │   ├── overview.md
│   │   ├── data-model.md
│   │   ├── directory-structure.md
│   │   └── task-graph.md
│   ├── specs/
│   │   ├── 00-setup.md
│   │   ├── 01-profiles.md
│   │   ├── 02-tasks.md
│   │   ├── 03-habits.md
│   │   ├── 04-dashboard.md
│   │   ├── 05-drag-drop.md
│   │   ├── 06-realtime.md
│   │   ├── 07-platform.md
│   │   └── integration.md
│   └── progress.md
│
├── src/
│   ├── app.css                          # Global styles, Tailwind config
│   ├── app.html                         # HTML shell
│   ├── app.d.ts                         # SvelteKit type augmentations
│   │
│   ├── lib/
│   │   ├── types.ts                     # [00-setup] Shared TS types (read-only for features)
│   │   │
│   │   ├── server/                      # Server-only code (never sent to client)
│   │   │   ├── db/
│   │   │   │   ├── index.ts             # [00-setup] DB connection (better-sqlite3)
│   │   │   │   ├── schema.ts            # [00-setup] Drizzle schema definitions
│   │   │   │   └── migrate.ts           # [00-setup] Migration runner
│   │   │   └── ws.ts                    # [06-realtime] WebSocket server + broadcast
│   │   │
│   │   ├── stores/                      # Client-side reactive stores
│   │   │   ├── members.svelte.ts        # [01-profiles] Member store + API calls
│   │   │   ├── tasks.svelte.ts          # [02-tasks] Task store + API calls
│   │   │   ├── habits.svelte.ts         # [03-habits] Habit store + API calls
│   │   │   └── ws.svelte.ts             # [06-realtime] WebSocket client + message dispatch
│   │   │
│   │   ├── utils/
│   │   │   ├── dates.ts                 # [00-setup] Week calculation utilities
│   │   │   └── ids.ts                   # [00-setup] nanoid wrapper
│   │   │
│   │   └── components/
│   │       ├── FamilySwitcher.svelte     # [01-profiles]
│   │       ├── ProfileDialog.svelte      # [01-profiles]
│   │       ├── ThemePicker.svelte        # [01-profiles]
│   │       ├── DayCard.svelte            # [02-tasks]
│   │       ├── ProgressRing.svelte       # [02-tasks]
│   │       ├── HabitTracker.svelte       # [03-habits]
│   │       ├── OverallProgress.svelte    # [04-dashboard]
│   │       ├── WeeklyBarChart.svelte     # [04-dashboard]
│   │       ├── WeekNavigator.svelte      # [04-dashboard]
│   │       └── DragHandle.svelte         # [05-drag-drop]
│   │
│   ├── routes/
│   │   ├── +layout.svelte               # [00-setup] Base layout (loads members, connects WS)
│   │   ├── +layout.server.ts            # [00-setup] Server layout load (DB init)
│   │   ├── +page.svelte                 # [04-dashboard] Main dashboard page
│   │   ├── +page.server.ts              # [04-dashboard] Load initial week data
│   │   │
│   │   └── api/
│   │       ├── members/
│   │       │   ├── +server.ts            # [01-profiles] GET (list), POST (create)
│   │       │   └── [id]/
│   │       │       ├── +server.ts        # [01-profiles] PATCH, DELETE
│   │       │       ├── tasks/
│   │       │       │   └── +server.ts    # [02-tasks] GET tasks for week
│   │       │       └── habits/
│   │       │           └── +server.ts    # [03-habits] GET habits + completions
│   │       ├── tasks/
│   │       │   ├── +server.ts            # [02-tasks] POST (create)
│   │       │   ├── [id]/
│   │       │   │   └── +server.ts        # [02-tasks] PATCH, DELETE
│   │       │   └── reorder/
│   │       │       └── +server.ts        # [05-drag-drop] PUT batch reorder
│   │       └── habits/
│   │           ├── +server.ts            # [03-habits] POST (create)
│   │           ├── [id]/
│   │           │   ├── +server.ts        # [03-habits] PATCH, DELETE
│   │           │   └── toggle/
│   │           │       └── +server.ts    # [03-habits] PUT toggle completion
│   │           └── reorder/
│   │               └── +server.ts        # [05-drag-drop] PUT batch reorder
│   │
│   └── hooks.server.ts                   # [06-realtime] WebSocket upgrade handler
│
├── src-tauri/                            # [07-platform] Tauri v2 app
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   └── main.rs                      # Tauri entry, sidecar management
│   └── icons/
│
├── static/
│   ├── favicon.png
│   └── manifest.json                    # [07-platform] PWA manifest
│
├── drizzle/                             # [00-setup] Generated migrations
│   └── 0000_initial.sql
│
├── drizzle.config.ts                    # [00-setup] Drizzle config
├── package.json
├── svelte.config.js
├── tsconfig.json
└── vite.config.ts
```

## File Ownership by Task

| Task | Files created/modified |
|------|----------------------|
| **00-setup** | `lib/types.ts`, `lib/server/db/*`, `lib/utils/*`, `routes/+layout.*`, `drizzle/*`, `app.css` |
| **01-profiles** | `stores/members.svelte.ts`, `components/{FamilySwitcher,ProfileDialog,ThemePicker}.svelte`, `routes/api/members/**` |
| **02-tasks** | `stores/tasks.svelte.ts`, `components/{DayCard,ProgressRing}.svelte`, `routes/api/tasks/**` (excl. reorder), `routes/api/members/[id]/tasks/**` |
| **03-habits** | `stores/habits.svelte.ts`, `components/HabitTracker.svelte`, `routes/api/habits/**` (excl. reorder), `routes/api/members/[id]/habits/**` |
| **04-dashboard** | `routes/+page.svelte`, `routes/+page.server.ts`, `components/{OverallProgress,WeeklyBarChart,WeekNavigator}.svelte` |
| **05-drag-drop** | `components/DragHandle.svelte`, `routes/api/tasks/reorder/**`, `routes/api/habits/reorder/**` |
| **06-realtime** | `lib/server/ws.ts`, `stores/ws.svelte.ts`, `hooks.server.ts` |
| **07-platform** | `src-tauri/**`, `static/manifest.json` |

No two parallel tasks own the same file.
