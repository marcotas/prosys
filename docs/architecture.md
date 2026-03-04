# ProSys Domain Architecture

## Overview

ProSys uses a domain-driven architecture with a framework-agnostic core layer written in plain TypeScript. The domain layer is fully testable without any UI framework, browser APIs, or database dependencies.

## Architecture Layers

```
Svelte Component (.svelte)             UI rendering only
  └─ uses adapter (useNotifier)
─────────────────────────────────────
Controller (extends ChangeNotifier)    State + behavior + network
  ├─ owns Collection                   Calls notifyChanges()
  ├─ handles fetch/WS/offline queue
  └─ orchestrates domain entities
─────────────────────────────────────
Collection (TaskCollection, etc.)      Manages entity groups
  └─ cache, queries, mutations         Stateful, no notifications
─────────────────────────────────────
Domain Entity (Task, Habit, Member)    Business rules, validation
  └─ mutable, private constructor      Framework-agnostic
─────────────────────────────────────
Domain Service (future)                Cross-entity coordination
  └─ stateless operations
```

### Layer 1: Domain Entities

Located in `src/lib/domain/`. Each entity is a TypeScript class with:

- **Private constructor** -- cannot be instantiated with `new` from outside
- **`static create(input)`** -- validates input, throws on invalid, returns instance
- **`static fromData(data)`** -- trusted hydration from DB/WS/API (no validation)
- **Mutable** -- methods modify internal state in place
- **`toJSON()`** -- returns a shallow copy of the plain data for serialization (API responses, WebSocket messages)
- **`clone()`** -- deep copy for undo/snapshot support (delegates to `fromData(toJSON())`)

**Entities:** `Task`, `Habit`, `Member`

#### Task

- **Getters:** `id`, `title`, `memberId`, `weekStart`, `dayIndex`, `emoji`, `isCompleted`, `sortOrder`
- **Mutations:** `complete()`, `uncomplete()`, `toggleCompletion()`, `updateTitle(title)`, `updateEmoji(emoji)`, `setSortOrder(order)`, `setDay(dayIndex, weekStart, sortOrder)`, `assignTo(memberId)`
- **Query:** `isMove(updates)` -- checks if the given updates would move the task to a different day/week
- **Validation on create:** title required, dayIndex 0-6, weekStart required in YYYY-MM-DD format and must be a Sunday

#### Habit

- **Getters:** `id`, `memberId`, `name`, `emoji`, `sortOrder`
- **Mutations:** `updateName(name)`, `updateEmoji(emoji)`, `setSortOrder(order)`
- **Validation on create:** name required, memberId required

#### Member

- **Getters:** `id`, `name`, `theme`, `quote`, `createdAt`, `updatedAt`
- **Mutations:** `updateName(name)`, `updateTheme(theme)`, `updateQuote(quote)`
- **Note:** all mutations automatically update `updatedAt` timestamp
- **Note:** `fromData()` and `toJSON()` both perform shallow copies of nested `theme` and `quote` objects to prevent accidental reference sharing
- **Validation on create:** name required

#### Example usage

```ts
import { Task } from '$lib/domain/task';

// Creating a new task (validates input, generates ID via crypto.randomUUID())
const task = Task.create({
  title: 'Buy groceries',
  weekStart: '2026-03-01',
  dayIndex: 1,
  memberId: 'abc-123'
});

// Hydrating from database (trusts data, no validation)
const task = Task.fromData(dbRow);

// Mutations
task.complete();
task.updateTitle('Buy organic groceries');
task.setDay(3, '2026-03-08', 0);

// Serialization for API/WS
const json = task.toJSON(); // plain object matching TaskData interface
```

### Layer 2: Collections

Located in `src/lib/domain/`. Each collection manages a typed cache:

| Collection | Cache type | Key strategy |
|---|---|---|
| `TaskCollection` | `Map<string, Task[]>` | `${memberId}:${weekStart}` composite |
| `HabitCollection` | `Map<string, Habit[]>` | `memberId` |
| `MemberCollection` | `Map<string, Member>` | `memberId` (flat, not grouped) |

Collections are **stateful** but do **not** notify. The controller layer (future) handles change notifications.

