import { describe, it, expect } from 'vitest';
import { HabitCollection } from './habit-collection';
import { Habit } from './habit';
import type { HabitData } from './types';

function makeHabitData(overrides: Partial<HabitData> = {}): HabitData {
	return {
		id: 'habit-1',
		memberId: 'member-1',
		name: 'Read',
		sortOrder: 0,
		...overrides
	};
}

function makeHabit(overrides: Partial<HabitData> = {}): Habit {
	return Habit.fromData(makeHabitData(overrides));
}

const MEMBER = 'member-1';

describe('HabitCollection hydration', () => {
	it('has() returns false for unknown memberId', () => {
		const col = new HabitCollection();
		expect(col.has('unknown')).toBe(false);
	});

	it('hydrate() stores habits and has() returns true', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit()]);
		expect(col.has(MEMBER)).toBe(true);
	});

	it('hydrate() replaces existing habits for same member', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a' }), makeHabit({ id: 'b' })]);
		col.hydrate(MEMBER, [makeHabit({ id: 'c' })]);
		expect(col.getAll(MEMBER)).toHaveLength(1);
	});
});

describe('HabitCollection.getAll', () => {
	it('returns empty array for unknown member', () => {
		const col = new HabitCollection();
		expect(col.getAll('unknown')).toEqual([]);
	});

	it('returns habits sorted by sortOrder', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [
			makeHabit({ id: 'c', sortOrder: 2 }),
			makeHabit({ id: 'a', sortOrder: 0 }),
			makeHabit({ id: 'b', sortOrder: 1 })
		]);
		const habits = col.getAll(MEMBER);
		expect(habits.map(h => h.id)).toEqual(['a', 'b', 'c']);
	});
});

describe('HabitCollection.findById', () => {
	it('finds a habit across any member', () => {
		const col = new HabitCollection();
		col.hydrate('m1', [makeHabit({ id: 'a', memberId: 'm1' })]);
		col.hydrate('m2', [makeHabit({ id: 'b', memberId: 'm2' })]);
		expect(col.findById('b')?.id).toBe('b');
	});

	it('returns undefined for unknown id', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a' })]);
		expect(col.findById('unknown')).toBeUndefined();
	});
});

describe('HabitCollection.insert', () => {
	it('inserts into existing member', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a' })]);
		col.insert(MEMBER, makeHabit({ id: 'b' }));
		expect(col.getAll(MEMBER)).toHaveLength(2);
	});

	it('creates member key if it does not exist', () => {
		const col = new HabitCollection();
		col.insert(MEMBER, makeHabit({ id: 'a' }));
		expect(col.has(MEMBER)).toBe(true);
	});
});

describe('HabitCollection.remove', () => {
	it('removes a habit by id', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a' }), makeHabit({ id: 'b' })]);
		expect(col.remove('a')).toBe(true);
		expect(col.getAll(MEMBER)).toHaveLength(1);
		expect(col.findById('a')).toBeUndefined();
	});

	it('returns false for unknown id', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a' })]);
		expect(col.remove('unknown')).toBe(false);
	});
});

describe('HabitCollection.reorder', () => {
	it('sets sortOrder based on position in habitIds', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [
			makeHabit({ id: 'a', sortOrder: 0 }),
			makeHabit({ id: 'b', sortOrder: 1 }),
			makeHabit({ id: 'c', sortOrder: 2 })
		]);
		col.reorder(MEMBER, ['c', 'a', 'b']);
		const habits = col.getAll(MEMBER);
		expect(habits.map(h => h.id)).toEqual(['c', 'a', 'b']);
	});

	it('does nothing for unknown member', () => {
		const col = new HabitCollection();
		col.reorder('unknown', ['a', 'b']);
	});
});

describe('HabitCollection.nextSortOrder', () => {
	it('returns 0 for empty member', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, []);
		expect(col.nextSortOrder(MEMBER)).toBe(0);
	});

	it('returns max + 1 for existing habits', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [
			makeHabit({ id: 'a', sortOrder: 2 }),
			makeHabit({ id: 'b', sortOrder: 5 })
		]);
		expect(col.nextSortOrder(MEMBER)).toBe(6);
	});

	it('returns 0 for unknown member', () => {
		const col = new HabitCollection();
		expect(col.nextSortOrder('unknown')).toBe(0);
	});
});

describe('HabitCollection snapshot/restore', () => {
	it('snapshot creates an independent deep copy', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a', name: 'Original' })]);
		const snap = col.snapshot();
		col.findById('a')!.updateName('Changed');
		const snapHabits = snap.get(MEMBER)!;
		expect(snapHabits[0].name).toBe('Original');
	});

	it('restore replaces current state with snapshot', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a', name: 'Original' })]);
		const snap = col.snapshot();
		col.findById('a')!.updateName('Changed');
		col.restore(snap);
		expect(col.findById('a')!.name).toBe('Original');
	});
});

describe('HabitCollection.clear', () => {
	it('removes all data', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit()]);
		col.clear();
		expect(col.has(MEMBER)).toBe(false);
	});
});
