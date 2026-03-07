# Controllers & Infrastructure Design

**Date**: 2026-03-05
**Status**: Approved
**Scope**: Phase 5 of DDD migration — replace Svelte rune-based stores with framework-agnostic controllers

## Goal

Extract state management, API orchestration, WebSocket sync, and offline queue logic from Svelte stores into framework-agnostic TypeScript classes. Start with TaskController as proof of concept, then migrate Habit and Member.

## Architecture

```
Svelte Components (.svelte)
  └─ useNotifier(controller)
────────────────────────────────────
Controllers (extends ChangeNotifier)
  ├─ TaskController (proof of concept)
  │   └─ owns TaskCollection
  │   └─ self-registers WS handlers
  │   └─ mutations via optimisticAction()
  ├─ HabitController (later)
  └─ MemberController (later)
────────────────────────────────────
Infrastructure (shared, framework-agnostic)
  ├─ ApiClient — HTTP wrapper + header injection
  ├─ OfflineQueue — IndexedDB mutation queue
  ├─ WebSocketClient — connect/dispatch/reconnect
  └─ optimisticAction() — shared mutation helper
────────────────────────────────────
Domain Layer (existing, unchanged)
  ├─ Task / Habit / Member entities
  ├─ TaskCollection / HabitCollection / etc.
  └─ ChangeNotifier base class
```

## File Layout

```
src/lib/
  infra/
    api-client.ts            # HTTP wrapper
    api-client.test.ts
    offline-queue.ts         # IndexedDB mutation queue
    offline-queue.test.ts
    ws-client.ts             # WebSocket connection + dispatch
    ws-client.test.ts
    optimistic-action.ts     # Shared mutation helper
    optimistic-action.test.ts
    index.ts                 # Singleton wiring
  controllers/
    task-controller.ts       # First controller (proof of concept)
    task-controller.test.ts
    index.ts                 # Controller singletons
```

## Infrastructure Classes

### ApiClient (`src/lib/infra/api-client.ts`)

Stateless HTTP wrapper that injects `X-WS-Client-Id` header on all requests.

```typescript
class ApiClient {
  private clientId = '';

  setClientId(id: string): void;

  get<T>(url: string): Promise<T>;
  post<T>(url: string, body?: unknown): Promise<T>;
  patch<T>(url: string, body?: unknown): Promise<T>;
  put<T>(url: string, body?: unknown): Promise<T>;
  delete<T>(url: string): Promise<T>;

  // Builds headers, calls fetch, throws ApiError on non-ok, returns parsed JSON
  private request<T>(method: string, url: string, body?: unknown): Promise<T>;
}
```

- Throws `ApiError` (from `src/lib/utils/api-error.ts`) on non-ok responses
- `clientId` set once during wiring (from `WebSocketClient.clientId`)
- No retry logic — callers handle errors

### OfflineQueue (`src/lib/infra/offline-queue.ts`)

IndexedDB-backed mutation queue. Extracted from `stores/offline-queue.svelte.ts`, replacing `$state` with `ChangeNotifier`.

```typescript
interface QueuedMutation {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class OfflineQueue extends ChangeNotifier {
  private db: IDBDatabase | null = null;
  private _pendingCount = 0;

  get pendingCount(): number;

  async init(): Promise<void>;
  async enqueue(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>): Promise<void>;
  async getAll(): Promise<QueuedMutation[]>;
  async remove(id: string): Promise<void>;
  async clear(): Promise<void>;
  async replay(mutation: QueuedMutation): Promise<Response | null>;
}
```

- Extends `ChangeNotifier` so UI can reactively show pending count badge via `useNotifier()`
- Calls `notifyChanges()` when `pendingCount` changes (enqueue, remove, clear)

### WebSocketClient (`src/lib/infra/ws-client.ts`)

WebSocket connection manager with message routing. Extracted from `stores/ws.svelte.ts`.