#### Shared features across all collections

- `hydrate(...)` -- bulk load from server
- `findById(id)` / `getById(id)` -- lookup by entity ID (cross-key for Task/Habit collections)
- `insert(...)` -- add an entity
- `remove(id)` -- remove by ID, returns `boolean` indicating success
- `snapshot()` -- create an independent deep copy of the cache for rollback
- `restore(snapshot)` -- replace cache with a previously-captured snapshot
- `clear()` -- remove all data

#### TaskCollection-specific

- `has(key)` -- check if a key has been hydrated
- `getForDay(key, dayIndex)` -- return tasks for a specific day, sorted by `sortOrder`
- `getAll(key)` -- return all tasks for a key (unfiltered, insertion order)
- `reorder(key, dayIndex, taskIds)` -- set `sortOrder` on tasks matching the day by position in `taskIds` array
- `nextSortOrder(key, dayIndex)` -- compute the next available sortOrder (max + 1, or 0)

#### HabitCollection-specific

- `has(memberId)` -- check if a member has been hydrated
- `getAll(memberId)` -- return habits sorted by `sortOrder`
- `reorder(memberId, habitIds)` -- set `sortOrder` by position
- `nextSortOrder(memberId)` -- compute the next available sortOrder

#### MemberCollection-specific

- `hydrate(members)` -- takes an array (not keyed), merges into cache additively
- `getById(id)` -- returns `Member | undefined`
- `getAll()` -- returns all members
- `update(id, updater)` -- apply an updater function to an existing member
- `size` -- getter returning the number of members

### Layer 3: ChangeNotifier

Located in `src/lib/domain/change-notifier.ts`. A vanilla TypeScript observable base class:

```ts
const notifier = new MyController(); // extends ChangeNotifier
const unsubscribe = notifier.onChange(() => {
  console.log('State changed');
});
// later...
unsubscribe(); // prevents memory leaks
```

**API:**

| Method | Visibility | Description |
|---|---|---|
| `onChange(listener)` | public | Register a listener, returns unsubscribe function |
| `notifyChanges()` | protected | Trigger all registered listeners |
| `dispose()` | public | Clear all listeners |

**Implementation detail:** Listeners are stored in a `Set<() => void>`, so the same function reference is deduplicated if registered twice.

### Svelte Adapter

Located in `src/lib/adapters/svelte.ts`. Bridges `ChangeNotifier` to Svelte's reactivity system via the Svelte store contract:

```ts
import { useNotifier } from '$lib/adapters/svelte';

const controller = new TaskController(); // extends ChangeNotifier
const store = useNotifier(controller);

// In .svelte files:
// $store.someMethod()
// {$store.someProperty}
```

**How it works:** `useNotifier` creates a Svelte `writable` store initialized with the notifier instance. It subscribes to `onChange()` so that whenever the notifier calls `notifyChanges()`, the writable re-sets the same reference, triggering Svelte's reactivity. The `onChange` listener is cleaned up when the last Svelte subscriber unsubscribes.

### Layer 4: Controllers (Future)

Will extend `ChangeNotifier`, own a Collection, and handle:
- API calls (fetch with optimistic updates)
- WebSocket message handling
- Offline queue integration
- Error rollback via `snapshot()`/`restore()`

Naming: `TaskController`, `HabitController`, `MemberController`

### Layer 5: Domain Services (Future)

Stateless classes for cross-entity coordination. Only added when needed (e.g., cascading member deletion across tasks and habits).

## Design Decisions

### Why classes instead of pure functions?

- **Consistency** -- same pattern for all entities, current and future (recurring tasks, subtasks, etc.)
- **Encapsulation** -- private constructor prevents invalid state; validation is enforced at creation
- **Discoverability** -- look at a class and see its state + behavior immediately
- **Framework-agnostic** -- domain logic survives UI framework changes
- **Testability** -- no framework dependencies, no mocking needed

### Why mutable entities?

The ChangeNotifier pattern already requires manually triggering reactivity (`notifyChanges()`). Since we are not relying on framework auto-detection of changes, immutability adds overhead (creating new instances on every mutation) without benefit. Domain design decisions should not be shaped by UI framework behaviors.

