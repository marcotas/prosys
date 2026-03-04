# Step 4: TaskCollection Class

> Manages a `Map<string, Task[]>` cache. Stateful queries and mutations. Does NOT notify — controllers handle that. Supports snapshot/restore for optimistic update rollback.

**Files:**
- Create: `src/lib/domain/task-collection.ts`
- Create: `src/lib/domain/task-collection.test.ts`

**Dependencies:** Step 3 (Task entity class)

---

## Step 1: Write the failing test

Create `src/lib/domain/task-collection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TaskCollection } from './task-collection';
import { Task } from './task';
import type { TaskData } from './types';

// ── Helpers ──────────────────────────────────────────────

function makeTaskData(overrides: Partial<TaskData> = {}): TaskData {
	return {
		id: 'task-1',
		memberId: 'member-1',
		weekStart: '2026-03-01',
		dayIndex: 0,
		title: 'Test task',
		completed: false,
		sortOrder: 0,
		...overrides
	};
}

function makeTask(overrides: Partial<TaskData> = {}): Task {
	return Task.fromData(makeTaskData(overrides));
}

const KEY = 'member-1:2026-03-01';

// ── hydrate / has ────────────────────────────────────────

describe('TaskCollection hydration', () => {
	it('has() returns false for unknown key', () => {
		const col = new TaskCollection();
		expect(col.has('unknown')).toBe(false);
	});

	it('hydrate() stores tasks and has() returns true', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask()]);
		expect(col.has(KEY)).toBe(true);
	});

	it('hydrate() replaces existing tasks for same key', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask({ id: 'a' }), makeTask({ id: 'b' })]);
		col.hydrate(KEY, [makeTask({ id: 'c' })]);
		expect(col.getAll(KEY)).toHaveLength(1);
		expect(col.getAll(KEY)[0].id).toBe('c');
	});
});

// ── getAll / getForDay ───────────────────────────────────

describe('TaskCollection queries', () => {
	it('getAll() returns empty array for unknown key', () => {
		const col = new TaskCollection();
		expect(col.getAll('unknown')).toEqual([]);
	});

	it('getAll() returns all tasks for key', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [
			makeTask({ id: 'a', dayIndex: 0 }),
			makeTask({ id: 'b', dayIndex: 3 })
		]);
		expect(col.getAll(KEY)).toHaveLength(2);
	});

	it('getForDay() filters by dayIndex and sorts by sortOrder', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [
			makeTask({ id: 'c', dayIndex: 0, sortOrder: 2 }),
			makeTask({ id: 'a', dayIndex: 0, sortOrder: 0 }),
			makeTask({ id: 'b', dayIndex: 0, sortOrder: 1 }),
			makeTask({ id: 'd', dayIndex: 1, sortOrder: 0 })
		]);
		const day0 = col.getForDay(KEY, 0);
		expect(day0.map(t => t.id)).toEqual(['a', 'b', 'c']);
	});

	it('getForDay() returns empty array for day with no tasks', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask({ dayIndex: 0 })]);
		expect(col.getForDay(KEY, 5)).toEqual([]);
	});
});

// ── findById ─────────────────────────────────────────────

describe('TaskCollection.findById', () => {
	it('finds a task across any key', () => {
		const col = new TaskCollection();
		col.hydrate('key1', [makeTask({ id: 'a' })]);
		col.hydrate('key2', [makeTask({ id: 'b' })]);

		expect(col.findById('b')?.id).toBe('b');
	});

	it('returns undefined for unknown id', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask({ id: 'a' })]);
		expect(col.findById('unknown')).toBeUndefined();
	});
});

// ── insert ───────────────────────────────────────────────

describe('TaskCollection.insert', () => {
	it('inserts into existing key', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask({ id: 'a' })]);
		col.insert(KEY, makeTask({ id: 'b' }));
		expect(col.getAll(KEY)).toHaveLength(2);
	});

	it('creates key if it does not exist', () => {
		const col = new TaskCollection();
		col.insert(KEY, makeTask({ id: 'a' }));
		expect(col.has(KEY)).toBe(true);
		expect(col.getAll(KEY)).toHaveLength(1);
	});
});

// ── remove ───────────────────────────────────────────────

describe('TaskCollection.remove', () => {
	it('removes a task by id', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask({ id: 'a' }), makeTask({ id: 'b' })]);
		const removed = col.remove('a');
		expect(removed).toBe(true);
		expect(col.getAll(KEY)).toHaveLength(1);
		expect(col.findById('a')).toBeUndefined();
	});

	it('returns false for unknown id', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask({ id: 'a' })]);
		expect(col.remove('unknown')).toBe(false);
	});
});

// ── reorder ──────────────────────────────────────────────

describe('TaskCollection.reorder', () => {
	it('sets sortOrder based on position in taskIds', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [
			makeTask({ id: 'a', dayIndex: 0, sortOrder: 0 }),
			makeTask({ id: 'b', dayIndex: 0, sortOrder: 1 }),
			makeTask({ id: 'c', dayIndex: 0, sortOrder: 2 })
		]);

		col.reorder(KEY, 0, ['c', 'a', 'b']);

		const tasks = col.getForDay(KEY, 0);
		expect(tasks.map(t => t.id)).toEqual(['c', 'a', 'b']);
	});

	it('only reorders tasks matching the dayIndex', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [
			makeTask({ id: 'a', dayIndex: 0, sortOrder: 0 }),
			makeTask({ id: 'b', dayIndex: 1, sortOrder: 0 })
		]);

		col.reorder(KEY, 0, ['a']);
		// dayIndex 1 task should be unaffected
		expect(col.findById('b')?.sortOrder).toBe(0);
	});

	it('does nothing for unknown key', () => {
		const col = new TaskCollection();
		// Should not throw
		col.reorder('unknown', 0, ['a', 'b']);
	});
});

// ── nextSortOrder ────────────────────────────────────────

describe('TaskCollection.nextSortOrder', () => {
	it('returns 0 for empty day', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, []);
		expect(col.nextSortOrder(KEY, 0)).toBe(0);
	});

	it('returns max + 1 for existing tasks', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [
			makeTask({ id: 'a', dayIndex: 0, sortOrder: 3 }),
			makeTask({ id: 'b', dayIndex: 0, sortOrder: 7 })
		]);
		expect(col.nextSortOrder(KEY, 0)).toBe(8);
	});

	it('returns 0 for unknown key', () => {
		const col = new TaskCollection();
		expect(col.nextSortOrder('unknown', 0)).toBe(0);
	});
});

// ── snapshot / restore ───────────────────────────────────

describe('TaskCollection snapshot/restore', () => {
	it('snapshot creates an independent deep copy', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask({ id: 'a', title: 'Original' })]);

		const snap = col.snapshot();

		// Mutate original
		col.findById('a')!.updateTitle('Changed');
		expect(col.findById('a')!.title).toBe('Changed');

		// Snapshot should be unaffected
		const snapTasks = snap.get(KEY)!;
		expect(snapTasks[0].title).toBe('Original');
	});

	it('restore replaces current state with snapshot', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask({ id: 'a', title: 'Original' })]);

		const snap = col.snapshot();
		col.findById('a')!.updateTitle('Changed');

		col.restore(snap);
		expect(col.findById('a')!.title).toBe('Original');
	});
});

// ── clear ────────────────────────────────────────────────

describe('TaskCollection.clear', () => {
	it('removes all data', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask()]);
		col.clear();
		expect(col.has(KEY)).toBe(false);
		expect(col.getAll(KEY)).toEqual([]);
	});
});
```

