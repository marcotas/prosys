import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskRepository } from './task-repository';
import type { TaskData } from '$lib/domain/types';
import * as schema from '$lib/server/db/schema';

// ── Test Helpers ────────────────────────────────────────

function createTestDb() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');

	// Create tables matching the schema
	sqlite.exec(`
		CREATE TABLE family_members (
			id TEXT PRIMARY KEY NOT NULL,
			name TEXT NOT NULL,
			theme_variant TEXT NOT NULL DEFAULT 'default',
			theme_accent TEXT NOT NULL,
			theme_accent_light TEXT NOT NULL,
			theme_accent_dark TEXT NOT NULL,
			theme_header_bg TEXT NOT NULL,
			theme_ring_color TEXT NOT NULL,
			theme_check_color TEXT NOT NULL,
			theme_emoji TEXT NOT NULL DEFAULT '',
			quote_text TEXT NOT NULL DEFAULT '',
			quote_author TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);

		CREATE TABLE tasks (
			id TEXT PRIMARY KEY NOT NULL,
			member_id TEXT,
			week_start TEXT NOT NULL,
			day_index INTEGER NOT NULL,
			title TEXT NOT NULL,
			emoji TEXT,
			completed INTEGER NOT NULL DEFAULT 0,
			sort_order INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'active',
			cancelled_at TEXT,
			reschedule_count INTEGER NOT NULL DEFAULT 0,
			reschedule_history TEXT,
			rescheduled_from_id TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_tasks_member_week_day ON tasks (member_id, week_start, day_index);
		CREATE INDEX idx_tasks_week_day ON tasks (week_start, day_index);
	`);

	return drizzle(sqlite, { schema });
}

const WEEK = '2026-03-01'; // Sunday
const NOW = '2026-03-01T00:00:00.000Z';

function seedMember(db: ReturnType<typeof createTestDb>, id: string, name: string) {
	const client = db.$client as InstanceType<typeof Database>;
	client.prepare(`
		INSERT INTO family_members (id, name, theme_accent, theme_accent_light, theme_accent_dark,
			theme_header_bg, theme_ring_color, theme_check_color, created_at, updated_at)
		VALUES (?, ?, '#4a7c59', '#dcfce7', '#1e3a24', '#4a7c59', '#4a7c59', '#4a7c59', ?, ?)
	`).run(id, name, NOW, NOW);
}