### Why hybrid constructor pattern (create/fromData)?

- `create()` validates -- used at system boundaries (user input, API handlers)
- `fromData()` trusts -- used for hydration from database/WS (data already validated on write)
- Private constructor prevents accidental creation of invalid entities

### Why ChangeNotifier instead of Svelte runes?

- **Framework-agnostic** -- works with any UI framework or none
- **Explicit control** -- developer decides when to trigger re-renders
- **Testable** -- test state management without Svelte infrastructure
- **Future-proof** -- if UI framework changes, only the adapter layer changes
- **Pattern familiarity** -- common in Flutter, Android, and other frameworks

### Why collections are separate from controllers?

- **Single responsibility** -- collections manage data structure, controllers manage behavior
- **Testability** -- test data operations without network/WS concerns
- **Reusability** -- same collection can be used in different contexts

### Why MemberCollection uses flat Map instead of grouped?

Members are a global resource, not grouped by any parent. `Map<string, Member>` (id to member) is simpler and more natural than `Map<string, Member[]>`. TaskCollection and HabitCollection use arrays because tasks/habits are grouped by composite keys.

## Data Types

All data interfaces live in `src/lib/domain/types.ts`:

| Type | Purpose |
|---|---|
| `TaskData` | Plain data shape for Task entity |
| `HabitData` | Plain data shape for Habit entity |
| `MemberData` | Plain data shape for Member entity |
| `Task` | Backward-compat alias for `TaskData` |
| `Habit` | Backward-compat alias for `HabitData` |
| `Member` | Backward-compat alias for `MemberData` |
| `CreateTaskInput` | Input for `Task.create()` |
| `UpdateTaskInput` | Input for updating task fields |
| `CreateHabitInput` | Input for `Habit.create()` |
| `CreateMemberInput` | Input for `Member.create()` |
| `UpdateMemberInput` | Input for updating member fields |
| `ThemeConfig` | Member theme configuration (accent colors, emoji, variant) |
| `ThemeVariant` | `'default' \| 'playful'` |
| `DayIndex` | `0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6` |
| `ValidationResult` | `{ valid: true } \| { valid: false; errors: string[] }` |

The `Task`, `Habit`, `Member` type aliases exist for backward compatibility during migration. Existing code that imports these types continues to work. New code should use entity classes directly.

## File Structure

```
src/lib/
  domain/
    types.ts                 # Data types, input types, value types
    change-notifier.ts       # ChangeNotifier base class
    change-notifier.test.ts  # 8 tests
    task.ts                  # Task entity class
    task.test.ts             # 40 tests
    task-collection.ts       # TaskCollection class
    task-collection.test.ts  # 23 tests
    habit.ts                 # Habit entity class
    habit.test.ts            # 21 tests
    habit-collection.ts      # HabitCollection class
    habit-collection.test.ts # 19 tests
    member.ts                # Member entity class
    member.test.ts           # 22 tests
    member-collection.ts     # MemberCollection class
    member-collection.test.ts # 16 tests
  adapters/
    svelte.ts                # useNotifier adapter
    svelte.test.ts           # 4 tests
```

**Total: 153 tests across 8 test files.**

## Testing

All domain and adapter code is tested with Vitest:

```bash
pnpm test              # run all tests once
pnpm test:watch        # watch mode
pnpm test <file>       # run specific test file
pnpm test:coverage     # run with coverage report
```

Tests are in `src/lib/domain/**/*.test.ts` and `src/lib/adapters/**/*.test.ts`.

### Testing patterns used

- **TDD** -- tests written before implementation
- **No mocks for domain code** -- entities and collections are pure TypeScript, no framework dependencies
- **`vi.useFakeTimers()`** -- used for deterministic `updatedAt` testing in Member
- **Test subclass for protected methods** -- `TestNotifier extends ChangeNotifier` exposes `notifyChanges()` for testing
- **`fromData()` for test setup** -- tests use `Entity.fromData(makeData())` to create test instances without validation overhead
- **Snapshot/restore testing** -- collections tested for independent deep copies to verify rollback works correctly
