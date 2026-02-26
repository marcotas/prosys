# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is ProSys

A family weekly task manager and habit tracker that runs entirely on the local network. The macOS desktop app (Tauri v2) spawns a Node.js server; mobile devices connect as PWA clients over LAN. Real-time sync via WebSocket, offline-first with IndexedDB mutation queue.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Dev server (Vite + WebSocket + mDNS) on :5173, already has `--host` |
| `pnpm build` | Build SvelteKit app (adapter-node) |
| `pnpm tauri:dev` | Run Tauri desktop app in dev mode |
| `pnpm tauri:build` | Production macOS app (runs build + server bundle + Rust compile) |
| `pnpm db:generate` | Generate Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |

No test runner is configured.

## Tech Stack

- **Svelte 5** with runes (`$state`, `$derived`, `$props`, `$effect`) — NOT Svelte 4 syntax
- **SvelteKit 2** with adapter-node
- **Tailwind CSS 4** (Vite plugin, no config file)
- **bits-ui** — headless accessible UI primitives (Popover, Dialog, etc.). Use for dropdowns/popovers inside scroll containers or overflow-hidden parents — they portal to `<body>` via Floating UI
- **SQLite** via better-sqlite3 + Drizzle ORM
- **WebSocket** (ws library) for real-time sync
- **Tauri v2** for macOS desktop app
- **pnpm** — always use pnpm, never npm or yarn

## Architecture

### Production Topology

```
Tauri (Rust) → spawns Node.js server (server.js)
  ├─ SvelteKit handler (build/)
  ├─ WebSocket server (/ws)
  ├─ mDNS broadcast (_prosys._tcp)
  └─ SQLite database
```

### Source Layout

- `src/lib/stores/*.svelte.ts` — Svelte 5 rune-based stores (tasks, habits, members, ws, offline-queue). Use `$state.raw<Map>()` for collection state.
- `src/lib/components/` — UI components (DayCard, HabitTracker, ProgressRing, etc.). Built with Tailwind + bits-ui headless primitives for complex interactions (popovers, dialogs).
- `src/lib/server/db/` — Drizzle schema (`schema.ts`), connection (`index.ts`), migrations (`migrate.ts`)
- `src/lib/server/ws.ts` — WebSocket setup, `broadcast()` via `globalThis.__wsClients`
- `src/lib/utils/` — Date math (`dates.ts`), nanoid wrapper (`ids.ts`)
- `src/lib/types.ts` — All shared TypeScript interfaces
- `src/routes/api/` — REST endpoints (members, tasks, habits) with WebSocket broadcast
- `src/routes/+page.svelte` — Main weekly dashboard
- `src/routes/connect/` — QR code connection page for mobile
- `server.js` — Production HTTP+WS+mDNS entry point
- `scripts/prepare-server-bundle.js` — esbuild bundling for Tauri

### Data Flow

1. SSR loads initial data in `+page.server.ts` → hydrates stores via `$effect`
2. Client mutations → optimistic store update → `fetch()` with `X-WS-Client-Id` header
3. API route saves to DB → `broadcast()` to all other WebSocket clients
4. Offline: failed fetches queued in IndexedDB, replayed on reconnect

### Database Schema

Four tables: `family_members`, `tasks` (scoped to member + weekStart + dayIndex), `habits`, `habit_completions`. Week starts on Sunday (dayIndex 0–6).

### Tauri Integration

- `src-tauri/src/lib.rs` — Finds Node.js, sets `PROSYS_DATA_DIR`, spawns server
- Data stored at `~/Library/Application Support/com.prosys.app/` (survives rebuilds)
- `prepare-server-bundle.js` bundles server.js via esbuild with CJS require() polyfill

## Critical Gotchas

1. **Use `$state.raw<Map>()`** not `$state<Map>()` for store collections — deep proxy breaks `$derived` reactivity across components
2. **Vite SSR externals differ dev vs prod** — CJS packages (ws, qrcode) must be external in dev only; native addons (better-sqlite3) always external. See `vite.config.ts`
3. **`crypto.randomUUID()` fails on LAN HTTP** — not a secure context. Use try/catch with fallback (see `ws.svelte.ts`)
4. **App bundle is ephemeral** — never write persistent data inside the Tauri bundle. Use `PROSYS_DATA_DIR`
5. **API routes skip layout loaders** — migrations run in `+layout.server.ts`, so direct curl to API before page load hits uninitialized DB
6. **Native addon bundling** — when adding native deps, update the copy chain in `prepare-server-bundle.js` using chained `createRequire()`
7. **`touch-pan-y` scope** — never apply to container zones (DnD zones, tbody). Apply narrowly to swipeable elements only, or it blocks ancestor horizontal scroll (carousel, table)
8. **Lazy touch listeners** — register `touchmove`/`touchend` on `window` only during active swipe (`touchstart`), remove on end. Permanent listeners cause scroll jank on mobile
9. **`scrollIntoView` block default** — always pass `block: "nearest"` when you only want horizontal scroll; default `"start"` jumps the page vertically
10. **mDNS probe in dev** — use `probe: false` in `bonjour.publish()` to avoid "name already in use" errors after unclean shutdown (`vite.config.ts`)
11. **Tauri `window.eval()` is fire-and-forget** — always add fallback `window.navigate()` in the `Err` branch; don't discard result with `let _ =`
12. **Drizzle `.set()` uses JS names** — `updates.memberId` not `updates.member_id`; the SQL column name is silently ignored
13. **`window.location.href` kills store state** — use SvelteKit `goto()` for cross-route navigation; full reload loses all in-memory stores
14. **`overflow-hidden` clips dropdowns** — use bits-ui `Popover.Portal` to portal content to `<body>`, bypassing all overflow/scroll clipping. Don't manually toggle `overflow-visible` on parents — it breaks when nested inside `overflow-x-auto` scroll containers (CSS spec forces `overflow-y` to also be non-visible)
15. **Nested buttons in bits-ui triggers** — `Popover.Trigger`/`Dialog.Trigger` renders a `<button>`. Child components inside must render as `<span>`, not `<button>`. Check MemberBadge, which has separate button/span branches based on whether `onclick` is provided
16. **`relaunch()` orphans child processes** — `relaunch()` calls `process::exit()`, which does NOT trigger `WindowEvent::Destroyed`. Always kill child processes explicitly (via Tauri command) before calling `relaunch()`. See `kill_server` command in `lib.rs`

## Learnings

**Always consult `.learnings/` before modifying related code.** These contain detailed root-cause analysis, code examples, and affected file paths for each gotcha above.

- `.learnings/architecture.md` — production topology, server bundle pipeline, offline sync, data persistence
- `.learnings/gotchas.md` — 23 documented pitfalls with symptoms, causes, and fixes
