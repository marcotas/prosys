# Architecture

## Production Topology

Tauri desktop app (Rust) spawns an embedded Node.js server that serves the SvelteKit app via adapter-node. Mobile/LAN devices connect to this server over HTTP.

```
Tauri (Rust)
  └─ spawns Node.js server (server.js)
       ├─ SvelteKit adapter-node handler (build/)
       ├─ WebSocket server (/ws)
       ├─ mDNS broadcast (bonjour-service)
       └─ SQLite database (better-sqlite3 + Drizzle ORM)
```

## Key Files

| File | Role |
|------|------|
| `src-tauri/src/lib.rs` | Rust entry: finds Node.js, sets env vars, spawns server, navigates webview |
| `server.js` | Production entry: HTTP server, WebSocket, mDNS |
| `scripts/prepare-server-bundle.js` | Builds self-contained `src-tauri/server-bundle/` for Tauri resources |
| `vite.config.ts` | Vite plugin for dev WebSocket + mDNS; SSR external config |
| `src/lib/server/db/index.ts` | Database connection; uses `PROSYS_DATA_DIR` env var |
| `src/lib/server/ws.ts` | WebSocket setup + `broadcast()` via `globalThis.__wsClients` |

## Server Bundle Pipeline

`pnpm tauri:build` runs `pnpm build && node scripts/prepare-server-bundle.js` as `beforeBuildCommand`:

1. **SvelteKit build** (`vite build`) -- produces `build/` (adapter-node output)
2. **esbuild** -- bundles `server.js` with all pure-JS deps inlined; native addons (`better-sqlite3`) kept external; CJS `require()` polyfill banner injected
3. **Copy artifacts** -- `build/`, `drizzle/` migrations, native addon `node_modules/` (better-sqlite3 + transitive deps resolved via chained `createRequire()`)
4. **Tauri compile** -- Rust binary + `src-tauri/server-bundle/` into `ProSys.app/Contents/Resources/server/`

## Data Persistence

- Tauri passes `app.path().app_data_dir()` as `PROSYS_DATA_DIR` env var to Node
- Resolves to `~/Library/Application Support/com.prosys.app/` on macOS
- `db/index.ts` uses `PROSYS_DATA_DIR` if set, falls back to `./data/` for dev
- Database survives app rebuilds and updates

## WebSocket Communication

- Server: `globalThis.__wsClients` Map shared between `server.js` and SvelteKit route handlers
- Client sends `X-WS-Client-Id` header on mutation requests (set in `hooks.server.ts` -> `event.locals.wsClientId`)
- `broadcast()` sends to all clients except the originator (sender already applied optimistic update)

## macOS GUI App Constraints

- GUI apps launched from Finder/Launchpad do NOT inherit the user's shell `PATH`
- `find_node()` in `lib.rs` searches Homebrew, nvm, Volta, fnm paths, then falls back to login shell `which node`
- Server CWD is `Resources/server/` inside the app bundle; all relative paths (migrations, DB fallback) resolve there

## Offline Support (PWA)

The PWA works offline via two mechanisms: a Service Worker for app shell caching and an IndexedDB queue for offline mutations.

| File | Role |
|------|------|
| `src/service-worker.ts` | SvelteKit service worker: precaches build/static assets, network-first HTML, network-only API |
| `src/lib/stores/offline-queue.svelte.ts` | IndexedDB FIFO queue for failed mutations; reactive `pendingCount` |

### Offline Mutation Flow

1. User makes a change while offline → store applies optimistic update
2. `fetch()` throws `TypeError` (network error) → `isNetworkError()` detects it
3. Mutation is queued in IndexedDB instead of rolling back
4. Optimistic state is preserved in memory

### Sync-on-Reconnect Flow

1. WebSocket reconnects (`ws.onopen` with `wasDisconnected = true`)
2. Offline queue is drained sequentially (FIFO order preserved)
3. Failed replays (404, server errors) are dropped to avoid infinite retry
4. Registered sync callback triggers full data refresh (`memberStore.load()`, `taskStore.reloadWeek()`, `habitStore.reloadWeek()`)
5. Connection indicator transitions: Offline → Syncing → Online

### Key Constraints

- Only network errors (`TypeError: Failed to fetch`) are queued; server errors (4xx/5xx) still trigger rollback
- API requests are never cached by the Service Worker — stale data is worse than no data
- iOS Safari may evict Service Worker caches after ~7 days of inactivity (acceptable for daily-use family app)
- Queue stores only mutation metadata (tiny); IndexedDB quota is not a concern
