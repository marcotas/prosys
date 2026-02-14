# Setup

- **Type**: setup
- **Depends on**: none
- **Files owned**: `src/lib/types.ts`, `src/lib/server/db/index.ts`, `src/lib/server/db/schema.ts`, `src/lib/server/db/migrate.ts`, `src/lib/utils/dates.ts`, `src/lib/utils/ids.ts`, `src/routes/+layout.svelte`, `src/routes/+layout.server.ts`, `src/app.css`, `drizzle.config.ts`, `drizzle/0000_initial.sql`
- **Interfaces exposed**: All shared types (`src/lib/types.ts`), DB connection + schema, date utilities, ID generation, base layout shell with slot, server layout that runs migrations on boot
- **Interfaces consumed**: none

## Description

Bootstrap the project from the existing prototype into a production-ready scaffold:

1. **Shared types** — Create `src/lib/types.ts` with all interfaces from the data model doc (`Member`, `Task`, `DayData`, `Habit`, `HabitWithDays`, `ThemeConfig`, `WSMessage`). Feature tasks import these read-only.

2. **Database** — Set up better-sqlite3 + Drizzle ORM. Define the schema (4 tables: `family_members`, `tasks`, `habits`, `habit_completions`). Create the initial migration. The DB file lives at `data/prosys.db` (gitignored).

3. **Utilities** — Extract date helpers from prototype (`computeWeekDays`, `getWeekStart`, `getTodayWeekOffset`, `formatWeekRange`) into `src/lib/utils/dates.ts`. Create `src/lib/utils/ids.ts` wrapping nanoid.

4. **Layout** — `+layout.server.ts` runs migrations on first request. `+layout.svelte` provides the base HTML shell (font loading, global styles, slot for pages).

5. **Tailwind** — Keep `app.css` from prototype, clean up any prototype-specific hacks.

## Acceptance Criteria

- `pnpm dev` starts without errors
- SQLite database is created automatically on first run
- `src/lib/types.ts` exports all types from the data model doc
- Drizzle schema matches the 4 tables defined in `data-model.md`
- `computeWeekDays(0)` returns 7 day objects for the current week
- Layout renders with a centered max-width container and slot
- No runtime errors in the browser console
