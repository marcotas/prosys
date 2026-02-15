# Offline PWA Support

- **Type**: feature
- **Depends on**: 06-realtime, 07-platform
- **Files owned**: `src/service-worker.ts`, `src/lib/stores/offline-queue.svelte.ts`
- **Files modified**: `src/lib/stores/tasks.svelte.ts`, `src/lib/stores/habits.svelte.ts`, `src/lib/stores/members.svelte.ts`, `src/lib/stores/ws.svelte.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`
- **Interfaces exposed**: Offline-capable PWA, mutation queue, sync-on-reconnect
- **Interfaces consumed**: All API routes (unchanged), WebSocket (unchanged)

## Description

Makes the PWA resilient when the Mac server is unreachable. The app shell loads from cache, user actions are queued locally in IndexedDB, and everything syncs automatically when the server comes back online.

The Mac remains the source of truth (SQLite database). Mobile devices gain the ability to work independently during network interruptions and automatically reconcile when connectivity is restored.

## Architecture

### Service Worker (`src/service-worker.ts`)

Uses SvelteKit's built-in service worker support with the `$service-worker` module.

| Request type | Strategy | Rationale |
|---|---|---|
| Build assets (JS, CSS) | Cache-first | Immutable, content-hashed filenames |
| Static files (icons, manifest) | Cache-first (precached) | Rarely change |
| Navigation (HTML pages) | Network-first, cache fallback | Serve fresh when possible, cached shell when offline |
| API requests (`/api/*`) | Network-only (no caching) | Stale data is worse than no data; offline queue handles mutations |
| Non-GET requests | Pass through | Mutations handled by offline queue at the application layer |

Cache is versioned using SvelteKit's `version` from `$service-worker`. Old caches are cleaned up on activation.

### Offline Mutation Queue (`src/lib/stores/offline-queue.svelte.ts`)

IndexedDB-backed FIFO queue that stores failed mutations when the server is unreachable.

**Schema (IndexedDB `prosys-offline` database, `mutations` object store):**

| Field | Type | Description |
|---|---|---|
| `id` | string (PK) | Unique queue entry ID |
| `timestamp` | number | Epoch ms when the mutation was queued |
| `method` | string | HTTP method (POST, PATCH, PUT, DELETE) |
| `url` | string | API endpoint path |
| `body` | object? | Request body (omitted for DELETE) |
| `headers` | object | Headers including `X-WS-Client-Id` |

**Exposed API:**
- `enqueue(mutation)` — add a failed mutation
- `getAll()` — retrieve all queued mutations in FIFO order
- `remove(id)` — remove a single entry after successful replay
- `clear()` — remove all entries
- `replay(mutation)` — execute a queued mutation against the server
- `pendingCount` — reactive count of queued items (Svelte 5 `$state`)

### Store Changes (tasks, habits, members)

All mutation `catch` blocks now check `isNetworkError(err)` before rolling back:

1. **Network error** (server unreachable) → keep optimistic state, enqueue mutation
2. **Server error** (4xx/5xx) → rollback as before

The `isNetworkError()` helper detects `TypeError` with "fetch" or "network" in the message, which is the standard `fetch()` failure on network errors.

### Sync on Reconnect (`ws.svelte.ts`)

The WebSocket store tracks `wasDisconnected`. On reconnection:

1. Drain the offline queue sequentially (preserve mutation order)
2. Drop mutations that fail with 404 (resource deleted elsewhere) or other server errors (avoid infinite retry)
3. Trigger a full data refresh via registered sync callback
4. Expose `syncing` reactive state for UI feedback

The sync callback is registered by `+page.svelte` with the current member+week context, ensuring the right data is reloaded.

### Connection Indicator (`+layout.svelte`)

| State | Dot color | Label | Condition |
|---|---|---|---|
| Online (synced) | Green | (none) | WS connected, queue empty |
| Online (pending) | Amber | "N pending" | WS connected, queue non-empty |
| Syncing | Amber (pulsing) | "Syncing..." | Draining offline queue |
| Offline | Red (pulsing) | "Offline" | WS disconnected |

## Conflict Resolution

**Last-write-wins** — the server always applies the most recent mutation it receives. Specific scenarios:

- **Same field edited on two devices**: whichever mutation reaches the server last wins
- **Deleted on one device, edited on another**: server returns 404 for the edit; it's dropped silently during queue drain
- **Created on two devices**: no conflict — different IDs, both persist

## What Does NOT Change

- All server-side API routes
- Database schema
- WebSocket broadcast protocol
- Tauri desktop shell
- `server.js`
- Existing online behavior

## Acceptance Criteria

- [ ] PWA loads offline (app shell renders from Service Worker cache)
- [ ] Mutations made while offline are queued in IndexedDB
- [ ] Optimistic state is preserved (no rollback) for offline mutations
- [ ] Queued mutations are replayed automatically on WebSocket reconnect
- [ ] Full data refresh occurs after queue drain
- [ ] Connection indicator shows correct state (online/offline/syncing/pending)
- [ ] Temp IDs for offline-created items are reconciled on sync
- [ ] Server errors during queue drain are handled gracefully (dropped, not retried)
- [ ] Service Worker cache is versioned and old caches are cleaned up