```typescript
class WebSocketClient extends ChangeNotifier {
  readonly clientId: string;  // Generated once in constructor (crypto.randomUUID with fallback)

  private _connected = false;
  private _syncing = false;
  private handlers: Map<string, Set<(payload: any) => void>>;
  private syncCallbacks: Set<() => Promise<void>>;

  constructor(private offlineQueue: OfflineQueue);

  get connected(): boolean;
  get syncing(): boolean;

  connect(): void;
  destroy(): void;
  onMessage(type: string, handler: (payload: any) => void): () => void;
  onSync(callback: () => Promise<void>): () => void;

  private handleOpen(): void;       // Reset backoff, drain if was disconnected
  private handleClose(): void;      // Schedule reconnect
  private scheduleReconnect(): void; // Exponential backoff up to 30s
  private drainQueueAndRefresh(): Promise<void>;
}
```

- Extends `ChangeNotifier` so UI can reactively read `connected`/`syncing`
- On reconnect: drains offline queue in FIFO order, then calls sync callbacks for full data refresh
- Shares `clientId` with ApiClient during wiring

### optimisticAction (`src/lib/infra/optimistic-action.ts`)

Reusable helper for the optimistic mutation pattern every controller method follows.

```typescript
type OfflinePayload = {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
};

interface MutationPlan<T> {
  apply(): void;
  request(): Promise<T>;
  onSuccess(result: T): void;
  offlinePayload: OfflinePayload;
}

async function optimisticAction<T>(
  collection: { snapshot(): unknown; restore(snap: unknown): void },
  offlineQueue: OfflineQueue,
  notify: () => void,
  plan: MutationPlan<T>
): Promise<T | null>;

function isNetworkError(err: unknown): boolean;
```

**Flow:**
1. `snapshot()` — capture current state for rollback
2. `apply()` — optimistic local update
3. `notify()` — trigger UI re-render
4. `request()` — send API call
5. **Success path:** `onSuccess(result)` → `notify()`
6. **Network error:** `offlineQueue.enqueue(offlinePayload)` → return null (keep optimistic)
7. **Server error:** `restore(snapshot)` → `notify()` → rethrow

### Singleton Wiring (`src/lib/infra/index.ts`)

```typescript
export const apiClient = new ApiClient();
export const offlineQueue = new OfflineQueue();
export const wsClient = new WebSocketClient(offlineQueue);
apiClient.setClientId(wsClient.clientId);
```

## TaskController

### Class Design (`src/lib/controllers/task-controller.ts`)

```typescript
class TaskController extends ChangeNotifier {
  private tasks = new TaskCollection();
  private _loading = false;

  constructor(
    private api: ApiClient,
    private offlineQueue: OfflineQueue,
    ws: WebSocketClient
  ) {
    super();
    ws.onMessage('task:created', (p) => this.applyRemoteCreate(p));
    ws.onMessage('task:updated', (p) => this.applyRemoteUpdate(p));
    ws.onMessage('task:deleted', (p) => this.applyRemoteDelete(p));
    ws.onMessage('task:reordered', (p) => this.applyRemoteReorder(p));
    ws.onMessage('task:moved', (p) => this.applyRemoteMove(p));
  }

  get loading(): boolean;

  // --- Hydration (from SSR) ---
  hydrateWeek(memberId: string, weekStart: string, tasks: TaskData[]): void;
  hydrateFamilyWeek(weekStart: string, tasks: TaskData[]): void;

  // --- Queries ---
  getTasksForDay(memberId: string, weekStart: string, dayIndex: number): Task[];
  getFamilyTasksForDay(weekStart: string, dayIndex: number): Task[];
  getAllFamilyTasks(weekStart: string): Task[];

  // --- Loaders ---
  async loadWeek(memberId: string, weekStart: string): Promise<void>;
  async reloadWeek(memberId: string, weekStart: string): Promise<void>;
  async loadFamilyWeek(weekStart: string): Promise<void>;
  async reloadFamilyWeek(weekStart: string): Promise<void>;

  // --- Mutations (each uses optimisticAction) ---
  async create(input: CreateTaskInput): Promise<TaskData | null>;
  async update(id: string, data: UpdateTaskInput): Promise<void>;
  async delete(id: string): Promise<void>;
  async toggle(id: string): Promise<void>;
  async reorder(memberId: string, weekStart: string, dayIndex: number, taskIds: string[]): Promise<void>;
  async moveToDate(taskId: string, toWeekStart: string, toDayIndex: number): Promise<void>;
  async moveToDay(taskId: string, toDayIndex: number): Promise<void>;
  async assignTask(taskId: string, memberId: string): Promise<void>;

  // --- Remote sync ---
  applyRemoteCreate(task: TaskData): void;
  applyRemoteUpdate(task: TaskData): void;
  applyRemoteDelete(payload: { id: string; memberId: string; weekStart: string }): void;
  applyRemoteReorder(payload: { memberId: string; weekStart: string; dayIndex: number; tasks: TaskData[] }): void;
  applyRemoteMove(payload: { task: TaskData; fromDay: number; fromWeek: string }): void;

  clearCache(): void;
}
```

