# Domain-Driven Architecture Design

**Date**: 2026-03-03
**Status**: Approved

## Goal

Extract business logic from Svelte stores and API routes into a framework-agnostic domain layer using TypeScript classes. Establish consistent patterns for all current entities (Task, Habit, Member) and future ones (recurring tasks, subtasks).

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

## Layer 1: Domain Entity Classes

### Pattern

Each entity uses the **hybrid constructor pattern**:

- **Private constructor** — cannot `new Task(...)` from outside
- **`static create(input)`** — validates input, throws on invalid, returns instance
- **`static fromData(data)`** — trusted hydration from DB/WS/API (no validation)
- **Mutable** — methods modify internal state in place
- **`toJSON()`** — returns plain data for serialization boundaries
- **`clone()`** — deep copy for undo/snapshot support

### Task Entity

```ts
class Task {
  private constructor(private data: TaskData) {}

  static create(input: CreateTaskInput): Task   // validates, throws
  static fromData(data: TaskData): Task         // trusted

  // Getters
  get id(): string
  get title(): string
  get memberId(): string | null
  get weekStart(): string
  get dayIndex(): number
  get emoji(): string | undefined
  get isCompleted(): boolean
  get sortOrder(): number

  // Mutations (modify in place)
  complete(): void
  uncomplete(): void
  toggleCompletion(): void
  updateTitle(title: string): void
  updateEmoji(emoji: string | undefined): void
  setSortOrder(sortOrder: number): void
  setDay(dayIndex: number, weekStart: string, sortOrder: number): void
  assignTo(memberId: string | null): void

  // Query
  isMove(updates: { dayIndex?: number; weekStart?: string }): boolean

  // Serialization
  toJSON(): TaskData
  clone(): Task
}
```

### Habit Entity

```ts
class Habit {
  private constructor(private data: HabitData) {}

  static create(input: CreateHabitInput): Habit
  static fromData(data: HabitData): Habit

  get id(): string
  get memberId(): string
  get name(): string
  get emoji(): string | undefined
  get sortOrder(): number

  updateName(name: string): void
  updateEmoji(emoji: string | undefined): void
  setSortOrder(sortOrder: number): void

  toJSON(): HabitData
  clone(): Habit
}
```

### Member Entity

```ts
class Member {
  private constructor(private data: MemberData) {}

  static create(input: CreateMemberInput): Member
  static fromData(data: MemberData): Member

  get id(): string
  get name(): string
  get theme(): ThemeConfig
  get quote(): { text: string; author: string }
  get createdAt(): string
  get updatedAt(): string

  updateName(name: string): void
  updateTheme(theme: ThemeConfig): void
  updateQuote(quote: { text: string; author: string }): void

  toJSON(): MemberData
  clone(): Member
}
```

### Validation

- `create()` validates and throws with descriptive error messages
- Validation rules:
  - **Task**: title non-empty, dayIndex 0-6, weekStart is valid Sunday
  - **Habit**: name non-empty, memberId non-empty
  - **Member**: name non-empty, theme has all required fields

## Layer 2: Collection Classes

Each collection manages a `Map<string, Entity[]>` cache. Stateful, but does NOT notify — the controller handles notifications.

### TaskCollection

```ts
class TaskCollection {
  private cache = new Map<string, Task[]>();

  // Hydration
  hydrate(key: string, tasks: Task[]): void
  has(key: string): boolean

  // Queries
  getForDay(key: string, dayIndex: number): Task[]
  getAll(key: string): Task[]
  findById(taskId: string): Task | undefined

  // Mutations
  insert(key: string, task: Task): void
  remove(taskId: string): void
  update(taskId: string, updater: (task: Task) => void): void
  replaceById(taskId: string, task: Task): void
  reorder(key: string, dayIndex: number, taskIds: string[]): void

  // Undo support
  snapshot(): Map<string, Task[]>
  restore(snapshot: Map<string, Task[]>): void

  clear(): void
}
```

### HabitCollection and MemberCollection

Same pattern adapted to their entity types.

## Layer 3: ChangeNotifier Base Class

```ts
class ChangeNotifier {
  private listeners = new Set<() => void>();

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected notifyChanges(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}
```

**Key design decisions:**
- `onChange` returns an unsubscribe function (prevents memory leaks)
- `notifyChanges` is `protected` (only subclasses trigger it)
- Listener type is `() => void` (no arbitrary args)
- `dispose()` for explicit cleanup

### Svelte Adapter

```ts
import { writable } from 'svelte/store';

function useNotifier<T extends ChangeNotifier>(notifier: T): Writable<T> {
  const store = writable(notifier);
  const unsubscribe = notifier.onChange(() => store.set(notifier));

  return {
    subscribe(run, invalidate) {
      const unsub = store.subscribe(run, invalidate);
      return () => { unsub(); unsubscribe(); };
    },
    set: store.set,
    update: store.update
  };
}
```

## Layer 4: Controllers (Deferred)

Controllers extend ChangeNotifier, own a Collection, and handle:
- Network calls (fetch + optimistic updates + rollback)
- WebSocket message handling
- Offline queue integration

Naming: `TaskController`, `HabitController`, `MemberController`.

**Not in scope for the initial implementation.** Will be designed and implemented after the domain layer is solid.

## Layer 5: Domain Services (Future)

Stateless classes for cross-entity operations. Only added when needed (e.g., cascading member deletion across tasks and habits).

## What Changes from the Current Pure Functions Approach

The batch 1 work (Vitest setup, domain types, `task.ts` pure functions) will be **replaced** by:
- `types.ts` — kept, input/output types stay as interfaces
- `task.ts` pure functions — replaced by `Task` class + `TaskCollection` class
- `task.test.ts` — rewritten to test `Task` class and `TaskCollection`

## File Structure

```
src/lib/domain/
  types.ts              # Data types, input types, validation result
  change-notifier.ts    # ChangeNotifier base class
  task.ts               # Task entity class
  task.test.ts          # Task entity tests
  task-collection.ts    # TaskCollection class
  task-collection.test.ts
  habit.ts              # Habit entity class
  habit.test.ts
  habit-collection.ts   # HabitCollection class
  habit-collection.test.ts
  member.ts             # Member entity class
  member.test.ts
  member-collection.ts  # MemberCollection class
  member-collection.test.ts
src/lib/adapters/
  svelte.ts             # useNotifier adapter
```

## Testing Strategy

- 100% coverage on all domain entity classes
- 100% coverage on all collection classes
- ChangeNotifier base class tested
- Svelte adapter tested if possible (may need Svelte test infrastructure)
- All tests run with `pnpm test` (Vitest)
