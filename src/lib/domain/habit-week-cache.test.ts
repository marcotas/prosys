import { describe, it, expect, beforeEach } from 'vitest';
import { HabitWeekCache } from './habit-week-cache';
import type { HabitWithDays, FamilyHabitProgress, ThemeConfig } from '$lib/types';

// ── Helpers ──────────────────────────────────────────────

const testTheme: ThemeConfig = {
	variant: 'default',
	accent: '#4a7c59',
	accentLight: '#dcfce7',
	accentDark: '#1e3a24',
	headerBg: '#4a7c59',
	ringColor: '#4a7c59',
	checkColor: '#4a7c59',
	emoji: ''
};

function makeHabit(overrides: Partial<HabitWithDays> = {}): HabitWithDays {
	return {
		id: 'h1',
		memberId: 'm1',
		name: 'Exercise',
		sortOrder: 0,
		days: [false, false, false, false, false, false, false],
		...overrides
	};
}

function makeFamilyProgress(overrides: Partial<FamilyHabitProgress> = {}): FamilyHabitProgress {
	return {
		memberId: 'm1',
		memberName: 'Alice',
		theme: testTheme,
		habits: [makeHabit()],
		...overrides
	};
}

// ── Tests ────────────────────────────────────────────────

describe('HabitWeekCache', () => {
	let cache: HabitWeekCache;

	beforeEach(() => {
		cache = new HabitWeekCache();
	});

	// ── Static key helpers ──────────────────────────────

	describe('static key helpers', () => {
		it('memberKey returns memberId:weekStart', () => {
			expect(HabitWeekCache.memberKey('m1', '2026-03-08')).toBe('m1:2026-03-08');
		});

		it('familyKey returns __family_habits__:weekStart', () => {
			expect(HabitWeekCache.familyKey('2026-03-08')).toBe('__family_habits__:2026-03-08');
		});
	});

	// ── has / hydrate ───────────────────────────────────

	describe('has / hydrate', () => {
		it('returns false for unknown keys', () => {
			expect(cache.has('m1:2026-03-08')).toBe(false);
		});

		it('returns true after hydration', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit()]);
			expect(cache.has(key)).toBe(true);
		});

		it('overwrites existing data on re-hydration', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit({ name: 'Old' })]);
			cache.hydrate(key, [makeHabit({ name: 'New' })]);
			expect(cache.getHabitsWithDays(key)[0].name).toBe('New');
		});
	});

	// ── getHabitsWithDays / getFamilyHabitProgress ──────

	describe('getHabitsWithDays', () => {
		it('returns empty array for missing key', () => {
			expect(cache.getHabitsWithDays('missing')).toEqual([]);
		});

		it('returns hydrated habits', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			const habits = [makeHabit(), makeHabit({ id: 'h2', name: 'Read' })];
			cache.hydrate(key, habits);
			expect(cache.getHabitsWithDays(key)).toHaveLength(2);
		});
	});

	describe('getFamilyHabitProgress', () => {
		it('returns empty array for missing key', () => {
			expect(cache.getFamilyHabitProgress('missing')).toEqual([]);
		});

		it('returns hydrated family progress', () => {
			const key = HabitWeekCache.familyKey('2026-03-08');
			const data = [makeFamilyProgress()];
			cache.hydrate(key, data);
			expect(cache.getFamilyHabitProgress(key)).toHaveLength(1);
			expect(cache.getFamilyHabitProgress(key)[0].memberName).toBe('Alice');
		});
	});

	// ── insertHabit ─────────────────────────────────────

	describe('insertHabit', () => {
		it('adds habit to all cached weeks for the member', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m1', '2026-03-15');
			cache.hydrate(k1, []);
			cache.hydrate(k2, []);

			const habit = makeHabit({ id: 'h-new' });
			cache.insertHabit('m1', habit);

			expect(cache.getHabitsWithDays(k1)).toHaveLength(1);
			expect(cache.getHabitsWithDays(k2)).toHaveLength(1);
		});

		it('does not add to other members', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m2', '2026-03-08');
			cache.hydrate(k1, []);
			cache.hydrate(k2, []);

			cache.insertHabit('m1', makeHabit());

			expect(cache.getHabitsWithDays(k1)).toHaveLength(1);
			expect(cache.getHabitsWithDays(k2)).toHaveLength(0);
		});

		it('does not add to family keys', () => {
			const fk = HabitWeekCache.familyKey('2026-03-08');
			cache.hydrate(fk, [makeFamilyProgress({ habits: [] })]);

			cache.insertHabit('m1', makeHabit());

			// Family cache should be untouched (still 1 FamilyHabitProgress entry)
			expect(cache.getFamilyHabitProgress(fk)).toHaveLength(1);
		});

		it('creates cache entry when no entries exist for member and weekStart is provided', () => {
			const habit = makeHabit({ id: 'h-new' });
			cache.insertHabit('m1', habit, '2026-03-08');

			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			expect(cache.has(key)).toBe(true);
			expect(cache.getHabitsWithDays(key)).toHaveLength(1);
			expect(cache.getHabitsWithDays(key)[0].id).toBe('h-new');
		});

		it('does not create cache entry when entries exist even if weekStart is provided', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(k1, []);

			cache.insertHabit('m1', makeHabit(), '2026-03-15');

			// Should add to existing key, not create new one
			expect(cache.getHabitsWithDays(k1)).toHaveLength(1);
			expect(cache.has(HabitWeekCache.memberKey('m1', '2026-03-15'))).toBe(false);
		});
	});

	// ── updateHabit ─────────────────────────────────────

	describe('updateHabit', () => {
		it('updates habit in all cached member weeks and returns memberId', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m1', '2026-03-15');
			cache.hydrate(k1, [makeHabit()]);
			cache.hydrate(k2, [makeHabit()]);

			const memberId = cache.updateHabit('h1', { name: 'Yoga' });

			expect(memberId).toBe('m1');
			expect(cache.getHabitsWithDays(k1)[0].name).toBe('Yoga');
			expect(cache.getHabitsWithDays(k2)[0].name).toBe('Yoga');
		});

		it('returns undefined when habit not found', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit()]);

			expect(cache.updateHabit('nonexistent', { name: 'Nope' })).toBeUndefined();
		});

		it('does not touch family caches', () => {
			const mk = HabitWeekCache.memberKey('m1', '2026-03-08');
			const fk = HabitWeekCache.familyKey('2026-03-08');
			cache.hydrate(mk, [makeHabit()]);
			cache.hydrate(fk, [makeFamilyProgress()]);

			cache.updateHabit('h1', { name: 'Updated' });

			// Family data should still have the old name
			expect(cache.getFamilyHabitProgress(fk)[0].habits[0].name).toBe('Exercise');
		});
	});

	// ── removeHabit ─────────────────────────────────────

	describe('removeHabit', () => {
		it('removes habit from all cached member weeks and returns memberId', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m1', '2026-03-15');
			cache.hydrate(k1, [makeHabit()]);
			cache.hydrate(k2, [makeHabit()]);

			const memberId = cache.removeHabit('h1');

			expect(memberId).toBe('m1');
			expect(cache.getHabitsWithDays(k1)).toHaveLength(0);
			expect(cache.getHabitsWithDays(k2)).toHaveLength(0);
		});

		it('returns undefined when habit not found', () => {
			expect(cache.removeHabit('nonexistent')).toBeUndefined();
		});

		it('does not touch family caches', () => {
			const mk = HabitWeekCache.memberKey('m1', '2026-03-08');
			const fk = HabitWeekCache.familyKey('2026-03-08');
			cache.hydrate(mk, [makeHabit()]);
			cache.hydrate(fk, [makeFamilyProgress()]);

			cache.removeHabit('h1');

			expect(cache.getFamilyHabitProgress(fk)[0].habits).toHaveLength(1);
		});

		it('skips member caches that do not contain the habit', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m2', '2026-03-08');
			cache.hydrate(k1, [makeHabit({ id: 'h1', memberId: 'm1' })]);
			cache.hydrate(k2, [makeHabit({ id: 'h-other', memberId: 'm2' })]);

			const memberId = cache.removeHabit('h1');

			expect(memberId).toBe('m1');
			expect(cache.getHabitsWithDays(k1)).toHaveLength(0);
			expect(cache.getHabitsWithDays(k2)).toHaveLength(1);
		});
	});

	// ── toggleDay ───────────────────────────────────────

	describe('toggleDay', () => {
		it('toggles day in member-scoped cache', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit()]);

			cache.toggleDay('h1', '2026-03-08', 2);

			expect(cache.getHabitsWithDays(key)[0].days[2]).toBe(true);
		});

		it('toggles back to false on second call', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit()]);

			cache.toggleDay('h1', '2026-03-08', 2);
			cache.toggleDay('h1', '2026-03-08', 2);

			expect(cache.getHabitsWithDays(key)[0].days[2]).toBe(false);
		});

		it('toggles day in family-scoped cache', () => {
			const mk = HabitWeekCache.memberKey('m1', '2026-03-08');
			const fk = HabitWeekCache.familyKey('2026-03-08');
			cache.hydrate(mk, [makeHabit()]);
			cache.hydrate(fk, [makeFamilyProgress()]);

			cache.toggleDay('h1', '2026-03-08', 3);

			expect(cache.getFamilyHabitProgress(fk)[0].habits[0].days[3]).toBe(true);
		});

		it('only affects the matching weekStart', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m1', '2026-03-15');
			cache.hydrate(k1, [makeHabit()]);
			cache.hydrate(k2, [makeHabit()]);

			cache.toggleDay('h1', '2026-03-08', 0);

			expect(cache.getHabitsWithDays(k1)[0].days[0]).toBe(true);
			expect(cache.getHabitsWithDays(k2)[0].days[0]).toBe(false);
		});

		it('is a no-op when habit not found', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit()]);

			// Should not throw
			cache.toggleDay('nonexistent', '2026-03-08', 0);

			expect(cache.getHabitsWithDays(key)[0].days[0]).toBe(false);
		});

		it('is a no-op in family cache when habit not found', () => {
			const mk = HabitWeekCache.memberKey('m1', '2026-03-08');
			const fk = HabitWeekCache.familyKey('2026-03-08');
			cache.hydrate(mk, [makeHabit()]);
			cache.hydrate(fk, [makeFamilyProgress({ habits: [makeHabit({ id: 'h-other' })] })]);

			cache.toggleDay('h1', '2026-03-08', 0);

			// h-other in family cache should be unchanged
			expect(cache.getFamilyHabitProgress(fk)[0].habits[0].days[0]).toBe(false);
		});
	});

	// ── setDay ──────────────────────────────────────────

	describe('setDay', () => {
		it('sets day to true in member-scoped cache', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit()]);

			cache.setDay('h1', '2026-03-08', 1, true);

			expect(cache.getHabitsWithDays(key)[0].days[1]).toBe(true);
		});

		it('sets day to false in member-scoped cache', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit({ days: [true, true, false, false, false, false, false] })]);

			cache.setDay('h1', '2026-03-08', 0, false);

			expect(cache.getHabitsWithDays(key)[0].days[0]).toBe(false);
		});

		it('sets day in family-scoped cache', () => {
			const fk = HabitWeekCache.familyKey('2026-03-08');
			const mk = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(mk, [makeHabit()]);
			cache.hydrate(fk, [makeFamilyProgress()]);

			cache.setDay('h1', '2026-03-08', 4, true);

			expect(cache.getFamilyHabitProgress(fk)[0].habits[0].days[4]).toBe(true);
		});

		it('only affects the matching weekStart', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m1', '2026-03-15');
			cache.hydrate(k1, [makeHabit()]);
			cache.hydrate(k2, [makeHabit()]);

			cache.setDay('h1', '2026-03-08', 0, true);

			expect(cache.getHabitsWithDays(k1)[0].days[0]).toBe(true);
			expect(cache.getHabitsWithDays(k2)[0].days[0]).toBe(false);
		});

		it('is a no-op when habit not found in member cache', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit({ id: 'other' })]);

			cache.setDay('h1', '2026-03-08', 0, true);

			expect(cache.getHabitsWithDays(key)[0].days[0]).toBe(false);
		});

		it('is a no-op in family cache when habit not found', () => {
			const mk = HabitWeekCache.memberKey('m1', '2026-03-08');
			const fk = HabitWeekCache.familyKey('2026-03-08');
			cache.hydrate(mk, [makeHabit()]);
			cache.hydrate(fk, [makeFamilyProgress({ habits: [makeHabit({ id: 'h-other' })] })]);

			cache.setDay('h1', '2026-03-08', 0, true);

			expect(cache.getFamilyHabitProgress(fk)[0].habits[0].days[0]).toBe(false);
		});
	});

	// ── reorderHabits ───────────────────────────────────

	describe('reorderHabits', () => {
		it('updates sortOrder based on array position', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [
				makeHabit({ id: 'h1', sortOrder: 0 }),
				makeHabit({ id: 'h2', sortOrder: 1 }),
				makeHabit({ id: 'h3', sortOrder: 2 })
			]);

			cache.reorderHabits('m1', ['h3', 'h1', 'h2']);

			const habits = cache.getHabitsWithDays(key);
			expect(habits[0].id).toBe('h3');
			expect(habits[0].sortOrder).toBe(0);
			expect(habits[1].id).toBe('h1');
			expect(habits[1].sortOrder).toBe(1);
			expect(habits[2].id).toBe('h2');
			expect(habits[2].sortOrder).toBe(2);
		});

		it('applies to all cached weeks for the member', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m1', '2026-03-15');
			cache.hydrate(k1, [
				makeHabit({ id: 'h1', sortOrder: 0 }),
				makeHabit({ id: 'h2', sortOrder: 1 })
			]);
			cache.hydrate(k2, [
				makeHabit({ id: 'h1', sortOrder: 0 }),
				makeHabit({ id: 'h2', sortOrder: 1 })
			]);

			cache.reorderHabits('m1', ['h2', 'h1']);

			expect(cache.getHabitsWithDays(k1)[0].id).toBe('h2');
			expect(cache.getHabitsWithDays(k2)[0].id).toBe('h2');
		});

		it('does not affect other members', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m2', '2026-03-08');
			cache.hydrate(k1, [makeHabit({ id: 'h1', sortOrder: 0 }), makeHabit({ id: 'h2', sortOrder: 1 })]);
			cache.hydrate(k2, [makeHabit({ id: 'h3', memberId: 'm2', sortOrder: 0 })]);

			cache.reorderHabits('m1', ['h2', 'h1']);

			expect(cache.getHabitsWithDays(k2)[0].sortOrder).toBe(0);
		});

		it('preserves sortOrder for habits not in the ids array', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [
				makeHabit({ id: 'h1', sortOrder: 0 }),
				makeHabit({ id: 'h2', sortOrder: 1 }),
				makeHabit({ id: 'h3', sortOrder: 5 })
			]);

			// Only reorder h1 and h2, h3 not in list
			cache.reorderHabits('m1', ['h2', 'h1']);

			const habits = cache.getHabitsWithDays(key);
			const h3 = habits.find((h) => h.id === 'h3')!;
			expect(h3.sortOrder).toBe(5);
		});
	});

	// ── invalidateFamilyCaches ──────────────────────────

	describe('invalidateFamilyCaches', () => {
		it('deletes all family-scoped keys', () => {
			const fk1 = HabitWeekCache.familyKey('2026-03-08');
			const fk2 = HabitWeekCache.familyKey('2026-03-15');
			const mk = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(fk1, [makeFamilyProgress()]);
			cache.hydrate(fk2, [makeFamilyProgress()]);
			cache.hydrate(mk, [makeHabit()]);

			cache.invalidateFamilyCaches();

			expect(cache.has(fk1)).toBe(false);
			expect(cache.has(fk2)).toBe(false);
			expect(cache.has(mk)).toBe(true);
		});

		it('is a no-op when no family keys exist', () => {
			const mk = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(mk, [makeHabit()]);

			cache.invalidateFamilyCaches();

			expect(cache.has(mk)).toBe(true);
		});
	});

	// ── replaceTemp ─────────────────────────────────────

	describe('replaceTemp', () => {
		it('replaces temp habit with server data in all member weeks', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m1', '2026-03-15');
			cache.hydrate(k1, [makeHabit({ id: 'temp-123' })]);
			cache.hydrate(k2, [makeHabit({ id: 'temp-123' })]);

			const serverHabit = makeHabit({ id: 'server-456', name: 'Server Exercise' });
			cache.replaceTemp('m1', 'temp-123', serverHabit);

			expect(cache.getHabitsWithDays(k1)[0].id).toBe('server-456');
			expect(cache.getHabitsWithDays(k1)[0].name).toBe('Server Exercise');
			expect(cache.getHabitsWithDays(k2)[0].id).toBe('server-456');
		});

		it('does not affect other members', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m2', '2026-03-08');
			cache.hydrate(k1, [makeHabit({ id: 'temp-123' })]);
			cache.hydrate(k2, [makeHabit({ id: 'temp-123', memberId: 'm2' })]);

			cache.replaceTemp('m1', 'temp-123', makeHabit({ id: 'server-456' }));

			expect(cache.getHabitsWithDays(k1)[0].id).toBe('server-456');
			expect(cache.getHabitsWithDays(k2)[0].id).toBe('temp-123');
		});

		it('is a no-op when temp id not found', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit()]);

			cache.replaceTemp('m1', 'nonexistent', makeHabit({ id: 'server' }));

			expect(cache.getHabitsWithDays(key)[0].id).toBe('h1');
		});
	});

	// ── findMemberIdByHabitId ───────────────────────────

	describe('findMemberIdByHabitId', () => {
		it('finds memberId from member-scoped caches', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit({ id: 'h1', memberId: 'm1' })]);

			expect(cache.findMemberIdByHabitId('h1')).toBe('m1');
		});

		it('returns undefined when not found', () => {
			expect(cache.findMemberIdByHabitId('nonexistent')).toBeUndefined();
		});

		it('skips family caches', () => {
			const fk = HabitWeekCache.familyKey('2026-03-08');
			cache.hydrate(fk, [makeFamilyProgress({ memberId: 'm1', habits: [makeHabit()] })]);

			// Habit exists only in family cache, should not be found
			expect(cache.findMemberIdByHabitId('h1')).toBeUndefined();
		});

		it('skips member caches that do not contain the habit', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m2', '2026-03-08');
			cache.hydrate(k1, [makeHabit({ id: 'h-other', memberId: 'm1' })]);
			cache.hydrate(k2, [makeHabit({ id: 'h-target', memberId: 'm2' })]);

			expect(cache.findMemberIdByHabitId('h-target')).toBe('m2');
		});
	});

	// ── snapshot / restore ──────────────────────────────

	describe('snapshot / restore', () => {
		it('snapshot creates a deep clone', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit()]);

			const snap = cache.snapshot();

			// Mutate original
			cache.updateHabit('h1', { name: 'Changed' });

			// Snapshot should be unaffected
			const snapHabits = snap.get(key) as HabitWithDays[];
			expect(snapHabits[0].name).toBe('Exercise');
		});

		it('restore replaces current cache', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit()]);

			const snap = cache.snapshot();

			// Mutate
			cache.updateHabit('h1', { name: 'Changed' });
			expect(cache.getHabitsWithDays(key)[0].name).toBe('Changed');

			// Restore
			cache.restore(snap);
			expect(cache.getHabitsWithDays(key)[0].name).toBe('Exercise');
		});

		it('snapshot includes family caches', () => {
			const fk = HabitWeekCache.familyKey('2026-03-08');
			cache.hydrate(fk, [makeFamilyProgress()]);

			const snap = cache.snapshot();

			cache.invalidateFamilyCaches();
			expect(cache.has(fk)).toBe(false);

			cache.restore(snap);
			expect(cache.has(fk)).toBe(true);
		});

		it('snapshot days array is independent', () => {
			const key = HabitWeekCache.memberKey('m1', '2026-03-08');
			cache.hydrate(key, [makeHabit()]);

			const snap = cache.snapshot();

			cache.toggleDay('h1', '2026-03-08', 0);

			const snapHabits = snap.get(key) as HabitWithDays[];
			expect(snapHabits[0].days[0]).toBe(false);
			expect(cache.getHabitsWithDays(key)[0].days[0]).toBe(true);
		});
	});

	// ── memberEntries ───────────────────────────────────

	describe('memberEntries', () => {
		it('returns all entries for the given member', () => {
			const k1 = HabitWeekCache.memberKey('m1', '2026-03-08');
			const k2 = HabitWeekCache.memberKey('m1', '2026-03-15');
			const k3 = HabitWeekCache.memberKey('m2', '2026-03-08');
			cache.hydrate(k1, [makeHabit()]);
			cache.hydrate(k2, [makeHabit({ id: 'h2' })]);
			cache.hydrate(k3, [makeHabit({ id: 'h3', memberId: 'm2' })]);

			const entries = cache.memberEntries('m1');
			expect(entries).toHaveLength(2);
			expect(entries.map(([k]) => k).sort()).toEqual([k1, k2].sort());
		});

		it('excludes family caches', () => {
			const mk = HabitWeekCache.memberKey('m1', '2026-03-08');
			const fk = HabitWeekCache.familyKey('2026-03-08');
			cache.hydrate(mk, [makeHabit()]);
			cache.hydrate(fk, [makeFamilyProgress()]);

			const entries = cache.memberEntries('m1');
			expect(entries).toHaveLength(1);
			expect(entries[0][0]).toBe(mk);
		});

		it('returns empty array for unknown member', () => {
			expect(cache.memberEntries('unknown')).toEqual([]);
		});
	});

	// ── clear ───────────────────────────────────────────

	describe('clear', () => {
		it('removes all cached data', () => {
			const mk = HabitWeekCache.memberKey('m1', '2026-03-08');
			const fk = HabitWeekCache.familyKey('2026-03-08');
			cache.hydrate(mk, [makeHabit()]);
			cache.hydrate(fk, [makeFamilyProgress()]);

			cache.clear();

			expect(cache.has(mk)).toBe(false);
			expect(cache.has(fk)).toBe(false);
		});
	});
});
