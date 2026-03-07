import { describe, it, expect } from 'vitest';
import { Task } from './task';
import { TaskCollection } from './task-collection';
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

// ── Hydration ────────────────────────────────────────────

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

// ── Queries ──────────────────────────────────────────────

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
		expect(day0.map((t) => t.id)).toEqual(['a', 'b', 'c']);
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

// ── findAllById ─────────────────────────────────────────

describe('TaskCollection.findAllById', () => {
	it('returns all instances across multiple keys', () => {
		const col = new TaskCollection();
		col.hydrate('key1', [makeTask({ id: 'a' })]);
		col.hydrate('key2', [makeTask({ id: 'a' }), makeTask({ id: 'b' })]);
		const results = col.findAllById('a');
		expect(results).toHaveLength(2);
	});

	it('returns empty array for unknown id', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask({ id: 'a' })]);
		expect(col.findAllById('unknown')).toHaveLength(0);
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
		expect(tasks.map((t) => t.id)).toEqual(['c', 'a', 'b']);
	});

	it('only reorders tasks matching the dayIndex', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [
			makeTask({ id: 'a', dayIndex: 0, sortOrder: 0 }),
			makeTask({ id: 'b', dayIndex: 1, sortOrder: 0 })
		]);
		col.reorder(KEY, 0, ['a']);
		expect(col.findById('b')?.sortOrder).toBe(0);
	});

	it('does nothing for unknown key', () => {
		const col = new TaskCollection();
		col.reorder('unknown', 0, ['a', 'b']);
		// No error thrown
	});

	it('skips unknown task IDs without error', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [
			makeTask({ id: 'a', dayIndex: 0, sortOrder: 0 }),
			makeTask({ id: 'b', dayIndex: 0, sortOrder: 1 })
		]);
		col.reorder(KEY, 0, ['b', 'nonexistent', 'a']);
		const tasks = col.getForDay(KEY, 0);
		expect(tasks.map((t) => t.id)).toEqual(['b', 'a']);
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

		col.findById('a')!.updateTitle('Changed');
		expect(col.findById('a')!.title).toBe('Changed');

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

	it('restore removes keys that were not in the snapshot', () => {
		const col = new TaskCollection();
		col.hydrate(KEY, [makeTask({ id: 'a' })]);
		const snap = col.snapshot();

		col.hydrate('extra-key', [makeTask({ id: 'b' })]);
		expect(col.has('extra-key')).toBe(true);

		col.restore(snap);
		expect(col.has('extra-key')).toBe(false);
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