## Step 2: Run test to verify it fails

Run: `pnpm test src/lib/domain/task-collection.test.ts`

Expected: FAIL — `task-collection.ts` does not exist.

## Step 3: Write the implementation

Create `src/lib/domain/task-collection.ts`:

```ts
import { Task } from './task';

export class TaskCollection {
	private cache = new Map<string, Task[]>();

	hydrate(key: string, tasks: Task[]): void {
		this.cache.set(key, tasks);
	}

	has(key: string): boolean {
		return this.cache.has(key);
	}

	getForDay(key: string, dayIndex: number): Task[] {
		const tasks = this.cache.get(key) ?? [];
		return tasks
			.filter((t) => t.dayIndex === dayIndex)
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	getAll(key: string): Task[] {
		return this.cache.get(key) ?? [];
	}

	findById(taskId: string): Task | undefined {
		for (const tasks of this.cache.values()) {
			const found = tasks.find((t) => t.id === taskId);
			if (found) return found;
		}
		return undefined;
	}

	insert(key: string, task: Task): void {
		const tasks = this.cache.get(key) ?? [];
		tasks.push(task);
		this.cache.set(key, tasks);
	}

	remove(taskId: string): boolean {
		for (const [, tasks] of this.cache) {
			const idx = tasks.findIndex((t) => t.id === taskId);
			if (idx !== -1) {
				tasks.splice(idx, 1);
				return true;
			}
		}
		return false;
	}

	reorder(key: string, dayIndex: number, taskIds: string[]): void {
		const tasks = this.cache.get(key);
		if (!tasks) return;

		taskIds.forEach((id, index) => {
			const task = tasks.find((t) => t.id === id && t.dayIndex === dayIndex);
			if (task) task.setSortOrder(index);
		});
	}

	nextSortOrder(key: string, dayIndex: number): number {
		const dayTasks = this.getForDay(key, dayIndex);
		if (dayTasks.length === 0) return 0;
		return Math.max(...dayTasks.map((t) => t.sortOrder)) + 1;
	}

	snapshot(): Map<string, Task[]> {
		const snap = new Map<string, Task[]>();
		for (const [key, tasks] of this.cache) {
			snap.set(
				key,
				tasks.map((t) => t.clone())
			);
		}
		return snap;
	}

	restore(snapshot: Map<string, Task[]>): void {
		this.cache = snapshot;
	}

	clear(): void {
		this.cache.clear();
	}
}
```

## Step 4: Run test to verify it passes

Run: `pnpm test src/lib/domain/task-collection.test.ts`

Expected: All tests PASS.

## Step 5: Commit

```bash
git add src/lib/domain/task-collection.ts src/lib/domain/task-collection.test.ts
git commit -m "feat: add TaskCollection class with tests"
```
