import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { HabitRepository } from './habit-repository';
import * as schema from '$lib/server/db/schema';

// ── Test helpers ────────────────────────────────────────

function createTestDb() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');

	// Create tables from schema
	sqlite.exec(`
		CREATE TABLE family_members (
			id TEXT PRIMARY KEY,
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

		CREATE TABLE habits (
			id TEXT PRIMARY KEY,
			member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			emoji TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE INDEX idx_habits_member_order ON habits(member_id, sort_order);

		CREATE TABLE habit_completions (
			id TEXT PRIMARY KEY,
			habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
			week_start TEXT NOT NULL,
			day_index INTEGER NOT NULL,
			completed INTEGER NOT NULL DEFAULT 1
		);
		CREATE UNIQUE INDEX idx_habit_completions_unique ON habit_completions(habit_id, week_start, day_index);
		CREATE INDEX idx_habit_completions_week ON habit_completions(habit_id, week_start);
	`);

	return { sqlite, db: drizzle(sqlite, { schema }) };
}

function insertMember(sqlite: Database.Database, id: string, name: string) {
	const now = new Date().toISOString();
	sqlite.prepare(`
		INSERT INTO family_members (id, name, theme_accent, theme_accent_light, theme_accent_dark, theme_header_bg, theme_ring_color, theme_check_color, created_at, updated_at)
		VALUES (?, ?, '#4a7c59', '#dcfce7', '#1e3a24', '#4a7c59', '#4a7c59', '#4a7c59', ?, ?)
	`).run(id, name, now, now);
}

function insertHabit(
	sqlite: Database.Database,
	id: string,
	memberId: string,
	name: string,
	sortOrder: number,
	emoji?: string
) {
	const now = new Date().toISOString();
	sqlite.prepare(`
		INSERT INTO habits (id, member_id, name, emoji, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`).run(id, memberId, name, emoji ?? null, sortOrder, now, now);
}

function insertCompletion(
	sqlite: Database.Database,
	habitId: string,
	weekStart: string,
	dayIndex: number
) {
	const id = `compl-${habitId}-${weekStart}-${dayIndex}`;
	sqlite.prepare(`
		INSERT INTO habit_completions (id, habit_id, week_start, day_index, completed)
		VALUES (?, ?, ?, ?, 1)
	`).run(id, habitId, weekStart, dayIndex);
}

// ── Tests ───────────────────────────────────────────────