function seedTask(
	db: ReturnType<typeof createTestDb>,
	overrides: Partial<{
		id: string;
		memberId: string | null;
		weekStart: string;
		dayIndex: number;
		title: string;
		emoji: string | null;
		completed: number;
		sortOrder: number;
	}> = {}
) {
	const client = db.$client as InstanceType<typeof Database>;
	const defaults = {
		id: `task-${Math.random().toString(36).slice(2, 8)}`,
		memberId: 'member-1',
		weekStart: WEEK,
		dayIndex: 0,
		title: 'Test task',
		emoji: null,
		completed: 0,
		sortOrder: 0
	};
	const row = { ...defaults, ...overrides };
	client.prepare(`
		INSERT INTO tasks (id, member_id, week_start, day_index, title, emoji, completed, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(row.id, row.memberId, row.weekStart, row.dayIndex, row.title, row.emoji, row.completed, row.sortOrder, NOW, NOW);
	return row;
}

function makeTaskData(overrides: Partial<TaskData> = {}): TaskData {
	return {
		id: 'task-new',
		memberId: 'member-1',
		weekStart: WEEK,
		dayIndex: 0,
		title: 'New task',
		completed: false,
		sortOrder: 0,
		status: 'active',
		cancelledAt: null,
		rescheduleCount: 0,
		rescheduleHistory: null,
		rescheduledFromId: null,
		...overrides
	};
}

// ── Tests ───────────────────────────────────────────────

describe('TaskRepository', () => {
	let db: ReturnType<typeof createTestDb>;
	let repo: TaskRepository;

	beforeEach(() => {
		db = createTestDb();
		repo = new TaskRepository(db);
		seedMember(db, 'member-1', 'Alice');
		seedMember(db, 'member-2', 'Bob');
	});

	// ── findById ──────────────────────────────────────────

	describe('findById', () => {
		it('returns a task when found', () => {
			seedTask(db, { id: 'task-1', title: 'Buy milk' });

			const result = repo.findById('task-1');

			expect(result).not.toBeNull();
			expect(result!.id).toBe('task-1');
			expect(result!.title).toBe('Buy milk');
			expect(result!.memberId).toBe('member-1');
			expect(result!.weekStart).toBe(WEEK);
			expect(result!.dayIndex).toBe(0);
			expect(result!.completed).toBe(false);
			expect(result!.sortOrder).toBe(0);
		});

		it('returns null for missing task', () => {
			const result = repo.findById('nonexistent');
			expect(result).toBeNull();
		});

		it('maps emoji correctly', () => {
			seedTask(db, { id: 'task-1', emoji: '🥛' });

			const result = repo.findById('task-1');
			expect(result!.emoji).toBe('🥛');
		});

		it('maps null emoji to undefined', () => {
			seedTask(db, { id: 'task-1', emoji: null });

			const result = repo.findById('task-1');
			expect(result!.emoji).toBeUndefined();
		});
	});

	// ── findByMemberAndWeek ──────────────────────────────

	describe('findByMemberAndWeek', () => {
		it('returns tasks sorted by dayIndex then sortOrder', () => {
			seedTask(db, { id: 't1', dayIndex: 2, sortOrder: 1 });
			seedTask(db, { id: 't2', dayIndex: 0, sortOrder: 0 });
			seedTask(db, { id: 't3', dayIndex: 2, sortOrder: 0 });

			const results = repo.findByMemberAndWeek('member-1', WEEK);

			expect(results).toHaveLength(3);
			expect(results[0].id).toBe('t2'); // day 0, sort 0
			expect(results[1].id).toBe('t3'); // day 2, sort 0
			expect(results[2].id).toBe('t1'); // day 2, sort 1
		});

		it('returns empty array when no tasks match', () => {
			const results = repo.findByMemberAndWeek('member-1', '2099-01-01');
			expect(results).toEqual([]);
		});

		it('filters by memberId', () => {
			seedTask(db, { id: 't1', memberId: 'member-1' });
			seedTask(db, { id: 't2', memberId: 'member-2' });

			const results = repo.findByMemberAndWeek('member-1', WEEK);

			expect(results).toHaveLength(1);
			expect(results[0].id).toBe('t1');
		});
	});

	// ── findFamilyWeek ──────────────────────────────────

	describe('findFamilyWeek', () => {
		it('returns tasks with member info via LEFT JOIN', () => {
			seedTask(db, { id: 't1', memberId: 'member-1', title: 'Alice task' });

			const results = repo.findFamilyWeek(WEEK);

			expect(results).toHaveLength(1);
			expect(results[0].id).toBe('t1');
			expect(results[0].memberName).toBe('Alice');
			expect(results[0].memberTheme).toBeDefined();
			expect(results[0].memberTheme!.accent).toBe('#4a7c59');
			expect(results[0].memberTheme!.variant).toBe('default');
		});

		it('returns tasks without member info when memberId is null', () => {
			seedTask(db, { id: 't1', memberId: null, title: 'Unassigned task' });

			const results = repo.findFamilyWeek(WEEK);

			expect(results).toHaveLength(1);
			expect(results[0].memberId).toBeNull();
			expect(results[0].memberName).toBeUndefined();
			expect(results[0].memberTheme).toBeUndefined();
		});

		it('returns tasks sorted by dayIndex then sortOrder', () => {
			seedTask(db, { id: 't1', dayIndex: 1, sortOrder: 0 });
			seedTask(db, { id: 't2', dayIndex: 0, sortOrder: 1 });
			seedTask(db, { id: 't3', dayIndex: 0, sortOrder: 0 });

			const results = repo.findFamilyWeek(WEEK);

			expect(results[0].id).toBe('t3');
			expect(results[1].id).toBe('t2');
			expect(results[2].id).toBe('t1');
		});

		it('returns empty array for a week with no tasks', () => {
			const results = repo.findFamilyWeek('2099-01-01');
			expect(results).toEqual([]);
		});

		it('includes tasks from multiple members', () => {
			seedTask(db, { id: 't1', memberId: 'member-1' });
			seedTask(db, { id: 't2', memberId: 'member-2' });

			const results = repo.findFamilyWeek(WEEK);

			expect(results).toHaveLength(2);
			const names = results.map((r) => r.memberName);
			expect(names).toContain('Alice');
			expect(names).toContain('Bob');
		});
	});

	// ── getNextSortOrder ────────────────────────────────

	describe('getNextSortOrder', () => {
		it('returns 0 when no tasks exist in the slot', () => {
			const result = repo.getNextSortOrder('member-1', WEEK, 0);
			expect(result).toBe(0);
		});

		it('returns max+1 when tasks exist', () => {
			seedTask(db, { sortOrder: 0 });
			seedTask(db, { sortOrder: 2 });
			seedTask(db, { sortOrder: 5 });

			const result = repo.getNextSortOrder('member-1', WEEK, 0);
			expect(result).toBe(6);
		});

		it('scopes to the specific day slot', () => {
			seedTask(db, { dayIndex: 0, sortOrder: 3 });
			seedTask(db, { dayIndex: 1, sortOrder: 10 });

			const result = repo.getNextSortOrder('member-1', WEEK, 0);
			expect(result).toBe(4);
		});

		it('scopes to the specific member', () => {
			seedTask(db, { memberId: 'member-1', sortOrder: 2 });
			seedTask(db, { memberId: 'member-2', sortOrder: 8 });

			const result = repo.getNextSortOrder('member-1', WEEK, 0);
			expect(result).toBe(3);
		});

		it('works with null memberId', () => {
			seedTask(db, { memberId: null, dayIndex: 0, sortOrder: 4 });
			seedTask(db, { memberId: 'member-1', dayIndex: 0, sortOrder: 10 });

			const result = repo.getNextSortOrder(null, WEEK, 0);
			// With null memberId, the condition uses weekStart + dayIndex only,
			// which matches all tasks in that day slot regardless of member
			expect(result).toBe(11);
		});
	});

	// ── insert ──────────────────────────────────────────

	describe('insert', () => {
		it('inserts a task and can be found by id', () => {
			const data = makeTaskData({ id: 'task-insert', title: 'Inserted' });
			repo.insert(data);

			const result = repo.findById('task-insert');
			expect(result).not.toBeNull();
			expect(result!.title).toBe('Inserted');
			expect(result!.completed).toBe(false);
		});

		it('stores emoji correctly', () => {
			const data = makeTaskData({ id: 'task-emoji', emoji: '🎯' });
			repo.insert(data);

			const result = repo.findById('task-emoji');
			expect(result!.emoji).toBe('🎯');
		});

		it('stores null memberId', () => {
			const data = makeTaskData({ id: 'task-no-member', memberId: null });
			repo.insert(data);

			const result = repo.findById('task-no-member');
			expect(result!.memberId).toBeNull();
		});
	});

	// ── update ──────────────────────────────────────────

	describe('update', () => {
		it('updates all mutable fields', () => {
			seedTask(db, { id: 'task-1', title: 'Original', completed: 0, sortOrder: 0 });

			const updatedData: TaskData = {
				id: 'task-1',
				memberId: 'member-2',
				weekStart: WEEK,
				dayIndex: 3,
				title: 'Updated title',
				emoji: '🎉',
				completed: true,
				sortOrder: 5,
				status: 'active',
				cancelledAt: null,
				rescheduleCount: 0,
				rescheduleHistory: null,
				rescheduledFromId: null
			};

			repo.update(updatedData);

			const result = repo.findById('task-1');
			expect(result!.title).toBe('Updated title');
			expect(result!.memberId).toBe('member-2');
			expect(result!.dayIndex).toBe(3);
			expect(result!.emoji).toBe('🎉');
			expect(result!.completed).toBe(true);
			expect(result!.sortOrder).toBe(5);
		});

		it('clears emoji when set to undefined', () => {
			seedTask(db, { id: 'task-1', emoji: '🎯' });

			const data = makeTaskData({ id: 'task-1', emoji: undefined });
			repo.update(data);

			const result = repo.findById('task-1');
			expect(result!.emoji).toBeUndefined();
		});
	});

	// ── updatePartial ───────────────────────────────────

	describe('updatePartial', () => {
		it('updates only specified fields', () => {
			seedTask(db, { id: 'task-1', title: 'Original', completed: 0 });

			repo.updatePartial('task-1', { title: 'Patched' });

			const result = repo.findById('task-1');
			expect(result!.title).toBe('Patched');
			expect(result!.completed).toBe(false); // unchanged
		});

		it('can update completed status', () => {
			seedTask(db, { id: 'task-1', completed: 0 });

			repo.updatePartial('task-1', { completed: true });

			const result = repo.findById('task-1');
			expect(result!.completed).toBe(true);
		});

		it('can update multiple fields at once', () => {
			seedTask(db, { id: 'task-1', title: 'Old', dayIndex: 0, sortOrder: 0 });

			repo.updatePartial('task-1', { title: 'New', dayIndex: 3, sortOrder: 2 });

			const result = repo.findById('task-1');
			expect(result!.title).toBe('New');
			expect(result!.dayIndex).toBe(3);
			expect(result!.sortOrder).toBe(2);
		});

		it('can set memberId to null', () => {
			seedTask(db, { id: 'task-1', memberId: 'member-1' });

			repo.updatePartial('task-1', { memberId: null });

			const result = repo.findById('task-1');
			expect(result!.memberId).toBeNull();
		});

		it('does not modify emoji when not included in fields', () => {
			seedTask(db, { id: 'task-1', emoji: '🎯' });

			repo.updatePartial('task-1', { title: 'New title' });

			const result = repo.findById('task-1');
			expect(result!.emoji).toBe('🎯');
		});
	});

	// ── delete ──────────────────────────────────────────

	describe('delete', () => {
		it('removes a task', () => {
			seedTask(db, { id: 'task-1' });
			expect(repo.findById('task-1')).not.toBeNull();

			repo.delete('task-1');

			expect(repo.findById('task-1')).toBeNull();
		});

		it('does not affect other tasks', () => {
			seedTask(db, { id: 'task-1' });
			seedTask(db, { id: 'task-2' });

			repo.delete('task-1');

			expect(repo.findById('task-1')).toBeNull();
			expect(repo.findById('task-2')).not.toBeNull();
		});

		it('is a no-op for nonexistent task', () => {
			// Should not throw
			expect(() => repo.delete('nonexistent')).not.toThrow();
		});
	});

	// ── reorder ─────────────────────────────────────────

	describe('reorder', () => {
		it('sets sortOrder to array index for each task', () => {
			seedTask(db, { id: 't1', sortOrder: 5 });
			seedTask(db, { id: 't2', sortOrder: 3 });
			seedTask(db, { id: 't3', sortOrder: 1 });

			repo.reorder(['t3', 't1', 't2'], NOW);

			expect(repo.findById('t3')!.sortOrder).toBe(0);
			expect(repo.findById('t1')!.sortOrder).toBe(1);
			expect(repo.findById('t2')!.sortOrder).toBe(2);
		});

		it('works with a single task', () => {
			seedTask(db, { id: 't1', sortOrder: 5 });

			repo.reorder(['t1'], NOW);

			expect(repo.findById('t1')!.sortOrder).toBe(0);
		});

		it('works with empty array', () => {
			expect(() => repo.reorder([], NOW)).not.toThrow();
		});
	});

	// ── findIdsByDay ────────────────────────────────────

	describe('findIdsByDay', () => {
		it('returns IDs for tasks in a specific day slot', () => {
			seedTask(db, { id: 't1', dayIndex: 0 });
			seedTask(db, { id: 't2', dayIndex: 0 });
			seedTask(db, { id: 't3', dayIndex: 1 });

			const ids = repo.findIdsByDay('member-1', WEEK, 0);

			expect(ids).toHaveLength(2);
			expect(ids).toContain('t1');
			expect(ids).toContain('t2');
		});

		it('returns empty array when no tasks match', () => {
			const ids = repo.findIdsByDay('member-1', WEEK, 5);
			expect(ids).toEqual([]);
		});

		it('scopes to the specific member', () => {
			seedTask(db, { id: 't1', memberId: 'member-1', dayIndex: 0 });
			seedTask(db, { id: 't2', memberId: 'member-2', dayIndex: 0 });

			const ids = repo.findIdsByDay('member-1', WEEK, 0);

			expect(ids).toEqual(['t1']);
		});

		it('works with null memberId', () => {
			seedTask(db, { id: 't1', memberId: null, dayIndex: 0 });
			seedTask(db, { id: 't2', memberId: 'member-1', dayIndex: 0 });

			const ids = repo.findIdsByDay(null, WEEK, 0);

			// With null memberId, matches all tasks in the day slot
			expect(ids).toHaveLength(2);
			expect(ids).toContain('t1');
			expect(ids).toContain('t2');
		});
	});
});
