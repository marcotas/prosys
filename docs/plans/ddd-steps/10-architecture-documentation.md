# Step 10: Architecture Documentation

> Write comprehensive documentation covering the domain-driven architecture, design decisions, and usage patterns. This serves as the reference guide for anyone working on this codebase in the future.

**Files:**
- Create: `docs/architecture.md`

**Dependencies:** Steps 1-9 (all domain layer code must be complete)

---

## Step 1: Write the architecture documentation

Create `docs/architecture.md`:

```markdown
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

- **Private constructor** — cannot be instantiated with `new` from outside
- **`static create(input)`** — validates input, throws on invalid, returns instance
- **`static fromData(data)`** — trusted hydration from DB/WS/API (no validation)
- **Mutable** — methods modify internal state in place
- **`toJSON()`** — returns plain data for serialization (API responses, WebSocket messages)
- **`clone()`** — deep copy for undo/snapshot support

**Entities:** `Task`, `Habit`, `Member`

**Example usage:**

```ts
import { Task } from '$lib/domain/task';

// Creating a new task (validates input, generates ID)
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

| Collection | Cache type | Key |
|---|---|---|
| `TaskCollection` | `Map<string, Task[]>` | `${memberId}:${weekStart}` composite |
| `HabitCollection` | `Map<string, Habit[]>` | `memberId` |
| `MemberCollection` | `Map<string, Member>` | `memberId` (flat, not grouped) |

Collections are **stateful** but do **not** notify. The controller layer (future) handles change notifications.

Key features:
- `hydrate(key, entities)` — bulk load from server
- `findById(id)` — cross-key lookup
- `snapshot()` / `restore()` — for optimistic update rollback
- `nextSortOrder()` — compute next sort position

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

- `onChange()` returns an unsubscribe function
- `notifyChanges()` is `protected` — only subclasses call it
- `dispose()` clears all listeners

### Svelte Adapter

Located in `src/lib/adapters/svelte.ts`. Bridges ChangeNotifier to Svelte's reactivity:

```ts
import { useNotifier } from '$lib/adapters/svelte';

const controller = new TaskController();
const store = useNotifier(controller);

// In .svelte files:
// $store.someMethod()
// {$store.someProperty}
```

When the controller calls `notifyChanges()`, the Svelte writable re-triggers rendering.

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

- **Consistency** — same pattern for all entities, current and future (recurring tasks, subtasks, etc.)
- **Encapsulation** — private constructor prevents invalid state; validation is enforced at creation
- **Discoverability** — look at a class and see its state + behavior immediately
- **Framework-agnostic** — domain logic survives UI framework changes
- **Testability** — no framework dependencies, no mocking needed

### Why mutable entities?

The ChangeNotifier pattern already requires manually triggering reactivity (`notifyChanges()`). Since we're not relying on framework auto-detection of changes, immutability adds overhead (creating new instances on every mutation) without benefit. Domain design decisions should not be shaped by UI framework behaviors.

### Why hybrid constructor pattern (create/fromData)?

- `create()` validates — used at system boundaries (user input, API handlers)
- `fromData()` trusts — used for hydration from database/WS (data already validated on write)
- Private constructor prevents accidental creation of invalid entities

### Why ChangeNotifier instead of Svelte runes?

- **Framework-agnostic** — works with any UI framework or none
- **Explicit control** — developer decides when to trigger re-renders
- **Testable** — test state management without Svelte infrastructure
- **Future-proof** — if UI framework changes, only the adapter layer changes
- **Pattern familiarity** — common in Flutter, Android, and other frameworks

### Why collections are separate from controllers?

- **Single responsibility** — collections manage data structure, controllers manage behavior
- **Testability** — test data operations without network/WS concerns
- **Reusability** — same collection can be used in different contexts

### Why MemberCollection uses flat Map instead of grouped?

Members are a global resource, not grouped by any parent. `Map<string, Member>` (id → member) is simpler and more natural than `Map<string, Member[]>`. TaskCollection and HabitCollection use arrays because tasks/habits are grouped by composite keys.

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
| `CreateHabitInput` | Input for `Habit.create()` |
| `CreateMemberInput` | Input for `Member.create()` |
| `ThemeConfig` | Member theme configuration |

The `Task`, `Habit`, `Member` type aliases exist for backward compatibility during migration. Existing code that imports these types continues to work. New code should use entity classes directly.

## File Structure

```
src/lib/
  domain/
    types.ts                 # Data types, input types, value types
    change-notifier.ts       # ChangeNotifier base class
    change-notifier.test.ts
    task.ts                  # Task entity class
    task.test.ts
    task-collection.ts       # TaskCollection class
    task-collection.test.ts
    habit.ts                 # Habit entity class
    habit.test.ts
    habit-collection.ts      # HabitCollection class
    habit-collection.test.ts
    member.ts                # Member entity class
    member.test.ts
    member-collection.ts     # MemberCollection class
    member-collection.test.ts
  adapters/
    svelte.ts                # useNotifier adapter
    svelte.test.ts
```

## Testing

All domain and adapter code is tested with Vitest:

```bash
pnpm test              # run all tests once
pnpm test:watch        # watch mode
pnpm test <file>       # run specific test file
```

Tests are in `src/lib/domain/**/*.test.ts` and `src/lib/adapters/**/*.test.ts`.

### Testing patterns used

- **TDD** — tests written before implementation
- **No mocks for domain code** — entities and collections are pure TypeScript, no framework dependencies
- **`vi.useFakeTimers()`** — used for deterministic `updatedAt` testing in Member
- **Test subclass for protected methods** — `TestNotifier extends ChangeNotifier` exposes `notifyChanges()` for testing
- **`fromData()` for test setup** — tests use `Entity.fromData(makeData())` to create test instances without validation overhead
```

## Step 2: Review the documentation

Read through the generated doc and verify:
- All entities, collections, and patterns are covered
- Code examples are accurate and match the actual API
- Design decisions explain the "why" not just the "what"
- File structure matches reality

## Step 3: Commit

```bash
git add docs/architecture.md
git commit -m "docs: add domain architecture documentation and design decisions"
```