### Mutation Example (create)

```typescript
async create(input: CreateTaskInput): Promise<TaskData | null> {
  const task = Task.create(input);
  const key = `${input.memberId}:${input.weekStart}`;

  return optimisticAction(this.tasks, this.offlineQueue, () => this.notifyChanges(), {
    apply: () => this.tasks.insert(key, task),
    request: () => this.api.post<TaskData>('/api/tasks', input),
    onSuccess: (data) => {
      this.tasks.remove(task.id);
      this.tasks.insert(key, Task.fromData(data));
    },
    offlinePayload: { method: 'POST', url: '/api/tasks', body: input },
  });
}
```

### Family View

Family tasks use the same TaskCollection with key convention `__family__:${weekStart}`. Remote updates apply to both member and family caches when loaded.

### Controller Singleton (`src/lib/controllers/index.ts`)

```typescript
import { apiClient, offlineQueue, wsClient } from '$lib/infra';
export const taskController = new TaskController(apiClient, offlineQueue, wsClient);
```

## Svelte Integration

### Minimal changes for proof of concept:

1. **`+layout.svelte`** — Replace `wsStore.init()`/`destroy()` with `wsClient.connect()`/`destroy()`. WS handler registration happens automatically (controller self-registers in constructor).

2. **`+page.svelte`** — Replace `taskStore.*` calls with `taskController.*` (same public API shape). Use `useNotifier(taskController)` for reactivity.

3. **Components** — Swap `taskStore` import to `taskController`.

### Coexistence during migration

Old `habits.svelte.ts` and `members.svelte.ts` stores continue working alongside TaskController. The new `WebSocketClient` replaces `ws.svelte.ts` and the new `OfflineQueue` replaces `offline-queue.svelte.ts` — both shared by old stores and new controllers.

WS message handlers: old stores re-register their handlers on the new `WebSocketClient` via `onMessage()`. The stores' `applyRemote*` methods stay unchanged.

## Testing Strategy

| Layer | Approach | Coverage |
|-------|----------|----------|
| ApiClient | Mock global `fetch`, verify headers/errors/parsing | 100% |
| OfflineQueue | `fake-indexeddb` package, test CRUD + replay + pendingCount notifications | 100% |
| WebSocketClient | Mock `WebSocket` constructor, test connect/dispatch/reconnect/drain | 100% |
| optimisticAction | Mock functions, test 3 paths (success / network error / server error) | 100% |
| TaskController | Inject mock ApiClient + OfflineQueue + WsClient, test all methods | 100% |

All tests in Vitest. Coverage thresholds enforced in CI for `src/lib/infra/**/*.ts` and `src/lib/controllers/**/*.ts`.

## Design Decisions

### Why OfflineQueue and WebSocketClient extend ChangeNotifier?

The UI needs to reactively display pending count (offline badge) and connection status. Extending ChangeNotifier + `useNotifier()` adapter gives reactivity without Svelte dependency in the infrastructure layer.

### Why optimisticAction is a function, not a base class?

A base controller class would require generics for different collection types and add inheritance complexity. A standalone function is simpler, testable independently, and avoids the fragile base class problem.

### Why controllers self-register WS handlers?

Eliminates manual wiring in Svelte layout (13 registrations). Controllers are self-contained — adding a new message type only requires a change in the controller. The coupling to WebSocketClient is minimal (subscribing to message events via DI).

### Why start with TaskController?

It's the largest and most complex store (~23K lines), handling the most mutation types, family view, cross-week moves, and member reassignment. If the pattern works here, HabitController and MemberController will be straightforward.