describe('HabitRepository', () => {
	let sqlite: Database.Database;
	let repo: HabitRepository;

	beforeEach(() => {
		const testDb = createTestDb();
		sqlite = testDb.sqlite;
		repo = new HabitRepository(testDb.db);

		// Seed test data
		insertMember(sqlite, 'member-1', 'Alice');
		insertMember(sqlite, 'member-2', 'Bob');
		insertHabit(sqlite, 'habit-1', 'member-1', 'Read 30 min', 0, '📚');
		insertHabit(sqlite, 'habit-2', 'member-1', 'Exercise', 1, '💪');
		insertHabit(sqlite, 'habit-3', 'member-2', 'Meditate', 0, '🧘');
	});

	// ── findById ─────────────────────────────────────────

	describe('findById', () => {
		it('returns habit when found', () => {
			const habit = repo.findById('habit-1');
			expect(habit).not.toBeNull();
			expect(habit!.id).toBe('habit-1');
			expect(habit!.memberId).toBe('member-1');
			expect(habit!.name).toBe('Read 30 min');
			expect(habit!.emoji).toBe('📚');
			expect(habit!.sortOrder).toBe(0);
		});

		it('returns null for missing id', () => {
			const habit = repo.findById('nonexistent');
			expect(habit).toBeNull();
		});
	});

	// ── findByMember ────────────────────────────────────

	describe('findByMember', () => {
		it('returns habits sorted by sortOrder', () => {
			const habits = repo.findByMember('member-1');
			expect(habits).toHaveLength(2);
			expect(habits[0].id).toBe('habit-1');
			expect(habits[0].sortOrder).toBe(0);
			expect(habits[1].id).toBe('habit-2');
			expect(habits[1].sortOrder).toBe(1);
		});

		it('returns empty array for member with no habits', () => {
			insertMember(sqlite, 'member-3', 'Charlie');
			const habits = repo.findByMember('member-3');
			expect(habits).toEqual([]);
		});
	});

	// ── findByMemberWithCompletions ─────────────────────

	describe('findByMemberWithCompletions', () => {
		it('returns habits with days array of 7 booleans', () => {
			insertCompletion(sqlite, 'habit-1', '2026-03-01', 0);
			insertCompletion(sqlite, 'habit-1', '2026-03-01', 2);
			insertCompletion(sqlite, 'habit-1', '2026-03-01', 5);

			const habits = repo.findByMemberWithCompletions('member-1', '2026-03-01');
			expect(habits).toHaveLength(2);
			expect(habits[0].id).toBe('habit-1');
			expect(habits[0].days).toEqual([true, false, true, false, false, true, false]);
			expect(habits[1].id).toBe('habit-2');
			expect(habits[1].days).toEqual([false, false, false, false, false, false, false]);
		});

		it('returns empty array when member has no habits', () => {
			insertMember(sqlite, 'member-3', 'Charlie');
			const habits = repo.findByMemberWithCompletions('member-3', '2026-03-01');
			expect(habits).toEqual([]);
		});

		it('ignores completions from different weeks', () => {
			insertCompletion(sqlite, 'habit-1', '2026-02-22', 0);

			const habits = repo.findByMemberWithCompletions('member-1', '2026-03-01');
			expect(habits[0].days).toEqual([false, false, false, false, false, false, false]);
		});
	});

	// ── findFamilyWithCompletions ───────────────────────

	describe('findFamilyWithCompletions', () => {
		it('returns all members with their habits and completions', () => {
			insertCompletion(sqlite, 'habit-1', '2026-03-01', 1);
			insertCompletion(sqlite, 'habit-3', '2026-03-01', 3);

			const result = repo.findFamilyWithCompletions('2026-03-01');
			expect(result).toHaveLength(2);

			const alice = result.find((r) => r.memberId === 'member-1');
			expect(alice).toBeDefined();
			expect(alice!.memberName).toBe('Alice');
			expect(alice!.habits).toHaveLength(2);
			expect(alice!.habits[0].days[1]).toBe(true);

			const bob = result.find((r) => r.memberId === 'member-2');
			expect(bob).toBeDefined();
			expect(bob!.memberName).toBe('Bob');
			expect(bob!.habits).toHaveLength(1);
			expect(bob!.habits[0].days[3]).toBe(true);
		});

		it('includes members with no habits', () => {
			insertMember(sqlite, 'member-3', 'Charlie');
			const result = repo.findFamilyWithCompletions('2026-03-01');
			const charlie = result.find((r) => r.memberId === 'member-3');
			expect(charlie).toBeDefined();
			expect(charlie!.habits).toEqual([]);
		});
	});

	// ── getNextSortOrder ────────────────────────────────

	describe('getNextSortOrder', () => {
		it('returns max sortOrder + 1', () => {
			const next = repo.getNextSortOrder('member-1');
			expect(next).toBe(2); // existing habits have 0, 1
		});

		it('returns 0 when member has no habits', () => {
			insertMember(sqlite, 'member-3', 'Charlie');
			const next = repo.getNextSortOrder('member-3');
			expect(next).toBe(0);
		});
	});

	// ── insert ──────────────────────────────────────────

	describe('insert', () => {
		it('inserts a habit', () => {
			repo.insert({
				id: 'habit-new',
				memberId: 'member-1',
				name: 'Drink water',
				emoji: '💧',
				sortOrder: 2
			});

			const habit = repo.findById('habit-new');
			expect(habit).not.toBeNull();
			expect(habit!.name).toBe('Drink water');
			expect(habit!.emoji).toBe('💧');
			expect(habit!.sortOrder).toBe(2);
		});

		it('inserts a habit without emoji', () => {
			repo.insert({
				id: 'habit-no-emoji',
				memberId: 'member-1',
				name: 'Stretch',
				sortOrder: 3
			});

			const habit = repo.findById('habit-no-emoji');
			expect(habit).not.toBeNull();
			expect(habit!.emoji).toBeUndefined();
		});
	});

	// ── update ──────────────────────────────────────────

	describe('update', () => {
		it('updates all fields', () => {
			repo.update({
				id: 'habit-1',
				memberId: 'member-1',
				name: 'Read 60 min',
				emoji: '📖',
				sortOrder: 5
			});

			const habit = repo.findById('habit-1');
			expect(habit!.name).toBe('Read 60 min');
			expect(habit!.emoji).toBe('📖');
			expect(habit!.sortOrder).toBe(5);
		});
	});

	// ── updatePartial ───────────────────────────────────

	describe('updatePartial', () => {
		it('updates only specified fields', () => {
			repo.updatePartial('habit-1', { name: 'Read 45 min' });

			const habit = repo.findById('habit-1');
			expect(habit!.name).toBe('Read 45 min');
			expect(habit!.emoji).toBe('📚'); // unchanged
			expect(habit!.sortOrder).toBe(0); // unchanged
		});

		it('can clear emoji to undefined', () => {
			repo.updatePartial('habit-1', { emoji: undefined });

			const habit = repo.findById('habit-1');
			expect(habit!.emoji).toBeUndefined();
		});
	});

	// ── delete ──────────────────────────────────────────

	describe('delete', () => {
		it('removes a habit', () => {
			repo.delete('habit-1');
			const habit = repo.findById('habit-1');
			expect(habit).toBeNull();
		});

		it('cascades to completions', () => {
			insertCompletion(sqlite, 'habit-1', '2026-03-01', 0);
			repo.delete('habit-1');

			const completionExists = repo.findCompletion('habit-1', '2026-03-01', 0);
			expect(completionExists).toBe(false);
		});
	});

	// ── reorder ─────────────────────────────────────────

	describe('reorder', () => {
		it('sets correct sortOrder values', () => {
			const now = new Date().toISOString();
			repo.reorder(['habit-2', 'habit-1'], now);

			const habits = repo.findByMember('member-1');
			expect(habits[0].id).toBe('habit-2');
			expect(habits[0].sortOrder).toBe(0);
			expect(habits[1].id).toBe('habit-1');
			expect(habits[1].sortOrder).toBe(1);
		});
	});

	// ── findIdsByMember ─────────────────────────────────

	describe('findIdsByMember', () => {
		it('returns habit IDs for the member', () => {
			const ids = repo.findIdsByMember('member-1');
			expect(ids).toHaveLength(2);
			expect(ids).toContain('habit-1');
			expect(ids).toContain('habit-2');
		});

		it('returns empty array for member with no habits', () => {
			insertMember(sqlite, 'member-3', 'Charlie');
			const ids = repo.findIdsByMember('member-3');
			expect(ids).toEqual([]);
		});
	});

	// ── findCompletion ──────────────────────────────────

	describe('findCompletion', () => {
		it('returns true when completion exists', () => {
			insertCompletion(sqlite, 'habit-1', '2026-03-01', 2);
			const exists = repo.findCompletion('habit-1', '2026-03-01', 2);
			expect(exists).toBe(true);
		});

		it('returns false when completion does not exist', () => {
			const exists = repo.findCompletion('habit-1', '2026-03-01', 2);
			expect(exists).toBe(false);
		});
	});

	// ── insertCompletion ────────────────────────────────

	describe('insertCompletion', () => {
		it('adds a completion', () => {
			repo.insertCompletion('habit-1', '2026-03-01', 4);
			const exists = repo.findCompletion('habit-1', '2026-03-01', 4);
			expect(exists).toBe(true);
		});
	});

	// ── deleteCompletion ────────────────────────────────

	describe('deleteCompletion', () => {
		it('removes a completion', () => {
			insertCompletion(sqlite, 'habit-1', '2026-03-01', 3);
			repo.deleteCompletion('habit-1', '2026-03-01', 3);

			const exists = repo.findCompletion('habit-1', '2026-03-01', 3);
			expect(exists).toBe(false);
		});

		it('does nothing when completion does not exist', () => {
			// Should not throw
			repo.deleteCompletion('habit-1', '2026-03-01', 6);
			const exists = repo.findCompletion('habit-1', '2026-03-01', 6);
			expect(exists).toBe(false);
		});
	});
});
